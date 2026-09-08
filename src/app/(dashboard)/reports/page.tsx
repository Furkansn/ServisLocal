'use client';

import { useState, useEffect, useTransition } from 'react';
import {
    getOperationalReport,
    getTechnicianReport,
    getFinancialDetailReport,
    getInventoryReport,
    getAllReportsCombined,
} from '@/actions/reports';
import {
    exportOperationalReportExcel,
    exportTechnicianReportExcel,
    exportFinancialDetailReportExcel,
    exportInventoryReportExcel,
    exportAllReportsCombinedExcel,
} from '@/lib/exportReportsExcel';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/state-machine';
import { REQUEST_TYPE_LABELS, formatDate, formatCurrency, getLocalDateString } from '@/lib/constants';

type TabType = 'OPERATIONAL' | 'TECHNICIAN' | 'FINANCIAL' | 'INVENTORY';

export default function ReportsPage() {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [activeTab, setActiveTab] = useState<TabType>('OPERATIONAL');
    const [startDate, setStartDate] = useState(getLocalDateString(firstDayOfMonth));
    const [endDate, setEndDate] = useState(getLocalDateString(lastDayOfMonth));
    const [periodLabel, setPeriodLabel] = useState('Bu Ay');

    // Data states for the 4 separate reports
    const [operationalData, setOperationalData] = useState<any>(null);
    const [technicianData, setTechnicianData] = useState<any>(null);
    const [financialData, setFinancialData] = useState<any>(null);
    const [inventoryData, setInventoryData] = useState<any>(null);

    // Search and filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('ALL');
    const [selectedTechId, setSelectedTechId] = useState<string | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [isPending, startTransition] = useTransition();

    // Set predefined periods
    const setPeriod = (type: 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR' | 'LAST_30') => {
        const d = new Date();
        if (type === 'THIS_MONTH') {
            const start = new Date(d.getFullYear(), d.getMonth(), 1);
            const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
            setStartDate(getLocalDateString(start));
            setEndDate(getLocalDateString(end));
            setPeriodLabel('Bu Ay');
        } else if (type === 'LAST_MONTH') {
            const start = new Date(d.getFullYear(), d.getMonth() - 1, 1);
            const end = new Date(d.getFullYear(), d.getMonth(), 0);
            setStartDate(getLocalDateString(start));
            setEndDate(getLocalDateString(end));
            setPeriodLabel('Geçen Ay');
        } else if (type === 'THIS_YEAR') {
            const start = new Date(d.getFullYear(), 0, 1);
            const end = new Date(d.getFullYear(), 11, 31);
            setStartDate(getLocalDateString(start));
            setEndDate(getLocalDateString(end));
            setPeriodLabel(`${d.getFullYear()} Yılı`);
        } else if (type === 'LAST_30') {
            const start = new Date();
            start.setDate(start.getDate() - 30);
            setStartDate(getLocalDateString(start));
            setEndDate(getLocalDateString(d));
            setPeriodLabel('Son 30 Gün');
        }
    };

    // Load data based on active tab
    const loadReportData = (tab = activeTab) => {
        setIsLoading(true);
        startTransition(async () => {
            try {
                const filter = { startDate, endDate };
                if (tab === 'OPERATIONAL') {
                    const res = await getOperationalReport(filter);
                    setOperationalData(res);
                } else if (tab === 'TECHNICIAN') {
                    const res = await getTechnicianReport(filter);
                    setTechnicianData(res);
                } else if (tab === 'FINANCIAL') {
                    const res = await getFinancialDetailReport(filter);
                    setFinancialData(res);
                } else if (tab === 'INVENTORY') {
                    const res = await getInventoryReport();
                    setInventoryData(res);
                }
            } catch (err) {
                console.error('Rapor yükleme hatası:', err);
            } finally {
                setIsLoading(false);
            }
        });
    };

    useEffect(() => {
        loadReportData(activeTab);
    }, [activeTab, startDate, endDate]);

    // Handle export for individual report
    const handleExportCurrentTab = async () => {
        setIsExporting(true);
        try {
            const filter = { startDate, endDate };
            if (activeTab === 'OPERATIONAL') {
                const data = operationalData || await getOperationalReport(filter);
                exportOperationalReportExcel(data, periodLabel);
            } else if (activeTab === 'TECHNICIAN') {
                const data = technicianData || await getTechnicianReport(filter);
                exportTechnicianReportExcel(data, periodLabel);
            } else if (activeTab === 'FINANCIAL') {
                const data = financialData || await getFinancialDetailReport(filter);
                exportFinancialDetailReportExcel(data, periodLabel);
            } else if (activeTab === 'INVENTORY') {
                const data = inventoryData || await getInventoryReport();
                exportInventoryReportExcel(data);
            }
        } catch (err: any) {
            alert('Excel oluşturulurken hata: ' + err.message);
        } finally {
            setIsExporting(false);
        }
    };

    // Handle combined export (all 4 sheets)
    const handleExportCombined = async () => {
        setIsExporting(true);
        try {
            const filter = { startDate, endDate };
            const allData = await getAllReportsCombined(filter);
            exportAllReportsCombinedExcel(allData, periodLabel);
        } catch (err: any) {
            alert('Toplu Excel paketi oluşturulurken hata: ' + err.message);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div>
            {/* Page Header */}
            <div className="page-header" style={{ marginBottom: '16px' }}>
                <div>
                    <h1 className="page-title">Yönetim & Operasyon Raporları</h1>
                    <p className="page-subtitle">Aylık, periyodik ve detaylı kârlılık, teknisyen ve stok analizleri</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                        className="btn btn-secondary"
                        onClick={handleExportCurrentTab}
                        disabled={isExporting || isLoading}
                        title="Şu an açık olan raporu indir"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                        {isExporting ? <span className="spinner" style={{ width: '14px', height: '14px' }} /> : '📥'}
                        Bu Raporu İndir (.xlsx)
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleExportCombined}
                        disabled={isExporting || isLoading}
                        title="Tüm raporları 4 sayfalı tek bir Excel dosyasında indir"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                    >
                        {isExporting ? <span className="spinner" style={{ width: '14px', height: '14px' }} /> : '📦'}
                        Tüm Raporlar Paketi (.xlsx)
                    </button>
                </div>
            </div>

            {/* Filter Toolbar: Presets + Custom Date Pickers */}
            <div className="card" style={{ padding: '12px 18px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                    {/* Presets */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-tertiary)', marginRight: '4px' }}>
                            DÖNEM:
                        </span>
                        {[
                            { label: 'Bu Ay', type: 'THIS_MONTH' as const },
                            { label: 'Geçen Ay', type: 'LAST_MONTH' as const },
                            { label: 'Bu Yıl', type: 'THIS_YEAR' as const },
                            { label: 'Son 30 Gün', type: 'LAST_30' as const },
                        ].map(p => (
                            <button
                                key={p.label}
                                className={`btn btn-xs ${periodLabel === p.label ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setPeriod(p.type)}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {/* Date Inputs */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>📅 Tarih Aralığı:</span>
                        <input
                            type="date"
                            className="form-input"
                            value={startDate}
                            onChange={e => { setStartDate(e.target.value); setPeriodLabel('Özel Aralık'); }}
                            style={{ padding: '4px 8px', fontSize: '12px', width: '135px' }}
                        />
                        <span style={{ color: 'var(--text-tertiary)' }}>-</span>
                        <input
                            type="date"
                            className="form-input"
                            value={endDate}
                            onChange={e => { setEndDate(e.target.value); setPeriodLabel('Özel Aralık'); }}
                            style={{ padding: '4px 8px', fontSize: '12px', width: '135px' }}
                        />
                        <button
                            className="btn btn-secondary btn-xs"
                            onClick={() => loadReportData(activeTab)}
                            disabled={isLoading || isPending}
                            title="Raporu Yenile"
                        >
                            {isLoading || isPending ? '⏳' : '🔄 Yenile'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs for the 4 Distinct Reports */}
            <div style={{
                display: 'flex',
                gap: '8px',
                borderBottom: '1px solid var(--border-primary)',
                marginBottom: '20px',
                overflowX: 'auto',
            }}>
                {[
                    { id: 'OPERATIONAL' as const, label: '📋 1. Genel Operasyon & İşler', desc: 'Tamamlanan, teslim edilen ve açık fişler' },
                    { id: 'TECHNICIAN' as const, label: '👨‍🔧 2. Teknisyen Performansı', desc: 'İş sayıları, ciro ve net kâr katkısı' },
                    { id: 'FINANCIAL' as const, label: '💰 3. Detaylı Finans & Net Kâr', desc: 'Parça maliyeti, aksesuarlar ve kâr kolonu' },
                    { id: 'INVENTORY' as const, label: '📦 4. Ürün & Stok Envanteri', desc: 'Stok adetleri, alış maliyeti ve envanter değeri' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            padding: '12px 18px',
                            background: activeTab === tab.id ? 'var(--bg-card)' : 'transparent',
                            border: '1px solid transparent',
                            borderBottom: activeTab === tab.id ? '2px solid var(--brand-primary)' : '1px solid transparent',
                            borderRadius: '8px 8px 0 0',
                            cursor: 'pointer',
                            color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                            fontWeight: activeTab === tab.id ? 700 : 500,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            gap: '3px',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.15s ease',
                        }}
                    >
                        <span style={{ fontSize: '14px' }}>{tab.label}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 400 }}>{tab.desc}</span>
                    </button>
                ))}
            </div>

            {/* Loading Indicator */}
            {(isLoading || isPending) && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '60px 20px',
                    gap: '12px',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-primary)',
                    marginBottom: '20px',
                }}>
                    <div className="spinner" style={{ width: '32px', height: '32px' }} />
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Rapor verileri hesaplanıyor...
                    </span>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* TAB 1: OPERATIONAL & JOBS REPORT                        */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === 'OPERATIONAL' && operationalData && !isLoading && (
                <div>
                    {/* Operational Metric Cards */}
                    <div className="stats-grid" style={{ marginBottom: '20px' }}>
                        <div className="stat-card">
                            <div className="stat-label">Toplam İş / Fiş</div>
                            <div className="stat-value">{operationalData.totalTickets}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Tamamlanan İşler</div>
                            <div className="stat-value" style={{ color: '#10b981' }}>{operationalData.completedTickets}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Teslim Edilenler</div>
                            <div className="stat-value" style={{ color: '#3b82f6' }}>{operationalData.deliveredTickets}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Devam Eden (Tamirde)</div>
                            <div className="stat-value" style={{ color: '#f59e0b' }}>{operationalData.inProgressTickets}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">İptal / İade</div>
                            <div className="stat-value" style={{ color: '#ef4444' }}>{operationalData.cancelledTickets}</div>
                        </div>
                    </div>

                    {/* Operational Table */}
                    <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                        <div style={{
                            padding: '14px 20px',
                            borderBottom: '1px solid var(--border-primary)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '12px',
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                                    Genel Operasyon ve Fiş Listesi ({operationalData.items.length} Fiş)
                                </h3>
                                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                                    {periodLabel} dönemindeki tüm cihazlar ve durumları
                                </p>
                            </div>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Fiş no, müşteri veya cihaz ara..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                style={{ width: '260px', padding: '6px 12px', fontSize: '12px' }}
                            />
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table className="table" style={{ width: '100%', fontSize: '13px' }}>
                                <thead>
                                    <tr>
                                        <th>Fiş No</th>
                                        <th>Tarih</th>
                                        <th>Müşteri / Tamirci</th>
                                        <th>Cihaz</th>
                                        <th>Durum</th>
                                        <th>Teknisyen</th>
                                        <th style={{ textAlign: 'right' }}>Fiş Tutarı</th>
                                        <th style={{ textAlign: 'right' }}>Parça Maliyeti</th>
                                        <th style={{ textAlign: 'right' }}>Net Kâr</th>
                                        <th style={{ textAlign: 'right' }}>Tahsil Edilen</th>
                                        <th style={{ textAlign: 'right' }}>Kalan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {operationalData.items
                                        .filter((t: any) => {
                                            if (!searchQuery.trim()) return true;
                                            const q = searchQuery.toLowerCase();
                                            return t.ticketNo.toLowerCase().includes(q) ||
                                                t.customerName.toLowerCase().includes(q) ||
                                                t.device.toLowerCase().includes(q);
                                        })
                                        .map((t: any) => (
                                            <tr key={t.id}>
                                                <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                                                    <a href={`/tickets/${t.id}`} style={{ color: 'var(--brand-primary)', textDecoration: 'none' }}>
                                                        {t.ticketNo}
                                                    </a>
                                                </td>
                                                <td style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>{formatDate(t.createdAt)}</td>
                                                <td>
                                                    <div style={{ fontWeight: 600 }}>{t.customerName}</div>
                                                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                                        {t.customerType === 'REPAIRER' ? 'Tamirci' : 'Şahıs'}
                                                    </span>
                                                </td>
                                                <td>{t.device}</td>
                                                <td>
                                                    <span
                                                        className="badge"
                                                        style={{
                                                            background: `${STATUS_COLORS[t.status as keyof typeof STATUS_COLORS] || '#64748b'}20`,
                                                            color: STATUS_COLORS[t.status as keyof typeof STATUS_COLORS] || '#64748b',
                                                            fontSize: '11px',
                                                        }}
                                                    >
                                                        {STATUS_LABELS[t.status as keyof typeof STATUS_LABELS] || t.status}
                                                    </span>
                                                </td>
                                                <td>{t.technicianName}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(t.totalPrice)}</td>
                                                <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(t.partsCost)}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 700, color: t.netProfit >= 0 ? '#10b981' : '#ef4444' }}>
                                                    {formatCurrency(t.netProfit)}
                                                </td>
                                                <td style={{ textAlign: 'right', color: '#10b981' }}>{formatCurrency(t.totalPaid)}</td>
                                                <td style={{ textAlign: 'right', color: t.remaining > 0 ? '#f59e0b' : 'var(--text-tertiary)' }}>
                                                    {t.remaining > 0 ? formatCurrency(t.remaining) : '0 ₺'}
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* TAB 2: TECHNICIAN PERFORMANCE REPORT                    */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === 'TECHNICIAN' && technicianData && !isLoading && (
                <div>
                    {/* Technician Summary Cards */}
                    <div className="stats-grid" style={{ marginBottom: '20px' }}>
                        <div className="stat-card">
                            <div className="stat-label">Toplam Ciro Katkısı</div>
                            <div className="stat-value">{formatCurrency(technicianData.totalRevenueAll)}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Kullanılan Parça Maliyeti</div>
                            <div className="stat-value" style={{ color: '#ef4444' }}>{formatCurrency(technicianData.totalPartsCostAll)}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Toplam Net Kâr Katkısı</div>
                            <div className="stat-value" style={{ color: '#10b981' }}>{formatCurrency(technicianData.totalNetProfitAll)}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Tamamlanan Fiş Sayısı</div>
                            <div className="stat-value" style={{ color: '#3b82f6' }}>{technicianData.totalCompletedAll}</div>
                        </div>
                    </div>

                    {/* Technicians Breakdown Table */}
                    <div className="card" style={{ padding: '0', overflow: 'hidden', marginBottom: '24px' }}>
                        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-primary)' }}>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                                Teknisyen Bazlı Yapılan İş Sayıları ve Kârlılık Özeti
                            </h3>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="table" style={{ width: '100%', fontSize: '13px' }}>
                                <thead>
                                    <tr>
                                        <th>Teknisyen Adı</th>
                                        <th style={{ textAlign: 'center' }}>Atanan Fiş</th>
                                        <th style={{ textAlign: 'center' }}>Tamamlanan</th>
                                        <th style={{ textAlign: 'center' }}>Devam Eden</th>
                                        <th style={{ textAlign: 'right' }}>Oluşturulan Ciro</th>
                                        <th style={{ textAlign: 'right' }}>Parça Maliyeti</th>
                                        <th style={{ textAlign: 'right' }}>Net Kâr Katkısı</th>
                                        <th style={{ textAlign: 'right' }}>Kârlılık Oranı</th>
                                        <th style={{ textAlign: 'center' }}>İşlemler</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {technicianData.technicians.map((t: any) => {
                                        const margin = t.totalRevenue > 0 ? ((t.netProfitContribution / t.totalRevenue) * 100).toFixed(1) : '0.0';
                                        const isSelected = selectedTechId === t.technicianId;
                                        return (
                                            <tr key={t.technicianId} style={{ background: isSelected ? 'var(--bg-secondary)' : undefined }}>
                                                <td style={{ fontWeight: 700, fontSize: '14px' }}>
                                                    👨‍🔧 {t.technicianName}
                                                </td>
                                                <td style={{ textAlign: 'center', fontWeight: 600 }}>{t.totalAssigned}</td>
                                                <td style={{ textAlign: 'center', color: '#10b981', fontWeight: 700 }}>{t.completedCount}</td>
                                                <td style={{ textAlign: 'center', color: '#f59e0b' }}>{t.inProgressCount}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(t.totalRevenue)}</td>
                                                <td style={{ textAlign: 'right', color: '#ef4444' }}>{formatCurrency(t.totalPartsCost)}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                                                    {formatCurrency(t.netProfitContribution)}
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--brand-primary)' }}>
                                                    %{margin}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <button
                                                        className={`btn btn-xs ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                                                        onClick={() => setSelectedTechId(isSelected ? null : t.technicianId)}
                                                    >
                                                        {isSelected ? 'Kapat' : 'Detay Fişler'}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Selected Technician Detail List */}
                    {selectedTechId && (() => {
                        const currentTech = technicianData.technicians.find((t: any) => t.technicianId === selectedTechId);
                        if (!currentTech) return null;
                        return (
                            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                                <div style={{ padding: '14px 20px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
                                        🔍 {currentTech.technicianName} - Cihaz ve İşlem Detayları ({currentTech.ticketDetails.length} Fiş)
                                    </h4>
                                    <button className="btn btn-ghost btn-xs" onClick={() => setSelectedTechId(null)}>✕ Kapat</button>
                                </div>
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="table" style={{ width: '100%', fontSize: '13px' }}>
                                        <thead>
                                            <tr>
                                                <th>Fiş No</th>
                                                <th>Tarih</th>
                                                <th>Müşteri</th>
                                                <th>Cihaz</th>
                                                <th>Durum</th>
                                                <th style={{ textAlign: 'right' }}>Satış Tutarı</th>
                                                <th style={{ textAlign: 'right' }}>Parça Maliyeti</th>
                                                <th style={{ textAlign: 'right' }}>Net Kâr</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentTech.ticketDetails.map((d: any) => (
                                                <tr key={d.ticketNo}>
                                                    <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{d.ticketNo}</td>
                                                    <td style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>{formatDate(d.date)}</td>
                                                    <td>{d.customer}</td>
                                                    <td>{d.device}</td>
                                                    <td>
                                                        <span className="badge" style={{ fontSize: '11px' }}>
                                                            {STATUS_LABELS[d.status as keyof typeof STATUS_LABELS] || d.status}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(d.revenue)}</td>
                                                    <td style={{ textAlign: 'right', color: '#ef4444' }}>{formatCurrency(d.cost)}</td>
                                                    <td style={{ textAlign: 'right', fontWeight: 700, color: d.profit >= 0 ? '#10b981' : '#ef4444' }}>
                                                        {formatCurrency(d.profit)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* TAB 3: FINANCIAL & PARTS DETAIL REPORT                  */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === 'FINANCIAL' && financialData && !isLoading && (
                <div>
                    {/* Financial Summary Cards */}
                    <div className="stats-grid" style={{ marginBottom: '20px' }}>
                        <div className="stat-card">
                            <div className="stat-label">Toplam Satış Hasılatı</div>
                            <div className="stat-value">{formatCurrency(financialData.grandTotalRevenue)}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Toplam Parça Alış Maliyeti</div>
                            <div className="stat-value" style={{ color: '#ef4444' }}>{formatCurrency(financialData.grandTotalCost)}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">NET KÂR</div>
                            <div className="stat-value" style={{ color: '#10b981' }}>{formatCurrency(financialData.grandTotalProfit)}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Toplam Alınan Tahsilat</div>
                            <div className="stat-value" style={{ color: '#3b82f6' }}>{formatCurrency(financialData.grandTotalPaid)}</div>
                        </div>
                    </div>

                    {/* Financial Detail Table */}
                    <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                        <div style={{
                            padding: '14px 20px',
                            borderBottom: '1px solid var(--border-primary)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '12px',
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                                    Detaylı Finans, Parça, Aksesuar ve Kâr Raporu ({financialData.rows.length} İşlem)
                                </h3>
                                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                                    Kullanılan her parça, maliyeti, satılan aksesuar, alınan ödeme ve net kâr dökümü
                                </p>
                            </div>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Fiş, müşteri veya parça ara..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                style={{ width: '260px', padding: '6px 12px', fontSize: '12px' }}
                            />
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table className="table" style={{ width: '100%', fontSize: '12px' }}>
                                <thead>
                                    <tr>
                                        <th>Fiş No</th>
                                        <th>Tarih</th>
                                        <th>Müşteri</th>
                                        <th>Cihaz</th>
                                        <th>Kullanılan Parça</th>
                                        <th style={{ textAlign: 'right' }}>Parça Maliyeti</th>
                                        <th style={{ textAlign: 'right' }}>Tamir Satış</th>
                                        <th>Satılan Aksesuarlar</th>
                                        <th style={{ textAlign: 'right' }}>Aksesuar Tutarı</th>
                                        <th style={{ textAlign: 'right' }}>Tahsilat</th>
                                        <th>Tahsil Eden</th>
                                        <th style={{ textAlign: 'right' }}>Toplam Ciro</th>
                                        <th style={{ textAlign: 'right', fontWeight: 800, background: 'rgba(16, 185, 129, 0.1)' }}>NET KÂR</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {financialData.rows
                                        .filter((r: any) => {
                                            if (!searchQuery.trim()) return true;
                                            const q = searchQuery.toLowerCase();
                                            return r.ticketNo.toLowerCase().includes(q) ||
                                                r.customerName.toLowerCase().includes(q) ||
                                                r.installedParts.toLowerCase().includes(q) ||
                                                r.device.toLowerCase().includes(q);
                                        })
                                        .map((r: any) => (
                                            <tr key={r.ticketNo}>
                                                <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{r.ticketNo}</td>
                                                <td style={{ color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{formatDate(r.date)}</td>
                                                <td style={{ fontWeight: 600 }}>{r.customerName}</td>
                                                <td style={{ whiteSpace: 'nowrap' }}>{r.device}</td>
                                                <td style={{ maxWidth: '200px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                    {r.installedParts}
                                                </td>
                                                <td style={{ textAlign: 'right', color: '#ef4444' }}>{formatCurrency(r.totalPartsCost)}</td>
                                                <td style={{ textAlign: 'right' }}>{formatCurrency(r.repairSales)}</td>
                                                <td style={{ maxWidth: '160px', fontSize: '11px' }}>{r.accessoriesSold}</td>
                                                <td style={{ textAlign: 'right' }}>{formatCurrency(r.totalAccessorySales)}</td>
                                                <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>{formatCurrency(r.totalPaid)}</td>
                                                <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{r.receivers}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(r.totalRevenue)}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 800, color: r.netProfit >= 0 ? '#10b981' : '#ef4444', background: 'rgba(16, 185, 129, 0.08)' }}>
                                                    {formatCurrency(r.netProfit)}
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* TAB 4: INVENTORY & STOCK VALUATION REPORT               */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === 'INVENTORY' && inventoryData && !isLoading && (
                <div>
                    {/* Inventory Metric Cards */}
                    <div className="stats-grid" style={{ marginBottom: '20px' }}>
                        <div className="stat-card">
                            <div className="stat-label">Toplam Ürün Çeşidi</div>
                            <div className="stat-value">{inventoryData.totalItemsCount}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Toplam Stok Adedi</div>
                            <div className="stat-value" style={{ color: '#3b82f6' }}>{inventoryData.totalStockCount}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Toplam Stok Alış Maliyeti</div>
                            <div className="stat-value" style={{ color: '#ef4444' }}>{formatCurrency(inventoryData.totalStockCostValue)}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Toplam Satış Değeri</div>
                            <div className="stat-value" style={{ color: '#10b981' }}>{formatCurrency(inventoryData.totalStockSalesValue)}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Potansiyel Net Kâr</div>
                            <div className="stat-value" style={{ color: '#059669' }}>{formatCurrency(inventoryData.potentialProfit)}</div>
                        </div>
                    </div>

                    {/* Inventory Table */}
                    <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                        <div style={{
                            padding: '14px 20px',
                            borderBottom: '1px solid var(--border-primary)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '12px',
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                                    Ürün ve Stok Envanter Listesi
                                </h3>
                                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                                    Ekran, LED, LGP ve Aksesuar güncel stok ve fiyat dökümü
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <select
                                    className="form-input"
                                    value={categoryFilter}
                                    onChange={e => setCategoryFilter(e.target.value)}
                                    style={{ padding: '6px 10px', fontSize: '12px', width: '130px' }}
                                >
                                    <option value="ALL">Tüm Kategoriler</option>
                                    <option value="SCREEN">Ekran</option>
                                    <option value="LED">LED</option>
                                    <option value="ACCESSORY">Aksesuar</option>
                                    <option value="LGP">LGP</option>
                                    <option value="OTHER">Diğer</option>
                                </select>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Ürün adı veya barkod..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    style={{ width: '220px', padding: '6px 12px', fontSize: '12px' }}
                                />
                            </div>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table className="table" style={{ width: '100%', fontSize: '13px' }}>
                                <thead>
                                    <tr>
                                        <th>Barkod / Kod</th>
                                        <th>Ürün Adı</th>
                                        <th>Kategori</th>
                                        <th>Kaynak</th>
                                        <th style={{ textAlign: 'center' }}>Mevcut Stok</th>
                                        <th style={{ textAlign: 'right' }}>Alış Maliyeti</th>
                                        <th style={{ textAlign: 'right' }}>Satış Fiyatı</th>
                                        <th style={{ textAlign: 'right' }}>Toplam Maliyet Değeri</th>
                                        <th style={{ textAlign: 'right' }}>Toplam Satış Değeri</th>
                                        <th style={{ textAlign: 'center' }}>Durum</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {inventoryData.items
                                        .filter((p: any) => {
                                            if (categoryFilter !== 'ALL' && p.category !== categoryFilter) return false;
                                            if (!searchQuery.trim()) return true;
                                            const q = searchQuery.toLowerCase();
                                            return p.name.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q);
                                        })
                                        .map((p: any) => (
                                            <tr key={p.id}>
                                                <td style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                                                    {p.barcode}
                                                </td>
                                                <td style={{ fontWeight: 600 }}>{p.name}</td>
                                                <td>
                                                    <span className="badge" style={{ fontSize: '11px' }}>
                                                        {p.category}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                        {p.source}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <span style={{
                                                        display: 'inline-block',
                                                        padding: '3px 10px',
                                                        borderRadius: '12px',
                                                        fontWeight: 700,
                                                        background: p.stock <= 2 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                                        color: p.stock <= 2 ? '#ef4444' : '#10b981',
                                                    }}>
                                                        {p.stock} adet
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'right', color: '#ef4444' }}>{formatCurrency(p.cost)}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(p.price)}</td>
                                                <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(p.totalCostVal)}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{formatCurrency(p.totalSalesVal)}</td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <span style={{ fontSize: '11px', color: p.isActive ? '#10b981' : '#94a3b8' }}>
                                                        {p.isActive ? 'Aktif' : 'Kapalı'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
