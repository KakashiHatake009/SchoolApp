import { Router } from 'express';
import { sendOtp, verifyOtpHandler } from '../controllers/otp.controller.js';
import { otpLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Public — no auth required (parents have no accounts)
router.post('/send', otpLimiter, sendOtp);
router.post('/verify', otpLimiter, verifyOtpHandler);

export default router;
