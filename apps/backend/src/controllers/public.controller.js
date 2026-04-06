import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';

// ── SSE client registry ───────────────────────────────────────────────────────
// eventId → Set of SSE response objects for teachers watching that event
const sseClients = new Map();

function broadcastSlotUpdate(eventId, slot) {
    const listeners = sseClients.get(eventId);
    if (!listeners?.size) return;
    const msg = `data: ${JSON.stringify(slot)}\n\n`;
    for (const res of listeners) {
        try { res.write(msg); } catch { /* client disconnected */ }
    }
}

// GET /api/public/events/:eventId/slot-updates
// SSE stream — teacher manage page subscribes to receive instant slot updates
export const subscribeToSlotUpdates = (req, res) => {
    const { eventId } = req.params;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    if (!sseClients.has(eventId)) sseClients.set(eventId, new Set());
    sseClients.get(eventId).add(res);

    // Keep-alive ping every 25 seconds
    const ping = setInterval(() => {
        try { res.write(': ping\n\n'); } catch { clearInterval(ping); }
    }, 25000);

    req.on('close', () => {
        clearInterval(ping);
        sseClients.get(eventId)?.delete(res);
    });
};

// ── Slot generation helper ───────────────────────────────────────────────────
// Generates slot times for one day based on event session/break config.
function generateSlotTimes(startTime, endTime, sessionLength, breakLength, date, teacherId, eventId) {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const endMinutes = eh * 60 + em;

    const slots = [];
    let cur = sh * 60 + sm;

    while (cur + sessionLength <= endMinutes) {
        const h = String(Math.floor(cur / 60)).padStart(2, '0');
        const m = String(cur % 60).padStart(2, '0');
        slots.push({ teacherId, eventId, date, time: `${h}:${m}` });
        cur += sessionLength + breakLength;
    }

    return slots;
}

