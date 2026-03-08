import { randomUUID } from 'crypto';
import prisma from '../config/prisma.js';
import { createTeacherUser, deleteKeycloakUser } from '../lib/keycloak-admin.js';

// GET /api/teachers
export const getTeachers = async (req, res) => {
    try {
        const where = req.user.isPlatformAdmin
            ? {}
            : { schoolId: req.user.schoolId, isActive: true };

        const teachers = await prisma.teacher.findMany({ where, orderBy: { name: 'asc' } });
        res.json(teachers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/teachers/:id
export const getTeacherById = async (req, res) => {
    try {
        const teacher = await prisma.teacher.findUnique({ where: { id: req.params.id } });
        if (!teacher) return res.status(404).json({ error: 'Teacher not found' });

        if (!req.user.isPlatformAdmin && teacher.schoolId !== req.user.schoolId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        res.json(teacher);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /api/teachers
// Creates DB record + Keycloak user atomically (rollback Keycloak on DB failure)
export const createTeacher = async (req, res) => {
    try {
        const { name, email, subject } = req.body;
        const schoolId = req.user.isPlatformAdmin ? req.body.schoolId : req.user.schoolId;

        if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
        if (!name || !email) return res.status(400).json({ error: 'name and email are required' });

        const school = await prisma.school.findUnique({ where: { id: schoolId } });
        if (!school) return res.status(404).json({ error: 'School not found' });

        // Pre-generate the DB id so we can pass it to Keycloak as teacherId
        const teacherDbId = randomUUID();

        const [firstName, ...rest] = name.trim().split(' ');
        const lastName = rest.join(' ') || firstName;

        // 1. Create Keycloak user first
        const { keycloakUserId, tempPassword } = await createTeacherUser('school_001', {
            email,
            firstName,
            lastName,
            schoolId,
            teacherId: teacherDbId,
        });

        // 2. Create DB record (rollback Keycloak on failure)
        try {
            const teacher = await prisma.teacher.create({
                data: {
                    id: teacherDbId,
                    schoolId,
                    keycloakUserId,
                    name,
                    email,
                    subject,
                },
            });

            res.status(201).json({ teacher, tempPassword });
        } catch (dbErr) {
            // Best-effort Keycloak rollback
            await deleteKeycloakUser('school_001', keycloakUserId).catch(() => {});
            throw dbErr;
        }
    } catch (err) {
        if (err.code === 'P2002') return res.status(409).json({ error: 'Email already exists' });
        res.status(500).json({ error: err.message });
    }
};

// PATCH /api/teachers/:id
export const updateTeacher = async (req, res) => {
    try {
        const existing = await prisma.teacher.findUnique({ where: { id: req.params.id } });
        if (!existing) return res.status(404).json({ error: 'Teacher not found' });

        if (!req.user.isPlatformAdmin && existing.schoolId !== req.user.schoolId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const { name, subject, isActive } = req.body;

        const teacher = await prisma.teacher.update({
            where: { id: req.params.id },
            data: {
                ...(name && { name }),
                ...(subject !== undefined && { subject }),
                ...(isActive !== undefined && { isActive }),
            },
        });

        res.json(teacher);
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Teacher not found' });
        res.status(500).json({ error: err.message });
    }
};

// DELETE /api/teachers/:id — soft delete in DB + remove from Keycloak
export const deleteTeacher = async (req, res) => {
    try {
        const existing = await prisma.teacher.findUnique({ where: { id: req.params.id } });
        if (!existing) return res.status(404).json({ error: 'Teacher not found' });

        if (!req.user.isPlatformAdmin && existing.schoolId !== req.user.schoolId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        await prisma.teacher.update({
            where: { id: req.params.id },
            data: { isActive: false },
        });

        // Remove from Keycloak (non-fatal — teacher may have been manually removed)
        await deleteKeycloakUser('school_001', existing.keycloakUserId).catch((e) => {
            console.warn('Keycloak user deletion failed (non-fatal):', e.message);
        });

        res.json({ message: 'Teacher deactivated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
