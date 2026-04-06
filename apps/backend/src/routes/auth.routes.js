import { Router } from 'express';
import { login, refresh, logout } from '../controllers/auth.controller.js';
import { requestReset, executeReset } from '../controllers/password-reset.controller.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/login', authLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/forgot-password', authLimiter, requestReset);
router.post('/reset-password', authLimiter, executeReset);

export default router;
