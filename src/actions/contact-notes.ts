'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function getContactNotes(contactId: string, type: 'CUSTOMER' | 'REPAIRER') {
    if (type === 'CUSTOMER') {
        return prisma.customerNote.findMany({
            where: { customerId: contactId },
            include: { personnel: { select: { name: true } } },
            orderBy: { createdAt: 'desc' },
        });
    } else {
        return prisma.repairerNote.findMany({
            where: { repairerId: contactId },
            include: { personnel: { select: { name: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }
}

export async function addContactNote(contactId: string, type: 'CUSTOMER' | 'REPAIRER', content: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    if (type === 'CUSTOMER') {
        await prisma.customerNote.create({
            data: {
                customerId: contactId,
                personnelId: session.user.id,
                content,
            },
        });
    } else {
        await prisma.repairerNote.create({
            data: {
                repairerId: contactId,
                personnelId: session.user.id,
                content,
            },
        });
    }

    revalidatePath('/service');
    revalidatePath('/daily-planning');
}
