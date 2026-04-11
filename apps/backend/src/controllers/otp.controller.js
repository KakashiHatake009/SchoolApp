import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import { generateOtp, verifyOtp } from '../services/otp.service.js';
import { sendOtpEmail } from '../services/email.service.js';

// POST /api/otp/send
// Body: { email, eventId } OR { email, qrToken }
export const sendOtp = async (req, res) => {
    try {
        const { email, eventId, qrToken } = req.body;

        if (!email || (!eventId && !qrToken)) {
            return res.status(400).json({ error: 'email and either eventId or qrToken are required' });
        }

        const event = await prisma.event.findUnique({
            where: { id: eventId },
        });

        if (!event) return res.status(404).json({ error: 'Event not found' });

        const code = await generateOtp(email, eventId);

        // Fire-and-forget — don't block the response
        sendOtpEmail(email, code, event.name)
            .catch((e) => console.error('OTP email failed:', e.message));

        res.json({ message: 'OTP sent', eventId: event.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /api/otp/verify
// Body: { email, eventId, code }
export const verifyOtpHandler = async (req, res) => {
    try {
        const { email, eventId, code } = req.body;

        if (!email || !eventId || !code) {
            return res.status(400).json({ error: 'email, eventId, and code are required' });
        }

        const result = await verifyOtp(email, eventId, code);
        if (!result.valid) return res.status(401).json({ error: result.reason });

        const token = jwt.sign(
            { type: 'parent_otp', email, eventId },
            process.env.OTP_JWT_SECRET,
            { expiresIn: process.env.OTP_JWT_EXPIRES_IN ?? '30m' }
        );

        // Check if parent already has a confirmed booking for this event
        const existing = await prisma.booking.findFirst({
            where: { eventId, parentEmail: email, status: 'confirmed' },
            select: { cancelToken: true },
        });

        res.json({ token, existingCancelToken: existing?.cancelToken ?? null });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
