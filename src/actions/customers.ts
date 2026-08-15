'use server';

import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { customerSchema } from '@/lib/validations';
import { createAuditLog, logFieldChanges, diffFields } from '@/lib/audit';
import { AuditAction } from '@prisma/client';

export async function getCustomers(search?: string) {
    const where = search
        ? {
            OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { phone: { contains: search } },
            ],
        }
        : {};

    return prisma.customer.findMany({
        where,
        orderBy: { name: 'asc' },
        take: 50,
    });
}

export async function getCustomerById(id: string) {
    return prisma.customer.findUnique({ where: { id } });
}

export async function getCustomerWithTickets(id: string) {
    const customer = await prisma.customer.findUnique({
        where: { id },
        include: {
            tickets: {
                include: {
                    brand: { select: { name: true } },
                    _count: { select: { operations: true, payments: true } },
                },
                orderBy: { createdAt: 'desc' },
            },
        },
    });
    if (!customer) return null;
    return {
        ...customer,
        tickets: customer.tickets.map(t => ({
            ...t,
            repairPrice: Number(t.repairPrice),
            totalAmount: Number(t.totalAmount),
            paidAmount: Number(t.paidAmount),
        })),
    };
}

export async function createCustomer(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const data = {
        name: formData.get('name') as string,
        phone: formData.get('phone') as string,
        taxId: (formData.get('taxId') as string) || undefined,
        address: (formData.get('address') as string) || undefined,
        city: formData.get('city') as string,
        district: formData.get('district') as string,
    };

    const parsed = customerSchema.parse(data);

    const customer = await prisma.customer.create({ data: parsed });

    await createAuditLog({
        entityType: 'Customer',
        entityId: customer.id,
        action: AuditAction.CREATE,
        changedById: session.user.id,
    });

    return customer;
}

export async function updateCustomer(id: string, formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) throw new Error('Müşteri bulunamadı');

    const data = {
        name: formData.get('name') as string,
        phone: formData.get('phone') as string,
        taxId: (formData.get('taxId') as string) || undefined,
        address: (formData.get('address') as string) || undefined,
        city: formData.get('city') as string,
        district: formData.get('district') as string,
    };

    const parsed = customerSchema.parse(data);

    const changes = diffFields(existing, parsed, ['name', 'phone', 'taxId', 'address', 'city', 'district']);

    const customer = await prisma.customer.update({
        where: { id },
        data: parsed,
    });

    if (changes.length > 0) {
        await logFieldChanges({
            entityType: 'Customer',
            entityId: id,
            changedById: session.user.id,
            changes,
        });
    }

    return customer;
}
