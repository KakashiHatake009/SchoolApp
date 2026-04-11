import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const hash = await bcrypt.hash('admin123', 10);

    await prisma.user.upsert({
        where: { email: 'admin@schoolbook.de' },
        update: {},
        create: {
            email: 'admin@schoolbook.de',
            password: hash,
            role: 'platform_admin',
            name: 'Platform Admin',
        },
    });

    console.log('Seed complete. Login: admin@schoolbook.de / admin123');
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
