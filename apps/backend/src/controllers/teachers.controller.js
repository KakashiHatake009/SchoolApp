import prisma from '../config/prisma.js';

// GET /api/teachers?eventId=&schoolId=
export const getTeachers = async (req, res) => {
    try {
        const { eventId, schoolId } = req.query;

        const where = { isActive: true };

        if (eventId) {
            where.eventId = eventId;
        } else if (req.user.role === 'platform_admin') {
            if (schoolId) where.schoolId = schoolId;
        } else {
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

        if (!req.user.role === 'platform_admin' && teacher.schoolId !== req.user.schoolId) {
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
        const {
            salutation, titel, firstName, surname, email, roomNo, klasse,
            salutation2, titel2, firstName2, surname2, email2,
            bookingStatus, eventId,
        } = req.body;
        const schoolId = req.user.role === 'platform_admin' ? req.body.schoolId : req.user.schoolId;

        if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
        if (!firstName || !surname) return res.status(400).json({ error: 'firstName and surname are required' });
        if (!eventId) return res.status(400).json({ error: 'eventId is required' });

        const teacher = await prisma.teacher.create({
            data: {
                schoolId, eventId,
                klasse, roomNo,
                salutation: salutation ?? 'Hr.', titel,
                firstName, surname, email,
                salutation2, titel2, firstName2, surname2, email2,
                bookingStatus: bookingStatus ?? 'not_booked',
            },
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

        if (!req.user.role === 'platform_admin' && existing.schoolId !== req.user.schoolId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const fields = [
            'klasse', 'roomNo',
            'salutation', 'titel', 'firstName', 'surname', 'email',
            'salutation2', 'titel2', 'firstName2', 'surname2', 'email2',
            'bookingStatus', 'isActive',
        ];
        const data = {};
        for (const f of fields) {
            if (req.body[f] !== undefined) data[f] = req.body[f];
        }

        const teacher = await prisma.teacher.update({ where: { id: req.params.id }, data });
        res.json(teacher);
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Teacher not found' });
        res.status(500).json({ error: err.message });
    }
};

// DELETE /api/teachers/:id — soft delete
export const deleteTeacher = async (req, res) => {
    try {
        const existing = await prisma.teacher.findUnique({ where: { id: req.params.id } });
        if (!existing) return res.status(404).json({ error: 'Teacher not found' });

        if (!req.user.role === 'platform_admin' && existing.schoolId !== req.user.schoolId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        await prisma.teacher.update({ where: { id: req.params.id }, data: { isActive: false } });
        res.json({ message: 'Teacher deactivated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
