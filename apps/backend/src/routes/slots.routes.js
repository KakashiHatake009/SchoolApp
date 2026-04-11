import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import {
    getSlots,
    getSlotsByTeacher,
    createSlots,
    updateSlot,
    deleteSlot,
} from '../controllers/slots.controller.js';

const router = Router({ mergeParams: true });

// Mounted at /api/events/:eventId/slots — public GET (parents need to see slots)
router.get('/', getSlots);
router.post('/', requireRole('school_admin'), createSlots);

export default router;

// Separate flat router for /api/slots/:id and /api/slots?teacherId=X
export const slotsFlat = Router();
slotsFlat.get('/', requireRole('school_admin', 'teacher'), getSlotsByTeacher);
slotsFlat.patch('/:id', requireRole('school_admin', 'teacher'), updateSlot);
slotsFlat.delete('/:id', requireRole('school_admin'), deleteSlot);
