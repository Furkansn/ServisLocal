import { getDashboardStats } from '@/actions/tickets';
import { STATUS_LABELS } from '@/lib/state-machine';
import Link from 'next/link';

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
                <div className="stat-card">
                    <div className="stat-label">Açık Fişler</div>
                    <div className="stat-value">{stats.totalOpen}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Bugün Açılan</div>
                    <div className="stat-value">{stats.todayCreated}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Teslim Bekleyen</div>
                    <div className="stat-value">{stats.awaitingPickup}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Tamirde</div>
                    <div className="stat-value">{stats.inRepair}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Tamir Tamamlanan</div>
                    <div className="stat-value">{stats.repairCompleted}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Ödeme Bekleyen</div>
                    <div className="stat-value">{stats.awaitingPayment}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Bugünkü Servisler</div>
                    <div className="stat-value">{stats.todayServiceRecords}</div>
                </div>
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
