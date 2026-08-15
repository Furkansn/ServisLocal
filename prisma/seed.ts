import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import bcrypt from 'bcryptjs';

const adapter = new PrismaNeon(
    { connectionString: process.env.DATABASE_URL! },
    { schema: 'servisplus' }
);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🌱 Seeding database...');

    // ─── Create Admin User ─────────────────────────────────
    const passwordHash = await bcrypt.hash('admin123', 12);

    const admin = await prisma.personnel.upsert({
        where: { email: 'admin@servislocal.com' },
        update: {},
        create: {
            name: 'Admin Kullanıcı',
            email: 'admin@servislocal.com',
            passwordHash,
            phone: '05551234567',
            roles: {
                create: [
                    { role: Role.OPERATOR },
                    { role: Role.SERVICE_STAFF },
                    { role: Role.TECHNICIAN },
                ],
            },
        },
    });
    console.log(`  ✓ Admin user created: ${admin.email}`);

    // ─── Create Sample Personnel ───────────────────────────
    const operatorHash = await bcrypt.hash('operator123', 12);
    const operator = await prisma.personnel.upsert({
        where: { email: 'operator@servislocal.com' },
        update: {},
        create: {
            name: 'Ayşe Operatör',
            email: 'operator@servislocal.com',
            passwordHash: operatorHash,
            phone: '05559876543',
            roles: {
                create: [{ role: Role.OPERATOR }],
            },
        },
    });
    console.log(`  ✓ Operator created: ${operator.email}`);

    const serviceHash = await bcrypt.hash('servis123', 12);
    const serviceStaff = await prisma.personnel.upsert({
        where: { email: 'servis@servislocal.com' },
        update: {},
        create: {
            name: 'Mehmet Servis',
            email: 'servis@servislocal.com',
            passwordHash: serviceHash,
            phone: '05553334455',
            roles: {
                create: [{ role: Role.SERVICE_STAFF }],
            },
        },
    });
    console.log(`  ✓ Service staff created: ${serviceStaff.email}`);

    const techHash = await bcrypt.hash('teknisyen123', 12);
    const technician = await prisma.personnel.upsert({
        where: { email: 'teknisyen@servislocal.com' },
        update: {},
        create: {
            name: 'Ali Teknisyen',
            email: 'teknisyen@servislocal.com',
            passwordHash: techHash,
            phone: '05551112233',
            roles: {
                create: [{ role: Role.TECHNICIAN }],
            },
        },
    });
    console.log(`  ✓ Technician created: ${technician.email}`);

    // ─── Create Brands ─────────────────────────────────────
    const brands = ['Samsung', 'LG', 'Sony', 'Philips', 'Vestel', 'Arçelik', 'Beko', 'TCL', 'Hisense', 'Toshiba'];
    for (const name of brands) {
        await prisma.brand.upsert({
            where: { name },
            update: {},
            create: { name },
        });
    }
    console.log(`  ✓ ${brands.length} brands created`);

    // ─── Create Ticket Counter ─────────────────────────────
    await prisma.ticketCounter.upsert({
        where: { id: 'singleton' },
        update: {},
        create: { id: 'singleton', counter: 0 },
    });
    console.log('  ✓ Ticket counter initialized');

    console.log('\n✅ Database seeded successfully!\n');
    console.log('Login credentials:');
    console.log('  Admin:     admin@servislocal.com / admin123');
    console.log('  Operatör:  operator@servislocal.com / operator123');
    console.log('  Servis:    servis@servislocal.com / servis123');
    console.log('  Teknisyen: teknisyen@servislocal.com / teknisyen123');
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
