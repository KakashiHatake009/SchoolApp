import prisma from '../config/prisma.js';

// GET /api/schools
// SUPER_ADMIN gets all schools
// SCHOOL_ADMIN gets only their own school
export const getSchools = async (req, res) => {
    try {
        const { roles, schoolId } = req.user;

        const schools = await prisma.school.findMany({
            where: req.user.isPlatformAdmin
                ? {}                        // platform admin sees all
                : { id: schoolId },         // school admin sees only theirs
        });

        res.json(schools);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/schools/:id
export const getSchoolById = async (req, res) => {
    try {
        const school = await prisma.school.findUnique({
            where: { id: req.params.id },
        });

        if (!school) {
            return res.status(404).json({ error: 'School not found' });
        }

        res.json(school);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /api/schools
// SUPER_ADMIN only
export const createSchool = async (req, res) => {
    try {
        const { name, address, contactEmail, subscriptionPlan } = req.body;

        if (!name || !contactEmail) {
            return res.status(400).json({ error: 'name and contactEmail are required' });
        }

        const school = await prisma.school.create({
            data: {
                name,
                address,
                contactEmail,
                subscriptionPlan: subscriptionPlan ?? 'FREE',
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
        const { name, address, contactEmail, subscriptionPlan, isActive } = req.body;

        const school = await prisma.school.update({
            where: { id: req.params.id },
            data: {
                ...(name && { name }),
                ...(address && { address }),
                ...(contactEmail && { contactEmail }),
                ...(subscriptionPlan && { subscriptionPlan }),
                ...(isActive !== undefined && { isActive }),
            },
        });

        res.json(school);
    } catch (err) {
        if (err.code === 'P2025') {
            return res.status(404).json({ error: 'School not found' });
        }
        res.status(500).json({ error: err.message });
    }
};

// DELETE /api/schools/:id
// SUPER_ADMIN only — soft delete (set isActive false)
export const deleteSchool = async (req, res) => {
    try {
        await prisma.school.update({
            where: { id: req.params.id },
            data: { isActive: false },
        });

        res.json({ message: 'School deactivated' });
    } catch (err) {
        if (err.code === 'P2025') {
            return res.status(404).json({ error: 'School not found' });
        }
        res.status(500).json({ error: err.message });
    }
};