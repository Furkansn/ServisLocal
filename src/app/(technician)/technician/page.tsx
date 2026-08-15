'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import { getActiveRepairs, addOperation, completeRepair, updateOperation, deleteOperation } from '@/actions/operations';
import { getMyWorkOrders, completePickup, completeDelivery, saveTicketPhoto, getServiceRecordPhotos, rescheduleServiceRecord, updateServiceRecordsOrder } from '@/actions/service-records';
import { getProductsByCategory, addAccessoryToTicket } from '@/actions/products';
import { compressImage } from '@/lib/image-utils';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/state-machine';
import { PRIORITY_LABELS, OPERATION_TYPE_LABELS, REQUEST_TYPE_LABELS, CUSTOMER_TYPE_LABELS, formatCurrency } from '@/lib/constants';

type Repair = Awaited<ReturnType<typeof getActiveRepairs>>[0];
type WorkOrder = Awaited<ReturnType<typeof getMyWorkOrders>>[0];

const DAYS_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

function TodayDate() {
    const now = new Date();
    const day = DAYS_TR[now.getDay()];
    const date = now.getDate();
    const month = MONTHS_TR[now.getMonth()];
    const year = now.getFullYear();
    return (
        <div style={{
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--brand-primary)',
            color: '#fff',
            fontWeight: 600,
            fontSize: 'var(--font-size-sm)',
            textAlign: 'center',
            letterSpacing: '0.02em',
        }}>
            {day}, {date} {month} {year}
        </div>
    );
}

