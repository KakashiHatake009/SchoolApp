import prisma from '../config/prisma.js';
import QRCode from 'qrcode';

// ── GET /api/events ──────────────────────────────────────────────────────────
export const getEvents = async (req, res) => {
    try {
        const { schoolId } = req.query;
        const where = req.user.isPlatformAdmin
            ? (schoolId ? { schoolId } : {})
            : { schoolId: req.user.schoolId };

        const events = await prisma.event.findMany({
            where,
            include: {
                days: { orderBy: { date: 'asc' } },
                _count: { select: { bookings: true, teachers: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json(events);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── GET /api/events/:id ──────────────────────────────────────────────────────
export const getEventById = async (req, res) => {
    try {
        const event = await prisma.event.findUnique({
            where: { id: req.params.id },
            include: {
                days: { orderBy: { date: 'asc' } },
                teachers: { orderBy: { surname: 'asc' } },
                _count: { select: { bookings: true, teachers: true } },
            },
        });

        if (!event) return res.status(404).json({ error: 'Event not found' });

        if (!req.user.isPlatformAdmin && event.schoolId !== req.user.schoolId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        res.json(event);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── POST /api/events ─────────────────────────────────────────────────────────
export const createEvent = async (req, res) => {
    try {
        const { name, description, type, date, startTime, endTime,
                sessionLength, breakLength, link, days } = req.body;
        const schoolId = req.user.isPlatformAdmin ? req.body.schoolId : req.user.schoolId;

        if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
        if (!name) return res.status(400).json({ error: 'name is required' });

        // Resolve primary date/time: use first day if days array provided, else use direct fields
        const primaryDate = (days && days.length > 0) ? days[0].date : (date ?? '');
        const primaryStart = (days && days.length > 0) ? days[0].startTime : (startTime ?? '');
        const primaryEnd = (days && days.length > 0) ? days[0].endTime : (endTime ?? '');

        if (!primaryDate || !primaryStart || !primaryEnd) {
            return res.status(400).json({ error: 'At least one day with date, startTime, endTime is required' });
        }

        const event = await prisma.event.create({
            data: {
                schoolId, name, description,
                type: type ?? 'slot_booking',
                date: primaryDate,
                startTime: primaryStart,
                endTime: primaryEnd,
                sessionLength: sessionLength ?? 15,
                breakLength: breakLength ?? 5,
                link,
            },
        });

        // Create EventDay records
        const daysToCreate = days && days.length > 0
            ? days
            : [{ date: primaryDate, startTime: primaryStart, endTime: primaryEnd }];

        await prisma.eventDay.createMany({
            data: daysToCreate.map((d) => ({
                eventId: event.id,
                date: d.date,
                startTime: d.startTime,
                endTime: d.endTime,
            })),
        });

        const eventWithDays = await prisma.event.findUnique({
            where: { id: event.id },
            include: { days: { orderBy: { date: 'asc' } } },
        });

        res.status(201).json(eventWithDays);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── PATCH /api/events/:id ────────────────────────────────────────────────────
export const updateEvent = async (req, res) => {
    try {
        const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
        if (!existing) return res.status(404).json({ error: 'Event not found' });

        if (!req.user.isPlatformAdmin && existing.schoolId !== req.user.schoolId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // Strip read-only and special fields from body
        // eslint-disable-next-line no-unused-vars
        const { id, schoolId, qrToken, qrCode, createdAt, duplicatedFrom, days, ...updateData } = req.body;

        // If days provided, keep event.date/startTime/endTime in sync with first day
        if (days && days.length > 0) {
            updateData.date = days[0].date;
            updateData.startTime = days[0].startTime;
            updateData.endTime = days[0].endTime;
        }

        const event = await prisma.event.update({
            where: { id: req.params.id },
            data: updateData,
        });

        // Update EventDay records if days array provided
        if (days !== undefined) {
            await prisma.eventDay.deleteMany({ where: { eventId: req.params.id } });
            if (days.length > 0) {
                await prisma.eventDay.createMany({
                    data: days.map((d) => ({
                        eventId: req.params.id,
                        date: d.date,
                        startTime: d.startTime,
                        endTime: d.endTime,
                    })),
                });
            }
            // Clear non-booked slots so they regenerate with the new time config on next teacher login
            await prisma.slot.deleteMany({
                where: { eventId: req.params.id, status: { in: ['available', 'disabled'] } },
            });
        }

        const eventWithDays = await prisma.event.findUnique({
            where: { id: req.params.id },
            include: { days: { orderBy: { date: 'asc' } } },
        });

        res.json(eventWithDays);
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Event not found' });
        res.status(500).json({ error: err.message });
    }
};

// ── DELETE /api/events/:id ───────────────────────────────────────────────────
export const deleteEvent = async (req, res) => {
    try {
        const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
        if (!existing) return res.status(404).json({ error: 'Event not found' });

        if (!req.user.isPlatformAdmin && existing.schoolId !== req.user.schoolId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // Delete in dependency order: Bookings → Slots → Teachers → Event (EventDays cascade)
        await prisma.$transaction([
            prisma.booking.deleteMany({ where: { eventId: req.params.id } }),
            prisma.slot.deleteMany({ where: { eventId: req.params.id } }),
            prisma.teacher.deleteMany({ where: { eventId: req.params.id } }),
            prisma.event.delete({ where: { id: req.params.id } }),
        ]);

        res.status(204).end();
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Event not found' });
        res.status(500).json({ error: err.message });
    }
};

// ── GET /api/events/:id/qr ────────────────────────────────────────────────────
export const getEventQr = async (req, res) => {
    try {
        const event = await prisma.event.findUnique({ where: { id: req.params.id } });
        if (!event) return res.status(404).json({ error: 'Event not found' });
        if (!req.user.isPlatformAdmin && event.schoolId !== req.user.schoolId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const origin = req.query.origin || 'http://localhost:3001';
        const url = `${origin}/book/${event.id}`;

        const png = await QRCode.toBuffer(url, { width: 300, margin: 2 });
        res.set('Content-Type', 'image/png');
        res.send(png);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── Slot generation helper ───────────────────────────────────────────────────
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

// ── POST /api/events/:id/publish ─────────────────────────────────────────────
export const publishEvent = async (req, res) => {
    try {
        const existing = await prisma.event.findUnique({
            where: { id: req.params.id },
            include: { days: { orderBy: { date: 'asc' } }, teachers: true },
        });
        if (!existing) return res.status(404).json({ error: 'Event not found' });
        if (!req.user.isPlatformAdmin && existing.schoolId !== req.user.schoolId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // Auto-generate slots for teachers that haven't confirmed yet
        const days = existing.days.length > 0
            ? existing.days
            : [{ date: existing.date, startTime: existing.startTime, endTime: existing.endTime }];

        for (const teacher of existing.teachers) {
            const existingSlots = await prisma.slot.findMany({
                where: { teacherId: teacher.id, eventId: existing.id },
                select: { date: true, time: true },
            });
            const existingKeys = new Set(existingSlots.map((s) => `${s.date}|${s.time}`));

            const slotsToCreate = days.flatMap((day) =>
                generateSlotTimes(
                    day.startTime, day.endTime,
                    existing.sessionLength, existing.breakLength,
                    day.date, teacher.id, existing.id,
                ).filter((s) => !existingKeys.has(`${s.date}|${s.time}`))
            );

            if (slotsToCreate.length > 0) {
                await prisma.slot.createMany({ data: slotsToCreate });
            }
        }

        const event = await prisma.event.update({
            where: { id: req.params.id },
            data: { status: 'published', bookingActive: true },
        });
        res.json(event);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── POST /api/events/:id/unpublish ───────────────────────────────────────────
export const unpublishEvent = async (req, res) => {
    try {
        const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
        if (!existing) return res.status(404).json({ error: 'Event not found' });
        if (!req.user.isPlatformAdmin && existing.schoolId !== req.user.schoolId) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const event = await prisma.event.update({
            where: { id: req.params.id },
            data: { status: 'draft', bookingActive: false },
        });
        res.json(event);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── POST /api/events/:id/duplicate ───────────────────────────────────────────
export const duplicateEvent = async (req, res) => {
    try {
        const original = await prisma.event.findUnique({
            where: { id: req.params.id },
            include: { days: true },
        });
        if (!original) return res.status(404).json({ error: 'Event not found' });
        if (!req.user.isPlatformAdmin && original.schoolId !== req.user.schoolId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // eslint-disable-next-line no-unused-vars
        const { id, qrToken, qrCode, createdAt, days, ...rest } = original;
        const newName = req.body.name || `${original.name} (Copy)`;

        const copy = await prisma.event.create({
            data: { ...rest, name: newName, status: 'draft', bookingActive: false, duplicatedFrom: id },
        });

        // Copy EventDay records
        if (days.length > 0) {
            await prisma.eventDay.createMany({
                data: days.map((d) => ({
                    eventId: copy.id,
                    date: d.date,
                    startTime: d.startTime,
                    endTime: d.endTime,
                })),
            });
        }

        const copyWithDays = await prisma.event.findUnique({
            where: { id: copy.id },
            include: { days: { orderBy: { date: 'asc' } } },
        });

        res.status(201).json(copyWithDays);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
