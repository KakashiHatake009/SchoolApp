import QRCode from 'qrcode';
import prisma from '../config/prisma.js';

// GET /api/events/:id/qr
// Returns a PNG QR code image encoding the parent booking page URL
// The parent scans this → goes to {APP_BASE_URL}/book/{qrToken}

export const getEventQr = async (req, res) => {
    try {
        const event = await prisma.event.findUnique({
            where: { id: req.params.id },
            select: { id: true, schoolId: true, qrToken: true, title: true, isActive: true },
        });

        if (!event || !event.isActive) {
            return res.status(404).json({ error: 'Event not found' });
        }

        if (!req.user.isPlatformAdmin && event.schoolId !== req.user.schoolId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const bookingUrl = `${process.env.APP_BASE_URL}/book/${event.qrToken}`;

        const png = await QRCode.toBuffer(bookingUrl, {
            type: 'png',
            width: 400,
            margin: 2,
        });

        res.set('Content-Type', 'image/png');
        res.set('Content-Disposition', `inline; filename="event-${event.id}-qr.png"`);
        res.send(png);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
