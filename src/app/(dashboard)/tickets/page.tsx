'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { getTickets } from '@/actions/tickets';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/state-machine';
import { CUSTOMER_TYPE_LABELS, REQUEST_TYPE_LABELS, PRIORITY_LABELS, formatDate, formatCurrency } from '@/lib/constants';

type Ticket = Awaited<ReturnType<typeof getTickets>>[0];

const STATUS_FILTERS = [
    { value: 'OPEN', label: 'Açık İşler' },
    { value: 'ALL', label: 'Tümü' },
    { value: 'SERVIS_ISTENDI', label: 'Servis İstendi' },
    { value: 'TESLIM_ALINDI', label: 'Teslim Alındı' },
    { value: 'ATOLYEYE_ALINDI', label: 'Atölyeye Alındı' },
    { value: 'TEKNISYENE_VERILDI', label: 'Teknisyene Verildi' },
    { value: 'TAMIR_TAMAMLANDI', label: 'Teslimat Bekliyor' },
    { value: 'TESLIM_EDILDI', label: 'Teslim Edildi' },
    { value: 'ODEME_BEKLIYOR', label: 'Ödeme Bekliyor' },
    { value: 'TAMAMLANDI', label: 'Tamamlandı' },
    { value: 'IPTAL', label: 'İptal' },
];

