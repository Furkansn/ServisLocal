'use server';

import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { TicketStatus, Role } from '@prisma/client';
import { REQUEST_TYPE_LABELS, getLocalDateString } from '@/lib/constants';

function formatTicketOperations(ticket: any): string {
    const rawItems = ticket.repairItems;
    let items: any[] = [];
    if (rawItems) {
        if (typeof rawItems === 'string') {
            try { items = JSON.parse(rawItems); } catch (e) {}
        } else if (Array.isArray(rawItems)) {
            items = rawItems;
        }
    }

    if (items.length > 0) {
        return items.map((i: any) => {
            const label = REQUEST_TYPE_LABELS[i.type as keyof typeof REQUEST_TYPE_LABELS] || i.customType || i.type;
            return label;
        }).join(' + ');
    }

    if (ticket.requestType) {
        return REQUEST_TYPE_LABELS[ticket.requestType as keyof typeof REQUEST_TYPE_LABELS] || ticket.requestType;
    }

    return 'Tamir / Bakım';
}

function formatCompletedOperations(ticket: any): string {
    if (ticket.operations && ticket.operations.length > 0) {
        return ticket.operations.map((op: any) => {
            return op.label || REQUEST_TYPE_LABELS[op.operationType as keyof typeof REQUEST_TYPE_LABELS] || op.notes || op.operationType;
        }).join(' + ');
    }
    return formatTicketOperations(ticket);
}

export async function getTvDisplayData() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const todayStr = getLocalDateString(new Date());
    const todayStart = new Date(`${todayStr}T00:00:00.000+03:00`);
    const todayEnd = new Date(`${todayStr}T23:59:59.999+03:00`);

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

    const COMPLETED_STATUSES = [
        TicketStatus.TAMIR_TAMAMLANDI,
        TicketStatus.TEST_EDILIYOR,
        TicketStatus.PARCA_BEKLIYOR,
        TicketStatus.TESLIMAT_SERVIS_ISTENDI,
        TicketStatus.TESLIM_EDILDI,
        TicketStatus.ODEME_BEKLIYOR,
        TicketStatus.TAMAMLANDI,
    ];

    // 2. Completed / Processed Tickets (GÜNLÜK: where technician entered operations today OR status moved to completed/tested/etc. today)
    const completedTicketsTodayRaw = await prisma.repairTicket.findMany({
        where: {
            OR: [
                // 1) An operation was performed today
                {
                    operations: {
                        some: {
                            createdAt: {
                                gte: todayStart,
                                lte: todayEnd,
                            },
                        },
                    },
                },
                // 2) Status transitioned to completed/tested/etc. today
                {
                    statusHistory: {
                        some: {
                            createdAt: {
                                gte: todayStart,
                                lte: todayEnd,
                            },
                            toStatus: {
                                in: COMPLETED_STATUSES,
                            },
                        },
                    },
                },
                // 3) Or ticket has completed status and was updated today
                {
                    status: {
                        in: COMPLETED_STATUSES,
                    },
                    updatedAt: {
                        gte: todayStart,
                        lte: todayEnd,
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
                take: 5,
            },
        },
        orderBy: [
            { updatedAt: 'desc' },
        ],
    });

    // Format completed tickets and extract today's specific timestamp & technician
    const completedTicketsToday = completedTicketsTodayRaw.map(t => {
        const todayOp = t.operations.find((op: any) => {
            const d = new Date(op.createdAt);
            return d >= todayStart && d <= todayEnd;
        });
        const todayHistory = t.statusHistory.find((h: any) => {
            const d = new Date(h.createdAt);
            return d >= todayStart && d <= todayEnd;
        });
        const completedAt = todayOp?.createdAt || todayHistory?.createdAt || t.operations[0]?.createdAt || t.statusHistory[0]?.createdAt || t.updatedAt;
        const technicianName = todayOp?.performedBy?.name || t.operations[0]?.performedBy?.name || t.assignedTechnician?.name || 'Teknisyen';

        return {
            ...t,
            repairPrice: Number(t.repairPrice),
            totalAmount: Number(t.totalAmount),
            paidAmount: Number(t.paidAmount),
            completedAt,
            technicianName,
            lastOperationLabel: formatCompletedOperations(t),
        };
    });

    // Sort so the latest processed ticket is first
    completedTicketsToday.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

    // 3. Technicians List and their completed counts (GÜNLÜK)
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

    // Count completed repairs per technician TODAY
    const technicianStats = technicians.map(tech => {
        const completedCount = completedTicketsToday.filter(t => {
            const didOpToday = t.operations.some((op: any) => {
                const d = new Date(op.createdAt);
                return d >= todayStart && d <= todayEnd && op.performedById === tech.id;
            });
            if (didOpToday) return true;

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
        operationLabel: formatTicketOperations(t),
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
