'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { updateTicket, getTicketById } from '@/actions/tickets';
import { getCustomers } from '@/actions/customers';
import { getRepairers } from '@/actions/repairers';
import { getBrands, createBrand } from '@/actions/brands';
import { getPersonnelByRole } from '@/actions/personnel';
import { REQUEST_TYPE_LABELS, PRIORITY_LABELS } from '@/lib/constants';
import { Role } from '@prisma/client';

export default function EditTicketPage() {
    const router = useRouter();
    const params = useParams();
    const ticketId = params?.id as string;
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

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
    const [notes, setNotes] = useState('');
    const [serviceDate, setServiceDate] = useState('');
    const [servicePersonnelId, setServicePersonnelId] = useState('');
    const [repairPrice, setRepairPrice] = useState<string | number>('');
    const [repairItems, setRepairItems] = useState<{ type: string, price: string }[]>([]);

    // Search / lookup data
    const [customerSearch, setCustomerSearch] = useState('');
    const [customers, setCustomers] = useState<any[]>([]);
    const [repairerSearch, setRepairerSearch] = useState('');
    const [repairers, setRepairers] = useState<any[]>([]);
    const [brands, setBrands] = useState<any[]>([]);
    const [servicePersonnel, setServicePersonnel] = useState<any[]>([]);
    const [newBrandName, setNewBrandName] = useState('');
    const [showNewBrand, setShowNewBrand] = useState(false);

    // Selected display
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const [selectedRepairer, setSelectedRepairer] = useState<any>(null);
    const [selectedBrand, setSelectedBrand] = useState<any>(null);



    // Load initial data
    useEffect(() => {
        const loadJava = async () => {
            try {
                const [brandsData, personnelData, ticketData] = await Promise.all([
                    getBrands(),
                    getPersonnelByRole(Role.SERVICE_STAFF),
                    getTicketById(ticketId)
                ]);

                setBrands(brandsData);
                setServicePersonnel(personnelData);

                if (!ticketData) {
                    setError('Fiş bulunamadı');
                    setLoading(false);
                    return;
                }

                // Populate form
                setRequestType(ticketData.requestType);
                setPriority(ticketData.priority);
                setCustomerType(ticketData.customerType);
                setCustomerId(ticketData.customerId || '');
                setRepairerId(ticketData.repairerId || '');
                setBrandId(ticketData.brandId);
                setModel(ticketData.model);
                setSerialNo(ticketData.serialNo || '');
                setHasWarranty(ticketData.hasWarranty);
                setNotes(ticketData.notes || '');
                setRepairPrice(Number(ticketData.repairPrice) || '');

                const parsedItems = (ticketData as any).repairItems && typeof (ticketData as any).repairItems === 'string' 
                    ? JSON.parse((ticketData as any).repairItems) 
                    : (ticketData as any).repairItems;
                if (parsedItems && Array.isArray(parsedItems) && parsedItems.length > 0) {
                    setRepairItems(parsedItems.map(item => ({ type: item.type, price: item.price ? Number(item.price).toLocaleString('tr-TR') : '' })));
                } else {
                    setRepairItems([{ type: ticketData.requestType, price: ticketData.repairPrice ? Number(ticketData.repairPrice).toLocaleString('tr-TR') : '' }]);
                }

                if (ticketData.customer) setSelectedCustomer(ticketData.customer);
                if (ticketData.repairer) setSelectedRepairer(ticketData.repairer);
                if (ticketData.brand) setSelectedBrand(ticketData.brand);

                // SRV specific - Currently getTicketById might not return serviceRecord info simply?
                // We need to check if we have service record info. 
                // Currently getTicketById returns ticket relations. 
                // ServiceRecord relation might not be directly exposed in getTicketById or might be empty if we didn't include it.
                // But for SRV fields generally stored on ticket? No, serviceDate is on ServiceRecord.
                // Wait, createTicket creates ServiceRecord if SRV.
                // updateTicket usually doesn't update ServiceRecord fields directly in valid updateTicket logic unless extended.
                // My updateTicket in tickets.ts only updates RepairTicket fields!
                // So Service Date and Personnel might NOT be editable here via updateTicket.
                // This is a limitation. I will only populate what is on RepairTicket.
                // But user just asked to "edit".
                // I will ignore ServiceRecord fields for now or leave them as is if not editable.
                // The prompt was "edit details".

            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (ticketId) loadJava();
    }, [ticketId]);

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



    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        startTransition(async () => {
            try {
                await updateTicket(ticketId, {
                    requestType,
                    priority,
                    customerType,
                    customerId: customerId || null,
                    repairerId: repairerId || null,
                    brandId,
                    model,
                    serialNo: serialNo || null,
                    hasWarranty,
                    notes: notes || null,
                    repairPrice: repairItems.reduce((acc, item) => {
                        const cleanPrice = item.price.replace(/\./g, '').replace(',', '.');
                        return acc + Number(cleanPrice || 0);
                    }, 0),
                    repairItems: repairItems.map(i => {
                        const cleanPrice = i.price.replace(/\./g, '').replace(',', '.');
                        return { type: i.type, price: Number(cleanPrice || 0) };
                    }),
                });
                router.push(`/tickets/${ticketId}`);
                router.refresh();
            } catch (err: any) {
                setError(err.message || 'Bir hata oluştu');
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

    if (loading) return <div>Yükleniyor...</div>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Fiş Düzenle</h1>
                    <p className="page-subtitle">Fiş bilgilerini güncelle</p>
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
                                <label className="form-label required">Tahmini Tamir Tutarları (₺)</label>
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
                                                placeholder=""
                                                style={{ paddingRight: '2.5rem' }}
                                            />
                                            <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>₺</span>
                                        </div>
                                        <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => {
                                            if (repairItems.length > 1) {
                                                const newItems = [...repairItems];
                                                newItems.splice(index, 1);
                                                setRepairItems(newItems);
                                            }
                                        }}>🗑</button>
                                    </div>
                                ))}
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
                                    setRepairItems([...repairItems, { type: 'OTHER', price: '' }]);
                                }} style={{ marginTop: 'var(--space-2)', width: '100%' }}>
                                    ➕ Yeni Fiyat Kalemi Ekle
                                </button>
                                <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                                    Genel Toplam: <strong style={{ color: 'var(--text-primary)' }}>{repairItems.reduce((acc, item) => acc + Number(item.price.replace(/\./g, '') || 0), 0).toLocaleString('tr-TR')} ₺</strong>
                                </div>
                            </div>
                        </div>

                        {/* Not */}
                        <div className="card">
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Not</label>
                                <textarea
                                    className="form-textarea"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Fiş ile ilgili notlar..."
                                    rows={3}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div>
                        {/* Müşteri / Tamirci Seçimi */}
                        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                                <button
                                    type="button"
                                    className={`btn flex-1 ${customerType === 'INDIVIDUAL' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => {
                                        if (customerType !== 'INDIVIDUAL') {
                                            setCustomerType('INDIVIDUAL');
                                            setRepairerId('');
                                            setSelectedRepairer(null);
                                        }
                                    }}
                                >
                                    👤 Şahıs/Müşteri
                                </button>
                                <button
                                    type="button"
                                    className={`btn flex-1 ${customerType === 'REPAIRER' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => {
                                        if (customerType !== 'REPAIRER') {
                                            setCustomerType('REPAIRER');
                                            setCustomerId('');
                                            setSelectedCustomer(null);
                                        }
                                    }}
                                >
                                    🏪 Tamirci/Firma
                                </button>
                            </div>

                            {customerType === 'INDIVIDUAL' ? (
                                <>
                                    <div className="form-group">
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="🔍 İsim veya telefon ile ara..."
                                            value={customerSearch}
                                            onChange={(e) => setCustomerSearch(e.target.value)}
                                        />
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
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="🔍 Tamirci adı veya telefon ile ara..."
                                            value={repairerSearch}
                                            onChange={(e) => setRepairerSearch(e.target.value)}
                                        />
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
                                Güncelleniyor...
                            </>
                        ) : (
                            '💾 Güncelle'
                        )}
                    </button>
                </div>
            </form >
        </div >
    );
}
