'use server';

import prisma from '@/lib/prisma';
import { getUsdTryRate } from '@/lib/currency';
import { ProductCategory } from '@prisma/client';
import { revalidatePath } from 'next/cache';

const SERVISPLUS_SYNC_API_KEY = process.env.SERVISPLUS_SYNC_API_KEY || 'sp_sync_sec_89234fd9a7bc810234a';

const INTEGRATION_CONFIG = {
    COMPANY_A: {
        id: 'cmnke2pjc0000afzny2hgrcy3',
        customerId: 'cmnmxj6z700011no0aczvhwms',
        sourceKey: 'COMPANY_A_LED',
        productGroup: 'LED',
        category: ProductCategory.LED,
        currency: 'TRY',
        title: 'Zero - LED',
    },
    COMPANY_B: {
        id: 'cmki9utiv00004loqppbxrdst',
        customerId: 'cmthkajgy0001tk6j75itqwe2',
        sourceKey: 'COMPANY_B_SCREEN',
        productGroup: 'EKRAN',
        category: ProductCategory.SCREEN,
        currency: 'USD',
        title: 'Zero - Ekran',
    },
};

/**
 * Resolve remote API base URL (checks localhost:3001 first if running, otherwise uses production).
 */
async function getRemoteApiBaseUrl(): Promise<string> {
    if (process.env.SATISINITAKIPET_URL) {
        return process.env.SATISINITAKIPET_URL;
    }
    try {
        const testRes = await fetch('http://localhost:3001/api/servisplus', {
            method: 'HEAD',
            headers: { 'x-api-key': SERVISPLUS_SYNC_API_KEY },
            signal: AbortSignal.timeout(600),
        });
        if (testRes.status !== 404 && testRes.status !== 502) {
            return 'http://localhost:3001';
        }
    } catch {
        // Localhost not available, fall back to production
    }
    return 'https://www.satisinitakipet.com';
}

/**
 * Helper to run promises in parallel with chunk concurrency limit
 */
async function runInChunks<T>(items: T[], chunkSize: number, fn: (item: T) => Promise<any>) {
    for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        await Promise.all(chunk.map(fn));
    }
}

/**
 * Sync LED products from Company A and EKRAN products from Company B.
 * Supports incremental delta sync using `updatedSince` (only fetches products changed since last sync).
 * Pass `{ fullSync: true }` to force a complete re-sync of all products.
 */
