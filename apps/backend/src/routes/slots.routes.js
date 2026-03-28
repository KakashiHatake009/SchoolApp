import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { getSlots, createSlots, updateSlot, deleteSlot, getSlotsByTeacher } from '../controllers/slots.controller.js';

// Mounted at /api/events/:eventId/slots
const router = Router({ mergeParams: true });

router.get('/', requireRole('platform_admin', 'school_admin', 'teacher'), getSlots);
router.post('/', requireRole('platform_admin', 'school_admin'), createSlots);

export default router;

// Flat router for /api/slots
export const slotsFlat = Router();
slotsFlat.get('/', requireRole('platform_admin', 'school_admin', 'teacher'), getSlotsByTeacher);
slotsFlat.patch('/:id', requireRole('platform_admin', 'school_admin'), updateSlot);
slotsFlat.delete('/:id', requireRole('platform_admin', 'school_admin'), deleteSlot);
