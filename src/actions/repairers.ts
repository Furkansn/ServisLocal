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
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: 'Yetkisiz işlem: Lütfen giriş yapınız' };

        const data = {
            name: ((formData.get('name') as string) || '').trim(),
            phone: ((formData.get('phone') as string) || '').trim(),
            taxId: ((formData.get('taxId') as string) || '').trim(),
            address: (formData.get('address') as string)?.trim() || undefined,
            city: ((formData.get('city') as string) || '').trim(),
            district: ((formData.get('district') as string) || '').trim(),
        };

        const parsed = repairerSchema.safeParse(data);
        if (!parsed.success) {
            const firstError = parsed.error.issues[0]?.message || 'Geçersiz tamirci bilgileri';
            return { success: false, error: firstError };
        }

        const repairer = await prisma.repairer.create({ data: parsed.data });

        await createAuditLog({
            entityType: 'Repairer',
            entityId: repairer.id,
            action: AuditAction.CREATE,
            changedById: session.user.id,
        });

        return { success: true, ...repairer, id: repairer.id };
    } catch (err: any) {
        return { success: false, error: err.message || 'Tamirci oluşturulurken bir hata oluştu' };
    }
}

export async function updateRepairer(id: string, formData: FormData) {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: 'Yetkisiz işlem: Lütfen giriş yapınız' };

        const existing = await prisma.repairer.findUnique({ where: { id } });
        if (!existing) return { success: false, error: 'Tamirci bulunamadı' };

        const data = {
            name: ((formData.get('name') as string) || '').trim(),
            phone: ((formData.get('phone') as string) || '').trim(),
            taxId: ((formData.get('taxId') as string) || '').trim(),
            address: (formData.get('address') as string)?.trim() || undefined,
            city: ((formData.get('city') as string) || '').trim(),
            district: ((formData.get('district') as string) || '').trim(),
        };

        const parsed = repairerSchema.safeParse(data);
        if (!parsed.success) {
            const firstError = parsed.error.issues[0]?.message || 'Geçersiz tamirci bilgileri';
            return { success: false, error: firstError };
        }

        const changes = diffFields(existing, parsed.data, ['name', 'phone', 'taxId', 'address', 'city', 'district']);

        const repairer = await prisma.repairer.update({
            where: { id },
            data: parsed.data,
        });

        if (changes.length > 0) {
            await logFieldChanges({
                entityType: 'Repairer',
                entityId: id,
                changedById: session.user.id,
                changes,
            });
        }

        return { success: true, ...repairer, id: repairer.id };
    } catch (err: any) {
        return { success: false, error: err.message || 'Tamirci güncellenirken bir hata oluştu' };
    }
}