export async function syncAllExternalProducts(options?: { fullSync?: boolean }) {
    try {
        const baseUrl = await getRemoteApiBaseUrl();
        const usdRate = await getUsdTryRate();
        const headers = {
            'Content-Type': 'application/json',
            'x-api-key': SERVISPLUS_SYNC_API_KEY,
        };

        // Determine if this is an incremental delta sync
        let updatedSinceParam = '';
        if (!options?.fullSync) {
            const lastSynced = await prisma.product.findFirst({
                where: { externalSource: { not: null }, lastSyncAt: { not: null } },
                orderBy: { lastSyncAt: 'desc' },
                select: { lastSyncAt: true },
            });
            if (lastSynced?.lastSyncAt) {
                // Buffer by 2 minutes to catch any simultaneous updates safely
                const bufferTime = new Date(lastSynced.lastSyncAt.getTime() - 2 * 60 * 1000);
                updatedSinceParam = `&updatedSince=${encodeURIComponent(bufferTime.toISOString())}`;
            }
        }

        // 1. Fetch Company A (LED) and Company B (EKRAN) in parallel
        const [resA, resB] = await Promise.all([
            fetch(
                `${baseUrl}/api/servisplus?companyId=${INTEGRATION_CONFIG.COMPANY_A.id}&productGroup=${INTEGRATION_CONFIG.COMPANY_A.productGroup}${updatedSinceParam}`,
                { headers, cache: 'no-store' }
            ),
            fetch(
                `${baseUrl}/api/servisplus?companyId=${INTEGRATION_CONFIG.COMPANY_B.id}&productGroup=${INTEGRATION_CONFIG.COMPANY_B.productGroup}${updatedSinceParam}`,
                { headers, cache: 'no-store' }
            ),
        ]);

        let productsA: any[] = [];
        if (resA.ok) {
            const dataA = await resA.json();
            productsA = Array.isArray(dataA?.products) ? dataA.products : [];
        }

        let productsB: any[] = [];
        if (resB.ok) {
            const dataB = await resB.json();
            productsB = Array.isArray(dataB?.products) ? dataB.products : [];
        }

        // If incremental sync and no products changed, return immediately in ~20ms
        if (updatedSinceParam && productsA.length === 0 && productsB.length === 0) {
            return {
                success: true,
                isDelta: true,
                updatedCount: 0,
                usdRate,
                lastSyncAt: new Date(),
            };
        }

        // 2. Fetch all existing integrated products in ONE fast query
        const existingProducts = await prisma.product.findMany({
            where: {
                externalCompanyId: {
                    in: [INTEGRATION_CONFIG.COMPANY_A.id, INTEGRATION_CONFIG.COMPANY_B.id],
                },
            },
            select: { id: true, externalId: true, externalCompanyId: true },
        });

        const existingMap = new Map<string, string>(); // `${companyId}:${externalId}` -> product.id
        for (const ep of existingProducts) {
            if (ep.externalId && ep.externalCompanyId) {
                existingMap.set(`${ep.externalCompanyId}:${ep.externalId}`, ep.id);
            }
        }

        const now = new Date();
        let savedCountA = 0;
        let savedCountB = 0;

        // 3. Process Company A (LED - TRY) in concurrent chunks
        await runInChunks(productsA, 25, async (p) => {
            if (!p.id || !p.name) return;
            const price = Number(p.price || 0);
            const cost = p.cost !== null && p.cost !== undefined ? Number(p.cost) : null;
            const stock = Number(p.stock || 0);
            const sku = p.ledCode || p.ledStCode || p.code || null;

            const existingLocalId = existingMap.get(`${INTEGRATION_CONFIG.COMPANY_A.id}:${p.id}`);
            if (existingLocalId) {
                await prisma.product.update({
                    where: { id: existingLocalId },
                    data: {
                        name: p.name,
                        sku,
                        category: ProductCategory.LED,
                        price,
                        cost,
                        stock,
                        originalCurrency: 'TRY',
                        originalPrice: price,
                        originalCost: cost,
                        isActive: true,
                        lastSyncAt: now,
                    },
                });
            } else {
                const created = await prisma.product.create({
                    data: {
                        name: p.name,
                        sku,
                        category: ProductCategory.LED,
                        price,
                        cost,
                        stock,
                        externalId: p.id,
                        externalCompanyId: INTEGRATION_CONFIG.COMPANY_A.id,
                        externalSource: INTEGRATION_CONFIG.COMPANY_A.sourceKey,
                        originalCurrency: 'TRY',
                        originalPrice: price,
                        originalCost: cost,
                        isActive: true,
                        lastSyncAt: now,
                    },
                });
                existingMap.set(`${INTEGRATION_CONFIG.COMPANY_A.id}:${p.id}`, created.id);
            }
            savedCountA++;
        });

        // 4. Process Company B (EKRAN - USD to TRY) in concurrent chunks
        await runInChunks(productsB, 25, async (p) => {
            if (!p.id || !p.name) return;
            const rawUsdPrice = Number(p.usdPrice ?? p.price ?? 0);
            const rawUsdCost = p.usdCost !== null && p.usdCost !== undefined
                ? Number(p.usdCost)
                : (p.cost !== null && p.cost !== undefined ? Number(p.cost) : null);

            const tlPrice = Math.round(rawUsdPrice * usdRate * 100) / 100;
            const tlCost = rawUsdCost !== null ? Math.round(rawUsdCost * usdRate * 100) / 100 : null;
            const stock = Number(p.stock || 0);
            const sku = p.inch ? `${p.inch}"` : (p.code || null);

            const existingLocalId = existingMap.get(`${INTEGRATION_CONFIG.COMPANY_B.id}:${p.id}`);
            if (existingLocalId) {
                await prisma.product.update({
                    where: { id: existingLocalId },
                    data: {
                        name: p.name,
                        sku,
                        category: ProductCategory.SCREEN,
                        price: tlPrice,
                        cost: tlCost,
                        stock,
                        originalCurrency: 'USD',
                        originalPrice: rawUsdPrice,
                        originalCost: rawUsdCost,
                        isActive: true,
                        lastSyncAt: now,
                    },
                });
            } else {
                const created = await prisma.product.create({
                    data: {
                        name: p.name,
                        sku,
                        category: ProductCategory.SCREEN,
                        price: tlPrice,
                        cost: tlCost,
                        stock,
                        externalId: p.id,
                        externalCompanyId: INTEGRATION_CONFIG.COMPANY_B.id,
                        externalSource: INTEGRATION_CONFIG.COMPANY_B.sourceKey,
                        originalCurrency: 'USD',
                        originalPrice: rawUsdPrice,
                        originalCost: rawUsdCost,
                        isActive: true,
                        lastSyncAt: now,
                    },
                });
                existingMap.set(`${INTEGRATION_CONFIG.COMPANY_B.id}:${p.id}`, created.id);
            }
            savedCountB++;
        });

        try {
            revalidatePath('/products');
            revalidatePath('/tickets');
        } catch { }

        return {
            success: true,
            ledCount: savedCountA,
            screenCount: savedCountB,
            totalCount: savedCountA + savedCountB,
            usdRate,
            lastSyncAt: now,
        };
    } catch (err: any) {
        console.error('syncAllExternalProducts error:', err);
        return {
            success: false,
            error: err.message || 'Senkronizasyon sırasında hata oluştu.',
        };
    }
}

