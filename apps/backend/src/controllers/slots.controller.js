import prisma from '../config/prisma.js';

// ── helpers ─────────────────────────────────────────────────────────────────

async function getEventOrFail(eventId, user) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return { error: 'Event not found', status: 404 };
    if (!user.isPlatformAdmin && event.schoolId !== user.schoolId) {
        return { error: 'Forbidden', status: 403 };
    }
    return { event };
}

// ── GET /api/events/:eventId/slots ───────────────────────────────────────────

export const getSlots = async (req, res) => {
    try {
        const { event, error, status } = await getEventOrFail(req.params.eventId, req.user);
        if (error) return res.status(status).json({ error });

        const slots = await prisma.slot.findMany({
            where: { eventId: event.id, isActive: true },
            include: { teacher: { select: { id: true, name: true } } },
            orderBy: { startTime: 'asc' },
        });

        res.json(slots);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── POST /api/events/:eventId/slots ─────────────────────────────────────────
// Accepts either a single slot object or an array for bulk creation

export const createSlots = async (req, res) => {
    try {
        const { event, error, status } = await getEventOrFail(req.params.eventId, req.user);
        if (error) return res.status(status).json({ error });

        const input = Array.isArray(req.body) ? req.body : [req.body];

        for (const s of input) {
            if (!s.startTime || !s.endTime) {
                return res.status(400).json({ error: 'Each slot requires startTime and endTime' });
            }
        }

        const data = input.map((s) => ({
            eventId: event.id,
            teacherId: s.teacherId ?? null,
            startTime: new Date(s.startTime),
            endTime: new Date(s.endTime),
            maxBookings: s.maxBookings ?? 1,
        }));

        await prisma.slot.createMany({ data });

        // Return newly created slots
        const slots = await prisma.slot.findMany({
            where: { eventId: event.id, isActive: true },
            orderBy: { startTime: 'asc' },
        });

        res.status(201).json(slots);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── PATCH /api/slots/:id ─────────────────────────────────────────────────────

export const updateSlot = async (req, res) => {
    try {
        const slot = await prisma.slot.findUnique({
            where: { id: req.params.id },
            include: { event: { select: { schoolId: true } } },
        });
        if (!slot) return res.status(404).json({ error: 'Slot not found' });

        if (!req.user.isPlatformAdmin && slot.event.schoolId !== req.user.schoolId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const { teacherId, startTime, endTime, maxBookings, isActive } = req.body;

        const updated = await prisma.slot.update({
            where: { id: req.params.id },
            data: {
                ...(teacherId !== undefined && { teacherId }),
                ...(startTime && { startTime: new Date(startTime) }),
                ...(endTime && { endTime: new Date(endTime) }),
                ...(maxBookings !== undefined && { maxBookings }),
                ...(isActive !== undefined && { isActive }),
            },
        });

        res.json(updated);
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Slot not found' });
        res.status(500).json({ error: err.message });
    }
};

// ── DELETE /api/slots/:id — soft delete ─────────────────────────────────────

export const deleteSlot = async (req, res) => {
    try {
        const slot = await prisma.slot.findUnique({
            where: { id: req.params.id },
            include: { event: { select: { schoolId: true } } },
        });
        if (!slot) return res.status(404).json({ error: 'Slot not found' });

        if (!req.user.isPlatformAdmin && slot.event.schoolId !== req.user.schoolId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        await prisma.slot.update({
            where: { id: req.params.id },
            data: { isActive: false },
        });

        res.json({ message: 'Slot deactivated' });
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Slot not found' });
        res.status(500).json({ error: err.message });
    }
};
