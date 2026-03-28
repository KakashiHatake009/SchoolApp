import { Router } from 'express';
import { getPublicEvent, getPublicSlots, getPublicTeachers } from '../controllers/public.controller.js';

const router = Router();

// No authentication — accessed by parents from QR code scans
router.get('/events/by-qr/:qrToken', getPublicEvent);
router.get('/events/by-qr/:qrToken/slots', getPublicSlots);
router.get('/events/by-qr/:qrToken/teachers', getPublicTeachers);

export default router;
