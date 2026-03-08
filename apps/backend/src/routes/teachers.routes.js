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

router.get('/', requireRole('SCHOOL_ADMIN', 'TEACHER'), getTeachers);
router.get('/:id', requireRole('SCHOOL_ADMIN', 'TEACHER'), getTeacherById);
router.post('/', requireRole('SCHOOL_ADMIN'), createTeacher);
router.patch('/:id', requireRole('SCHOOL_ADMIN'), updateTeacher);
router.delete('/:id', requireRole('SCHOOL_ADMIN'), deleteTeacher);

export default router;
