'use server';

import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { createAuditLog, logFieldChanges, diffFields } from '@/lib/audit';
import { canTransition } from '@/lib/state-machine';
import { formatTicketNo } from '@/lib/constants';
import { AuditAction, TicketStatus, Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';

// ─── Generate Ticket Number ──────────────────────────────

async function generateTicketNo(): Promise<string> {
    const counter = await prisma.ticketCounter.update({
        where: { id: 'singleton' },
        data: { counter: { increment: 1 } },
    });
    return formatTicketNo(counter.counter);
}

// ─── Create Ticket ───────────────────────────────────────

export async function createTicket(data: {
    requestType: string;
    priority: string;
    customerType: string;
    customerId?: string;
    repairerId?: string;
    brandId: string;
    model: string;
    serialNo?: string;
    hasWarranty: boolean;
    deviceCondition?: string;
    notes?: string;
    repairPrice?: number;
    repairItems?: { type: string, price: number }[];
}) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const ticketNo = await generateTicketNo();
    // Always start as 'YENI_KAYIT' by default, if no service requested automatically
    let initialStatus = TicketStatus.YENI_KAYIT;

    const ticket = await prisma.$transaction(async (tx) => {
        const newTicket = await tx.repairTicket.create({
            data: {
                ticketNo,
                requestType: data.requestType as any,
                priority: data.priority as any,
                status: initialStatus,
                customerType: data.customerType as any,
                customerId: data.customerId || null,
                repairerId: data.repairerId || null,
                brandId: data.brandId,
                model: data.model,
                serialNo: data.serialNo || null,
                hasWarranty: data.hasWarranty,
                deviceCondition: data.deviceCondition?.trim() || null,
                notes: data.notes || null,
                repairPrice: data.repairPrice || 0,
                repairItems: data.repairItems ? data.repairItems : [],
                totalAmount: data.repairPrice || 0,
                createdById: session.user.id,
            } as any,
        });

        // Create status history
        await tx.statusHistory.create({
            data: {
                ticketId: newTicket.id,
                toStatus: initialStatus,
                changedById: session.user.id,
                notes: 'Fiş oluşturuldu',
            },
        });

        // Create audit log
        await tx.auditLog.create({
            data: {
                ticketId: newTicket.id,
                entityType: 'RepairTicket',
                entityId: newTicket.id,
                action: AuditAction.CREATE,
                changedById: session.user.id,
            },
        });

        return newTicket;
    });

    return {
        ...ticket,
        repairPrice: Number(ticket.repairPrice),
        totalAmount: Number(ticket.totalAmount),
        paidAmount: Number(ticket.paidAmount),
    };
}

// ─── Get Tickets ─────────────────────────────────────────

export async function getTickets(filters?: {
    status?: string;
    search?: string;
    priority?: string;
    startDate?: string;
    endDate?: string;
}) {
    const where: Prisma.RepairTicketWhereInput = {};

    if (filters?.status && filters.status !== 'ALL') {
        if (filters.status === 'OPEN') {
            where.status = {
                notIn: [TicketStatus.TAMAMLANDI, TicketStatus.IPTAL, TicketStatus.TESLIM_EDILDI],
            };
        } else {
            where.status = filters.status as TicketStatus;
        }
    }

    if (filters?.priority) {
        where.priority = filters.priority as any;
    }

    if (filters?.startDate || filters?.endDate) {
        where.createdAt = {};
        if (filters.startDate) {
            where.createdAt.gte = new Date(`${filters.startDate}T00:00:00.000Z`);
        }
        if (filters.endDate) {
            where.createdAt.lte = new Date(`${filters.endDate}T23:59:59.999Z`);
        }
    }

    if (filters?.search) {
        where.OR = [
            { ticketNo: { contains: filters.search, mode: 'insensitive' } },
            { customer: { name: { contains: filters.search, mode: 'insensitive' } } },
            { repairer: { name: { contains: filters.search, mode: 'insensitive' } } },
            { model: { contains: filters.search, mode: 'insensitive' } },
        ];
    }

    const tickets = await prisma.repairTicket.findMany({
        where,
        include: {
            customer: { select: { id: true, name: true, phone: true } },
            repairer: { select: { id: true, name: true, phone: true } },
            brand: { select: { id: true, name: true } },
            createdBy: { select: { id: true, name: true } },
            assignedTechnician: { select: { id: true, name: true } },
            _count: { select: { operations: true, payments: true, serviceRecords: true } },
        },
        orderBy: [
            { ticketNo: 'desc' },
        ],
        take: 100,
    });

    return tickets.map(t => ({
        ...t,
        repairPrice: Number(t.repairPrice),
        totalAmount: Number(t.totalAmount),
        paidAmount: Number(t.paidAmount),
    }));
}

