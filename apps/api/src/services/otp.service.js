import redis from '../config/redis.js';

const OTP_TTL_SECONDS = 600; // 10 minutes
const MAX_ATTEMPTS = 5;

function otpKey(email, eventId) {
    return `otp:${email}:${eventId}`;
}

function attemptsKey(email, eventId) {
    return `otp_attempts:${email}:${eventId}`;
}

// Generate a 6-digit OTP and store it in Redis
export async function generateOtp(email, eventId) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await redis.set(otpKey(email, eventId), code, 'EX', OTP_TTL_SECONDS);
    // Reset attempt counter on new OTP
    await redis.del(attemptsKey(email, eventId));
    return code;
}

// Verify OTP — returns true/false, increments failure counter, auto-deletes on success
export async function verifyOtp(email, eventId, code) {
    const attKey = attemptsKey(email, eventId);
    const attempts = parseInt((await redis.get(attKey)) ?? '0', 10);

    if (attempts >= MAX_ATTEMPTS) {
        return { valid: false, reason: 'Too many attempts. Request a new code.' };
    }

    const stored = await redis.get(otpKey(email, eventId));

    if (!stored) {
        return { valid: false, reason: 'Code expired or not found' };
    }

    if (stored !== String(code)) {
        await redis.incr(attKey);
        await redis.expire(attKey, OTP_TTL_SECONDS);
        return { valid: false, reason: 'Incorrect code' };
    }

    // Success — delete both keys
    await redis.del(otpKey(email, eventId));
    await redis.del(attKey);
    return { valid: true };
}
