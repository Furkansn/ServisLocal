'use server';

import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { AccountType, AuditAction } from '@prisma/client';
import { revalidatePath } from 'next/cache';

// Ensure default accounts exist
export async function getAccounts() {
    let accounts = await prisma.account.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
    });

    if (accounts.length === 0) {
        // Seed default accounts
        await prisma.account.createMany({
            data: [
                { name: 'Nakit Kasa 1', type: AccountType.CASH, description: 'Ana Nakit Kasası' },
                { name: 'Havale Hesabı 1 (Garanti)', type: AccountType.BANK_TRANSFER, description: 'Garanti Bankası Şirket Hesabı' },
                { name: 'POS Cihazı 1 (Yapı Kredi)', type: AccountType.CREDIT_CARD, description: 'Atölye POS Terminali' },
            ],
        });
        accounts = await prisma.account.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'asc' },
        });
    }

    return accounts;
}

export async function createAccount(data: {
    name: string;
    type: AccountType;
    description?: string;
}) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');
    const userRoles = (session.user as any)?.roles || [];
    if (!userRoles.includes('OPERATOR')) throw new Error('Bu işlem için Servis Müdürü yetkisi gereklidir.');

    if (!data.name.trim()) throw new Error('Hesap adı boş olamaz.');

    const account = await prisma.account.create({
        data: {
            name: data.name.trim(),
            type: data.type,
            description: data.description?.trim() || null,
        },
    });

    revalidatePath('/collections');
    return account;
}

export async function updateAccount(id: string, data: {
    name: string;
    type?: AccountType;
    description?: string;
    isActive?: boolean;
}) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');
    const userRoles = (session.user as any)?.roles || [];
    if (!userRoles.includes('OPERATOR')) throw new Error('Bu işlem için Servis Müdürü yetkisi gereklidir.');

    const account = await prisma.account.update({
        where: { id },
        data: {
            name: data.name.trim(),
            ...(data.type && { type: data.type }),
            description: data.description !== undefined ? (data.description ? data.description.trim() : null) : undefined,
            isActive: data.isActive !== undefined ? data.isActive : undefined,
        },
    });

    revalidatePath('/collections');
    return account;
}

export async function deleteAccount(id: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');
    const userRoles = (session.user as any)?.roles || [];
    if (!userRoles.includes('OPERATOR')) throw new Error('Bu işlem için Servis Müdürü yetkisi gereklidir.');

    const paymentCount = await prisma.payment.count({ where: { accountId: id } });
    const expenseCount = await prisma.expense.count({ where: { accountId: id } });
    const settlementCount = await prisma.accountSettlement.count({ where: { accountId: id } });

    if (paymentCount > 0 || expenseCount > 0 || settlementCount > 0) {
        await prisma.account.update({
            where: { id },
            data: { isActive: false },
        });
        revalidatePath('/collections');
        return { deleted: false, deactivated: true };
    } else {
        await prisma.account.delete({
            where: { id },
        });
        revalidatePath('/collections');
        return { deleted: true, deactivated: false };
    }
}

