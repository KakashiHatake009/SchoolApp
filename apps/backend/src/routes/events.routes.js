import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import {
    getEvents,
    getEventById,
    createEvent,
    updateEvent,
    deleteEvent,
    publishEvent,
    unpublishEvent,
    duplicateEvent,
    getEventQr,
} from '../controllers/events.controller.js';

const router = Router();

router.get('/', requireRole('school_admin', 'teacher'), getEvents);
router.get('/:id', requireRole('school_admin', 'teacher'), getEventById);
router.post('/', requireRole('school_admin'), createEvent);
router.patch('/:id', requireRole('school_admin'), updateEvent);
router.delete('/:id', requireRole('school_admin'), deleteEvent);
router.post('/:id/publish', requireRole('school_admin'), publishEvent);
router.post('/:id/unpublish', requireRole('school_admin'), unpublishEvent);
router.post('/:id/duplicate', requireRole('school_admin'), duplicateEvent);
router.get('/:id/qr', requireRole('school_admin', 'teacher'), getEventQr);

export default router;
