'use client';

import { useState, useEffect, useTransition, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getCustomers, createCustomer, updateCustomer } from '@/actions/customers';
import { getRepairers, createRepairer, updateRepairer } from '@/actions/repairers';
import { formatPhoneNumber, isPhoneComplete } from '@/lib/constants';
import { CITIES_LIST, getDistrictsByCity } from '@/lib/turkey-locations';
import SearchableSelect from '@/components/ui/SearchableSelect';

type Customer = Awaited<ReturnType<typeof getCustomers>>[0];
type Repairer = Awaited<ReturnType<typeof getRepairers>>[0];

function CustomersUnifiedContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const tabParam = searchParams.get('tab');
    const [activeTab, setActiveTab] = useState<'customers' | 'repairers'>(
        tabParam === 'repairers' ? 'repairers' : 'customers'
    );

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [repairers, setRepairers] = useState<Repairer[]>([]);
    const [search, setSearch] = useState('');
    const [isPending, startTransition] = useTransition();
    const [initialLoading, setInitialLoading] = useState(true);

    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Customer | Repairer | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        phone: '0',
        taxId: '',
        city: 'İstanbul',
        district: 'Sultanbeyli',
        address: '',
    });

    // Synchronize tab state with query param if it changes
    useEffect(() => {
        if (tabParam === 'repairers') {
            setActiveTab('repairers');
        } else if (tabParam === 'customers') {
            setActiveTab('customers');
        }
    }, [tabParam]);

    const loadData = (showSpinner = false) => {
        if (showSpinner) setInitialLoading(true);
        startTransition(async () => {
            try {
                if (activeTab === 'customers') {
                    const custData = await getCustomers(search.trim() || undefined);
                    setCustomers(custData);
                    // Preload repairers count if empty
                    if (repairers.length === 0) {
                        getRepairers().then(setRepairers).catch(() => {});
                    }
                } else {
                    const repData = await getRepairers(search.trim() || undefined);
                    setRepairers(repData);
                    // Preload customers count if empty
                    if (customers.length === 0) {
                        getCustomers().then(setCustomers).catch(() => {});
                    }
                }
            } finally {
                setInitialLoading(false);
            }
        });
    };

    useEffect(() => {
        loadData(false);
    }, [activeTab]);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadData(false);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    const handleTabChange = (newTab: 'customers' | 'repairers') => {
        setActiveTab(newTab);
        setSearch('');
        const params = new URLSearchParams(window.location.search);
        if (newTab === 'repairers') {
            params.set('tab', 'repairers');
        } else {
            params.delete('tab');
        }
        const newUrl = params.toString() ? `/customers?${params.toString()}` : '/customers';
        router.replace(newUrl, { scroll: false });
    };

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

    const openEditModal = (item: Customer | Repairer) => {
        setEditing(item);
        setFormData({
            name: item.name,
            phone: formatPhoneNumber(item.phone),
            taxId: item.taxId || '',
            city: item.city || 'İstanbul',
            district: item.district || (item.city === 'İstanbul' || !item.city ? 'Sultanbeyli' : ''),
            address: item.address || '',
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

        const cleanName = formData.name.trim();
        if (!cleanName || cleanName.length < 2) {
            alert(`⚠️ Lütfen geçerli bir ${activeTab === 'customers' ? 'Müşteri Adı Soyadı' : 'Firma / Tamirci Adı'} giriniz (En az 2 karakter olmalıdır).`);
            return;
        }

        if (!isPhoneComplete(formData.phone)) {
            alert('⚠️ Lütfen 11 haneli geçerli bir telefon numarası giriniz (Örn: 0532 123 45 67)');
            return;
        }

        if (activeTab === 'repairers' && !formData.taxId.trim()) {
            alert('⚠️ Lütfen Vergi Kimlik Numarası (VKN) giriniz.');
            return;
        }

        if (!formData.city || !formData.district) {
            alert('⚠️ Lütfen İl ve İlçe seçiniz.');
            return;
        }

        try {
            const fd = new FormData();
            fd.append('name', cleanName);
            fd.append('phone', formData.phone);
            if (formData.taxId) fd.append('taxId', formData.taxId.trim());
            fd.append('city', formData.city.trim());
            fd.append('district', formData.district.trim());
            if (formData.address) fd.append('address', formData.address.trim());

            let res: any;
            if (activeTab === 'customers') {
                if (editing) {
                    res = await updateCustomer(editing.id, fd);
                } else {
                    res = await createCustomer(fd);
                }
            } else {
                if (editing) {
                    res = await updateRepairer(editing.id, fd);
                } else {
                    res = await createRepairer(fd);
                }
            }

            if (res && res.error) {
                alert('⚠️ ' + res.error);
                return;
            }

            setShowForm(false);
            setEditing(null);
            loadData(false);
        } catch (err: any) {
            alert(err.message || 'Kayıt sırasında bir hata oluştu');
        }
    };

    const isCustomerTab = activeTab === 'customers';
    const currentList = isCustomerTab ? customers : repairers;

    return (
        <div>
            {/* Header */}
            <div className="page-header" style={{ marginBottom: 'var(--space-3)' }}>
                <div>
                    <h1 className="page-title">
                        {isCustomerTab ? 'Müşteriler' : 'Tamirciler'}
                    </h1>
                    <p className="page-subtitle">
                        {currentList.length} {isCustomerTab ? 'müşteri kaydı' : 'tamirci kaydı'}
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    {isPending && (
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: 'var(--font-size-xs)',
                            color: '#60a5fa',
                            background: 'rgba(59, 130, 246, 0.15)',
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-pill)',
                            fontWeight: 600,
                        }}>
                            <span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px' }} />
                            Yükleniyor...
                        </span>
                    )}
                    <button className="btn btn-primary" onClick={openNewModal}>
                        {isCustomerTab ? '➕ Yeni Müşteri' : '➕ Yeni Tamirci'}
                    </button>
                </div>
            </div>

            {/* Segmented Tab Switcher */}
            <div style={{
                display: 'inline-flex',
                background: 'var(--bg-secondary)',
                padding: '4px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-primary)',
                gap: '4px',
                marginBottom: 'var(--space-4)',
            }}>
                <button
                    type="button"
                    onClick={() => handleTabChange('customers')}
                    style={{
                        padding: '8px 20px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.15s ease',
                        background: isCustomerTab ? 'var(--brand-primary)' : 'transparent',
                        color: isCustomerTab ? '#FFFFFF' : 'var(--text-secondary)',
                        boxShadow: isCustomerTab ? '0 2px 8px rgba(99, 102, 241, 0.4)' : 'none',
                    }}
                >
                    <span style={{ fontSize: '15px' }}>👥</span>
                    <span>Müşteriler</span>
                    <span style={{
                        fontSize: '11px',
                        background: isCustomerTab ? 'rgba(255, 255, 255, 0.25)' : 'var(--bg-tertiary)',
                        color: isCustomerTab ? '#FFFFFF' : 'var(--text-tertiary)',
                        padding: '1px 7px',
                        borderRadius: '10px',
                        fontWeight: 700,
                    }}>
                        {customers.length}
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => handleTabChange('repairers')}
                    style={{
                        padding: '8px 20px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.15s ease',
                        background: !isCustomerTab ? 'var(--brand-primary)' : 'transparent',
                        color: !isCustomerTab ? '#FFFFFF' : 'var(--text-secondary)',
                        boxShadow: !isCustomerTab ? '0 2px 8px rgba(99, 102, 241, 0.4)' : 'none',
                    }}
                >
                    <span style={{ fontSize: '15px' }}>🏪</span>
                    <span>Tamirciler</span>
                    <span style={{
                        fontSize: '11px',
                        background: !isCustomerTab ? 'rgba(255, 255, 255, 0.25)' : 'var(--bg-tertiary)',
                        color: !isCustomerTab ? '#FFFFFF' : 'var(--text-tertiary)',
                        padding: '1px 7px',
                        borderRadius: '10px',
                        fontWeight: 700,
                    }}>
                        {repairers.length}
                    </span>
                </button>
            </div>

            {/* Search */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
                <input
                    type="text"
                    className="form-input"
                    placeholder={isCustomerTab ? '🔍 Müşteri adı veya telefon ile ara...' : '🔍 Firma / tamirci adı veya telefon ile ara...'}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* Table */}
            <div className="table-container" style={{ opacity: isPending ? 0.75 : 1, transition: 'opacity 0.2s' }}>
                <table className="table table-clickable">
                    <thead>
                        <tr>
                            <th>{isCustomerTab ? 'Ad Soyad' : 'Firma / Tamirci Adı'}</th>
                            <th>Telefon</th>
                            <th>VKN</th>
                            <th>İl / İlçe</th>
                            <th style={{ width: '60px', textAlign: 'center' }}>İşlem</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentList.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
                                    {search ? 'Aramanıza uygun kayıt bulunamadı.' : (isCustomerTab ? 'Henüz müşteri kaydı bulunmuyor.' : 'Henüz tamirci kaydı bulunmuyor.')}
                                </td>
                            </tr>
                        ) : (
                            currentList.map((item) => (
                                <tr
                                    key={item.id}
                                    onClick={() => window.location.href = isCustomerTab ? `/customers/${item.id}` : `/repairers/${item.id}`}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <td style={{ fontWeight: 600 }}>{item.name}</td>
                                    <td>
                                        <a href={`tel:${item.phone}`} onClick={(e) => e.stopPropagation()} style={{ color: 'var(--text-primary)' }}>
                                            {item.phone}
                                        </a>
                                    </td>
                                    <td style={{ fontFamily: 'monospace', color: item.taxId ? 'inherit' : 'var(--text-tertiary)' }}>
                                        {item.taxId || '-'}
                                    </td>
                                    <td>{item.city} / {item.district}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={(e) => { e.stopPropagation(); openEditModal(item); }}
                                            title="Düzenle"
                                        >
                                            ✏️
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                {isCustomerTab
                                    ? (editing ? '✏️ Müşteri Düzenle' : '➕ Yeni Müşteri')
                                    : (editing ? '✏️ Tamirci Düzenle' : '➕ Yeni Tamirci')}
                            </h3>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowForm(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label required">
                                        {isCustomerTab ? 'Ad Soyad' : 'Firma / Tamirci Adı'}
                                    </label>
                                    <input
                                        name="name"
                                        className="form-input"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value.toLocaleUpperCase('tr-TR') })}
                                        placeholder={isCustomerTab ? 'Ad Soyad' : 'Firma / Tamirci Adı'}
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
                                    <label className={`form-label ${!isCustomerTab ? 'required' : ''}`}>
                                        VKN {!isCustomerTab ? '' : '(Opsiyonel)'}
                                    </label>
                                    <input
                                        name="taxId"
                                        className="form-input"
                                        value={formData.taxId}
                                        onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                                        placeholder={isCustomerTab ? 'VKN (Opsiyonel)' : 'Vergi Kimlik Numarası (Zorunlu)'}
                                        required={!isCustomerTab}
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

export default function CustomersPage() {
    return (
        <Suspense fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '12px' }}>
                <div className="spinner" />
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Yükleniyor...</span>
            </div>
        }>
            <CustomersUnifiedContent />
        </Suspense>
    );
}
