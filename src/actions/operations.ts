'use server';

import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { AuditAction, TicketStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';

// ─── Add Operation ───────────────────────────────────────

export async function addOperation(data: {
    ticketId: string;
    operationType: string;
    removedPart?: string;
    installedProductId?: string;
    notes?: string;
}) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');
    const userRoles = (session.user as any)?.roles || [];
    const isManager = userRoles.includes('OPERATOR');

    const ticket = await prisma.repairTicket.findUnique({ where: { id: data.ticketId } });
    if (!ticket) throw new Error('Fiş bulunamadı');
    if ((ticket.status === TicketStatus.TAMAMLANDI || ticket.status === TicketStatus.TESLIM_EDILDI) && !isManager) {
        throw new Error('Bu fiş teslim edildiği / tamamlandığı için üzerinde yeni tamir işlemi eklenemez.');
    }

    return prisma.$transaction(async (tx) => {
        const operation = await tx.ticketOperation.create({
            data: {
                ticketId: data.ticketId,
                operationType: data.operationType as any,
                removedPart: data.removedPart || null,
                installedProductId: data.installedProductId || null,
                notes: data.notes || null,
                performedById: session.user.id,
            },
        });

        // If a product was used, decrement stock
        if (data.installedProductId) {
            const product = await tx.product.findUnique({
                where: { id: data.installedProductId },
            });

            if (product) {
                // For SCREEN, check stock > 0
                if (product.category === 'SCREEN' && product.stock <= 0) {
                    throw new Error('Bu ürünün stoku yok');
                }

                // Decrement stock (allow negative for LED)
                await tx.product.update({
                    where: { id: data.installedProductId },
                    data: { stock: { decrement: 1 } },
                });
            }
        }

        await tx.auditLog.create({
            data: {
                ticketId: data.ticketId,
                entityType: 'TicketOperation',
                entityId: operation.id,
                action: AuditAction.CREATE,
                changedById: session.user.id,
            },
        });

        return operation;
    });
}

// ─── Complete Repair ─────────────────────────────────────

export async function completeRepair(ticketId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const ticket = await prisma.repairTicket.findUnique({
        where: { id: ticketId },
        include: { _count: { select: { operations: true } } },
    });

    if (!ticket) throw new Error('Fiş bulunamadı');
    if (ticket._count.operations === 0) {
        throw new Error('En az bir işlem girilmelidir');
    }

    return prisma.$transaction(async (tx) => {
        const updated = await tx.repairTicket.update({
            where: { id: ticketId },
            data: { status: TicketStatus.TAMIR_TAMAMLANDI },
        });

        await tx.statusHistory.create({
            data: {
                ticketId,
                fromStatus: ticket.status,
                toStatus: TicketStatus.TAMIR_TAMAMLANDI,
                changedById: session.user.id,
                notes: 'Tamir tamamlandı - Teslimat bekliyor',
            },
        });

        return {
            ...updated,
            repairPrice: Number(updated.repairPrice),
            totalAmount: Number(updated.totalAmount),
            paidAmount: Number(updated.paidAmount),
        };
    });
}

// ─── Get Technician's Active Repairs ─────────────────────

export async function getActiveRepairs() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const tickets = await prisma.repairTicket.findMany({
        where: {
            status: TicketStatus.TEKNISYENE_VERILDI,
        },
        include: {
            customer: { select: { name: true, phone: true } },
            repairer: { select: { name: true, phone: true } },
            brand: { select: { name: true } },
            operations: {
                include: {
                    installedProduct: { select: { name: true } },
                },
            },
        },
        orderBy: [
            { priority: 'desc' },
            { createdAt: 'asc' },
        ],
    });

    return tickets.map(t => ({
        ...t,
        repairPrice: Number(t.repairPrice),
        totalAmount: Number(t.totalAmount),
        paidAmount: Number(t.paidAmount),
    }));
}

// ─── Get Technician's Completed Repairs ──────────────────

export async function getCompletedRepairs() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const tickets = await prisma.repairTicket.findMany({
        where: {
            status: {
                in: [
                    TicketStatus.TAMIR_TAMAMLANDI,
                    TicketStatus.TESLIMAT_SERVIS_ISTENDI,
                    TicketStatus.TESLIM_EDILDI,
                    TicketStatus.ODEME_BEKLIYOR,
                    TicketStatus.TAMAMLANDI,
                ],
            },
        },
        include: {
            customer: { select: { name: true, phone: true } },
            repairer: { select: { name: true, phone: true } },
            brand: { select: { name: true } },
            operations: {
                include: {
                    installedProduct: { select: { id: true, name: true, stock: true, category: true } },
                },
            },
        },
        orderBy: {
            updatedAt: 'desc',
        },
        take: 100,
    });

    return tickets.map(t => ({
        ...t,
        repairPrice: Number(t.repairPrice),
        totalAmount: Number(t.totalAmount),
        paidAmount: Number(t.paidAmount),
    }));
}

