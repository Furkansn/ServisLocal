import { NextRequest, NextResponse } from 'next/server';
import { syncAllExternalProducts } from '@/actions/integration';

/**
 * Nightly Fail-Safe Cron Endpoint (runs at 03:00 every night).
 * Synchronizes all products from SatisiniTakipEt (Zero - LED and Zero - Ekran)
 * to ensure 100% data consistency even if a webhook was temporarily missed.
 */
export async function GET(req: NextRequest) {
    try {
        // Optional verification if CRON_SECRET is configured
        const authHeader = req.headers.get('authorization');
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[CRON] Starting nightly fail-safe product synchronization at 03:00...');
        const result = await syncAllExternalProducts();
        console.log('[CRON] Nightly synchronization completed successfully:', result);

        return NextResponse.json({
            success: true,
            cron: 'NIGHTLY_PRODUCT_SYNC',
            timestamp: new Date().toISOString(),
            result,
        });
    } catch (error: any) {
        console.error('[CRON] Nightly synchronization error:', error);
        return NextResponse.json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
        }, { status: 500 });
    }
}
