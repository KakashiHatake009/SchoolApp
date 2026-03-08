import { Router } from 'express';
import { sendOtp, verifyOtpHandler } from '../controllers/otp.controller.js';

const router = Router();

// Public — no Keycloak auth (parents have no accounts)
router.post('/send', sendOtp);
router.post('/verify', verifyOtpHandler);

export default router;
