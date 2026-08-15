'use client';

import { useState, useEffect, useCallback } from 'react';
import { getTvDisplayData } from '@/actions/tv-display';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/state-machine';
import { REQUEST_TYPE_LABELS, formatDate } from '@/lib/constants';

type TvData = Awaited<ReturnType<typeof getTvDisplayData>>;

export default function TVDisplayPage() {
    const [data, setData] = useState<TvData | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [timeStr, setTimeStr] = useState('');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        try {
            const result = await getTvDisplayData();
            setData(result);
            setLastUpdated(new Date());
        } catch (err) {
            console.error('TV Display load error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial load + 10s auto-refresh
    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 10000);
        return () => clearInterval(interval);
    }, [loadData]);

    // Live clock
    useEffect(() => {
        const updateClock = () => {
            const now = new Date();
            setTimeStr(now.toLocaleTimeString('tr-TR'));
        };
        updateClock();
        const timer = setInterval(updateClock, 1000);
        return () => clearInterval(timer);
    }, []);

    // Fullscreen handler
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(e => console.error(e));
        } else {
            document.exitFullscreen().then(() => setIsFullscreen(false)).catch(e => console.error(e));
        }
    };

    if (loading && !data) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', gap: '16px' }}>
                <div className="spinner" style={{ width: '48px', height: '48px' }} />
                <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-secondary)' }}>Cihaz Takip Listesi Yükleniyor...</div>
            </div>
        );
    }

    const todayFormatted = data?.todayDateStr ? formatDate(new Date(data.todayDateStr)) : formatDate(new Date());

    return (
        <div style={{
            minHeight: '100vh',
            background: '#0f172a',
            color: '#f8fafc',
            fontFamily: 'Inter, system-ui, sans-serif',
            padding: '20px 24px',
            boxSizing: 'border-box',
        }}>
            {/* Minimal Header */}
            <header style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#1e293b',
                padding: '14px 24px',
                borderRadius: '12px',
                border: '1px solid #334155',
                marginBottom: '20px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            }}>
                {/* Logo & Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <img
                        src="/logo-full.png"
                        alt="ZERO TV Ekran Değişim Servisi"
                        style={{ height: '48px', objectFit: 'contain' }}
                    />
                    <div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Servis Atölye Paneli</div>
                        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                            Cihaz Takip Listesi
                        </h1>
                    </div>
                </div>

                {/* Right Info: Date, Clock, Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>Tarih: <span style={{ color: '#ffffff', fontWeight: 600 }}>{todayFormatted}</span></div>
                        <div style={{ fontSize: '22px', fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace', letterSpacing: '1px' }}>
                            {timeStr || '--:--:--'}
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                            onClick={loadData}
                            title="Verileri Şimdi Yenile"
                            style={{
                                background: '#334155',
                                color: '#ffffff',
                                border: '1px solid #475569',
                                borderRadius: '8px',
                                padding: '8px 14px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontWeight: 600,
                            }}
                        >
                            🔄 Yenile
                        </button>
                        <button
                            onClick={toggleFullscreen}
                            title="Tam Ekran Modu"
                            style={{
                                background: isFullscreen ? 'rgba(239, 68, 68, 0.25)' : 'rgba(59, 130, 246, 0.25)',
                                color: isFullscreen ? '#fca5a5' : '#93c5fd',
                                border: `1px solid ${isFullscreen ? 'rgba(239, 68, 68, 0.5)' : 'rgba(59, 130, 246, 0.5)'}`,
                                borderRadius: '8px',
                                padding: '8px 14px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                            }}
                        >
                            {isFullscreen ? '⏹ Tam Ekrandan Çık' : '⛶ Tam Ekran Yap'}
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Layout Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>
                
                {/* LEFT SIDE: Waiting Table + Completed Table */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {/* 1. BEKLEYEN CİHAZLAR TABLOSU */}
                    <div style={{
                        background: '#1e293b',
                        borderRadius: '12px',
                        border: '1px solid #334155',
                        overflow: 'hidden',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    }}>
                        <div style={{
                            padding: '14px 20px',
                            background: '#243147',
                            borderBottom: '1px solid #334155',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}>
                            <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ color: '#38bdf8', fontSize: '18px' }}>⏳</span> Tamir Bekleyen Cihazlar
                                <span style={{ background: '#0f172a', color: '#38bdf8', padding: '3px 10px', borderRadius: '12px', fontSize: '13px', fontWeight: 700, border: '1px solid #38bdf8' }}>
                                    {data?.waitingCount || 0}
                                </span>
                            </h2>
                            <span style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: 500 }}>
                                En Acil / Eski Kayıtlar Üstte
                            </span>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                                <thead>
                                    <tr style={{ background: '#111827', color: '#94a3b8', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px', borderBottom: '1px solid #334155' }}>
                                        <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Öncelik</th>
                                        <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Cihaz Kodu</th>
                                        <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Müşteri Türü</th>
                                        <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Müşteri Adı</th>
                                        <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Marka</th>
                                        <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Model</th>
                                        <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Cihaz Durumu</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>Geliş Tarihi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(!data?.waitingTickets || data.waitingTickets.length === 0) ? (
                                        <tr>
                                            <td colSpan={8} style={{ padding: '28px', textAlign: 'center', color: '#94a3b8', fontSize: '14px', fontWeight: 500 }}>
                                                Tamir bekleyen cihaz bulunmuyor.
                                            </td>
                                        </tr>
                                    ) : (
                                        data.waitingTickets.map((t, idx) => {
                                            const customerName = t.customer?.name || t.repairer?.name || 'Müşteri';
                                            const customerTypeLabel = t.customerType === 'REPAIRER' ? 'Tamirci' : 'Srv. Müşteri';
                                            const isUrgent = t.priority === 'URGENT';
                                            const isPriority = t.priority === 'PRIORITY';

                                            return (
                                                <tr key={t.id} style={{
                                                    borderBottom: '1px solid #334155',
                                                    background: idx % 2 === 0 ? '#1e293b' : '#172234',
                                                }}>
                                                    {/* Öncelik */}
                                                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                                        {isUrgent ? (
                                                            <span style={{ background: 'rgba(239, 68, 68, 0.25)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '3px 9px', borderRadius: '4px', fontSize: '11px', fontWeight: 800 }}>ACİL</span>
                                                        ) : isPriority ? (
                                                            <span style={{ background: 'rgba(245, 158, 11, 0.25)', color: '#fde047', border: '1px solid rgba(245, 158, 11, 0.4)', padding: '3px 9px', borderRadius: '4px', fontSize: '11px', fontWeight: 800 }}>ÖNCELİKLİ</span>
                                                        ) : (
                                                            <span style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', border: '1px solid rgba(59, 130, 246, 0.35)', padding: '3px 9px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>Normal</span>
                                                        )}
                                                    </td>

                                                    {/* Cihaz Kodu */}
                                                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#ffffff', fontFamily: 'monospace', fontSize: '15px', whiteSpace: 'nowrap' }}>
                                                        {t.ticketNo}
                                                    </td>

                                                    {/* Müşteri Türü */}
                                                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                                        <span style={{
                                                            background: t.customerType === 'REPAIRER' ? 'rgba(234, 179, 8, 0.18)' : 'rgba(59, 130, 246, 0.18)',
                                                            color: t.customerType === 'REPAIRER' ? '#fde047' : '#7dd3fc',
                                                            padding: '3px 9px',
                                                            borderRadius: '4px',
                                                            fontSize: '11px',
                                                            fontWeight: 700,
                                                            border: `1px solid ${t.customerType === 'REPAIRER' ? 'rgba(234, 179, 8, 0.35)' : 'rgba(59, 130, 246, 0.35)'}`,
                                                        }}>
                                                            {customerTypeLabel}
                                                        </span>
                                                    </td>

                                                    {/* Müşteri Adı */}
                                                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap' }}>
                                                        {customerName}
                                                    </td>

                                                    {/* Marka */}
                                                    <td style={{ padding: '12px 14px', color: '#e2e8f0', whiteSpace: 'nowrap' }}>
                                                        {t.brand?.name || '-'}
                                                    </td>

                                                    {/* Model */}
                                                    <td style={{ padding: '12px 14px', color: '#cbd5e1', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                                                        {t.model}
                                                    </td>

                                                    {/* Cihaz Durumu */}
                                                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                                        <span style={{
                                                            background: 'rgba(148, 163, 184, 0.15)',
                                                            color: STATUS_COLORS[t.status as keyof typeof STATUS_COLORS] || '#ffffff',
                                                            border: '1px solid #475569',
                                                            padding: '4px 10px',
                                                            borderRadius: '6px',
                                                            fontWeight: 700,
                                                            fontSize: '12px',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                        }}>
                                                            {STATUS_LABELS[t.status as keyof typeof STATUS_LABELS] || t.status}
                                                        </span>
                                                    </td>

                                                    {/* Geliş Tarihi */}
                                                    <td style={{ padding: '12px 14px', textAlign: 'right', color: '#f87171', fontWeight: 700, fontFamily: 'monospace', fontSize: '13px', whiteSpace: 'nowrap' }}>
                                                        {formatDate(t.createdAt).slice(0, 5)}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 2. YAPILAN CİHAZLAR TABLOSU */}
                    <div style={{
                        background: '#1e293b',
                        borderRadius: '12px',
                        border: '1px solid #334155',
                        overflow: 'hidden',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    }}>
                        <div style={{
                            padding: '14px 20px',
                            background: '#243147',
                            borderBottom: '1px solid #334155',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}>
                            <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ color: '#34d399', fontSize: '18px' }}>✅</span> Yapılan / Tamamlanan Cihazlar
                                <span style={{ background: '#0f172a', color: '#34d399', padding: '3px 10px', borderRadius: '12px', fontSize: '13px', fontWeight: 700, border: '1px solid #34d399' }}>
                                    {data?.todayCompletedCount || 0}
                                </span>
                            </h2>
                            <span style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: 500 }}>
                                Bugüne Ait İşlemler
                            </span>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                                <thead>
                                    <tr style={{ background: '#111827', color: '#94a3b8', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px', borderBottom: '1px solid #334155' }}>
                                        <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Tarih / Saat</th>
                                        <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Cihaz Kodu</th>
                                        <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Teknisyen</th>
                                        <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Yapılan İşlem</th>
                                        <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Müşteri Adı</th>
                                        <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Marka / Model</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>Cihaz Durumu</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(!data?.completedTicketsToday || data.completedTicketsToday.length === 0) ? (
                                        <tr>
                                            <td colSpan={7} style={{ padding: '28px', textAlign: 'center', color: '#94a3b8', fontSize: '14px', fontWeight: 500 }}>
                                                Henüz işlemi tamamlanan cihaz bulunmuyor.
                                            </td>
                                        </tr>
                                    ) : (
                                        data.completedTicketsToday.map((t, idx) => {
                                            const customerName = t.customer?.name || t.repairer?.name || 'Müşteri';
                                            const timeStrFormatted = new Date(t.completedAt).toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
                                            const opLabel = REQUEST_TYPE_LABELS[t.lastOperationLabel as keyof typeof REQUEST_TYPE_LABELS] || t.lastOperationLabel;

                                            return (
                                                <tr key={t.id} style={{
                                                    borderBottom: '1px solid #334155',
                                                    background: idx % 2 === 0 ? '#1e293b' : '#172234',
                                                }}>
                                                    {/* Tarih / Saat */}
                                                    <td style={{ padding: '12px 14px', color: '#cbd5e1', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                                                        {timeStrFormatted}
                                                    </td>

                                                    {/* Cihaz Kodu */}
                                                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#ffffff', fontFamily: 'monospace', fontSize: '15px', whiteSpace: 'nowrap' }}>
                                                        {t.ticketNo}
                                                    </td>

                                                    {/* Teknisyen */}
                                                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#e2e8f0', whiteSpace: 'nowrap' }}>
                                                        👤 {t.technicianName}
                                                    </td>

                                                    {/* Yapılan İşlem */}
                                                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#38bdf8', whiteSpace: 'nowrap' }}>
                                                        🛠️ {opLabel}
                                                    </td>

                                                    {/* Müşteri Adı */}
                                                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap' }}>
                                                        {customerName}
                                                    </td>

                                                    {/* Marka / Model */}
                                                    <td style={{ padding: '12px 14px', color: '#e2e8f0', whiteSpace: 'nowrap' }}>
                                                        {[t.brand?.name, t.model].filter(Boolean).join(' ') || '-'}
                                                    </td>

                                                    {/* Durum */}
                                                    <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                        <span style={{
                                                            background: 'rgba(16, 185, 129, 0.2)',
                                                            color: '#6ee7b7',
                                                            border: '1px solid rgba(16, 185, 129, 0.4)',
                                                            padding: '4px 10px',
                                                            borderRadius: '6px',
                                                            fontWeight: 700,
                                                            fontSize: '12px',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                        }}>
                                                            İşlem Tamamlandı ✔
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>

                {/* RIGHT SIDEBAR: Metric Widgets */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* WIDGET 1: Toplam Yapılan Cihaz Sayısı - Günlük */}
                    <div style={{
                        background: '#1e293b',
                        borderRadius: '12px',
                        border: '1px solid #334155',
                        padding: '20px',
                        textAlign: 'center',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    }}>
                        <div style={{
                            color: '#34d399',
                            fontSize: '12px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.8px',
                            marginBottom: '10px',
                        }}>
                            BUGÜN TAMAMLANAN CİHAZ SAYISI
                        </div>
                        <div style={{
                            fontSize: '52px',
                            fontWeight: 900,
                            color: '#ffffff',
                            lineHeight: 1,
                        }}>
                            {data?.todayCompletedCount || 0}
                        </div>
                    </div>

                    {/* WIDGET 2: Toplam Tamir Bekleyen Cihaz Sayısı */}
                    <div style={{
                        background: '#1e293b',
                        borderRadius: '12px',
                        border: '1px solid #334155',
                        padding: '20px',
                        textAlign: 'center',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    }}>
                        <div style={{
                            color: '#38bdf8',
                            fontSize: '12px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.8px',
                            marginBottom: '10px',
                        }}>
                            TOPLAM TAMİR BEKLEYEN CİHAZ SAYISI
                        </div>
                        <div style={{
                            fontSize: '52px',
                            fontWeight: 900,
                            color: '#ffffff',
                            lineHeight: 1,
                            marginBottom: '16px',
                        }}>
                            {data?.waitingCount || 0}
                        </div>

                        {/* Breakdown: Müşteri vs Tamirci */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '8px',
                            background: '#111827',
                            padding: '12px',
                            borderRadius: '8px',
                            border: '1px solid #334155',
                        }}>
                            <div style={{ borderRight: '1px solid #334155' }}>
                                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Müşteri</div>
                                <div style={{ fontSize: '20px', fontWeight: 800, color: '#38bdf8' }}>{data?.waitingCustomerCount || 0}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Tamirci</div>
                                <div style={{ fontSize: '20px', fontWeight: 800, color: '#fde047' }}>{data?.waitingRepairerCount || 0}</div>
                            </div>
                        </div>
                    </div>

                    {/* WIDGET 3: Teknisyen Performans Listesi */}
                    <div style={{
                        background: '#1e293b',
                        borderRadius: '12px',
                        border: '1px solid #334155',
                        padding: '16px 18px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    }}>
                        <div style={{
                            color: '#cbd5e1',
                            fontSize: '12px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.8px',
                            marginBottom: '14px',
                            borderBottom: '1px solid #334155',
                            paddingBottom: '8px',
                            textAlign: 'center',
                        }}>
                            TEKNİSYEN PERFORMANSI (BUGÜN)
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {(!data?.technicianStats || data.technicianStats.length === 0) ? (
                                <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>Teknisyen tanımı bulunmuyor.</div>
                            ) : (
                                data.technicianStats.map((tech) => (
                                    <div
                                        key={tech.id}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '8px 12px',
                                            background: '#111827',
                                            borderRadius: '8px',
                                            border: '1px solid #334155',
                                            fontSize: '13px',
                                        }}
                                    >
                                        <span style={{ fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap' }}>
                                            👤 {tech.name}
                                        </span>
                                        <span style={{
                                            background: tech.completedCount > 0 ? 'rgba(52, 211, 153, 0.2)' : '#1e293b',
                                            color: tech.completedCount > 0 ? '#6ee7b7' : '#94a3b8',
                                            border: `1px solid ${tech.completedCount > 0 ? 'rgba(52, 211, 153, 0.4)' : '#334155'}`,
                                            padding: '2px 10px',
                                            borderRadius: '12px',
                                            fontWeight: 800,
                                            fontSize: '13px',
                                        }}>
                                            {tech.completedCount}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
}
