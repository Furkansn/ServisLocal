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
        where: { email: 'admin@servisplus.com' },
        update: {},
        create: {
            name: 'Admin Kullanıcı',
            email: 'admin@servisplus.com',
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
        where: { email: 'operator@servisplus.com' },
        update: {},
        create: {
            name: 'Ayşe Operatör',
            email: 'operator@servisplus.com',
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
        where: { email: 'servis@servisplus.com' },
        update: {},
        create: {
            name: 'Mehmet Servis',
            email: 'servis@servisplus.com',
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
        where: { email: 'teknisyen@servisplus.com' },
        update: {},
        create: {
            name: 'Ali Teknisyen',
            email: 'teknisyen@servisplus.com',
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

    // ─── Create Sample Products ────────────────────────────
    const products = [
        { name: 'Kumanda (Universal)', sku: 'AKS-001', category: 'ACCESSORY' as const, price: 150, stock: 50 },
        { name: 'HDMI Kablo 2m', sku: 'AKS-002', category: 'ACCESSORY' as const, price: 80, stock: 100 },
        { name: 'Duvar Askı Aparatı', sku: 'AKS-003', category: 'ACCESSORY' as const, price: 250, stock: 30 },
        { name: 'Samsung 43" Ekran', sku: 'EKR-001', category: 'SCREEN' as const, price: 3500, cost: 2800, stock: 5 },
        { name: 'LG 50" Ekran', sku: 'EKR-002', category: 'SCREEN' as const, price: 4500, cost: 3600, stock: 3 },
        { name: 'Samsung 43" LED Bar Set', sku: 'LED-001', category: 'LED' as const, price: 800, cost: 500, stock: 10 },
        { name: 'LG 50" LED Bar Set', sku: 'LED-002', category: 'LED' as const, price: 900, cost: 600, stock: 8 },
        { name: 'LGP 43" Panel', sku: 'LGP-001', category: 'LGP' as const, price: 400, cost: 200, stock: 5 },
    ];

    for (const product of products) {
        await prisma.product.create({ data: product });
    }
    console.log(`  ✓ ${products.length} products created`);

    // ─── Create Ticket Counter ─────────────────────────────
    await prisma.ticketCounter.upsert({
        where: { id: 'singleton' },
        update: {},
        create: { id: 'singleton', counter: 0 },
    });
    console.log('  ✓ Ticket counter initialized');

    // ─── Create Sample Customers ───────────────────────────
    const customers = [
        { name: 'Ahmet Yılmaz', phone: '05321234567', city: 'İstanbul', district: 'Kadıköy', address: 'Moda Cad. No:15' },
        { name: 'Fatma Demir', phone: '05329876543', city: 'İstanbul', district: 'Beşiktaş', address: 'Sinanpaşa Mah. No:8' },
        { name: 'Hasan Kaya', phone: '05335556677', city: 'Ankara', district: 'Çankaya' },
    ];

    for (const customer of customers) {
        await prisma.customer.create({ data: customer });
    }
    console.log(`  ✓ ${customers.length} sample customers created`);

    // ─── Create Sample Repairer ────────────────────────────
    await prisma.repairer.create({
        data: {
            name: 'Yıldız Elektronik',
            phone: '05441234567',
            taxId: '1234567890',
            city: 'İstanbul',
            district: 'Ümraniye',
            address: 'Sanayi Mah. No:42',
        },
    });
    console.log('  ✓ Sample repairer created');

    console.log('\n✅ Database seeded successfully!\n');
    console.log('Login credentials:');
    console.log('  Admin:     admin@servisplus.com / admin123');
    console.log('  Operatör:  operator@servisplus.com / operator123');
    console.log('  Servis:    servis@servisplus.com / servis123');
    console.log('  Teknisyen: teknisyen@servisplus.com / teknisyen123');
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
