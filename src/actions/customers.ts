'use server';

import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { customerSchema } from '@/lib/validations';
import { createAuditLog, logFieldChanges, diffFields } from '@/lib/audit';
import { AuditAction } from '@prisma/client';
import { getSearchVariants } from '@/lib/search';

export async function getCustomers(search?: string) {
    if (!search || !search.trim()) {
        return prisma.customer.findMany({
            orderBy: { name: 'asc' },
            take: 50,
        });
    }

    const trimmed = search.trim();
    const variants = getSearchVariants(trimmed);

    const where = {
        OR: [
            ...variants.map(v => ({ name: { contains: v, mode: 'insensitive' as const } })),
            ...variants.map(v => ({ name: { contains: v } })),
            { phone: { contains: trimmed } },
        ],
    };

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
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: 'Yetkisiz işlem: Lütfen giriş yapınız' };

        const data = {
            name: ((formData.get('name') as string) || '').trim(),
            phone: ((formData.get('phone') as string) || '').trim(),
            taxId: (formData.get('taxId') as string)?.trim() || undefined,
            address: (formData.get('address') as string)?.trim() || undefined,
            city: ((formData.get('city') as string) || '').trim(),
            district: ((formData.get('district') as string) || '').trim(),
        };

        const parsed = customerSchema.safeParse(data);
        if (!parsed.success) {
            const firstError = parsed.error.issues[0]?.message || 'Geçersiz müşteri bilgileri';
            return { success: false, error: firstError };
        }

        const customer = await prisma.customer.create({ data: parsed.data });

        await createAuditLog({
            entityType: 'Customer',
            entityId: customer.id,
            action: AuditAction.CREATE,
            changedById: session.user.id,
        });

        return { success: true, ...customer, id: customer.id };
    } catch (err: any) {
        return { success: false, error: err.message || 'Müşteri oluşturulurken bir hata oluştu' };
    }
}

export async function updateCustomer(id: string, formData: FormData) {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: 'Yetkisiz işlem: Lütfen giriş yapınız' };

        const existing = await prisma.customer.findUnique({ where: { id } });
        if (!existing) return { success: false, error: 'Müşteri bulunamadı' };

        const data = {
            name: ((formData.get('name') as string) || '').trim(),
            phone: ((formData.get('phone') as string) || '').trim(),
            taxId: (formData.get('taxId') as string)?.trim() || undefined,
            address: (formData.get('address') as string)?.trim() || undefined,
            city: ((formData.get('city') as string) || '').trim(),
            district: ((formData.get('district') as string) || '').trim(),
        };

        const parsed = customerSchema.safeParse(data);
        if (!parsed.success) {
            const firstError = parsed.error.issues[0]?.message || 'Geçersiz müşteri bilgileri';
            return { success: false, error: firstError };
        }

        const changes = diffFields(existing, parsed.data, ['name', 'phone', 'taxId', 'address', 'city', 'district']);

        const customer = await prisma.customer.update({
            where: { id },
            data: parsed.data,
        });

        if (changes.length > 0) {
            await logFieldChanges({
                entityType: 'Customer',
                entityId: id,
                changedById: session.user.id,
                changes,
            });
        }

        return { success: true, ...customer, id: customer.id };
    } catch (err: any) {
        return { success: false, error: err.message || 'Müşteri güncellenirken bir hata oluştu' };
    }
}
