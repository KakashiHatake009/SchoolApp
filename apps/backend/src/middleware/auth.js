import jwt from 'jsonwebtoken';
import { verifyAccessToken } from '../lib/tokens.js';

// ── Extract user object from JWT payload ────────────────────────────────────
function extractUser(payload) {
    return {
        id: payload.id,
        email: payload.email,
        name: payload.name,
        role: payload.role,
        schoolId: payload.schoolId ?? null,
        teacherId: payload.teacherId ?? null,
        isPlatformAdmin: payload.role === 'platform_admin',
    };
}

// ── requireAuth ─────────────────────────────────────────────────────────────
// Validates the Bearer JWT issued at login.
export const requireAuth = (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const payload = verifyAccessToken(auth.slice(7));
        req.user = extractUser(payload);
        next();
    } catch {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};

// ── requireRole ─────────────────────────────────────────────────────────────
// Usage: requireRole('school_admin')  or  requireRole('school_admin', 'teacher')
// platform_admin bypasses all role checks automatically.
export const requireRole = (...roles) => [
    requireAuth,
    (req, res, next) => {
        if (req.user.isPlatformAdmin) return next();
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        next();
    },
];

// ── requirePlatformAdmin ────────────────────────────────────────────────────
export const requirePlatformAdmin = [
    requireAuth,
    (req, res, next) => {
        if (!req.user.isPlatformAdmin) {
            return res.status(403).json({ error: 'Platform admin access required' });
        }
        next();
    },
];

// ── requireParentToken ──────────────────────────────────────────────────────
// Validates the short-lived JWT issued after OTP verification.
// Used by booking endpoints — parents have no user accounts.
export const requireParentToken = (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Parent token required' });
    }
    try {
        const payload = jwt.verify(auth.slice(7), process.env.OTP_JWT_SECRET);
        if (payload.type !== 'parent_otp') {
            return res.status(401).json({ error: 'Invalid token type' });
        }
        req.parent = {
            email: payload.email,
            eventId: payload.eventId,
        };
        next();
    } catch {
        res.status(401).json({ error: 'Invalid or expired parent token' });
    }
};
