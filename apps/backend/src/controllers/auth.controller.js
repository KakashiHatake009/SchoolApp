import bcrypt from 'bcrypt';
import prisma from '../config/prisma.js';
import {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
    setRefreshCookie,
    clearRefreshCookie,
} from '../lib/tokens.js';

// POST /api/auth/login
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'email and password are required' });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

        const token = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);
        setRefreshCookie(res, refreshToken);

        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                schoolId: user.schoolId,
                teacherId: user.teacherId,
            },
            token,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /api/auth/refresh
export const refresh = async (req, res) => {
    try {
        const rt = req.cookies?.refreshToken;
        if (!rt) return res.status(401).json({ error: 'No refresh token' });

        const payload = verifyRefreshToken(rt);
        const user = await prisma.user.findUnique({ where: { id: payload.id } });
        if (!user || user.tokenVersion !== payload.tokenVersion) {
            return res.status(401).json({ error: 'Token revoked' });
        }

        const token = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);
        setRefreshCookie(res, refreshToken);

        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                schoolId: user.schoolId,
                teacherId: user.teacherId,
            },
            token,
        });
    } catch {
        res.status(401).json({ error: 'Invalid refresh token' });
    }
};

// POST /api/auth/logout
export const logout = async (req, res) => {
    try {
        const rt = req.cookies?.refreshToken;
        if (rt) {
            const payload = verifyRefreshToken(rt);
            await prisma.user.update({
                where: { id: payload.id },
                data: { tokenVersion: { increment: 1 } },
            });
        }
    } catch {
        // Token invalid or user not found — still clear cookie
    }
    clearRefreshCookie(res);
    res.json({ ok: true });
};
