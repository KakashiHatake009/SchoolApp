import prisma from '../config/prisma.js';

// GET /api/schools
export const getSchools = async (req, res) => {
    try {
        const where = req.user.role === 'platform_admin'
            ? {}
            : { id: req.user.schoolId };

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
        res.json(school);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /api/schools
export const createSchool = async (req, res) => {
    try {
        const {
            name, description, website, phone, email,
            street, postcode, city,
            contactPerson, contactPhone, contactEmail,
            subscriptionStatus,
        } = req.body;

        if (!name || !contactEmail) {
            return res.status(400).json({ error: 'name and contactEmail are required' });
        }

        const school = await prisma.school.create({
            data: {
                name, description, website, phone, email,
                street, postcode, city,
                contactPerson, contactPhone, contactEmail,
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
        const fields = [
            'name','description','website','phone','email',
            'street','postcode','city',
            'contactPerson','contactPhone','contactEmail',
            'subscriptionStatus','isActive',
        ];
        const data = {};
        for (const f of fields) {
            if (req.body[f] !== undefined) data[f] = req.body[f];
        }

        const school = await prisma.school.update({ where: { id: req.params.id }, data });
        res.json(school);
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'School not found' });
        res.status(500).json({ error: err.message });
    }
};

// DELETE /api/schools/:id — soft delete
export const deleteSchool = async (req, res) => {
    try {
        await prisma.school.update({ where: { id: req.params.id }, data: { isActive: false } });
        res.json({ message: 'School deactivated' });
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'School not found' });
        res.status(500).json({ error: err.message });
    }
};
