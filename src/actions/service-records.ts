'use server';

import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { AuditAction, TicketStatus, ServiceRecordStatus } from '@prisma/client';
import { getLocalDateString } from '@/lib/constants';
import { revalidatePath } from 'next/cache';

// ─── Helper: Auto Reschedule Stale Records ────────────────
async function autoRescheduleStaleRecords() {
    const todayStr = getLocalDateString(new Date());
    const targetDate = new Date(`${todayStr}T00:00:00.000Z`);

    // Find records in the past that are not completed/cancelled
    const staleRecords = await prisma.serviceRecord.findMany({
        where: {
            scheduledDate: { lt: targetDate },
            status: { notIn: [ServiceRecordStatus.COMPLETED, ServiceRecordStatus.CANCELLED] },
        },
    });

    if (staleRecords.length === 0) return;

    // Update them to today
    await prisma.serviceRecord.updateMany({
        where: {
            id: { in: staleRecords.map(r => r.id) },
        },
        data: {
            scheduledDate: targetDate,
            postponedDate: new Date(), // Optional: mark as postponed
        },
    });
}

// ─── Create Service Record ────────────────────────────────

export async function createServiceRecord(data: {
    ticketId: string;
    type: 'PICKUP' | 'DELIVERY';
    scheduledDate: string;
    assignedPersonnelId?: string;
    notes?: string;
}) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const status = data.assignedPersonnelId ? ServiceRecordStatus.ASSIGNED : ServiceRecordStatus.PLANNED;

    const record = await prisma.serviceRecord.create({
        data: {
            ticketId: data.ticketId,
            type: data.type,
            scheduledDate: new Date(`${data.scheduledDate}T00:00:00.000Z`),
            assignedPersonnelId: data.assignedPersonnelId || null,
            status,
            notes: data.notes?.trim() || null,
        },
    });

    // If a PICKUP service record is created and ticket is in initial status (YENI_KAYIT), automatically transition status to SERVIS_ISTENDI
    if (data.type === 'PICKUP') {
        const ticket = await prisma.repairTicket.findUnique({ where: { id: data.ticketId } });
        if (ticket && ticket.status === TicketStatus.YENI_KAYIT) {
            await prisma.repairTicket.update({
                where: { id: data.ticketId },
                data: { status: TicketStatus.SERVIS_ISTENDI },
            });

            await prisma.statusHistory.create({
                data: {
                    ticketId: data.ticketId,
                    fromStatus: ticket.status,
                    toStatus: TicketStatus.SERVIS_ISTENDI,
                    changedById: session.user.id,
                    notes: 'Servis teslim alma talebi oluşturulduğu için otomatik olarak SERVIS_ISTENDI durumuna güncellendi.',
                },
            });
        }
    }

    // If a DELIVERY service record is created, automatically transition status to TESLIMAT_SERVIS_ISTENDI
    if (data.type === 'DELIVERY') {
        const ticket = await prisma.repairTicket.findUnique({ where: { id: data.ticketId } });
        if (ticket && ticket.status !== TicketStatus.TESLIMAT_SERVIS_ISTENDI && ticket.status !== TicketStatus.TESLIM_EDILDI) {
            await prisma.repairTicket.update({
                where: { id: data.ticketId },
                data: { status: TicketStatus.TESLIMAT_SERVIS_ISTENDI },
            });

            await prisma.statusHistory.create({
                data: {
                    ticketId: data.ticketId,
                    fromStatus: ticket.status,
                    toStatus: TicketStatus.TESLIMAT_SERVIS_ISTENDI,
                    changedById: session.user.id,
                    notes: 'Teslimat servisi talebi oluşturulduğu için otomatik olarak TESLIMAT_SERVIS_ISTENDI durumuna güncellendi.',
                },
            });
        }
    }

    revalidatePath('/daily-planning');
    revalidatePath(`/tickets/${data.ticketId}`);
    return record;
}

// ─── Get Service Records for a Date ──────────────────────

