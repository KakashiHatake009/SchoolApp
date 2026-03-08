import prisma from '../config/prisma.js';

const VALID_TYPES = ['SLOT_BOOKING', 'RSVP_SIGNUP'];

// GET /api/events
export const getEvents = async (req, res) => {
    try {
        const where = req.user.isPlatformAdmin
            ? {}
            : { schoolId: req.user.schoolId, isActive: true };

        const events = await prisma.event.findMany({
            where,
            include: { _count: { select: { bookings: true, slots: true } } },
            orderBy: { startDate: 'asc' },
        });

        res.json(events);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/events/:id
export const getEventById = async (req, res) => {
    try {
        const event = await prisma.event.findUnique({
            where: { id: req.params.id },
            include: {
                slots: {
                    where: { isActive: true },
                    include: { teacher: { select: { id: true, name: true } } },
                    orderBy: { startTime: 'asc' },
                },
                _count: { select: { bookings: true } },
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

// POST /api/events
export const createEvent = async (req, res) => {
    try {
        const { title, description, eventType, startDate, endDate, location, maxCapacity } = req.body;
        const schoolId = req.user.isPlatformAdmin ? req.body.schoolId : req.user.schoolId;

        if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
        if (!title || !eventType || !startDate || !endDate) {
            return res.status(400).json({ error: 'title, eventType, startDate, endDate are required' });
        }
        if (!VALID_TYPES.includes(eventType)) {
            return res.status(400).json({ error: `eventType must be one of: ${VALID_TYPES.join(', ')}` });
        }

        const event = await prisma.event.create({
            data: {
                schoolId,
                title,
                description,
                eventType,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                location,
                maxCapacity,
                createdBy: req.user.id,
            },
        });

        res.status(201).json(event);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PATCH /api/events/:id
export const updateEvent = async (req, res) => {
    try {
        const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
        if (!existing) return res.status(404).json({ error: 'Event not found' });

        if (!req.user.isPlatformAdmin && existing.schoolId !== req.user.schoolId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const { title, description, startDate, endDate, location, maxCapacity, isActive } = req.body;

        const event = await prisma.event.update({
            where: { id: req.params.id },
            data: {
                ...(title && { title }),
                ...(description !== undefined && { description }),
                ...(startDate && { startDate: new Date(startDate) }),
                ...(endDate && { endDate: new Date(endDate) }),
                ...(location !== undefined && { location }),
                ...(maxCapacity !== undefined && { maxCapacity }),
                ...(isActive !== undefined && { isActive }),
            },
        });

        res.json(event);
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Event not found' });
        res.status(500).json({ error: err.message });
    }
};

// DELETE /api/events/:id — soft delete
export const deleteEvent = async (req, res) => {
    try {
        const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
        if (!existing) return res.status(404).json({ error: 'Event not found' });

        if (!req.user.isPlatformAdmin && existing.schoolId !== req.user.schoolId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        await prisma.event.update({
            where: { id: req.params.id },
            data: { isActive: false },
        });

        res.json({ message: 'Event deactivated' });
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Event not found' });
        res.status(500).json({ error: err.message });
    }
};
