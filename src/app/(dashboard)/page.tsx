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
                    <div className="stat-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Açık Fişler</span>
                        <span style={{ fontSize: '11px', color: 'var(--brand-primary)', opacity: 0.8 }}>Görüntüle ↗</span>
                    </div>
                    <div className="stat-value">{stats.totalOpen}</div>
                </Link>

                <Link href="/tickets?status=ALL&date=today" className="stat-card" style={{ textDecoration: 'none', color: 'inherit', display: 'block', cursor: 'pointer' }}>
                    <div className="stat-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Bugün Açılan</span>
                        <span style={{ fontSize: '11px', color: 'var(--brand-primary)', opacity: 0.8 }}>Görüntüle ↗</span>
                    </div>
                    <div className="stat-value">{stats.todayCreated}</div>
                </Link>

                <Link href="/tickets?status=SERVIS_ISTENDI" className="stat-card" style={{ textDecoration: 'none', color: 'inherit', display: 'block', cursor: 'pointer' }}>
                    <div className="stat-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Teslim Bekleyen</span>
                        <span style={{ fontSize: '11px', color: 'var(--brand-primary)', opacity: 0.8 }}>Görüntüle ↗</span>
                    </div>
                    <div className="stat-value">{stats.awaitingPickup}</div>
                </Link>

                <Link href="/tickets?status=TEKNISYENE_VERILDI" className="stat-card" style={{ textDecoration: 'none', color: 'inherit', display: 'block', cursor: 'pointer' }}>
                    <div className="stat-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Tamirde</span>
                        <span style={{ fontSize: '11px', color: 'var(--brand-primary)', opacity: 0.8 }}>Görüntüle ↗</span>
                    </div>
                    <div className="stat-value">{stats.inRepair}</div>
                </Link>

                <Link href="/tickets?status=TAMIR_TAMAMLANDI" className="stat-card" style={{ textDecoration: 'none', color: 'inherit', display: 'block', cursor: 'pointer' }}>
                    <div className="stat-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Tamir Tamamlanan</span>
                        <span style={{ fontSize: '11px', color: 'var(--brand-primary)', opacity: 0.8 }}>Görüntüle ↗</span>
                    </div>
                    <div className="stat-value">{stats.repairCompleted}</div>
                </Link>

                <Link href="/tickets?status=ODEME_BEKLIYOR" className="stat-card" style={{ textDecoration: 'none', color: 'inherit', display: 'block', cursor: 'pointer' }}>
                    <div className="stat-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Ödeme Bekleyen</span>
                        <span style={{ fontSize: '11px', color: 'var(--brand-primary)', opacity: 0.8 }}>Görüntüle ↗</span>
                    </div>
                    <div className="stat-value">{stats.awaitingPayment}</div>
                </Link>

                <Link href="/daily-planning" className="stat-card" style={{ textDecoration: 'none', color: 'inherit', display: 'block', cursor: 'pointer' }}>
                    <div className="stat-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Bugünkü Servisler</span>
                        <span style={{ fontSize: '11px', color: 'var(--brand-primary)', opacity: 0.8 }}>Planlama ↗</span>
                    </div>
                    <div className="stat-value">{stats.todayServiceRecords}</div>
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
