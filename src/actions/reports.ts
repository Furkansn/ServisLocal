'use server';

import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { TicketStatus } from '@prisma/client';

export interface ReportFilter {
    startDate?: string;
    endDate?: string;
}

// ─── 1. Operational & Jobs Report ────────────────────────
export async function getOperationalReport(filter?: ReportFilter) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const where: any = {};
    if (filter?.startDate || filter?.endDate) {
        where.createdAt = {};
        if (filter.startDate) where.createdAt.gte = new Date(`${filter.startDate}T00:00:00.000Z`);
        if (filter.endDate) where.createdAt.lte = new Date(`${filter.endDate}T23:59:59.999Z`);
    }

    const tickets = await prisma.repairTicket.findMany({
        where,
        include: {
            customer: { select: { id: true, name: true, phone: true } },
            repairer: { select: { id: true, name: true, phone: true } },
            brand: { select: { name: true } },
            assignedTechnician: { select: { id: true, name: true } },
            operations: {
                include: {
                    installedProduct: { select: { id: true, name: true, cost: true, price: true } },
                    performedBy: { select: { id: true, name: true } },
                },
            },
            accessories: true,
            payments: {
                include: {
                    account: { select: { id: true, name: true, type: true } },
                    receivedBy: { select: { id: true, name: true } },
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    const totalTickets = tickets.length;
    const completedTickets = tickets.filter(t => 
        t.status === TicketStatus.TAMIR_TAMAMLANDI || 
        t.status === TicketStatus.TESLIMAT_SERVIS_ISTENDI || 
        t.status === TicketStatus.TESLIM_EDILDI || 
        t.status === TicketStatus.ODEME_BEKLIYOR || 
        t.status === TicketStatus.TAMAMLANDI
    ).length;

    const deliveredTickets = tickets.filter(t => 
        t.status === TicketStatus.TESLIM_EDILDI || 
        t.status === TicketStatus.TAMAMLANDI
    ).length;

    const cancelledTickets = tickets.filter(t => t.status === TicketStatus.IPTAL || t.status === TicketStatus.IADE).length;
    const inProgressTickets = tickets.filter(t => 
        t.status === TicketStatus.TEKNISYENE_VERILDI || 
        t.status === TicketStatus.TEST_EDILIYOR || 
        t.status === TicketStatus.PARCA_BEKLIYOR ||
        t.status === TicketStatus.ATOLYEYE_ALINDI
    ).length;

    const items = tickets.map(t => {
        const partsCost = t.operations.reduce((sum, op) => {
            const cost = op.installedProduct?.cost ? Number(op.installedProduct.cost) : 0;
            return sum + cost;
        }, 0);

        const totalPrice = Number(t.totalAmount || 0);
        const netProfit = totalPrice - partsCost;
        const totalPaid = t.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const remaining = Math.max(0, totalPrice - totalPaid);

        return {
            id: t.id,
            ticketNo: t.ticketNo,
            createdAt: t.createdAt,
            customerName: t.customer?.name || t.repairer?.name || '-',
            customerType: t.customerType,
            customerPhone: t.customer?.phone || t.repairer?.phone || '-',
            device: [t.brand?.name, t.model].filter(Boolean).join(' ') || '-',
            status: t.status,
            technicianName: t.assignedTechnician?.name || t.operations[0]?.performedBy?.name || '-',
            requestType: t.requestType,
            totalPrice,
            partsCost,
            netProfit,
            totalPaid,
            remaining,
        };
    });

    return {
        totalTickets,
        completedTickets,
        deliveredTickets,
        cancelledTickets,
        inProgressTickets,
        items,
    };
}

// ─── 2. Technician Performance & Profitability Report ────
export async function getTechnicianReport(filter?: ReportFilter) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const where: any = {};
    if (filter?.startDate || filter?.endDate) {
        where.createdAt = {};
        if (filter.startDate) where.createdAt.gte = new Date(`${filter.startDate}T00:00:00.000Z`);
        if (filter.endDate) where.createdAt.lte = new Date(`${filter.endDate}T23:59:59.999Z`);
    }

    const tickets = await prisma.repairTicket.findMany({
        where,
        include: {
            assignedTechnician: { select: { id: true, name: true } },
            operations: {
                include: {
                    installedProduct: { select: { id: true, name: true, cost: true } },
                    performedBy: { select: { id: true, name: true } },
                },
            },
            customer: { select: { name: true } },
            repairer: { select: { name: true } },
            brand: { select: { name: true } },
        },
    });

    // Group by technician
    const techMap = new Map<string, {
        technicianId: string;
        technicianName: string;
        totalAssigned: number;
        completedCount: number;
        inProgressCount: number;
        totalRevenue: number;
        totalPartsCost: number;
        netProfitContribution: number;
        ticketDetails: Array<{
            ticketNo: string;
            date: Date;
            device: string;
            customer: string;
            status: string;
            revenue: number;
            cost: number;
            profit: number;
        }>;
    }>();

    for (const t of tickets) {
        // Tech is either operation performer or assigned
        const techId = t.operations[0]?.performedById || t.assignedTechnicianId || 'UNASSIGNED';
        const techName = t.operations[0]?.performedBy?.name || t.assignedTechnician?.name || 'Atanmamış';

        if (!techMap.has(techId)) {
            techMap.set(techId, {
                technicianId: techId,
                technicianName: techName,
                totalAssigned: 0,
                completedCount: 0,
                inProgressCount: 0,
                totalRevenue: 0,
                totalPartsCost: 0,
                netProfitContribution: 0,
                ticketDetails: [],
            });
        }

        const entry = techMap.get(techId)!;
        entry.totalAssigned += 1;

        const isCompleted = ([
            TicketStatus.TAMIR_TAMAMLANDI,
            TicketStatus.TESLIMAT_SERVIS_ISTENDI,
            TicketStatus.TESLIM_EDILDI,
            TicketStatus.ODEME_BEKLIYOR,
            TicketStatus.TAMAMLANDI,
        ] as TicketStatus[]).includes(t.status);

        if (isCompleted) entry.completedCount += 1;
        else if (([TicketStatus.TEKNISYENE_VERILDI, TicketStatus.TEST_EDILIYOR, TicketStatus.PARCA_BEKLIYOR] as TicketStatus[]).includes(t.status)) {
            entry.inProgressCount += 1;
        }

        const partsCost = t.operations.reduce((sum, op) => {
            const cost = op.installedProduct?.cost ? Number(op.installedProduct.cost) : 0;
            return sum + cost;
        }, 0);

        const revenue = Number(t.repairPrice || t.totalAmount || 0);
        const profit = revenue - partsCost;

        entry.totalRevenue += revenue;
        entry.totalPartsCost += partsCost;
        entry.netProfitContribution += profit;

        entry.ticketDetails.push({
            ticketNo: t.ticketNo,
            date: t.createdAt,
            device: [t.brand?.name, t.model].filter(Boolean).join(' ') || '-',
            customer: t.customer?.name || t.repairer?.name || '-',
            status: t.status,
            revenue,
            cost: partsCost,
            profit,
        });
    }

    const technicians = Array.from(techMap.values()).sort((a, b) => b.completedCount - a.completedCount);

    return {
        technicians,
        totalRevenueAll: technicians.reduce((s, t) => s + t.totalRevenue, 0),
        totalPartsCostAll: technicians.reduce((s, t) => s + t.totalPartsCost, 0),
        totalNetProfitAll: technicians.reduce((s, t) => s + t.netProfitContribution, 0),
        totalCompletedAll: technicians.reduce((s, t) => s + t.completedCount, 0),
    };
}

// ─── 3. Detailed Financial & Parts & Profit Report ─────────
export async function getFinancialDetailReport(filter?: ReportFilter) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const where: any = {};
    if (filter?.startDate || filter?.endDate) {
        where.createdAt = {};
        if (filter.startDate) where.createdAt.gte = new Date(`${filter.startDate}T00:00:00.000Z`);
        if (filter.endDate) where.createdAt.lte = new Date(`${filter.endDate}T23:59:59.999Z`);
    }

    const tickets = await prisma.repairTicket.findMany({
        where,
        include: {
            customer: { select: { name: true, phone: true } },
            repairer: { select: { name: true, phone: true } },
            brand: { select: { name: true } },
            operations: {
                include: {
                    installedProduct: { select: { id: true, name: true, sku: true, cost: true, price: true } },
                    performedBy: { select: { name: true } },
                },
            },
            accessories: {
                include: {
                    product: { select: { name: true } },
                },
            },
            payments: {
                include: {
                    account: { select: { name: true, type: true } },
                    receivedBy: { select: { name: true } },
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    const rows = tickets.map(t => {
        // Installed products / parts
        const installedPartsList: string[] = [];
        let totalPartsCost = 0;
        t.operations.forEach(op => {
            const cost = op.installedProduct?.cost ? Number(op.installedProduct.cost) : 0;
            totalPartsCost += cost;
            if (op.installedProduct) {
                installedPartsList.push(`${op.installedProduct.name} (Maliyet: ${cost} ₺)`);
            } else if (op.notes) {
                installedPartsList.push(op.notes);
            }
        });

        // Accessories
        const accessoriesList: string[] = [];
        let totalAccessorySales = 0;
        t.accessories.forEach(acc => {
            const total = Number(acc.totalPrice || 0);
            totalAccessorySales += total;
            accessoriesList.push(`${acc.product?.name || 'Aksesuar'} (${acc.quantity}x ${acc.unitPrice} ₺)`);
        });

        // Payments
        const paymentsCash = t.payments.filter(p => p.method === 'CASH').reduce((s, p) => s + Number(p.amount), 0);
        const paymentsCard = t.payments.filter(p => p.method === 'CREDIT_CARD').reduce((s, p) => s + Number(p.amount), 0);
        const paymentsTransfer = t.payments.filter(p => p.method === 'BANK_TRANSFER').reduce((s, p) => s + Number(p.amount), 0);
        const totalPaid = paymentsCash + paymentsCard + paymentsTransfer;

        const receivers = Array.from(new Set(t.payments.map(p => p.receivedBy?.name).filter(Boolean))).join(', ') || '-';

        const repairSales = Number(t.repairPrice || 0);
        const totalRevenue = Number(t.totalAmount || (repairSales + totalAccessorySales));
        const netProfit = totalRevenue - totalPartsCost;

        return {
            ticketNo: t.ticketNo,
            date: t.createdAt,
            customerName: t.customer?.name || t.repairer?.name || '-',
            customerType: t.customerType === 'REPAIRER' ? 'Tamirci' : 'Müşteri',
            device: [t.brand?.name, t.model].filter(Boolean).join(' ') || '-',
            requestType: t.requestType,
            installedParts: installedPartsList.length > 0 ? installedPartsList.join(' | ') : 'Kullanılmadı',
            totalPartsCost,
            repairSales,
            accessoriesSold: accessoriesList.length > 0 ? accessoriesList.join(' | ') : 'Yok',
            totalAccessorySales,
            paymentsCash,
            paymentsCard,
            paymentsTransfer,
            totalPaid,
            receivers,
            totalRevenue,
            netProfit,
        };
    });

    const grandTotalRevenue = rows.reduce((s, r) => s + r.totalRevenue, 0);
    const grandTotalCost = rows.reduce((s, r) => s + r.totalPartsCost, 0);
    const grandTotalProfit = rows.reduce((s, r) => s + r.netProfit, 0);
    const grandTotalPaid = rows.reduce((s, r) => s + r.totalPaid, 0);

    return {
        rows,
        grandTotalRevenue,
        grandTotalCost,
        grandTotalProfit,
        grandTotalPaid,
    };
}

// ─── 4. Inventory & Stock Valuation Report ───────────────
export async function getInventoryReport() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const products = await prisma.product.findMany({
        orderBy: [
            { category: 'asc' },
            { name: 'asc' },
        ],
    });

    let totalStockCount = 0;
    let totalStockCostValue = 0;
    let totalStockSalesValue = 0;

    const items = products.map(p => {
        const stock = Number(p.stock || 0);
        const cost = Number(p.cost || 0);
        const price = Number(p.price || 0);
        const totalCostVal = stock * cost;
        const totalSalesVal = stock * price;

        totalStockCount += stock;
        totalStockCostValue += totalCostVal;
        totalStockSalesValue += totalSalesVal;

        let sourceLabel = 'Yerel Ürün';
        if (p.externalSource === 'ZERO_LED') sourceLabel = 'Zero - LED';
        else if (p.externalSource === 'ZERO_EKRAN') sourceLabel = 'Zero - Ekran';

        return {
            id: p.id,
            barcode: p.sku || '-',
            name: p.name,
            category: p.category,
            source: sourceLabel,
            stock,
            cost,
            price,
            totalCostVal,
            totalSalesVal,
            isActive: p.isActive,
        };
    });

    return {
        items,
        totalItemsCount: items.length,
        totalStockCount,
        totalStockCostValue,
        totalStockSalesValue,
        potentialProfit: totalStockSalesValue - totalStockCostValue,
    };
}

// ─── 5. Combined Reports Data ─────────────────────────────
export async function getAllReportsCombined(filter?: ReportFilter) {
    const [operational, technician, financial, inventory] = await Promise.all([
        getOperationalReport(filter),
        getTechnicianReport(filter),
        getFinancialDetailReport(filter),
        getInventoryReport(),
    ]);

    return {
        operational,
        technician,
        financial,
        inventory,
    };
}
