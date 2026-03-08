import { Router } from 'express';
import { getPublicEvent, getPublicSlots } from '../controllers/public.controller.js';

const router = Router();

// No authentication — these are accessed by parents from QR code scans
router.get('/events/by-qr/:qrToken', getPublicEvent);
router.get('/events/by-qr/:qrToken/slots', getPublicSlots);

export default router;
