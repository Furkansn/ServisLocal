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
            padding: '8px 14px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            color: 'var(--text-primary)',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '12.5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '14px',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>📅</span>
                <span>{date} {month} {year}, {day}</span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--brand-primary)', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                Teknisyen Portalı
            </span>
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

    // Sorting & Search state
    const [isSorting, setIsSorting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

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
            for (const p of photos) {
                await saveTicketPhoto({
                    ticketId,
                    serviceRecordId: actionRecord.id,
                    type: p.type as any,
                    base64: p.base64,
                });
            }

            if (addAccessoryEnabled && accProduct) {
                await addAccessoryToTicket({
                    ticketId,
                    productId: accProduct,
                    quantity: Number(accQty) || 1,
                    unitPrice: Number(accPrice) || 0,
                });
            }

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

    const filteredRepairs = repairs.filter((repair) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        const ticketNoMatch = repair.ticketNo?.toLowerCase().includes(q);
        const modelMatch = repair.model?.toLowerCase().includes(q);
        const brandMatch = repair.brand?.name?.toLowerCase().includes(q);
        const customerMatch = repair.customer?.name?.toLowerCase().includes(q);
        const repairerMatch = repair.repairer?.name?.toLowerCase().includes(q);
        return ticketNoMatch || modelMatch || brandMatch || customerMatch || repairerMatch;
    });

    return (
        <div style={{ padding: '14px', maxWidth: '840px', margin: '0 auto' }}>
            <TodayDate />

            {/* Search Input */}
            <div style={{ marginBottom: '14px' }}>
                <input
                    type="text"
                    className="form-input"
                    placeholder="🔍 Fiş No (SP-000003), Model veya Müşteri / Tamirci Adı ile ara..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ fontSize: '13px', padding: '8px 12px', width: '100%', borderRadius: '8px' }}
                />
            </div>

            {/* My Service Work Orders */}
            {workOrders.length > 0 && (
                <div style={{ marginBottom: '18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h2 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--text-secondary)' }}>
                            📥 Bugünkü Servis Görevlerim ({workOrders.length})
                        </h2>
                        {!isSorting ? (
                            <button className="btn btn-secondary btn-xs" onClick={() => setIsSorting(true)} style={{ fontSize: '11px', padding: '3px 8px' }}>↕️ Sırala</button>
                        ) : (
                            <button className="btn btn-success btn-xs" onClick={saveSortOrder} style={{ fontSize: '11px', padding: '3px 8px' }}>💾 Sıralamayı Kaydet</button>
                        )}
                    </div>
                    {workOrders.map((wo, index) => {
                        const customer = (wo.ticket as any).customer || (wo.ticket as any).repairer;
                        return (
                            <div key={wo.id} className="card" style={{ marginBottom: '10px', padding: '10px 12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                    <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '13px' }}>{(wo.ticket as any).ticketNo}</div>
                                    <span className={`badge ${wo.status === 'COMPLETED' ? 'badge-success' : 'badge-info'}`} style={{ fontSize: '11px' }}>
                                        {wo.status === 'COMPLETED' ? 'Tamamlandı' : wo.type === 'PICKUP' ? '📥 Teslim Alınacak' : '📤 Teslim Edilecek'}
                                    </span>
                                </div>
                                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                    <strong style={{ color: 'var(--text-primary)' }}>{customer?.name || '-'}</strong> · {(wo.ticket as any).brand?.name} {(wo.ticket as any).model}
                                </div>
                                <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--brand-primary)' }}>🛠</span>
                                    <span>{REQUEST_TYPE_LABELS[(wo.ticket as any).requestType as keyof typeof REQUEST_TYPE_LABELS] || 'Talep Belirtilmemiş'}</span>
                                </div>
                                {customer?.address && (
                                    <div style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', marginBottom: '8px', display: 'flex', gap: '4px' }}>
                                        <span>📍</span>
                                        <a 
                                            href="#"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setShowNav(encodeURIComponent(`${customer.address}, ${customer.city} ${customer.district}`));
                                            }}
                                            style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px dashed var(--border-primary)' }}
                                        >
                                            {customer.address}, {customer.city}/{customer.district}
                                        </a>
                                    </div>
                                )}
                                {wo.status !== 'COMPLETED' && (
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        {isSorting ? (
                                            <>
                                                <button className="btn btn-secondary btn-xs" style={{ flex: 1, padding: '4px' }} onClick={() => moveOrder(index, 'up')} disabled={index === 0}>⬆️</button>
                                                <button className="btn btn-secondary btn-xs" style={{ flex: 1, padding: '4px' }} onClick={() => moveOrder(index, 'down')} disabled={index === workOrders.length - 1}>⬇️</button>
                                            </>
                                        ) : (
                                            <>
                                                <button className="btn btn-primary btn-xs" style={{ flex: 2, fontSize: '11.5px', padding: '4px 8px' }} onClick={() => openActionModal(wo)}>📷 İşlem Yap</button>
                                                <button className="btn btn-secondary btn-xs" style={{ flex: 1, fontSize: '11.5px', padding: '4px 8px' }} onClick={() => {
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
            <h2 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px', color: 'var(--text-secondary)' }}>
                🔧 Aktif Tamirlerim ({filteredRepairs.length})
            </h2>

            {filteredRepairs.length === 0 ? (
                <div className="empty-state" style={{ padding: '30px 16px' }}>
                    <div className="empty-state-icon" style={{ fontSize: '28px', marginBottom: '8px' }}>🔧</div>
                    <div className="empty-state-title" style={{ fontSize: '14px' }}>
                        {searchQuery ? 'Aramanıza uygun aktif tamir bulunamadı' : 'Aktif tamir yok'}
                    </div>
                    <p style={{ fontSize: '12px' }}>
                        {searchQuery ? 'Farklı bir arama terimi deneyin.' : 'Operatör size fiş atadığında burada görünecek.'}
                    </p>
                </div>
            ) : (
                <div>
                    {filteredRepairs.map((repair) => (
                        <div
                            key={repair.id}
                            className="card"
                            style={{
                                marginBottom: '10px',
                                padding: '10px 12px',
                                border: activeId === repair.id ? '1.5px solid var(--brand-primary)' : '1px solid var(--border-primary)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                            }}
                            onClick={() => setActiveId(activeId === repair.id ? null : repair.id)}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '13px' }}>{repair.ticketNo}</span>
                                    <span className={`badge badge-priority-${repair.priority}`} style={{ fontSize: '10px', padding: '1px 5px' }}>
                                        {PRIORITY_LABELS[repair.priority]}
                                    </span>
                                </div>
                                <span className="badge" style={{ background: `${STATUS_COLORS[repair.status]}20`, color: STATUS_COLORS[repair.status], fontSize: '11px', padding: '2px 6px' }}>
                                    {STATUS_LABELS[repair.status]}
                                </span>
                            </div>

                            <div style={{ marginBottom: '4px' }}>
                                <div style={{ fontWeight: 600, fontSize: '13px' }}>{repair.brand.name} {repair.model}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                    {CUSTOMER_TYPE_LABELS[repair.customerType as 'INDIVIDUAL' | 'REPAIRER']} · {repair.customer?.name || repair.repairer?.name || '-'}
                                </div>
                                <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--brand-primary)' }}>🛠</span>
                                    <span>{REQUEST_TYPE_LABELS[repair.requestType as keyof typeof REQUEST_TYPE_LABELS] || 'Talep Belirtilmemiş'}</span>
                                </div>
                            </div>

                            {activeId === repair.id && (
                                <div onClick={(e) => e.stopPropagation()} style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-primary)' }}>
                                    {repair.operations.length > 0 && (
                                        <div style={{ marginBottom: '8px' }}>
                                            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: '4px' }}>YAPILAN İŞLEMLER</div>
                                            {repair.operations.map((op: any) => (
                                                <div key={op.id} style={{
                                                    padding: '6px 8px',
                                                    background: 'var(--bg-secondary)',
                                                    borderRadius: '6px',
                                                    marginBottom: '4px',
                                                    fontSize: '11.5px',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    border: '1px solid var(--border-primary)'
                                                }}>
                                                    <div>
                                                        <div style={{ fontWeight: 600 }}>
                                                            {OPERATION_TYPE_LABELS[op.operationType as keyof typeof OPERATION_TYPE_LABELS]}
                                                            {op.installedProduct && <span style={{ color: 'var(--brand-primary)', marginLeft: '4px' }}>→ {op.installedProduct.name}</span>}
                                                        </div>
                                                        {op.removedPart && <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '1px' }}>Çıkan: {op.removedPart}</div>}
                                                        {op.notes && <div style={{ fontSize: '10.5px', color: 'var(--text-tertiary)', marginTop: '1px' }}>Not: {op.notes}</div>}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '4px' }}>
                                                        <button
                                                            className="btn btn-ghost btn-xs"
                                                            style={{ fontSize: '10.5px', padding: '1px 5px', color: 'var(--brand-primary)' }}
                                                            onClick={() => handleEditOp(op)}
                                                            title="İşlemi Düzenle"
                                                        >
                                                            ✏️ Düzenle
                                                        </button>
                                                        <button
                                                            className="btn btn-ghost btn-xs"
                                                            style={{ fontSize: '10.5px', padding: '1px 5px', color: 'var(--color-danger)' }}
                                                            onClick={() => handleDeleteOp(op.id)}
                                                            title="İşlemi Sil"
                                                        >
                                                            🗑️ Sil
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button className="btn btn-secondary btn-xs" style={{ flex: 1, fontSize: '11.5px', padding: '5px 10px' }} onClick={() => {
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
                                        <button className="btn btn-success btn-xs" style={{ flex: 1, fontSize: '11.5px', padding: '5px 10px', fontWeight: 600 }} onClick={() => handleComplete(repair.id)}>
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
                    <div className="modal" style={{ maxWidth: '520px', width: '95vw', maxHeight: '88vh', overflowY: 'auto', padding: 0 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header" style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 className="modal-title" style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>
                                {editingOpId ? '✏️ İşlemi Düzenle' : '🔧 İşlem Ekle'}
                            </h3>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowOp(false)} style={{ padding: '2px 6px' }}>✕</button>
                        </div>
                        <div className="modal-body" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label required" style={{ fontSize: '11.5px', fontWeight: 600, marginBottom: '3px' }}>İşlem Türü</label>
                                <select
                                    className="form-select"
                                    value={opType}
                                    onChange={(e) => setOpType(e.target.value)}
                                    style={{ fontSize: '12px', padding: '4px 28px 4px 8px', minHeight: '32px', height: '32px' }}
                                >
                                    {Object.entries(OPERATION_TYPE_LABELS).map(([k, v]) => (
                                        <option key={k} value={k}>{v}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '11.5px', fontWeight: 600, marginBottom: '3px' }}>Çıkan Parça</label>
                                <input
                                    className="form-input"
                                    value={removed}
                                    onChange={(e) => setRemoved(e.target.value)}
                                    placeholder="Sökülen parça açıklaması"
                                    style={{ fontSize: '12px', padding: '4px 8px', minHeight: '32px', height: '32px' }}
                                />
                            </div>
                            <div className="form-group" style={{ position: 'relative', marginBottom: 0 }}>
                                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', fontWeight: 600, marginBottom: '3px' }}>
                                    <span>Takılan Ürün {(opType === 'SCREEN_CHANGE' || opType === 'LED_CHANGE') && <span style={{ color: 'var(--color-danger)' }}>* (Zorunlu)</span>}</span>
                                    <span style={{ fontSize: '10.5px', color: 'var(--text-tertiary)' }}>
                                        {opType === 'SCREEN_CHANGE' ? '📱 Ekranlar' : opType === 'LED_CHANGE' ? '💡 LED Barlar' : opType === 'LGP_CHANGE' ? '🔆 LGP Paneller' : '📦 Tüm Ürünler'}
                                    </span>
                                </label>

                                {/* Combined Search Input & Select Box */}
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder={(opType === 'SCREEN_CHANGE' || opType === 'LED_CHANGE') ? '🔍 Takılan ürünü seçin / arayın... (Zorunlu)' : '🔍 Takılan ürünü seçin / arayın...'}
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
                                            fontSize: '12px',
                                            paddingTop: '4px',
                                            paddingBottom: '4px',
                                            paddingLeft: '8px',
                                            paddingRight: (installed || prodSearchQuery) ? '32px' : '8px',
                                            minHeight: '32px',
                                            height: '32px',
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
                                                right: '8px',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                background: 'rgba(255,255,255,0.1)',
                                                border: 'none',
                                                borderRadius: '50%',
                                                width: '18px',
                                                height: '18px',
                                                color: 'var(--text-secondary)',
                                                cursor: 'pointer',
                                                fontSize: '11px',
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
                                                    maxHeight: '180px',
                                                    overflowY: 'auto',
                                                    background: 'var(--bg-secondary)',
                                                    border: '1px solid var(--border-primary)',
                                                    borderRadius: '6px',
                                                    boxShadow: 'var(--shadow-lg)',
                                                }}
                                            >
                                                {filteredProducts.length === 0 ? (
                                                    <div style={{ padding: '10px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '11.5px', fontStyle: 'italic' }}>
                                                        Aramanıza uygun ürün bulunamadı.
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
                                                                    padding: '8px 10px',
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    justifyContent: 'space-between',
                                                                    alignItems: 'center',
                                                                    borderBottom: '1px solid var(--border-primary)',
                                                                    background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                                                                    fontSize: '12px',
                                                                }}
                                                            >
                                                                <div style={{ fontWeight: isSelected ? 600 : 400, color: isSelected ? 'var(--brand-primary)' : 'var(--text-primary)' }}>
                                                                    {p.name}
                                                                </div>
                                                                <span style={{
                                                                    fontSize: '10.5px',
                                                                    padding: '1px 6px',
                                                                    borderRadius: '4px',
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
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '11.5px', fontWeight: 600, marginBottom: '3px' }}>Not</label>
                                <textarea
                                    className="form-textarea"
                                    value={opNotes}
                                    onChange={(e) => setOpNotes(e.target.value)}
                                    placeholder="İşlem notu..."
                                    rows={2}
                                    style={{ fontSize: '12px', padding: '6px 8px', resize: 'none' }}
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                    <label className="form-label" style={{ margin: 0, fontSize: '11.5px', fontWeight: 600 }}>Fotoğraflar</label>
                                    <button type="button" className="btn btn-secondary btn-xs" onClick={() => opFileInputRef.current?.click()} style={{ fontSize: '11px', padding: '2px 8px' }}>
                                        📸 Fotoğraf Ekle
                                    </button>
                                </div>
                                <input
                                    ref={opFileInputRef}
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    style={{ display: 'none' }}
                                    onChange={handleFileCaptureOp}
                                />
                                {opPhotos.length > 0 && (
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                                        {opPhotos.map((p, i) => (
                                            <div key={i} style={{ position: 'relative', width: '52px', height: '52px' }}>
                                                <img src={p.base64} alt={p.label} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-primary)' }} />
                                                <button
                                                    type="button"
                                                    style={{ position: 'absolute', top: -4, right: -4, background: 'rgba(239, 68, 68, 0.9)', color: '#fff', border: 'none', borderRadius: '50%', width: 16, height: 16, cursor: 'pointer', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    onClick={() => setOpPhotos(prev => prev.filter((_, idx) => idx !== i))}
                                                >✕</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer" style={{ padding: '10px 16px', borderTop: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                            <button className="btn btn-secondary btn-xs" onClick={() => setShowOp(false)} style={{ fontSize: '11.5px', padding: '4px 12px' }}>İptal</button>
                            <button className="btn btn-primary btn-xs" onClick={handleAddOp} style={{ fontSize: '11.5px', padding: '4px 14px', fontWeight: 600 }}>{editingOpId ? '💾 Güncelle' : '💾 Kaydet'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Action Modal: Photos + Info */}
            {showActionModal && actionRecord && (
                <div className="modal-overlay" onClick={() => { setShowActionModal(false); }}>
                    <div className="modal" style={{ maxHeight: '90vh', overflowY: 'auto', maxWidth: '640px', width: '95vw', padding: 0 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header" style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: 700, fontSize: '14px' }}>
                                    {actionRecord.type === 'PICKUP' ? '📥 Teslim Al' : '📤 Teslim Et'}
                                </span>
                                <span style={{ fontSize: '11.5px', color: 'var(--brand-primary)', fontFamily: 'monospace', fontWeight: 700, background: 'rgba(59, 130, 246, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                    {(actionRecord.ticket as any).ticketNo}
                                </span>
                            </div>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowActionModal(false)} style={{ padding: '2px 6px' }}>✕</button>
                        </div>
                        <div className="modal-body" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {/* Device info */}
                            <div style={{ padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-primary)' }}>
                                <div style={{ fontWeight: 600, fontSize: '13px' }}>{(actionRecord.ticket as any).brand?.name} {(actionRecord.ticket as any).model}</div>
                                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                    {REQUEST_TYPE_LABELS[(actionRecord.ticket as any).requestType as keyof typeof REQUEST_TYPE_LABELS] || (actionRecord.ticket as any).requestType}
                                    {' · '}
                                    <span style={{ fontWeight: 600 }}>{formatCurrency(Number((actionRecord.ticket as any).repairPrice || 0))}</span>
                                </div>
                            </div>

                            {/* Photo capture buttons */}
                            <div style={{ padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-primary)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '11.5px', fontWeight: 600 }}>
                                        📸 Fotoğraflar <span style={{ color: 'var(--color-danger)' }}>*</span>
                                    </span>
                                    <span style={{ fontSize: '10.5px', color: existingPhotos + photos.length >= (actionRecord.type === 'PICKUP' ? 2 : 1) ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 600 }}>
                                        {existingPhotos > 0 ? `${existingPhotos} mevcut + ` : ''}{photos.length} yeni (min. {actionRecord.type === 'PICKUP' ? 2 : 1})
                                    </span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(85px, 1fr))', gap: '4px' }}>
                                    {actionRecord.type === 'PICKUP' ? (
                                        <>
                                            <button type="button" className="btn btn-secondary btn-xs" onClick={() => triggerCapture('BROKEN_DEVICE')} style={{ fontSize: '11px', padding: '4px 6px' }}>📸 Arızalı Cihaz</button>
                                            <button type="button" className="btn btn-secondary btn-xs" onClick={() => triggerCapture('BARCODE')} style={{ fontSize: '11px', padding: '4px 6px' }}>🔖 Barkod</button>
                                            <button type="button" className="btn btn-secondary btn-xs" onClick={() => triggerCapture('OTHER')} style={{ fontSize: '11px', padding: '4px 6px' }}>📷 Diğer</button>
                                        </>
                                    ) : (
                                        <>
                                            <button type="button" className="btn btn-secondary btn-xs" onClick={() => triggerCapture('WORKING_DEVICE')} style={{ fontSize: '11px', padding: '4px 6px' }}>✅ Çalışır Hali</button>
                                            <button type="button" className="btn btn-secondary btn-xs" onClick={() => triggerCapture('OTHER')} style={{ fontSize: '11px', padding: '4px 6px' }}>📷 Diğer</button>
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
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                                        {photos.map((p, i) => (
                                            <div key={i} style={{ position: 'relative', width: '52px', height: '52px' }}>
                                                <img src={p.base64} alt={p.label} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-primary)' }} />
                                                <button
                                                    type="button"
                                                    style={{ position: 'absolute', top: -4, right: -4, background: 'rgba(239, 68, 68, 0.9)', color: '#fff', border: 'none', borderRadius: '50%', width: 16, height: 16, cursor: 'pointer', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                                                >✕</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Accessory sale */}
                            <div style={{ padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-primary)' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginBottom: addAccessoryEnabled ? '6px' : 0 }}>
                                    <input type="checkbox" checked={addAccessoryEnabled} onChange={(e) => setAddAccessoryEnabled(e.target.checked)} />
                                    <span style={{ fontWeight: 600, fontSize: '11.5px' }}>🛍 Aksesuar Satışı Ekle</span>
                                </label>
                                {addAccessoryEnabled && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                                        <select
                                            className="form-select"
                                            value={accProduct}
                                            onChange={(e) => {
                                                setAccProduct(e.target.value);
                                                const p = accessories.find(a => a.id === e.target.value);
                                                if (p) setAccPrice(String(p.price));
                                            }}
                                            style={{ fontSize: '12px', padding: '4px 28px 4px 8px', minHeight: '32px', height: '32px' }}
                                        >
                                            <option value="">— Ürün Seçin —</option>
                                            {accessories.map((a) => (
                                                <option key={a.id} value={a.id}>{a.name} (Stok: {a.stock})</option>
                                            ))}
                                        </select>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <input type="number" className="form-input" placeholder="Adet" value={accQty} onChange={(e) => setAccQty(e.target.value)} min="1" style={{ width: '70px', fontSize: '11.5px', padding: '4px 8px', minHeight: '30px', height: '30px' }} />
                                            <input type="number" className="form-input" placeholder="Birim Fiyat ₺" value={accPrice} onChange={(e) => setAccPrice(e.target.value)} min="0" style={{ flex: 1, fontSize: '11.5px', padding: '4px 8px', minHeight: '30px', height: '30px' }} />
                                        </div>
                                        {accProduct && accPrice && (
                                            <div style={{ fontSize: '11.5px', color: 'var(--brand-primary)', fontWeight: 600, marginTop: '2px' }}>
                                                Toplam: {formatCurrency((Number(accQty) || 1) * (Number(accPrice) || 0))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Notes */}
                            <div>
                                <textarea
                                    className="form-textarea"
                                    value={actionNotes}
                                    onChange={(e) => setActionNotes(e.target.value)}
                                    placeholder="İşlem notu..."
                                    rows={2}
                                    style={{ fontSize: '11.5px', padding: '6px 8px', resize: 'none', width: '100%' }}
                                />
                            </div>

                            {actionError && (
                                <div style={{ padding: '6px 8px', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: '4px', fontSize: '11.5px' }}>
                                    {actionError}
                                </div>
                            )}
                        </div>
                        <div className="modal-footer" style={{ padding: '10px 16px', borderTop: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                            <button className="btn btn-secondary btn-xs" onClick={() => setShowActionModal(false)} style={{ fontSize: '11.5px', padding: '4px 12px' }}>İptal</button>
                            <button
                                className="btn btn-success btn-xs"
                                disabled={savingAction || (existingPhotos + photos.length < (actionRecord.type === 'PICKUP' ? 2 : 1))}
                                onClick={handleCompleteService}
                                style={{ fontSize: '11.5px', padding: '4px 14px', fontWeight: 600 }}
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
                    <div className="modal" style={{ maxWidth: '420px', width: '95vw', padding: 0 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header" style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 className="modal-title" style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>⏳ Servisi Ertele</h3>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowPostponeModal(false)} style={{ padding: '2px 6px' }}>✕</button>
                        </div>
                        <div className="modal-body" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                <strong style={{ color: 'var(--text-primary)' }}>{(postponeRecord.ticket as any).ticketNo}</strong> numaralı cihazın servis tarihini değiştirin.
                            </div>
                            
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '11.5px', fontWeight: 600, marginBottom: '3px' }}>Tarih Seçin</label>
                                <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                                    <button 
                                        type="button"
                                        className={`btn btn-xs ${postponeDate === new Date(Date.now() + 86400000).toISOString().split('T')[0] ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setPostponeDate(new Date(Date.now() + 86400000).toISOString().split('T')[0])}
                                        style={{ fontSize: '11px', padding: '3px 8px' }}
                                    >
                                        🗓 Yarın
                                    </button>
                                    <button 
                                        type="button"
                                        className={`btn btn-xs ${postponeDate === new Date(Date.now() + 172800000).toISOString().split('T')[0] ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setPostponeDate(new Date(Date.now() + 172800000).toISOString().split('T')[0])}
                                        style={{ fontSize: '11px', padding: '3px 8px' }}
                                    >
                                        🗓 Öbür Gün
                                    </button>
                                </div>
                                <input 
                                    type="date" 
                                    className="form-input" 
                                    value={postponeDate} 
                                    onChange={(e) => setPostponeDate(e.target.value)} 
                                    style={{ fontSize: '12px', padding: '4px 8px', minHeight: '32px', height: '32px' }}
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '11.5px', fontWeight: 600, marginBottom: '3px' }}>Not (opsiyonel)</label>
                                <textarea
                                    className="form-textarea"
                                    value={postponeNotes}
                                    onChange={(e) => setPostponeNotes(e.target.value)}
                                    placeholder="Erteleme sebebi..."
                                    rows={2}
                                    style={{ fontSize: '11.5px', padding: '6px 8px', resize: 'none' }}
                                />
                            </div>
                        </div>
                        <div className="modal-footer" style={{ padding: '10px 16px', borderTop: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                            <button className="btn btn-secondary btn-xs" onClick={() => setShowPostponeModal(false)} style={{ fontSize: '11.5px', padding: '4px 12px' }}>İptal</button>
                            <button className="btn btn-primary btn-xs" disabled={!postponeDate || isPostponing} onClick={handlePostpone} style={{ fontSize: '11.5px', padding: '4px 14px', fontWeight: 600 }}>
                                {isPostponing ? 'Erteleniyor...' : 'Ertelemeyi Kaydet'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showNav && (
                <div className="modal-overlay" onClick={() => setShowNav(null)} style={{ alignItems: 'flex-end', padding: 0, zIndex: 9999 }}>
                    <div className="modal" style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, width: '100%', marginBottom: 0, padding: '14px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Rota Oluştur</h3>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowNav(null)}>✕</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${showNav}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                onClick={() => setShowNav(null)}
                                className="btn"
                                style={{ padding: '10px 14px', justifyContent: 'flex-start', fontSize: '13px', background: '#fff', color: '#1a73e8', border: '1px solid #ddd' }}
                            >
                                🗺 Google Haritalar
                            </a>
                            <a 
                                href={`yandexnavi://map_search?text=${showNav}`}
                                onClick={() => setShowNav(null)}
                                className="btn"
                                style={{ padding: '10px 14px', justifyContent: 'flex-start', fontSize: '13px', background: '#ffe400', color: '#000', border: 'none' }}
                            >
                                🧭 Yandex Navigasyon
                            </a>
                            <a 
                                href={`http://maps.apple.com/?q=${showNav}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                onClick={() => setShowNav(null)}
                                className="btn btn-secondary"
                                style={{ padding: '10px 14px', justifyContent: 'flex-start', fontSize: '13px' }}
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