export default function TicketsPage() {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [statusFilter, setStatusFilter] = useState('OPEN');
    const [search, setSearch] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isPending, startTransition] = useTransition();
    const [initialLoading, setInitialLoading] = useState(true);

    const loadTickets = (isFirst = false) => {
        if (isFirst) setInitialLoading(true);
        startTransition(async () => {
            try {
                const data = await getTickets({
                    status: statusFilter,
                    search: search.trim() || undefined,
                    startDate: startDate || undefined,
                    endDate: endDate || undefined,
                });
                setTickets(data);
            } finally {
                setInitialLoading(false);
            }
        });
    };

    useEffect(() => {
        loadTickets(tickets.length === 0);
    }, [statusFilter, startDate, endDate]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (search.length === 0 || search.length >= 2) {
                loadTickets(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    // Auto refresh every 15 seconds
    useEffect(() => {
        const interval = setInterval(() => loadTickets(false), 15000);
        return () => clearInterval(interval);
    }, [statusFilter, search, startDate, endDate]);

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Tamir Fişleri</h1>
                    <p className="page-subtitle">{tickets.length} kayıt</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    {/* Date Range Picker */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'var(--bg-secondary)',
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-primary)',
                    }}>
                        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-tertiary)' }}>📅 Tarih:</span>
                        <input
                            type="date"
                            className="form-input"
                            style={{ width: '130px', padding: '4px 8px', fontSize: 'var(--font-size-xs)' }}
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            title="Başlangıç Tarihi"
                        />
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>-</span>
                        <input
                            type="date"
                            className="form-input"
                            style={{ width: '130px', padding: '4px 8px', fontSize: 'var(--font-size-xs)' }}
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            title="Bitiş Tarihi"
                        />
                        {(startDate || endDate) && (
                            <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                onClick={() => { setStartDate(''); setEndDate(''); }}
                                title="Filtreyi Temizle (Tümü)"
                                style={{ padding: '2px 6px', fontSize: '11px', color: 'var(--color-danger)' }}
                            >
                                ✕ Tüm Fişler
                            </button>
                        )}
                    </div>

                    {isPending && (
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: 'var(--font-size-xs)',
                            color: '#60a5fa',
                            background: 'rgba(59, 130, 246, 0.15)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-pill)',
                            fontWeight: 600,
                        }}>
                            <span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px' }} />
                            Güncelleniyor...
                        </span>
                    )}
                    <Link href="/tickets/new" className="btn btn-primary">
                        ➕ Yeni Fiş
                    </Link>
                </div>
            </div>

            {/* Filters */}
            <div className="filter-bar">
                {STATUS_FILTERS.map((f) => (
                    <button
                        key={f.value}
                        className={`filter-pill ${statusFilter === f.value ? 'active' : ''}`}
                        onClick={() => setStatusFilter(f.value)}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Search */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
                <input
                    type="text"
                    className="form-input"
                    placeholder="🔍 Fiş no, müşteri adı, model ara..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* Content */}
            {initialLoading ? (
                <div className="loading-container" style={{ padding: 'var(--space-8)' }}>
                    <div className="spinner spinner-lg" />
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>
                        Fişler yükleniyor...
                    </div>
                </div>
            ) : tickets.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📋</div>
                    <div className="empty-state-title">Kayıt bulunamadı</div>
                    <p>Filtreleri değiştirin veya yeni fiş oluşturun.</p>
                </div>
            ) : (
                <div className="table-container" style={{ opacity: isPending ? 0.75 : 1, transition: 'opacity 0.2s' }}>
                    <table className="table table-clickable">
                        <thead>
                            <tr>
                                <th>Fiş No</th>
                                <th>Müşteri/Tamirci</th>
                                <th>Cihaz</th>
                                <th>Talep</th>
                                <th>Tür</th>
                                <th>Öncelik</th>
                                <th>Tamir Durumu</th>
                                <th>Durum</th>
                                <th>Tarih</th>
                                <th>Tutar</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tickets.map((ticket) => (
                                <tr
                                    key={ticket.id}
                                    onClick={() => window.location.href = `/tickets/${ticket.id}`}
                                    className={ticket.closedWithoutPayment ? 'ticket-unpaid' : ''}
                                >
                                    <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                                        {ticket.ticketNo}
                                        {ticket._count?.serviceRecords > 0 && <span title="Servis Talebi Var"> 🚗</span>}
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 500 }}>
                                            {ticket.customer?.name || ticket.repairer?.name || '-'}
                                        </div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                                            {ticket.customer?.phone || ticket.repairer?.phone || ''}
                                        </div>
                                    </td>
                                    <td>
                                        <div>{ticket.brand?.name}</div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>{ticket.model}</div>
                                    </td>
                                    <td style={{ fontSize: 'var(--font-size-xs)' }}>
                                        {REQUEST_TYPE_LABELS[ticket.requestType]}
                                    </td>
                                    <td>
                                            {CUSTOMER_TYPE_LABELS[ticket.customerType as 'INDIVIDUAL' | 'REPAIRER']}
                                    </td>
                                    <td>
                                        <span className={`badge badge-priority-${ticket.priority}`}>
                                            {PRIORITY_LABELS[ticket.priority]}
                                        </span>
                                    </td>
                                    <td>
                                        {ticket.status === 'IPTAL'
                                            ? <span style={{ color: 'var(--color-danger)', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>❌ İptal</span>
                                            : ((ticket._count?.operations || 0) > 0 || ['TAMIR_TAMAMLANDI', 'TESLIMAT_SERVIS_ISTENDI', 'TESLIM_EDILDI', 'ODEME_BEKLIYOR', 'TAMAMLANDI'].includes(ticket.status))
                                                ? <span style={{ color: 'var(--color-success)', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>✅ Bitti</span>
                                                : <span style={{ color: 'var(--color-warning)', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>⏳ Devam</span>}
                                    </td>
                                    <td>
                                        <span
                                            className="badge"
                                            style={{
                                                background: `${STATUS_COLORS[ticket.status]}20`,
                                                color: STATUS_COLORS[ticket.status],
                                            }}
                                        >
                                            {STATUS_LABELS[ticket.status]}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                                        {formatDate(ticket.createdAt)}
                                    </td>
                                    <td style={{ fontWeight: 500 }}>
                                        {Number(ticket.totalAmount) > 0 ? formatCurrency(Number(ticket.totalAmount)) : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
