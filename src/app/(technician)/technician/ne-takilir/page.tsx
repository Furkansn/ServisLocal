'use client';

import { useState, useEffect, useTransition } from 'react';
import { searchCompatibilityRecords, getCompatibilityStats } from '@/actions/compatibility';

export default function MobileNeTakilirPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBrand, setSelectedBrand] = useState('ALL');
    const [stats, setStats] = useState<{ totalCount: number; brands: { brand: string; count: number }[] }>({ totalCount: 0, brands: [] });
    const [records, setRecords] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

    useEffect(() => {
        getCompatibilityStats().then(setStats).catch(console.error);
    }, []);

    const loadRecords = () => {
        setIsLoading(true);
        startTransition(async () => {
            try {
                const res = await searchCompatibilityRecords({
                    query: searchQuery,
                    brand: selectedBrand,
                    page: 1,
                    limit: 50,
                });
                setRecords(res.records);
                setTotal(res.total);
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        });
    };

    useEffect(() => {
        loadRecords();
    }, [searchQuery, selectedBrand]);

    return (
        <div style={{ padding: '14px', maxWidth: '840px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{
                padding: '12px 14px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                borderRadius: '10px',
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '22px' }}>💡</span>
                    <div>
                        <h1 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                            Ne Takılır? (Parça Rehberi)
                        </h1>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                            {stats.totalCount.toLocaleString('tr-TR')} adet geçmiş değişim & uyumluluk tecrübesi
                        </div>
                    </div>
                </div>
            </div>

            {/* Instant Search Bar */}
            <div style={{ marginBottom: '12px' }}>
                <input
                    type="text"
                    className="form-input"
                    placeholder="🔍 Model (49NU7100), Ekran Kodu (LSF490FN06), LED veya TCON ara..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ fontSize: '13px', padding: '10px 12px', width: '100%', borderRadius: '8px' }}
                />
            </div>

            {/* Quick Brand Filter Pills */}
            {stats.brands.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '12px', WebkitOverflowScrolling: 'touch' }}>
                    <button
                        className={`btn btn-xs ${selectedBrand === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setSelectedBrand('ALL')}
                        style={{ borderRadius: '16px', fontSize: '11px', padding: '3px 10px', flexShrink: 0 }}
                    >
                        Tümü ({stats.totalCount})
                    </button>
                    {stats.brands.slice(0, 12).map((b) => (
                        <button
                            key={b.brand}
                            className={`btn btn-xs ${selectedBrand === b.brand ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setSelectedBrand(selectedBrand === b.brand ? 'ALL' : b.brand)}
                            style={{ borderRadius: '16px', fontSize: '11px', padding: '3px 10px', flexShrink: 0 }}
                        >
                            {b.brand} ({b.count})
                        </button>
                    ))}
                </div>
            )}

            {/* Results Cards */}
            {isLoading ? (
                <div style={{ padding: '30px', textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto 12px' }} />
                    <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Uyumluluk verileri aranıyor...</div>
                </div>
            ) : records.length === 0 ? (
                <div className="empty-state" style={{ padding: '30px 16px' }}>
                    <div className="empty-state-icon" style={{ fontSize: '28px', marginBottom: '8px' }}>💡</div>
                    <div className="empty-state-title" style={{ fontSize: '14px' }}>
                        {searchQuery ? 'Aradığınız model/ekran koduna uygun tecrübe bulunamadı' : 'Uyumluluk kaydı bulunmuyor'}
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                        {searchQuery ? 'Farklı bir model numarası veya panel kodu yazarak tekrar deneyin.' : 'Web paneli üzerinden Excel dosyanızı yükleyebilirsiniz.'}
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {records.map((r) => (
                        <div
                            key={r.id}
                            className="card"
                            onClick={() => setSelectedRecord(r)}
                            style={{
                                padding: '12px',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                border: '1px solid var(--border-primary)',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                                <div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>{r.brand}</span>
                                    <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, fontFamily: 'monospace', color: 'var(--brand-primary)' }}>
                                        {r.model}
                                    </h3>
                                </div>
                                {r.screenAction && (
                                    <span className="badge badge-success" style={{ fontSize: '10.5px' }}>
                                        {r.screenAction}
                                    </span>
                                )}
                            </div>

                            {/* Screen compatibility */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '12px', background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: '6px', marginBottom: '6px' }}>
                                {r.originalScreen && (
                                    <div><span style={{ color: 'var(--text-tertiary)' }}>Orijinal Ekran:</span> <strong style={{ fontFamily: 'monospace' }}>{r.originalScreen}</strong></div>
                                )}
                                {r.installedScreen && (
                                    <div><span style={{ color: 'var(--text-tertiary)' }}>Takılan Ekran:</span> <strong style={{ fontFamily: 'monospace', color: 'var(--color-success)' }}>{r.installedScreen}</strong></div>
                                )}
                                {r.installedLed && (
                                    <div><span style={{ color: 'var(--text-tertiary)' }}>Takılan LED:</span> <strong style={{ fontFamily: 'monospace', color: '#d97706' }}>{r.installedLed}</strong></div>
                                )}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                <span>{r.tcon ? `TCON: ${r.tcon}` : ''}</span>
                                <span>{r.technicianName} · {r.date}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Selected Record Detail Modal */}
            {selectedRecord && (
                <div className="modal-overlay" onClick={() => setSelectedRecord(null)}>
                    <div className="modal" style={{ maxWidth: '480px', width: '95vw', padding: 0 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 className="modal-title" style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>
                                💡 {selectedRecord.brand} {selectedRecord.model} Detayı
                            </h3>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setSelectedRecord(null)}>✕</button>
                        </div>
                        <div className="modal-body" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px' }}>
                            <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                <div style={{ fontSize: '10.5px', color: 'var(--text-tertiary)' }}>MARKA & MODEL</div>
                                <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--brand-primary)', fontFamily: 'monospace' }}>
                                    {selectedRecord.brand} {selectedRecord.model}
                                </div>
                                {selectedRecord.tcon && <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>TCON: {selectedRecord.tcon}</div>}
                            </div>

                            <div style={{ padding: '10px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '8px' }}>
                                <div style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: 700, marginBottom: '4px' }}>📱 EKRAN BİLGİSİ</div>
                                <div><strong>Orijinal:</strong> <span style={{ fontFamily: 'monospace' }}>{selectedRecord.originalScreen || '-'}</span></div>
                                <div><strong>Takılan:</strong> <span style={{ fontFamily: 'monospace', color: 'var(--color-success)', fontWeight: 700 }}>{selectedRecord.installedScreen || '-'}</span></div>
                                {selectedRecord.screenAction && <div style={{ marginTop: '4px' }}><strong>İşlem:</strong> <span className="badge badge-success">{selectedRecord.screenAction}</span></div>}
                            </div>

                            {selectedRecord.installedLed && (
                                <div style={{ padding: '10px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '11px', color: '#d97706', fontWeight: 700, marginBottom: '4px' }}>💡 LED BİLGİSİ</div>
                                    <div><strong>Takılan LED:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{selectedRecord.installedLed}</span></div>
                                    {selectedRecord.ledAction && <div><strong>İşlem:</strong> {selectedRecord.ledAction}</div>}
                                </div>
                            )}

                            {selectedRecord.notes && (
                                <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '10.5px', color: 'var(--text-tertiary)' }}>BİLGİ NOTU</div>
                                    <div style={{ marginTop: '2px', whiteSpace: 'pre-wrap' }}>{selectedRecord.notes}</div>
                                </div>
                            )}

                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-primary)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                                <span>Teknisyen: {selectedRecord.technicianName || '-'}</span>
                                <span>Tarih: {selectedRecord.date || '-'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
