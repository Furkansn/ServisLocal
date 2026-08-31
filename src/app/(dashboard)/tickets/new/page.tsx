'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createTicket } from '@/actions/tickets';
import { getCustomers, createCustomer } from '@/actions/customers';
import { getRepairers, createRepairer } from '@/actions/repairers';
import { getBrands, createBrand } from '@/actions/brands';
import { getPersonnelByRole } from '@/actions/personnel';
import { REQUEST_TYPE_LABELS, PRIORITY_LABELS, CUSTOMER_TYPE_LABELS, formatPhoneNumber, isPhoneComplete } from '@/lib/constants';
import { CITIES_LIST, getDistrictsByCity } from '@/lib/turkey-locations';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { RequestType, Priority, Role } from '@prisma/client';

export default function NewTicketPage() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState('');

    // Form data
    const [requestType, setRequestType] = useState<string>('SCREEN_CHANGE');
    const [priority, setPriority] = useState<string>('STANDARD');
    const [customerType, setCustomerType] = useState<string>('INDIVIDUAL');
    const [customerId, setCustomerId] = useState('');
    const [repairerId, setRepairerId] = useState('');
    const [brandId, setBrandId] = useState('');
    const [model, setModel] = useState('');
    const [serialNo, setSerialNo] = useState('');
    const [hasWarranty, setHasWarranty] = useState(false);
    const [deviceCondition, setDeviceCondition] = useState('');
    const [notes, setNotes] = useState('');
    const [currency, setCurrency] = useState<'TRY' | 'USD'>('TRY');
    const [repairPrice, setRepairPrice] = useState<string | number>('');
    const [repairItems, setRepairItems] = useState<{ type: string, price: string, customType?: string }[]>([{ type: 'SCREEN_CHANGE', price: '' }]);

    // Search / lookup data
    const [customerSearch, setCustomerSearch] = useState('');
    const [customers, setCustomers] = useState<any[]>([]);
    const [repairerSearch, setRepairerSearch] = useState('');
    const [repairers, setRepairers] = useState<any[]>([]);
    const [brandSearch, setBrandSearch] = useState('');
    const [brands, setBrands] = useState<any[]>([]);
    const [servicePersonnel, setServicePersonnel] = useState<any[]>([]);
    const [newBrandName, setNewBrandName] = useState('');
    const [showNewBrand, setShowNewBrand] = useState(false);

    // Selected display
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const [selectedRepairer, setSelectedRepairer] = useState<any>(null);
    const [selectedBrand, setSelectedBrand] = useState<any>(null);

    // New customer state
    const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
    const [newCustomer, setNewCustomer] = useState({ type: 'INDIVIDUAL', name: '', phone: '0', city: 'İstanbul', district: 'Sultanbeyli', address: '' });
    const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);


    // Load brands and service personnel on mount
    useEffect(() => {
        getBrands().then(setBrands);
        getPersonnelByRole(Role.SERVICE_STAFF).then(setServicePersonnel);
    }, []);

    // Search customers
    useEffect(() => {
        if (customerSearch.length >= 2) {
            getCustomers(customerSearch).then(setCustomers);
        } else {
            setCustomers([]);
        }
    }, [customerSearch]);

    // Search repairers
    useEffect(() => {
        if (repairerSearch.length >= 2) {
            getRepairers(repairerSearch).then(setRepairers);
        } else {
            setRepairers([]);
        }
    }, [repairerSearch]);

    // Update logic based on Customer Type changes
    useEffect(() => {
        if (customerType === 'INDIVIDUAL') {
            setRepairerId('');
            setSelectedRepairer(null);
        } else {
            setCustomerId('');
            setSelectedCustomer(null);
        }
    }, [customerType]);

    // Handle initial items generation when requestType changes
    useEffect(() => {
        if (requestType === 'SCREEN_LED_CHANGE') {
            setRepairItems([
                { type: 'SCREEN_CHANGE', price: '' },
                { type: 'LED_CHANGE', price: '' }
            ]);
        } else if (requestType === 'LED_LGP_CHANGE') {
            setRepairItems([
                { type: 'LED_CHANGE', price: '' },
                { type: 'LGP_REPAIR', price: '' }
            ]);
        } else {
            setRepairItems([{ type: requestType, price: '' }]);
        }
    }, [requestType]);

    const handleCustomerCityChange = (newCity: string) => {
        const districts = getDistrictsByCity(newCity);
        const currentStillValid = districts.includes(newCustomer.district);
        let newDistrict = newCustomer.district;
        if (!currentStillValid) {
            if (newCity === 'İstanbul') {
                newDistrict = 'Sultanbeyli';
            } else {
                newDistrict = districts.length > 0 ? districts[0] : '';
            }
        }
        setNewCustomer(prev => ({ ...prev, city: newCity, district: newDistrict }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (customerType === 'INDIVIDUAL' && !customerId) {
            setError('⚠️ Lütfen bir müşteri seçiniz veya yeni müşteri ekleyiniz.');
            return;
        }
        if (customerType === 'REPAIRER' && !repairerId) {
            setError('⚠️ Lütfen bir tamirci seçiniz veya yeni tamirci ekleyiniz.');
            return;
        }
        if (!brandId) {
            setError('⚠️ Lütfen cihaz markasını seçiniz.');
            return;
        }
        if (!model.trim()) {
            setError('⚠️ Lütfen cihaz modelini giriniz.');
            return;
        }

        startTransition(async () => {
            try {
                const ticket = await createTicket({
                    requestType,
                    priority,
                    customerType,
                    customerId: customerId || undefined,
                    repairerId: repairerId || undefined,
                    brandId,
                    model: model.trim(),
                    serialNo: serialNo.trim() || undefined,
                    hasWarranty,
                    deviceCondition: deviceCondition || undefined,
                    notes: notes || undefined,
                    currency,
                    repairPrice: repairItems.reduce((acc, item) => {
                        const cleanPrice = item.price.replace(/\./g, '').replace(',', '.');
                        return acc + Number(cleanPrice || 0);
                    }, 0),
                    repairItems: repairItems.map(i => {
                        const cleanPrice = i.price.replace(/\./g, '').replace(',', '.');
                        return { type: i.type === 'OTHER' && i.customType ? i.customType : i.type, price: Number(cleanPrice || 0) };
                    }),
                });
                router.push(`/tickets/${ticket.id}`);
            } catch (err: any) {
                setError(err.message || 'Fiş oluşturulurken bir hata oluştu');
            }
        });
    };

    const handleAddBrand = async () => {
        if (!newBrandName.trim()) return;
        try {
            const brand = await createBrand(newBrandName.trim());
            setBrands((prev) => [...prev, brand].sort((a, b) => a.name.localeCompare(b.name)));
            setBrandId(brand.id);
            setSelectedBrand(brand);
            setNewBrandName('');
            setShowNewBrand(false);
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleCreateCustomer = async (e: React.FormEvent) => {
        e.preventDefault();

        const cleanName = newCustomer.name.trim();
        if (!cleanName || cleanName.length < 2) {
            alert('⚠️ Lütfen geçerli bir isim / firma adı giriniz (En az 2 karakter olmalıdır).');
            return;
        }

        if (!isPhoneComplete(newCustomer.phone)) {
            alert('⚠️ Lütfen 11 haneli geçerli bir telefon numarası giriniz (Örn: 0532 123 45 67)');
            return;
        }

        if (!newCustomer.city || !newCustomer.district) {
            alert('⚠️ Lütfen İl ve İlçe seçiniz.');
            return;
        }

        setIsCreatingCustomer(true);
        try {
            const formData = new FormData();
            formData.append('name', cleanName);
            formData.append('phone', newCustomer.phone);
            formData.append('city', newCustomer.city.trim());
            formData.append('district', newCustomer.district.trim());
            if (newCustomer.address) formData.append('address', newCustomer.address.trim());
            
            if (newCustomer.type === 'INDIVIDUAL') {
                const res: any = await createCustomer(formData);
                if (res && res.error) {
                    alert('⚠️ ' + res.error);
                    return;
                }
                setCustomerType('INDIVIDUAL');
                setCurrency('TRY');
                setCustomerId(res.id);
                setSelectedCustomer(res);
            } else {
                formData.append('taxId', '1111111111'); // Default VKN for quick modal creation if needed
                const res: any = await createRepairer(formData);
                if (res && res.error) {
                    alert('⚠️ ' + res.error);
                    return;
                }
                setCustomerType('REPAIRER');
                setRepairerId(res.id);
                setSelectedRepairer(res);
            }
            setShowNewCustomerModal(false);
            setNewCustomer({ type: 'INDIVIDUAL', name: '', phone: '0', city: 'İstanbul', district: 'Sultanbeyli', address: '' });
        } catch (err: any) {
            alert(err.message || 'Müşteri eklenirken hata oluştu');
        } finally {
            setIsCreatingCustomer(false);
        }
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Yeni Tamir Fişi</h1>
                    <p className="page-subtitle">Yeni tamir kaydı oluştur</p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
                    {/* Left Column */}
                    <div>
                        {/* Tamir Tipi */}
                        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                            <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Tamir Bilgileri</h3>

                            <div className="form-group">
                                <label className="form-label required">Tamir Talebi Türü</label>
                                <select
                                    className="form-select"
                                    value={requestType}
                                    onChange={(e) => setRequestType(e.target.value)}
                                >
                                    {Object.entries(REQUEST_TYPE_LABELS).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Öncelik</label>
                                <select
                                    className="form-select"
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value)}
                                >
                                    {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Garanti</label>
                                <div className="form-checkbox-group">
                                    <input
                                        type="checkbox"
                                        className="form-checkbox"
                                        id="warranty"
                                        checked={hasWarranty}
                                        onChange={(e) => setHasWarranty(e.target.checked)}
                                    />
                                    <label htmlFor="warranty" style={{ cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}>
                                        Servis Garantili
                                    </label>
                                </div>
                            </div>

                            <div className="form-group">
                                {customerType === 'REPAIRER' ? (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                                        <label className="form-label required" style={{ margin: 0 }}>
                                            Tahmini Tamir Tutarları ({currency === 'USD' ? '$ USD' : '₺ TL'})
                                        </label>
                                        <div style={{
                                            display: 'inline-flex',
                                            background: 'var(--bg-tertiary)',
                                            padding: '2px',
                                            borderRadius: '20px',
                                            border: '1px solid var(--border-primary)',
                                            gap: '2px'
                                        }}>
                                            <button
                                                type="button"
                                                onClick={() => setCurrency('TRY')}
                                                style={{
                                                    padding: '2px 10px',
                                                    borderRadius: '16px',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    fontSize: '11px',
                                                    fontWeight: currency === 'TRY' ? 700 : 500,
                                                    background: currency === 'TRY' ? 'var(--brand-primary)' : 'transparent',
                                                    color: currency === 'TRY' ? '#fff' : 'var(--text-secondary)',
                                                    transition: 'all 0.15s ease',
                                                }}
                                            >
                                                ₺ TL
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setCurrency('USD')}
                                                style={{
                                                    padding: '2px 10px',
                                                    borderRadius: '16px',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    fontSize: '11px',
                                                    fontWeight: currency === 'USD' ? 700 : 500,
                                                    background: currency === 'USD' ? '#10b981' : 'transparent',
                                                    color: currency === 'USD' ? '#fff' : 'var(--text-secondary)',
                                                    transition: 'all 0.15s ease',
                                                }}
                                            >
                                                $ USD (Dolar)
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <label className="form-label required">Tahmini Tamir Tutarları (₺)</label>
                                )}
                                {repairItems.map((item, index) => (
                                    <div key={index} style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', alignItems: 'center' }}>
                                        <select
                                            className="form-select"
                                            value={item.type}
                                            onChange={(e) => {
                                                const newItems = [...repairItems];
                                                newItems[index].type = e.target.value;
                                                setRepairItems(newItems);
                                            }}
                                            style={{ flex: 1 }}
                                        >
                                            <option value="">— Tür —</option>
                                            {Object.entries(REQUEST_TYPE_LABELS).map(([key, label]) => (
                                                <option key={key} value={key}>{label}</option>
                                            ))}
                                        </select>
                                        {item.type === 'OTHER' && (
                                            <input
                                                type="text"
                                                className="form-input"
                                                placeholder="Lütfen tür giriniz"
                                                value={item.customType || ''}
                                                onChange={(e) => {
                                                    const newItems = [...repairItems];
                                                    newItems[index].customType = e.target.value;
                                                    setRepairItems(newItems);
                                                }}
                                                style={{ flex: 1 }}
                                                required
                                            />
                                        )}
                                        <div style={{ position: 'relative', flex: 1 }}>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={item.price}
                                                onChange={(e) => {
                                                    const rawValue = e.target.value.replace(/\D/g, '');
                                                    const formatted = rawValue ? Number(rawValue).toLocaleString('tr-TR') : '';
                                                    const newItems = [...repairItems];
                                                    newItems[index].price = formatted;
                                                    setRepairItems(newItems);
                                                }}
                                                placeholder="0"
                                                style={{ paddingRight: '2.5rem' }}
                                                required
                                            />
                                            <span style={{
                                                position: 'absolute',
                                                right: '1rem',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                color: currency === 'USD' ? '#10b981' : 'var(--text-tertiary)',
                                                fontWeight: 700
                                            }}>
                                                {currency === 'USD' ? '$' : '₺'}
                                            </span>
                                        </div>
                                        {repairItems.length > 1 && (
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-icon btn-sm"
                                                onClick={() => {
                                                    const newItems = [...repairItems];
                                                    newItems.splice(index, 1);
                                                    setRepairItems(newItems);
                                                }}
                                                style={{ color: 'var(--color-danger)' }}
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-2)' }}>
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => setRepairItems([...repairItems, { type: '', price: '' }])}
                                    >
                                        ➕ Tür Ekle
                                    </button>
                                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                                        Tahmini Toplam: <strong style={{ color: currency === 'USD' ? '#10b981' : 'var(--text-primary)' }}>
                                            {currency === 'USD' ? '$' : '₺'}{repairItems.reduce((acc, item) => acc + Number(item.price.replace(/\./g, '') || 0), 0).toLocaleString('tr-TR')}
                                        </strong>
                                    </div>
                                </div>
                            </div>
                        </div>


                        {/* Cihaz Fiziksel Durumu & Not */}
                        <div className="card">
                            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                                <label className="form-label">🔍 Cihaz Fiziksel Durumu / Çizik & Hasar Notu</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={deviceCondition}
                                    onChange={(e) => setDeviceCondition(e.target.value)}
                                    placeholder="Örn: Ekran köşesinde çizik var, arka kapakta vuruk izleri var..."
                                />
                                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                    Teslimat personeli ve teknisyenlerin göreceği fiziksel durum kaydı
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Genel Not</label>
                                <textarea
                                    className="form-textarea"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Fiş ile ilgili genel notlar..."
                                    rows={3}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div>
                        {/* Müşteri / Tamirci Seçimi */}
                        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                                <h3 className="card-title">Müşteri Seçimi</h3>
                                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                    <button
                                        type="button"
                                        className={`btn btn-sm ${customerType === 'INDIVIDUAL' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => {
                                            setCustomerType('INDIVIDUAL');
                                            setCurrency('TRY');
                                        }}
                                    >Şahıs</button>
                                    <button
                                        type="button"
                                        className={`btn btn-sm ${customerType === 'REPAIRER' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setCustomerType('REPAIRER')}
                                    >Tamirci</button>
                                </div>
                            </div>

                            {customerType === 'INDIVIDUAL' ? (
                                <>
                                    <div className="form-group">
                                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                            <input
                                                type="text"
                                                className="form-input"
                                                placeholder="🔍 İsim veya telefon ile ara..."
                                                value={customerSearch}
                                                onChange={(e) => setCustomerSearch(e.target.value)}
                                                style={{ flex: 1 }}
                                            />
                                            <button type="button" className="btn btn-secondary" onClick={() => {
                                                setNewCustomer({ type: 'INDIVIDUAL', name: '', phone: '0', city: 'İstanbul', district: 'Sultanbeyli', address: '' });
                                                setShowNewCustomerModal(true);
                                            }}>
                                                ➕ Yeni Ekle
                                            </button>
                                        </div>
                                    </div>
                                    {customers.length > 0 && !selectedCustomer && (
                                        <div style={{
                                            border: '1px solid var(--border-primary)',
                                            borderRadius: 'var(--radius-md)',
                                            maxHeight: '200px',
                                            overflowY: 'auto',
                                        }}>
                                            {customers.map((c) => (
                                                <div
                                                    key={c.id}
                                                    onClick={() => {
                                                        setCustomerId(c.id);
                                                        setSelectedCustomer(c);
                                                        setCustomerSearch('');
                                                        setCustomers([]);
                                                    }}
                                                    style={{
                                                        padding: 'var(--space-3)',
                                                        cursor: 'pointer',
                                                        borderBottom: '1px solid var(--border-primary)',
                                                    }}
                                                    className="dropdown-item"
                                                >
                                                    <div style={{ fontWeight: 500 }}>{c.name}</div>
                                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                                                        {c.phone} · {c.city}/{c.district}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {selectedCustomer && (
                                        <div style={{
                                            padding: 'var(--space-3)',
                                            background: 'var(--brand-primary-light)',
                                            borderRadius: 'var(--radius-md)',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{selectedCustomer.name}</div>
                                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                                                    {selectedCustomer.phone} · {selectedCustomer.city}/{selectedCustomer.district}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => {
                                                    setSelectedCustomer(null);
                                                    setCustomerId('');
                                                }}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    <div className="form-group">
                                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                            <input
                                                type="text"
                                                className="form-input"
                                                placeholder="🔍 Tamirci adı veya telefon ile ara..."
                                                value={repairerSearch}
                                                onChange={(e) => setRepairerSearch(e.target.value)}
                                                style={{ flex: 1 }}
                                            />
                                            <button type="button" className="btn btn-secondary" onClick={() => {
                                                setNewCustomer({ type: 'REPAIRER', name: '', phone: '0', city: 'İstanbul', district: 'Sultanbeyli', address: '' });
                                                setShowNewCustomerModal(true);
                                            }}>
                                                ➕ Yeni Ekle
                                            </button>
                                        </div>
                                    </div>
                                    {repairers.length > 0 && !selectedRepairer && (
                                        <div style={{
                                            border: '1px solid var(--border-primary)',
                                            borderRadius: 'var(--radius-md)',
                                            maxHeight: '200px',
                                            overflowY: 'auto',
                                        }}>
                                            {repairers.map((r) => (
                                                <div
                                                    key={r.id}
                                                    onClick={() => {
                                                        setRepairerId(r.id);
                                                        setSelectedRepairer(r);
                                                        setRepairerSearch('');
                                                        setRepairers([]);
                                                    }}
                                                    className="dropdown-item"
                                                    style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--border-primary)' }}
                                                >
                                                    <div style={{ fontWeight: 500 }}>{r.name}</div>
                                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                                                        {r.phone} · VKN: {r.taxId}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {selectedRepairer && (
                                        <div style={{
                                            padding: 'var(--space-3)',
                                            background: 'var(--brand-primary-light)',
                                            borderRadius: 'var(--radius-md)',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{selectedRepairer.name}</div>
                                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                                                    {selectedRepairer.phone} · VKN: {selectedRepairer.taxId}
                                                </div>
                                            </div>
                                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSelectedRepairer(null); setRepairerId(''); }}>✕</button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Cihaz Bilgileri */}
                        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                            <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Cihaz Bilgileri</h3>

                            <div className="form-group">
                                <label className="form-label required">Marka</label>
                                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                    <select
                                        className="form-select"
                                        value={brandId}
                                        onChange={(e) => {
                                            setBrandId(e.target.value);
                                            setSelectedBrand(brands.find((b) => b.id === e.target.value));
                                        }}
                                        required
                                        style={{ flex: 1 }}
                                    >
                                        <option value="">— Marka Seçin —</option>
                                        {brands.map((b) => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => setShowNewBrand(!showNewBrand)}
                                        title="Yeni Marka Ekle"
                                    >
                                        ➕
                                    </button>
                                </div>
                                {showNewBrand && (
                                    <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="Yeni marka adı"
                                            value={newBrandName}
                                            onChange={(e) => setNewBrandName(e.target.value)}
                                            style={{ flex: 1 }}
                                        />
                                        <button type="button" className="btn btn-primary btn-sm" onClick={handleAddBrand}>
                                            Ekle
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="form-group">
                                <label className="form-label required">Model</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={model}
                                    onChange={(e) => setModel(e.target.value.toLocaleUpperCase('tr-TR'))}
                                    placeholder="Cihaz modeli"
                                    style={{ textTransform: 'uppercase' }}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Seri No</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={serialNo}
                                    onChange={(e) => setSerialNo(e.target.value.toLocaleUpperCase('tr-TR'))}
                                    placeholder="Seri numarası (opsiyonel)"
                                    style={{ textTransform: 'uppercase' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Error */}
                {
                    error && (
                        <div style={{
                            padding: 'var(--space-3)',
                            background: 'var(--color-danger-bg)',
                            color: 'var(--color-danger)',
                            borderRadius: 'var(--radius-md)',
                            marginTop: 'var(--space-4)',
                        }}>
                            {error}
                        </div>
                    )
                }

                {/* Submit */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => router.back()}>
                        İptal
                    </button>
                    <button type="submit" className="btn btn-primary btn-lg" disabled={isPending}>
                        {isPending ? (
                            <>
                                <span className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
                                Oluşturuluyor...
                            </>
                        ) : (
                            '🔧 Fiş Oluştur'
                        )}
                    </button>
                </div>
            </form >

            {/* New Customer Modal */}
            {showNewCustomerModal && (
                <div className="modal-overlay" onClick={() => setShowNewCustomerModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Yeni Müşteri Ekle</h3>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowNewCustomerModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleCreateCustomer}>
                            <div className="modal-body">
                                <div className="form-group" style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                                    <button
                                        type="button"
                                        className={`btn btn-sm ${newCustomer.type === 'INDIVIDUAL' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setNewCustomer({ ...newCustomer, type: 'INDIVIDUAL' })}
                                        style={{ flex: 1 }}
                                    >Şahıs Müşterisi</button>
                                    <button
                                        type="button"
                                        className={`btn btn-sm ${newCustomer.type === 'REPAIRER' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setNewCustomer({ ...newCustomer, type: 'REPAIRER' })}
                                        style={{ flex: 1 }}
                                    >Tamirci</button>
                                </div>
                                <div className="form-group">
                                    <label className="form-label required">Ad Soyad / Firma Adı</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={newCustomer.name}
                                        onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value.toLocaleUpperCase('tr-TR') })}
                                        placeholder="Ad Soyad / Firma Adı"
                                        style={{ textTransform: 'uppercase' }}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label required">Telefon</label>
                                    <input
                                        type="tel"
                                        className="form-input"
                                        placeholder="05XX XXX XX XX"
                                        value={newCustomer.phone}
                                        onChange={(e) => setNewCustomer({ ...newCustomer, phone: formatPhoneNumber(e.target.value) })}
                                        required
                                    />
                                    {newCustomer.phone && newCustomer.phone.replace(/\D/g, '').length < 11 && (
                                        <div style={{ fontSize: '11px', color: 'var(--color-danger)', marginTop: '4px' }}>
                                            ⚠️ Telefon numarası eksik (11 hane olmalı: 05XX XXX XX XX)
                                        </div>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label className={`form-label ${newCustomer.type === 'INDIVIDUAL' ? 'required' : ''}`}>Adres</label>
                                    <textarea
                                        className="form-textarea"
                                        value={newCustomer.address}
                                        onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                                        required={newCustomer.type === 'INDIVIDUAL'}
                                        rows={2}
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                    <div className="form-group">
                                        <label className="form-label required">İl</label>
                                        <SearchableSelect
                                            options={CITIES_LIST}
                                            value={newCustomer.city}
                                            onChange={handleCustomerCityChange}
                                            placeholder="İl seçin veya arayın..."
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label required">İlçe</label>
                                        <SearchableSelect
                                            options={getDistrictsByCity(newCustomer.city)}
                                            value={newCustomer.district}
                                            onChange={(newDistrict) => setNewCustomer(prev => ({ ...prev, district: newDistrict }))}
                                            placeholder="İlçe seçin veya arayın..."
                                            required
                                            disabled={!newCustomer.city}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowNewCustomerModal(false)}>İptal</button>
                                <button type="submit" className="btn btn-primary" disabled={isCreatingCustomer}>
                                    {isCreatingCustomer ? 'Ekleniyor...' : 'Ekle'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div >
    );
}
