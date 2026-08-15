'use server';

import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { TicketStatus, Role } from '@prisma/client';
import { getLocalDateString } from '@/lib/constants';

export async function getTvDisplayData() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const todayStr = getLocalDateString(new Date());

    // 1. Waiting Tickets: ONLY TEKNISYENE_VERILDI status AND no operations logged yet by technician
    const waitingTicketsRaw = await prisma.repairTicket.findMany({
        where: {
            status: TicketStatus.TEKNISYENE_VERILDI,
            operations: {
                none: {}, // Must not have any logged operations yet
            },
        },
        include: {
            customer: { select: { id: true, name: true } },
            repairer: { select: { id: true, name: true } },
            brand: { select: { name: true } },
            assignedTechnician: { select: { id: true, name: true } },
        },
        orderBy: [
            { priority: 'desc' },
            { createdAt: 'asc' },
        ],
    });

    // 2. Completed / Processed Tickets (where technician entered operations OR status is beyond TEKNISYENE_VERILDI)
    const completedTicketsTodayRaw = await prisma.repairTicket.findMany({
        where: {
            OR: [
                { operations: { some: {} } },
                {
                    status: {
                        in: [
                            TicketStatus.TAMIR_TAMAMLANDI,
                            TicketStatus.TEST_EDILIYOR,
                            TicketStatus.PARCA_BEKLIYOR,
                            TicketStatus.TESLIMAT_SERVIS_ISTENDI,
                            TicketStatus.TESLIM_EDILDI,
                            TicketStatus.ODEME_BEKLIYOR,
                            TicketStatus.TAMAMLANDI,
                        ],
                    },
                },
            ],
        },
        include: {
            customer: { select: { id: true, name: true } },
            repairer: { select: { id: true, name: true } },
            brand: { select: { name: true } },
            assignedTechnician: { select: { id: true, name: true } },
            operations: {
                include: { performedBy: { select: { id: true, name: true } } },
                orderBy: { createdAt: 'desc' },
            },
            statusHistory: {
                orderBy: { createdAt: 'desc' },
                take: 1,
            },
        },
        orderBy: [
            { updatedAt: 'desc' },
        ],
    });

    // 3. Technicians List and their completed counts
    const technicians = await prisma.personnel.findMany({
        where: {
            roles: {
                some: {
                    role: Role.TECHNICIAN,
                },
            },
            isActive: true,
        },
        select: {
            id: true,
            name: true,
        },
    });

    // Count completed repairs per technician
    const technicianStats = technicians.map(tech => {
        const completedCount = completedTicketsTodayRaw.filter(t => {
            const assignedId = t.assignedTechnicianId;
            const opPerformedById = t.operations[0]?.performedById;
            return assignedId === tech.id || opPerformedById === tech.id;
        }).length;

        return {
            id: tech.id,
            name: tech.name,
            completedCount,
        };
    });

    // Counts for waiting tickets breakdown
    const waitingCustomerCount = waitingTicketsRaw.filter(t => t.customerType === 'INDIVIDUAL' || !!t.customerId).length;
    const waitingRepairerCount = waitingTicketsRaw.filter(t => t.customerType === 'REPAIRER' || !!t.repairerId).length;

    const waitingTickets = waitingTicketsRaw.map(t => ({
        ...t,
        repairPrice: Number(t.repairPrice),
        totalAmount: Number(t.totalAmount),
        paidAmount: Number(t.paidAmount),
    }));

    const completedTicketsToday = completedTicketsTodayRaw.map(t => ({
        ...t,
        repairPrice: Number(t.repairPrice),
        totalAmount: Number(t.totalAmount),
        paidAmount: Number(t.paidAmount),
        completedAt: t.operations[0]?.createdAt || t.statusHistory[0]?.createdAt || t.updatedAt,
        technicianName: t.operations[0]?.performedBy?.name || t.assignedTechnician?.name || 'Teknisyen',
        lastOperationLabel: (t.operations[0] as any)?.label || t.requestType || 'Yapılan İşlem',
    }));

    return {
        todayDateStr: todayStr,
        waitingTickets,
        completedTicketsToday,
        todayCompletedCount: completedTicketsToday.length,
        waitingCount: waitingTickets.length,
        waitingCustomerCount,
        waitingRepairerCount,
        technicianStats,
    };
}
