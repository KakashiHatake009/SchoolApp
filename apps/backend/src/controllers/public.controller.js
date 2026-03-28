import prisma from '../config/prisma.js';

// GET /api/public/events/by-qr/:qrToken
export const getPublicEvent = async (req, res) => {
    try {
        const event = await prisma.event.findUnique({
            where: { qrToken: req.params.qrToken, isActive: true, bookingActive: true },
            select: {
                id: true, name: true, description: true, type: true,
                date: true, startTime: true, endTime: true,
                sessionLength: true, breakLength: true,
                location: true, maxCapacity: true,
                _count: { select: { bookings: true } },
            },
        });

        if (!event) return res.status(404).json({ error: 'Event not found or booking not active' });
        res.json(event);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/public/events/by-qr/:qrToken/slots
export const getPublicSlots = async (req, res) => {
    try {
        const event = await prisma.event.findUnique({
            where: { qrToken: req.params.qrToken, isActive: true },
            select: { id: true },
        });

        if (!event) return res.status(404).json({ error: 'Event not found' });

        const slots = await prisma.slot.findMany({
            where: { eventId: event.id, isActive: true },
            select: {
                id: true, date: true, time: true,
                maxBookings: true, currentBookings: true,
                teacher: {
                    select: { id: true, salutation: true, firstName: true, surname: true, roomNo: true },
                },
            },
            orderBy: [{ date: 'asc' }, { time: 'asc' }],
        });

        const withAvailability = slots.map((s) => ({
            ...s,
            status: s.currentBookings >= s.maxBookings ? 'booked' : 'available',
        }));

        res.json(withAvailability);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/public/events/by-qr/:qrToken/teachers
export const getPublicTeachers = async (req, res) => {
    try {
        const event = await prisma.event.findUnique({
            where: { qrToken: req.params.qrToken, isActive: true },
            select: { id: true },
        });

        if (!event) return res.status(404).json({ error: 'Event not found' });

        const teachers = await prisma.teacher.findMany({
            where: { eventId: event.id, isActive: true },
            select: { id: true, salutation: true, firstName: true, surname: true, roomNo: true },
            orderBy: { surname: 'asc' },
        });

        res.json(teachers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
