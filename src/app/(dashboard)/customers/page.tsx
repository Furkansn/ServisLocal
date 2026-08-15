'use client';

import { useState, useEffect, useTransition } from 'react';
import { getCustomers, createCustomer, updateCustomer } from '@/actions/customers';

type Customer = Awaited<ReturnType<typeof getCustomers>>[0];

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [search, setSearch] = useState('');
    const [isPending, startTransition] = useTransition();
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Customer | null>(null);

    const loadCustomers = () => {
        startTransition(async () => {
            const data = await getCustomers(search.trim() || undefined);
            setCustomers(data);
        });
    };

    useEffect(() => {
        const timer = setTimeout(loadCustomers, 300);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => { loadCustomers(); }, []);

    const handleSubmit = async (formData: FormData) => {
        try {
            if (editing) {
                await updateCustomer(editing.id, formData);
            } else {
                await createCustomer(formData);
            }
            setShowForm(false);
            setEditing(null);
            loadCustomers();
        } catch (err: any) {
            alert(err.message);
        }
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Müşteriler</h1>
                    <p className="page-subtitle">{customers.length} kayıt</p>
                </div>
                <button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
                    ➕ Yeni Müşteri
                </button>
            </div>

            <div style={{ marginBottom: 'var(--space-4)' }}>
                <input
                    type="text"
                    className="form-input"
                    placeholder="🔍 İsim veya telefon ile ara..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <div className="table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Ad Soyad</th>
                            <th>Telefon</th>
                            <th>VKN</th>
                            <th>İl / İlçe</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {customers.map((c) => (
                            <tr key={c.id} onClick={() => window.location.href = `/customers/${c.id}`} style={{ cursor: 'pointer' }}>
                                <td style={{ fontWeight: 600 }}>{c.name}</td>
                                <td><a href={`tel:${c.phone}`} onClick={(e) => e.stopPropagation()}>{c.phone}</a></td>
                                <td>{c.taxId || '-'}</td>
                                <td>{c.city} / {c.district}</td>
                                <td>
                                    <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setEditing(c); setShowForm(true); }}>✏️</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">{editing ? '✏️ Müşteri Düzenle' : '➕ Yeni Müşteri'}</h3>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowForm(false)}>✕</button>
                        </div>
                        <form action={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label required">Ad Soyad</label>
                                    <input name="name" className="form-input" defaultValue={editing?.name || ''} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label required">Telefon</label>
                                    <input name="phone" className="form-input" defaultValue={editing?.phone || ''} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">VKN</label>
                                    <input name="taxId" className="form-input" defaultValue={editing?.taxId || ''} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                    <div className="form-group">
                                        <label className="form-label required">İl</label>
                                        <input name="city" className="form-input" defaultValue={editing?.city || ''} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label required">İlçe</label>
                                        <input name="district" className="form-input" defaultValue={editing?.district || ''} required />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Adres</label>
                                    <textarea name="address" className="form-textarea" defaultValue={editing?.address || ''} rows={2} />
                                </div>
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
