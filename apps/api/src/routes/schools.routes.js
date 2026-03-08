import { Router } from 'express';
import { requireRole, requirePlatformAdmin } from '../middleware/auth.js';
import {
    getSchools,
    getSchoolById,
    createSchool,
    updateSchool,
    deleteSchool,
} from '../controllers/schools.controller.js';

const router = Router();

// PLATFORM_ADMIN sees all schools; SCHOOL_ADMIN sees only their own
router.get('/', requireRole('PLATFORM_ADMIN', 'SCHOOL_ADMIN'), getSchools);
router.get('/:id', requireRole('PLATFORM_ADMIN', 'SCHOOL_ADMIN'), getSchoolById);

// Only PLATFORM_ADMIN can create, update, delete
router.post('/', requirePlatformAdmin, createSchool);
router.patch('/:id', requirePlatformAdmin, updateSchool);
router.delete('/:id', requirePlatformAdmin, deleteSchool);

export default router;