export default function TechnicianPage() {
    const [repairs, setRepairs] = useState<Repair[]>([]);
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
    const [isPending, startTransition] = useTransition();
    const [activeId, setActiveId] = useState<string | null>(null);
    const [screens, setScreens] = useState<any[]>([]);
    const [leds, setLeds] = useState<any[]>([]);
    const [lgps, setLgps] = useState<any[]>([]);
    const [showOp, setShowOp] = useState(false);
    const [showNav, setShowNav] = useState<string | null>(null);

    // Operation form
    const [editingOpId, setEditingOpId] = useState<string | null>(null);
    const [opType, setOpType] = useState('SCREEN_CHANGE');
    const [removed, setRemoved] = useState('');
    const [installed, setInstalled] = useState('');
    const [opNotes, setOpNotes] = useState('');
    const [prodSearchQuery, setProdSearchQuery] = useState('');
    const [isProdDropdownOpen, setIsProdDropdownOpen] = useState(false);
    const [opPhotos, setOpPhotos] = useState<{ type: string; base64: string; label: string }[]>([]);
    const opFileInputRef = useRef<HTMLInputElement>(null);

    // "İşlem Yap" modal: photo + info
    const [showActionModal, setShowActionModal] = useState(false);
    const [actionRecord, setActionRecord] = useState<WorkOrder | null>(null);
    const [photos, setPhotos] = useState<{ type: string; base64: string; label: string }[]>([]);
    const [existingPhotos, setExistingPhotos] = useState<number>(0);
    const [actionNotes, setActionNotes] = useState('');
    const [repairTypeEdit, setRepairTypeEdit] = useState('');
    const [repairPriceEdit, setRepairPriceEdit] = useState('');
    const [savingAction, setSavingAction] = useState(false);
    const [actionError, setActionError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [pendingPhotoType, setPendingPhotoType] = useState<'BROKEN_DEVICE' | 'BARCODE' | 'WORKING_DEVICE' | 'OTHER'>('BROKEN_DEVICE');

    // Accessory sale state
    const [accessories, setAccessories] = useState<any[]>([]);
    const [addAccessoryEnabled, setAddAccessoryEnabled] = useState(false);
    const [accProduct, setAccProduct] = useState('');
    const [accQty, setAccQty] = useState('1');
    const [accPrice, setAccPrice] = useState('');

    // Postpone modal
    const [showPostponeModal, setShowPostponeModal] = useState(false);
    const [postponeRecord, setPostponeRecord] = useState<WorkOrder | null>(null);
    const [postponeDate, setPostponeDate] = useState('');
    const [postponeNotes, setPostponeNotes] = useState('');
    const [isPostponing, setIsPostponing] = useState(false);

    // Sorting state
    const [isSorting, setIsSorting] = useState(false);

    const load = () => {
        startTransition(async () => {
            const [r, w] = await Promise.all([getActiveRepairs(), getMyWorkOrders()]);
            setRepairs(r);
            setWorkOrders(w);
        });
    };

    useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, []);
    useEffect(() => {
        getProductsByCategory('SCREEN').then(setScreens);
        getProductsByCategory('LED', true).then(setLeds);
        getProductsByCategory('LGP', true).then(setLgps);
        getProductsByCategory('ACCESSORY').then(setAccessories);
    }, []);

    const activeRepair = repairs.find((r) => r.id === activeId);

    // Helper for product filtering by operation type & search query
    const getAvailableProducts = () => {
        if (opType === 'SCREEN_CHANGE') return screens;
        if (opType === 'LED_CHANGE') return leds;
        if (opType === 'LGP_CHANGE') return lgps;
        return [...screens, ...leds, ...lgps, ...accessories];
    };

    const availableProducts = getAvailableProducts();
    const filteredProducts = prodSearchQuery.trim()
        ? availableProducts.filter(p => p.name.toLowerCase().includes(prodSearchQuery.toLowerCase()))
        : availableProducts;

    const handleEditOp = (op: any) => {
        setEditingOpId(op.id);
        setOpType(op.operationType);
        setRemoved(op.removedPart || '');
        setInstalled(op.installedProductId || '');
        setOpNotes(op.notes || '');
        setProdSearchQuery('');
        setOpPhotos([]);
        setShowOp(true);
    };

    const handleDeleteOp = async (opId: string) => {
        if (!confirm('Bu işlemi silmek istediğinize emin misiniz?')) return;
        try {
            await deleteOperation(opId);
            load();
        } catch (err: any) { alert(err.message); }
    };

    const handleAddOp = async () => {
        if (!activeId) return;

        // Mandatory product check for Screen & LED changes
        if (opType === 'SCREEN_CHANGE' && !installed) {
            alert('⚠️ Ekran değişimi işlemi için takılan ekran seçimi zorunludur!');
            return;
        }
        if (opType === 'LED_CHANGE' && !installed) {
            alert('⚠️ LED değişimi işlemi için takılan LED seti seçimi zorunludur!');
            return;
        }

        try {
            if (editingOpId) {
                await updateOperation({
                    operationId: editingOpId,
                    operationType: opType,
                    removedPart: removed || undefined,
                    installedProductId: installed || undefined,
                    notes: opNotes || undefined,
                });
            } else {
                await addOperation({
                    ticketId: activeId,
                    operationType: opType,
                    removedPart: removed || undefined,
                    installedProductId: installed || undefined,
                    notes: opNotes || undefined,
                });
            }
            for (const p of opPhotos) {
                await saveTicketPhoto({
                    ticketId: activeId,
                    type: p.type as any,
                    base64: p.base64,
                });
            }
            setShowOp(false);
            setEditingOpId(null);
            setRemoved('');
            setInstalled('');
            setOpNotes('');
            setProdSearchQuery('');
            setOpPhotos([]);
            load();
        } catch (err: any) { alert(err.message); }
    };

    const handleComplete = async (ticketId: string) => {
        if (!confirm('Tamiri tamamlamak istediğinize emin misiniz?')) return;
        try {
            await completeRepair(ticketId);
            setActiveId(null);
            load();
        } catch (err: any) { alert(err.message); }
    };

    const openActionModal = async (record: WorkOrder) => {
        setActionRecord(record);
        setPhotos([]);
        setActionNotes('');
        setActionError('');
        setRepairTypeEdit((record.ticket as any).requestType || '');
        setRepairPriceEdit(String(Number((record.ticket as any).repairPrice || 0)));
        // Get existing photo count
        try {
            const existing = await getServiceRecordPhotos(record.id);
            setExistingPhotos(existing.length);
        } catch { setExistingPhotos(0); }
        setAddAccessoryEnabled(false);
        setAccProduct('');
        setAccQty('1');
        setAccPrice('');
        setShowActionModal(true);
    };

    const handleFileCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        try {
            const compressed = await compressImage(file, 1280, 1280, 0.7);
            setPhotos(prev => [...prev, { 
                type: pendingPhotoType, 
                base64: compressed, 
                label: getPendingLabel(pendingPhotoType) 
            }]);
        } catch (err: any) {
            alert('Fotoğraf işlenirken hata: ' + err.message);
        }
        
        e.target.value = '';
    };

    const handleFileCaptureOp = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        try {
            const compressed = await compressImage(file, 1280, 1280, 0.7);
            setOpPhotos(prev => [...prev, { 
                type: 'OTHER', 
                base64: compressed, 
                label: '📷 İşlem Fotoğrafı' 
            }]);
        } catch (err: any) {
            alert('Fotoğraf işlenirken hata: ' + err.message);
        }
        
        e.target.value = '';
    };

    const getPendingLabel = (type: string) => {
        const map: Record<string, string> = {
            BROKEN_DEVICE: '📸 Arızalı Cihaz',
            BARCODE: '🔖 Barkod',
            WORKING_DEVICE: '✅ Çalışır Hali',
            OTHER: '📷 Diğer',
        };
        return map[type] || type;
    };

    const triggerCapture = (type: 'BROKEN_DEVICE' | 'BARCODE' | 'WORKING_DEVICE' | 'OTHER') => {
        setPendingPhotoType(type);
        fileInputRef.current?.click();
    };

    const handleCompleteService = async () => {
        if (!actionRecord) return;
        const totalPhotos = existingPhotos + photos.length;
        const required = actionRecord.type === 'PICKUP' ? 2 : 1;
        if (totalPhotos < required) {
            setActionError(`En az ${required} fotoğraf eklemelisiniz`);
            return;
        }
        setSavingAction(true);
        setActionError('');
        try {
            const ticketId = (actionRecord.ticket as any).id;
            // Save all new photos
            for (const p of photos) {
                await saveTicketPhoto({
                    ticketId,
                    serviceRecordId: actionRecord.id,
                    type: p.type as any,
                    base64: p.base64,
                });
            }

            // Save accessory sale if enabled
            if (addAccessoryEnabled && accProduct) {
                await addAccessoryToTicket({
                    ticketId,
                    productId: accProduct,
                    quantity: Number(accQty) || 1,
                    unitPrice: Number(accPrice) || 0,
                });
            }

            // Complete pickup or delivery
            if (actionRecord.type === 'PICKUP') {
                await completePickup(actionRecord.id, actionNotes || undefined);
            } else {
                await completeDelivery(actionRecord.id, actionNotes || undefined);
            }
            setShowActionModal(false);
            setActionRecord(null);
            load();
        } catch (err: any) {
            setActionError(err.message);
        } finally {
            setSavingAction(false);
        }
    };

    const handlePostpone = async () => {
        if (!postponeRecord || !postponeDate) return;
        setIsPostponing(true);
        try {
            await rescheduleServiceRecord(postponeRecord.id, postponeDate);
            setShowPostponeModal(false);
            load();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsPostponing(false);
        }
    };

    const moveOrder = (index: number, direction: 'up' | 'down') => {
        const newOrders = [...workOrders];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newOrders.length) return;
        
        [newOrders[index], newOrders[targetIndex]] = [newOrders[targetIndex], newOrders[index]];
        // Recalculate sortOrder based on new positions
        const updatedOrders = newOrders.map((wo, i) => ({ ...wo, sortOrder: i }));
        setWorkOrders(updatedOrders);
    };

    const saveSortOrder = async () => {
        try {
            await updateServiceRecordsOrder(workOrders.map((wo, i) => ({ id: wo.id, sortOrder: i })));
            setIsSorting(false);
            load();
        } catch (err: any) { alert(err.message); }
    };


    return (
        <div style={{ padding: 'var(--space-4)' }}>
            <TodayDate />

            {/* My Service Work Orders */}
            {workOrders.length > 0 && (
                <div style={{ marginBottom: 'var(--space-5)', marginTop: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                        <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, margin: 0, color: 'var(--text-secondary)' }}>
                            📥 Bugünkü Servis Görevlerim ({workOrders.length})
                        </h2>
                        {!isSorting ? (
                            <button className="btn btn-secondary btn-sm" onClick={() => setIsSorting(true)}>↕️ Sırala</button>
                        ) : (
                            <button className="btn btn-success btn-sm" onClick={saveSortOrder}>💾 Sıralamayı Kaydet</button>
                        )}
                    </div>
                    {workOrders.map((wo, index) => {
                        const customer = (wo.ticket as any).customer || (wo.ticket as any).repairer;
                        return (
                            <div key={wo.id} className="card" style={{ marginBottom: 'var(--space-3)', padding: 'var(--space-3)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                                    <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{(wo.ticket as any).ticketNo}</div>
                                    <span className={`badge ${wo.status === 'COMPLETED' ? 'badge-success' : 'badge-info'}`}>
                                        {wo.status === 'COMPLETED' ? 'Tamamlandı' : wo.type === 'PICKUP' ? '📥 Teslim Alınacak' : '📤 Teslim Edilecek'}
                                    </span>
                                </div>
                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                                    <strong>{customer?.name || '-'}</strong> · {(wo.ticket as any).brand?.name} {(wo.ticket as any).model}
                                </div>
                                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-2)', display: 'flex', gap: '4px', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--brand-primary)' }}>🛠</span>
                                    <span>{REQUEST_TYPE_LABELS[(wo.ticket as any).requestType as keyof typeof REQUEST_TYPE_LABELS] || 'Talep Belirtilmemiş'}</span>
                                </div>
                                {customer?.address && (
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-2)', display: 'flex', gap: '4px' }}>
                                        <span>📍</span>
                                        <a 
                                            href="#"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setShowNav(encodeURIComponent(`${customer.address}, ${customer.city} ${customer.district}`));
                                            }}
                                            style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px dashed var(--border-color)' }}
                                        >
                                            {customer.address}, {customer.city}/{customer.district}
                                        </a>
                                    </div>
                                )}
                                {wo.status !== 'COMPLETED' && (
                                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                        {isSorting ? (
                                            <>
                                                <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => moveOrder(index, 'up')} disabled={index === 0}>⬆️</button>
                                                <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => moveOrder(index, 'down')} disabled={index === workOrders.length - 1}>⬇️</button>
                                            </>
                                        ) : (
                                            <>
                                                <button className="btn btn-primary btn-sm" style={{ flex: 2 }} onClick={() => openActionModal(wo)}>📷 İşlem Yap</button>
                                                <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => {
                                                    setPostponeRecord(wo);
                                                    setPostponeDate('');
                                                    setShowPostponeModal(true);
                                                }}>⏳ Ertele</button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* My Active Repairs */}
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, marginBottom: 'var(--space-3)', color: 'var(--text-secondary)' }}>
                🔧 Tamirlerim ({repairs.length})
            </h2>

            {repairs.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🔧</div>
                    <div className="empty-state-title">Aktif tamir yok</div>
                    <p>Operatör size fiş atadığında burada görünecek.</p>
                </div>
            ) : (
                <div>
                    {repairs.map((repair) => (
                        <div
                            key={repair.id}
                            className="card"
                            style={{
                                marginBottom: 'var(--space-3)',
                                border: activeId === repair.id ? '2px solid var(--brand-primary)' : undefined,
                                cursor: 'pointer',
                            }}
                            onClick={() => setActiveId(activeId === repair.id ? null : repair.id)}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                                <div>
                                    <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{repair.ticketNo}</span>
                                    <span className={`badge badge-priority-${repair.priority}`} style={{ marginLeft: 'var(--space-2)' }}>
                                        {PRIORITY_LABELS[repair.priority]}
                                    </span>
                                </div>
                                <span className="badge" style={{ background: `${STATUS_COLORS[repair.status]}20`, color: STATUS_COLORS[repair.status] }}>
                                    {STATUS_LABELS[repair.status]}
                                </span>
                            </div>

                            <div style={{ marginBottom: 'var(--space-2)' }}>
                                <div style={{ fontWeight: 600 }}>{repair.brand.name} {repair.model}</div>
                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-1)' }}>
                                    {CUSTOMER_TYPE_LABELS[repair.customerType as 'INDIVIDUAL' | 'REPAIRER']} · {repair.customer?.name || repair.repairer?.name || '-'}
                                </div>
                                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', gap: '4px', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--brand-primary)' }}>🛠</span>
                                    <span>{REQUEST_TYPE_LABELS[repair.requestType as keyof typeof REQUEST_TYPE_LABELS] || 'Talep Belirtilmemiş'}</span>
                                </div>
                            </div>

                            {activeId === repair.id && (
                                <div onClick={(e) => e.stopPropagation()}>
                                    {repair.operations.length > 0 && (
                                        <div style={{ marginBottom: 'var(--space-3)' }}>
                                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-1)' }}>Yapılan İşlemler</div>
                                            {repair.operations.map((op: any) => (
                                                <div key={op.id} style={{
                                                    padding: 'var(--space-2) var(--space-3)',
                                                    background: 'var(--bg-tertiary)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    marginBottom: 'var(--space-2)',
                                                    fontSize: 'var(--font-size-sm)',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}>
                                                    <div>
                                                        <div style={{ fontWeight: 600 }}>
                                                            {OPERATION_TYPE_LABELS[op.operationType as keyof typeof OPERATION_TYPE_LABELS]}
                                                            {op.installedProduct && ` → ${op.installedProduct.name}`}
                                                        </div>
                                                        {op.removedPart && <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Çıkan: {op.removedPart}</div>}
                                                        {op.notes && <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Not: {op.notes}</div>}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '4px' }}>
                                                        <button
                                                            className="btn btn-ghost btn-sm"
                                                            style={{ fontSize: '12px', padding: '2px 6px', color: 'var(--brand-primary)' }}
                                                            onClick={() => handleEditOp(op)}
                                                            title="İşlemi Düzenle"
                                                        >
                                                            ✏️
                                                        </button>
                                                        <button
                                                            className="btn btn-ghost btn-sm"
                                                            style={{ fontSize: '12px', padding: '2px 6px', color: 'var(--color-danger)' }}
                                                            onClick={() => handleDeleteOp(op.id)}
                                                            title="İşlemi Sil"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                        <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => {
                                            setEditingOpId(null);
                                            setOpType('SCREEN_CHANGE');
                                            setRemoved('');
                                            setInstalled('');
                                            setOpNotes('');
                                            setOpPhotos([]);
                                            setShowOp(true);
                                        }}>
                                            ➕ İşlem Ekle
                                        </button>
                                        <button className="btn btn-success btn-sm" style={{ flex: 1 }} onClick={() => handleComplete(repair.id)}>
                                            ✅ Tamiri Tamamla
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Add / Edit Operation Modal */}
            {showOp && (
                <div className="modal-overlay" onClick={() => setShowOp(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">{editingOpId ? '✏️ İşlemi Düzenle' : '🔧 İşlem Ekle'}</h3>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowOp(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label required">İşlem Türü</label>
                                <select className="form-select" value={opType} onChange={(e) => setOpType(e.target.value)}>
                                    {Object.entries(OPERATION_TYPE_LABELS).map(([k, v]) => (
                                        <option key={k} value={k}>{v}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Çıkan Parça</label>
                                <input className="form-input" value={removed} onChange={(e) => setRemoved(e.target.value)} placeholder="Sökülen parça açıklaması" />
                            </div>
                            <div className="form-group" style={{ position: 'relative' }}>
                                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>Takılan Ürün {(opType === 'SCREEN_CHANGE' || opType === 'LED_CHANGE') && <span style={{ color: 'var(--color-danger)' }}>* (Zorunlu)</span>}</span>
                                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                        {opType === 'SCREEN_CHANGE' ? '📱 Sadece Ekranlar' : opType === 'LED_CHANGE' ? '💡 Sadece LED Barlar' : opType === 'LGP_CHANGE' ? '🔆 Sadece LGP Paneller' : '📦 Tüm Ürünler'}
                                    </span>
                                </label>

                                {/* Combined Search Input & Select Box */}
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder={(opType === 'SCREEN_CHANGE' || opType === 'LED_CHANGE') ? '🔍 Takılan ürünü arayın veya listeden seçin... (Zorunlu)' : '🔍 Takılan ürünü arayın veya listeden seçin...'}
                                        value={
                                            isProdDropdownOpen
                                                ? prodSearchQuery
                                                : (installed ? (availableProducts.find(p => p.id === installed)?.name || 'Seçili Ürün') : prodSearchQuery)
                                        }
                                        onFocus={() => setIsProdDropdownOpen(true)}
                                        onChange={(e) => {
                                            setProdSearchQuery(e.target.value);
                                            setIsProdDropdownOpen(true);
                                            if (installed) setInstalled('');
                                        }}
                                        style={{
                                            paddingRight: (installed || prodSearchQuery) ? '34px' : '12px',
                                            fontSize: '13px',
                                            borderColor: (opType === 'SCREEN_CHANGE' || opType === 'LED_CHANGE') && !installed ? 'var(--color-warning)' : undefined,
                                            fontWeight: installed && !isProdDropdownOpen ? 600 : 400,
                                            color: installed && !isProdDropdownOpen ? 'var(--brand-primary)' : 'var(--text-primary)',
                                        }}
                                    />

                                    {/* Clear button */}
                                    {(installed || prodSearchQuery) && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setInstalled('');
                                                setProdSearchQuery('');
                                                setIsProdDropdownOpen(false);
                                            }}
                                            style={{
                                                position: 'absolute',
                                                right: '10px',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                background: 'rgba(255,255,255,0.1)',
                                                border: 'none',
                                                borderRadius: '50%',
                                                width: '20px',
                                                height: '20px',
                                                color: 'var(--text-secondary)',
                                                cursor: 'pointer',
                                                fontSize: '12px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                            title="Temizle"
                                        >
                                            ✕
                                        </button>
                                    )}

                                    {/* Dropdown Popup List */}
                                    {isProdDropdownOpen && (
                                        <>
                                            {/* Backdrop to close dropdown when clicking outside */}
                                            <div
                                                style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                                                onClick={() => setIsProdDropdownOpen(false)}
                                            />

                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    top: 'calc(100% + 4px)',
                                                    left: 0,
                                                    right: 0,
                                                    zIndex: 100,
                                                    maxHeight: '220px',
                                                    overflowY: 'auto',
                                                    background: 'var(--bg-secondary)',
                                                    border: '1px solid var(--border-primary)',
                                                    borderRadius: 'var(--radius-md)',
                                                    boxShadow: 'var(--shadow-lg)',
                                                }}
                                            >
                                                {filteredProducts.length === 0 ? (
                                                    <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px', fontStyle: 'italic' }}>
                                                        Aramanıza veya kategoriye uygun ürün bulunamadı.
                                                    </div>
                                                ) : (
                                                    filteredProducts.map((p) => {
                                                        const isSelected = installed === p.id;
                                                        const isOutOfStock = p.stock <= 0;
                                                        return (
                                                            <div
                                                                key={p.id}
                                                                onClick={() => {
                                                                    setInstalled(p.id);
                                                                    setProdSearchQuery('');
                                                                    setIsProdDropdownOpen(false);
                                                                }}
                                                                style={{
                                                                    padding: '10px 12px',
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    justifyContent: 'space-between',
                                                                    alignItems: 'center',
                                                                    borderBottom: '1px solid var(--border-primary)',
                                                                    background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                                                                    fontSize: '13px',
                                                                }}
                                                            >
                                                                <div style={{ fontWeight: isSelected ? 600 : 400, color: isSelected ? 'var(--brand-primary)' : 'var(--text-primary)' }}>
                                                                    {p.name}
                                                                </div>
                                                                <span style={{
                                                                    fontSize: '11px',
                                                                    padding: '2px 8px',
                                                                    borderRadius: 'var(--radius-full)',
                                                                    fontWeight: 600,
                                                                    background: isOutOfStock ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                                                                    color: isOutOfStock ? 'var(--color-danger)' : 'var(--color-success)',
                                                                }}>
                                                                    Stok: {p.stock}
                                                                </span>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Not</label>
                                <textarea className="form-textarea" value={opNotes} onChange={(e) => setOpNotes(e.target.value)} placeholder="İşlem notu..." rows={2} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Fotoğraflar</label>
                                <button type="button" className="btn btn-secondary btn-sm btn-block" onClick={() => opFileInputRef.current?.click()}>📸 Fotoğraf Ekle</button>
                                <input
                                    ref={opFileInputRef}
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    style={{ display: 'none' }}
                                    onChange={handleFileCaptureOp}
                                />
                                {opPhotos.length > 0 && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                                        {opPhotos.map((p, i) => (
                                            <div key={i} style={{ position: 'relative' }}>
                                                <img src={p.base64} alt={p.label} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                                                <button
                                                    type="button"
                                                    style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 11 }}
                                                    onClick={() => setOpPhotos(prev => prev.filter((_, idx) => idx !== i))}
                                                >✕</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowOp(false)}>İptal</button>
                            <button className="btn btn-primary" onClick={handleAddOp}>{editingOpId ? '💾 Güncelle' : '💾 Kaydet'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Action Modal: Photos + Info */}
            {showActionModal && actionRecord && (
                <div className="modal-overlay" onClick={() => { setShowActionModal(false); }}>
                    <div className="modal" style={{ maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">📷 İşlem Yap — {(actionRecord.ticket as any).ticketNo}</h3>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowActionModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            {/* Device info */}
                            <div style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
                                <div style={{ fontWeight: 600 }}>{(actionRecord.ticket as any).brand?.name} {(actionRecord.ticket as any).model}</div>
                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                                    {REQUEST_TYPE_LABELS[(actionRecord.ticket as any).requestType as keyof typeof REQUEST_TYPE_LABELS] || (actionRecord.ticket as any).requestType}
                                    {' · '}
                                    {formatCurrency(Number((actionRecord.ticket as any).repairPrice || 0))}
                                </div>
                            </div>

                            {/* Photo capture buttons */}
                            <div className="form-group">
                                <label className="form-label">
                                    Fotoğraflar <span style={{ color: 'var(--color-danger)' }}>*</span>
                                    <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 4 }}>
                                        (min. {actionRecord.type === 'PICKUP' ? 2 : 1})
                                    </span>
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                                    {actionRecord.type === 'PICKUP' ? (
                                        <>
                                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => triggerCapture('BROKEN_DEVICE')}>📸 Arızalı Cihaz</button>
                                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => triggerCapture('BARCODE')}>🔖 Barkod</button>
                                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => triggerCapture('OTHER')}>📷 Diğer</button>
                                        </>
                                    ) : (
                                        <>
                                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => triggerCapture('WORKING_DEVICE')}>✅ Çalışır Hali</button>
                                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => triggerCapture('OTHER')}>📷 Diğer</button>
                                        </>
                                    )}
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    style={{ display: 'none' }}
                                    onChange={handleFileCapture}
                                />
                                {/* Photo previews */}
                                {photos.length > 0 && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                                        {photos.map((p, i) => (
                                            <div key={i} style={{ position: 'relative' }}>
                                                <img src={p.base64} alt={p.label} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                                                <div style={{ fontSize: '10px', textAlign: 'center', marginTop: '2px', color: 'var(--text-tertiary)' }}>{p.label}</div>
                                                <button
                                                    type="button"
                                                    style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 11 }}
                                                    onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                                                >✕</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div style={{ fontSize: 'var(--font-size-xs)', color: existingPhotos + photos.length >= (actionRecord.type === 'PICKUP' ? 2 : 1) ? 'var(--color-success)' : 'var(--color-danger)', marginTop: 'var(--space-1)' }}>
                                    {existingPhotos > 0 ? `${existingPhotos} mevcut + ` : ''}{photos.length} yeni fotoğraf (min. {actionRecord.type === 'PICKUP' ? 2 : 1} gerekli)
                                </div>
                            </div>

                            {/* Accessory sale – available for both PICKUP and DELIVERY */}
                            <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', marginBottom: 'var(--space-2)' }}>
                                    <input type="checkbox" checked={addAccessoryEnabled} onChange={(e) => setAddAccessoryEnabled(e.target.checked)} />
                                    <span className="form-label" style={{ margin: 0 }}>🛍 Aksesuar Satışı Ekle</span>
                                </label>
                                {addAccessoryEnabled && (
                                    <div style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                        <select className="form-select" value={accProduct} onChange={(e) => {
                                            setAccProduct(e.target.value);
                                            const p = accessories.find(a => a.id === e.target.value);
                                            if (p) setAccPrice(String(p.price));
                                        }}>
                                            <option value="">— Ürün Seçin —</option>
                                            {accessories.map((a) => (
                                                <option key={a.id} value={a.id}>{a.name} (Stok: {a.stock})</option>
                                            ))}
                                        </select>
                                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                            <input type="number" className="form-input" placeholder="Adet" value={accQty} onChange={(e) => setAccQty(e.target.value)} min="1" style={{ flex: 1 }} />
                                            <input type="number" className="form-input" placeholder="Birim Fiyat ₺" value={accPrice} onChange={(e) => setAccPrice(e.target.value)} min="0" style={{ flex: 1 }} />
                                        </div>
                                        {accProduct && accPrice && (
                                            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                                                Toplam: <strong>{formatCurrency((Number(accQty) || 1) * (Number(accPrice) || 0))}</strong>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Notes */}
                            <div className="form-group">
                                <label className="form-label">Not (opsiyonel)</label>
                                <textarea
                                    className="form-textarea"
                                    value={actionNotes}
                                    onChange={(e) => setActionNotes(e.target.value)}
                                    placeholder="İşlem notu..."
                                    rows={2}
                                />
                            </div>

                            {actionError && (
                                <div style={{ padding: 'var(--space-2)', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)' }}>
                                    {actionError}
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowActionModal(false)}>İptal</button>
                            <button
                                className="btn btn-success"
                                disabled={savingAction || (existingPhotos + photos.length < 2)}
                                onClick={handleCompleteService}
                            >
                                {savingAction ? 'Kaydediliyor...' : '✅ Tamamla'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Postpone Modal */}
            {showPostponeModal && postponeRecord && (
                <div className="modal-overlay" onClick={() => setShowPostponeModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">⏳ Servisi Ertele</h3>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowPostponeModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-4)' }}>
                                <strong>{(postponeRecord.ticket as any).ticketNo}</strong> numaralı cihazın servis tarihini değiştirin.
                            </p>
                            
                            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                                <label className="form-label">Tarih Seçin</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                                    <button 
                                        className={`btn btn-sm ${postponeDate === new Date(Date.now() + 86400000).toISOString().split('T')[0] ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setPostponeDate(new Date(Date.now() + 86400000).toISOString().split('T')[0])}
                                    >
                                        🗓 Yarın
                                    </button>
                                    <button 
                                        className={`btn btn-sm ${postponeDate === new Date(Date.now() + 172800000).toISOString().split('T')[0] ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setPostponeDate(new Date(Date.now() + 172800000).toISOString().split('T')[0])}
                                    >
                                        🗓 Öbür Gün
                                    </button>
                                </div>
                                <input 
                                    type="date" 
                                    className="form-input" 
                                    value={postponeDate} 
                                    onChange={(e) => setPostponeDate(e.target.value)} 
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Not (opsiyonel)</label>
                                <textarea
                                    className="form-textarea"
                                    value={postponeNotes}
                                    onChange={(e) => setPostponeNotes(e.target.value)}
                                    placeholder="Erteleme sebebi..."
                                    rows={2}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowPostponeModal(false)}>İptal</button>
                            <button className="btn btn-primary" disabled={!postponeDate || isPostponing} onClick={handlePostpone}>
                                {isPostponing ? 'Erteleniyor...' : 'Erteleneyi Kaydet'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showNav && (
                <div className="modal-overlay" onClick={() => setShowNav(null)} style={{ alignItems: 'flex-end', padding: 0, zIndex: 9999 }}>
                    <div className="modal" style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, width: '100%', marginBottom: 0, animation: 'slideUp 0.3s ease-out', padding: 'var(--space-4)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Rota Oluştur</h3>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowNav(null)}>✕</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                            <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${showNav}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                onClick={() => setShowNav(null)}
                                className="btn"
                                style={{ padding: '16px', justifyContent: 'flex-start', fontSize: '16px', background: '#fff', color: '#1a73e8', border: '1px solid #ddd' }}
                            >
                                🗺 Google Haritalar
                            </a>
                            <a 
                                href={`yandexnavi://map_search?text=${showNav}`}
                                onClick={() => setShowNav(null)}
                                className="btn"
                                style={{ padding: '16px', justifyContent: 'flex-start', fontSize: '16px', background: '#ffe400', color: '#000', border: 'none' }}
                            >
                                🧭 Yandex Navigasyon
                            </a>
                            <a 
                                href={`http://maps.apple.com/?q=${showNav}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                onClick={() => setShowNav(null)}
                                className="btn btn-secondary"
                                style={{ padding: '16px', justifyContent: 'flex-start', fontSize: '16px' }}
                            >
                                🍎 Apple Haritalar
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
