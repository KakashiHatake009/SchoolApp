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

        const where = eventId ? { id: eventId, isActive: true } : { qrToken, isActive: true };
        const event = await prisma.event.findUnique({ where });

        if (!event) return res.status(404).json({ error: 'Event not found' });

        const code = await generateOtp(email, event.id);
        await sendOtpEmail(email, code, event.name);

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

        res.json({ token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
