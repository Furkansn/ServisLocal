/**
 * Live USD to TRY exchange rate service with in-memory caching and safe fallback.
 */

let cachedRate: { rate: number; timestamp: number } | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes cache
const FALLBACK_USD_TRY = 37.50; // Sensible fallback in case of all network failures

export async function getUsdTryRate(): Promise<number> {
    const now = Date.now();
    if (cachedRate && now - cachedRate.timestamp < CACHE_TTL_MS) {
        return cachedRate.rate;
    }

    try {
        // Primary provider: Frankfurter (ECB rates)
        const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=TRY', {
            next: { revalidate: 900 }
        });
        if (res.ok) {
            const data = await res.json();
            if (data?.rates?.TRY && typeof data.rates.TRY === 'number') {
                const rate = Number(data.rates.TRY);
                cachedRate = { rate, timestamp: now };
                return rate;
            }
        }
    } catch {
        // try secondary provider
    }

    try {
        // Secondary provider: ExchangeRate-API open endpoint
        const res2 = await fetch('https://open.er-api.com/v6/latest/USD', {
            next: { revalidate: 900 }
        });
        if (res2.ok) {
            const data2 = await res2.json();
            if (data2?.rates?.TRY && typeof data2.rates.TRY === 'number') {
                const rate = Number(data2.rates.TRY);
                cachedRate = { rate, timestamp: now };
                return rate;
            }
        }
    } catch {
        // fallback
    }

    if (cachedRate) {
        return cachedRate.rate;
    }

    return FALLBACK_USD_TRY;
}
