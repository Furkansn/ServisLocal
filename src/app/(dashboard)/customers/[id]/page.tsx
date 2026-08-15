'use client';

import { useState, useEffect, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCustomerWithTickets } from '@/actions/customers';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/state-machine';
import { REQUEST_TYPE_LABELS, PRIORITY_LABELS, formatDate, formatCurrency } from '@/lib/constants';
import { TicketStatus } from '@prisma/client';

type CustomerData = Awaited<ReturnType<typeof getCustomerWithTickets>>;

export default function CustomerDetailPage() {
    const params = useParams();
    const router = useRouter();
    const customerId = params.id as string;
    const [customer, setCustomer] = useState<CustomerData>(null);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        startTransition(async () => {
            const data = await getCustomerWithTickets(customerId);
            setCustomer(data);
        });
    }, [customerId]);

    if (!customer) {
        return (
            <div className="loading-container">
                <div className="spinner spinner-lg" />
            </div>
        );
    }

    const openTickets = customer.tickets.filter(t =>
        !([TicketStatus.TAMAMLANDI, TicketStatus.IPTAL] as TicketStatus[]).includes(t.status)
    );
    const closedTickets = customer.tickets.filter(t =>
        ([TicketStatus.TAMAMLANDI, TicketStatus.IPTAL] as TicketStatus[]).includes(t.status)
    );
    const totalRevenue = customer.tickets.reduce((sum, t) => sum + t.paidAmount, 0);
    const totalExpected = openTickets.reduce((sum, t) => sum + t.totalAmount, 0);

    return (
        <div>
            <div className="page-header">
                <div>
                    <button className="btn btn-ghost btn-sm" onClick={() => router.push('/customers')} style={{ marginBottom: 'var(--space-2)' }}>
                        ← Müşteriler
                    </button>
                    <h1 className="page-title">👤 {customer.name}</h1>
                    <p className="page-subtitle">{customer.tickets.length} tamir kaydı</p>
                </div>
            </div>

            {/* Info Card */}
            <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
                    <div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-1)' }}>Telefon</div>
                        <a href={`tel:${customer.phone}`} style={{ fontWeight: 600, fontSize: 'var(--font-size-lg)' }}>📞 {customer.phone}</a>
                    </div>
                    <div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-1)' }}>Konum</div>
                        <div style={{ fontWeight: 500 }}>{customer.city} / {customer.district}</div>
                        {customer.address && <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{customer.address}</div>}
                    </div>
                    {customer.taxId && (
                        <div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-1)' }}>VKN</div>
                            <div style={{ fontWeight: 500, fontFamily: 'monospace' }}>{customer.taxId}</div>
                        </div>
                    )}
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
                    <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>{customer.tickets.length}</div>
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

            {customer.tickets.length === 0 && (
                <div className="empty-state">
                    <div className="empty-state-icon">📋</div>
                    <div className="empty-state-title">Henüz tamir kaydı yok</div>
                </div>
            )}
        </div>
    );
}
