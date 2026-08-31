import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUsdTryRate } from '@/lib/currency';
import { ProductCategory } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { syncAllExternalProducts } from '@/actions/integration';

const SERVISPLUS_SYNC_API_KEY = process.env.SERVISPLUS_SYNC_API_KEY || 'sp_sync_sec_89234fd9a7bc810234a';

const INTEGRATION_CONFIG = {
    COMPANY_A: {
        id: 'cmnke2pjc0000afzny2hgrcy3',
        sourceKey: 'COMPANY_A_LED',
    },
    COMPANY_B: {
        id: 'cmki9utiv00004loqppbxrdst',
        sourceKey: 'COMPANY_B_SCREEN',
    },
};

function checkAuth(req: NextRequest): boolean {
    const apiKey = req.headers.get('x-api-key');
    return !!apiKey && apiKey === SERVISPLUS_SYNC_API_KEY;
}

/**
 * Webhook endpoint for real-time updates from SatisiniTakipEt.
 * Whenever a product is sold, created, updated or deleted in SatisiniTakipEt,
 * it calls this endpoint to update ServisPlus instantly.
 */
export async function POST(req: NextRequest) {
    if (!checkAuth(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { event, product, action } = body;

        // If a full sync trigger event is sent
        if (action === 'FULL_SYNC' || event === 'FULL_SYNC') {
            const result = await syncAllExternalProducts();
            return NextResponse.json(result);
        }

        // If a single product update/sale event is sent
        if (product && product.id && product.companyId) {
            const now = new Date();

            // 1. Firma A (LED)
            if (product.companyId === INTEGRATION_CONFIG.COMPANY_A.id) {
                const price = Number(product.price || 0);
                const cost = product.cost !== null && product.cost !== undefined ? Number(product.cost) : null;
                const stock = Number(product.stock || 0);
                const sku = product.ledCode || product.ledStCode || product.code || null;
                const isLedGroup = (product.productGroup || '').trim().toUpperCase() === 'LED';
                const isActive = event !== 'PRODUCT_DELETED' && product.isActive !== false && isLedGroup;

                const existing = await prisma.product.findFirst({
                    where: {
                        externalId: product.id,
                        externalCompanyId: INTEGRATION_CONFIG.COMPANY_A.id,
                    },
                });

                if (existing) {
                    await prisma.product.update({
                        where: { id: existing.id },
                        data: {
                            name: product.name,
                            sku,
                            category: ProductCategory.LED,
                            price,
                            cost,
                            stock,
                            originalCurrency: 'TRY',
                            originalPrice: price,
                            originalCost: cost,
                            isActive,
                            lastSyncAt: now,
                        },
                    });
                } else if (isActive) {
                    await prisma.product.create({
                        data: {
                            name: product.name,
                            sku,
                            category: ProductCategory.LED,
                            price,
                            cost,
                            stock,
                            externalId: product.id,
                            externalCompanyId: INTEGRATION_CONFIG.COMPANY_A.id,
                            externalSource: INTEGRATION_CONFIG.COMPANY_A.sourceKey,
                            originalCurrency: 'TRY',
                            originalPrice: price,
                            originalCost: cost,
                            isActive: true,
                            lastSyncAt: now,
                        },
                    });
                }

                try {
                    revalidatePath('/products');
                    revalidatePath('/tickets');
                } catch { }

                return NextResponse.json({ success: true, updated: product.id, source: 'COMPANY_A_LED', isActive });
            }

            // 2. Firma B (EKRAN - USD)
            if (product.companyId === INTEGRATION_CONFIG.COMPANY_B.id) {
                const usdRate = await getUsdTryRate();
                const rawUsdPrice = Number(product.usdPrice ?? product.price ?? 0);
                const rawUsdCost = product.usdCost !== null && product.usdCost !== undefined
                    ? Number(product.usdCost)
                    : (product.cost !== null && product.cost !== undefined ? Number(product.cost) : null);

                const tlPrice = Math.round(rawUsdPrice * usdRate * 100) / 100;
                const tlCost = rawUsdCost !== null ? Math.round(rawUsdCost * usdRate * 100) / 100 : null;
                const stock = Number(product.stock || 0);
                const sku = product.inch ? `${product.inch}"` : (product.code || null);
                const isScreenGroup = (product.productGroup || '').trim().toUpperCase() === 'EKRAN';
                const isActive = event !== 'PRODUCT_DELETED' && product.isActive !== false && isScreenGroup;

                const existing = await prisma.product.findFirst({
                    where: {
                        externalId: product.id,
                        externalCompanyId: INTEGRATION_CONFIG.COMPANY_B.id,
                    },
                });

                if (existing) {
                    await prisma.product.update({
                        where: { id: existing.id },
                        data: {
                            name: product.name,
                            sku,
                            category: ProductCategory.SCREEN,
                            price: tlPrice,
                            cost: tlCost,
                            stock,
                            originalCurrency: 'USD',
                            originalPrice: rawUsdPrice,
                            originalCost: rawUsdCost,
                            isActive,
                            lastSyncAt: now,
                        },
                    });
                } else if (isActive) {
                    await prisma.product.create({
                        data: {
                            name: product.name,
                            sku,
                            category: ProductCategory.SCREEN,
                            price: tlPrice,
                            cost: tlCost,
                            stock,
                            externalId: product.id,
                            externalCompanyId: INTEGRATION_CONFIG.COMPANY_B.id,
                            externalSource: INTEGRATION_CONFIG.COMPANY_B.sourceKey,
                            originalCurrency: 'USD',
                            originalPrice: rawUsdPrice,
                            originalCost: rawUsdCost,
                            isActive: true,
                            lastSyncAt: now,
                        },
                    });
                }

                try {
                    revalidatePath('/products');
                    revalidatePath('/tickets');
                } catch { }

                return NextResponse.json({ success: true, updated: product.id, source: 'COMPANY_B_SCREEN', tlPrice, usdRate });
            }
        }

        return NextResponse.json({ error: 'Unmatched company or missing product payload' }, { status: 400 });
    } catch (err: any) {
        console.error('Webhook error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
