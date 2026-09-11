'use server';

import fs from 'fs/promises';
import path from 'path';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { getUsdTryRate, setCachedUsdRate } from '@/lib/currency';

const STORAGE_PATH = path.join(process.cwd(), 'src/lib/price-list-data.json');
const TEMPLATE_KEY = 'price_list_v1';

/**
 * Get current system-wide manual USD rate
 */
export async function getSystemUsdRate(): Promise<number> {
    return await getUsdTryRate();
}

/**
 * Update system-wide USD exchange rate across DB, storage, and catalog products
 */
export async function updateSystemUsdRate(newRate: number): Promise<{ success: boolean; rate: number; error?: string }> {
    if (!newRate || isNaN(newRate) || newRate <= 0) {
        return { success: false, rate: 0, error: 'Geçersiz kur değeri.' };
    }

    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, rate: 0, error: 'Oturum açmanız gerekiyor.' };
    }

    const cleanRate = Math.round(newRate * 100) / 100;
    setCachedUsdRate(cleanRate);

    // 1. Update price-list-data.json
    try {
        let existingData: any = {};
        try {
            const raw = await fs.readFile(STORAGE_PATH, 'utf-8');
            existingData = JSON.parse(raw);
        } catch {}

        existingData.usdRate = cleanRate;
        await fs.writeFile(STORAGE_PATH, JSON.stringify(existingData, null, 2), 'utf-8');
    } catch (err) {
        console.error('Failed to write usdRate to local JSON:', err);
    }

    // 2. Update Database ReceiptTemplate for price_list_v1
    try {
        const dbTemplate = await prisma.receiptTemplate.findUnique({
            where: { format: TEMPLATE_KEY },
        });

        if (dbTemplate && dbTemplate.content) {
            const content = typeof dbTemplate.content === 'string'
                ? JSON.parse(dbTemplate.content)
                : dbTemplate.content;
            content.usdRate = cleanRate;
            await prisma.receiptTemplate.update({
                where: { format: TEMPLATE_KEY },
                data: { content },
            });
        } else {
            await prisma.receiptTemplate.create({
                data: {
                    format: TEMPLATE_KEY,
                    content: { usdRate: cleanRate, screenItems: [], ledItems: [] },
                },
            });
        }
    } catch (err) {
        console.error('Failed to write usdRate to DB template:', err);
    }

    // 3. Update existing Company B (USD) products in Product catalog so their TRY price matches new rate
    try {
        const usdProducts = await prisma.product.findMany({
            where: {
                originalCurrency: 'USD',
                originalPrice: { not: null },
            },
            select: { id: true, originalPrice: true, originalCost: true },
        });

        for (const p of usdProducts) {
            const tlPrice = Math.round(Number(p.originalPrice) * cleanRate * 100) / 100;
            const tlCost = p.originalCost !== null ? Math.round(Number(p.originalCost) * cleanRate * 100) / 100 : null;
            await prisma.product.update({
                where: { id: p.id },
                data: {
                    price: tlPrice,
                    cost: tlCost,
                },
            });
        }
    } catch (err) {
        console.error('Failed to update product prices with new USD rate:', err);
    }

    revalidatePath('/products');
    revalidatePath('/price-list');
    revalidatePath('/tickets');

    return { success: true, rate: cleanRate };
}
