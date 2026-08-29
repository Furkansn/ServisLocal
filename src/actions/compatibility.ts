'use server';

import { getPrismaClient } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export interface CompatibilityImportRecord {
    legacyTicketNo?: string;
    date?: string;
    technicianName?: string;
    brand?: string;
    model?: string;
    tcon?: string;
    originalScreen?: string;
    installedScreen?: string;
    screenAction?: string;
    installedLed?: string;
    ledAction?: string;
    installedQuantity?: string;
    transactionType?: string;
    notes?: string;
    panelData?: string;
    rowId?: string;
}

function getModel() {
    const db = getPrismaClient() as any;
    if (db.compatibilityRecord) return db.compatibilityRecord;
    if (db.CompatibilityRecord) return db.CompatibilityRecord;
    if (db.compatibility_records) return db.compatibility_records;

    for (const key of Object.keys(db)) {
        if (key.toLowerCase().includes('compatibility')) {
            return db[key];
        }
    }
    return null;
}

// ─── Bulk Import Compatibility Records (Batching) ─────────

export async function importCompatibilityBatch(records: CompatibilityImportRecord[]) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const model = getModel();
    if (!model) {
        throw new Error('Prisma Client yeni modeli henüz belleğe yüklemedi. Lütfen terminal ekranında running dev sunucusunu "Ctrl+C" ile durdurup "npm run dev" yazarak yeniden başlatın.');
    }

    if (!records || records.length === 0) return { count: 0 };

    // Format records for Prisma insertion
    const dataToInsert = records.map(r => ({
        legacyTicketNo: r.legacyTicketNo ? String(r.legacyTicketNo).trim() : null,
        date: r.date ? String(r.date).trim() : null,
        technicianName: r.technicianName ? String(r.technicianName).trim() : null,
        brand: r.brand ? String(r.brand).trim() : null,
        model: r.model ? String(r.model).trim() : null,
        tcon: r.tcon ? String(r.tcon).trim() : null,
        originalScreen: r.originalScreen ? String(r.originalScreen).trim() : null,
        installedScreen: r.installedScreen ? String(r.installedScreen).trim() : null,
        screenAction: r.screenAction ? String(r.screenAction).trim() : null,
        installedLed: r.installedLed ? String(r.installedLed).trim() : null,
        ledAction: r.ledAction ? String(r.ledAction).trim() : null,
        installedQuantity: r.installedQuantity ? String(r.installedQuantity).trim() : null,
        transactionType: r.transactionType ? String(r.transactionType).trim() : null,
        notes: r.notes ? String(r.notes).trim() : null,
        panelData: r.panelData ? String(r.panelData).trim() : null,
        rowId: r.rowId ? String(r.rowId).trim() : null,
    }));

    const result = await model.createMany({
        data: dataToInsert,
        skipDuplicates: true,
    });

    revalidatePath('/ne-takilir');
    revalidatePath('/technician/ne-takilir');

    return { count: result.count };
}

// ─── Search & Get Compatibility Records ──────────────────

export async function searchCompatibilityRecords(options: {
    query?: string;
    brand?: string;
    modelQuery?: string;
    ticketNoQuery?: string;
    tconFilter?: string;
    screenActionFilter?: string;
    page?: number;
    limit?: number;
}) {
    const model = getModel();
    if (!model) return { total: 0, page: 1, totalPages: 0, records: [] };

    const {
        query = '',
        brand = '',
        modelQuery = '',
        ticketNoQuery = '',
        tconFilter = '',
        screenActionFilter = '',
        page = 1,
        limit = 50
    } = options;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (brand && brand !== 'ALL') {
        where.brand = { equals: brand, mode: 'insensitive' };
    }

    if (modelQuery.trim()) {
        where.model = { contains: modelQuery.trim(), mode: 'insensitive' };
    }

    if (ticketNoQuery.trim()) {
        where.legacyTicketNo = { contains: ticketNoQuery.trim(), mode: 'insensitive' };
    }

    if (tconFilter && tconFilter !== 'ALL') {
        where.tcon = { equals: tconFilter, mode: 'insensitive' };
    }

    if (screenActionFilter && screenActionFilter !== 'ALL') {
        where.screenAction = { equals: screenActionFilter, mode: 'insensitive' };
    }

    if (query.trim()) {
        const q = query.trim();
        where.OR = [
            { model: { contains: q, mode: 'insensitive' } },
            { brand: { contains: q, mode: 'insensitive' } },
            { originalScreen: { contains: q, mode: 'insensitive' } },
            { installedScreen: { contains: q, mode: 'insensitive' } },
            { installedLed: { contains: q, mode: 'insensitive' } },
            { screenAction: { contains: q, mode: 'insensitive' } },
            { ledAction: { contains: q, mode: 'insensitive' } },
            { tcon: { contains: q, mode: 'insensitive' } },
            { notes: { contains: q, mode: 'insensitive' } },
            { legacyTicketNo: { contains: q, mode: 'insensitive' } },
            { technicianName: { contains: q, mode: 'insensitive' } },
        ];
    }

    const [total, records] = await Promise.all([
        model.count({ where }),
        model.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        }),
    ]);

    return {
        total,
        page,
        totalPages: Math.ceil(total / limit),
        records,
    };
}

