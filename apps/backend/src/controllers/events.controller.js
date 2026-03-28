import prisma from '../config/prisma.js';

const VALID_TYPES = ['slot_booking', 'rsvp_signup'];

// GET /api/events?schoolId=
export const getEvents = async (req, res) => {
    try {
        const { schoolId } = req.query;

        const where = { isActive: true };

        if (req.user.role === 'platform_admin') {
            if (schoolId) where.schoolId = schoolId;
        } else {
            where.schoolId = req.user.schoolId;
        }

        const events = await prisma.event.findMany({
            where,
            include: {
                _count: { select: { bookings: true, slots: true, teachers: true } },
            },
            orderBy: { date: 'asc' },
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
                teachers: { where: { isActive: true }, orderBy: { surname: 'asc' } },
                slots: { where: { isActive: true }, orderBy: { time: 'asc' } },
                _count: { select: { bookings: true } },
            },
        });

        if (!event) return res.status(404).json({ error: 'Event not found' });

        if (!req.user.role === 'platform_admin' && event.schoolId !== req.user.schoolId) {
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
        const {
            name, description, type,
            date, startTime, endTime,
            sessionLength, breakLength,
            location, maxCapacity,
        } = req.body;

        const schoolId = req.user.role === 'platform_admin' ? req.body.schoolId : req.user.schoolId;

        if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
        if (!name || !date || !startTime || !endTime) {
            return res.status(400).json({ error: 'name, date, startTime, endTime are required' });
        }
        if (type && !VALID_TYPES.includes(type)) {
            return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
        }

        const event = await prisma.event.create({
            data: {
                schoolId,
                name,
                description,
                type: type ?? 'slot_booking',
                date,
                startTime,
                endTime,
                sessionLength: sessionLength ?? 10,
                breakLength: breakLength ?? 5,
                location,
                maxCapacity,
                createdBy: req.user?.id,
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

        if (!req.user.role === 'platform_admin' && existing.schoolId !== req.user.schoolId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const fields = [
            'name', 'description', 'type', 'date', 'startTime', 'endTime',
            'sessionLength', 'breakLength', 'location', 'maxCapacity',
            'bookingActive', 'status', 'isActive',
        ];
        const data = {};
        for (const f of fields) {
            if (req.body[f] !== undefined) data[f] = req.body[f];
        }

        const event = await prisma.event.update({ where: { id: req.params.id }, data });
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

        if (!req.user.role === 'platform_admin' && existing.schoolId !== req.user.schoolId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        await prisma.event.update({ where: { id: req.params.id }, data: { isActive: false } });
        res.json({ message: 'Event deactivated' });
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Event not found' });
        res.status(500).json({ error: err.message });
    }
};

// POST /api/events/:id/duplicate
export const duplicateEvent = async (req, res) => {
    try {
        const source = await prisma.event.findUnique({
            where: { id: req.params.id },
            include: { teachers: true, slots: true },
        });
        if (!source) return res.status(404).json({ error: 'Event not found' });

        if (!req.user.role === 'platform_admin' && source.schoolId !== req.user.schoolId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const { id, qrToken, qrCodeUrl, createdAt, ...rest } = source;

        const newEvent = await prisma.event.create({
            data: {
                ...rest,
                name: `${source.name} (Copy)`,
                status: 'draft',
                bookingActive: false,
                teachers: {
                    create: source.teachers.map(({ id: _id, eventId: _eid, createdAt: _ca, ...t }) => t),
                },
                slots: {
                    create: source.slots.map(({ id: _id, eventId: _eid, currentBookings: _cb, ...s }) => ({
                        ...s,
                        currentBookings: 0,
                    })),
                },
            },
        });

        res.status(201).json(newEvent);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /api/events/:id/publish
export const publishEvent = async (req, res) => {
    try {
        const event = await prisma.event.update({
            where: { id: req.params.id },
            data: { status: 'published' },
        });
        res.json(event);
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Event not found' });
        res.status(500).json({ error: err.message });
    }
};

// POST /api/events/:id/unpublish
export const unpublishEvent = async (req, res) => {
    try {
        const event = await prisma.event.update({
            where: { id: req.params.id },
            data: { status: 'draft', bookingActive: false },
        });
        res.json(event);
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Event not found' });
        res.status(500).json({ error: err.message });
    }
};
