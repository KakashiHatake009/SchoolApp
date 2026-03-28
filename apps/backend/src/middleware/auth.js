import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

// ── Extract and verify JWT from Authorization header ────────────────────────
export const requireAuth = (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        req.user = jwt.verify(auth.slice(7), JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};

// ── requireRole ─────────────────────────────────────────────────────────────
// Usage: requireRole('SCHOOL_ADMIN')  or  requireRole('SCHOOL_ADMIN', 'TEACHER')
// platform_admin bypasses all role checks automatically
export const requireRole = (...roles) => [
    requireAuth,
    (req, res, next) => {
        if (req.user.role === 'platform_admin') return next();
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
        if (req.user.role !== 'platform_admin') {
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
