import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import { generateOtp, verifyOtp } from '../services/otp.service.js';
import { sendOtpEmail } from '../services/email.service.js';

// POST /api/otp/send
// Body: { email, eventId }
export const sendOtp = async (req, res) => {
    try {
        const { email, eventId } = req.body;

        if (!email || !eventId) {
            return res.status(400).json({ error: 'email and eventId are required' });
        }

        const event = await prisma.event.findUnique({
            where: { id: eventId, isActive: true },
        });

        if (!event) return res.status(404).json({ error: 'Event not found' });

        const code = await generateOtp(email, eventId);
        await sendOtpEmail(email, code, event.title);

        res.json({ message: 'OTP sent' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /api/otp/verify
// Body: { email, eventId, code }
// Returns a short-lived JWT used as the parent's booking token
export const verifyOtpHandler = async (req, res) => {
    try {
        const { email, eventId, code } = req.body;

        if (!email || !eventId || !code) {
            return res.status(400).json({ error: 'email, eventId, and code are required' });
        }

        const result = await verifyOtp(email, eventId, code);

        if (!result.valid) {
            return res.status(401).json({ error: result.reason });
        }

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
