'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
import { getProducts, createProduct, updateProduct } from '@/actions/products';
import { syncAllExternalProducts, getIntegrationSummary } from '@/actions/integration';
import { PRODUCT_CATEGORY_LABELS, formatCurrency } from '@/lib/constants';

type Product = Awaited<ReturnType<typeof getProducts>>[0];

const CATEGORIES = ['ALL', 'SCREEN', 'LED', 'LGP', 'ACCESSORY'];
const PAGE_SIZE = 20;

type SortField = 'name' | 'externalSource' | 'sku' | 'category' | 'price' | 'cost' | 'stock';
type SortDirection = 'asc' | 'desc';

export default function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [categoryFilter, setCategoryFilter] = useState('ALL');
    const [sourceFilter, setSourceFilter] = useState('ALL');
    const [stockFilter, setStockFilter] = useState('ALL');
    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortField, setSortField] = useState<SortField>('name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    const [isPending, startTransition] = useTransition();
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Product | null>(null);
    const [formError, setFormError] = useState('');

    // Integration state
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
    const [integrationSummary, setIntegrationSummary] = useState<{
        ledCount: number;
        screenCount: number;
        totalCount: number;
        lastSyncAt: Date | null;
        usdRate: number;
    } | null>(null);

    const load = () => {
        startTransition(async () => {
            const data = await getProducts({
                search: search.trim() || undefined,
            });
            setProducts(data);
            getIntegrationSummary().then(setIntegrationSummary).catch(() => { });
        });
    };

    useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [search]);

    useEffect(() => {
        load();
        // Auto-check: if last sync is older than 2 mins, silently sync in background
        getIntegrationSummary().then((sum) => {
            setIntegrationSummary(sum);
            const lastTime = sum?.lastSyncAt ? new Date(sum.lastSyncAt).getTime() : 0;
            if (Date.now() - lastTime > 2 * 60 * 1000) {
                syncAllExternalProducts().then(() => {
                    load();
                }).catch(() => { });
            }
        }).catch(() => { });
    }, []);

    // Handle column sort toggle
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
        setCurrentPage(1);
    };

    // Filter and sort products in-memory
    const filteredAndSortedProducts = useMemo(() => {
        let list = [...products];

        // Category filter
        if (categoryFilter !== 'ALL') {
            list = list.filter(p => p.category === categoryFilter);
        }

        // Source filter
        if (sourceFilter === 'LED') {
            list = list.filter(p => p.externalSource === 'COMPANY_A_LED');
        } else if (sourceFilter === 'SCREEN') {
            list = list.filter(p => p.externalSource === 'COMPANY_B_SCREEN');
        } else if (sourceFilter === 'LOCAL') {
            list = list.filter(p => !p.externalSource);
        }

        // Stock filter
        if (stockFilter === 'IN_STOCK') {
            list = list.filter(p => p.stock > 0);
        } else if (stockFilter === 'OUT_OF_STOCK') {
            list = list.filter(p => p.stock <= 0);
        } else if (stockFilter === 'LOW_STOCK') {
            list = list.filter(p => p.stock > 0 && p.stock <= 3);
        }

        // Sorting
        list.sort((a, b) => {
            let res = 0;
            if (sortField === 'name') {
                res = a.name.localeCompare(b.name, 'tr-TR');
            } else if (sortField === 'sku') {
                res = (a.sku || '').localeCompare(b.sku || '', 'tr-TR');
            } else if (sortField === 'category') {
                res = a.category.localeCompare(b.category);
            } else if (sortField === 'externalSource') {
                const srcA = a.externalSource || 'LOCAL';
                const srcB = b.externalSource || 'LOCAL';
                res = srcA.localeCompare(srcB);
            } else if (sortField === 'price') {
                res = Number(a.price) - Number(b.price);
            } else if (sortField === 'cost') {
                res = Number(a.cost || 0) - Number(b.cost || 0);
            } else if (sortField === 'stock') {
                res = a.stock - b.stock;
            }
            return sortDirection === 'asc' ? res : -res;
        });

        return list;
    }, [products, categoryFilter, sourceFilter, stockFilter, sortField, sortDirection]);

    // Pagination calculations
    const totalItems = filteredAndSortedProducts.length;
    const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
    const paginatedProducts = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredAndSortedProducts.slice(start, start + PAGE_SIZE);
    }, [filteredAndSortedProducts, currentPage]);

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        setSyncResult(null);
        try {
            const res = await syncAllExternalProducts({ fullSync: true });
            if (res.success) {
                setSyncResult({
                    success: true,
                    message: `✅ Başarılı! Zero - LED'den ${res.ledCount || 0} LED, Zero - Ekran'dan ${res.screenCount || 0} Ekran güncellendi. (USD Kuru: ₺${(res.usdRate || 0).toFixed(2)})`,
                });
                load();
            } else {
                setSyncResult({
                    success: false,
                    message: `❌ Senkronizasyon hatası: ${res.error}`,
                });
            }
        } catch (err: any) {
            setSyncResult({
                success: false,
                message: `❌ Hata: ${err.message}`,
            });
        } finally {
            setSyncing(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setFormError('');
        const fd = new FormData(e.currentTarget);
        const data = {
            name: fd.get('name') as string,
            sku: fd.get('sku') as string || undefined,
            category: fd.get('category') as string,
            price: parseFloat(fd.get('price') as string),
            cost: fd.get('cost') ? parseFloat(fd.get('cost') as string) : undefined,
            stock: parseInt(fd.get('stock') as string),
        };
        try {
            if (editing) { await updateProduct(editing.id, data); }
            else { await createProduct(data); }
            setShowForm(false); setEditing(null); load();
        } catch (err: any) { setFormError(err.message); }
    };

    const renderSortIcon = (field: SortField) => {
        if (sortField !== field) {
            return <span style={{ opacity: 0.3, marginLeft: '4px', fontSize: '10px' }}>↕️</span>;
        }
        return (
            <span style={{ color: 'var(--brand-primary)', marginLeft: '4px', fontSize: '11px', fontWeight: 800 }}>
                {sortDirection === 'asc' ? '▲' : '▼'}
            </span>
        );
    };

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <div>
                    <h1 className="page-title">Ürünler & Stok</h1>
                    <p className="page-subtitle">
                        Toplam {totalItems} ürün filtrelendi (Veritabanında {products.length} ürün)
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    <button
                        className="btn btn-secondary"
                        onClick={handleSync}
                        disabled={syncing}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            borderColor: 'var(--brand-primary)',
                            color: 'var(--brand-primary)',
                            fontWeight: 600,
                        }}
                    >
                        <span style={{ display: 'inline-block', transform: syncing ? 'rotate(360deg)' : 'none', transition: 'transform 1s linear' }}>
                            🔄
                        </span>
                        {syncing ? 'Senkronize Ediliyor...' : 'SatisiniTakipEt Senkronize Et'}
                    </button>
                    <button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>➕ Yeni Ürün</button>
                </div>
            </div>

            {/* Integration Summary Card */}
            {integrationSummary && (
                <div style={{
                    padding: '10px 14px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--space-3)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px',
                    fontSize: 'var(--font-size-xs)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>🔗</span> SatisiniTakipEt Entegrasyonu:
                        </span>
                        <span
                            className="badge badge-success"
                            style={{ fontSize: '11px', cursor: 'pointer' }}
                            onClick={() => { setSourceFilter('LED'); setCurrentPage(1); }}
                            title="Sadece Zero - LED ürünlerini filtrele"
                        >
                            💡 Zero - LED: {integrationSummary.ledCount} Ürün
                        </span>
                        <span
                            className="badge badge-info"
                            style={{ fontSize: '11px', cursor: 'pointer' }}
                            onClick={() => { setSourceFilter('SCREEN'); setCurrentPage(1); }}
                            title="Sadece Zero - Ekran ürünlerini filtrele"
                        >
                            📺 Zero - Ekran: {integrationSummary.screenCount} Ürün (USD)
                        </span>
                        <span style={{ color: 'var(--text-secondary)' }}>
                            💵 Güncel Kur: <strong>$1 = ₺{integrationSummary.usdRate.toFixed(2)}</strong>
                        </span>
                    </div>
                    <div style={{ color: 'var(--text-tertiary)' }}>
                        Son Senkronizasyon: {integrationSummary.lastSyncAt ? new Date(integrationSummary.lastSyncAt).toLocaleString('tr-TR') : 'Henüz yapılmadı'}
                    </div>
                </div>
            )}

            {syncResult && (
                <div style={{
                    padding: '10px 14px',
                    marginBottom: 'var(--space-3)',
                    background: syncResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    border: `1px solid ${syncResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-size-sm)',
                    color: syncResult.success ? 'var(--color-success)' : 'var(--color-danger)',
                }}>
                    {syncResult.message}
                </div>
            )}

            {/* Filter Bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                {/* Search and Dropdowns */}
                <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 280px' }}>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="🔍 Ürün adı veya SKU / Kod ile ara..."
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                    <div style={{ minWidth: '160px' }}>
                        <select
                            className="form-select"
                            value={sourceFilter}
                            onChange={(e) => { setSourceFilter(e.target.value); setCurrentPage(1); }}
                        >
                            <option value="ALL">🌐 Tüm Kaynaklar</option>
                            <option value="LED">💡 Zero - LED</option>
                            <option value="SCREEN">📺 Zero - Ekran</option>
                            <option value="LOCAL">📦 Yerel Ürünler</option>
                        </select>
                    </div>
                    <div style={{ minWidth: '160px' }}>
                        <select
                            className="form-select"
                            value={stockFilter}
                            onChange={(e) => { setStockFilter(e.target.value); setCurrentPage(1); }}
                        >
                            <option value="ALL">📦 Tüm Stok Durumları</option>
                            <option value="IN_STOCK">✅ Sadece Stoktakiler (&gt;0)</option>
                            <option value="LOW_STOCK">⚠️ Kritik Stok (1-3)</option>
                            <option value="OUT_OF_STOCK">❌ Stokta Olmayanlar (0)</option>
                        </select>
                    </div>
                </div>

                {/* Category Pills */}
                <div className="filter-bar" style={{ margin: 0 }}>
                    {CATEGORIES.map((c) => (
                        <button
                            key={c}
                            className={`filter-pill ${categoryFilter === c ? 'active' : ''}`}
                            onClick={() => { setCategoryFilter(c); setCurrentPage(1); }}
                        >
                            {c === 'ALL' ? 'Tüm Kategoriler' : PRODUCT_CATEGORY_LABELS[c as keyof typeof PRODUCT_CATEGORY_LABELS]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th
                                onClick={() => handleSort('name')}
                                style={{ cursor: 'pointer', userSelect: 'none' }}
                                title="İsme göre sırala"
                            >
                                Ürün {renderSortIcon('name')}
                            </th>
                            <th
                                onClick={() => handleSort('externalSource')}
                                style={{ cursor: 'pointer', userSelect: 'none' }}
                                title="Kaynağa göre sırala"
                            >
                                Kaynak {renderSortIcon('externalSource')}
                            </th>
                            <th
                                onClick={() => handleSort('sku')}
                                style={{ cursor: 'pointer', userSelect: 'none' }}
                                title="SKU / Koda göre sırala"
                            >
                                SKU {renderSortIcon('sku')}
                            </th>
                            <th
                                onClick={() => handleSort('category')}
                                style={{ cursor: 'pointer', userSelect: 'none' }}
                                title="Kategoriye göre sırala"
                            >
                                Kategori {renderSortIcon('category')}
                            </th>
                            <th
                                onClick={() => handleSort('price')}
                                style={{ cursor: 'pointer', userSelect: 'none' }}
                                title="Fiyata göre sırala"
                            >
                                Fiyat (₺) {renderSortIcon('price')}
                            </th>
                            <th
                                onClick={() => handleSort('cost')}
                                style={{ cursor: 'pointer', userSelect: 'none' }}
                                title="Maliyete göre sırala"
                            >
                                Maliyet (₺) {renderSortIcon('cost')}
                            </th>
                            <th
                                onClick={() => handleSort('stock')}
                                style={{ cursor: 'pointer', userSelect: 'none' }}
                                title="Stoğa göre sırala"
                            >
                                Stok {renderSortIcon('stock')}
                            </th>
                            <th style={{ width: '40px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedProducts.length === 0 ? (
                            <tr>
                                <td colSpan={8} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
                                    Kriterlere uygun ürün bulunamadı.
                                </td>
                            </tr>
                        ) : (
                            paginatedProducts.map((p: any) => (
                                <tr key={p.id}>
                                    <td style={{ fontWeight: 600 }}>
                                        {p.name}
                                    </td>
                                    <td>
                                        {p.externalSource === 'COMPANY_A_LED' ? (
                                            <span className="badge badge-success" style={{ fontSize: '10px', padding: '2px 6px' }}>
                                                Zero - LED
                                            </span>
                                        ) : p.externalSource === 'COMPANY_B_SCREEN' ? (
                                            <span className="badge badge-info" style={{ fontSize: '10px', padding: '2px 6px' }} title={`Orijinal: $${p.originalPrice || 0}`}>
                                                Zero - Ekran
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: '10.5px', color: 'var(--text-tertiary)' }}>Yerel</span>
                                        )}
                                    </td>
                                    <td style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}>{p.sku || '-'}</td>
                                    <td><span className="badge badge-info">{PRODUCT_CATEGORY_LABELS[p.category as keyof typeof PRODUCT_CATEGORY_LABELS]}</span></td>
                                    <td>
                                        <div>{formatCurrency(Number(p.price))}</div>
                                        {p.originalCurrency === 'USD' && p.originalPrice && (
                                            <div style={{ fontSize: '10.5px', color: 'var(--text-tertiary)' }}>
                                                (${Number(p.originalPrice).toFixed(2)})
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ color: 'var(--text-tertiary)' }}>
                                        {p.cost ? formatCurrency(Number(p.cost)) : '-'}
                                        {p.originalCurrency === 'USD' && p.originalCost && (
                                            <div style={{ fontSize: '10.5px' }}>
                                                (${Number(p.originalCost).toFixed(2)})
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <span className={`badge ${p.stock <= 0 ? 'badge-danger' : p.stock <= 3 ? 'badge-warning' : 'badge-success'}`}>
                                            {p.stock}
                                        </span>
                                    </td>
                                    <td><button className="btn btn-ghost btn-sm" onClick={() => { setEditing(p); setShowForm(true); }}>✏️</button></td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 'var(--space-4)',
                    padding: '12px 16px',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-primary)',
                    flexWrap: 'wrap',
                    gap: '12px',
                    fontSize: 'var(--font-size-sm)',
                }}>
                    <div style={{ color: 'var(--text-secondary)' }}>
                        Gösterilen: <strong>{(currentPage - 1) * PAGE_SIZE + 1} - {Math.min(currentPage * PAGE_SIZE, totalItems)}</strong> / Toplam <strong>{totalItems}</strong> ürün
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={currentPage === 1}
                            onClick={() => handlePageChange(1)}
                            title="İlk Sayfa"
                            style={{ padding: '4px 10px' }}
                        >
                            « İlk
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={currentPage === 1}
                            onClick={() => handlePageChange(currentPage - 1)}
                            style={{ padding: '4px 10px' }}
                        >
                            ‹ Önceki
                        </button>

                        {/* Page Numbers */}
                        <div style={{ display: 'flex', gap: '4px' }}>
                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                .filter(page => {
                                    // Show first, last, and window around current page
                                    return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 2;
                                })
                                .reduce((acc: (number | string)[], page, idx, arr) => {
                                    if (idx > 0 && typeof arr[idx - 1] === 'number' && (page as number) - (arr[idx - 1] as number) > 1) {
                                        acc.push('...');
                                    }
                                    acc.push(page);
                                    return acc;
                                }, [])
                                .map((item, idx) => {
                                    if (typeof item === 'string') {
                                        return (
                                            <span key={`dots-${idx}`} style={{ padding: '4px 8px', color: 'var(--text-tertiary)' }}>
                                                ...
                                            </span>
                                        );
                                    }
                                    return (
                                        <button
                                            key={item}
                                            type="button"
                                            onClick={() => handlePageChange(item)}
                                            className={`btn btn-sm ${currentPage === item ? 'btn-primary' : 'btn-ghost'}`}
                                            style={{ minWidth: '32px', padding: '4px 8px', fontWeight: currentPage === item ? 700 : 500 }}
                                        >
                                            {item}
                                        </button>
                                    );
                                })}
                        </div>

                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={currentPage === totalPages}
                            onClick={() => handlePageChange(currentPage + 1)}
                            style={{ padding: '4px 10px' }}
                        >
                            Sonraki ›
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={currentPage === totalPages}
                            onClick={() => handlePageChange(totalPages)}
                            title="Son Sayfa"
                            style={{ padding: '4px 10px' }}
                        >
                            Son »
                        </button>
                    </div>
                </div>
            )}

            {/* Modal */}
            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">{editing ? '✏️ Ürün Düzenle' : '➕ Yeni Ürün'}</h3>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowForm(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group"><label className="form-label required">Ürün Adı</label><input name="name" className="form-input" defaultValue={editing?.name || ''} required /></div>
                                <div className="form-group"><label className="form-label">SKU</label><input name="sku" className="form-input" defaultValue={editing?.sku || ''} /></div>
                                <div className="form-group">
                                    <label className="form-label required">Kategori</label>
                                    <select name="category" className="form-select" defaultValue={editing?.category || 'SCREEN'} required>
                                        {CATEGORIES.filter(c => c !== 'ALL').map((c) => (
                                            <option key={c} value={c}>{PRODUCT_CATEGORY_LABELS[c as keyof typeof PRODUCT_CATEGORY_LABELS]}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
                                    <div className="form-group"><label className="form-label required">Fiyat (₺)</label><input name="price" type="number" step="0.01" className="form-input" defaultValue={editing ? Number(editing.price) : ''} required /></div>
                                    <div className="form-group"><label className="form-label">Maliyet (₺)</label><input name="cost" type="number" step="0.01" className="form-input" defaultValue={editing?.cost ? Number(editing.cost) : ''} /></div>
                                    <div className="form-group"><label className="form-label required">Stok</label><input name="stock" type="number" className="form-input" defaultValue={editing?.stock ?? 0} required /></div>
                                </div>
                                {formError && <div style={{ padding: 'var(--space-2)', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)' }}>{formError}</div>}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>İptal</button>
                                <button type="submit" className="btn btn-primary">{editing ? 'Güncelle' : 'Kaydet'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
