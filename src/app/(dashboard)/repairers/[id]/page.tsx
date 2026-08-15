'use client';

import { useState, useEffect, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getRepairerWithTickets } from '@/actions/repairers';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/state-machine';
import { REQUEST_TYPE_LABELS, PRIORITY_LABELS, formatDate, formatCurrency } from '@/lib/constants';
import { TicketStatus } from '@prisma/client';

type RepairerData = Awaited<ReturnType<typeof getRepairerWithTickets>>;

export default function RepairerDetailPage() {
    const params = useParams();
    const router = useRouter();
    const repairerId = params.id as string;
    const [repairer, setRepairer] = useState<RepairerData>(null);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        startTransition(async () => {
            const data = await getRepairerWithTickets(repairerId);
            setRepairer(data);
        });
    }, [repairerId]);

    if (!repairer) {
        return (
            <div className="loading-container">
                <div className="spinner spinner-lg" />
            </div>
        );
    }

    const openTickets = repairer.tickets.filter(t =>
        !([TicketStatus.TAMAMLANDI, TicketStatus.IPTAL] as TicketStatus[]).includes(t.status)
    );
    const closedTickets = repairer.tickets.filter(t =>
        ([TicketStatus.TAMAMLANDI, TicketStatus.IPTAL] as TicketStatus[]).includes(t.status)
    );
    const totalRevenue = repairer.tickets.reduce((sum, t) => sum + t.paidAmount, 0);
    const totalExpected = openTickets.reduce((sum, t) => sum + t.totalAmount, 0);

    return (
        <div>
            <div className="page-header">
                <div>
                    <button className="btn btn-ghost btn-sm" onClick={() => router.push('/repairers')} style={{ marginBottom: 'var(--space-2)' }}>
                        ← Tamirciler
                    </button>
                    <h1 className="page-title">🏪 {repairer.name}</h1>
                    <p className="page-subtitle">{repairer.tickets.length} tamir kaydı</p>
                </div>
            </div>

            {/* Info Card */}
            <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
                    <div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-1)' }}>Telefon</div>
                        <a href={`tel:${repairer.phone}`} style={{ fontWeight: 600, fontSize: 'var(--font-size-lg)' }}>📞 {repairer.phone}</a>
                    </div>
                    <div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-1)' }}>Konum</div>
                        <div style={{ fontWeight: 500 }}>{repairer.city} / {repairer.district}</div>
                        {repairer.address && <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{repairer.address}</div>}
                    </div>
                    <div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-1)' }}>VKN</div>
                        <div style={{ fontWeight: 500, fontFamily: 'monospace' }}>{repairer.taxId}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-1)' }}>Alınan Toplam Ödeme</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)' }}>
                            <div style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)', color: 'var(--color-success)' }}>{formatCurrency(totalRevenue)}</div>
                            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)' }}>/ {formatCurrency(totalExpected)}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3)' }}>
                    <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>{repairer.tickets.length}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Toplam Fiş</div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3)' }}>
                    <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-warning)' }}>{openTickets.length}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Açık</div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3)' }}>
                    <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-success)' }}>{closedTickets.length}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Kapalı</div>
                </div>
            </div>

            {/* Open Tickets */}
            {openTickets.length > 0 && (
                <div style={{ marginBottom: 'var(--space-4)' }}>
                    <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>
                        ⏳ Açık Fişler ({openTickets.length})
                    </h2>
                    <div className="table-container">
                        <table className="table table-clickable">
                            <thead>
                                <tr>
                                    <th>Fiş No</th>
                                    <th>Cihaz</th>
                                    <th>Talep</th>
                                    <th>Durum</th>
                                    <th>Tarih</th>
                                    <th>Tutar</th>
                                </tr>
                            </thead>
                            <tbody>
                                {openTickets.map((t) => (
                                    <tr key={t.id} onClick={() => router.push(`/tickets/${t.id}`)}>
                                        <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{t.ticketNo}</td>
                                        <td>{t.brand?.name} {t.model}</td>
                                        <td style={{ fontSize: 'var(--font-size-xs)' }}>{REQUEST_TYPE_LABELS[t.requestType as keyof typeof REQUEST_TYPE_LABELS]}</td>
                                        <td>
                                            <span className="badge" style={{ background: `${STATUS_COLORS[t.status]}20`, color: STATUS_COLORS[t.status] }}>
                                                {STATUS_LABELS[t.status]}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>{formatDate(t.createdAt)}</td>
                                        <td style={{ fontWeight: 500 }}>{t.totalAmount > 0 ? formatCurrency(t.totalAmount) : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Closed Tickets */}
            {closedTickets.length > 0 && (
                <div>
                    <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>
                        ✅ Geçmiş Fişler ({closedTickets.length})
                    </h2>
                    <div className="table-container">
                        <table className="table table-clickable">
                            <thead>
                                <tr>
                                    <th>Fiş No</th>
                                    <th>Cihaz</th>
                                    <th>Talep</th>
                                    <th>Durum</th>
                                    <th>Tarih</th>
                                    <th>Tutar</th>
                                    <th>Ödenen</th>
                                </tr>
                            </thead>
                            <tbody>
                                {closedTickets.map((t) => (
                                    <tr key={t.id} onClick={() => router.push(`/tickets/${t.id}`)}>
                                        <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{t.ticketNo}</td>
                                        <td>{t.brand?.name} {t.model}</td>
                                        <td style={{ fontSize: 'var(--font-size-xs)' }}>{REQUEST_TYPE_LABELS[t.requestType as keyof typeof REQUEST_TYPE_LABELS]}</td>
                                        <td>
                                            <span className="badge" style={{ background: `${STATUS_COLORS[t.status]}20`, color: STATUS_COLORS[t.status] }}>
                                                {STATUS_LABELS[t.status]}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>{formatDate(t.createdAt)}</td>
                                        <td style={{ fontWeight: 500 }}>{t.totalAmount > 0 ? formatCurrency(t.totalAmount) : '-'}</td>
                                        <td style={{ fontWeight: 500, color: 'var(--color-success)' }}>{t.paidAmount > 0 ? formatCurrency(t.paidAmount) : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {repairer.tickets.length === 0 && (
                <div className="empty-state">
                    <div className="empty-state-icon">📋</div>
                    <div className="empty-state-title">Henüz tamir kaydı yok</div>
                </div>
            )}
        </div>
    );
}
