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
