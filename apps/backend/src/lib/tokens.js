import jwt from 'jsonwebtoken';

export function generateAccessToken(user) {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            schoolId: user.schoolId,
            teacherId: user.teacherId,
        },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
    );
}

export function generateRefreshToken(user) {
    return jwt.sign(
        { id: user.id, tokenVersion: user.tokenVersion },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
    );
}

export function verifyAccessToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
}

export function verifyRefreshToken(token) {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

const COOKIE_BASE = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
};

export function setRefreshCookie(res, token) {
    res.cookie('refreshToken', token, { ...COOKIE_BASE, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

export function clearRefreshCookie(res) {
    res.clearCookie('refreshToken', COOKIE_BASE);
}
