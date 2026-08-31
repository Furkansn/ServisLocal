'use server';

import prisma from '@/lib/prisma';
import { getSearchVariants } from '@/lib/search';

export async function getBrands(search?: string) {
    if (!search || !search.trim()) {
        return prisma.brand.findMany({
            orderBy: { name: 'asc' },
        });
    }

    const variants = getSearchVariants(search);
    const where = {
        OR: [
            ...variants.map(v => ({ name: { contains: v, mode: 'insensitive' as const } })),
            ...variants.map(v => ({ name: { contains: v } })),
        ],
    };

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
