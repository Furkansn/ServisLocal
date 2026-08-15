'use client';

import { useState, useEffect, useTransition } from 'react';
import { getProducts, createProduct, updateProduct } from '@/actions/products';
import { PRODUCT_CATEGORY_LABELS, formatCurrency } from '@/lib/constants';

type Product = Awaited<ReturnType<typeof getProducts>>[0];

const CATEGORIES = ['SCREEN', 'LED', 'LGP', 'ACCESSORY'];

export default function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [categoryFilter, setCategoryFilter] = useState('');
    const [search, setSearch] = useState('');
    const [isPending, startTransition] = useTransition();
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Product | null>(null);
    const [formError, setFormError] = useState('');

    const load = () => {
        startTransition(async () => {
            const data = await getProducts({
                category: categoryFilter || undefined,
                search: search.trim() || undefined,
            });
            setProducts(data);
        });
    };

    useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [search, categoryFilter]);
    useEffect(() => { load(); }, []);

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

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Ürünler & Stok</h1>
                    <p className="page-subtitle">{products.length} ürün</p>
                </div>
                <button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>➕ Yeni Ürün</button>
            </div>

            <div className="filter-bar">
                <button className={`filter-pill ${!categoryFilter ? 'active' : ''}`} onClick={() => setCategoryFilter('')}>Tümü</button>
                {CATEGORIES.map((c) => (
                    <button key={c} className={`filter-pill ${categoryFilter === c ? 'active' : ''}`} onClick={() => setCategoryFilter(c)}>
                        {c === 'ALL' ? 'Tümü' : PRODUCT_CATEGORY_LABELS[c as keyof typeof PRODUCT_CATEGORY_LABELS]}
                    </button>
                ))}
            </div>

            <div style={{ marginBottom: 'var(--space-4)' }}>
                <input type="text" className="form-input" placeholder="🔍 Ürün adı veya SKU ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <div className="table-container">
                <table className="table">
                    <thead>
                        <tr><th>Ürün</th><th>SKU</th><th>Kategori</th><th>Fiyat</th><th>Maliyet</th><th>Stok</th><th></th></tr>
                    </thead>
                    <tbody>
                        {products.map((p) => (
                            <tr key={p.id}>
                                <td style={{ fontWeight: 600 }}>{p.name}</td>
                                <td style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}>{p.sku || '-'}</td>
                                <td><span className="badge badge-info">{PRODUCT_CATEGORY_LABELS[p.category as keyof typeof PRODUCT_CATEGORY_LABELS]}</span></td>
                                <td>{formatCurrency(Number(p.price))}</td>
                                <td style={{ color: 'var(--text-tertiary)' }}>{p.cost ? formatCurrency(Number(p.cost)) : '-'}</td>
                                <td>
                                    <span className={`badge ${p.stock <= 0 ? 'badge-danger' : p.stock <= 5 ? 'badge-warning' : 'badge-success'}`}>
                                        {p.stock}
                                    </span>
                                </td>
                                <td><button className="btn btn-ghost btn-sm" onClick={() => { setEditing(p); setShowForm(true); }}>✏️</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

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
                                        {CATEGORIES.map((c) => <option key={c} value={c}>{PRODUCT_CATEGORY_LABELS[c as keyof typeof PRODUCT_CATEGORY_LABELS]}</option>)}
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