export async function getCollectionsData(year: number, month: number, accountId?: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const accounts = await getAccounts();

    // Where clause for payments in this date range
    const paymentWhere: any = {
        createdAt: {
            gte: startDate,
            lte: endDate,
        },
    };
    if (accountId && accountId !== 'ALL') {
        paymentWhere.accountId = accountId;
    }

    const payments = await prisma.payment.findMany({
        where: paymentWhere,
        include: {
            ticket: {
                select: {
                    id: true,
                    ticketNo: true,
                    requestType: true,
                    model: true,
                    brand: { select: { name: true } },
                    operations: {
                        select: {
                            operationType: true,
                        },
                    },
                    customer: { select: { name: true, phone: true } },
                    repairer: { select: { name: true, phone: true } },
                },
            },
            account: { select: { id: true, name: true, type: true } },
            receivedBy: { select: { id: true, name: true } },
            approvedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
    });

    // Expenses in date range
    const expenseWhere: any = {
        createdAt: {
            gte: startDate,
            lte: endDate,
        },
    };
    if (accountId && accountId !== 'ALL') {
        expenseWhere.accountId = accountId;
    }

    const expenses = await prisma.expense.findMany({
        where: expenseWhere,
        include: {
            account: { select: { id: true, name: true, type: true } },
            createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
    });

    // Account Settlements in date range
    const settlementWhere: any = {
        createdAt: {
            gte: startDate,
            lte: endDate,
        },
    };
    if (accountId && accountId !== 'ALL') {
        settlementWhere.accountId = accountId;
    }

    const settlements = await prisma.accountSettlement.findMany({
        where: settlementWhere,
        include: {
            account: { select: { id: true, name: true, type: true } },
            performedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
    });

    // Account Transfers in date range
    const transferWhere: any = {
        createdAt: {
            gte: startDate,
            lte: endDate,
        },
    };
    if (accountId && accountId !== 'ALL') {
        transferWhere.OR = [
            { fromAccountId: accountId },
            { toAccountId: accountId },
        ];
    }

    const transfers = await prisma.accountTransfer.findMany({
        where: transferWhere,
        include: {
            fromAccount: { select: { id: true, name: true, type: true } },
            toAccount: { select: { id: true, name: true, type: true } },
            performedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
    });

    // Compute Account Balances & Summaries
    const accountSummaries = accounts.map(acc => {
        const accPayments = payments.filter(p => p.accountId === acc.id || (!p.accountId && acc.type === 'CASH'));
        const accApprovedPayments = accPayments.filter(p => p.isApproved);
        const accPendingPayments = accPayments.filter(p => !p.isApproved);
        const accExpenses = expenses.filter(e => e.accountId === acc.id);
        const accSettlements = settlements.filter(s => s.accountId === acc.id);
        const accTransfersOut = transfers.filter(t => t.fromAccountId === acc.id);
        const accTransfersIn = transfers.filter(t => t.toAccountId === acc.id);

        const totalCollected = accPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        const totalApproved = accApprovedPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        const totalPending = accPendingPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        const totalExpenses = accExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
        const totalSettled = accSettlements.reduce((sum, s) => sum + Number(s.amount), 0);
        const totalTransfersOut = accTransfersOut.reduce((sum, t) => sum + Number(t.amount), 0);
        const totalTransfersIn = accTransfersIn.reduce((sum, t) => sum + Number(t.amount), 0);
        const currentBalance = totalCollected + totalTransfersIn - totalExpenses - totalSettled - totalTransfersOut;

        return {
            account: acc,
            totalCollected,
            totalApproved,
            totalPending,
            totalExpenses,
            totalSettled,
            totalTransfersOut,
            totalTransfersIn,
            currentBalance,
        };
    });

    return {
        accounts,
        accountSummaries,
        payments: payments.map(p => ({
            ...p,
            amount: Number(p.amount),
        })),
        expenses: expenses.map(e => ({
            ...e,
            amount: Number(e.amount),
        })),
        settlements: settlements.map(s => ({
            ...s,
            amount: Number(s.amount),
        })),
        transfers: transfers.map(t => ({
            ...t,
            amount: Number(t.amount),
        })),
    };
}

export async function getCollectionsExportData(options: {
    year?: number;
    month?: number;
    accountId?: string;
    allTime?: boolean;
}) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const accounts = await getAccounts();
    const { year, month, accountId, allTime } = options;

    let dateFilter: any = {};
    if (!allTime) {
        if (year && month && month >= 1 && month <= 12) {
            const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
            const endDate = new Date(year, month, 0, 23, 59, 59, 999);
            dateFilter = {
                gte: startDate,
                lte: endDate,
            };
        } else if (year) {
            const startDate = new Date(year, 0, 1, 0, 0, 0, 0);
            const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
            dateFilter = {
                gte: startDate,
                lte: endDate,
            };
        }
    }

    // Payments filter
    const paymentWhere: any = {};
    if (Object.keys(dateFilter).length > 0) {
        paymentWhere.createdAt = dateFilter;
    }
    if (accountId && accountId !== 'ALL') {
        paymentWhere.accountId = accountId;
    }

    const payments = await prisma.payment.findMany({
        where: paymentWhere,
        include: {
            ticket: {
                select: {
                    id: true,
                    ticketNo: true,
                    requestType: true,
                    model: true,
                    serialNo: true,
                    brand: { select: { name: true } },
                    operations: {
                        select: {
                            operationType: true,
                        },
                    },
                    customer: { select: { name: true, phone: true } },
                    repairer: { select: { name: true, phone: true } },
                },
            },
            account: { select: { id: true, name: true, type: true } },
            receivedBy: { select: { id: true, name: true } },
            approvedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
    });

    // Expenses filter
    const expenseWhere: any = {};
    if (Object.keys(dateFilter).length > 0) {
        expenseWhere.createdAt = dateFilter;
    }
    if (accountId && accountId !== 'ALL') {
        expenseWhere.accountId = accountId;
    }

    const expenses = await prisma.expense.findMany({
        where: expenseWhere,
        include: {
            account: { select: { id: true, name: true, type: true } },
            createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
    });

    // Settlements filter
    const settlementWhere: any = {};
    if (Object.keys(dateFilter).length > 0) {
        settlementWhere.createdAt = dateFilter;
    }
    if (accountId && accountId !== 'ALL') {
        settlementWhere.accountId = accountId;
    }

    const settlements = await prisma.accountSettlement.findMany({
        where: settlementWhere,
        include: {
            account: { select: { id: true, name: true, type: true } },
            performedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
    });

    // Transfers filter
    const transferWhere: any = {};
    if (Object.keys(dateFilter).length > 0) {
        transferWhere.createdAt = dateFilter;
    }
    if (accountId && accountId !== 'ALL') {
        transferWhere.OR = [
            { fromAccountId: accountId },
            { toAccountId: accountId },
        ];
    }

    const transfers = await prisma.accountTransfer.findMany({
        where: transferWhere,
        include: {
            fromAccount: { select: { id: true, name: true, type: true } },
            toAccount: { select: { id: true, name: true, type: true } },
            performedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
    });

    // Compute Account Balances
    const accountSummaries = accounts.map(acc => {
        const accPayments = payments.filter(p => p.accountId === acc.id || (!p.accountId && acc.type === 'CASH'));
        const accApprovedPayments = accPayments.filter(p => p.isApproved);
        const accPendingPayments = accPayments.filter(p => !p.isApproved);
        const accExpenses = expenses.filter(e => e.accountId === acc.id);
        const accSettlements = settlements.filter(s => s.accountId === acc.id);
        const accTransfersOut = transfers.filter(t => t.fromAccountId === acc.id);
        const accTransfersIn = transfers.filter(t => t.toAccountId === acc.id);

        const totalCollected = accPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        const totalApproved = accApprovedPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        const totalPending = accPendingPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        const totalExpenses = accExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
        const totalSettled = accSettlements.reduce((sum, s) => sum + Number(s.amount), 0);
        const totalTransfersOut = accTransfersOut.reduce((sum, t) => sum + Number(t.amount), 0);
        const totalTransfersIn = accTransfersIn.reduce((sum, t) => sum + Number(t.amount), 0);
        const currentBalance = totalCollected + totalTransfersIn - totalExpenses - totalSettled - totalTransfersOut;

        return {
            account: acc,
            totalCollected,
            totalApproved,
            totalPending,
            totalExpenses,
            totalSettled,
            totalTransfersOut,
            totalTransfersIn,
            currentBalance,
        };
    });

    return {
        accounts,
        accountSummaries,
        payments: payments.map(p => ({
            ...p,
            amount: Number(p.amount),
        })),
        expenses: expenses.map(e => ({
            ...e,
            amount: Number(e.amount),
        })),
        settlements: settlements.map(s => ({
            ...s,
            amount: Number(s.amount),
        })),
        transfers: transfers.map(t => ({
            ...t,
            amount: Number(t.amount),
        })),
    };
}

export async function approvePayment(paymentId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');
    const userRoles = (session.user as any)?.roles || [];
    if (!userRoles.includes('OPERATOR')) {
        throw new Error('Tahsilat onaylama yetkisi sadece Servis Müdürü\'ne aittir.');
    }

    const updated = await prisma.payment.update({
        where: { id: paymentId },
        data: {
            isApproved: true,
            approvedAt: new Date(),
            approvedById: session.user.id,
        },
    });

    revalidatePath('/collections');
    return {
        ...updated,
        amount: Number(updated.amount),
    };
}

export async function unapprovePayment(paymentId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');
    const userRoles = (session.user as any)?.roles || [];
    if (!userRoles.includes('OPERATOR')) {
        throw new Error('Bu işlem sadece Servis Müdürü tarafından yapılabilir.');
    }

    const updated = await prisma.payment.update({
        where: { id: paymentId },
        data: {
            isApproved: false,
            approvedAt: null,
            approvedById: null,
        },
    });

    revalidatePath('/collections');
    return {
        ...updated,
        amount: Number(updated.amount),
    };
}

export async function updatePaymentAccount(paymentId: string, targetAccountId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: { account: true },
    });

    if (!payment) throw new Error('Ödeme kaydı bulunamadı');

    const targetAccount = await prisma.account.findUnique({ where: { id: targetAccountId } });
    if (!targetAccount) throw new Error('Hedef hesap bulunamadı');

    const updated = await prisma.payment.update({
        where: { id: paymentId },
        data: {
            accountId: targetAccountId,
        },
    });

    await prisma.auditLog.create({
        data: {
            ticketId: payment.ticketId,
            entityType: 'Payment',
            entityId: paymentId,
            action: AuditAction.UPDATE,
            field: 'accountId',
            oldValue: payment.account?.name || payment.method,
            newValue: targetAccount.name,
            changedById: session.user.id,
        },
    });

    revalidatePath('/collections');
    revalidatePath(`/tickets/${payment.ticketId}`);
    return {
        ...updated,
        amount: Number(updated.amount),
    };
}

export async function createAccountTransfer(data: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    notes?: string;
}) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    if (!data.fromAccountId || !data.toAccountId) {
        throw new Error('Kaynak ve hedef hesaplar seçilmelidir.');
    }
    if (data.fromAccountId === data.toAccountId) {
        throw new Error('Kaynak ve hedef hesap aynı olamaz.');
    }
    if (data.amount <= 0) {
        throw new Error('Transfer tutarı 0\'dan büyük olmalıdır.');
    }

    const transfer = await prisma.accountTransfer.create({
        data: {
            fromAccountId: data.fromAccountId,
            toAccountId: data.toAccountId,
            amount: data.amount,
            performedById: session.user.id,
            notes: data.notes?.trim() || 'Hesaplar Arası Virman / Transfer',
        },
        include: {
            fromAccount: { select: { name: true } },
            toAccount: { select: { name: true } },
        },
    });

    await prisma.auditLog.create({
        data: {
            entityType: 'AccountTransfer',
            entityId: transfer.id,
            action: AuditAction.CREATE,
            field: 'amount',
            newValue: `${data.amount} (${transfer.fromAccount.name} -> ${transfer.toAccount.name})`,
            changedById: session.user.id,
        },
    });

    revalidatePath('/collections');
    return {
        ...transfer,
        amount: Number(transfer.amount),
    };
}

export async function addExpense(data: {
    title: string;
    amount: number;
    accountId: string;
    category?: string;
    notes?: string;
}) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');

    if (!data.title.trim()) throw new Error('Gider başlığı girilmelidir.');
    if (data.amount <= 0) throw new Error('Tutar 0\'dan büyük olmalıdır.');
    if (!data.accountId) throw new Error('Ödemenin yapıldığı kasa/hesap seçilmelidir.');

    const expense = await prisma.expense.create({
        data: {
            title: data.title.trim(),
            amount: data.amount,
            category: data.category?.trim() || 'Genel Gider',
            accountId: data.accountId,
            createdById: session.user.id,
            notes: data.notes?.trim() || null,
        },
    });

    revalidatePath('/collections');
    return {
        ...expense,
        amount: Number(expense.amount),
    };
}

export async function resetAccountBalance(data: {
    accountId: string;
    amount: number;
    notes?: string;
}) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Yetkisiz işlem');
    const userRoles = (session.user as any)?.roles || [];
    if (!userRoles.includes('OPERATOR')) {
        throw new Error('Kasa sıfırlama / teslim alma yetkisi sadece Servis Müdürü\'ne aittir.');
    }

    if (data.amount <= 0) throw new Error('Sıfırlanacak tutar 0\'dan büyük olmalıdır.');

    const settlement = await prisma.accountSettlement.create({
        data: {
            accountId: data.accountId,
            amount: data.amount,
            performedById: session.user.id,
            notes: data.notes?.trim() || 'Kasa Sıfırlama / Paranın Alınması',
        },
    });

    revalidatePath('/collections');
    return {
        ...settlement,
        amount: Number(settlement.amount),
    };
}
