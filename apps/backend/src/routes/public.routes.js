import { Router } from 'express';
import {
    getPublicEvent,
    getPublicSlots,
    getPublicEventById,
    getPublicTeachers,
    getParentSlots,
    getPublicEventSlots,
    verifyTeacherCode,
    saveTeacherSlots,
    publishTeacherSlots,
    toggleSlotForTeacher,
    subscribeToSlotUpdates,
} from '../controllers/public.controller.js';

const router = Router();

// No authentication — accessed by parents and teachers via QR code / email link

// QR-based event lookup (QR scan)
router.get('/events/by-qr/:qrToken', getPublicEvent);
router.get('/events/by-qr/:qrToken/slots', getPublicSlots);
router.get('/events/by-qr/:qrToken/teachers', getPublicTeachers);

// Event lookup by ID (booking page + teacher manage page)
router.get('/events/:eventId', getPublicEventById);
router.get('/events/:eventId/teachers', getPublicTeachers);
router.get('/events/:eventId/slots/available', getParentSlots);
router.get('/events/:eventId/slots', getPublicEventSlots);

// Teacher access code verification → returns teacher + session JWT
router.post('/teachers/access', verifyTeacherCode);

// Teacher saves (broadcasts current state without publishing)
router.post('/teachers/save', saveTeacherSlots);

// Teacher publishes their slot availability (sets bookingStatus = 'slots_confirmed')
router.post('/teachers/publish', publishTeacherSlots);

// Slot toggle (teacher session JWT required in Authorization header)
router.patch('/slots/:id', toggleSlotForTeacher);

// SSE stream — teacher manage page subscribes for real-time slot updates
router.get('/events/:eventId/slot-updates', subscribeToSlotUpdates);

export default router;
