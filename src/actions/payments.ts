'use server';

import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { AuditAction, TicketStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';

// ─── Add Payment ─────────────────────────────────────────

export async function addPayment(data: {
    ticketId: string;
    method: string;
    accountId?: string;
    amount: number;
    notes?: string;
}) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');
    const userRoles = (session.user as any)?.roles || [];
    const isManager = userRoles.includes('OPERATOR');

    if (data.amount <= 0) throw new Error('Tutar 0\'dan büyük olmalı');

    const ticket = await prisma.repairTicket.findUnique({ where: { id: data.ticketId } });
    if (!ticket) throw new Error('Fiş bulunamadı');
    if (ticket.status === TicketStatus.TAMAMLANDI && !isManager) {
        throw new Error('Bu fiş tamamlandığı (kapatıldığı) için sadece Servis Müdürü tarafından düzenleme yapılabilir.');
    }
    if (ticket.customerType === 'REPAIRER' && (ticket as any).currency === 'USD') {
        throw new Error('Fiş Dolar ($) cinsindedir. Ödeme alabilmek için lütfen önce fişi güncel kurdan TL tutarına çeviriniz.');
    }

    return prisma.$transaction(async (tx) => {
        const isElectronic = data.method !== 'CASH';
        const payment = await tx.payment.create({
            data: {
                ticketId: data.ticketId,
                method: data.method as any,
                accountId: data.accountId || null,
                amount: data.amount,
                notes: data.notes || null,
                receivedById: session.user.id,
                isApproved: isElectronic,
                approvedAt: isElectronic ? new Date() : null,
                approvedById: isElectronic ? session.user.id : null,
            },
        });

        // Update paid amount
        const newPaidAmount = Number(ticket.paidAmount) + data.amount;
        await tx.repairTicket.update({
            where: { id: data.ticketId },
            data: { paidAmount: newPaidAmount },
        });

        await tx.auditLog.create({
            data: {
                ticketId: data.ticketId,
                entityType: 'Payment',
                entityId: payment.id,
                action: AuditAction.CREATE,
                field: 'amount',
                newValue: `${data.amount} (${data.method})`,
                changedById: session.user.id,
            },
        });

        return {
            ...payment,
            amount: Number(payment.amount),
        };
    });
}

// ─── Close Ticket ────────────────────────────────────────

export async function closeTicket(ticketId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');
    const userRoles = (session.user as any)?.roles || [];
    const isManager = userRoles.includes('OPERATOR');

    const ticket = await prisma.repairTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new Error('Fiş bulunamadı');

    if (ticket.status === TicketStatus.TAMAMLANDI && !isManager) {
        throw new Error('Bu fiş tamamlandığı (kapatıldığı) için sadece Servis Müdürü tarafından düzenleme yapılabilir.');
    }

    const remaining = Number(ticket.totalAmount) - Number(ticket.paidAmount);
    if (remaining > 0) {
        throw new Error('Tahsilat kısmı tamamlanmadan (ödemenin tamamı alınmadan) fiş Tamamlandı durumuna alınamaz.');
    }

    return prisma.$transaction(async (tx) => {
        const updated = await tx.repairTicket.update({
            where: { id: ticketId },
            data: { status: TicketStatus.TAMAMLANDI },
        });

        await tx.statusHistory.create({
            data: {
                ticketId,
                fromStatus: ticket.status,
                toStatus: TicketStatus.TAMAMLANDI,
                changedById: session.user.id,
                notes: 'Ödeme alındı, fiş kapatıldı',
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

// ─── Close Without Payment ───────────────────────────────

export async function closeWithoutPayment(ticketId: string, notes?: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');
    const userRoles = (session.user as any)?.roles || [];
    const isManager = userRoles.includes('OPERATOR');

    const ticket = await prisma.repairTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new Error('Fiş bulunamadı');

    if (ticket.status === TicketStatus.TAMAMLANDI && !isManager) {
        throw new Error('Bu fiş tamamlandığı (kapatıldığı) için sadece Servis Müdürü tarafından düzenleme yapılabilir.');
    }

    const remaining = Number(ticket.totalAmount) - Number(ticket.paidAmount);
    if (remaining > 0) {
        throw new Error('Tahsilat kısmı tamamlanmadan (ödemenin tamamı alınmadan) fiş Tamamlandı durumuna alınamaz.');
    }

    return prisma.$transaction(async (tx) => {
        const updated = await tx.repairTicket.update({
            where: { id: ticketId },
            data: {
                status: TicketStatus.TAMAMLANDI,
                closedWithoutPayment: true,
            },
        });

        await tx.statusHistory.create({
            data: {
                ticketId,
                fromStatus: ticket.status,
                toStatus: TicketStatus.TAMAMLANDI,
                changedById: session.user.id,
                notes: notes || 'Ödeme almadan kapatıldı',
            },
        });

        await tx.auditLog.create({
            data: {
                ticketId,
                entityType: 'RepairTicket',
                entityId: ticketId,
                action: AuditAction.UPDATE,
                field: 'closedWithoutPayment',
                oldValue: 'false',
                newValue: 'true',
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

// ─── Delete Payment ──────────────────────────────────────

export async function deletePayment(paymentId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');
    const userRoles = (session.user as any)?.roles || [];
    const isManager = userRoles.includes('OPERATOR');

    const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: { ticket: true },
    });

    if (!payment) throw new Error('Ödeme kaydı bulunamadı');

    // Rule 1: Approved payments can NEVER be deleted/modified by anyone
    if (payment.isApproved) {
        throw new Error('Servis müdürü tarafından onaylanıp teslim alınan ödemeler silinemez veya düzenlenemez.');
    }

    // Rule 2: After 24 hours, ONLY manager can delete
    const hoursSinceCreation = (new Date().getTime() - new Date(payment.createdAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreation > 24 && !isManager) {
        throw new Error('Ödeme kaydı oluşturulmasının üzerinden 24 saat geçtiği için bu işlem sadece Servis Müdürü tarafından yapılabilir.');
    }

    // Rule 3: Completed tickets can only be modified by manager
    if (payment.ticket.status === TicketStatus.TAMAMLANDI && !isManager) {
        throw new Error('Bu fiş tamamlandığı için ödeme silme işlemi sadece Servis Müdürü tarafından yapılabilir.');
    }

    await prisma.$transaction(async (tx) => {
        await tx.payment.delete({
            where: { id: paymentId },
        });

        const newPaidAmount = Math.max(0, Number(payment.ticket.paidAmount) - Number(payment.amount));
        await tx.repairTicket.update({
            where: { id: payment.ticketId },
            data: { paidAmount: newPaidAmount },
        });

        await tx.auditLog.create({
            data: {
                ticketId: payment.ticketId,
                entityType: 'Payment',
                entityId: paymentId,
                action: AuditAction.DELETE,
                field: 'amount',
                oldValue: `${payment.amount} (${payment.method})`,
                changedById: session.user.id,
            },
        });
    });

    revalidatePath(`/tickets/${payment.ticketId}`);
    revalidatePath('/collections');
    return { success: true };
}
