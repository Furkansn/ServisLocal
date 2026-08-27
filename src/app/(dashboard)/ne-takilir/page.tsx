'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
    importCompatibilityBatch,
    searchCompatibilityRecords,
    getCompatibilityStats,
    clearAllCompatibilityRecords,
    getModelCompatibilitySummary,
    CompatibilityImportRecord
} from '@/actions/compatibility';

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

export default function NeTakilirDashboardPage({ readOnly = false }: { readOnly?: boolean }) {
    const [stats, setStats] = useState<{ totalCount: number; brands: { brand: string; count: number }[]; screenActions?: { action: string; count: number }[] }>({ totalCount: 0, brands: [], screenActions: [] });
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBrand, setSelectedBrand] = useState('ALL');
    const [ticketNoQuery, setTicketNoQuery] = useState('');
    const [modelQuery, setModelQuery] = useState('');
    const [screenActionFilter, setScreenActionFilter] = useState('ALL');
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
                    ticketNoQuery,
                    modelQuery,
                    screenActionFilter,
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
    }, [searchQuery, selectedBrand, ticketNoQuery, modelQuery, screenActionFilter, page]);

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

    const hasActiveFilters = ticketNoQuery || modelQuery || selectedBrand !== 'ALL' || screenActionFilter !== 'ALL' || searchQuery;

    const resetFilters = () => {
        setTicketNoQuery('');
        setModelQuery('');
        setSelectedBrand('ALL');
        setScreenActionFilter('ALL');
        setSearchQuery('');
        setPage(1);
    };

    return (
        <div style={{ padding: 'var(--space-6)', maxWidth: '1440px', margin: '0 auto' }}>
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

                {!readOnly && (
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
                )}
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

            {/* Granular Column Filters */}
            <div className="card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)', alignItems: 'flex-end' }}>
                    <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                            📌 Fiş No
                        </label>
                        <input
                            type="text"
                            className="input"
                            placeholder="Örn: 345"
                            value={ticketNoQuery}
                            onChange={(e) => { setTicketNoQuery(e.target.value); setPage(1); }}
                        />
                    </div>

                    <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                            🏷️ Marka
                        </label>
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

                    <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                            📺 Model
                        </label>
                        <input
                            type="text"
                            className="input"
                            placeholder="Örn: 49NU7100"
                            value={modelQuery}
                            onChange={(e) => { setModelQuery(e.target.value); setPage(1); }}
                        />
                    </div>

                    <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                            ⚡ İşlem Notu Filtresi
                        </label>
                        <select
                            className="input"
                            value={screenActionFilter}
                            onChange={(e) => { setScreenActionFilter(e.target.value); setPage(1); }}
                        >
                            <option value="ALL">Tüm İşlemler</option>
                            {stats.screenActions?.map(a => (
                                <option key={a.action} value={a.action}>{a.action} ({a.count})</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '12px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                            🔍 Genel Arama (Ekran / LED / Not)
                        </label>
                        <input
                            type="text"
                            className="input"
                            placeholder="LSF490FN06, LED, TCON veya Not..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                        />
                    </div>

                    {hasActiveFilters && (
                        <div>
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={resetFilters}
                                style={{ color: 'var(--color-danger)', fontSize: '12px', marginBottom: '2px' }}
                            >
                                ✕ Filtreleri Temizle
                            </button>
                        </div>
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
                        {hasActiveFilters ? 'Aramanıza uygun kayıt bulunamadı' : 'Henüz hiç uyumluluk kaydı yüklenmemiş'}
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', maxWidth: '400px', margin: '8px auto' }}>
                        {hasActiveFilters ? 'Farklı bir model veya ekran kodu ile tekrar arayın.' : 'Üstteki "Excel / CSV Yükle" butonuna tıklayarak eski programınızdaki 8.000 satırlık verinizi yükleyebilirsiniz.'}
                    </p>
                </div>
            ) : (
                <>
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Fiş No</th>
                                    <th>Marka</th>
                                    <th>Model</th>
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
                                            <span className="badge badge-secondary" style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                                                #{r.legacyTicketNo || '-'}
                                            </span>
                                        </td>
                                        <td>
                                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{r.brand || '-'}</span>
                                        </td>
                                        <td>
                                            <button
                                                className="btn btn-ghost btn-xs"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenModelSummary(r.model);
                                                }}
                                                style={{ fontSize: '13px', fontWeight: 700, color: 'var(--brand-primary)', fontFamily: 'monospace', textDecoration: 'underline', padding: '2px 4px' }}
                                                title={`${r.model} için tüm çıkan ve takılan ekran özetini gör`}
                                            >
                                                📺 {r.model || '-'}
                                            </button>
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 600 }}>
                                            {isValidValue(r.originalScreen) ? r.originalScreen : '-'}
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '12px', color: '#10b981', fontWeight: 600 }}>
                                            {isValidValue(r.installedScreen) ? r.installedScreen : '-'}
                                        </td>
                                        <td>
                                            {isValidValue(r.screenAction) ? (
                                                <span className="badge badge-success" style={{ fontSize: '11px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }} title={r.screenAction}>
                                                    {r.screenAction}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '12px', color: '#d97706' }}>
                                            {isValidValue(r.installedLed) ? r.installedLed : '-'}
                                        </td>
                                        <td style={{ fontSize: '12px' }}>{isValidValue(r.tcon) ? r.tcon : '-'}</td>
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

            {/* Modal: Model Summary */}
            {selectedModelName && (
                <div className="modal-overlay" onClick={() => { setSelectedModelName(null); setModelSummaryData(null); }}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '880px', width: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div className="modal-header">
                            <div>
                                <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    📺 {selectedModelName} — TV Model Ekran & LED Uyumluluk Özeti
                                </h3>
                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                    Bu modelde daha önce sökülen ekranlar, takılan uyumlu ekranlar ve geçmiş işlem notları
                                </div>
                            </div>
                            <button className="modal-close" onClick={() => { setSelectedModelName(null); setModelSummaryData(null); }}>×</button>
                        </div>

                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {isLoadingModelSummary || !modelSummaryData ? (
                                <div style={{ padding: '40px', textAlign: 'center' }}>
                                    <div className="spinner" style={{ margin: '0 auto 12px' }} />
                                    <div>Model uyumluluk özeti yükleniyor...</div>
                                </div>
                            ) : (
                                <>
                                    {/* Summary Cards */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
                                        {/* Original Screens */}
                                        <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
                                            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '8px' }}>
                                                📤 Çıkan Orijinal Ekranlar (Paneller)
                                            </div>
                                            {modelSummaryData.originalScreens.length === 0 ? (
                                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Kayıt bulunmuyor</div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    {modelSummaryData.originalScreens.map((item: any) => (
                                                        <div key={item.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontFamily: 'monospace', padding: '4px 8px', background: 'var(--bg-tertiary)', borderRadius: '4px' }}>
                                                            <span style={{ fontWeight: 600 }}>{item.code}</span>
                                                            <span className="badge badge-secondary" style={{ fontSize: '10.5px' }}>{item.count} Kez Çıktı</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Installed Compatible Screens */}
                                        <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.06)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                                            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-success)', textTransform: 'uppercase', marginBottom: '8px' }}>
                                                📥 Takılan Uyumlu Ekranlar
                                            </div>
                                            {modelSummaryData.installedScreens.length === 0 ? (
                                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Kayıt bulunmuyor</div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                    {modelSummaryData.installedScreens.map((item: any) => (
                                                        <div key={item.code} style={{ fontSize: '12px', padding: '6px 8px', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-primary)' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'monospace' }}>
                                                                <span style={{ fontWeight: 700, color: 'var(--color-success)' }}>{item.code}</span>
                                                                <span className="badge badge-success" style={{ fontSize: '10.5px' }}>{item.count} Kez Takıldı</span>
                                                            </div>
                                                            {item.actions.length > 0 && (
                                                                <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                                                                    Uygulama: {item.actions.join(', ')}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Installed LED Sets */}
                                        {modelSummaryData.installedLeds.length > 0 && (
                                            <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.06)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                                                <div style={{ fontSize: '11px', fontWeight: 700, color: '#d97706', textTransform: 'uppercase', marginBottom: '8px' }}>
                                                    💡 Takılan LED Setleri
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    {modelSummaryData.installedLeds.map((item: any) => (
                                                        <div key={item.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontFamily: 'monospace', padding: '4px 8px', background: 'var(--bg-tertiary)', borderRadius: '4px' }}>
                                                            <span style={{ fontWeight: 600, color: '#d97706' }}>{item.code}</span>
                                                            <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', fontSize: '10.5px' }}>{item.count} Kez</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* History Records Table */}
                                    <div>
                                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span>📋 Bu Model için Tüm Geçmiş Fiş & Tamir Kayıtları ({modelSummaryData.records.length})</span>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 400 }}>Tam detay için satıra tıklayın</span>
                                        </div>

                                        <div className="table-container" style={{ maxHeight: '340px', overflowY: 'auto' }}>
                                            <table className="table" style={{ fontSize: '12px' }}>
                                                <thead>
                                                    <tr>
                                                        <th>Fiş No</th>
                                                        <th>Tarih / Teknisyen</th>
                                                        <th>Çıkan Ekran</th>
                                                        <th>Takılan Ekran</th>
                                                        <th>İşlem Notu</th>
                                                        <th>Takılan LED</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {modelSummaryData.records.map((r: any) => (
                                                        <tr
                                                            key={r.id}
                                                            style={{ cursor: 'pointer' }}
                                                            onClick={() => {
                                                                setSelectedRecord(r);
                                                            }}
                                                        >
                                                            <td>
                                                                <span className="badge badge-secondary" style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                                                                    #{r.legacyTicketNo || '-'}
                                                                </span>
                                                            </td>
                                                            <td style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                                                <div>{isValidValue(r.technicianName) ? r.technicianName : '-'}</div>
                                                                <div>{formatDateValue(r.date)}</div>
                                                            </td>
                                                            <td style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                                                                {isValidValue(r.originalScreen) ? r.originalScreen : '-'}
                                                            </td>
                                                            <td style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--color-success)', fontWeight: 600 }}>
                                                                {isValidValue(r.installedScreen) ? r.installedScreen : '-'}
                                                            </td>
                                                            <td>
                                                                {isValidValue(r.screenAction) ? (
                                                                    <span className="badge badge-success" style={{ fontSize: '10.5px' }}>
                                                                        {r.screenAction}
                                                                    </span>
                                                                ) : '-'}
                                                            </td>
                                                            <td style={{ fontFamily: 'monospace', fontSize: '11px', color: '#d97706' }}>
                                                                {isValidValue(r.installedLed) ? r.installedLed : '-'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
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
