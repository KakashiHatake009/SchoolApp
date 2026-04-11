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

// platform_admin sees all schools; school_admin sees only their own
router.get('/', requireRole('school_admin'), getSchools);
router.get('/:id', requireRole('school_admin'), getSchoolById);

// Only platform_admin can create, update, delete
router.post('/', requirePlatformAdmin, createSchool);
router.patch('/:id', requirePlatformAdmin, updateSchool);
router.delete('/:id', requirePlatformAdmin, deleteSchool);

export default router;