// ─── Update Operation ────────────────────────────────────

export async function updateOperation(data: {
    operationId: string;
    operationType: string;
    removedPart?: string;
    installedProductId?: string;
    notes?: string;
}) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const existingOp = await prisma.ticketOperation.findUnique({
        where: { id: data.operationId },
        include: { ticket: true },
    });
    if (!existingOp) throw new Error('İşlem bulunamadı');
    if (existingOp.ticket.status === TicketStatus.TAMAMLANDI || existingOp.ticket.status === TicketStatus.IPTAL) {
        throw new Error('Tamamlanan veya iptal edilen fişin işlemleri düzenlenemez');
    }

    const oldProductId = existingOp.installedProductId;
    const newProductId = data.installedProductId || null;

    return prisma.$transaction(async (tx) => {
        // Handle product stock change if installed product changed
        if (oldProductId !== newProductId) {
            // Restore stock for old product if there was one
            if (oldProductId) {
                await tx.product.update({
                    where: { id: oldProductId },
                    data: { stock: { increment: 1 } },
                });
            }

            // Decrement stock for new product if selected
            if (newProductId) {
                const product = await tx.product.findUnique({ where: { id: newProductId } });
                if (product) {
                    if (product.category === 'SCREEN' && product.stock <= 0) {
                        throw new Error('Bu ürünün stoku yok');
                    }
                    await tx.product.update({
                        where: { id: newProductId },
                        data: { stock: { decrement: 1 } },
                    });
                }
            }
        }

        const updated = await tx.ticketOperation.update({
            where: { id: data.operationId },
            data: {
                operationType: data.operationType as any,
                removedPart: data.removedPart || null,
                installedProductId: newProductId,
                notes: data.notes || null,
            },
        });

        await tx.auditLog.create({
            data: {
                ticketId: existingOp.ticketId,
                entityType: 'TicketOperation',
                entityId: data.operationId,
                action: AuditAction.UPDATE,
                changedById: session.user.id,
            },
        });

        revalidatePath('/technician');
        revalidatePath(`/tickets/${existingOp.ticketId}`);

        return updated;
    });
}

// ─── Delete Operation ────────────────────────────────────

export async function deleteOperation(operationId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const existingOp = await prisma.ticketOperation.findUnique({
        where: { id: operationId },
        include: { ticket: true },
    });
    if (!existingOp) throw new Error('İşlem bulunamadı');
    if (existingOp.ticket.status === TicketStatus.TAMAMLANDI || existingOp.ticket.status === TicketStatus.IPTAL) {
        throw new Error('Tamamlanan veya iptal edilen fişin işlemleri silinemez');
    }

    return prisma.$transaction(async (tx) => {
        // Restore stock if product was installed
        if (existingOp.installedProductId) {
            await tx.product.update({
                where: { id: existingOp.installedProductId },
                data: { stock: { increment: 1 } },
            });
        }

        // If ticket has repairItems with this operationId, remove it from repairItems and recalculate repairPrice & totalAmount
        const ticket = existingOp.ticket;
        if (ticket.repairItems) {
            let currentItems: any[] = [];
            if (typeof ticket.repairItems === 'string') {
                try { currentItems = JSON.parse(ticket.repairItems); } catch (e) {}
            } else if (Array.isArray(ticket.repairItems)) {
                currentItems = ticket.repairItems as any[];
            }

            const updatedItems = currentItems.filter((item: any) => item.operationId !== operationId);
            if (updatedItems.length !== currentItems.length) {
                const newRepairPrice = updatedItems.reduce((sum, i) => sum + Number(i.price || 0), 0);
                const accessories = await tx.ticketAccessory.aggregate({
                    where: { ticketId: ticket.id },
                    _sum: { totalPrice: true },
                });
                const accessoriesTotal = Number(accessories._sum.totalPrice || 0);
                const newTotalAmount = newRepairPrice + accessoriesTotal;

                await tx.repairTicket.update({
                    where: { id: ticket.id },
                    data: {
                        repairItems: updatedItems,
                        repairPrice: newRepairPrice,
                        totalAmount: newTotalAmount,
                    },
                });
            }
        }

        await tx.ticketOperation.delete({
            where: { id: operationId },
        });

        await tx.auditLog.create({
            data: {
                ticketId: existingOp.ticketId,
                entityType: 'TicketOperation',
                entityId: operationId,
                action: AuditAction.DELETE,
                changedById: session.user.id,
            },
        });

        revalidatePath('/technician');
        revalidatePath(`/tickets/${existingOp.ticketId}`);

        return { success: true };
    });
}
