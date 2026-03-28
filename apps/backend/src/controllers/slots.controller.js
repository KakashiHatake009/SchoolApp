import prisma from '../config/prisma.js';

async function getEventOrFail(eventId, user) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return { error: 'Event not found', status: 404 };
    if (!user.role === 'platform_admin' && event.schoolId !== user.schoolId) {
        return { error: 'Forbidden', status: 403 };
    }
    return { event };
}

// GET /api/events/:eventId/slots?teacherId=
export const getSlots = async (req, res) => {
    try {
        const { event, error, status } = await getEventOrFail(req.params.eventId, req.user);
        if (error) return res.status(status).json({ error });

        const where = { eventId: event.id, isActive: true };
        if (req.query.teacherId) where.teacherId = req.query.teacherId;

        const slots = await prisma.slot.findMany({
            where,
            include: { teacher: { select: { id: true, salutation: true, firstName: true, surname: true } } },
            orderBy: [{ date: 'asc' }, { time: 'asc' }],
        });

        res.json(slots);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /api/events/:eventId/slots — bulk create
export const createSlots = async (req, res) => {
    try {
        const { event, error, status } = await getEventOrFail(req.params.eventId, req.user);
        if (error) return res.status(status).json({ error });

        const input = Array.isArray(req.body) ? req.body : [req.body];

        for (const s of input) {
            if (!s.date || !s.time) {
                return res.status(400).json({ error: 'Each slot requires date and time' });
            }
        }

        const data = input.map((s) => ({
            eventId: event.id,
            teacherId: s.teacherId ?? null,
            date: s.date,
            time: s.time,
            maxBookings: s.maxBookings ?? 1,
        }));

        await prisma.slot.createMany({ data });

        const slots = await prisma.slot.findMany({
            where: { eventId: event.id, isActive: true },
            orderBy: [{ date: 'asc' }, { time: 'asc' }],
        });

        res.status(201).json(slots);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PATCH /api/slots/:id
export const updateSlot = async (req, res) => {
    try {
        const slot = await prisma.slot.findUnique({
            where: { id: req.params.id },
            include: { event: { select: { schoolId: true } } },
        });
        if (!slot) return res.status(404).json({ error: 'Slot not found' });

        if (!req.user.role === 'platform_admin' && slot.event.schoolId !== req.user.schoolId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const fields = ['teacherId', 'date', 'time', 'maxBookings', 'isActive'];
        const data = {};
        for (const f of fields) {
            if (req.body[f] !== undefined) data[f] = req.body[f];
        }

        const updated = await prisma.slot.update({ where: { id: req.params.id }, data });
        res.json(updated);
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Slot not found' });
        res.status(500).json({ error: err.message });
    }
};

// DELETE /api/slots/:id — soft delete
export const deleteSlot = async (req, res) => {
    try {
        const slot = await prisma.slot.findUnique({
            where: { id: req.params.id },
            include: { event: { select: { schoolId: true } } },
        });
        if (!slot) return res.status(404).json({ error: 'Slot not found' });

        if (!req.user.role === 'platform_admin' && slot.event.schoolId !== req.user.schoolId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        await prisma.slot.update({ where: { id: req.params.id }, data: { isActive: false } });
        res.json({ message: 'Slot deactivated' });
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
