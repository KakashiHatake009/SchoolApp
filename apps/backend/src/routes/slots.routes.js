import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import {
    getSlots,
    createSlots,
    updateSlot,
    deleteSlot,
} from '../controllers/slots.controller.js';

const router = Router({ mergeParams: true });

// Mounted at /api/events/:eventId/slots
router.get('/', requireRole('SCHOOL_ADMIN', 'TEACHER'), getSlots);
router.post('/', requireRole('SCHOOL_ADMIN'), createSlots);

export default router;

// Separate flat router for /api/slots/:id (update/delete without eventId in path)
export const slotsFlat = Router();
slotsFlat.patch('/:id', requireRole('SCHOOL_ADMIN'), updateSlot);
slotsFlat.delete('/:id', requireRole('SCHOOL_ADMIN'), deleteSlot);
