import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
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
 * Background worker function to process webhook payloads asynchronously.
 * Runs non-blocking via waitUntil so that the webhook caller receives an immediate 200 OK.
 */
async function processWebhookData(body: any) {
    try {
        const { event, product, action } = body || {};

        // 1. If a full sync trigger event is sent
        if (action === 'FULL_SYNC' || event === 'FULL_SYNC') {
            console.log('[Webhook Background] Starting full external products sync...');
            const result = await syncAllExternalProducts();
            console.log('[Webhook Background] Full sync finished:', result);
            return;
        }

        // 2. If a single product update/sale event is sent
        if (product && product.id && product.companyId) {
            const now = new Date();

            // 2.1. Firma A (LED)
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
                } catch (revalidateErr) {
                    console.warn('[Webhook Background] Revalidation warning:', revalidateErr);
                }

                console.log(`[Webhook Background] Processed Company A product: ${product.id} (Active: ${isActive})`);
                return;
            }

            // 2.2. Firma B (EKRAN - USD)
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
                } catch (revalidateErr) {
                    console.warn('[Webhook Background] Revalidation warning:', revalidateErr);
                }

                console.log(`[Webhook Background] Processed Company B product: ${product.id} (Rate: ${usdRate}, TL Price: ${tlPrice})`);
                return;
            }

            console.warn(`[Webhook Background] Unmatched companyId: ${product.companyId} for product: ${product.id}`);
            return;
        }

        console.warn('[Webhook Background] Unrecognized payload structure:', JSON.stringify(body));
    } catch (err: any) {
        console.error('[Webhook Background] Error processing webhook data:', err);
    }
}

/**
 * Webhook endpoint for real-time updates from SatisiniTakipEt.
 * Responds immediately with 200 OK after basic validation, delegating
 * database synchronization to background execution via waitUntil.
 */
export async function POST(req: NextRequest) {
    if (!checkAuth(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();

        if (!body || typeof body !== 'object') {
            return NextResponse.json({ error: 'Invalid payload structure' }, { status: 400 });
        }

        // Delegate heavy DB / external API work to the background
        waitUntil(processWebhookData(body));

        // Return immediate 200 OK to prevent client timeouts
        return NextResponse.json(
            { success: true, message: 'Webhook alındı' },
            { status: 200 }
        );
    } catch (err: any) {
        console.error('[Webhook Route] Error parsing request body:', err);
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-api-key, Authorization',
        },
    });
}