export async function getDailyServiceRecords(date?: string) {
    // Run auto-reschedule before fetching
    await autoRescheduleStaleRecords();

    const dateStr = date || getLocalDateString(new Date());
    const targetDate = new Date(`${dateStr}T00:00:00.000Z`);

    const records = await prisma.serviceRecord.findMany({
        where: {
            scheduledDate: targetDate,
        },
        include: {
            ticket: {
                include: {
                    customer: {
                        select: { id: true, name: true, phone: true, address: true, city: true, district: true, _count: { select: { notes: true } } }
                    },
                    repairer: {
                        select: { id: true, name: true, phone: true, address: true, city: true, district: true, _count: { select: { notes: true } } }
                    },
                    brand: { select: { name: true } },
                    accessories: { include: { product: { select: { name: true } }, soldBy: { select: { name: true } } } },
                    operations: { include: { performedBy: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
                    statusHistory: { include: { changedBy: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
                },
            },
            assignedPersonnel: { select: { id: true, name: true } },
        },
    });

    return (records as any[])
        .sort((a, b) => {
            if (a.status === 'COMPLETED' && b.status !== 'COMPLETED') return 1;
            if (a.status !== 'COMPLETED' && b.status === 'COMPLETED') return -1;
            return (a.sortOrder || 0) - (b.sortOrder || 0);
        })
        .map(r => ({
            ...r,
            ticket: {
                ...r.ticket,
                repairPrice: Number(r.ticket.repairPrice),
                totalAmount: Number(r.ticket.totalAmount),
                paidAmount: Number(r.ticket.paidAmount),
                accessories: (r.ticket.accessories || []).map((acc: any) => ({
                    ...acc,
                    unitPrice: Number(acc.unitPrice || 0),
                    totalPrice: Number(acc.totalPrice || 0),
                })),
            },
        }));
}

// ─── Get My Work Orders (Service Personnel) ─────────────

export async function getMyWorkOrders() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    // Run auto-reschedule before fetching
    await autoRescheduleStaleRecords();

    const todayStr = getLocalDateString(new Date());
    const targetDate = new Date(`${todayStr}T00:00:00.000Z`);

    const records = await prisma.serviceRecord.findMany({
        where: {
            assignedPersonnelId: session.user.id,
            scheduledDate: targetDate,
            status: { notIn: ['CANCELLED'] },
        },
        include: {
            ticket: {
                include: {
                    customer: {
                        include: { _count: { select: { notes: true } } }
                    },
                    repairer: {
                        include: { _count: { select: { notes: true } } }
                    },
                    brand: { select: { name: true } },
                    accessories: { include: { product: { select: { name: true } }, soldBy: { select: { name: true } } } },
                    operations: { include: { performedBy: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
                    statusHistory: { include: { changedBy: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
                },
            },
        },
    });

    return (records as any[])
        .sort((a, b) => {
            if (a.status === 'COMPLETED' && b.status !== 'COMPLETED') return 1;
            if (a.status !== 'COMPLETED' && b.status === 'COMPLETED') return -1;
            return (a.sortOrder || 0) - (b.sortOrder || 0);
        })
        .map(r => ({
            ...r,
            ticket: {
                ...r.ticket,
                repairPrice: Number(r.ticket.repairPrice),
                totalAmount: Number(r.ticket.totalAmount),
                paidAmount: Number(r.ticket.paidAmount),
                accessories: (r.ticket.accessories || []).map((acc: any) => ({
                    ...acc,
                    unitPrice: Number(acc.unitPrice || 0),
                    totalPrice: Number(acc.totalPrice || 0),
                })),
            },
        }));
}

// ─── Assign Service Personnel ────────────────────────────

export async function assignServicePersonnel(recordId: string, personnelId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    return prisma.serviceRecord.update({
        where: { id: recordId },
        data: {
            assignedPersonnelId: personnelId,
            status: 'ASSIGNED',
        },
    });
}

// ─── Reschedule Service Record ───────────────────────────

export async function rescheduleServiceRecord(recordId: string, newDate: string, notes?: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const scheduledDate = new Date(`${newDate}T00:00:00.000Z`);

    const record = await prisma.serviceRecord.update({
        where: { id: recordId },
        data: {
            scheduledDate,
            status: 'PLANNED',
            assignedPersonnelId: null,
            postponedDate: new Date(),
            notes: notes || undefined,
        },
        include: { ticket: true },
    });

    if (notes) {
        await prisma.ticketOperation.create({
            data: {
                ticketId: record.ticketId,
                operationType: 'OTHER',
                notes: `[ERTELEME] ${notes}`,
                performedById: session.user.id,
            },
        });
    }

    return record;
}

// ─── Complete Pickup ─────────────────────────────────────

export async function completePickup(recordId: string, notes?: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const record = await prisma.serviceRecord.findUnique({
        where: { id: recordId },
        include: { ticket: true },
    });
    if (!record) throw new Error('Servis kaydı bulunamadı');

    // Check minimum 2 photos
    const photoCount = await prisma.ticketPhoto.count({
        where: { serviceRecordId: recordId },
    });
    if (photoCount < 2) {
        throw new Error('En az 2 fotoğraf yüklemelisiniz (kırık cihaz + barkod)');
    }

    return prisma.$transaction(async (tx) => {
        await tx.serviceRecord.update({
            where: { id: recordId },
            data: {
                status: 'COMPLETED',
                completedAt: new Date(),
                notes,
            },
        });

        await tx.repairTicket.update({
            where: { id: record.ticketId },
            data: { status: TicketStatus.TESLIM_ALINDI },
        });

        await tx.statusHistory.create({
            data: {
                ticketId: record.ticketId,
                fromStatus: record.ticket.status,
                toStatus: TicketStatus.TESLIM_ALINDI,
                changedById: session.user.id,
                notes: 'Servis personeli teslim aldı',
            },
        });

        return { success: true };
    });
}

// ─── Postpone Service ────────────────────────────────────

export async function postponeService(recordId: string, newDate?: string, notes?: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const record = await prisma.serviceRecord.findUnique({
        where: { id: recordId },
        include: { ticket: true },
    });
    if (!record) throw new Error('Servis kaydı bulunamadı');

    return prisma.$transaction(async (tx) => {
        await tx.serviceRecord.update({
            where: { id: recordId },
            data: {
                status: 'POSTPONED',
                postponedDate: newDate ? new Date(newDate) : null,
                notes,
            },
        });

        await tx.repairTicket.update({
            where: { id: record.ticketId },
            data: { status: TicketStatus.ERTELENDI },
        });

        await tx.statusHistory.create({
            data: {
                ticketId: record.ticketId,
                fromStatus: record.ticket.status,
                toStatus: TicketStatus.ERTELENDI,
                changedById: session.user.id,
                notes: notes || 'Servis personeli erteledi',
            },
        });

        if (notes) {
            await tx.ticketOperation.create({
                data: {
                    ticketId: record.ticketId,
                    operationType: 'OTHER',
                    notes: `[ERTELEME] ${notes}`,
                    performedById: session.user.id,
                },
            });
        }

        return { success: true };
    });
}

// ─── Cancel Service ──────────────────────────────────────

export async function cancelService(recordId: string, notes?: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const record = await prisma.serviceRecord.findUnique({
        where: { id: recordId },
        include: { ticket: true },
    });
    if (!record) throw new Error('Servis kaydı bulunamadı');

    return prisma.$transaction(async (tx) => {
        await tx.serviceRecord.update({
            where: { id: recordId },
            data: {
                status: 'CANCELLED',
                notes,
            },
        });

        await tx.repairTicket.update({
            where: { id: record.ticketId },
            data: { status: TicketStatus.IPTAL },
        });

        await tx.statusHistory.create({
            data: {
                ticketId: record.ticketId,
                fromStatus: record.ticket.status,
                toStatus: TicketStatus.IPTAL,
                changedById: session.user.id,
                notes: notes || 'İptal edildi',
            },
        });

        return { success: true };
    });
}

// ─── Complete Delivery ───────────────────────────────────

export async function completeDelivery(recordId: string, notes?: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const record = await prisma.serviceRecord.findUnique({
        where: { id: recordId },
        include: { ticket: true },
    });
    if (!record) throw new Error('Servis kaydı bulunamadı');

    // Check minimum 1 photo for delivery
    const photoCount = await prisma.ticketPhoto.count({
        where: { serviceRecordId: recordId },
    });
    if (photoCount < 1) {
        throw new Error('En az 1 fotoğraf yüklemelisiniz (çalışır hali)');
    }

    return prisma.$transaction(async (tx) => {
        await tx.serviceRecord.update({
            where: { id: recordId },
            data: {
                status: 'COMPLETED',
                completedAt: new Date(),
                notes,
            },
        });

        await tx.repairTicket.update({
            where: { id: record.ticketId },
            data: { status: TicketStatus.TESLIM_EDILDI },
        });

        await tx.statusHistory.create({
            data: {
                ticketId: record.ticketId,
                fromStatus: record.ticket.status,
                toStatus: TicketStatus.TESLIM_EDILDI,
                changedById: session.user.id,
                notes: 'Cihaz teslim edildi',
            },
        });

        return { success: true };
    });
}

// ─── End Day ─────────────────────────────────────────────

export async function endDay() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find all completed pickups for today
    const completedPickups = await prisma.serviceRecord.findMany({
        where: {
            assignedPersonnelId: session.user.id,
            type: 'PICKUP',
            status: 'COMPLETED',
            completedAt: {
                gte: today,
                lt: tomorrow,
            },
        },
        include: { ticket: true },
    });

    // Update all picked-up tickets to ATOLYEYE_ALINDI
    for (const record of completedPickups) {
        if (record.ticket.status === TicketStatus.TESLIM_ALINDI) {
            await prisma.$transaction(async (tx) => {
                await tx.repairTicket.update({
                    where: { id: record.ticketId },
                    data: { status: TicketStatus.ATOLYEYE_ALINDI },
                });

                await tx.statusHistory.create({
                    data: {
                        ticketId: record.ticketId,
                        fromStatus: TicketStatus.TESLIM_ALINDI,
                        toStatus: TicketStatus.ATOLYEYE_ALINDI,
                        changedById: session.user.id,
                        notes: 'Gün bitir - Cihaz atölyeye alındı',
                    },
                });
            });
        }
    }

    return { processed: completedPickups.length };
}

// ─── Save Ticket Photo (base64) ──────────────────────────

export async function saveTicketPhoto(data: {
    ticketId: string;
    serviceRecordId?: string;
    type: 'BROKEN_DEVICE' | 'BARCODE' | 'WORKING_DEVICE' | 'OTHER';
    base64: string;
}) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    return prisma.ticketPhoto.create({
        data: {
            ticketId: data.ticketId,
            serviceRecordId: data.serviceRecordId || null,
            type: data.type,
            url: data.base64,
            uploadedById: session.user.id,
        },
    });
}

// ─── Get Service Record Photos ───────────────────────────

export async function getServiceRecordPhotos(serviceRecordId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    return prisma.ticketPhoto.findMany({
        where: { serviceRecordId },
        orderBy: { createdAt: 'asc' },
    });
}

// ─── Reorder Service Records ──────────────────────────────

export async function updateServiceRecordsOrder(orders: { id: string, sortOrder: number }[]) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    console.log('[DEBUG] updateServiceRecordsOrder started', orders.length, 'records');

    try {
        await prisma.$transaction(
            orders.filter(o => !!o.id).map((o) =>
                prisma.serviceRecord.update({
                    where: { id: o.id },
                    data: { sortOrder: o.sortOrder } as any,
                })
            )
        );
        console.log('[DEBUG] updateServiceRecordsOrder success');
        return { success: true };
    } catch (err: any) {
        console.error('[ERROR] updateServiceRecordsOrder failed:', err);
        throw new Error(err.message || 'Sıralama kaydedilemedi');
    }
}

// ─── Delete Service Record ────────────────────────────────

export async function deleteServiceRecord(recordId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const record = await prisma.serviceRecord.findUnique({
        where: { id: recordId },
        include: { ticket: true },
    });
    if (!record) throw new Error('Servis kaydı bulunamadı');

    return prisma.$transaction(async (tx) => {
        // Disconnect photos associated with this service record
        await tx.ticketPhoto.updateMany({
            where: { serviceRecordId: recordId },
            data: { serviceRecordId: null },
        });

        // Delete the service record
        await tx.serviceRecord.delete({
            where: { id: recordId },
        });

        // Create audit log entry
        if (record.ticketId) {
            await tx.auditLog.create({
                data: {
                    ticketId: record.ticketId,
                    entityType: 'ServiceRecord',
                    entityId: recordId,
                    action: AuditAction.DELETE,
                    changedById: session.user.id,
                },
            });
        }

        revalidatePath('/daily-planning');
        if (record.ticketId) {
            revalidatePath(`/tickets/${record.ticketId}`);
        }

        return { success: true };
    });
}

