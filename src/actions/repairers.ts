'use server';

import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { repairerSchema } from '@/lib/validations';
import { createAuditLog, logFieldChanges, diffFields } from '@/lib/audit';
import { AuditAction } from '@prisma/client';

export async function getRepairers(search?: string) {
    const where = search
        ? {
            OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { phone: { contains: search } },
            ],
        }
        : {};

    return prisma.repairer.findMany({
        where,
        orderBy: { name: 'asc' },
        take: 50,
    });
}

export async function getRepairerById(id: string) {
    return prisma.repairer.findUnique({ where: { id } });
}

export async function getRepairerWithTickets(id: string) {
    const repairer = await prisma.repairer.findUnique({
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
    if (!repairer) return null;
    return {
        ...repairer,
        tickets: repairer.tickets.map(t => ({
            ...t,
            repairPrice: Number(t.repairPrice),
            totalAmount: Number(t.totalAmount),
            paidAmount: Number(t.paidAmount),
        })),
    };
}

export async function createRepairer(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const data = {
        name: formData.get('name') as string,
        phone: formData.get('phone') as string,
        taxId: formData.get('taxId') as string,
        address: (formData.get('address') as string) || undefined,
        city: formData.get('city') as string,
        district: formData.get('district') as string,
    };

    const parsed = repairerSchema.parse(data);
    const repairer = await prisma.repairer.create({ data: parsed });

    await createAuditLog({
        entityType: 'Repairer',
        entityId: repairer.id,
        action: AuditAction.CREATE,
        changedById: session.user.id,
    });

    return repairer;
}

export async function updateRepairer(id: string, formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const existing = await prisma.repairer.findUnique({ where: { id } });
    if (!existing) throw new Error('Tamirci bulunamadı');

    const data = {
        name: formData.get('name') as string,
        phone: formData.get('phone') as string,
        taxId: formData.get('taxId') as string,
        address: (formData.get('address') as string) || undefined,
        city: formData.get('city') as string,
        district: formData.get('district') as string,
    };

    const parsed = repairerSchema.parse(data);
    const changes = diffFields(existing, parsed, ['name', 'phone', 'taxId', 'address', 'city', 'district']);

    const repairer = await prisma.repairer.update({
        where: { id },
        data: parsed,
    });

    if (changes.length > 0) {
        await logFieldChanges({
            entityType: 'Repairer',
            entityId: id,
            changedById: session.user.id,
            changes,
        });
    }

    return repairer;
}
