import fs from 'fs/promises';
import path from 'path';
import prisma from '@/lib/prisma';

let cachedRate: { rate: number; timestamp: number } | null = null;
const CACHE_TTL_MS = 60 * 1000; // 1 minute in-memory cache
const DEFAULT_USD_RATE = 48.60;
const STORAGE_PATH = path.join(process.cwd(), 'src/lib/price-list-data.json');
const TEMPLATE_KEY = 'price_list_v1';

/**
 * Live USD to TRY exchange rate service.
 * Always returns the user-configured manual exchange rate from the database/storage.
 */
export async function getUsdTryRate(): Promise<number> {
    const now = Date.now();
    if (cachedRate && now - cachedRate.timestamp < CACHE_TTL_MS) {
        return cachedRate.rate;
    }

    // 1. Try reading from database template (price_list_v1)
    try {
        const dbTemplate = await prisma.receiptTemplate.findUnique({
            where: { format: TEMPLATE_KEY },
        });
        if (dbTemplate && dbTemplate.content) {
            const parsed = typeof dbTemplate.content === 'string'
                ? JSON.parse(dbTemplate.content)
                : dbTemplate.content;
            if (parsed && typeof parsed.usdRate === 'number' && parsed.usdRate > 0) {
                cachedRate = { rate: parsed.usdRate, timestamp: now };
                return parsed.usdRate;
            }
        }
    } catch {
        // Fallback to local file
    }

    // 2. Try reading from price-list-data.json
    try {
        const fileData = await fs.readFile(STORAGE_PATH, 'utf-8');
        const parsed = JSON.parse(fileData);
        if (parsed && typeof parsed.usdRate === 'number' && parsed.usdRate > 0) {
            cachedRate = { rate: parsed.usdRate, timestamp: now };
            return parsed.usdRate;
        }
    } catch {
        // Fallback to default
    }

    cachedRate = { rate: DEFAULT_USD_RATE, timestamp: now };
    return DEFAULT_USD_RATE;
}

export function setCachedUsdRate(rate: number) {
    cachedRate = { rate, timestamp: Date.now() };
}