// ─── Get Stats (Brands & Total Records) ───────────────────

export async function getCompatibilityStats() {
    const model = getModel();
    if (!model) return { totalCount: 0, brands: [], screenActions: [] };

    const [totalCount, brandsGroup, actionsGroup] = await Promise.all([
        model.count(),
        model.groupBy({
            by: ['brand'],
            _count: { id: true },
            where: { brand: { not: null } },
            orderBy: { _count: { id: 'desc' } },
            take: 30,
        }),
        model.groupBy({
            by: ['screenAction'],
            _count: { id: true },
            where: { screenAction: { not: null } },
            orderBy: { _count: { id: 'desc' } },
            take: 20,
        }),
    ]);

    return {
        totalCount,
        brands: brandsGroup.map((b: any) => ({ brand: b.brand || 'Bilinmiyor', count: b._count.id })),
        screenActions: actionsGroup.map((a: any) => ({ action: a.screenAction || '-', count: a._count.id })).filter((a: any) => a.action !== '-' && a.action !== 'false' && a.action !== 'true'),
    };
}

// ─── Clear All Records (For Re-importing) ────────────────

export async function clearAllCompatibilityRecords() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');
    const userRoles = (session.user as any)?.roles || [];
    if (!userRoles.includes('OPERATOR')) throw new Error('Bu işlem için Servis Müdürü yetkisi gereklidir.');

    const model = getModel();
    if (!model) throw new Error('Model bulunamadı');

    await model.deleteMany({});

    revalidatePath('/ne-takilir');
    revalidatePath('/technician/ne-takilir');

    return { success: true };
}

// ─── Get Model Specific Summary & History ────────────────

export async function getModelCompatibilitySummary(modelName: string) {
    if (!modelName || !modelName.trim()) {
        return { modelName: '', totalRecords: 0, records: [], originalScreens: [], installedScreens: [], installedLeds: [] };
    }

    const m = modelName.trim();
    const model = getModel();

    const records = model
        ? await model.findMany({
            where: {
                model: { equals: m, mode: 'insensitive' },
            },
            orderBy: { createdAt: 'desc' },
            take: 200,
        })
        : [];

    const normalizeCode = (val: any): string | null => {
        if (!val) return null;
        const str = String(val).trim();
        const lower = str.toLowerCase();
        if (lower === '' || lower === 'false' || lower === 'true' || lower === 'null' || lower === 'undefined' || lower === '-') {
            return null;
        }
        return str;
    };

    // Case-insensitive & trimmed grouping maps
    const origMap: Record<string, { code: string; count: number }> = {};
    const instMap: Record<string, { code: string; count: number; actions: Set<string> }> = {};
    const ledMap: Record<string, { code: string; count: number }> = {};

    records.forEach((r: any) => {
        // Original Screen
        const orig = normalizeCode(r.originalScreen);
        if (orig) {
            const key = orig.toUpperCase();
            if (!origMap[key]) {
                origMap[key] = { code: key, count: 0 };
            }
            origMap[key].count += 1;
        }

        // Installed Screen
        const inst = normalizeCode(r.installedScreen);
        if (inst) {
            const key = inst.toUpperCase();
            if (!instMap[key]) {
                instMap[key] = { code: key, count: 0, actions: new Set() };
            }
            instMap[key].count += 1;

            const action = normalizeCode(r.screenAction);
            if (action) {
                instMap[key].actions.add(action);
            }
        }

        // Installed LED
        const led = normalizeCode(r.installedLed);
        if (led) {
            const key = led.toUpperCase();
            if (!ledMap[key]) {
                ledMap[key] = { code: key, count: 0 };
            }
            ledMap[key].count += 1;
        }
    });

    // Query active products from system database to check stock for installed screens & LEDs
    const sysDb = getPrismaClient();
    const systemProducts = await sysDb.product.findMany({
        where: { isActive: true },
        select: { name: true, stock: true, category: true },
    });

    const getStockForCode = (code: string, category: 'SCREEN' | 'LED') => {
        const cleanCode = code.toLowerCase().trim();
        const cleanAlphanumeric = cleanCode.replace(/[^a-z0-9]/g, '');

        const match = systemProducts.find(p => {
            if (p.category !== category) return false;
            const pName = p.name.toLowerCase().trim();
            const pAlpha = pName.replace(/[^a-z0-9]/g, '');
            return pName === cleanCode || pAlpha === cleanAlphanumeric || pName.includes(cleanCode) || cleanCode.includes(pName);
        });

        if (match) {
            return { inStock: match.stock > 0, stock: match.stock };
        }
        return { inStock: false, stock: 0 };
    };

    const originalScreens = Object.values(origMap)
        .map(item => ({ code: item.code, count: item.count }))
        .sort((a, b) => b.count - a.count);

    const installedScreens = Object.values(instMap)
        .map(item => {
            const stockInfo = getStockForCode(item.code, 'SCREEN');
            return {
                code: item.code,
                count: item.count,
                actions: Array.from(item.actions),
                inStock: stockInfo.inStock,
                stock: stockInfo.stock,
            };
        })
        .sort((a, b) => b.count - a.count);

    const installedLeds = Object.values(ledMap)
        .map(item => {
            const stockInfo = getStockForCode(item.code, 'LED');
            return {
                code: item.code,
                count: item.count,
                inStock: stockInfo.inStock,
                stock: stockInfo.stock,
            };
        })
        .sort((a, b) => b.count - a.count);

    return {
        modelName: m,
        totalRecords: records.length,
        originalScreens,
        installedScreens,
        installedLeds,
        records,
    };
}

