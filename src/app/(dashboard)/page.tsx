import { getDashboardStats } from '@/actions/tickets';
import { STATUS_LABELS } from '@/lib/state-machine';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    const stats = await getDashboardStats();

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Dashboard</h1>
                    <p className="page-subtitle">Günlük operasyon özeti</p>
                </div>
                <Link href="/tickets/new" className="btn btn-primary">
                    ➕ Yeni Fiş
                </Link>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
                <Link href="/tickets?status=OPEN" className="stat-card" style={{ textDecoration: 'none', color: 'inherit', display: 'block', cursor: 'pointer' }}>
                    <div className="stat-label">Açık Fişler</div>
                    <div className="stat-value">{stats.totalOpen}</div>
                    <div style={{ fontSize: '11px', color: 'var(--brand-primary)', opacity: 0.85, marginTop: 'var(--space-2)' }}>
                        Görüntüle ↗
                    </div>
                </Link>

                <Link href="/tickets?status=ALL&date=today" className="stat-card" style={{ textDecoration: 'none', color: 'inherit', display: 'block', cursor: 'pointer' }}>
                    <div className="stat-label">Bugün Açılan</div>
                    <div className="stat-value">{stats.todayCreated}</div>
                    <div style={{ fontSize: '11px', color: 'var(--brand-primary)', opacity: 0.85, marginTop: 'var(--space-2)' }}>
                        Görüntüle ↗
                    </div>
                </Link>

                <Link href="/tickets?status=SERVIS_ISTENDI" className="stat-card" style={{ textDecoration: 'none', color: 'inherit', display: 'block', cursor: 'pointer' }}>
                    <div className="stat-label">Teslim Bekleyen</div>
                    <div className="stat-value">{stats.awaitingPickup}</div>
                    <div style={{ fontSize: '11px', color: 'var(--brand-primary)', opacity: 0.85, marginTop: 'var(--space-2)' }}>
                        Görüntüle ↗
                    </div>
                </Link>

                <Link href="/tickets?status=TEKNISYENE_VERILDI" className="stat-card" style={{ textDecoration: 'none', color: 'inherit', display: 'block', cursor: 'pointer' }}>
                    <div className="stat-label">Tamirde</div>
                    <div className="stat-value">{stats.inRepair}</div>
                    <div style={{ fontSize: '11px', color: 'var(--brand-primary)', opacity: 0.85, marginTop: 'var(--space-2)' }}>
                        Görüntüle ↗
                    </div>
                </Link>

                <Link href="/tickets?status=TAMIR_TAMAMLANDI" className="stat-card" style={{ textDecoration: 'none', color: 'inherit', display: 'block', cursor: 'pointer' }}>
                    <div className="stat-label">Tamir Tamamlanan</div>
                    <div className="stat-value">{stats.repairCompleted}</div>
                    <div style={{ fontSize: '11px', color: 'var(--brand-primary)', opacity: 0.85, marginTop: 'var(--space-2)' }}>
                        Görüntüle ↗
                    </div>
                </Link>

                <Link href="/tickets?status=ODEME_BEKLIYOR" className="stat-card" style={{ textDecoration: 'none', color: 'inherit', display: 'block', cursor: 'pointer' }}>
                    <div className="stat-label">Ödeme Bekleyen</div>
                    <div className="stat-value">{stats.awaitingPayment}</div>
                    <div style={{ fontSize: '11px', color: 'var(--brand-primary)', opacity: 0.85, marginTop: 'var(--space-2)' }}>
                        Görüntüle ↗
                    </div>
                </Link>

                <Link href="/daily-planning" className="stat-card" style={{ textDecoration: 'none', color: 'inherit', display: 'block', cursor: 'pointer' }}>
                    <div className="stat-label">Bugünkü Servisler</div>
                    <div className="stat-value">{stats.todayServiceRecords}</div>
                    <div style={{ fontSize: '11px', color: 'var(--brand-primary)', opacity: 0.85, marginTop: 'var(--space-2)' }}>
                        Planlama ↗
                    </div>
                </Link>
            </div>

            {/* Quick Actions */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Hızlı İşlemler</h3>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <Link href="/tickets/new" className="btn btn-primary">🔧 Yeni Tamir Fişi</Link>
                    <Link href="/daily-planning" className="btn btn-secondary">📅 Günlük Planlama</Link>
                    <Link href="/tickets?status=OPEN" className="btn btn-secondary">📋 Açık Fişler</Link>
                    <Link href="/tickets?status=ODEME_BEKLIYOR" className="btn btn-secondary">💰 Ödeme Bekleyenler</Link>
                    <Link href="/customers" className="btn btn-secondary">👥 Müşteriler</Link>
                    <Link href="/products" className="btn btn-secondary">📦 Ürünler</Link>
                </div>
            </div>
        </div>
    );
}