// ─── Get Ticket By ID ────────────────────────────────────

export async function getTicketById(id: string) {
    const ticket = await prisma.repairTicket.findUnique({
        where: { id },
        include: {
            customer: true,
            repairer: true,
            brand: true,
            createdBy: { select: { id: true, name: true } },
            assignedTechnician: { select: { id: true, name: true } },
            photos: {
                include: { uploadedBy: { select: { name: true } } },
                orderBy: { createdAt: 'asc' },
            },
            operations: {
                include: {
                    performedBy: { select: { name: true } },
                    installedProduct: { select: { name: true, sku: true } },
                },
                orderBy: { createdAt: 'asc' },
            },
            accessories: {
                include: {
                    product: { select: { name: true } },
                    soldBy: { select: { name: true } },
                },
                orderBy: { createdAt: 'asc' },
            },
            payments: {
                include: { receivedBy: { select: { name: true } } },
                orderBy: { createdAt: 'asc' },
            },
            serviceRecords: {
                include: { assignedPersonnel: { select: { id: true, name: true } } },
                orderBy: { scheduledDate: 'asc' },
            },
            statusHistory: {
                include: { changedBy: { select: { name: true } } },
                orderBy: { createdAt: 'desc' },
            },
        },
    });

    if (!ticket) return null;

    return {
        ...ticket,
        repairPrice: Number(ticket.repairPrice),
        repairItems: (ticket as any).repairItems || [],
        totalAmount: Number(ticket.totalAmount),
        paidAmount: Number(ticket.paidAmount),
        accessories: ticket.accessories.map(a => ({
            ...a,
            unitPrice: Number(a.unitPrice),
            totalPrice: Number(a.totalPrice),
        })),
        payments: ticket.payments.map(p => ({
            ...p,
            amount: Number(p.amount),
        })),
    };
}

// ─── Change Ticket Status ────────────────────────────────

