'use client';

import { useState, useEffect, useTransition } from 'react';
import { getRepairers, createRepairer, updateRepairer } from '@/actions/repairers';

type Repairer = Awaited<ReturnType<typeof getRepairers>>[0];

export default function RepairersPage() {
    const [repairers, setRepairers] = useState<Repairer[]>([]);
    const [search, setSearch] = useState('');
    const [isPending, startTransition] = useTransition();
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Repairer | null>(null);

    const load = () => {
        startTransition(async () => {
            const data = await getRepairers(search.trim() || undefined);
            setRepairers(data);
        });
    };

    useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [search]);
    useEffect(() => { load(); }, []);

    const handleSubmit = async (formData: FormData) => {
        try {
            if (editing) { await updateRepairer(editing.id, formData); }
            else { await createRepairer(formData); }
            setShowForm(false); setEditing(null); load();
        } catch (err: any) { alert(err.message); }
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Tamirciler</h1>
                    <p className="page-subtitle">{repairers.length} kayıt</p>
                </div>
                <button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>➕ Yeni Tamirci</button>
            </div>

            <div style={{ marginBottom: 'var(--space-4)' }}>
                <input type="text" className="form-input" placeholder="🔍 İsim veya telefon ile ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <div className="table-container">
                <table className="table">
                    <thead><tr><th>Ad</th><th>Telefon</th><th>VKN</th><th>İl / İlçe</th><th></th></tr></thead>
                    <tbody>
                        {repairers.map((r) => (
                            <tr key={r.id} onClick={() => window.location.href = `/repairers/${r.id}`} style={{ cursor: 'pointer' }}>
                                <td style={{ fontWeight: 600 }}>{r.name}</td>
                                <td><a href={`tel:${r.phone}`} onClick={(e) => e.stopPropagation()}>{r.phone}</a></td>
                                <td style={{ fontFamily: 'monospace' }}>{r.taxId}</td>
                                <td>{r.city} / {r.district}</td>
                                <td><button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setEditing(r); setShowForm(true); }}>✏️</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">{editing ? '✏️ Tamirci Düzenle' : '➕ Yeni Tamirci'}</h3>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowForm(false)}>✕</button>
                        </div>
                        <form action={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group"><label className="form-label required">Ad</label><input name="name" className="form-input" defaultValue={editing?.name || ''} required /></div>
                                <div className="form-group"><label className="form-label required">Telefon</label><input name="phone" className="form-input" defaultValue={editing?.phone || ''} required /></div>
                                <div className="form-group"><label className="form-label required">VKN</label><input name="taxId" className="form-input" defaultValue={editing?.taxId || ''} required /></div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                    <div className="form-group"><label className="form-label required">İl</label><input name="city" className="form-input" defaultValue={editing?.city || ''} required /></div>
                                    <div className="form-group"><label className="form-label required">İlçe</label><input name="district" className="form-input" defaultValue={editing?.district || ''} required /></div>
                                </div>
                                <div className="form-group"><label className="form-label">Adres</label><textarea name="address" className="form-textarea" defaultValue={editing?.address || ''} rows={2} /></div>
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
