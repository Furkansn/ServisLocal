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

    // Group stats
    const origMap: Record<string, number> = {};
    const instMap: Record<string, { count: number; actions: Set<string> }> = {};
    const ledMap: Record<string, number> = {};

    records.forEach((r: any) => {
        if (r.originalScreen && r.originalScreen !== 'false' && r.originalScreen !== 'true' && r.originalScreen !== 'null') {
            origMap[r.originalScreen] = (origMap[r.originalScreen] || 0) + 1;
        }
        if (r.installedScreen && r.installedScreen !== 'false' && r.installedScreen !== 'true' && r.installedScreen !== 'null') {
            if (!instMap[r.installedScreen]) {
                instMap[r.installedScreen] = { count: 0, actions: new Set() };
            }
            instMap[r.installedScreen].count += 1;
            if (r.screenAction && r.screenAction !== 'false' && r.screenAction !== 'true') {
                instMap[r.installedScreen].actions.add(r.screenAction);
            }
        }
        if (r.installedLed && r.installedLed !== 'false' && r.installedLed !== 'true' && r.installedLed !== 'null') {
            ledMap[r.installedLed] = (ledMap[r.installedLed] || 0) + 1;
        }
    });

    const originalScreens = Object.entries(origMap).map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count);
    const installedScreens = Object.entries(instMap).map(([code, data]) => ({
        code,
        count: data.count,
        actions: Array.from(data.actions),
    })).sort((a, b) => b.count - a.count);
    const installedLeds = Object.entries(ledMap).map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count);

    return {
        modelName: m,
        totalRecords: records.length,
        originalScreens,
        installedScreens,
        installedLeds,
        records,
    };
}
