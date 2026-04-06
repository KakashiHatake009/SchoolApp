import prisma from '../config/prisma.js';
import { sendTeacherNotification } from '../services/email.service.js';

// GET /api/teachers?eventId=X  or  ?schoolId=X
export const getTeachers = async (req, res) => {
    try {
        const { eventId, schoolId } = req.query;

        let where = {};
        if (eventId) {
            where.eventId = eventId;
        } else if (schoolId) {
            where.schoolId = schoolId;
        } else if (!req.user.isPlatformAdmin) {
            where.schoolId = req.user.schoolId;
        }

        const teachers = await prisma.teacher.findMany({
            where,
            orderBy: { surname: 'asc' },
        });

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
export const createTeacher = async (req, res) => {
    try {
        const schoolId = req.user.isPlatformAdmin ? req.body.schoolId : req.user.schoolId;
        if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

        const { salutation, firstName, surname, eventId } = req.body;
        if (!salutation || !firstName || !surname || !eventId) {
            return res.status(400).json({ error: 'salutation, firstName, surname, eventId are required' });
        }

        // eslint-disable-next-line no-unused-vars
        const { schoolId: _s, ...rest } = req.body;
        const teacher = await prisma.teacher.create({
            data: { ...rest, schoolId },
        });

        res.status(201).json(teacher);
    } catch (err) {
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

        // Strip immutable fields
        // eslint-disable-next-line no-unused-vars
        const { id, schoolId, eventId, createdAt, ...updateData } = req.body;

        const teacher = await prisma.teacher.update({
            where: { id: req.params.id },
            data: updateData,
        });

        res.json(teacher);
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Teacher not found' });
        res.status(500).json({ error: err.message });
    }
};

// POST /api/teachers/:id/notify
export const notifyTeacher = async (req, res) => {
    try {
        const teacher = await prisma.teacher.findUnique({
            where: { id: req.params.id },
            include: { event: { include: { days: { orderBy: { date: 'asc' } } } } },
        });
        if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
        if (!req.user.isPlatformAdmin && teacher.schoolId !== req.user.schoolId) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        if (!teacher.email && !teacher.email2) {
            return res.status(400).json({ error: 'Teacher has no email address' });
        }

        const code1 = Math.floor(100000 + Math.random() * 900000).toString();
        const code2 = teacher.email2 ? Math.floor(100000 + Math.random() * 900000).toString() : null;
        const codeExpires = new Date('9999-12-31T23:59:59.999Z'); // Never expires

        await prisma.teacher.update({
            where: { id: req.params.id },
            data: {
                accessCode: code1,
                accessCodeExpires: codeExpires,
                ...(code2 ? { accessCode2: code2, accessCode2Expires: codeExpires } : {}),
            },
        });

        const appUrl = `${process.env.APP_BASE_URL || 'http://localhost:3001'}/manage/${teacher.eventId}`;

        const eventDays = teacher.event.days.length > 0
            ? teacher.event.days
            : [{ date: teacher.event.date, startTime: teacher.event.startTime, endTime: teacher.event.endTime }];

        const basePayload = { eventName: teacher.event.name, days: eventDays, appUrl };

        if (teacher.email) {
            const teacherName = [teacher.salutation, teacher.titel, teacher.firstName, teacher.surname].filter(Boolean).join(' ');
            sendTeacherNotification(teacher.email, { teacherName, ...basePayload, code: code1 })
                .catch((e) => console.error('Teacher 1 notification failed:', e.message));
        }

        if (teacher.email2 && code2) {
            const teacher2Name = [teacher.salutation2, teacher.titel2, teacher.firstName2, teacher.surname2].filter(Boolean).join(' ');
            sendTeacherNotification(teacher.email2, { teacherName: teacher2Name, ...basePayload, code: code2 })
                .catch((e) => console.error('Teacher 2 notification failed:', e.message));
        }

        res.json({ ok: true, code: code1 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DELETE /api/teachers/:id
export const deleteTeacher = async (req, res) => {
    try {
        const existing = await prisma.teacher.findUnique({ where: { id: req.params.id } });
        if (!existing) return res.status(404).json({ error: 'Teacher not found' });
        if (!req.user.isPlatformAdmin && existing.schoolId !== req.user.schoolId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        await prisma.teacher.delete({ where: { id: req.params.id } });
        res.status(204).end();
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Teacher not found' });
        res.status(500).json({ error: err.message });
    }
};
