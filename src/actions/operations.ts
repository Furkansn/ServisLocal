'use server';

import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { AuditAction, TicketStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { syncOperationToCompatibility, deleteOperationFromCompatibility } from '@/actions/compatibility';
import { createRemoteSaleForProduct, updateRemoteSaleForProduct, cancelRemoteSale } from '@/actions/integration';

// ─── Add Operation ───────────────────────────────────────

export async function addOperation(data: {
    ticketId: string;
    operationType: string;
    removedPart?: string;
    installedProductId?: string;
    notes?: string;
    performedById?: string;
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

    let remoteSaleId: string | undefined = undefined;
    let remoteSource: string | undefined = undefined;

    // If installed product has external integration, create remote sale with title
    if (data.installedProductId) {
        const prod = await prisma.product.findUnique({ where: { id: data.installedProductId } });
        if (prod?.externalSource) {
            remoteSource = prod.externalSource;
            const saleTitle = `Servis Fişi ${ticket.ticketNo}${ticket.model ? ` - ${ticket.model}` : ''}`;
            const remoteRes = await createRemoteSaleForProduct({
                productId: prod.id,
                quantity: 1,
                ticketNo: ticket.ticketNo,
                title: saleTitle,
            });
            if (remoteRes.success && remoteRes.saleId) {
                remoteSaleId = remoteRes.saleId;
            }
        }
    }

    const result = await prisma.$transaction(async (tx) => {
        const operation = await tx.ticketOperation.create({
            data: {
                ticketId: data.ticketId,
                operationType: data.operationType as any,
                removedPart: data.removedPart || null,
                installedProductId: data.installedProductId || null,
                notes: data.notes || null,
                performedById: data.performedById || session.user.id,
                remoteSaleId: remoteSaleId || null,
                remoteSource: remoteSource || null,
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

    // Sync to Ne Takılır compatibility database
    await syncOperationToCompatibility(result.id);
    return result;
}

// ─── Complete Repair ─────────────────────────────────────

export async function completeRepair(ticketId: string) {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: 'Yetkisiz işlem: Lütfen giriş yapınız' };

        const ticket = await prisma.repairTicket.findUnique({
            where: { id: ticketId },
            include: { _count: { select: { operations: true } } },
        });

        if (!ticket) return { success: false, error: 'Fiş bulunamadı' };
        if (ticket._count.operations === 0) {
            return { success: false, error: 'En az bir tamir işlemi (LED, Ekran vb.) girilmelidir' };
        }

        const result = await prisma.$transaction(async (tx) => {
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

        return { success: true, ...result };
    } catch (err: any) {
        return { success: false, error: err.message || 'Tamir tamamlanırken bir hata oluştu' };
    }
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
    performedById?: string;
}) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const existingOp = await prisma.ticketOperation.findUnique({
        where: { id: data.operationId },
        include: { ticket: true },
    });
    if (!existingOp) throw new Error('İşlem bulunamadı');

    const userRoles = (session.user as any)?.roles || [];
    const isManager = userRoles.includes('OPERATOR') || userRoles.includes('COMPANY_ADMIN');
    if ((existingOp.ticket.status === TicketStatus.TAMAMLANDI || existingOp.ticket.status === TicketStatus.IPTAL) && !isManager) {
        throw new Error('Tamamlanan veya iptal edilen fişin işlemleri teknisyenler tarafından düzenlenemez');
    }

    const oldProductId = existingOp.installedProductId;
    const newProductId = data.installedProductId || null;

    let finalRemoteSaleId = existingOp.remoteSaleId;
    let finalRemoteSource = existingOp.remoteSource;

    // Handle remote sale lifecycle if installed product changed
    if (oldProductId !== newProductId) {
        const ticket = existingOp.ticket;
        const saleTitle = `Servis Fişi ${ticket.ticketNo}${ticket.model ? ` - ${ticket.model}` : ''}`;

        const oldProduct = oldProductId ? await prisma.product.findUnique({ where: { id: oldProductId } }) : null;
        const newProduct = newProductId ? await prisma.product.findUnique({ where: { id: newProductId } }) : null;

        // Case 1: Existing remote sale exists, and new product is from the SAME external company -> UPDATE_SALE
        if (existingOp.remoteSaleId && newProduct?.externalSource && oldProduct?.externalCompanyId === newProduct?.externalCompanyId) {
            finalRemoteSource = newProduct.externalSource;
            const updateRes = await updateRemoteSaleForProduct({
                saleId: existingOp.remoteSaleId,
                productId: newProduct.id,
                quantity: 1,
                ticketNo: ticket.ticketNo,
                title: saleTitle,
            });

            // If update sale failed on remote side, fallback to cancel old + create new
            if (!updateRes.success) {
                await cancelRemoteSale({ saleId: existingOp.remoteSaleId });
                const createRes = await createRemoteSaleForProduct({
                    productId: newProduct.id,
                    quantity: 1,
                    ticketNo: ticket.ticketNo,
                    title: saleTitle,
                });
                finalRemoteSaleId = createRes.saleId || null;
            }
        }
        // Case 2: Existing remote sale exists, but new product is from DIFFERENT company or removed -> CANCEL_SALE on old
        else if (existingOp.remoteSaleId) {
            await cancelRemoteSale({ saleId: existingOp.remoteSaleId });
            finalRemoteSaleId = null;
            finalRemoteSource = null;

            // If new product has remote integration with a different company, create new sale
            if (newProduct?.externalSource) {
                finalRemoteSource = newProduct.externalSource;
                const createRes = await createRemoteSaleForProduct({
                    productId: newProduct.id,
                    quantity: 1,
                    ticketNo: ticket.ticketNo,
                    title: saleTitle,
                });
                finalRemoteSaleId = createRes.saleId || null;
            }
        }
        // Case 3: No previous remote sale, but new product has remote integration -> CREATE_SALE
        else if (newProduct?.externalSource) {
            finalRemoteSource = newProduct.externalSource;
            const createRes = await createRemoteSaleForProduct({
                productId: newProduct.id,
                quantity: 1,
                ticketNo: ticket.ticketNo,
                title: saleTitle,
            });
            finalRemoteSaleId = createRes.saleId || null;
        }
    }

    const updated = await prisma.$transaction(async (tx) => {
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
                remoteSaleId: finalRemoteSaleId,
                remoteSource: finalRemoteSource,
                ...(data.performedById ? { performedById: data.performedById } : {}),
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
        revalidatePath('/technician-operations');
        revalidatePath(`/tickets/${existingOp.ticketId}`);

        return updated;
    });

    // Sync to Ne Takılır compatibility database
    await syncOperationToCompatibility(updated.id);
    return updated;
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

    const userRoles = (session.user as any)?.roles || [];
    const isManager = userRoles.includes('OPERATOR') || userRoles.includes('COMPANY_ADMIN');
    if ((existingOp.ticket.status === TicketStatus.TAMAMLANDI || existingOp.ticket.status === TicketStatus.IPTAL) && !isManager) {
        throw new Error('Tamamlanan veya iptal edilen fişin işlemleri teknisyenler tarafından silinemez');
    }

    const res = await prisma.$transaction(async (tx) => {
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
        revalidatePath('/technician-operations');
        revalidatePath(`/tickets/${existingOp.ticketId}`);

        return { success: true };
    });

    // If there was a remote sale on SatisiniTakipEt, cancel it to restore stock
    if (existingOp.remoteSaleId) {
        await cancelRemoteSale({ saleId: existingOp.remoteSaleId });
    }

    // Delete from Ne Takılır compatibility database
    await deleteOperationFromCompatibility(operationId);
    return res;
}

// ─── Get All Technician Operations (For Operator & Company Admin) ─────

export interface TechnicianOperationsFilter {
    startDate?: string;
    endDate?: string;
    technicianId?: string;
    operationType?: string;
    search?: string;
}

export async function getTechnicianOperationsList(filter?: TechnicianOperationsFilter) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem: Lütfen giriş yapınız');

    const userRoles = (session.user as any)?.roles || [];
    const isAuthorized = userRoles.includes('OPERATOR') || userRoles.includes('COMPANY_ADMIN');
    if (!isAuthorized) {
        throw new Error('Bu sayfaya erişim yetkiniz bulunmamaktadır.');
    }

    const where: any = {};

    if (filter?.startDate || filter?.endDate) {
        where.createdAt = {};
        if (filter.startDate) where.createdAt.gte = new Date(`${filter.startDate}T00:00:00.000Z`);
        if (filter.endDate) where.createdAt.lte = new Date(`${filter.endDate}T23:59:59.999Z`);
    }

    if (filter?.technicianId && filter.technicianId !== 'ALL') {
        where.performedById = filter.technicianId;
    }

    if (filter?.operationType && filter.operationType !== 'ALL') {
        where.operationType = filter.operationType as any;
    }

    if (filter?.search && filter.search.trim()) {
        const q = filter.search.trim();
        where.OR = [
            { ticket: { ticketNo: { contains: q, mode: 'insensitive' } } },
            { ticket: { model: { contains: q, mode: 'insensitive' } } },
            { ticket: { brand: { name: { contains: q, mode: 'insensitive' } } } },
            { ticket: { customer: { name: { contains: q, mode: 'insensitive' } } } },
            { ticket: { repairer: { name: { contains: q, mode: 'insensitive' } } } },
            { removedPart: { contains: q, mode: 'insensitive' } },
            { installedProduct: { name: { contains: q, mode: 'insensitive' } } },
            { notes: { contains: q, mode: 'insensitive' } },
        ];
    }

    const operations = await prisma.ticketOperation.findMany({
        where,
        include: {
            ticket: {
                select: {
                    id: true,
                    ticketNo: true,
                    model: true,
                    serialNo: true,
                    status: true,
                    priority: true,
                    customerType: true,
                    repairPrice: true,
                    brand: { select: { id: true, name: true } },
                    customer: { select: { id: true, name: true, phone: true } },
                    repairer: { select: { id: true, name: true, phone: true } },
                },
            },
            installedProduct: {
                select: {
                    id: true,
                    name: true,
                    sku: true,
                    category: true,
                    stock: true,
                    price: true,
                },
            },
            performedBy: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
        take: 500,
    });

    return operations.map(op => ({
        ...op,
        ticket: op.ticket ? {
            ...op.ticket,
            repairPrice: Number(op.ticket.repairPrice || 0),
        } : null,
        installedProduct: op.installedProduct ? {
            ...op.installedProduct,
            price: Number(op.installedProduct.price || 0),
        } : null,
    }));
}
