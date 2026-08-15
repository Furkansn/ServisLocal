'use client';

import { useState, useEffect, useTransition } from 'react';
import { getMyWorkOrders } from '@/actions/service-records';
import { REQUEST_TYPE_LABELS } from '@/lib/constants';
import Link from 'next/link';

type WorkOrder = Awaited<ReturnType<typeof getMyWorkOrders>>[0];

export default function ServiceMapPage() {
    const [orders, setOrders] = useState<WorkOrder[]>([]);
    const [isPending, startTransition] = useTransition();

    const loadOrders = () => {
        startTransition(async () => {
            try {
                const data = await getMyWorkOrders();
                setOrders(data);
            } catch (err: any) {
                console.error('Servis rotaları yüklenirken hata:', err);
            }
        });
    };

    useEffect(() => {
        loadOrders();
    }, []);

    const completedCount = orders.filter(o => o.status === 'COMPLETED').length;
    const activeOrders = orders.filter(o => o.status !== 'CANCELLED');

    // Build multi-destination Google Maps direction URL
    const buildFullRouteUrl = () => {
        if (activeOrders.length === 0) return '#';
        const addresses = activeOrders.map(o => {
            const c = o.ticket.customer || o.ticket.repairer;
            return encodeURIComponent(`${c?.address || ''} ${c?.district || ''} ${c?.city || ''}`);
        }).join('/');
        return `https://www.google.com/maps/dir/${addresses}`;
    };

    return (
        <div style={{ paddingBottom: '80px' }}>
            {/* Header Banner */}
            <div className="card" style={{ marginBottom: 'var(--space-3)', background: 'linear-gradient(135deg, var(--brand-primary), #1d4ed8)', color: '#ffffff', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: '12px', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Günlük Servis Rota Haritası</div>
                        <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '4px 0 0 0', color: '#ffffff' }}>
                            🗺️ {activeOrders.length} Duraklı Servis Rotası
                        </h2>
                    </div>
                    <button 
                        onClick={loadOrders}
                        style={{
                            background: 'rgba(255,255,255,0.2)',
                            border: '1px solid rgba(255,255,255,0.3)',
                            color: '#ffffff',
                            borderRadius: '8px',
                            padding: '6px 12px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 600
                        }}
                    >
                        🔄 Yenile
                    </button>
                </div>

                {/* Progress Bar */}
                <div style={{ marginTop: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px', opacity: 0.95 }}>
                        <span>Rota Tamamlanma Durumu</span>
                        <span><b>{completedCount}</b> / {activeOrders.length} Durak</span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.25)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{
                            width: `${activeOrders.length > 0 ? (completedCount / activeOrders.length) * 100 : 0}%`,
                            height: '100%',
                            background: '#4ade80',
                            transition: 'width 0.3s ease'
                        }} />
                    </div>
                </div>

                {/* Full Route Navigation Button */}
                {activeOrders.length > 0 && (
                    <a
                        href={buildFullRouteUrl()}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            marginTop: '14px',
                            background: '#ffffff',
                            color: 'var(--brand-primary)',
                            padding: '10px',
                            borderRadius: '8px',
                            fontWeight: 700,
                            fontSize: '13px',
                            textDecoration: 'none',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                    >
                        🚀 Tüm Rotayı Haritada Başlat (Google Maps)
                    </a>
                )}
            </div>

            {/* Empty State */}
            {activeOrders.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary)' }}>
                    <div style={{ fontSize: '40px', marginBottom: '12px' }}>🗺️</div>
                    <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--text-primary)' }}>Bugün İçin Servis Rotanız Boş</div>
                    <p style={{ fontSize: '13px', marginTop: '6px' }}>Bugüne atanmış herhangi bir servis durağınız bulunmuyor.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {activeOrders.map((order, idx) => {
                        const customer = order.ticket.customer || order.ticket.repairer;
                        const isCompleted = order.status === 'COMPLETED';
                        const isPickup = order.type === 'PICKUP';
                        const fullAddress = `${customer?.address || ''}, ${customer?.district || ''}/${customer?.city || ''}`;
                        const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
                        const yandexNaviUrl = `yandexnavi://map_search?text=${encodeURIComponent(fullAddress)}`;

                        return (
                            <div 
                                key={order.id} 
                                className="card" 
                                style={{ 
                                    padding: '14px', 
                                    opacity: isCompleted ? 0.75 : 1,
                                    borderLeft: `5px solid ${isCompleted ? 'var(--color-success)' : isPickup ? 'var(--brand-primary)' : '#8b5cf6'}`,
                                    position: 'relative'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <span style={{
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '50%',
                                            background: isCompleted ? 'var(--color-success)' : 'var(--brand-primary)',
                                            color: '#ffffff',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '12px',
                                            fontWeight: 800
                                        }}>
                                            {idx + 1}
                                        </span>
                                        <span style={{
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            background: isPickup ? 'rgba(59, 130, 246, 0.12)' : 'rgba(139, 92, 246, 0.12)',
                                            color: isPickup ? 'var(--brand-primary)' : '#8b5cf6'
                                        }}>
                                            {isPickup ? '📥 ALINACAK' : '📤 VERİLECEK'}
                                        </span>
                                        <Link href={`/tickets/${order.ticket.id}`} style={{ fontWeight: 700, fontSize: '14px', textDecoration: 'underline' }}>
                                            {order.ticket.ticketNo}
                                        </Link>
                                    </div>
                                    <span style={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        background: isCompleted ? '#dcfce7' : '#fef3c7',
                                        color: isCompleted ? '#15803d' : '#b45309'
                                    }}>
                                        {isCompleted ? '✓ Tamamlandı' : '⏳ Bekliyor'}
                                    </span>
                                </div>

                                {/* Customer Info */}
                                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                                    👤 {customer?.name || 'Müşteri'}
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.4 }}>
                                    📍 {fullAddress}
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '12px' }}>
                                    📺 {order.ticket.brand?.name} {order.ticket.model} · {REQUEST_TYPE_LABELS[order.ticket.requestType as keyof typeof REQUEST_TYPE_LABELS] || 'Cihaz'}
                                </div>

                                {/* Action Buttons */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', borderTop: '1px solid var(--border-primary)', paddingTop: '10px' }}>
                                    {customer?.phone ? (
                                        <a
                                            href={`tel:${customer.phone}`}
                                            className="btn btn-secondary btn-sm"
                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '11px', textDecoration: 'none' }}
                                        >
                                            📞 Ara
                                        </a>
                                    ) : (
                                        <button disabled className="btn btn-secondary btn-sm" style={{ opacity: 0.5, fontSize: '11px' }}>📞 Ara</button>
                                    )}
                                    
                                    <a
                                        href={googleMapsUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn btn-primary btn-sm"
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '11px', textDecoration: 'none' }}
                                    >
                                        📍 Google
                                    </a>

                                    <a
                                        href={yandexNaviUrl}
                                        className="btn btn-secondary btn-sm"
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '11px', textDecoration: 'none' }}
                                    >
                                        🧭 Yandex
                                    </a>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
