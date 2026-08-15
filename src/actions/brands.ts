'use server';

import prisma from '@/lib/prisma';

export async function getBrands(search?: string) {
    const where = search
        ? { name: { contains: search, mode: 'insensitive' as const } }
        : {};

    return prisma.brand.findMany({
        where,
        orderBy: { name: 'asc' },
    });
}

export async function createBrand(name: string) {
    const existing = await prisma.brand.findUnique({ where: { name } });
    if (existing) throw new Error('Bu marka zaten mevcut');

    return prisma.brand.create({ data: { name } });
}
