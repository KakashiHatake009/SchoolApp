import prisma from '../config/prisma.js';

// GET /api/public/events/by-qr/:qrToken
// No auth — used by parent booking page to look up event from scanned QR code
export const getPublicEvent = async (req, res) => {
    try {
        const event = await prisma.event.findUnique({
            where: { qrToken: req.params.qrToken, isActive: true },
            select: {
                id: true,
                title: true,
                description: true,
                eventType: true,
                startDate: true,
                endDate: true,
                location: true,
                maxCapacity: true,
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
// No auth — returns slots with availability info for the parent booking page
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
                id: true,
                startTime: true,
                endTime: true,
                maxBookings: true,
                currentBookings: true,
                teacher: { select: { name: true } },
            },
            orderBy: { startTime: 'asc' },
        });

        // Add a computed `available` field — client can show "FULL" for booked-out slots
        const withAvailability = slots.map((s) => ({
            ...s,
            available: s.currentBookings < s.maxBookings,
        }));

        res.json(withAvailability);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
