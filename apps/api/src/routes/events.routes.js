import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import {
    getEvents,
    getEventById,
    createEvent,
    updateEvent,
    deleteEvent,
} from '../controllers/events.controller.js';

const router = Router();

router.get('/', requireRole('SCHOOL_ADMIN', 'TEACHER'), getEvents);
router.get('/:id', requireRole('SCHOOL_ADMIN', 'TEACHER'), getEventById);
router.post('/', requireRole('SCHOOL_ADMIN'), createEvent);
router.patch('/:id', requireRole('SCHOOL_ADMIN'), updateEvent);
router.delete('/:id', requireRole('SCHOOL_ADMIN'), deleteEvent);

export default router;
