import redis from '../config/redis.js';

const TTL_SECONDS = 600; // 10 minutes
const MAX_ATTEMPTS = 5;

function resetKey(email) {
    return `pwd_reset:${email}`;
}

function attemptsKey(email) {
    return `pwd_reset_attempts:${email}`;
}

export async function generateResetOtp(email) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await redis.set(resetKey(email), code, 'EX', TTL_SECONDS);
    await redis.del(attemptsKey(email));
    return code;
}

export async function verifyResetOtp(email, code) {
    const attKey = attemptsKey(email);
    const attempts = parseInt((await redis.get(attKey)) ?? '0', 10);

    if (attempts >= MAX_ATTEMPTS) {
        return { valid: false, reason: 'Too many attempts. Request a new code.' };
    }

    const stored = await redis.get(resetKey(email));

    if (!stored) {
        return { valid: false, reason: 'Code expired or not found' };
    }

    if (stored !== String(code)) {
        await redis.incr(attKey);
        await redis.expire(attKey, TTL_SECONDS);
        return { valid: false, reason: 'Incorrect code' };
    }

    await redis.del(resetKey(email));
    await redis.del(attKey);
    return { valid: true };
}
