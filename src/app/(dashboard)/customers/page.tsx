'use client';

import { useState, useEffect, useTransition } from 'react';
import { getCustomers, createCustomer, updateCustomer } from '@/actions/customers';
import { formatPhoneNumber, isPhoneComplete } from '@/lib/constants';
import { CITIES_LIST, getDistrictsByCity } from '@/lib/turkey-locations';
import SearchableSelect from '@/components/ui/SearchableSelect';

type Customer = Awaited<ReturnType<typeof getCustomers>>[0];

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [search, setSearch] = useState('');
    const [isPending, startTransition] = useTransition();
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Customer | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        phone: '0',
        taxId: '',
        city: 'İstanbul',
        district: 'Sultanbeyli',
        address: '',
    });

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

    const openNewModal = () => {
        setEditing(null);
        setFormData({
            name: '',
            phone: '0',
            taxId: '',
            city: 'İstanbul',
            district: 'Sultanbeyli',
            address: '',
        });
        setShowForm(true);
    };

    const openEditModal = (c: Customer) => {
        setEditing(c);
        setFormData({
            name: c.name,
            phone: formatPhoneNumber(c.phone),
            taxId: c.taxId || '',
            city: c.city || 'İstanbul',
            district: c.district || (c.city === 'İstanbul' || !c.city ? 'Sultanbeyli' : ''),
            address: c.address || '',
        });
        setShowForm(true);
    };

    const handleCityChange = (newCity: string) => {
        const districts = getDistrictsByCity(newCity);
        const currentStillValid = districts.includes(formData.district);
        let newDistrict = formData.district;
        if (!currentStillValid) {
            if (newCity === 'İstanbul') {
                newDistrict = 'Sultanbeyli';
            } else {
                newDistrict = districts.length > 0 ? districts[0] : '';
            }
        }
        setFormData(prev => ({ ...prev, city: newCity, district: newDistrict }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isPhoneComplete(formData.phone)) {
            alert('Lütfen 11 haneli geçerli bir telefon numarası giriniz (Örn: 0532 123 45 67)');
            return;
        }

        try {
            const fd = new FormData();
            fd.append('name', formData.name);
            fd.append('phone', formData.phone);
            if (formData.taxId) fd.append('taxId', formData.taxId);
            fd.append('city', formData.city);
            fd.append('district', formData.district);
            if (formData.address) fd.append('address', formData.address);

            if (editing) {
                await updateCustomer(editing.id, fd);
            } else {
                await createCustomer(fd);
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
                <button className="btn btn-primary" onClick={openNewModal}>
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
                                    <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); openEditModal(c); }}>✏️</button>
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
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label required">Ad Soyad</label>
                                    <input
                                        name="name"
                                        className="form-input"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value.toLocaleUpperCase('tr-TR') })}
                                        placeholder="Ad Soyad"
                                        style={{ textTransform: 'uppercase' }}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label required">Telefon</label>
                                    <input
                                        name="phone"
                                        type="tel"
                                        className="form-input"
                                        placeholder="05XX XXX XX XX"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: formatPhoneNumber(e.target.value) })}
                                        required
                                    />
                                    {formData.phone && formData.phone.replace(/\D/g, '').length < 11 && (
                                        <div style={{ fontSize: '11px', color: 'var(--color-danger)', marginTop: '4px' }}>
                                            ⚠️ Telefon numarası eksik (11 hane olmalı: 05XX XXX XX XX)
                                        </div>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">VKN</label>
                                    <input
                                        name="taxId"
                                        className="form-input"
                                        value={formData.taxId}
                                        onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                                        placeholder="VKN (Opsiyonel)"
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                    <div className="form-group">
                                        <label className="form-label required">İl</label>
                                        <SearchableSelect
                                            options={CITIES_LIST}
                                            value={formData.city}
                                            onChange={handleCityChange}
                                            placeholder="İl seçin veya arayın..."
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label required">İlçe</label>
                                        <SearchableSelect
                                            options={getDistrictsByCity(formData.city)}
                                            value={formData.district}
                                            onChange={(newDistrict) => setFormData(prev => ({ ...prev, district: newDistrict }))}
                                            placeholder="İlçe seçin veya arayın..."
                                            required
                                            disabled={!formData.city}
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Adres</label>
                                    <textarea
                                        name="address"
                                        className="form-textarea"
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        placeholder="Açık adres..."
                                        rows={2}
                                    />
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
