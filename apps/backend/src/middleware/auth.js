import Keycloak from 'keycloak-connect';
import session from 'express-session';
import jwt from 'jsonwebtoken';

// ── Session (required by keycloak-connect) ─────────────────────────────────
export const sessionMiddleware = session({
    secret: 'some-secret',
    resave: false,
    saveUninitialized: false,
});

// ── Keycloak instance ───────────────────────────────────────────────────────
export const keycloak = new Keycloak(
    { store: session.MemoryStore },
    {
        'auth-server-url': process.env.KEYCLOAK_URL,
        realm: process.env.KEYCLOAK_REALM,
        resource: process.env.KEYCLOAK_CLIENT_ID,
        'bearer-only': true,
    }
);

// ── Extract user from Keycloak token ───────────────────────────────────────
function extractUser(token) {
    return {
        id: token.sub,
        email: token.email,
        name: token.name,
        roles: token.realm_access?.roles ?? [],
        schoolId: token.school_id ?? null,
        teacherId: token.teacher_id ?? null,
        realm: token.iss.split('/realms/')[1],
        isPlatformAdmin: token.realm_access?.roles?.includes('PLATFORM_ADMIN') ?? false,
    };
}

// ── requireRole ─────────────────────────────────────────────────────────────
// Usage: requireRole('SCHOOL_ADMIN')  or  requireRole('SCHOOL_ADMIN', 'TEACHER')
// PLATFORM_ADMIN bypasses all role checks automatically
export const requireRole = (...roles) => [
    keycloak.protect(),
    (req, res, next) => {
        const token = req.kauth?.grant?.access_token?.content;
        if (!token) return res.status(401).json({ error: 'Unauthorized' });

        req.user = extractUser(token);

        // Platform admin bypasses all role checks
        if (req.user.isPlatformAdmin) return next();

        const hasRole = roles.some(r => req.user.roles.includes(r));
        if (!hasRole) return res.status(403).json({ error: 'Forbidden' });

        next();
    },
];

// ── requirePlatformAdmin ────────────────────────────────────────────────────
export const requirePlatformAdmin = [
    keycloak.protect(),
    (req, res, next) => {
        const token = req.kauth?.grant?.access_token?.content;
        if (!token) return res.status(401).json({ error: 'Unauthorized' });

        req.user = extractUser(token);

        if (!req.user.isPlatformAdmin) {
            return res.status(403).json({ error: 'Platform admin access required' });
        }
        next();
    },
];

// ── requireParentToken ──────────────────────────────────────────────────────
// Validates the short-lived JWT issued after OTP verification.
// Used by booking endpoints — parents have no Keycloak accounts.
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
