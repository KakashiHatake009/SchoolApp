import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import {
    getEvents, getEventById, createEvent, updateEvent, deleteEvent,
    duplicateEvent, publishEvent, unpublishEvent,
} from '../controllers/events.controller.js';

const router = Router();

router.get('/', requireRole('platform_admin', 'school_admin', 'teacher'), getEvents);
router.get('/:id', requireRole('platform_admin', 'school_admin', 'teacher'), getEventById);
router.post('/', requireRole('platform_admin', 'school_admin'), createEvent);
router.patch('/:id', requireRole('platform_admin', 'school_admin'), updateEvent);
router.delete('/:id', requireRole('platform_admin', 'school_admin'), deleteEvent);

// Extra actions
router.post('/:id/duplicate', requireRole('platform_admin', 'school_admin'), duplicateEvent);
router.post('/:id/publish', requireRole('platform_admin', 'school_admin'), publishEvent);
router.post('/:id/unpublish', requireRole('platform_admin', 'school_admin'), unpublishEvent);

export default router;
