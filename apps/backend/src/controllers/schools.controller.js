import prisma from '../config/prisma.js';

// GET /api/schools
export const getSchools = async (req, res) => {
    try {
        const where = req.user.isPlatformAdmin ? {} : { id: req.user.schoolId };
        const schools = await prisma.school.findMany({ where, orderBy: { name: 'asc' } });
        res.json(schools);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/schools/:id
export const getSchoolById = async (req, res) => {
    try {
        const school = await prisma.school.findUnique({ where: { id: req.params.id } });
        if (!school) return res.status(404).json({ error: 'School not found' });
        if (!req.user.isPlatformAdmin && school.id !== req.user.schoolId) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        res.json(school);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /api/schools — platform_admin only
export const createSchool = async (req, res) => {
    try {
        const { name, description, website, phone, email, street, postcode, city,
                contactPerson, contactPhone, contactEmail, logo, subscriptionStatus } = req.body;

        if (!name) return res.status(400).json({ error: 'name is required' });

        const school = await prisma.school.create({
            data: {
                name, description, website, phone, email, street, postcode, city,
                contactPerson, contactPhone, contactEmail, logo,
                subscriptionStatus: subscriptionStatus ?? 'trial',
            },
        });

        res.status(201).json(school);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PATCH /api/schools/:id
export const updateSchool = async (req, res) => {
    try {
        const existing = await prisma.school.findUnique({ where: { id: req.params.id } });
        if (!existing) return res.status(404).json({ error: 'School not found' });
        if (!req.user.isPlatformAdmin && existing.id !== req.user.schoolId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const school = await prisma.school.update({
            where: { id: req.params.id },
            data: req.body,
        });
        res.json(school);
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'School not found' });
        res.status(500).json({ error: err.message });
    }
};

// DELETE /api/schools/:id — platform_admin only
export const deleteSchool = async (req, res) => {
    try {
        const existing = await prisma.school.findUnique({ where: { id: req.params.id } });
        if (!existing) return res.status(404).json({ error: 'School not found' });

        await prisma.school.delete({ where: { id: req.params.id } });
        res.status(204).end();
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'School not found' });
        res.status(500).json({ error: err.message });
    }
};
