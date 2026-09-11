'use server';

import fs from 'fs/promises';
import path from 'path';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { getModelCompatibilitySummary, searchTVModels as searchTVModelsCore } from './compatibility';
import { PriceListData, INITIAL_PRICE_LIST } from '@/lib/price-list-types';
import { setCachedUsdRate } from '@/lib/currency';

const STORAGE_PATH = path.join(process.cwd(), 'src/lib/price-list-data.json');
const TEMPLATE_KEY = 'price_list_v1';

// ─── Get Price List Data ───────────────────────────────────────
export async function getPriceListData(): Promise<PriceListData> {
    // 1. Try Database (Neon PostgreSQL) via receiptTemplate model
    try {
        const dbTemplate = await prisma.receiptTemplate.findUnique({
            where: { format: TEMPLATE_KEY },
        });
        if (dbTemplate && dbTemplate.content) {
            const parsed = typeof dbTemplate.content === 'string'
                ? JSON.parse(dbTemplate.content)
                : dbTemplate.content;
            if (parsed && Array.isArray(parsed.screenItems) && parsed.screenItems.length > 0) {
                return parsed;
            }
        }
    } catch (e) {
        console.warn('DB price-list fetch failed, falling back to JSON file:', e);
    }

    // 2. Try JSON file
    try {
        const data = await fs.readFile(STORAGE_PATH, 'utf-8');
        return JSON.parse(data);
    } catch {
        return INITIAL_PRICE_LIST;
    }
}

// ─── Save Price List Data ──────────────────────────────────────
export async function savePriceListData(data: PriceListData): Promise<{ success: boolean; error?: string }> {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: 'Oturum açmanız gerekiyor.' };
    }
    const userRoles = (session.user as any)?.roles || [];
    if (!userRoles.includes('OPERATOR')) {
        return { success: false, error: 'Bu işlem için yetkiniz yok (Sadece Operatör / Servis Müdürü).' };
    }

    // 1. Save to JSON file as immediate sync
    try {
        await fs.writeFile(STORAGE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
        console.error('Failed to save to local price-list JSON:', err);
    }

    // 2. Save to Database for persistence across instances
    try {
        await prisma.receiptTemplate.upsert({
            where: { format: TEMPLATE_KEY },
            create: {
                format: TEMPLATE_KEY,
                content: data as any,
            },
            update: {
                content: data as any,
            },
        });
    } catch (err) {
        console.error('Failed to persist price-list to database:', err);
    }

    // 3. Sync USD rate to in-memory cache and update catalog USD products
    if (data.usdRate && !isNaN(data.usdRate) && data.usdRate > 0) {
        setCachedUsdRate(data.usdRate);
        try {
            const usdProducts = await prisma.product.findMany({
                where: {
                    originalCurrency: 'USD',
                    originalPrice: { not: null },
                },
                select: { id: true, originalPrice: true, originalCost: true },
            });

            for (const p of usdProducts) {
                const tlPrice = Math.round(Number(p.originalPrice) * data.usdRate * 100) / 100;
                const tlCost = p.originalCost !== null ? Math.round(Number(p.originalCost) * data.usdRate * 100) / 100 : null;
                await prisma.product.update({
                    where: { id: p.id },
                    data: {
                        price: tlPrice,
                        cost: tlCost,
                    },
                });
            }
        } catch (err) {
            console.error('Failed to update catalog USD products:', err);
        }
    }

    revalidatePath('/price-list');
    revalidatePath('/products');
    revalidatePath('/tickets');
    return { success: true };
}

// ─── Fast Autocomplete Search for TV Models ───────────────────
export async function searchTVModels(query: string): Promise<string[]> {
    return await searchTVModelsCore(query);
}

// ─── Fetch Model Compatibility Summary ────────────────────────
export async function getModelSummaryAction(modelName: string) {
    return await getModelCompatibilitySummary(modelName);
}
