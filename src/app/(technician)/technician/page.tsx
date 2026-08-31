'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import { getActiveRepairs, addOperation, completeRepair, updateOperation, deleteOperation } from '@/actions/operations';
import { getMyWorkOrders, completePickup, completeDelivery, saveTicketPhoto, getServiceRecordPhotos, rescheduleServiceRecord, updateServiceRecordsOrder } from '@/actions/service-records';
import { getProductsByCategory, addAccessoryToTicket } from '@/actions/products';
import { getPersonnel } from '@/actions/personnel';
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
                Teknisyen Portalı & Atölye Terminali
            </span>
        </div>
    );
}

export default function TechnicianPage() {
    const [repairs, setRepairs] = useState<Repair[]>([]);
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
    const [technicians, setTechnicians] = useState<any[]>([]);
    const [isPending, startTransition] = useTransition();
    const [activeId, setActiveId] = useState<string | null>(null);
    const [screens, setScreens] = useState<any[]>([]);
    const [leds, setLeds] = useState<any[]>([]);
    const [lgps, setLgps] = useState<any[]>([]);
    const [showOp, setShowOp] = useState(false);
    const [showNav, setShowNav] = useState<string | null>(null);

    // Responsive screen detection
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Operation form
    const [editingOpId, setEditingOpId] = useState<string | null>(null);
    const [opType, setOpType] = useState('SCREEN_CHANGE');
    const [removed, setRemoved] = useState('');
    const [installed, setInstalled] = useState('');
    const [opNotes, setOpNotes] = useState('');
    const [selectedTechId, setSelectedTechId] = useState(''); // Shared workshop PC technician selector
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

    // Filters for PC View
    const [isSorting, setIsSorting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [techFilter, setTechFilter] = useState('ALL');

    const load = () => {
        startTransition(async () => {
            const [r, w] = await Promise.all([getActiveRepairs(), getMyWorkOrders()]);
            setRepairs(r);
            setWorkOrders(w);
        });
    };

    useEffect(() => {
        load();
        const i = setInterval(load, 15000);
        return () => clearInterval(i);
    }, []);

    useEffect(() => {
        getProductsByCategory('SCREEN').then(setScreens);
        getProductsByCategory('LED').then(setLeds);
        getProductsByCategory('LGP').then(setLgps);
        getProductsByCategory('ACCESSORY').then(setAccessories);
        getPersonnel().then(list => setTechnicians(list.filter(p => p.isActive))).catch(console.error);
    }, []);

    const activeRepair = repairs.find((r) => r.id === activeId);

    // Helper for product filtering by operation type & search query (Hide out of stock products: stock <= 0)
    const getAvailableProducts = () => {
        let prods: any[] = [];
        if (opType === 'SCREEN_CHANGE') prods = screens;
        else if (opType === 'LED_CHANGE') prods = leds;
        else if (opType === 'LGP_CHANGE') prods = lgps;
        else prods = [...screens, ...leds, ...lgps, ...accessories];
        return prods.filter(p => p.stock > 0);
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
        setSelectedTechId(op.performedById || '');
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
                    performedById: selectedTechId || undefined,
                });
            } else {
                await addOperation({
                    ticketId: activeId,
                    operationType: opType,
                    removedPart: removed || undefined,
                    installedProductId: installed || undefined,
                    notes: opNotes || undefined,
                    performedById: selectedTechId || undefined,
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
            setSelectedTechId('');
            setProdSearchQuery('');
            setOpPhotos([]);
            load();
        } catch (err: any) { alert(err.message); }
    };

    const handleComplete = async (ticketId: string) => {
        const targetRepair = repairs.find(r => r.id === ticketId);
        if (targetRepair && (!targetRepair.operations || targetRepair.operations.length === 0)) {
            alert('⚠️ Bu fişi tamamlamadan önce lütfen en az bir tamir işlemi (LED, Ekran vb.) ekleyiniz!');
            return;
        }
        if (!confirm('Tamiri tamamlamak istediğinize emin misiniz?')) return;
        try {
            const res = await completeRepair(ticketId);
            if (res && !res.success && res.error) {
                alert('⚠️ ' + res.error);
                return;
            }
            setActiveId(null);
            load();
        } catch (err: any) {
            alert(err.message || 'Tamir tamamlanırken bir hata oluştu.');
        }
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
        if (statusFilter !== 'ALL' && repair.status !== statusFilter) return false;
        if (techFilter !== 'ALL' && repair.assignedTechnicianId !== techFilter) return false;

        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        const ticketNoMatch = repair.ticketNo?.toLowerCase().includes(q);
        const modelMatch = repair.model?.toLowerCase().includes(q);
        const brandMatch = repair.brand?.name?.toLowerCase().includes(q);
        const customerMatch = repair.customer?.name?.toLowerCase().includes(q);
        const repairerMatch = repair.repairer?.name?.toLowerCase().includes(q);
        return ticketNoMatch || modelMatch || brandMatch || customerMatch || repairerMatch;
    });

    // ─────────────────────────────────────────────────────────────
    // RENDER: MOBILE LAYOUT (KÜÇÜK EKRANLAR / MOBİL CİHAZLAR)
    // ─────────────────────────────────────────────────────────────
    if (isMobile) {
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
                                                setSelectedTechId('');
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

                {/* Operation Modal */}
                {renderOperationModal()}
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────
    // RENDER: PC / DESKTOP LAYOUT (GÜÇLÜ ATÖLYE TERMİNALİ GÖRÜNÜMÜ)
    // ─────────────────────────────────────────────────────────────
    return (
        <div style={{ padding: 'var(--space-6)', maxWidth: '1440px', margin: '0 auto' }}>
            {/* PC Header Banner */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-6)',
                flexWrap: 'wrap',
                gap: 'var(--space-4)',
            }}>
                <div>
                    <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        🔧 Atölye Tamir & İşlem Merkezi (PC Terminali)
                    </h1>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
                        Atölye ortak bilgisayarından aktif tamirler, yapılan tüm işlemler ve servis görevleri
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <button className="btn btn-ghost btn-sm" onClick={load} style={{ fontSize: '13px' }}>
                        🔄 Canlı Verileri Yenile
                    </button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                <div className="card" style={{ padding: 'var(--space-4)', borderLeft: '4px solid var(--brand-primary)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Atölyedeki Aktif Tamirler</div>
                    <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--brand-primary)', marginTop: '4px' }}>
                        {repairs.length} Cihaz
                    </div>
                </div>

                <div className="card" style={{ padding: 'var(--space-4)', borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bugünkü Servis Görevleri</div>
                    <div style={{ fontSize: '26px', fontWeight: 800, color: '#f59e0b', marginTop: '4px' }}>
                        {workOrders.length} Görev
                    </div>
                </div>

                <div className="card" style={{ padding: 'var(--space-4)', borderLeft: '4px solid var(--color-success)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Arama Sonucu</div>
                    <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--color-success)', marginTop: '4px' }}>
                        {filteredRepairs.length} Fiş
                    </div>
                </div>
            </div>

            {/* PC Filters Card */}
            <div className="card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', alignItems: 'flex-end' }}>
                    <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ fontSize: '12px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                            🔍 Arama (Fiş No, Model, Müşteri / Tamirci)
                        </label>
                        <input
                            type="text"
                            className="input"
                            placeholder="SP-000003, 49NU7100, Müşteri Adı..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                            ⚡ Durum Filtresi
                        </label>
                        <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="ALL">🌐 Tüm Durumlar</option>
                            <option value="ATOLYESINDE">🏢 Atölyesinde (Tamirde)</option>
                            <option value="PARCA_BEKLIYOR">📦 Parça Bekliyor</option>
                            <option value="ONAY_BEKLIYOR">⏳ Müşteri Onayı Bekliyor</option>
                            <option value="TAMIR_TAMAMLANDI">✅ Tamir Tamamlandı</option>
                        </select>
                    </div>

                    <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                            👷 Atanan Teknisyen
                        </label>
                        <select className="input" value={techFilter} onChange={(e) => setTechFilter(e.target.value)}>
                            <option value="ALL">👥 Tüm Teknisyenler</option>
                            {technicians.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* PC Table: Active Repairs */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                        🔧 Atölyedeki Aktif Tamir Fişleri Listesi
                    </h2>
                    <span className="badge badge-secondary" style={{ fontSize: '12px', fontWeight: 700 }}>
                        {filteredRepairs.length} Fiş Gösteriliyor
                    </span>
                </div>

                {filteredRepairs.length === 0 ? (
                    <div className="empty-state" style={{ padding: '50px 20px' }}>
                        <div className="empty-state-icon" style={{ fontSize: '36px' }}>💡</div>
                        <div className="empty-state-title" style={{ fontSize: '16px' }}>
                            {searchQuery ? 'Aramanıza uygun tamir kaydı bulunamadı' : 'Atölyede aktif tamir kaydı bulunmuyor'}
                        </div>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Fiş No & Öncelik</th>
                                    <th>Müşteri / Firma</th>
                                    <th>Cihaz (Marka & Model)</th>
                                    <th>Talep / Şikayet</th>
                                    <th>Durum</th>
                                    <th>Yapılan İşlemler & Takılan Parçalar</th>
                                    <th>Aksiyonlar</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRepairs.map((repair) => {
                                    const isExpanded = activeId === repair.id;
                                    return (
                                        <tr key={repair.id} style={{ background: isExpanded ? 'rgba(59, 130, 246, 0.04)' : undefined }}>
                                            <td>
                                                <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '13px', color: 'var(--brand-primary)' }}>
                                                    {repair.ticketNo}
                                                </div>
                                                <span className={`badge badge-priority-${repair.priority}`} style={{ fontSize: '10px', marginTop: '2px' }}>
                                                    {PRIORITY_LABELS[repair.priority]}
                                                </span>
                                            </td>

                                            <td>
                                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                                    {repair.customer?.name || repair.repairer?.name || '-'}
                                                </div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                                    {CUSTOMER_TYPE_LABELS[repair.customerType as 'INDIVIDUAL' | 'REPAIRER']}
                                                </div>
                                            </td>

                                            <td>
                                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                                    {repair.brand.name}
                                                </div>
                                                <div style={{ fontSize: '12.5px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--brand-primary)' }}>
                                                    {repair.model}
                                                </div>
                                            </td>

                                            <td style={{ fontSize: '12px' }}>
                                                {REQUEST_TYPE_LABELS[repair.requestType as keyof typeof REQUEST_TYPE_LABELS] || 'Talep Belirtilmemiş'}
                                            </td>

                                            <td>
                                                <span className="badge" style={{ background: `${STATUS_COLORS[repair.status]}20`, color: STATUS_COLORS[repair.status], fontSize: '11px', fontWeight: 700 }}>
                                                    {STATUS_LABELS[repair.status]}
                                                </span>
                                            </td>

                                            <td style={{ maxWidth: '300px' }}>
                                                {repair.operations.length === 0 ? (
                                                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Henüz işlem girilmedi</span>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        {repair.operations.map((op: any) => (
                                                            <div key={op.id} style={{ fontSize: '11.5px', padding: '4px 6px', background: 'var(--bg-secondary)', borderRadius: '4px', border: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <div>
                                                                    <span style={{ fontWeight: 600 }}>{OPERATION_TYPE_LABELS[op.operationType as keyof typeof OPERATION_TYPE_LABELS]}</span>
                                                                    {op.installedProduct && <span style={{ color: 'var(--brand-primary)', marginLeft: '4px' }}>→ {op.installedProduct.name}</span>}
                                                                </div>
                                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                                    <button className="btn btn-ghost btn-xs" style={{ fontSize: '10px', padding: '0 4px', color: 'var(--brand-primary)' }} onClick={() => { setActiveId(repair.id); handleEditOp(op); }}>✏️</button>
                                                                    <button className="btn btn-ghost btn-xs" style={{ fontSize: '10px', padding: '0 4px', color: 'var(--color-danger)' }} onClick={() => handleDeleteOp(op.id)}>🗑️</button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>

                                            <td>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button
                                                        className="btn btn-primary btn-xs"
                                                        onClick={() => {
                                                            setActiveId(repair.id);
                                                            setEditingOpId(null);
                                                            setOpType('SCREEN_CHANGE');
                                                            setRemoved('');
                                                            setInstalled('');
                                                            setOpNotes('');
                                                            setSelectedTechId('');
                                                            setOpPhotos([]);
                                                            setShowOp(true);
                                                        }}
                                                        style={{ fontWeight: 600, fontSize: '11.5px' }}
                                                    >
                                                        ➕ İşlem Ekle
                                                    </button>
                                                    <button
                                                        className="btn btn-success btn-xs"
                                                        onClick={() => handleComplete(repair.id)}
                                                        style={{ fontWeight: 600, fontSize: '11.5px' }}
                                                    >
                                                        ✅ Tamamla
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal Components */}
            {renderOperationModal()}
        </div>
    );

    // ─────────────────────────────────────────────────────────────
    // HELPER: RENDER OPERATION MODAL (WITH TECHNICIAN SELECTOR FOR SHARED WORKSHOP PC)
    // ─────────────────────────────────────────────────────────────
    function renderOperationModal() {
        if (!showOp) return null;
        return (
            <div className="modal-overlay" onClick={() => setShowOp(false)}>
                <div className="modal" style={{ maxWidth: '560px', width: '95vw', maxHeight: '90vh', overflowY: 'auto', padding: 0 }} onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header" style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 className="modal-title" style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                            {editingOpId ? '✏️ Tamir İşlemini Düzenle' : '🔧 Yeni Tamir İşlemi Kaydet'}
                        </h3>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowOp(false)} style={{ padding: '2px 6px' }}>✕</button>
                    </div>

                    <div className="modal-body" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {/* Shared Workshop PC: Technician Selector */}
                        <div className="form-group" style={{ marginBottom: 0, padding: '8px 10px', background: 'rgba(59, 130, 246, 0.08)', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                            <label className="form-label" style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--brand-primary)', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span>👷 İşlemi Yapan Teknisyen (Atölye Ortak PC Kullanımı)</span>
                            </label>
                            <select
                                className="form-select"
                                value={selectedTechId}
                                onChange={(e) => setSelectedTechId(e.target.value)}
                                style={{ fontSize: '12px', padding: '4px 28px 4px 8px', minHeight: '32px', height: '32px', fontWeight: 600 }}
                            >
                                <option value="">👤 Mevcut Oturum Sahibi (Otomatik)</option>
                                {technicians.map((tech) => (
                                    <option key={tech.id} value={tech.id}>👨‍🔧 {tech.name} ({tech.email})</option>
                                ))}
                            </select>
                            <div style={{ fontSize: '10.5px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                Ortak bilgisayardan işlem giriliyorsa işlemi gerçekleştiren teknisyeni seçebilirsiniz.
                            </div>
                        </div>

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
                                placeholder="Sökülen parça açıklaması (Örn: LSF490FN06)"
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
                                                    const isLimitedStock = p.stock <= 2;
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
                                                                padding: '2px 8px',
                                                                borderRadius: '4px',
                                                                fontWeight: 700,
                                                                background: isLimitedStock ? 'rgba(234, 179, 8, 0.18)' : 'rgba(34, 197, 94, 0.15)',
                                                                color: isLimitedStock ? '#ca8a04' : 'var(--color-success)',
                                                                border: isLimitedStock ? '1px solid rgba(234, 179, 8, 0.3)' : '1px solid rgba(34, 197, 94, 0.3)',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '3px',
                                                            }}>
                                                                {isLimitedStock ? `⚠️ Sınırlı: ${p.stock} adet` : `Stok: ${p.stock}`}
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
                            <label className="form-label" style={{ fontSize: '11.5px', fontWeight: 600, marginBottom: '3px' }}>İşlem Notu</label>
                            <textarea
                                className="form-textarea"
                                value={opNotes}
                                onChange={(e) => setOpNotes(e.target.value)}
                                placeholder="İşlem notu (Örn: DİREK ÇALIŞTI)..."
                                rows={2}
                                style={{ fontSize: '12px', padding: '6px 8px', resize: 'none' }}
                            />
                        </div>
                    </div>

                    <div className="modal-footer" style={{ padding: '12px 18px', borderTop: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setShowOp(false)}>İptal</button>
                        <button className="btn btn-primary btn-sm" onClick={handleAddOp}>💾 Kaydet</button>
                    </div>
                </div>
            </div>
        );
    }
}