/**
 * Call remote SatisiniTakipEt API to create an open-balance sale when an integrated product is used in a ticket.
 */
export async function createRemoteSaleForProduct({
    productId,
    quantity = 1,
    ticketNo,
}: {
    productId: string;
    quantity?: number;
    ticketNo: string;
}): Promise<{ success: boolean; saleId?: string; error?: string }> {
    try {
        const product = await prisma.product.findUnique({ where: { id: productId } });
        if (!product || !product.externalId || !product.externalCompanyId || !product.externalSource) {
            return { success: true }; // Not an integrated product, nothing to do remotely
        }

        const customerId = product.externalSource === INTEGRATION_CONFIG.COMPANY_A.sourceKey
            ? INTEGRATION_CONFIG.COMPANY_A.customerId
            : INTEGRATION_CONFIG.COMPANY_B.customerId;

        const baseUrl = await getRemoteApiBaseUrl();

        const res = await fetch(`${baseUrl}/api/servisplus`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': SERVISPLUS_SYNC_API_KEY,
            },
            body: JSON.stringify({
                action: 'CREATE_SALE',
                companyId: product.externalCompanyId,
                customerId,
                productId: product.externalId,
                quantity,
                notes: `ServisPlus Fiş ${ticketNo} tamirinde kullanıldı`,
            }),
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error('Remote sale creation failed:', res.status, errText);
            return { success: false, error: `Dış sisteme satış kaydı açılamadı (${res.status}): ${errText}` };
        }

        const data = await res.json();
        if (!data?.success) {
            return { success: false, error: data?.error || 'Dış sistem satış kaydını onaylamadı.' };
        }

        return { success: true, saleId: data.saleId };
    } catch (err: any) {
        console.error('createRemoteSaleForProduct exception:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Call remote SatisiniTakipEt API to cancel the sale and return stock when a part is removed.
 */
export async function cancelRemoteSale({
    saleId,
}: {
    saleId?: string | null;
}): Promise<{ success: boolean; error?: string }> {
    if (!saleId) return { success: true };

    try {
        const baseUrl = await getRemoteApiBaseUrl();

        const res = await fetch(`${baseUrl}/api/servisplus`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': SERVISPLUS_SYNC_API_KEY,
            },
            body: JSON.stringify({
                action: 'CANCEL_SALE',
                saleId,
            }),
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error('Remote sale cancellation failed:', res.status, errText);
            return { success: false, error: `Dış sistem satışı iptal edemedi (${res.status}): ${errText}` };
        }

        const data = await res.json();
        return { success: !!data?.success, error: data?.error };
    } catch (err: any) {
        console.error('cancelRemoteSale exception:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Get integration status summary.
 */
export async function getIntegrationSummary() {
    const [ledCount, screenCount, lastSyncProduct] = await Promise.all([
        prisma.product.count({ where: { externalSource: INTEGRATION_CONFIG.COMPANY_A.sourceKey, isActive: true } }),
        prisma.product.count({ where: { externalSource: INTEGRATION_CONFIG.COMPANY_B.sourceKey, isActive: true } }),
        prisma.product.findFirst({
            where: { externalSource: { not: null } },
            orderBy: { lastSyncAt: 'desc' },
            select: { lastSyncAt: true },
        }),
    ]);

    const usdRate = await getUsdTryRate();

    return {
        ledCount,
        screenCount,
        totalCount: ledCount + screenCount,
        lastSyncAt: lastSyncProduct?.lastSyncAt || null,
        usdRate,
    };
}
