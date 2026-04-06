import prisma from '../config/prisma.js';

// ── GET /api/events/:eventId/slots ───────────────────────────────────────────
// Public — parents can view slots without auth (for booking page)
export const getSlots = async (req, res) => {
    try {
        const slots = await prisma.slot.findMany({
            where: { eventId: req.params.eventId },
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
            teacher: s.teacher,
            bookingId: s.bookings[0]?.id ?? null,
        }));

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── GET /api/slots?teacherId=X ───────────────────────────────────────────────
export const getSlotsByTeacher = async (req, res) => {
    try {
        const { teacherId } = req.query;
        if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

        const slots = await prisma.slot.findMany({
            where: { teacherId },
            include: {
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
            bookingId: s.bookings[0]?.id ?? null,
        }));

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── POST /api/events/:eventId/slots ─────────────────────────────────────────
export const createSlots = async (req, res) => {
    try {
        const { eventId } = req.params;
        const input = Array.isArray(req.body) ? req.body : [req.body];

        for (const s of input) {
            if (!s.teacherId || !s.time || !s.date) {
                return res.status(400).json({ error: 'Each slot requires teacherId, time, date' });
            }
        }

        await prisma.slot.createMany({
            data: input.map((s) => ({ eventId, teacherId: s.teacherId, time: s.time, date: s.date })),
        });

        const slots = await prisma.slot.findMany({
            where: { eventId },
            orderBy: [{ date: 'asc' }, { time: 'asc' }],
        });

        res.status(201).json(slots);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── PATCH /api/slots/:id ─────────────────────────────────────────────────────
// { teacher1Present: bool } / { teacher2Present: bool } → update presence (informational only, does not affect slot status)
// empty body / { status } / { isActive } → toggle slot status
export const updateSlot = async (req, res) => {
    try {
        const slot = await prisma.slot.findUnique({ where: { id: req.params.id } });
        if (!slot) return res.status(404).json({ error: 'Slot not found' });

        if (slot.status === 'booked') {
            return res.status(400).json({ error: 'Cannot modify a booked slot' });
        }

        const { teacher1Present, teacher2Present } = req.body;

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

        // Status toggle path — support { status }, legacy { isActive }, or empty body
        let newStatus = req.body.status;
        if (newStatus === undefined && req.body.isActive !== undefined) {
            newStatus = req.body.isActive ? 'available' : 'disabled';
        }
        if (newStatus === undefined) {
            newStatus = slot.status === 'available' ? 'disabled' : 'available';
        }

        const updated = await prisma.slot.update({
            where: { id: req.params.id },
            data: { status: newStatus },
        });

        const updated = await prisma.slot.update({ where: { id: req.params.id }, data });
        res.json(updated);
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Slot not found' });
        res.status(500).json({ error: err.message });
    }
};

// ── DELETE /api/slots/:id ────────────────────────────────────────────────────
export const deleteSlot = async (req, res) => {
    try {
        const slot = await prisma.slot.findUnique({ where: { id: req.params.id } });
        if (!slot) return res.status(404).json({ error: 'Slot not found' });

        await prisma.slot.delete({ where: { id: req.params.id } });
        res.status(204).end();
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Slot not found' });
        res.status(500).json({ error: err.message });
    }
};

// GET /api/slots?teacherId= — flat route for teacher slot view
export const getSlotsByTeacher = async (req, res) => {
    try {
        const { teacherId } = req.query;
        if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

        const slots = await prisma.slot.findMany({
            where: { teacherId, isActive: true },
            orderBy: [{ date: 'asc' }, { time: 'asc' }],
        });

        res.json(slots);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
