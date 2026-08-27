'use client';

import { useState, useEffect, useTransition } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
    getCollectionsData,
    getCollectionsExportData,
    approvePayment,
    unapprovePayment,
    addExpense,
    resetAccountBalance,
    createAccount,
    updateAccount,
    deleteAccount,
    createAccountTransfer,
    updatePaymentAccount,
} from '@/actions/collections';
import { AccountType } from '@prisma/client';
import { formatCurrency, formatDateTime, formatDate, REQUEST_TYPE_LABELS } from '@/lib/constants';
import { exportCollectionsToExcel } from '@/lib/exportCollectionsExcel';

const MONTH_NAMES = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

export default function CollectionsPage() {
    const { data: session } = useSession();
    const userRoles = (session?.user as any)?.roles || [];
    const isManager = userRoles.includes('OPERATOR');

    const now = new Date();
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
    const [selectedAccountId, setSelectedAccountId] = useState('ALL');
    const [activeTab, setActiveTab] = useState<'PAYMENTS' | 'EXPENSES' | 'SETTLEMENTS' | 'TRANSFERS'>('PAYMENTS');

    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    // Expense modal state
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [expTitle, setExpTitle] = useState('');
    const [expAmount, setExpAmount] = useState('');
    const [expAccountId, setExpAccountId] = useState('');
    const [expCategory, setExpCategory] = useState('Tedarikçi Ödemesi');
    const [expRecipient, setExpRecipient] = useState('');
    const [expNotes, setExpNotes] = useState('');
    const [expError, setExpError] = useState('');

    // Reset/Settlement modal state
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetAccount, setResetAccount] = useState<any>(null);
    const [resetAmount, setResetAmount] = useState('');
    const [resetNotes, setResetNotes] = useState('');
    const [resetError, setResetError] = useState('');

    // Account Management Modal state
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [accName, setAccName] = useState('');
    const [accType, setAccType] = useState<AccountType>('CASH');
    const [accDesc, setAccDesc] = useState('');
    const [accError, setAccError] = useState('');

    // Edit Account state
    const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editType, setEditType] = useState<AccountType>('CASH');
    const [editDesc, setEditDesc] = useState('');
    const [editActive, setEditActive] = useState(true);

    // Inter-Account Transfer Modal state
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [trFromAccountId, setTrFromAccountId] = useState('');
    const [trToAccountId, setTrToAccountId] = useState('');
    const [trAmount, setTrAmount] = useState('');
    const [trNotes, setTrNotes] = useState('');
    const [trError, setTrError] = useState('');

    // Payment Account Change Modal state
    const [showPayTransferModal, setShowPayTransferModal] = useState(false);
    const [payTransferTargetPayment, setPayTransferTargetPayment] = useState<any>(null);
    const [payTransferTargetAccountId, setPayTransferTargetAccountId] = useState('');
    const [payTransferError, setPayTransferError] = useState('');

    // Excel Export state
    const [showExportModal, setShowExportModal] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [exportScope, setExportScope] = useState<'CURRENT_MONTH' | 'CURRENT_YEAR' | 'ALL_TIME'>('CURRENT_MONTH');
    const [exportAccountId, setExportAccountId] = useState('ALL');

    const loadData = (showSpinner = true) => {
        if (showSpinner) setIsLoading(true);
        startTransition(async () => {
            try {
                const res = await getCollectionsData(selectedYear, selectedMonth, selectedAccountId);
                setData(res);
            } catch (err: any) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        });
    };

    useEffect(() => {
        loadData(true);
    }, [selectedYear, selectedMonth, selectedAccountId]);

    const handleDownloadExcel = async (scope = exportScope, accId = exportAccountId) => {
        setIsExporting(true);
        try {
            let exportDataToUse: any = null;
            let periodLabel = '';
            let accountFilterLabel = 'Tüm Hesaplar';

            if (accId !== 'ALL') {
                const found = data?.accounts?.find((a: any) => a.id === accId);
                if (found) accountFilterLabel = `${found.name} (${found.type})`;
            }

            if (scope === 'CURRENT_MONTH') {
                periodLabel = `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;
                if (data && selectedAccountId === accId) {
                    exportDataToUse = data;
                } else {
                    exportDataToUse = await getCollectionsExportData({
                        year: selectedYear,
                        month: selectedMonth,
                        accountId: accId,
                    });
                }
            } else if (scope === 'CURRENT_YEAR') {
                periodLabel = `${selectedYear} Yılı (Tüm Aylar)`;
                exportDataToUse = await getCollectionsExportData({
                    year: selectedYear,
                    accountId: accId,
                });
            } else {
                periodLabel = 'Tüm Zamanlar (Tüm İşlem Geçmişi)';
                exportDataToUse = await getCollectionsExportData({
                    allTime: true,
                    accountId: accId,
                });
            }

            exportCollectionsToExcel({
                accounts: exportDataToUse.accounts || [],
                accountSummaries: exportDataToUse.accountSummaries || [],
                payments: exportDataToUse.payments || [],
                expenses: exportDataToUse.expenses || [],
                settlements: exportDataToUse.settlements || [],
                transfers: exportDataToUse.transfers || [],
                periodLabel,
                accountFilterLabel,
            });

            setShowExportModal(false);
        } catch (err: any) {
            console.error(err);
            alert('Excel indirilirken bir hata oluştu: ' + (err.message || err));
        } finally {
            setIsExporting(false);
        }
    };

    const handleApprove = async (paymentId: string) => {
        try {
            await approvePayment(paymentId);
            loadData(false);
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleUnapprove = async (paymentId: string) => {
        if (!confirm('Onayı kaldırmak istediğinize emin misiniz?')) return;
        try {
            await unapprovePayment(paymentId);
            loadData(false);
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleAddExpense = async () => {
        setExpError('');
        if (!expTitle) return setExpError('Gider başlığı giriniz');
        const amount = parseFloat(expAmount);
        if (!amount || amount <= 0) return setExpError('Geçerli bir tutar giriniz');
        if (!expAccountId) return setExpError('Kasa/Hesap seçiniz');

        try {
            await addExpense({
                title: expTitle,
                amount,
                accountId: expAccountId,
                category: expCategory,
                recipient: expRecipient,
                notes: expNotes,
            });
            setShowExpenseModal(false);
            setExpTitle('');
            setExpAmount('');
            setExpRecipient('');
            setExpNotes('');
            loadData(false);
        } catch (err: any) {
            setExpError(err.message);
        }
    };

    const handleCreateTransfer = async () => {
        setTrError('');
        if (!trFromAccountId) return setTrError('Kaynak (çıkan) hesabı seçiniz');
        if (!trToAccountId) return setTrError('Hedef (giren) hesabı seçiniz');
        if (trFromAccountId === trToAccountId) return setTrError('Kaynak ve hedef hesap aynı olamaz');
        const amount = parseFloat(trAmount);
        if (!amount || amount <= 0) return setTrError('Geçerli bir transfer tutarı giriniz');

        try {
            await createAccountTransfer({
                fromAccountId: trFromAccountId,
                toAccountId: trToAccountId,
                amount,
                notes: trNotes || 'Hesaplar Arası Virman',
            });
            setShowTransferModal(false);
            setTrFromAccountId('');
            setTrToAccountId('');
            setTrAmount('');
            setTrNotes('');
            loadData(false);
        } catch (err: any) {
            setTrError(err.message);
        }
    };

    const handleOpenPayTransferModal = (payment: any) => {
        setPayTransferTargetPayment(payment);
        setPayTransferTargetAccountId(payment.accountId || '');
        setPayTransferError('');
        setShowPayTransferModal(true);
    };

    const handleTransferPaymentAccount = async () => {
        setPayTransferError('');
        if (!payTransferTargetPayment) return;
        if (!payTransferTargetAccountId) return setPayTransferError('Aktarılacak hedef hesabı seçiniz');

        try {
            await updatePaymentAccount(payTransferTargetPayment.id, payTransferTargetAccountId);
            setShowPayTransferModal(false);
            setPayTransferTargetPayment(null);
            loadData(false);
        } catch (err: any) {
            setPayTransferError(err.message);
        }
    };

    const handleResetBalance = async () => {
        setResetError('');
        if (!resetAccount) return;
        const amount = parseFloat(resetAmount);
        if (!amount || amount <= 0) return setResetError('Geçerli bir sıfırlama tutarı giriniz');

        try {
            await resetAccountBalance({
                accountId: resetAccount.id,
                amount,
                notes: resetNotes || `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear} Kasa Sıfırlama / Teslim Alma`,
            });
            setShowResetModal(false);
            setResetAccount(null);
            setResetAmount('');
            setResetNotes('');
            loadData(false);
        } catch (err: any) {
            setResetError(err.message);
        }
    };

    const handleCreateAccount = async () => {
        setAccError('');
        if (!accName.trim()) return setAccError('Hesap adı giriniz');
        try {
            await createAccount({
                name: accName,
                type: accType,
                description: accDesc,
            });
            setAccName('');
            setAccDesc('');
            loadData(false);
        } catch (err: any) {
            setAccError(err.message);
        }
    };

    const handleStartEditAccount = (acc: any) => {
        setEditingAccountId(acc.id);
        setEditName(acc.name);
        setEditType(acc.type);
        setEditDesc(acc.description || '');
        setEditActive(acc.isActive !== false);
    };

    const handleSaveEditAccount = async (id: string) => {
        setAccError('');
        if (!editName.trim()) return setAccError('Hesap adı giriniz');
        try {
            await updateAccount(id, {
                name: editName,
                type: editType,
                description: editDesc,
                isActive: editActive,
            });
            setEditingAccountId(null);
            loadData(false);
        } catch (err: any) {
            setAccError(err.message);
        }
    };

    const handleDeleteAccount = async (id: string, name: string) => {
        if (!confirm(`"${name}" hesabını silmek veya pasife almak istediğinizden emin misiniz?`)) return;
        setAccError('');
        try {
            const res = await deleteAccount(id);
            if (res.deactivated) {
                alert(`"${name}" hesabına ait geçmiş işlemler bulunduğu için silinemedi, ancak HESAP PASİFE ALINDI.`);
            }
            loadData(false);
        } catch (err: any) {
            setAccError(err.message);
        }
    };

    return (
        <div style={{ padding: 'var(--space-6)', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-6)',
                flexWrap: 'wrap',
                gap: 'var(--space-4)',
            }}>
                <div>
                    <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: 0 }}>
                        💰 Tahsilatlar & Kasa Yönetimi
                    </h1>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
                        Aylık hesap defteri, kasa bakiye takibi, giderler ve müdür onayları
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                            setExportScope('CURRENT_MONTH');
                            setExportAccountId(selectedAccountId);
                            setShowExportModal(true);
                        }}
                        style={{
                            background: '#10b981',
                            borderColor: '#059669',
                            color: '#ffffff',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: 600,
                        }}
                    >
                        📊 Toplu Excel İndir
                    </button>
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setShowExpenseModal(true)}
                    >
                        ➕ Gider / Harcama Ekle
                    </button>
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setShowTransferModal(true)}
                        style={{ border: '1px solid var(--brand-primary)', color: 'var(--brand-primary)' }}
                    >
                        🔄 Hesaplar Arası Virman / Transfer
                    </button>
                    {isManager && (
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setShowAccountModal(true)}
                        >
                            ⚙️ Hesap Tanımları
                        </button>
                    )}
                </div>
            </div>

            {/* Filters Bar: Year, Month, Account Selectors */}
            <div className="card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>Yıl</label>
                        <select
                            className="input"
                            style={{ width: '120px' }}
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        >
                            {[2024, 2025, 2026, 2027].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>Ay</label>
                        <select
                            className="input"
                            style={{ width: '140px' }}
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                        >
                            {MONTH_NAMES.map((m, idx) => (
                                <option key={idx + 1} value={idx + 1}>{m}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>Kasa / Hesap Filtresi</label>
                        <select
                            className="input"
                            style={{ width: '220px' }}
                            value={selectedAccountId}
                            onChange={(e) => setSelectedAccountId(e.target.value)}
                        >
                            <option value="ALL">🌐 Tüm Hesaplar & Kasalar</option>
                            {data?.accounts?.map((acc: any) => (
                                <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ marginLeft: 'auto', textAlign: 'right', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                        <div>
                            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Dönem: </span>
                            <strong style={{ color: 'var(--brand-primary)' }}>{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</strong>
                        </div>
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleDownloadExcel('CURRENT_MONTH', selectedAccountId)}
                            disabled={isExporting || isLoading || !data}
                            title="Görüntülenen ayı anında Excel olarak indir"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                borderColor: '#10b981',
                                color: '#10b981',
                                fontSize: '12px',
                                padding: '4px 10px',
                            }}
                        >
                            {isExporting ? '⏳ İndiriliyor...' : '📥 Bu Ayı İndir (.xlsx)'}
                        </button>
                    </div>
                </div>
            </div>

            {isLoading || !data ? (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto 16px' }} />
                    <div>Kasa ve tahsilat verileri yükleniyor...</div>
                </div>
            ) : (
                <>
                    {/* Account Balance Cards Grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                        gap: 'var(--space-4)',
                        marginBottom: 'var(--space-6)'
                    }}>
                        {data.accountSummaries.map((summary: any) => {
                            const acc = summary.account;
                            const totalCollected = summary.totalCollected;
                            const totalApproved = summary.totalApproved;
                            const totalPending = summary.totalPending;
                            const totalExpenses = summary.totalExpenses;
                            const totalSettled = summary.totalSettled;
                            const totalTransfersIn = summary.totalTransfersIn || 0;
                            const totalTransfersOut = summary.totalTransfersOut || 0;
                            const currentBalance = summary.currentBalance;

                            const isCash = acc.type === 'CASH';

                            return (
                                <div key={acc.id} className="card" style={{
                                    borderLeft: `4px solid ${isCash ? 'var(--color-success)' : 'var(--brand-primary)'}`,
                                    position: 'relative'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: 'var(--font-size-md)' }}>{acc.name}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{acc.description || acc.type}</div>
                                        </div>
                                        {isManager && isCash && (
                                            <button
                                                className="btn btn-ghost btn-xs"
                                                onClick={() => {
                                                    setResetAccount(acc);
                                                    setResetAmount(currentBalance > 0 ? currentBalance.toString() : '');
                                                    setShowResetModal(true);
                                                }}
                                                title="Kasayı Sıfırla / Parayı Teslim Al"
                                                style={{ fontSize: '11px', color: 'var(--brand-primary)' }}
                                            >
                                                🏛️ Kasayı Sıfırla
                                            </button>
                                        )}
                                    </div>

                                    {/* Net Balance */}
                                    <div style={{ margin: 'var(--space-3) 0' }}>
                                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            Kasa Net Bakiye
                                        </div>
                                        <div style={{
                                            fontSize: '24px',
                                            fontWeight: 800,
                                            color: currentBalance >= 0 ? 'var(--color-success)' : 'var(--color-danger)'
                                        }}>
                                            {formatCurrency(currentBalance)}
                                        </div>
                                    </div>

                                    {/* Breakdown details */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1fr',
                                        gap: '6px',
                                        paddingTop: '8px',
                                        borderTop: '1px solid var(--border-primary)',
                                        fontSize: '11px'
                                    }}>
                                        <div>
                                            <span style={{ color: 'var(--text-tertiary)' }}>Tahsilat: </span>
                                            <span style={{ fontWeight: 600 }}>{formatCurrency(totalCollected)}</span>
                                        </div>
                                        <div>
                                            <span style={{ color: 'var(--text-tertiary)' }}>Gider: </span>
                                            <span style={{ fontWeight: 600, color: 'var(--color-danger)' }}>-{formatCurrency(totalExpenses)}</span>
                                        </div>
                                        {totalTransfersIn > 0 && (
                                            <div>
                                                <span style={{ color: 'var(--text-tertiary)' }}>Giren Virman: </span>
                                                <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>+{formatCurrency(totalTransfersIn)}</span>
                                            </div>
                                        )}
                                        {totalTransfersOut > 0 && (
                                            <div>
                                                <span style={{ color: 'var(--text-tertiary)' }}>Çıkan Virman: </span>
                                                <span style={{ fontWeight: 600, color: 'var(--color-danger)' }}>-{formatCurrency(totalTransfersOut)}</span>
                                            </div>
                                        )}
                                        <div>
                                            <span style={{ color: 'var(--text-tertiary)' }}>Onaylı: </span>
                                            <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>{formatCurrency(totalApproved)}</span>
                                        </div>
                                        <div>
                                            <span style={{ color: 'var(--text-tertiary)' }}>Bekleyen: </span>
                                            <span style={{ fontWeight: 600, color: totalPending > 0 ? '#f59e0b' : 'var(--text-tertiary)' }}>{formatCurrency(totalPending)}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Navigation Tabs */}
                    <div className="filter-bar" style={{ marginBottom: 'var(--space-4)' }}>
                        <button
                            className={`filter-pill ${activeTab === 'PAYMENTS' ? 'active' : ''}`}
                            onClick={() => setActiveTab('PAYMENTS')}
                        >
                            📋 Tahsilatlar ({data.payments.length})
                        </button>
                        <button
                            className={`filter-pill ${activeTab === 'EXPENSES' ? 'active' : ''}`}
                            onClick={() => setActiveTab('EXPENSES')}
                        >
                            📉 Giderler & Harcamalar ({data.expenses.length})
                        </button>
                        <button
                            className={`filter-pill ${activeTab === 'TRANSFERS' ? 'active' : ''}`}
                            onClick={() => setActiveTab('TRANSFERS')}
                        >
                            🔄 Virman & Transferler ({data.transfers?.length || 0})
                        </button>
                        <button
                            className={`filter-pill ${activeTab === 'SETTLEMENTS' ? 'active' : ''}`}
                            onClick={() => setActiveTab('SETTLEMENTS')}
                        >
                            🏛️ Kasa Sıfırlama & Çekimler ({data.settlements.length})
                        </button>
                    </div>

                    {/* Tab 1: Payments */}
                    {activeTab === 'PAYMENTS' && (
                        <div>
                            {data.payments.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-state-icon">💰</div>
                                    <div className="empty-state-title">Bu dönemde tahsilat kaydı bulunamadı</div>
                                </div>
                            ) : (
                                <div className="table-container">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Tarih & Saat</th>
                                                <th>Fiş No</th>
                                                <th>Müşteri / Tamirci</th>
                                                <th>Yapılan İşlem / Cihaz</th>
                                                <th>Tahsil Eden</th>
                                                <th>Yöntem / Kasa</th>
                                                <th>Tutar</th>
                                                <th>Müdür Onayı (Zarf / Kasa Kontrol)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.payments.map((p: any) => (
                                                <tr key={p.id} style={{ background: p.isApproved ? 'transparent' : 'rgba(245, 158, 11, 0.05)' }}>
                                                    <td style={{ fontSize: '12px' }}>{formatDateTime(p.createdAt)}</td>
                                                    <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                                                        <Link href={`/tickets/${p.ticket.id}`} style={{ color: 'var(--brand-primary)', textDecoration: 'underline' }}>
                                                            {p.ticket.ticketNo}
                                                        </Link>
                                                    </td>
                                                    <td>
                                                        <div style={{ fontWeight: 500 }}>{p.ticket.customer?.name || p.ticket.repairer?.name || '-'}</div>
                                                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{p.ticket.customer?.phone || p.ticket.repairer?.phone}</div>
                                                    </td>
                                                    <td>
                                                        <div style={{ fontWeight: 600, color: 'var(--brand-primary)', fontSize: '13px' }}>
                                                            🛠️ {REQUEST_TYPE_LABELS[p.ticket.requestType as keyof typeof REQUEST_TYPE_LABELS] || p.ticket.requestType || 'Tamir İşlemi'}
                                                        </div>
                                                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                                            {[p.ticket.brand?.name, p.ticket.model].filter(Boolean).join(' ') || 'Cihaz Bilgisi Yok'}
                                                        </div>
                                                    </td>
                                                    <td>{p.receivedBy.name}</td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <span className="badge badge-info" style={{ fontSize: '11px' }}>
                                                                {p.account?.name || p.method}
                                                            </span>
                                                            <button
                                                                className="btn btn-ghost btn-xs"
                                                                onClick={() => handleOpenPayTransferModal(p)}
                                                                title="Bu Ödemenin Kasasını / Hesabını Değiştir / Aktar"
                                                                style={{ fontSize: '11px', padding: '2px 6px', color: 'var(--brand-primary)' }}
                                                            >
                                                                🔄 Aktar
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td style={{ fontWeight: 700, fontSize: '15px', color: 'var(--color-success)' }}>
                                                        {formatCurrency(p.amount)}
                                                    </td>
                                                    <td>
                                                        {p.method !== 'CASH' ? (
                                                            <span className="badge badge-info" style={{ fontSize: '11px', background: 'rgba(59, 130, 246, 0.12)', color: 'var(--brand-primary)', border: '1px solid rgba(59, 130, 246, 0.3)' }} title="Elektronik banka / POS transferi (Otomatik Onaylı)">
                                                                ⚡ Elektronik (Otomatik Onaylı)
                                                            </span>
                                                        ) : p.isApproved ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <span className="badge badge-success" title={`Onaylayan: ${p.approvedBy?.name || 'Müdür'} (${formatDateTime(p.approvedAt)})`}>
                                                                    ✅ Onaylandı ({p.approvedBy?.name || 'Müdür'})
                                                                </span>
                                                                {isManager && (
                                                                    <button
                                                                        className="btn btn-ghost btn-xs"
                                                                        onClick={() => handleUnapprove(p.id)}
                                                                        title="Onayı Kaldır"
                                                                        style={{ fontSize: '11px', color: 'var(--color-danger)' }}
                                                                    >
                                                                        ✕ İptal
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                {isManager ? (
                                                                    <button
                                                                        className="btn btn-primary btn-xs"
                                                                        onClick={() => handleApprove(p.id)}
                                                                        style={{ background: '#f59e0b', borderColor: '#d97706', color: '#fff' }}
                                                                    >
                                                                        ⏳ Onayla & Kasa/Zarf Al
                                                                    </button>
                                                                ) : (
                                                                    <span className="badge badge-warning" style={{ fontSize: '11px' }}>
                                                                        ⏳ Müdür Onayı Bekliyor
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab 2: Expenses */}
                    {activeTab === 'EXPENSES' && (
                        <div>
                            {data.expenses.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-state-icon">📉</div>
                                    <div className="empty-state-title">Bu dönemde gider kaydı bulunamadı</div>
                                </div>
                            ) : (
                                <div className="table-container">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Tarih & Saat</th>
                                                <th>Gider Başlığı</th>
                                                <th>Kategori</th>
                                                <th>Ödenen Kasa / Hesap</th>
                                                <th>Tutar</th>
                                                <th>Kaydeden</th>
                                                <th>Açıklama</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.expenses.map((e: any) => (
                                                <tr key={e.id}>
                                                    <td style={{ fontSize: '12px' }}>{formatDateTime(e.createdAt)}</td>
                                                    <td style={{ fontWeight: 600 }}>{e.title}</td>
                                                    <td>
                                                        <span className="badge" style={{ fontSize: '11px', background: 'rgba(148, 163, 184, 0.1)' }}>
                                                            {e.category || 'Genel'}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontWeight: 500 }}>{e.account?.name}</td>
                                                    <td style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-danger)' }}>
                                                        -{formatCurrency(e.amount)}
                                                    </td>
                                                    <td>{e.createdBy?.name}</td>
                                                    <td style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{e.notes || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab 3: Account Transfers (Virman) */}
                    {activeTab === 'TRANSFERS' && (
                        <div>
                            {(!data.transfers || data.transfers.length === 0) ? (
                                <div className="empty-state">
                                    <div className="empty-state-icon">🔄</div>
                                    <div className="empty-state-title">Bu dönemde hesaplar arası virman / transfer kaydı bulunamadı</div>
                                </div>
                            ) : (
                                <div className="table-container">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Tarih & Saat</th>
                                                <th>Çıkan Hesap (Kaynak)</th>
                                                <th>Giren Hesap (Hedef)</th>
                                                <th>Transfer Tutarı</th>
                                                <th>İşlemi Yapan Personel</th>
                                                <th>Açıklama</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.transfers.map((t: any) => (
                                                <tr key={t.id}>
                                                    <td style={{ fontSize: '12px' }}>{formatDateTime(t.createdAt)}</td>
                                                    <td style={{ fontWeight: 600, color: 'var(--color-danger)' }}>
                                                        🔴 {t.fromAccount?.name}
                                                    </td>
                                                    <td style={{ fontWeight: 600, color: 'var(--color-success)' }}>
                                                        🟢 {t.toAccount?.name}
                                                    </td>
                                                    <td style={{ fontWeight: 800, fontSize: '15px', color: 'var(--brand-primary)' }}>
                                                        {formatCurrency(t.amount)}
                                                    </td>
                                                    <td>👤 {t.performedBy?.name}</td>
                                                    <td style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{t.notes || 'Virman'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab 4: Settlements */}
                    {activeTab === 'SETTLEMENTS' && (
                        <div>
                            {data.settlements.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-state-icon">🏛️</div>
                                    <div className="empty-state-title">Bu dönemde kasa sıfırlama kaydı bulunamadı</div>
                                </div>
                            ) : (
                                <div className="table-container">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Tarih & Saat</th>
                                                <th>Sıfırlanan Kasa</th>
                                                <th>Teslim Alınan Tutar</th>
                                                <th>Teslim Alan (Servis Müdürü)</th>
                                                <th>Açıklama</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.settlements.map((s: any) => (
                                                <tr key={s.id}>
                                                    <td style={{ fontSize: '12px' }}>{formatDateTime(s.createdAt)}</td>
                                                    <td style={{ fontWeight: 600 }}>{s.account?.name}</td>
                                                    <td style={{ fontWeight: 700, fontSize: '15px', color: 'var(--brand-primary)' }}>
                                                        {formatCurrency(s.amount)}
                                                    </td>
                                                    <td>{s.performedBy?.name}</td>
                                                    <td style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{s.notes || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Modal 1: Add Expense */}
            {showExpenseModal && (
                <div className="modal-overlay" onClick={() => setShowExpenseModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">➕ Yeni Gider / Harcama Ekle</h3>
                            <button className="modal-close" onClick={() => setShowExpenseModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            {expError && (
                                <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)', borderRadius: '6px', marginBottom: '12px', fontSize: '13px' }}>
                                    {expError}
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label">Gider Başlığı / Açıklaması *</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Örn: Öğle Yemeği, Kargo Ücreti, Benzin..."
                                    value={expTitle}
                                    onChange={(e) => setExpTitle(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Tutar (TL) *</label>
                                <input
                                    type="number"
                                    className="input"
                                    placeholder="0.00"
                                    value={expAmount}
                                    onChange={(e) => setExpAmount(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Ödemenin Yapıldığı Kasa / Hesap *</label>
                                <select
                                    className="input"
                                    value={expAccountId}
                                    onChange={(e) => setExpAccountId(e.target.value)}
                                >
                                    <option value="">-- Kasa / Hesap Seçiniz --</option>
                                    {data?.accounts?.map((acc: any) => (
                                        <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Kategori</label>
                                <select
                                    className="input"
                                    value={expCategory}
                                    onChange={(e) => setExpCategory(e.target.value)}
                                >
                                    <option value="Tedarikçi Ödemesi">🏢 Tedarikçi Ödemesi</option>
                                    <option value="Malzeme/Yedek Parça">📦 Parça / Malzeme Alımı</option>
                                    <option value="Dış Servis/Fason">🔧 Dış Servis / Fason Ödemesi</option>
                                    <option value="Yemek">🍔 Yemek & Gıda</option>
                                    <option value="Kargo/Lojistik">📦 Kargo / Lojistik</option>
                                    <option value="Yol/Yakıt">⛽ Yol / Benzin / Ulaşım</option>
                                    <option value="Ofis/Atölye">🏢 Ofis & Atölye Gideri</option>
                                    <option value="Diğer">Diğer</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Alıcı / Tedarikçi Firma Adı (Opsiyonel)</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Örn: Vestel Yetkili Satıcı, Akdeniz Elektronik..."
                                    value={expRecipient}
                                    onChange={(e) => setExpRecipient(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Ek Not</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Opsiyonel detay notu..."
                                    value={expNotes}
                                    onChange={(e) => setExpNotes(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowExpenseModal(false)}>İptal</button>
                            <button className="btn btn-primary" onClick={handleAddExpense}>Gideri Kaydet</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal 2: Inter-Account Transfer (Virman) */}
            {showTransferModal && (
                <div className="modal-overlay" onClick={() => setShowTransferModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">🔄 Hesaplar Arası Virman / Transfer</h3>
                            <button className="modal-close" onClick={() => setShowTransferModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            {trError && (
                                <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)', borderRadius: '6px', marginBottom: '12px', fontSize: '13px' }}>
                                    {trError}
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label">🔴 Paranın Çıkacağı Hesap (Kaynak Kasa) *</label>
                                <select
                                    className="input"
                                    value={trFromAccountId}
                                    onChange={(e) => setTrFromAccountId(e.target.value)}
                                >
                                    <option value="">-- Çıkan Hesap Seç --</option>
                                    {data?.accounts?.map((acc: any) => (
                                        <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">🟢 Paranın Gireceği Hesap (Hedef Kasa) *</label>
                                <select
                                    className="input"
                                    value={trToAccountId}
                                    onChange={(e) => setTrToAccountId(e.target.value)}
                                >
                                    <option value="">-- Giren Hesap Seç --</option>
                                    {data?.accounts?.map((acc: any) => (
                                        <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Transfer Tutarı (TL) *</label>
                                <input
                                    type="number"
                                    className="input"
                                    placeholder="0.00"
                                    value={trAmount}
                                    onChange={(e) => setTrAmount(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Transfer Açıklaması / Notu</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Örn: Havale 1'den Havale 2'ye virman, Kasaya yatırıldı vb."
                                    value={trNotes}
                                    onChange={(e) => setTrNotes(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowTransferModal(false)}>İptal</button>
                            <button className="btn btn-primary" onClick={handleCreateTransfer}>Transferi Gerçekleştir</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal 3: Change Single Payment Account */}
            {showPayTransferModal && payTransferTargetPayment && (
                <div className="modal-overlay" onClick={() => setShowPayTransferModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">🔄 Tahsilat Hesabını Değiştir / Aktar</h3>
                            <button className="modal-close" onClick={() => setShowPayTransferModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            {payTransferError && (
                                <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)', borderRadius: '6px', marginBottom: '12px', fontSize: '13px' }}>
                                    {payTransferError}
                                </div>
                            )}

                            <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
                                <div><strong>Fiş No:</strong> {payTransferTargetPayment.ticket?.ticketNo}</div>
                                <div><strong>Müşteri:</strong> {payTransferTargetPayment.ticket?.customer?.name || payTransferTargetPayment.ticket?.repairer?.name}</div>
                                <div><strong>Tutar:</strong> <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>{formatCurrency(payTransferTargetPayment.amount)}</span></div>
                                <div><strong>Mevcut Hesap:</strong> {payTransferTargetPayment.account?.name || payTransferTargetPayment.method}</div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Aktarılacak Yeni Kasa / Hesap *</label>
                                <select
                                    className="input"
                                    value={payTransferTargetAccountId}
                                    onChange={(e) => setPayTransferTargetAccountId(e.target.value)}
                                >
                                    <option value="">-- Yeni Hesap Seçiniz --</option>
                                    {data?.accounts?.map((acc: any) => (
                                        <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowPayTransferModal(false)}>İptal</button>
                            <button className="btn btn-primary" onClick={handleTransferPaymentAccount}>Hesabı Güncelle / Aktar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal 4: Reset Kasa */}
            {showResetModal && resetAccount && (
                <div className="modal-overlay" onClick={() => setShowResetModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">🏛️ Kasayı Sıfırla / Parayı Teslim Al</h3>
                            <button className="modal-close" onClick={() => setShowResetModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            {resetError && (
                                <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)', borderRadius: '6px', marginBottom: '12px', fontSize: '13px' }}>
                                    {resetError}
                                </div>
                            )}

                            <div style={{ marginBottom: '12px', fontSize: '13px' }}>
                                <strong>Sıfırlanacak Kasa:</strong> {resetAccount.name}
                            </div>

                            <div style={{ padding: '10px 12px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '8px', marginBottom: '12px', fontSize: '12px', color: 'var(--brand-primary)', lineHeight: '1.4' }}>
                                💡 <strong>Kasa Sıfırlama:</strong> Kasadaki tutar teslim alınır ve altındaki tüm alt sayaçlar (Tahsilat, Onaylı, Gider, Bekleyen) yeni dönem için sıfırlanır.
                            </div>

                            <div className="form-group">
                                <label className="form-label">Teslim Alınan Tutar (TL) *</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={resetAmount}
                                    onChange={(e) => setResetAmount(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Açıklama</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={resetNotes}
                                    onChange={(e) => setResetNotes(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowResetModal(false)}>İptal</button>
                            <button className="btn btn-primary" onClick={handleResetBalance}>Parayı Çek & Kasayı Sıfırla</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal 5: Manage Account Definitions */}
            {showAccountModal && (
                <div className="modal-overlay" onClick={() => setShowAccountModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '960px', width: '90vw' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">⚙️ Kasa & Banka Hesap Tanımları</h3>
                            <button className="modal-close" onClick={() => setShowAccountModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            {accError && (
                                <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)', borderRadius: '6px', marginBottom: '12px', fontSize: '13px' }}>
                                    {accError}
                                </div>
                            )}

                            {/* Create New Account Form */}
                            <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: '8px', marginBottom: '20px' }}>
                                <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '10px' }}>➕ Yeni Kasa / Hesap Ekle</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr auto', gap: '8px', alignItems: 'flex-end' }}>
                                    <div>
                                        <label style={{ fontSize: '11px', display: 'block', marginBottom: '2px' }}>Hesap Adı</label>
                                        <input
                                            type="text"
                                            className="input"
                                            placeholder="Örn: Garanti TL Hesabı"
                                            value={accName}
                                            onChange={(e) => setAccName(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', display: 'block', marginBottom: '2px' }}>Tür</label>
                                        <select
                                            className="input"
                                            value={accType}
                                            onChange={(e) => setAccType(e.target.value as AccountType)}
                                        >
                                            <option value="CASH">Nakit Kasa</option>
                                            <option value="BANK_TRANSFER">Banka / Havale</option>
                                            <option value="CREDIT_CARD">POS Terminali</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', display: 'block', marginBottom: '2px' }}>Açıklama</label>
                                        <input
                                            type="text"
                                            className="input"
                                            placeholder="Opsiyonel..."
                                            value={accDesc}
                                            onChange={(e) => setAccDesc(e.target.value)}
                                        />
                                    </div>
                                    <button className="btn btn-primary" onClick={handleCreateAccount} style={{ whiteSpace: 'nowrap' }}>Ekle</button>
                                </div>
                            </div>

                            {/* Accounts List */}
                            <table className="table" style={{ fontSize: '13px' }}>
                                <thead>
                                    <tr>
                                        <th>Hesap Adı</th>
                                        <th>Tür</th>
                                        <th>Açıklama</th>
                                        <th>Durum</th>
                                        <th style={{ textAlign: 'right' }}>İşlem</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data?.accounts?.map((acc: any) => {
                                        const isEditing = editingAccountId === acc.id;
                                        if (isEditing) {
                                            return (
                                                <tr key={acc.id} style={{ background: 'rgba(59, 130, 246, 0.05)' }}>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            className="input"
                                                            value={editName}
                                                            onChange={(e) => setEditName(e.target.value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <select
                                                            className="input"
                                                            value={editType}
                                                            onChange={(e) => setEditType(e.target.value as AccountType)}
                                                        >
                                                            <option value="CASH">Nakit Kasa</option>
                                                            <option value="BANK_TRANSFER">Banka / Havale</option>
                                                            <option value="CREDIT_CARD">POS Terminali</option>
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            className="input"
                                                            value={editDesc}
                                                            onChange={(e) => setEditDesc(e.target.value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <select
                                                            className="input"
                                                            value={editActive ? 'true' : 'false'}
                                                            onChange={(e) => setEditActive(e.target.value === 'true')}
                                                        >
                                                            <option value="true">Aktif</option>
                                                            <option value="false">Pasif</option>
                                                        </select>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <button className="btn btn-primary btn-xs" onClick={() => handleSaveEditAccount(acc.id)} style={{ marginRight: '4px' }}>Kaydet</button>
                                                        <button className="btn btn-secondary btn-xs" onClick={() => setEditingAccountId(null)}>İptal</button>
                                                    </td>
                                                </tr>
                                            );
                                        }

                                        return (
                                            <tr key={acc.id}>
                                                <td style={{ fontWeight: 600 }}>{acc.name}</td>
                                                <td>
                                                    <span className="badge badge-info" style={{ fontSize: '11px' }}>
                                                        {acc.type === 'CASH' ? 'Nakit Kasa' : acc.type === 'BANK_TRANSFER' ? 'Banka / Havale' : 'POS Terminali'}
                                                    </span>
                                                </td>
                                                <td style={{ color: 'var(--text-tertiary)' }}>{acc.description || '-'}</td>
                                                <td>
                                                    {acc.isActive !== false ? (
                                                        <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>● Aktif</span>
                                                    ) : (
                                                        <span style={{ color: 'var(--text-tertiary)' }}>○ Pasif</span>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <button className="btn btn-ghost btn-xs" onClick={() => handleStartEditAccount(acc)} style={{ marginRight: '4px' }}>Düzenle</button>
                                                    <button className="btn btn-ghost btn-xs" onClick={() => handleDeleteAccount(acc.id, acc.name)} style={{ color: 'var(--color-danger)' }}>Sil</button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowAccountModal(false)}>Kapat</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal 6: Bulk Excel Export Modal */}
            {showExportModal && (
                <div className="modal-overlay" onClick={() => !isExporting && setShowExportModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                📊 Toplu Kasa & Tahsilat Excel Raporu İndir
                            </h3>
                            <button className="modal-close" onClick={() => !isExporting && setShowExportModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
                                İndirilecek Excel çalışma kitabında <strong>6 ayrı sayfa (Sheet)</strong> bulunacak ve tüm veriler ayrıntılı, filtreli ve formüllere uygun formatta sunulacaktır.
                            </p>

                            <div className="form-group" style={{ marginBottom: '16px' }}>
                                <label className="form-label" style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}>
                                    📅 Rapor Kapsamı (Dönem Seçimi)
                                </label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '10px 14px',
                                        borderRadius: '8px',
                                        border: `1px solid ${exportScope === 'CURRENT_MONTH' ? 'var(--brand-primary)' : 'var(--border-primary)'}`,
                                        background: exportScope === 'CURRENT_MONTH' ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                                        cursor: 'pointer',
                                    }}>
                                        <input
                                            type="radio"
                                            name="exportScope"
                                            checked={exportScope === 'CURRENT_MONTH'}
                                            onChange={() => setExportScope('CURRENT_MONTH')}
                                        />
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '13px' }}>
                                                📅 Seçili Dönem: {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                                Yalnızca şu an seçili olan ayın tahsilat, gider ve kasa hareketleri
                                            </div>
                                        </div>
                                    </label>

                                    <label style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '10px 14px',
                                        borderRadius: '8px',
                                        border: `1px solid ${exportScope === 'CURRENT_YEAR' ? 'var(--brand-primary)' : 'var(--border-primary)'}`,
                                        background: exportScope === 'CURRENT_YEAR' ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                                        cursor: 'pointer',
                                    }}>
                                        <input
                                            type="radio"
                                            name="exportScope"
                                            checked={exportScope === 'CURRENT_YEAR'}
                                            onChange={() => setExportScope('CURRENT_YEAR')}
                                        />
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '13px' }}>
                                                📆 {selectedYear} Yılı Raporu (12 Ayın Tümü)
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                                {selectedYear} yılına ait tüm ayların birleşik toplamları ve hareketleri
                                            </div>
                                        </div>
                                    </label>

                                    <label style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '10px 14px',
                                        borderRadius: '8px',
                                        border: `1px solid ${exportScope === 'ALL_TIME' ? 'var(--brand-primary)' : 'var(--border-primary)'}`,
                                        background: exportScope === 'ALL_TIME' ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                                        cursor: 'pointer',
                                    }}>
                                        <input
                                            type="radio"
                                            name="exportScope"
                                            checked={exportScope === 'ALL_TIME'}
                                            onChange={() => setExportScope('ALL_TIME')}
                                        />
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '13px' }}>
                                                🌐 Tüm Zamanlar (Tüm İşlem Geçmişi)
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                                Sisteme bugüne kadar kaydedilmiş istisnasız tüm tahsilat, gider ve kasa işlemleri
                                            </div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: '16px' }}>
                                <label className="form-label" style={{ fontWeight: 600 }}>
                                    💳 Kasa / Hesap Filtresi
                                </label>
                                <select
                                    className="input"
                                    value={exportAccountId}
                                    onChange={(e) => setExportAccountId(e.target.value)}
                                >
                                    <option value="ALL">🌐 Tüm Hesaplar ve Kasalar (Birleşik)</option>
                                    {data?.accounts?.map((acc: any) => (
                                        <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Info Box about generated sheets */}
                            <div style={{
                                background: 'var(--bg-secondary)',
                                padding: '12px 14px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                border: '1px solid var(--border-primary)',
                                color: 'var(--text-secondary)',
                            }}>
                                <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                                    📋 Excel Dosyasında Yer Alacak Sayfalar (Sheets):
                                </strong>
                                <ul style={{ margin: 0, paddingLeft: '18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                                    <li>1. 📊 Kasa Bakiye Özetleri</li>
                                    <li>2. 📜 Tüm Hareketler (Ekstre)</li>
                                    <li>3. 💰 Tahsilatlar (Detaylı)</li>
                                    <li>4. 📉 Giderler & Harcamalar</li>
                                    <li>5. 🔄 Virman & Transferler</li>
                                    <li>6. 🏛️ Kasa Sıfırlamaları</li>
                                </ul>
                            </div>
                        </div>
                        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowExportModal(false)}
                                disabled={isExporting}
                            >
                                İptal
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={() => handleDownloadExcel()}
                                disabled={isExporting}
                                style={{
                                    background: '#10b981',
                                    borderColor: '#059669',
                                    color: '#ffffff',
                                    fontWeight: 600,
                                    minWidth: '160px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                }}
                            >
                                {isExporting ? (
                                    <>
                                        <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                                        <span>Hazırlanıyor...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>📥 Excel (.xlsx) İndir</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
