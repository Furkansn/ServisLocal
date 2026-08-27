'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
    importCompatibilityBatch,
    searchCompatibilityRecords,
    getCompatibilityStats,
    clearAllCompatibilityRecords,
    CompatibilityImportRecord
} from '@/actions/compatibility';

function formatDateValue(val: any): string {
    if (!val) return '-';
    const str = String(val).trim();
    if (!str || str === 'false' || str === 'true') return '-';

    const num = Number(str);
    if (!isNaN(num) && num > 30000 && num < 60000) {
        const jsDate = new Date(Math.round((num - 25569) * 86400 * 1000));
        const day = String(jsDate.getUTCDate()).padStart(2, '0');
        const month = String(jsDate.getUTCMonth() + 1).padStart(2, '0');
        const year = jsDate.getUTCFullYear();
        return `${day}.${month}.${year}`;
    }
    return str;
}

function isValidValue(val: any): boolean {
    if (!val) return false;
    const str = String(val).trim().toLowerCase();
    return str !== '' && str !== 'false' && str !== 'true' && str !== 'null' && str !== 'undefined' && str !== '-';
}

export default function NeTakilirDashboardPage() {
    const [stats, setStats] = useState<{ totalCount: number; brands: { brand: string; count: number }[] }>({ totalCount: 0, brands: [] });
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBrand, setSelectedBrand] = useState('ALL');
    const [page, setPage] = useState(1);

    const [data, setData] = useState<{ total: number; page: number; totalPages: number; records: any[] }>({ total: 0, page: 1, totalPages: 1, records: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    // Excel import state
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [importedCount, setImportedCount] = useState(0);
    const [totalToImport, setTotalToImport] = useState(0);
    const [importError, setImportError] = useState('');
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Selected record detail modal
    const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

    const loadStats = async () => {
        try {
            const res = await getCompatibilityStats();
            setStats(res);
        } catch (e) { console.error(e); }
    };

    const loadRecords = (showSpinner = true) => {
        if (showSpinner) setIsLoading(true);
        startTransition(async () => {
            try {
                const res = await searchCompatibilityRecords({
                    query: searchQuery,
                    brand: selectedBrand,
                    page,
                    limit: 30,
                });
                setData(res);
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        });
    };

    useEffect(() => {
        loadStats();
    }, []);

    useEffect(() => {
        loadRecords(true);
    }, [searchQuery, selectedBrand, page]);

    // Handle File Parse & Batch Import
    const processExcelFile = async (file: File) => {
        setImportError('');
        setIsImporting(true);
        setImportProgress(0);
        setImportedCount(0);

        try {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            // Convert to JSON array of objects
            const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

            if (!rawRows || rawRows.length === 0) {
                throw new Error('Yüklenen dosya boş veya geçersiz formatta!');
            }

            // Map keys flexibly (fuzzy matching headers)
            const mappedRecords: CompatibilityImportRecord[] = rawRows.map(row => {
                const getVal = (...possibleKeys: string[]) => {
                    for (const key of possibleKeys) {
                        const exactKey = Object.keys(row).find(k => k.trim().toLowerCase() === key.toLowerCase());
                        if (exactKey && row[exactKey] !== undefined && row[exactKey] !== null) {
                            return String(row[exactKey]).trim();
                        }
                    }
                    return '';
                };

                return {
                    legacyTicketNo: getVal('FİS NO', 'FIS NO', 'Fiş No', 'ticketNo'),
                    date: getVal('Demo/Tarih', 'Tarih', 'Date'),
                    technicianName: getVal('Demo/Teknisyen', 'Teknisyen', 'Technician'),
                    brand: getVal('Demo/Marka', 'Marka', 'Brand'),
                    model: getVal('Demo/Model', 'Model'),
                    tcon: getVal('Demo/Tcon', 'Tcon', 'T-Con'),
                    originalScreen: getVal('Demo/Orijinal Ekranı', 'Orijinal Ekranı', 'Orijinal Ekran', 'OriginalScreen'),
                    installedScreen: getVal('Demo/Takılan Ekran', 'Takılan Ekran', 'InstalledScreen'),
                    screenAction: getVal('Demo/Yapılan İşlem-Ekran', 'Yapılan İşlem-Ekran', 'Yapılan İşlem Ekran'),
                    installedLed: getVal('Demo/Takılan Led', 'Takılan Led', 'InstalledLed'),
                    ledAction: getVal('Demo/Yapılan İşlem - Led', 'Yapılan İşlem - Led', 'Yapılan İşlem Led'),
                    installedQuantity: getVal('Demo/Takılan Adet 1', 'Takılan Adet', 'Takılan Adet 1'),
                    transactionType: getVal('Demo/İşlem Türü', 'İşlem Türü'),
                    notes: getVal('Demo/Bilgi Notu', 'Bilgi Notu', 'Not'),
                    panelData: getVal('PANEL DATASI', 'Panel Datası', 'Panel'),
                    rowId: getVal('🔒 Row ID', 'Row ID', 'rowId'),
                };
            });

            setTotalToImport(mappedRecords.length);

            // Import in batches of 500
            const batchSize = 500;
            let totalSaved = 0;

            for (let i = 0; i < mappedRecords.length; i += batchSize) {
                const chunk = mappedRecords.slice(i, i + batchSize);
                const res = await importCompatibilityBatch(chunk);
                totalSaved += res.count;
                setImportedCount(totalSaved);
                setImportProgress(Math.round(((i + chunk.length) / mappedRecords.length) * 100));
            }

            await loadStats();
            loadRecords(false);
            setShowUploadModal(false);
            alert(`🎉 Tebrikler! Toplam ${totalSaved} adet geçmiş tamir ve uyumluluk kaydı başarıyla yüklendi.`);

        } catch (err: any) {
            console.error(err);
            setImportError('Dosya işlenirken hata oluştu: ' + (err.message || err));
        } finally {
            setIsImporting(false);
        }
    };

    const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processExcelFile(e.dataTransfer.files[0]);
        }
    };

    const handleClearAll = async () => {
        if (!confirm('⚠️ DIKKAT! Tüm "Ne Takılır?" uyumluluk verileri kalıcı olarak silinecektir. Devam etmek istediğinize emin misiniz?')) return;
        try {
            await clearAllCompatibilityRecords();
            loadStats();
            loadRecords(false);
            alert('Tüm uyumluluk verileri temizlendi.');
        } catch (err: any) { alert(err.message); }
    };

    return (
        <div style={{ padding: 'var(--space-6)', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header Banner */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-6)',
                flexWrap: 'wrap',
                gap: 'var(--space-4)',
            }}>
                <div>
                    <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        💡 Ne Takılır? (Ekran & LED Uyumluluk Rehberi)
                    </h1>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
                        Geçmiş tamir tecrübeleri, TV model/ekran değişim notları ve panel uyumluluk veritabanı
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setShowUploadModal(true)}
                        style={{ background: '#10b981', borderColor: '#059669', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                    >
                        📥 Excel / CSV Yükle
                    </button>
                    {stats.totalCount > 0 && (
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={handleClearAll}
                            style={{ color: 'var(--color-danger)', fontSize: '12px' }}
                            title="Tüm verileri temizle"
                        >
                            🗑️ Verileri Temizle
                        </button>
                    )}
                </div>
            </div>

            {/* Quick Stats Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                <div className="card" style={{ padding: 'var(--space-4)', borderLeft: '4px solid var(--brand-primary)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Toplam Uyumluluk Kaydı</div>
                    <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--brand-primary)', marginTop: '4px' }}>
                        {stats.totalCount.toLocaleString('tr-TR')} Satır
                    </div>
                </div>

                <div className="card" style={{ padding: 'var(--space-4)', borderLeft: '4px solid var(--color-success)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Kayıtlı Marka Sayısı</div>
                    <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--color-success)', marginTop: '4px' }}>
                        {stats.brands.length} Marka
                    </div>
                </div>
            </div>

            {/* Filters & Instant Search */}
            <div className="card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: 2, minWidth: '280px' }}>
                        <label style={{ fontSize: '12px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>Arama</label>
                        <input
                            type="text"
                            className="input"
                            placeholder="🔍 Model (49NU7100), Ekran Kodu (LSF490FN06), LED, TCON veya Not ara..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                        />
                    </div>

                    <div style={{ minWidth: '180px' }}>
                        <label style={{ fontSize: '12px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>Marka Filtresi</label>
                        <select
                            className="input"
                            value={selectedBrand}
                            onChange={(e) => { setSelectedBrand(e.target.value); setPage(1); }}
                        >
                            <option value="ALL">🌐 Tüm Markalar ({stats.totalCount})</option>
                            {stats.brands.map(b => (
                                <option key={b.brand} value={b.brand}>{b.brand} ({b.count})</option>
                            ))}
                        </select>
                    </div>

                    {searchQuery && (
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => { setSearchQuery(''); setSelectedBrand('ALL'); setPage(1); }}
                            style={{ alignSelf: 'flex-end', marginBottom: '2px', fontSize: '12px' }}
                        >
                            ✕ Temizle
                        </button>
                    )}
                </div>
            </div>

            {/* Results Table */}
            {isLoading ? (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto 16px' }} />
                    <div>Uyumluluk kayıtları yükleniyor...</div>
                </div>
            ) : data.records.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px' }}>
                    <div className="empty-state-icon" style={{ fontSize: '36px' }}>💡</div>
                    <div className="empty-state-title" style={{ fontSize: '16px' }}>
                        {searchQuery ? 'Aramanıza uygun kayıt bulunamadı' : 'Henüz hiç uyumluluk kaydı yüklenmemiş'}
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', maxWidth: '400px', margin: '8px auto' }}>
                        {searchQuery ? 'Farklı bir model veya ekran kodu ile tekrar arayın.' : 'Üstteki "Excel / CSV Yükle" butonuna tıklayarak eski programınızdaki 8.000 satırlık verinizi yükleyebilirsiniz.'}
                    </p>
                </div>
            ) : (
                <>
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Marka & Model</th>
                                    <th>Orijinal Ekran (Panel)</th>
                                    <th>Takılan Uyumlu Ekran</th>
                                    <th>Ekran İşlem Notu</th>
                                    <th>Takılan LED Seti</th>
                                    <th>TCON</th>
                                    <th>İşlem / Tarih</th>
                                    <th>Detay</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.records.map((r) => (
                                    <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedRecord(r)}>
                                        <td>
                                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{r.brand || '-'}</div>
                                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--brand-primary)', fontFamily: 'monospace' }}>
                                                {r.model || '-'}
                                            </div>
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 600 }}>
                                            {r.originalScreen || '-'}
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '12px', color: '#10b981', fontWeight: 600 }}>
                                            {r.installedScreen || '-'}
                                        </td>
                                        <td>
                                            {r.screenAction ? (
                                                <span className="badge badge-success" style={{ fontSize: '11px' }}>
                                                    {r.screenAction}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '12px', color: '#d97706' }}>
                                            {r.installedLed || '-'}
                                        </td>
                                        <td style={{ fontSize: '12px' }}>{r.tcon || '-'}</td>
                                        <td style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                            <div>{isValidValue(r.technicianName) ? r.technicianName : '-'}</div>
                                            <div>{formatDateValue(r.date)}</div>
                                        </td>
                                        <td>
                                            <button className="btn btn-ghost btn-xs" style={{ color: 'var(--brand-primary)' }}>
                                                🔍 İncele
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {data.totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-4)' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                                Toplam <strong>{data.total.toLocaleString('tr-TR')}</strong> kayıttan <strong>{(page - 1) * 30 + 1}-{Math.min(page * 30, data.total)}</strong> arası gösteriliyor
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                                    ◀ Önceki
                                </button>
                                <span style={{ padding: '4px 12px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                                    {page} / {data.totalPages}
                                </span>
                                <button className="btn btn-secondary btn-sm" disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)}>
                                    Sonraki ▶
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Modal: Excel Upload */}
            {showUploadModal && (
                <div className="modal-overlay" onClick={() => !isImporting && setShowUploadModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">📥 Excel / CSV Dosyası Yükle</h3>
                            {!isImporting && <button className="modal-close" onClick={() => setShowUploadModal(false)}>×</button>}
                        </div>
                        <div className="modal-body">
                            {importError && (
                                <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)', borderRadius: '8px', marginBottom: '14px', fontSize: '13px' }}>
                                    {importError}
                                </div>
                            )}

                            {!isImporting ? (
                                <>
                                    <div
                                        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                                        onDragLeave={() => setDragActive(false)}
                                        onDrop={handleFileDrop}
                                        onClick={() => fileInputRef.current?.click()}
                                        style={{
                                            border: `2px dashed ${dragActive ? 'var(--brand-primary)' : 'var(--border-primary)'}`,
                                            background: dragActive ? 'rgba(59,130,246,0.08)' : 'var(--bg-secondary)',
                                            borderRadius: '12px',
                                            padding: '36px 20px',
                                            textAlign: 'center',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            marginBottom: '16px',
                                        }}
                                    >
                                        <div style={{ fontSize: '42px', marginBottom: '10px' }}>📊</div>
                                        <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>
                                            Excel veya CSV dosyanızı buraya sürükleyin
                                        </div>
                                        <div style={{ fontSize: '12.5px', color: 'var(--text-tertiary)' }}>
                                            veya bilgisayarınızdan dosya seçmek için tıklayın (.xlsx, .xls, .csv)
                                        </div>
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".xlsx,.xls,.csv"
                                        style={{ display: 'none' }}
                                        onChange={(e) => {
                                            if (e.target.files && e.target.files[0]) processExcelFile(e.target.files[0]);
                                        }}
                                    />
                                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: '8px' }}>
                                        💡 <strong>Bilgi:</strong> Eski programınızdan aldığınız ~8.000 satırlık dosyayı doğrudan yükleyebilirsiniz. Sütun başlıkları (FİS NO, Marka, Model, Orijinal Ekran, Takılan Ekran, Yapılan İşlem-Ekran, Takılan Led...) otomatik olarak tanınacaktır.
                                    </div>
                                </>
                            ) : (
                                <div style={{ padding: '20px 10px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
                                    <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '6px' }}>
                                        Kayıtlar Yükleniyor... (%{importProgress})
                                    </div>
                                    <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>
                                        {importedCount.toLocaleString('tr-TR')} / {totalToImport.toLocaleString('tr-TR')} satır veritabanına aktarıldı
                                    </div>

                                    {/* Progress Bar */}
                                    <div style={{ width: '100%', height: '12px', background: 'var(--bg-secondary)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-primary)' }}>
                                        <div style={{ width: `${importProgress}%`, height: '100%', background: '#10b981', transition: 'width 0.2s ease' }} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Record Detail */}
            {selectedRecord && (
                <div className="modal-overlay" onClick={() => setSelectedRecord(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">💡 {selectedRecord.brand} {selectedRecord.model} — Uyumluluk Detayı</h3>
                            <button className="modal-close" onClick={() => setSelectedRecord(null)}>×</button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', wordBreak: 'break-word' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>MARKA & MODEL</div>
                                    <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--brand-primary)' }}>{selectedRecord.brand} {selectedRecord.model}</div>
                                </div>
                                <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>TCON</div>
                                    <div style={{ fontWeight: 600 }}>{isValidValue(selectedRecord.tcon) ? selectedRecord.tcon : '-'}</div>
                                </div>
                            </div>

                            <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '8px' }}>
                                <div style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: 700, marginBottom: '6px' }}>📱 EKRAN UYUMLULUK BİLGİSİ</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {isValidValue(selectedRecord.originalScreen) && <div><strong>Orijinal Ekran:</strong> <span style={{ fontFamily: 'monospace' }}>{selectedRecord.originalScreen}</span></div>}
                                    {isValidValue(selectedRecord.installedScreen) && <div><strong>Takılan Ekran:</strong> <span style={{ fontFamily: 'monospace', color: 'var(--color-success)', fontWeight: 700 }}>{selectedRecord.installedScreen}</span></div>}
                                    {isValidValue(selectedRecord.screenAction) && (
                                        <div style={{ marginTop: '6px', fontSize: '12px', background: 'rgba(16, 185, 129, 0.12)', padding: '8px 10px', borderRadius: '6px', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                                            <strong>Yapılan İşlem:</strong> {selectedRecord.screenAction}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {isValidValue(selectedRecord.installedLed) && (
                                <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '11px', color: '#d97706', fontWeight: 700, marginBottom: '6px' }}>💡 LED UYUMLULUK BİLGİSİ</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div><strong>Takılan LED Seti:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{selectedRecord.installedLed}</span></div>
                                        {isValidValue(selectedRecord.ledAction) && <div style={{ marginTop: '4px', whiteSpace: 'pre-wrap' }}><strong>LED İşlemi:</strong> {selectedRecord.ledAction}</div>}
                                        {isValidValue(selectedRecord.installedQuantity) && <div><strong>Adet:</strong> {selectedRecord.installedQuantity}</div>}
                                    </div>
                                </div>
                            )}

                            {isValidValue(selectedRecord.notes) && (
                                <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>BİLGİ NOTU</div>
                                    <div style={{ whiteSpace: 'pre-wrap', marginTop: '2px' }}>{selectedRecord.notes}</div>
                                </div>
                            )}

                            {isValidValue(selectedRecord.panelData) && (
                                <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>PANEL DATASI</div>
                                    <div style={{ fontFamily: 'monospace', marginTop: '2px', fontSize: '12px', whiteSpace: 'pre-wrap' }}>{selectedRecord.panelData}</div>
                                </div>
                            )}

                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-primary)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                                <span>Eski Fiş No: #{isValidValue(selectedRecord.legacyTicketNo) ? selectedRecord.legacyTicketNo : '-'}</span>
                                <span>Teknisyen: {isValidValue(selectedRecord.technicianName) ? selectedRecord.technicianName : '-'} · Tarih: {formatDateValue(selectedRecord.date)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
