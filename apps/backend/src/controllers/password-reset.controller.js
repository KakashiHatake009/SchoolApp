import bcrypt from 'bcrypt';
import prisma from '../config/prisma.js';
import { generateResetOtp, verifyResetOtp } from '../services/password-reset.service.js';
import { sendPasswordResetEmail } from '../services/email.service.js';

// POST /api/auth/forgot-password
export const requestReset = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'email is required' });

        const user = await prisma.user.findUnique({ where: { email } });

        // Always return 200 to prevent email enumeration
        if (user) {
            const code = await generateResetOtp(email);
            await sendPasswordResetEmail(email, code);
        }

        res.json({ ok: true, message: 'If the email exists, a reset code has been sent.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /api/auth/reset-password
export const executeReset = async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;
        if (!email || !code || !newPassword) {
            return res.status(400).json({ error: 'email, code, and newPassword are required' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        const result = await verifyResetOtp(email, code);
        if (!result.valid) {
            return res.status(400).json({ error: result.reason });
        }

        const hash = await bcrypt.hash(newPassword, 12);
        await prisma.user.update({
            where: { email },
            data: { password: hash, tokenVersion: { increment: 1 } },
        });

        res.json({ ok: true, message: 'Password has been reset.' });
    } catch (err) {
        if (err.code === 'P2025') {
            return res.status(400).json({ error: 'User not found' });
        }
        res.status(500).json({ error: err.message });
    }
};
