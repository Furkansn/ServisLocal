'use server';

import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';

export async function getPersonnel() {
    return prisma.personnel.findMany({
        include: { roles: true },
        orderBy: { name: 'asc' },
    });
}

export async function getPersonnelByRole(role: Role) {
    return prisma.personnel.findMany({
        where: {
            isActive: true,
            roles: { some: { role } },
        },
        orderBy: { name: 'asc' },
    });
}

export async function createPersonnel(data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    roles: string[];
}) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const existing = await prisma.personnel.findUnique({ where: { email: data.email } });
    if (existing) throw new Error('Bu e-posta adresi zaten kullanılıyor');

    const passwordHash = await bcrypt.hash(data.password, 12);

    return prisma.personnel.create({
        data: {
            name: data.name,
            email: data.email,
            passwordHash,
            phone: data.phone || null,
            roles: {
                create: data.roles.map((role) => ({ role: role as Role })),
            },
        },
        include: { roles: true },
    });
}

export async function updatePersonnelRoles(personnelId: string, roles: string[]) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    // Delete existing roles and create new ones
    await prisma.personnelRole.deleteMany({ where: { personnelId } });

    await prisma.personnelRole.createMany({
        data: roles.map((role) => ({
            personnelId,
            role: role as Role,
        })),
    });

    return prisma.personnel.findUnique({
        where: { id: personnelId },
        include: { roles: true },
    });
}

export async function updatePersonnel(
    id: string,
    data: {
        name: string;
        email: string;
        phone?: string;
        password?: string;
        isActive: boolean;
        roles: string[];
    }
) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const existing = await prisma.personnel.findUnique({ where: { email: data.email } });
    if (existing && existing.id !== id) throw new Error('Bu e-posta adresi başka bir personel tarafından kullanılıyor');

    const updateData: any = {
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        isActive: data.isActive,
    };

    if (data.password && data.password.trim() !== '') {
        updateData.passwordHash = await bcrypt.hash(data.password, 12);
    }

    // Delete existing roles and recreate them
    await prisma.personnelRole.deleteMany({ where: { personnelId: id } });

    updateData.roles = {
        create: data.roles.map((role) => ({ role: role as Role })),
    };

    return prisma.personnel.update({
        where: { id },
        data: updateData,
        include: { roles: true },
    });
}

export async function deletePersonnel(id: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const userRoles = (session.user as any)?.roles || [];
    if (!userRoles.includes('OPERATOR')) {
        throw new Error('Personel silme işlemi için Operatör / Servis Müdürü yetkisi gereklidir.');
    }

    if (session.user.id === id) {
        throw new Error('Kendi hesabınızı silemezsiniz.');
    }

    const target = await prisma.personnel.findUnique({
        where: { id },
        include: { roles: true },
    });

    if (!target) {
        throw new Error('Silinmek istenen personel bulunamadı.');
    }

    // Check all related records across the system
    const [
        createdTickets,
        assignedTickets,
        serviceAssignments,
        photos,
        ops,
        accessories,
        receivedPayments,
        approvedPayments,
        expenses,
        settlements,
        transfers,
        statusChanges,
        customerNotes,
        repairerNotes,
        auditLogs,
    ] = await Promise.all([
        prisma.repairTicket.count({ where: { createdById: id } }),
        prisma.repairTicket.count({ where: { assignedTechnicianId: id } }),
        prisma.serviceRecord.count({ where: { assignedPersonnelId: id } }),
        prisma.ticketPhoto.count({ where: { uploadedById: id } }),
        prisma.ticketOperation.count({ where: { performedById: id } }),
        prisma.ticketAccessory.count({ where: { soldById: id } }),
        prisma.payment.count({ where: { receivedById: id } }),
        prisma.payment.count({ where: { approvedById: id } }),
        prisma.expense.count({ where: { createdById: id } }),
        prisma.accountSettlement.count({ where: { performedById: id } }),
        prisma.accountTransfer.count({ where: { performedById: id } }),
        prisma.statusHistory.count({ where: { changedById: id } }),
        prisma.customerNote.count({ where: { personnelId: id } }),
        prisma.repairerNote.count({ where: { personnelId: id } }),
        prisma.auditLog.count({ where: { changedById: id } }),
    ]);

    const totalActivity =
        createdTickets +
        assignedTickets +
        serviceAssignments +
        photos +
        ops +
        accessories +
        receivedPayments +
        approvedPayments +
        expenses +
        settlements +
        transfers +
        statusChanges +
        customerNotes +
        repairerNotes +
        auditLogs;

    if (totalActivity === 0) {
        // No related records, safe to delete completely
        await prisma.personnelRole.deleteMany({ where: { personnelId: id } });
        await prisma.personnel.delete({ where: { id } });
        return {
            deleted: true,
            deactivated: false,
            message: `"${target.name}" adlı personel sistemden tamamen silindi.`,
        };
    } else {
        // Unassign from active pending assignments
        await prisma.repairTicket.updateMany({
            where: { assignedTechnicianId: id, status: { notIn: ['TAMAMLANDI', 'IPTAL', 'IADE'] } },
            data: { assignedTechnicianId: null },
        });

        await prisma.serviceRecord.updateMany({
            where: { assignedPersonnelId: id, status: { in: ['PLANNED', 'ASSIGNED'] } },
            data: { assignedPersonnelId: null, status: 'PLANNED' },
        });

        // Deactivate account
        await prisma.personnel.update({
            where: { id },
            data: {
                isActive: false,
            },
        });

        return {
            deleted: false,
            deactivated: true,
            message: `"${target.name}" adlı personelin geçmişe ait ${totalActivity} adet işlem/kasa kaydı bulunduğu için sistem ve muhasebe geçmişinin korunması adına HESAP PASİFE ALINDI ve tüm sisteme giriş yetkileri sonlandırıldı.`,
        };
    }
}
