import bcrypt from 'bcrypt';
import 'dotenv/config';
import prisma from './config/prisma.js';

async function main() {
    console.log('Seeding database...');

    // ── Platform admin ─────────────────────────────────────────────────────
    const adminExists = await prisma.user.findUnique({
        where: { email: 'admin@schoolbook.de' },
    });

    if (!adminExists) {
        const hash = await bcrypt.hash('admin123', 10);
        await prisma.user.create({
            data: {
                email: 'admin@schoolbook.de',
                password: hash,
                name: 'Platform Admin',
                role: 'platform_admin',
            },
        });
        console.log('Created platform_admin: admin@schoolbook.de / admin123');
    } else {
        console.log('platform_admin already exists, skipping.');
    }

    // ── Demo school ────────────────────────────────────────────────────────
    let school = await prisma.school.findFirst({ where: { name: 'Demo-Schule' } });

    if (!school) {
        school = await prisma.school.create({
            data: {
                name: 'Demo-Schule',
                description: 'Demo school for development',
                email: 'info@demo-schule.de',
                city: 'Berlin',
                subscriptionStatus: 'active',
            },
        });
        console.log(`Created demo school: ${school.id}`);
    } else {
        console.log('Demo school already exists, skipping.');
    }

    // ── School admin ───────────────────────────────────────────────────────
    const schoolAdminExists = await prisma.user.findUnique({
        where: { email: 'schuladmin@demo-schule.de' },
    });

    if (!schoolAdminExists) {
        const hash = await bcrypt.hash('admin123', 10);
        await prisma.user.create({
            data: {
                email: 'schuladmin@demo-schule.de',
                password: hash,
                name: 'Schul Admin',
                role: 'school_admin',
                schoolId: school.id,
            },
        });
        console.log(`Created school_admin: schuladmin@demo-schule.de / admin123  (schoolId: ${school.id})`);
    } else {
        console.log('school_admin already exists, skipping.');
    }

    console.log('Done.');
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
