'use server';

import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { productSchema } from '@/lib/validations';
import { TicketStatus, AuditAction } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export async function getProducts(filters?: { category?: string; search?: string }) {
    const where: any = { isActive: true };

    if (filters?.category) {
        where.category = filters.category;
    }

    if (filters?.search) {
        where.OR = [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { sku: { contains: filters.search, mode: 'insensitive' } },
        ];
    }

    const products = await prisma.product.findMany({
        where,
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return products.map(p => ({
        ...p,
        price: Number(p.price),
        cost: p.cost ? Number(p.cost) : null,
    }));
}

export async function getProductById(id: string) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return null;
    return {
        ...product,
        price: Number(product.price),
        cost: product.cost ? Number(product.cost) : null,
    };
}

export async function createProduct(data: {
    name: string;
    sku?: string;
    category: string;
    price: number;
    cost?: number;
    stock: number;
}) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const product = await prisma.product.create({
        data: {
            name: data.name,
            sku: data.sku || null,
            category: data.category as any,
            price: data.price,
            cost: data.cost || null,
            stock: data.stock,
        },
    });

    return {
        ...product,
        price: Number(product.price),
        cost: product.cost ? Number(product.cost) : null,
    };
}

export async function updateProduct(id: string, data: {
    name?: string;
    sku?: string;
    category?: string;
    price?: number;
    cost?: number;
    stock?: number;
}) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const product = await prisma.product.update({
        where: { id },
        data: {
            ...(data.name && { name: data.name }),
            ...(data.sku !== undefined && { sku: data.sku || null }),
            ...(data.category && { category: data.category as any }),
            ...(data.price !== undefined && { price: data.price }),
            ...(data.cost !== undefined && { cost: data.cost }),
            ...(data.stock !== undefined && { stock: data.stock }),
        },
    });

    return {
        ...product,
        price: Number(product.price),
        cost: product.cost ? Number(product.cost) : null,
    };
}

// ─── Accessory Sale ──────────────────────────────────────

export async function addAccessoryToTicket(data: {
    ticketId: string;
    productId: string;
    quantity: number;
    unitPrice: number;
}) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');
    const userRoles = (session.user as any)?.roles || [];
    const isManager = userRoles.includes('OPERATOR');

    const ticket = await prisma.repairTicket.findUnique({ where: { id: data.ticketId } });
    if (!ticket) throw new Error('Fiş bulunamadı');
    if (ticket.status === TicketStatus.TAMAMLANDI && !isManager) {
        throw new Error('Bu fiş tamamlandığı (kapatıldığı) için sadece Servis Müdürü tarafından düzenleme yapılabilir.');
    }

    const product = await prisma.product.findUnique({ where: { id: data.productId } });
    if (!product) throw new Error('Ürün bulunamadı');
    if (product.stock < data.quantity) throw new Error('Yetersiz stok');

    const totalPrice = data.quantity * data.unitPrice;

    return prisma.$transaction(async (tx) => {
        const accessory = await tx.ticketAccessory.create({
            data: {
                ticketId: data.ticketId,
                productId: data.productId,
                quantity: data.quantity,
                unitPrice: data.unitPrice,
                totalPrice,
                soldById: session.user.id,
            },
        });

        // Decrement stock
        await tx.product.update({
            where: { id: data.productId },
            data: { stock: { decrement: data.quantity } },
        });

        // Update ticket total
        if (ticket) {
            await tx.repairTicket.update({
                where: { id: data.ticketId },
                data: { totalAmount: Number(ticket.totalAmount) + totalPrice },
            });
        }

        return {
            ...accessory,
            unitPrice: Number(accessory.unitPrice),
            totalPrice: Number(accessory.totalPrice),
        };
    });
}

// ─── Get products by category for technician ─────────────

export async function getProductsByCategory(category: string, includeOutOfStock?: boolean) {
    const where: any = {
        category,
        isActive: true,
    };

    // For SCREEN: hide out of stock
    if (!includeOutOfStock && category === 'SCREEN') {
        where.stock = { gt: 0 };
    }

    const products = await prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
    });

    return products.map(p => ({
        ...p,
        price: Number(p.price),
        cost: p.cost ? Number(p.cost) : null,
    }));
}

export async function removeAccessoryFromTicket(accessoryId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');
    const userRoles = (session.user as any)?.roles || [];
    const isManager = userRoles.includes('OPERATOR');
    const isStaff = userRoles.includes('SERVICE_STAFF');

    if (!isManager && !isStaff) {
        throw new Error('Aksesuar satışı iptal etme yetkiniz bulunmamaktadır.');
    }

    const accessory = await prisma.ticketAccessory.findUnique({
        where: { id: accessoryId },
        include: { ticket: true, product: true },
    });

    if (!accessory) throw new Error('Satış kaydı bulunamadı');

    if (accessory.ticket.status === TicketStatus.TAMAMLANDI && !isManager) {
        throw new Error('Tamamlanmış (kapatılmış) fişlerde aksesuar iptali sadece Servis Müdürü tarafından yapılabilir.');
    }

    await prisma.$transaction(async (tx) => {
        // Delete accessory record
        await tx.ticketAccessory.delete({
            where: { id: accessoryId },
        });

        // Restore stock
        await tx.product.update({
            where: { id: accessory.productId },
            data: { stock: { increment: accessory.quantity } },
        });

        // Update ticket total
        const newTotalAmount = Math.max(0, Number(accessory.ticket.totalAmount) - Number(accessory.totalPrice));
        await tx.repairTicket.update({
            where: { id: accessory.ticketId },
            data: { totalAmount: newTotalAmount },
        });

        // Audit Log
        await tx.auditLog.create({
            data: {
                ticketId: accessory.ticketId,
                entityType: 'TicketAccessory',
                entityId: accessoryId,
                action: AuditAction.DELETE,
                field: 'totalPrice',
                oldValue: `${accessory.product.name} (x${accessory.quantity} - ${accessory.totalPrice} TL)`,
                changedById: session.user.id,
            },
        });
    });

    revalidatePath(`/tickets/${accessory.ticketId}`);
    return { success: true };
}