// GET /api/public/events/by-qr/:qrToken
// No auth — used by parent booking page to look up event from scanned QR code
export const getPublicEvent = async (req, res) => {
    try {
        const event = await prisma.event.findUnique({
            where: { qrToken: req.params.qrToken },
            select: {
                id: true,
                name: true,
                description: true,
                type: true,
                date: true,
                startTime: true,
                endTime: true,
                status: true,
                bookingActive: true,
                days: { select: { id: true, date: true, startTime: true, endTime: true }, orderBy: { date: 'asc' } },
                _count: { select: { bookings: true } },
            },
        });

        if (!event) return res.status(404).json({ error: 'Event not found' });

        res.json(event);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/public/events/by-qr/:qrToken/slots
// No auth — returns slots with teacher info for the parent booking page
export const getPublicSlots = async (req, res) => {
    try {
        const event = await prisma.event.findUnique({
            where: { qrToken: req.params.qrToken },
            select: { id: true },
        });

        if (!event) return res.status(404).json({ error: 'Event not found' });

        const slots = await prisma.slot.findMany({
            where: { eventId: event.id },
            include: {
                teacher: { select: { id: true, salutation: true, titel: true, firstName: true, surname: true, klasse: true, roomNo: true } },
                bookings: { where: { status: 'confirmed' }, select: { id: true } },
            },
            orderBy: [{ date: 'asc' }, { time: 'asc' }],
        });

        const result = slots.map((s) => ({
            id: s.id,
            teacherId: s.teacherId,
            eventId: s.eventId,
            time: s.time,
            date: s.date,
            status: s.status,
            available: s.status === 'available',
            teacher1Present: s.teacher1Present,
            teacher2Present: s.teacher2Present,
            teacher: s.teacher,
        }));

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/public/events/:eventId
// No auth — returns event + school info for public pages (booking + teacher manage)
export const getPublicEventById = async (req, res) => {
    try {
        const event = await prisma.event.findUnique({
            where: { id: req.params.eventId },
            include: {
                school: { select: { id: true, name: true, logo: true } },
                days: { orderBy: { date: 'asc' } },
            },
        });

        if (!event) return res.status(404).json({ error: 'Event not found' });

        res.json(event);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/public/events/:eventId/teachers
// No auth — returns all active teachers for an event (for parent booking teacher-selection step)
export const getPublicTeachers = async (req, res) => {
    try {
        const teachers = await prisma.teacher.findMany({
            where: { eventId: req.params.eventId, isActive: true },
            orderBy: { surname: 'asc' },
        });

        res.json(teachers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /api/public/teachers/access
// No auth — teacher enters their emailed access code to get a session token
export const verifyTeacherCode = async (req, res) => {
    try {
        const { code, eventId } = req.body;
        if (!code || !eventId) {
            return res.status(400).json({ error: 'code and eventId are required' });
        }

        // Try T1 code first, then T2 code
        let teacher = await prisma.teacher.findFirst({
            where: { accessCode: code, eventId, accessCodeExpires: { gt: new Date() } },
        });
        let teacherIndex = 1;

        if (!teacher) {
            teacher = await prisma.teacher.findFirst({
                where: { accessCode2: code, eventId, accessCode2Expires: { gt: new Date() } },
            });
            teacherIndex = 2;
        }

        if (!teacher) {
            return res.status(401).json({ error: 'Invalid or expired access code' });
        }

        // Fill any missing time slots for this teacher across all event days.
        const eventForSlots = await prisma.event.findUnique({
            where: { id: eventId },
            include: { days: { orderBy: { date: 'asc' } } },
        });
        if (eventForSlots) {
            const days = eventForSlots.days.length > 0
                ? eventForSlots.days
                : [{ date: eventForSlots.date, startTime: eventForSlots.startTime, endTime: eventForSlots.endTime }];

            const existingKeys = new Set(
                (await prisma.slot.findMany({
                    where: { teacherId: teacher.id, eventId },
                    select: { date: true, time: true },
                })).map((s) => `${s.date}|${s.time}`)
            );

            const slotsToCreate = days.flatMap((day) =>
                generateSlotTimes(
                    day.startTime,
                    day.endTime,
                    eventForSlots.sessionLength,
                    eventForSlots.breakLength,
                    day.date,
                    teacher.id,
                    eventId,
                ).filter((s) => !existingKeys.has(`${s.date}|${s.time}`))
            );

            if (slotsToCreate.length > 0) {
                await prisma.slot.createMany({ data: slotsToCreate });
            } else if (existingKeys.size === 0) {
                // No slots anywhere and config generates none — invalid config
                return res.status(409).json({ error: 'Event time configuration is invalid — end time must be after start time. Please contact the school administrator.' });
            }
        }

        const token = jwt.sign(
            { type: 'teacher_access', teacherId: teacher.id, eventId, teacherIndex },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({ teacher, token, teacherIndex });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Fetch all slots for a teacher and broadcast each to SSE listeners for that event.
async function broadcastTeacherSlots(teacherId, eventId) {
    const slots = await prisma.slot.findMany({ where: { teacherId, eventId } });
    for (const slot of slots) broadcastSlotUpdate(eventId, slot);
}

// POST /api/public/teachers/save
// Teacher session JWT required — broadcasts all current slot states to other listeners (SSE).
// Called when teacher clicks SPEICHERN without publishing.
export const saveTeacherSlots = async (req, res) => {
    try {
        const auth = req.headers.authorization;
        if (!auth?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Teacher access token required' });
        }

        let payload;
        try {
            payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
            if (payload.type !== 'teacher_access') throw new Error('Invalid token type');
        } catch {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Promote all null presence slots for this teacher to "present" (true) — same as publish
        const isT1 = (payload.teacherIndex ?? 1) === 1;
        const presenceField = isT1 ? 'teacher1Present' : 'teacher2Present';
        await prisma.slot.updateMany({
            where: { teacherId: payload.teacherId, eventId: payload.eventId, [presenceField]: null },
            data: { [presenceField]: true },
        });

        await broadcastTeacherSlots(payload.teacherId, payload.eventId);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /api/public/teachers/publish
// Teacher session JWT required — marks teacher's slots as confirmed (ready for parents to book).
// For paired teachers, bookingStatus only becomes 'slots_confirmed' when BOTH have published.
export const publishTeacherSlots = async (req, res) => {
    try {
        const auth = req.headers.authorization;
        if (!auth?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Teacher access token required' });
        }

        let payload;
        try {
            payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
            if (payload.type !== 'teacher_access') throw new Error('Invalid token type');
        } catch {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        const teacherIndex = payload.teacherIndex ?? 1;
        const isT1 = teacherIndex === 1;

        // Load current teacher state
        const current = await prisma.teacher.findUnique({ where: { id: payload.teacherId } });
        if (!current) return res.status(404).json({ error: 'Teacher not found' });

        const hasPair = !!(current.firstName2 && current.surname2);

        // Promote all null presence slots for this teacher to "present" (true)
        const presenceField = isT1 ? 'teacher1Present' : 'teacher2Present';
        await prisma.slot.updateMany({
            where: {
                teacherId: payload.teacherId,
                eventId: payload.eventId,
                [presenceField]: null,
            },
            data: { [presenceField]: true },
        });

        // Mark this teacher as confirmed and determine new bookingStatus
        const confirmedField = isT1 ? 'teacher1Confirmed' : 'teacher2Confirmed';
        const otherAlreadyConfirmed = isT1 ? current.teacher2Confirmed : current.teacher1Confirmed;
        const newBookingStatus = (!hasPair || otherAlreadyConfirmed) ? 'slots_confirmed' : current.bookingStatus;

        const teacher = await prisma.teacher.update({
            where: { id: payload.teacherId },
            data: {
                [confirmedField]: true,
                bookingStatus: newBookingStatus,
            },
        });

        await broadcastTeacherSlots(payload.teacherId, payload.eventId);
        res.json({ ok: true, teacher });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/public/events/:eventId/slots/available
// No auth — returns all slots for the parent booking page (available, booked, disabled)
export const getParentSlots = async (req, res) => {
    try {
        const slots = await prisma.slot.findMany({
            where: { eventId: req.params.eventId },
            include: {
                teacher: { select: { id: true, salutation: true, titel: true, firstName: true, surname: true, salutation2: true, firstName2: true, surname2: true, klasse: true, roomNo: true } },
            },
            orderBy: [{ date: 'asc' }, { time: 'asc' }],
        });

        res.json(slots);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/public/events/:eventId/slots
// Teacher session JWT required — returns slots for the authenticated teacher
export const getPublicEventSlots = async (req, res) => {
    try {
        const auth = req.headers.authorization;
        if (!auth?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Teacher access token required' });
        }

        let payload;
        try {
            payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
            if (payload.type !== 'teacher_access') throw new Error('Invalid token type');
        } catch {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Fill any missing time slots for this teacher across all event days.
        // Checks per (date, time) so booked slots are preserved and only the
        // truly absent times are inserted (handles partial days too).
        const event = await prisma.event.findUnique({
            where: { id: req.params.eventId },
            include: { days: { orderBy: { date: 'asc' } } },
        });
        if (event) {
            const days = event.days.length > 0
                ? event.days
                : [{ date: event.date, startTime: event.startTime, endTime: event.endTime }];

            const existingKeys = new Set(
                (await prisma.slot.findMany({
                    where: { teacherId: payload.teacherId, eventId: req.params.eventId },
                    select: { date: true, time: true },
                })).map((s) => `${s.date}|${s.time}`)
            );

            const slotsToCreate = days.flatMap((day) =>
                generateSlotTimes(
                    day.startTime, day.endTime,
                    event.sessionLength, event.breakLength,
                    day.date, payload.teacherId, req.params.eventId,
                ).filter((s) => !existingKeys.has(`${s.date}|${s.time}`))
            );

            if (slotsToCreate.length > 0) {
                await prisma.slot.createMany({ data: slotsToCreate });
            }
        }

        const slots = await prisma.slot.findMany({
            where: { teacherId: payload.teacherId, eventId: req.params.eventId },
            orderBy: [{ date: 'asc' }, { time: 'asc' }],
        });

        res.json(slots);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PATCH /api/public/slots/:id
// Teacher session JWT required — toggles slot status OR updates teacher presence flags.
// { teacher1Present: bool } / { teacher2Present: bool } → update presence
// empty body → toggle available ↔ disabled
export const toggleSlotForTeacher = async (req, res) => {
    try {
        const auth = req.headers.authorization;
        if (!auth?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Teacher access token required' });
        }

        let payload;
        try {
            payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
            if (payload.type !== 'teacher_access') throw new Error('Invalid token type');
        } catch {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        const slot = await prisma.slot.findUnique({ where: { id: req.params.id } });
        if (!slot) return res.status(404).json({ error: 'Slot not found' });
        if (slot.teacherId !== payload.teacherId) return res.status(403).json({ error: 'Forbidden' });
        if (slot.status === 'booked') return res.status(409).json({ error: 'Cannot modify a booked slot' });

        const { teacher1Present, teacher2Present } = req.body ?? {};

        // Presence update path
        if (teacher1Present !== undefined || teacher2Present !== undefined) {
            const updateData = {};
            if (teacher1Present !== undefined) updateData.teacher1Present = teacher1Present;
            if (teacher2Present !== undefined) updateData.teacher2Present = teacher2Present;

            const t1 = teacher1Present !== undefined ? teacher1Present : slot.teacher1Present;
            const t2 = teacher2Present !== undefined ? teacher2Present : slot.teacher2Present;

            // Auto-block only when BOTH explicitly absent (false); null = not responded = still possible
            if (t1 === false && t2 === false && slot.status === 'available') {
                updateData.status = 'disabled';
            }
            // Auto-re-open if auto-blocked (both were false) and one changes away from false
            else if ((t1 !== false || t2 !== false) && slot.status === 'disabled'
                && slot.teacher1Present === false && slot.teacher2Present === false) {
                updateData.status = 'available';
            }

            const updated = await prisma.slot.update({ where: { id: req.params.id }, data: updateData });
            return res.json(updated);
        }

        // Empty body — for paired teachers, cycle own presence; for single teachers, toggle slot status
        const teacherRecord = await prisma.teacher.findUnique({
            where: { id: payload.teacherId },
            select: { firstName2: true, surname2: true },
        });
        const hasPair = !!(teacherRecord?.firstName2 && teacherRecord?.surname2);

        if (hasPair) {
            // 2-state toggle: null/true (available) → false (blocked) → null (available)
            const field = payload.teacherIndex === 2 ? 'teacher2Present' : 'teacher1Present';
            const currentVal = slot[field];
            const newVal = currentVal === false ? null : false;

            const t1 = field === 'teacher1Present' ? newVal : slot.teacher1Present;
            const t2 = field === 'teacher2Present' ? newVal : slot.teacher2Present;

            const updateData = { [field]: newVal };

            // Auto-block when BOTH absent
            if (t1 === false && t2 === false && slot.status === 'available') {
                updateData.status = 'disabled';
            }
            // Auto-re-open if auto-blocked (both were false before) and one changes
            else if ((t1 !== false || t2 !== false) && slot.status === 'disabled'
                && slot.teacher1Present === false && slot.teacher2Present === false) {
                updateData.status = 'available';
            }

            const updated = await prisma.slot.update({ where: { id: req.params.id }, data: updateData });
            return res.json(updated);
        }

        // Single teacher: hard toggle slot status
        const newStatus = slot.status === 'available' ? 'disabled' : 'available';
        const updated = await prisma.slot.update({
            where: { id: req.params.id },
            data: { status: newStatus },
        });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
