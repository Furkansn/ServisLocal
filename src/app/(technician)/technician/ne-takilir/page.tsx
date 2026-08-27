'use client';

import { useState, useEffect, useTransition } from 'react';
import { searchCompatibilityRecords, getCompatibilityStats, getModelCompatibilitySummary } from '@/actions/compatibility';
import NeTakilirDashboardPage from '@/app/(dashboard)/ne-takilir/page';

function formatDateValue(val: any): string {
    if (!val) return '-';
    const str = String(val).trim();
    if (/^\d{4,5}(\.\d+)?$/.test(str)) {
        const num = parseFloat(str);
        const dateObj = new Date(Math.round((num - 25569) * 86400 * 1000));
        if (!isNaN(dateObj.getTime())) {
            return dateObj.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
    }
    return str;
}

function isValidValue(val: any): boolean {
    if (!val) return false;
    const str = String(val).trim().toLowerCase();
    return str !== '' && str !== 'false' && str !== 'true' && str !== 'null' && str !== 'undefined' && str !== '-';
}

export default function MobileNeTakilirPage() {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBrand, setSelectedBrand] = useState('ALL');
    const [stats, setStats] = useState<{ totalCount: number; brands: { brand: string; count: number }[] }>({ totalCount: 0, brands: [] });
    const [records, setRecords] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

    // Model Summary Modal State
    const [selectedModelName, setSelectedModelName] = useState<string | null>(null);
    const [modelSummaryData, setModelSummaryData] = useState<any | null>(null);
    const [isLoadingModelSummary, setIsLoadingModelSummary] = useState(false);

    const handleOpenModelSummary = async (modelName: string) => {
        if (!modelName) return;
        setSelectedModelName(modelName);
        setIsLoadingModelSummary(true);
        try {
            const res = await getModelCompatibilitySummary(modelName);
            setModelSummaryData(res);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingModelSummary(false);
        }
    };

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

    if (!isMobile) {
        return <NeTakilirDashboardPage />;
    }

    return (
        <div style={{ padding: '14px', maxWidth: '840px', margin: '0 auto', overflowX: 'hidden' }}>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '100%', overflow: 'hidden' }}>
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
                                maxWidth: '100%',
                                boxSizing: 'border-box',
                                overflow: 'hidden',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>
                                        {r.brand || '-'}
                                    </span>
                                    <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, fontFamily: 'monospace', color: 'var(--brand-primary)', wordBreak: 'break-word' }}>
                                        {r.model || '-'}
                                    </h3>
                                </div>
                                {isValidValue(r.screenAction) && (
                                    <span
                                        className="badge badge-success"
                                        style={{
                                            fontSize: '10.5px',
                                            maxWidth: '160px',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            display: 'inline-block',
                                            flexShrink: 0,
                                        }}
                                        title={r.screenAction}
                                    >
                                        {r.screenAction}
                                    </span>
                                )}
                            </div>

                            {/* Screen compatibility */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: '6px', marginBottom: '8px', wordBreak: 'break-word' }}>
                                {isValidValue(r.originalScreen) && (
                                    <div><span style={{ color: 'var(--text-tertiary)' }}>Orijinal Ekran:</span> <strong style={{ fontFamily: 'monospace' }}>{r.originalScreen}</strong></div>
                                )}
                                {isValidValue(r.installedScreen) && (
                                    <div><span style={{ color: 'var(--text-tertiary)' }}>Takılan Ekran:</span> <strong style={{ fontFamily: 'monospace', color: 'var(--color-success)' }}>{r.installedScreen}</strong></div>
                                )}
                                {isValidValue(r.installedLed) && (
                                    <div><span style={{ color: 'var(--text-tertiary)' }}>Takılan LED:</span> <strong style={{ fontFamily: 'monospace', color: '#d97706' }}>{r.installedLed}</strong></div>
                                )}
                                {isValidValue(r.screenAction) && String(r.screenAction).length > 25 && (
                                    <div style={{ fontSize: '11px', color: 'var(--color-success)', marginTop: '2px', borderTop: '1px dashed var(--border-primary)', paddingTop: '4px', whiteSpace: 'pre-wrap' }}>
                                        📝 {r.screenAction}
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-tertiary)', flexWrap: 'wrap', gap: '4px' }}>
                                <span>{isValidValue(r.tcon) ? `TCON: ${r.tcon}` : ''}</span>
                                <span>{isValidValue(r.technicianName) ? r.technicianName : ''} {isValidValue(r.date) ? `· ${formatDateValue(r.date)}` : ''}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Selected Record Detail Modal */}
            {selectedRecord && (
                <div className="modal-overlay" onClick={() => setSelectedRecord(null)}>
                    <div className="modal" style={{ maxWidth: '520px', width: '92vw', maxHeight: '90vh', overflowY: 'auto', padding: 0 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 className="modal-title" style={{ fontSize: '14px', fontWeight: 700, margin: 0, wordBreak: 'break-word' }}>
                                💡 {selectedRecord.brand} {selectedRecord.model} Detayı
                            </h3>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setSelectedRecord(null)}>✕</button>
                        </div>
                        <div className="modal-body" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px', wordBreak: 'break-word' }}>
                            <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                <div style={{ fontSize: '10.5px', color: 'var(--text-tertiary)' }}>MARKA & MODEL</div>
                                <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--brand-primary)', fontFamily: 'monospace', wordBreak: 'break-word' }}>
                                    {selectedRecord.brand} {selectedRecord.model}
                                </div>
                                {isValidValue(selectedRecord.tcon) && <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>TCON: {selectedRecord.tcon}</div>}
                            </div>

                            <div style={{ padding: '10px 12px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '8px' }}>
                                <div style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: 700, marginBottom: '6px' }}>📱 EKRAN BİLGİSİ</div>
                                {isValidValue(selectedRecord.originalScreen) && (
                                    <div style={{ marginBottom: '4px' }}><strong>Orijinal:</strong> <span style={{ fontFamily: 'monospace' }}>{selectedRecord.originalScreen}</span></div>
                                )}
                                {isValidValue(selectedRecord.installedScreen) && (
                                    <div style={{ marginBottom: '4px' }}><strong>Takılan:</strong> <span style={{ fontFamily: 'monospace', color: 'var(--color-success)', fontWeight: 700 }}>{selectedRecord.installedScreen}</span></div>
                                )}
                                {isValidValue(selectedRecord.screenAction) && (
                                    <div style={{ marginTop: '6px', fontSize: '12px', background: 'rgba(16, 185, 129, 0.12)', padding: '6px 10px', borderRadius: '6px', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                                        <strong>İşlem Notu:</strong> {selectedRecord.screenAction}
                                    </div>
                                )}
                            </div>

                            {isValidValue(selectedRecord.installedLed) && (
                                <div style={{ padding: '10px 12px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '11px', color: '#d97706', fontWeight: 700, marginBottom: '6px' }}>💡 LED BİLGİSİ</div>
                                    <div><strong>Takılan LED:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{selectedRecord.installedLed}</span></div>
                                    {isValidValue(selectedRecord.ledAction) && <div style={{ marginTop: '4px', whiteSpace: 'pre-wrap' }}><strong>İşlem:</strong> {selectedRecord.ledAction}</div>}
                                </div>
                            )}

                            {isValidValue(selectedRecord.notes) && (
                                <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '10.5px', color: 'var(--text-tertiary)' }}>BİLGİ NOTU</div>
                                    <div style={{ marginTop: '2px', whiteSpace: 'pre-wrap' }}>{selectedRecord.notes}</div>
                                </div>
                            )}

                            {isValidValue(selectedRecord.panelData) && (
                                <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '10.5px', color: 'var(--text-tertiary)' }}>PANEL DATASI</div>
                                    <div style={{ marginTop: '2px', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{selectedRecord.panelData}</div>
                                </div>
                            )}

                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-primary)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                                <span>Teknisyen: {isValidValue(selectedRecord.technicianName) ? selectedRecord.technicianName : '-'}</span>
                                <span>Tarih: {formatDateValue(selectedRecord.date)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Model Summary */}
            {selectedModelName && (
                <div className="modal-overlay" onClick={() => { setSelectedModelName(null); setModelSummaryData(null); }}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', width: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div className="modal-header">
                            <div>
                                <h3 className="modal-title" style={{ fontSize: '14px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    📺 {selectedModelName} — Ekran & LED Özeti
                                </h3>
                                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                    Bu modelde daha önce sökülen ve takılan parçalar
                                </div>
                            </div>
                            <button className="modal-close" onClick={() => { setSelectedModelName(null); setModelSummaryData(null); }}>×</button>
                        </div>

                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}>
                            {isLoadingModelSummary || !modelSummaryData ? (
                                <div style={{ padding: '30px', textAlign: 'center' }}>
                                    <div className="spinner" style={{ margin: '0 auto 8px' }} />
                                    <div>Model özeti yükleniyor...</div>
                                </div>
                            ) : (
                                <>
                                    {/* Summary Cards */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {/* Original Screens */}
                                        <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
                                            <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                                                📤 Çıkan Orijinal Ekranlar
                                            </div>
                                            {modelSummaryData.originalScreens.length === 0 ? (
                                                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Kayıt yok</div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    {modelSummaryData.originalScreens.map((item: any) => (
                                                        <div key={item.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', fontFamily: 'monospace', padding: '3px 6px', background: 'var(--bg-tertiary)', borderRadius: '4px' }}>
                                                            <span style={{ fontWeight: 600 }}>{item.code}</span>
                                                            <span className="badge badge-secondary" style={{ fontSize: '10px' }}>{item.count} Kez</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Installed Compatible Screens */}
                                        <div style={{ padding: '10px', background: 'rgba(16, 185, 129, 0.06)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                                            <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--color-success)', textTransform: 'uppercase', marginBottom: '6px' }}>
                                                📥 Takılan Uyumlu Ekranlar
                                            </div>
                                            {modelSummaryData.installedScreens.length === 0 ? (
                                                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Kayıt yok</div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    {modelSummaryData.installedScreens.map((item: any) => (
                                                        <div key={item.code} style={{ fontSize: '11.5px', padding: '5px 6px', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-primary)' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'monospace' }}>
                                                                <span style={{ fontWeight: 700, color: 'var(--color-success)' }}>{item.code}</span>
                                                                <span className="badge badge-success" style={{ fontSize: '10px' }}>{item.count} Kez Takıldı</span>
                                                            </div>
                                                            {item.actions.length > 0 && (
                                                                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                                                    {item.actions.join(', ')}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Installed LED Sets */}
                                        {modelSummaryData.installedLeds.length > 0 && (
                                            <div style={{ padding: '10px', background: 'rgba(245, 158, 11, 0.06)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                                                <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#d97706', textTransform: 'uppercase', marginBottom: '6px' }}>
                                                    💡 Takılan LED Setleri
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    {modelSummaryData.installedLeds.map((item: any) => (
                                                        <div key={item.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', fontFamily: 'monospace', padding: '3px 6px', background: 'var(--bg-tertiary)', borderRadius: '4px' }}>
                                                            <span style={{ fontWeight: 600, color: '#d97706' }}>{item.code}</span>
                                                            <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', fontSize: '10px' }}>{item.count} Kez</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* History Records */}
                                    <div>
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                            📋 Tüm Geçmiş Tamir Kayıtları ({modelSummaryData.records.length})
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                                            {modelSummaryData.records.map((r: any) => (
                                                <div
                                                    key={r.id}
                                                    onClick={() => setSelectedRecord(r)}
                                                    style={{
                                                        padding: '8px 10px',
                                                        background: 'var(--bg-secondary)',
                                                        borderRadius: '6px',
                                                        border: '1px solid var(--border-primary)',
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, marginBottom: '2px' }}>
                                                        <span style={{ fontFamily: 'monospace', color: 'var(--brand-primary)' }}>#{r.legacyTicketNo || '-'}</span>
                                                        <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>{formatDateValue(r.date)}</span>
                                                    </div>
                                                    {isValidValue(r.originalScreen) && <div style={{ fontSize: '10.5px' }}>Çıkan: <span style={{ fontFamily: 'monospace' }}>{r.originalScreen}</span></div>}
                                                    {isValidValue(r.installedScreen) && <div style={{ fontSize: '10.5px', color: 'var(--color-success)', fontWeight: 600 }}>Takılan: <span style={{ fontFamily: 'monospace' }}>{r.installedScreen}</span></div>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

