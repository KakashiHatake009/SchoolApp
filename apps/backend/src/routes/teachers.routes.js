import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import {
    getTeachers,
    getTeacherById,
    createTeacher,
    updateTeacher,
    deleteTeacher,
} from '../controllers/teachers.controller.js';

const router = Router();

router.get('/', requireRole('school_admin', 'teacher'), getTeachers);
router.get('/:id', requireRole('school_admin', 'teacher'), getTeacherById);
router.post('/', requireRole('school_admin'), createTeacher);
router.patch('/:id', requireRole('school_admin'), updateTeacher);
router.delete('/:id', requireRole('school_admin'), deleteTeacher);

export default router;
