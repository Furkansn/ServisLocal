'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function getContactNotes(
    contactId: string,
    type: 'CUSTOMER' | 'REPAIRER',
    ticketId?: string
) {
    if (type === 'CUSTOMER') {
        const whereClause: any = { customerId: contactId };
        if (ticketId) whereClause.ticketId = ticketId;

        return prisma.customerNote.findMany({
            where: whereClause,
            include: {
                personnel: { select: { name: true } },
                ticket: { select: { ticketNo: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    } else {
        const whereClause: any = { repairerId: contactId };
        if (ticketId) whereClause.ticketId = ticketId;

        return prisma.repairerNote.findMany({
            where: whereClause,
            include: {
                personnel: { select: { name: true } },
                ticket: { select: { ticketNo: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
}

export async function getTicketNotes(ticketId: string) {
    const [customerNotes, repairerNotes] = await Promise.all([
        prisma.customerNote.findMany({
            where: { ticketId },
            include: {
                personnel: { select: { name: true } },
                ticket: { select: { ticketNo: true } },
            },
            orderBy: { createdAt: 'desc' },
        }),
        prisma.repairerNote.findMany({
            where: { ticketId },
            include: {
                personnel: { select: { name: true } },
                ticket: { select: { ticketNo: true } },
            },
            orderBy: { createdAt: 'desc' },
        }),
    ]);

    return [...customerNotes, ...repairerNotes].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

export async function addContactNote(
    contactId: string,
    type: 'CUSTOMER' | 'REPAIRER',
    content: string,
    ticketId?: string
) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    if (type === 'CUSTOMER') {
        await prisma.customerNote.create({
            data: {
                customerId: contactId,
                ticketId: ticketId || null,
                personnelId: session.user.id,
                content,
            },
        });
    } else {
        await prisma.repairerNote.create({
            data: {
                repairerId: contactId,
                ticketId: ticketId || null,
                personnelId: session.user.id,
                content,
            },
        });
    }

    revalidatePath('/service');
    revalidatePath('/daily-planning');
    revalidatePath('/tickets');
}