// ─── Auto-Sync Live Repair Operations to Compatibility Database ──

export async function syncOperationToCompatibility(operationId: string) {
    const db = getPrismaClient();
    const model = getModel();
    if (!model) return;

    const op = await db.ticketOperation.findUnique({
        where: { id: operationId },
        include: {
            ticket: {
                include: {
                    brand: true,
                    assignedTechnician: true,
                    createdBy: true,
                },
            },
            installedProduct: true,
            performedBy: true,
        },
    });

    if (!op || !op.ticket) return;

    const rowId = `live_op_${op.id}`;
    const dateStr = op.createdAt.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const techName = op.performedBy?.name || op.ticket.assignedTechnician?.name || op.ticket.createdBy?.name || 'Teknisyen';

    let originalScreen: string | null = null;
    let installedScreen: string | null = null;
    let screenAction: string | null = null;
    let installedLed: string | null = null;
    let ledAction: string | null = null;

    if (op.operationType === 'SCREEN_CHANGE') {
        originalScreen = op.removedPart || null;
        installedScreen = op.installedProduct?.name || null;
        screenAction = op.notes || null;
    } else if (op.operationType === 'LED_CHANGE') {
        originalScreen = op.removedPart || null;
        installedLed = op.installedProduct?.name || null;
        ledAction = op.notes || null;
    } else {
        originalScreen = op.removedPart || null;
        if (op.installedProduct) {
            installedScreen = op.installedProduct.name;
        }
        screenAction = op.notes || null;
    }

    const payload = {
        legacyTicketNo: op.ticket.ticketNo,
        date: dateStr,
        technicianName: techName,
        brand: op.ticket.brand.name,
        model: op.ticket.model,
        originalScreen: originalScreen ? originalScreen.toUpperCase().trim() : null,
        installedScreen: installedScreen ? installedScreen.toUpperCase().trim() : null,
        screenAction: screenAction ? screenAction.trim() : null,
        installedLed: installedLed ? installedLed.toUpperCase().trim() : null,
        ledAction: ledAction ? ledAction.trim() : null,
        notes: op.notes || op.ticket.notes || null,
        rowId: rowId,
    };

    const existing = await model.findFirst({ where: { rowId: rowId } });
    if (existing) {
        await model.update({
            where: { id: existing.id },
            data: payload,
        });
    } else {
        await model.create({
            data: payload,
        });
    }

    try {
        revalidatePath('/ne-takilir');
        revalidatePath('/technician/ne-takilir');
    } catch (e) {
        // Ignored when called outside HTTP request context (e.g. CLI scripts)
    }
}

export async function deleteOperationFromCompatibility(operationId: string) {
    const model = getModel();
    if (!model) return;

    const rowId = `live_op_${operationId}`;
    const existing = await model.findFirst({ where: { rowId: rowId } });
    if (existing) {
        await model.delete({ where: { id: existing.id } });
        try {
            revalidatePath('/ne-takilir');
            revalidatePath('/technician/ne-takilir');
        } catch (e) {
            // Ignored outside HTTP request context
        }
    }
}

export async function syncAllExistingRepairsToCompatibility() {
    const db = getPrismaClient();
    const ops = await db.ticketOperation.findMany({
        select: { id: true },
    });

    let count = 0;
    for (const op of ops) {
        await syncOperationToCompatibility(op.id);
        count++;
    }

    return { count };
}