export async function changeTicketStatus(ticketId: string, newStatus: TicketStatus, notes?: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');
    const userRoles = (session.user as any)?.roles || [];
    const isManager = userRoles.includes('OPERATOR');

    const ticket = await prisma.repairTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new Error('Fiş bulunamadı');

    // Closed tickets can only be edited by Service Manager (OPERATOR)
    if (ticket.status === TicketStatus.TAMAMLANDI && !isManager) {
        throw new Error('Bu fiş tamamlandığı (kapatıldığı) için sadece Servis Müdürü tarafından düzenleme yapılabilir.');
    }

    // Payment completeness check for TAMAMLANDI and TESLIM_EDILDI
    if ((newStatus === TicketStatus.TAMAMLANDI || newStatus === TicketStatus.TESLIM_EDILDI) && Number(ticket.totalAmount) > Number(ticket.paidAmount)) {
        throw new Error('Tahsilat kısmı tamamlanmadan (ödemenin tamamı alınmadan) fiş Tamamlandı veya Teslim Edildi durumuna alınamaz.');
    }

    return prisma.$transaction(async (tx) => {
        const updated = await tx.repairTicket.update({
            where: { id: ticketId },
            data: { status: newStatus },
        });

        await tx.statusHistory.create({
            data: {
                ticketId,
                fromStatus: ticket.status,
                toStatus: newStatus,
                changedById: session.user.id,
                notes,
            },
        });

        await tx.auditLog.create({
            data: {
                ticketId,
                entityType: 'RepairTicket',
                entityId: ticketId,
                action: AuditAction.STATUS_CHANGE,
                field: 'status',
                oldValue: ticket.status,
                newValue: newStatus,
                changedById: session.user.id,
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

// ─── Update Ticket ───────────────────────────────────────

export async function updateTicket(ticketId: string, data: Record<string, any>) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');
    const userRoles = (session.user as any)?.roles || [];
    const isManager = userRoles.includes('OPERATOR');

    const existing = await prisma.repairTicket.findUnique({ where: { id: ticketId } });
    if (!existing) throw new Error('Fiş bulunamadı');
    if (existing.status === TicketStatus.IPTAL) throw new Error('İptal edilen fiş düzenlenemez');
    if (existing.status === TicketStatus.TAMAMLANDI && !isManager) {
        throw new Error('Bu fiş tamamlandığı (kapatıldığı) için sadece Servis Müdürü tarafından düzenleme yapılabilir.');
    }

    if ((data.status === TicketStatus.TAMAMLANDI || data.status === TicketStatus.TESLIM_EDILDI) && Number(existing.totalAmount) > Number(existing.paidAmount)) {
        throw new Error('Tahsilat kısmı tamamlanmadan (ödemenin tamamı alınmadan) fiş Tamamlandı veya Teslim Edildi durumuna alınamaz.');
    }

    const fieldsToTrack = ['requestType', 'priority', 'model', 'serialNo', 'hasWarranty', 'notes', 'totalAmount', 'repairPrice'];

    // If repairPrice is changing, recalculate totalAmount
    if (data.repairPrice !== undefined) {
        const accessories = await prisma.ticketAccessory.aggregate({
            where: { ticketId },
            _sum: { totalPrice: true },
        });
        const accessoriesTotal = Number(accessories._sum.totalPrice || 0);
        data.totalAmount = Number(data.repairPrice) + accessoriesTotal;
    }

    const changes = diffFields(existing as any, data, fieldsToTrack);

    // Prepare update data for Prisma (relations need explicit connect/disconnect)
    const { customerId, repairerId, brandId, ...rest } = data;
    const updateData: any = { ...rest };
    // Remove other non-Prisma fields if any (like serviceDate/servicePersonnelId which are not on RepairTicket model locally)
    delete updateData.serviceDate;
    delete updateData.servicePersonnelId;

    if (customerId !== undefined) {
        if (customerId) updateData.customer = { connect: { id: customerId } };
        else updateData.customer = { disconnect: true };
    }

    if (repairerId !== undefined) {
        if (repairerId) updateData.repairer = { connect: { id: repairerId } };
        else updateData.repairer = { disconnect: true };
    }

    if (brandId) {
        updateData.brand = { connect: { id: brandId } };
    }

    const updated = await prisma.repairTicket.update({
        where: { id: ticketId },
        data: updateData,
    });

    if (changes.length > 0) {
        await logFieldChanges({
            ticketId: ticketId,
            entityType: 'RepairTicket',
            entityId: ticketId,
            changedById: session.user.id,
            changes,
        });
    }

    revalidatePath(`/tickets/${ticketId}`);
    revalidatePath('/tickets');

    return {
        ...updated,
        repairPrice: Number(updated.repairPrice),
        totalAmount: Number(updated.totalAmount),
        paidAmount: Number(updated.paidAmount),
    };
}

// ─── Add/Remove Operation to Ticket Repair Items ──────────

export async function addOperationToRepairItems(ticketId: string, operationId: string, itemTypeLabel: string, price: number) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');
    const userRoles = (session.user as any)?.roles || [];
    const isManager = userRoles.includes('OPERATOR');

    const ticket = await prisma.repairTicket.findUnique({
        where: { id: ticketId },
        include: { accessories: true }
    });
    if (!ticket) throw new Error('Fiş bulunamadı');
    if (ticket.status === TicketStatus.IPTAL) throw new Error('İptal edilen fişte işlem yapılamaz');
    if (ticket.status === TicketStatus.TAMAMLANDI && !isManager) {
        throw new Error('Bu fiş tamamlandığı (kapatıldığı) için sadece Servis Müdürü tarafından düzenleme yapılabilir.');
    }

    let currentItems: { type: string; price: number; operationId?: string }[] = [];
    if (ticket.repairItems) {
        if (typeof ticket.repairItems === 'string') {
            try { currentItems = JSON.parse(ticket.repairItems); } catch (e) { }
        } else if (Array.isArray(ticket.repairItems)) {
            currentItems = ticket.repairItems as any;
        }
    }

    const existingIdx = currentItems.findIndex(i => i.operationId === operationId);
    if (existingIdx !== -1) {
        currentItems[existingIdx].price = Number(price);
        currentItems[existingIdx].type = itemTypeLabel;
    } else {
        currentItems.push({
            type: itemTypeLabel,
            price: Number(price),
            operationId: operationId,
        });
    }

    const newRepairPrice = currentItems.reduce((sum, i) => sum + Number(i.price || 0), 0);
    const accessoriesTotal = ticket.accessories.reduce((sum, acc) => sum + Number(acc.totalPrice || 0), 0);
    const newTotalAmount = newRepairPrice + accessoriesTotal;

    const updated = await prisma.repairTicket.update({
        where: { id: ticketId },
        data: {
            repairItems: currentItems,
            repairPrice: newRepairPrice,
            totalAmount: newTotalAmount,
        },
    });

    revalidatePath(`/tickets/${ticketId}`);
    revalidatePath('/tickets');
    return {
        ...updated,
        repairPrice: Number(updated.repairPrice),
        totalAmount: Number(updated.totalAmount),
        paidAmount: Number(updated.paidAmount),
    };
}

export async function removeOperationFromRepairItems(ticketId: string, operationId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');
    const userRoles = (session.user as any)?.roles || [];
    const isManager = userRoles.includes('OPERATOR');

    const ticket = await prisma.repairTicket.findUnique({
        where: { id: ticketId },
        include: { accessories: true }
    });
    if (!ticket) throw new Error('Fiş bulunamadı');
    if (ticket.status === TicketStatus.TAMAMLANDI && !isManager) {
        throw new Error('Bu fiş tamamlandığı (kapatıldığı) için sadece Servis Müdürü tarafından düzenleme yapılabilir.');
    }

    let currentItems: { type: string; price: number; operationId?: string }[] = [];
    if (ticket.repairItems) {
        if (typeof ticket.repairItems === 'string') {
            try { currentItems = JSON.parse(ticket.repairItems); } catch (e) { }
        } else if (Array.isArray(ticket.repairItems)) {
            currentItems = ticket.repairItems as any;
        }
    }

    const filteredItems = currentItems.filter(i => i.operationId !== operationId);
    const newRepairPrice = filteredItems.reduce((sum, i) => sum + Number(i.price || 0), 0);
    const accessoriesTotal = ticket.accessories.reduce((sum, acc) => sum + Number(acc.totalPrice || 0), 0);
    const newTotalAmount = newRepairPrice + accessoriesTotal;

    const updated = await prisma.repairTicket.update({
        where: { id: ticketId },
        data: {
            repairItems: filteredItems,
            repairPrice: newRepairPrice,
            totalAmount: newTotalAmount,
        },
    });

    revalidatePath(`/tickets/${ticketId}`);
    revalidatePath('/tickets');
    return {
        ...updated,
        repairPrice: Number(updated.repairPrice),
        totalAmount: Number(updated.totalAmount),
        paidAmount: Number(updated.paidAmount),
    };
}




// ─── Get Dashboard Stats ─────────────────────────────────

export async function getDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
        totalOpen,
        todayCreated,
        awaitingPickup,
        inRepair,
        repairCompleted,
        awaitingPayment,
        todayServiceRecords,
    ] = await Promise.all([
        prisma.repairTicket.count({
            where: { status: { notIn: [TicketStatus.TAMAMLANDI, TicketStatus.IPTAL] } },
        }),
        prisma.repairTicket.count({
            where: { createdAt: { gte: today } },
        }),
        prisma.repairTicket.count({
            where: { status: TicketStatus.SERVIS_ISTENDI },
        }),
        prisma.repairTicket.count({
            where: { status: { in: [TicketStatus.TEKNISYENE_VERILDI, TicketStatus.TEST_EDILIYOR] } },
        }),
        prisma.repairTicket.count({
            where: { status: TicketStatus.TAMIR_TAMAMLANDI },
        }),
        prisma.repairTicket.count({
            where: { status: TicketStatus.ODEME_BEKLIYOR },
        }),
        prisma.serviceRecord.count({
            where: { scheduledDate: { gte: today } },
        }),
    ]);

    return {
        totalOpen,
        todayCreated,
        awaitingPickup,
        inRepair,
        repairCompleted,
        awaitingPayment,
        todayServiceRecords,
    };
}

// ─── Update Ticket Notes ─────────────────────────────────

export async function updateTicketNotes(ticketId: string, notes: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');
    const userRoles = (session.user as any)?.roles || [];
    const isManager = userRoles.includes('OPERATOR');

    const ticket = await prisma.repairTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new Error('Fiş bulunamadı');
    if (ticket.status === TicketStatus.TAMAMLANDI && !isManager) {
        throw new Error('Bu fiş tamamlandığı (kapatıldığı) için sadece Servis Müdürü tarafından düzenleme yapılabilir.');
    }

    const updated = await prisma.repairTicket.update({
        where: { id: ticketId },
        data: { notes: notes.trim() || null },
    });

    revalidatePath(`/tickets/${ticketId}`);
    return {
        ...updated,
        repairPrice: Number(updated.repairPrice),
        totalAmount: Number(updated.totalAmount),
        paidAmount: Number(updated.paidAmount),
    };
}

// ─── Get Ticket Audit Logs ───────────────────────────────

export async function getTicketAuditLogs(ticketId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const logs = await prisma.auditLog.findMany({
        where: { ticketId },
        include: {
            changedBy: {
                select: { id: true, name: true },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    return logs;
}

// ─── Update Ticket Device Condition ───────────────────────

export async function updateTicketDeviceCondition(ticketId: string, deviceCondition: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const ticket = await prisma.repairTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new Error('Fiş bulunamadı');

    const updated = await prisma.repairTicket.update({
        where: { id: ticketId },
        data: { deviceCondition: deviceCondition.trim() || null },
    });

    revalidatePath(`/tickets/${ticketId}`);
    revalidatePath('/service');
    return {
        ...updated,
        repairPrice: Number(updated.repairPrice),
        totalAmount: Number(updated.totalAmount),
        paidAmount: Number(updated.paidAmount),
    };
}

// ─── Add Repair Item / Operation to Ticket ───────────────

export async function addRepairItemToTicket(ticketId: string, itemType: string, price: number) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const ticket = await prisma.repairTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new Error('Fiş bulunamadı');

    const rawItems = (ticket as any).repairItems;
    let items: any[] = [];
    if (rawItems) {
        if (typeof rawItems === 'string') {
            try { items = JSON.parse(rawItems); } catch(e) { items = []; }
        } else if (Array.isArray(rawItems)) {
            items = [...rawItems];
        }
    }

    items.push({ type: itemType, price: Number(price) });

    // Recalculate repairPrice and totalAmount
    const newRepairPrice = items.reduce((acc, i) => acc + Number(i.price || 0), 0);

    const accessories = await prisma.ticketAccessory.aggregate({
        where: { ticketId },
        _sum: { totalPrice: true },
    });
    const accessoriesTotal = Number(accessories._sum.totalPrice || 0);
    const newTotalAmount = newRepairPrice + accessoriesTotal;

    const updated = await prisma.repairTicket.update({
        where: { id: ticketId },
        data: {
            repairItems: items,
            repairPrice: newRepairPrice,
            totalAmount: newTotalAmount,
        },
    });

    // Audit log
    await prisma.auditLog.create({
        data: {
            ticketId,
            entityType: 'RepairTicket',
            entityId: ticketId,
            action: AuditAction.UPDATE,
            field: 'repairItems',
            newValue: `İşlem eklendi: ${itemType} (${price} TL)`,
            changedById: session.user.id,
        },
    });

    revalidatePath(`/tickets/${ticketId}`);
    revalidatePath('/service');
    return {
        ...updated,
        repairPrice: Number(updated.repairPrice),
        totalAmount: Number(updated.totalAmount),
        paidAmount: Number(updated.paidAmount),
        repairItems: items,
    };
}
