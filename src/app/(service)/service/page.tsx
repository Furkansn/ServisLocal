'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import { getMyWorkOrders, completePickup, completeDelivery, postponeService, cancelService, saveTicketPhoto, getServiceRecordPhotos, rescheduleServiceRecord, updateServiceRecordsOrder } from '@/actions/service-records';
import { addContactNote, getContactNotes } from '@/actions/contact-notes';
import { addPayment } from '@/actions/payments';
import { getAccounts } from '@/actions/collections';
import { compressImage } from '@/lib/image-utils';
import { addAccessoryToTicket, getProductsByCategory } from '@/actions/products';
import { updateTicketDeviceCondition, addRepairItemToTicket } from '@/actions/tickets';
import { REQUEST_TYPE_LABELS, OPERATION_TYPE_LABELS, PAYMENT_METHOD_LABELS, formatCurrency } from '@/lib/constants';
import Link from 'next/link';

type WorkOrder = Awaited<ReturnType<typeof getMyWorkOrders>>[0];

const TYPE_LABELS: Record<string, string> = {
    PICKUP: '📥 Cihaz Alınacak',
    DELIVERY: '📤 Cihaz Teslim Edilecek',
};

export default function ServicePage() {
    const [orders, setOrders] = useState<WorkOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    // Action modal (Pickup / Delivery)
    const [showActionModal, setShowActionModal] = useState(false);
    const [actionRecord, setActionRecord] = useState<WorkOrder | null>(null);
    const [photos, setPhotos] = useState<{ type: string; base64: string; label: string }[]>([]);
    const [existingPhotos, setExistingPhotos] = useState<number>(0);
    const [savingAction, setSavingAction] = useState(false);
    const [actionNotes, setActionNotes] = useState('');
    const [actionError, setActionError] = useState('');
    const [pendingPhotoType, setPendingPhotoType] = useState<'BROKEN_DEVICE' | 'BARCODE' | 'WORKING_DEVICE' | 'OTHER'>('BROKEN_DEVICE');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Payment state (delivery)
    const [paymentsList, setPaymentsList] = useState<{ amount: number; method: string; accountId?: string; notes?: string }[]>([]);
    const [payAmount, setPayAmount] = useState('');
    const [payMethod, setPayMethod] = useState('CASH');
    const [payAccountId, setPayAccountId] = useState('');
    const [payNotes, setPayNotes] = useState('');
    const [accounts, setAccounts] = useState<any[]>([]);

    // Accessory (delivery) state
    const [accessories, setAccessories] = useState<any[]>([]);
    const [addAccessoryEnabled, setAddAccessoryEnabled] = useState(false);
    const [accProduct, setAccProduct] = useState('');
    const [accQty, setAccQty] = useState('1');
    const [accPrice, setAccPrice] = useState('');

    // Device Condition & Extra Repair Items state
    const [deviceConditionInput, setDeviceConditionInput] = useState('');
    const [isEditingCondition, setIsEditingCondition] = useState(false);

    // Add extra operation form state
    const [showAddOpForm, setShowAddOpForm] = useState(false);
    const [newOpType, setNewOpType] = useState('LED_CHANGE');
    const [newOpCustomType, setNewOpCustomType] = useState('');
    const [newOpPrice, setNewOpPrice] = useState('');
    const [isAddingOp, setIsAddingOp] = useState(false);

    // Postpone modal
    const [showPostponeModal, setShowPostponeModal] = useState(false);
    const [postponeRecord, setPostponeRecord] = useState<WorkOrder | null>(null);
    const [postponeDate, setPostponeDate] = useState('');
    const [postponeNotes, setPostponeNotes] = useState('');
    const [isPostponing, setIsPostponing] = useState(false);

    // Sorting state
    const [isSorting, setIsSorting] = useState(false);

    // Contact Notes Modal state
    const [showNotesModal, setShowNotesModal] = useState(false);
    const [notesContact, setNotesContact] = useState<{ id: string; name: string; type: 'CUSTOMER' | 'REPAIRER'; ticketNotes?: string; orderNotes?: string } | null>(null);
    const [contactNotes, setContactNotes] = useState<any[]>([]);
    const [isLoadingNotes, setIsLoadingNotes] = useState(false);
    const [newNote, setNewNote] = useState('');

    const load = () => {
        setLoading(true);
        getMyWorkOrders()
            .then((data) => setOrders(data))

            .catch((err) => alert('İş emri yüklenemedi: ' + err.message))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        load();
        getAccounts().then(setAccounts).catch(() => { });
        getProductsByCategory('AKSESUAR').then(setAccessories).catch(() => { });
    }, []);

    const moveOrder = (id: string, direction: 'up' | 'down') => {
        const index = orders.findIndex(o => o.id === id);
        if (index < 0) return;
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= orders.length) return;

        const updated = [...orders];
        const [moved] = updated.splice(index, 1);
        updated.splice(newIndex, 0, moved);

        setOrders(updated);
    };

    const handleSaveOrder = async () => {
        try {
            const updates = orders.map((o, idx) => ({ id: o.id, sortOrder: idx + 1 }));
            await updateServiceRecordsOrder(updates);
            setIsSorting(false);
            load();
        } catch (err: any) { alert(err.message); }
    };

    const handleCancel = async (recordId: string) => {
        const notes = prompt('İptal nedeni:');
        if (notes === null) return;
        try { await cancelService(recordId, notes); load(); } catch (err: any) { alert(err.message); }
    };

    const openActionModal = async (record: WorkOrder) => {
        setActionRecord(record);
        setPhotos([]);
        setActionNotes('');
        setActionError('');
        setPaymentsList([]);
        setPayAmount('');
        setPayMethod('CASH');
        const defaultMatching = accounts.filter((acc: any) => acc.type === 'CASH');
        setPayAccountId(defaultMatching.length === 1 ? defaultMatching[0].id : '');
        setPayNotes('');
        setAddAccessoryEnabled(false);
        setAccProduct('');
        setAccQty('1');
        setAccPrice('');
        setDeviceConditionInput((record.ticket as any).deviceCondition || '');
        setIsEditingCondition(false);
        setShowAddOpForm(false);
        setNewOpType('LED_CHANGE');
        setNewOpCustomType('');
        setNewOpPrice('');
        try {
            const existing = await getServiceRecordPhotos(record.id);
            setExistingPhotos(existing.length);
        } catch { setExistingPhotos(0); }
        setShowActionModal(true);
    };

    const triggerCapture = (type: 'BROKEN_DEVICE' | 'BARCODE' | 'WORKING_DEVICE' | 'OTHER') => {
        setPendingPhotoType(type);
        fileInputRef.current?.click();
    };

    const PHOTO_LABELS: Record<string, string> = {
        BROKEN_DEVICE: '📸 Arızalı Cihaz',
        BARCODE: '🔖 Barkod',
        WORKING_DEVICE: '✅ Çalışır Hali',
        OTHER: '📷 Diğer',
    };

    const handleFileCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const compressedBase64 = await compressImage(file, 1280, 1280, 0.7);
            setPhotos(prev => [...prev, {
                type: pendingPhotoType,
                base64: compressedBase64,
                label: PHOTO_LABELS[pendingPhotoType]
            }]);
        } catch (err: any) {
            alert('Fotoğraf işlenirken bir hata oluştu: ' + err.message);
        }

        e.target.value = '';
    };

    const requiredPhotos = actionRecord?.type === 'PICKUP' ? 2 : 1;

    const handleCompleteService = async () => {
        if (!actionRecord) return;
        const totalPhotos = existingPhotos + photos.length;
        if (totalPhotos < requiredPhotos) {
            setActionError(`En az ${requiredPhotos} fotoğraf eklemelisiniz`);
            return;
        }

        if (actionRecord.type === 'DELIVERY') {
            const sumPayment = paymentsList.reduce((acc, p) => acc + p.amount, 0) + (Number(payAmount) || 0);
            if (Math.abs(sumPayment - getRemaining()) > 0.01) {
                setActionError(`Alınan toplam tutar (${formatCurrency(sumPayment)}) kalan tutara (${formatCurrency(getRemaining())}) eşit olmalıdır!`);
                return;
            }
        }

        setSavingAction(true);
        setActionError('');
        try {
            const ticketId = (actionRecord.ticket as any).id;

            // Save updated device condition if changed
            const currentCond = (actionRecord.ticket as any).deviceCondition || '';
            if (deviceConditionInput !== currentCond) {
                await updateTicketDeviceCondition(ticketId, deviceConditionInput);
            }

            // Save photos
            for (const p of photos) {
                await saveTicketPhoto({
                    ticketId,
                    serviceRecordId: actionRecord.id,
                    type: p.type as any,
                    base64: p.base64,
                });
            }

            // If delivery: save requested payments
            if (actionRecord.type === 'DELIVERY') {
                const allPayments = [...paymentsList];
                if (payAmount !== '') {
                    if ((payMethod === 'BANK_TRANSFER' || payMethod === 'CREDIT_CARD') && !payAccountId) {
                        throw new Error('Lütfen ödemenin aktarılacağı banka/POS hesabını seçiniz.');
                    }
                    allPayments.push({ amount: Number(payAmount), method: payMethod, accountId: payAccountId || undefined, notes: payNotes || undefined });
                }
                for (const p of allPayments) {
                    if (p.amount > 0) {
                        await addPayment({
                            ticketId,
                            method: p.method,
                            accountId: p.accountId,
                            amount: p.amount,
                            notes: p.notes,
                        });
                    }
                }
            }

            // Save optional accessory
            if (addAccessoryEnabled && accProduct) {
                await addAccessoryToTicket({
                    ticketId,
                    productId: accProduct,
                    quantity: Number(accQty) || 1,
                    unitPrice: Number(accPrice) || 0,
                });
            }

            // Complete the service record
            if (actionRecord.type === 'PICKUP') {
                await completePickup(actionRecord.id, actionNotes || undefined);
            } else if (actionRecord.type === 'DELIVERY') {
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

    const handleShowNotes = async (contactId: string, name: string, type: 'CUSTOMER' | 'REPAIRER', ticketNotes?: string, orderNotes?: string) => {
        setNotesContact({ id: contactId, name, type, ticketNotes, orderNotes });
        setShowNotesModal(true);
        setIsLoadingNotes(true);
        try {
            const data = await getContactNotes(contactId, type);
            setContactNotes(data);
        } catch (err: any) {
            alert('Notlar yüklenemedi: ' + err.message);
        } finally {
            setIsLoadingNotes(false);
        }
    };

    const handleAddNote = async () => {
        if (!notesContact || !newNote.trim()) return;
        try {
            await addContactNote(notesContact.id, notesContact.type, newNote.trim());
            setNewNote('');
            const data = await getContactNotes(notesContact.id, notesContact.type);
            setContactNotes(data);
            load();
        } catch (err: any) {
            alert('Not eklenemedi: ' + err.message);
        }
    };

    const handlePostponeAction = async () => {
        if (!postponeRecord || !postponeDate) return;
        setIsPostponing(true);
        try {
            await rescheduleServiceRecord(postponeRecord.id, postponeDate, postponeNotes || undefined);
            setShowPostponeModal(false);
            setPostponeRecord(null);
            load();
        } catch (err: any) {
            alert('Erteleme başarısız: ' + err.message);
        } finally {
            setIsPostponing(false);
        }
    };

    const getRepairPrice = () => {
        if (!actionRecord) return 0;
        return Number((actionRecord.ticket as any).repairPrice) || 0;
    };

    const getAccessoriesTotal = () => {
        if (!actionRecord) return 0;
        const accs = (actionRecord.ticket as any).accessories || [];
        return accs.reduce((sum: number, a: any) => sum + (Number(a.unitPrice) * a.quantity), 0);
    };

    const getNewAccessoryTotal = () => {
        if (!addAccessoryEnabled || !accProduct) return 0;
        return (Number(accQty) || 1) * (Number(accPrice) || 0);
    };

    const getGrandTotal = () => {
        return getRepairPrice() + getAccessoriesTotal() + getNewAccessoryTotal();
    };

    const getPaidAmount = () => {
        if (!actionRecord) return 0;
        return Number((actionRecord.ticket as any).paidAmount) || 0;
    };

    const getRemaining = () => {
        return Math.max(0, getGrandTotal() - getPaidAmount());
    };

    const todayStr = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto', paddingBottom: '80px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <div>
                    <h1 className="page-title" style={{ fontSize: 'var(--font-size-xl)' }}>🚚 Bugünkü İşlerim</h1>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>{todayStr}</div>
                </div>
                <div>
                    {!isSorting ? (
                        <button className="btn btn-secondary btn-sm" onClick={() => setIsSorting(true)}>
                            🔃 Sırala
                        </button>
                    ) : (
                        <button className="btn btn-primary btn-sm" onClick={handleSaveOrder}>
                            💾 Sıralamayı Kaydet
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>Yükleniyor...</div>
            ) : orders.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📋</div>
                    <div className="empty-state-title">Bugün için iş yok</div>
                    <p>Operatör yeni servis kaydı oluşturduğunda burada görünecek.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {orders.filter(o => o.status !== 'CANCELLED').map((order) => (
                        <WorkOrderCard
                            key={order.id}
                            order={order}
                            onAction={() => openActionModal(order)}
                            onPostpone={() => {
                                setPostponeRecord(order);
                                setPostponeDate('');
                                setPostponeNotes('');
                                setShowPostponeModal(true);
                            }}
                            onCancel={() => handleCancel(order.id)}
                            isSorting={isSorting}
                            onMove={(dir) => moveOrder(order.id, dir)}
                            canMoveUp={orders.indexOf(order) > 0}
                            canMoveDown={orders.indexOf(order) < orders.length - 1}
                            onShowNotes={() => {
                                const contactId = order.ticket.customerId || order.ticket.repairerId;
                                const contactName = (order.ticket.customer || order.ticket.repairer)?.name;
                                if (contactId && contactName) {
                                    handleShowNotes(
                                        contactId,
                                        contactName,
                                        order.ticket.customerId ? 'CUSTOMER' : 'REPAIRER',
                                        order.ticket.notes || undefined,
                                        order.notes || undefined
                                    );
                                }
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Action Modal */}
            {showActionModal && actionRecord && (
                <div className="modal-overlay" onClick={() => setShowActionModal(false)}>
                    <div className="modal" style={{ maxHeight: '90vh', overflowY: 'auto', maxWidth: '780px', width: '95vw', padding: 0 }} onClick={(e) => e.stopPropagation()}>
                        {/* Compact Modal Header */}
                        <div className="modal-header" style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontWeight: 700, fontSize: '15px' }}>
                                    {actionRecord.type === 'PICKUP' ? '📥 Teslim Al' : '📤 Teslim Et'}
                                </span>
                                <span style={{ fontSize: '12px', color: 'var(--brand-primary)', fontFamily: 'monospace', fontWeight: 700, background: 'rgba(59, 130, 246, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                                    {(actionRecord.ticket as any).ticketNo}
                                </span>
                            </div>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowActionModal(false)} style={{ padding: '2px 6px' }}>✕</button>
                        </div>

                        {/* Modal Body - 2 Column Grid */}
                        <div className="modal-body" style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '12px', alignItems: 'start' }}>
                            {/* Left Column: Device Info, Financial Summary, Photo Capture */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {/* Device & Financial Card */}
                                <div style={{ padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                        <div style={{ fontWeight: 600, fontSize: '13.5px' }}>
                                            {(actionRecord.ticket as any).brand?.name} {(actionRecord.ticket as any).model}
                                        </div>
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-xs"
                                            onClick={() => setShowAddOpForm(prev => !prev)}
                                            title="Fişe Ekstra Onarım / İşlem Ekle"
                                            style={{
                                                fontSize: '9.5px',
                                                fontWeight: 600,
                                                border: '1px solid var(--brand-primary)',
                                                color: 'var(--brand-primary)',
                                                padding: '0 4px',
                                                height: '18px',
                                                lineHeight: '16px',
                                                borderRadius: '3px',
                                            }}
                                        >
                                            + İşlem
                                        </button>
                                    </div>

                                    {/* Form to Add Extra Repair Item / Operation */}
                                    {showAddOpForm && (
                                        <div style={{ padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--brand-primary)', borderRadius: '6px', marginBottom: '8px' }}>
                                            <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '4px', color: 'var(--brand-primary)' }}>
                                                ➕ Fişe Ekstra İşlem Ekle
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <select
                                                        className="form-select"
                                                        value={newOpType}
                                                        onChange={(e) => setNewOpType(e.target.value)}
                                                        style={{ flex: 1, fontSize: '11.5px', padding: '4px 24px 4px 6px', minHeight: '30px', height: '30px' }}
                                                    >
                                                        <option value="LED_CHANGE">LED Değişimi</option>
                                                        <option value="LGP_REPAIR">LGP Tamiri / Değişimi</option>
                                                        <option value="BOARD_REPAIR">Anakart Tamiri</option>
                                                        <option value="SCREEN_CHANGE">Ekran Değişimi</option>
                                                        <option value="OTHER">Diğer / Özel İşlem</option>
                                                    </select>
                                                    <input
                                                        type="number"
                                                        className="form-input"
                                                        placeholder="Ücret ₺"
                                                        value={newOpPrice}
                                                        onChange={(e) => setNewOpPrice(e.target.value)}
                                                        style={{ width: '85px', fontSize: '11px', padding: '3px 6px', height: '28px' }}
                                                    />
                                                </div>
                                                {newOpType === 'OTHER' && (
                                                    <input
                                                        type="text"
                                                        className="form-input"
                                                        placeholder="İşlem Tanımı..."
                                                        value={newOpCustomType}
                                                        onChange={(e) => setNewOpCustomType(e.target.value)}
                                                        style={{ fontSize: '11px', padding: '3px 6px', height: '28px' }}
                                                    />
                                                )}
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                                                    <button
                                                        type="button"
                                                        className="btn btn-secondary btn-xs"
                                                        onClick={() => setShowAddOpForm(false)}
                                                        style={{ fontSize: '10.5px', padding: '2px 6px' }}
                                                    >
                                                        İptal
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-primary btn-xs"
                                                        disabled={isAddingOp}
                                                        onClick={async () => {
                                                            if (!newOpPrice || Number(newOpPrice) < 0) {
                                                                alert('Geçerli bir tutar giriniz.');
                                                                return;
                                                            }
                                                            setIsAddingOp(true);
                                                            try {
                                                                const finalType = newOpType === 'OTHER' ? (newOpCustomType.trim() || 'Özel İşlem') : newOpType;
                                                                const updatedTicket = await addRepairItemToTicket((actionRecord.ticket as any).id, finalType, Number(newOpPrice));
                                                                (actionRecord.ticket as any).repairItems = updatedTicket.repairItems;
                                                                (actionRecord.ticket as any).repairPrice = updatedTicket.repairPrice;
                                                                (actionRecord.ticket as any).totalAmount = updatedTicket.totalAmount;
                                                                setShowAddOpForm(false);
                                                                setNewOpPrice('');
                                                                setNewOpCustomType('');
                                                                load();
                                                            } catch (err: any) {
                                                                alert(err.message);
                                                            } finally {
                                                                setIsAddingOp(false);
                                                            }
                                                        }}
                                                        style={{ fontSize: '10.5px', padding: '2px 6px' }}
                                                    >
                                                        {isAddingOp ? 'Ekleniyor...' : '💾 Ekle'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Compact Financial Items List */}
                                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                                        {(() => {
                                            const rawItems = (actionRecord.ticket as any)?.repairItems;
                                            const parsedRepairItems: any[] = rawItems
                                                ? (typeof rawItems === 'string'
                                                    ? (() => { try { return JSON.parse(rawItems); } catch (e) { return []; } })()
                                                    : Array.isArray(rawItems) ? rawItems : [])
                                                : [];

                                            if (parsedRepairItems.length > 0) {
                                                return parsedRepairItems.map((item: any, idx: number) => {
                                                    const itemLabel = item.type
                                                        ? (OPERATION_TYPE_LABELS[item.type as keyof typeof OPERATION_TYPE_LABELS] || REQUEST_TYPE_LABELS[item.type as keyof typeof REQUEST_TYPE_LABELS] || item.type)
                                                        : 'Tamir İşlemi';
                                                    return (
                                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                                            <span>{itemLabel}:</span>
                                                            <span style={{ fontWeight: 600 }}>{formatCurrency(Number(item.price || 0))}</span>
                                                        </div>
                                                    );
                                                });
                                            }

                                            return (
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                                    <span>{REQUEST_TYPE_LABELS[(actionRecord.ticket as any).requestType as keyof typeof REQUEST_TYPE_LABELS] || 'Tamir Ücreti'}:</span>
                                                    <span>{formatCurrency(getRepairPrice())}</span>
                                                </div>
                                            );
                                        })()}

                                        {(actionRecord.ticket as any).accessories?.length > 0 && (
                                            <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px dashed var(--border-primary)' }}>
                                                {(actionRecord.ticket as any).accessories.map((acc: any) => (
                                                    <div key={acc.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', color: 'var(--text-secondary)' }}>
                                                        <span>🛍️ {acc.product?.name || 'Aksesuar'} (x{acc.quantity})</span>
                                                        <span>{formatCurrency(Number(acc.unitPrice) * acc.quantity)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {getNewAccessoryTotal() > 0 && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px', color: 'var(--brand-primary)', fontWeight: 600 }}>
                                                <span>+ Yeni Satış ({accQty}x):</span>
                                                <span>{formatCurrency(getNewAccessoryTotal())}</span>
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid var(--border-primary)', fontWeight: 600, color: 'var(--text-primary)' }}>
                                            <span>Toplam:</span>
                                            <span>{formatCurrency(getGrandTotal())}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1px', color: 'var(--text-tertiary)' }}>
                                            <span>Önceden Alınan:</span>
                                            <span>- {formatCurrency(getPaidAmount())}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid var(--border-primary)', fontWeight: 700, color: getRemaining() > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                                            <span style={{ fontSize: '12.5px' }}>Kalan Ödeme:</span>
                                            <span style={{ fontSize: '13.5px' }}>{formatCurrency(getRemaining())}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Compact Photo Capture Section */}
                                <div style={{ padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                        <span style={{ fontSize: '11.5px', fontWeight: 600 }}>
                                            📸 Fotoğraf Çek <span style={{ color: 'var(--color-danger)' }}>*</span>
                                        </span>
                                        {photos.length > 0 && (
                                            <span style={{ fontSize: '10.5px', color: 'var(--color-success)', fontWeight: 600 }}>
                                                ✓ {photos.length} Adet Eklendi
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(85px, 1fr))', gap: '4px' }}>
                                        {actionRecord.type === 'PICKUP' ? (
                                            <>
                                                <button type="button" className="btn btn-secondary btn-xs" onClick={() => triggerCapture('BROKEN_DEVICE')} style={{ fontSize: '11px', padding: '4px 6px' }}>
                                                    📸 Arızalı Cihaz
                                                </button>
                                                <button type="button" className="btn btn-secondary btn-xs" onClick={() => triggerCapture('BARCODE')} style={{ fontSize: '11px', padding: '4px 6px' }}>
                                                    🔖 Barkod
                                                </button>
                                            </>
                                        ) : (
                                            <button type="button" className="btn btn-secondary btn-xs" onClick={() => triggerCapture('WORKING_DEVICE')} style={{ fontSize: '11px', padding: '4px 6px' }}>
                                                ✅ Çalışır Hali
                                            </button>
                                        )}
                                        <button type="button" className="btn btn-secondary btn-xs" onClick={() => triggerCapture('OTHER')} style={{ fontSize: '11px', padding: '4px 6px' }}>
                                            📷 Diğer
                                        </button>
                                    </div>
                                    <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileCapture} />

                                    {/* Compact Thumbnail Grid */}
                                    {photos.length > 0 && (
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                                            {photos.map((p, i) => (
                                                <div key={i} style={{ position: 'relative', width: '52px', height: '52px' }}>
                                                    <img src={p.base64} alt={p.label} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-primary)' }} />
                                                    <button
                                                        type="button"
                                                        style={{
                                                            position: 'absolute',
                                                            top: -4,
                                                            right: -4,
                                                            background: 'rgba(239, 68, 68, 0.9)',
                                                            color: '#fff',
                                                            border: 'none',
                                                            borderRadius: '50%',
                                                            width: 16,
                                                            height: 16,
                                                            cursor: 'pointer',
                                                            fontSize: 9,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                        }}
                                                        onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right Column: Physical Condition, Accessory, Payment, Notes */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {/* Physical Device Condition Box */}
                                <div style={{ padding: '8px 10px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                                        <span style={{ fontSize: '11px', color: '#d97706', fontWeight: 700 }}>🔍 Cihaz Durumu / Hasar</span>
                                        {!isEditingCondition ? (
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-xs"
                                                onClick={() => setIsEditingCondition(true)}
                                                style={{ fontSize: '10.5px', color: '#d97706', padding: '1px 5px' }}
                                            >
                                                ✏️ {deviceConditionInput ? 'Düzenle' : 'Not Ekle'}
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                className="btn btn-primary btn-xs"
                                                onClick={async () => {
                                                    try {
                                                        await updateTicketDeviceCondition((actionRecord.ticket as any).id, deviceConditionInput);
                                                        (actionRecord.ticket as any).deviceCondition = deviceConditionInput;
                                                        setIsEditingCondition(false);
                                                    } catch (err: any) {
                                                        alert(err.message);
                                                    }
                                                }}
                                                style={{ fontSize: '10.5px', padding: '1px 6px', background: '#d97706', borderColor: '#d97706' }}
                                            >
                                                💾 Kaydet
                                            </button>
                                        )}
                                    </div>

                                    {isEditingCondition ? (
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={deviceConditionInput}
                                            onChange={(e) => setDeviceConditionInput(e.target.value)}
                                            placeholder="Örn: Arka kapak kırık, ekranda çizikler..."
                                            style={{ fontSize: '11.5px', padding: '3px 8px', width: '100%', height: '28px', marginTop: '4px' }}
                                            autoFocus
                                        />
                                    ) : (
                                        <div style={{ fontSize: '11.5px', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.3 }}>
                                            {deviceConditionInput || <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Hasar / durum notu eklenmedi</span>}
                                        </div>
                                    )}
                                </div>

                                {/* Compact Accessory Sale Section */}
                                <div style={{ background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', cursor: 'pointer', marginBottom: addAccessoryEnabled ? '6px' : 0 }}>
                                        <input type="checkbox" checked={addAccessoryEnabled} onChange={(e) => setAddAccessoryEnabled(e.target.checked)} />
                                        <span style={{ fontWeight: 600, fontSize: '11.5px' }}>🛍 Aksesuar Satışı</span>
                                    </label>
                                    {addAccessoryEnabled && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                                            <select
                                                className="form-select"
                                                value={accProduct}
                                                onChange={(e) => {
                                                    setAccProduct(e.target.value);
                                                    const p = accessories.find(a => a.id === e.target.value);
                                                    if (p) { setAccPrice(String(p.price)); setAccQty('1'); }
                                                }}
                                                style={{
                                                    fontSize: '12px',
                                                    padding: '4px 28px 4px 8px',
                                                    minHeight: '32px',
                                                    height: '32px',
                                                    lineHeight: 'normal',
                                                    width: '100%',
                                                }}
                                            >
                                                <option value="">Aksesuar Seçin</option>
                                                {accessories.map(a => <option key={a.id} value={a.id}>{a.name} (Stok: {a.stock})</option>)}
                                            </select>
                                            {accProduct && (
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <input type="number" className="form-input" placeholder="Adet" value={accQty} onChange={(e) => setAccQty(e.target.value)} min="1" style={{ width: '70px', fontSize: '11px', padding: '3px 6px', height: '28px' }} />
                                                    <input type="number" className="form-input" placeholder="Birim Fiyat ₺" value={accPrice} onChange={(e) => setAccPrice(e.target.value)} min="0" style={{ flex: 1, fontSize: '11px', padding: '3px 6px', height: '28px' }} />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Optional Payment Section - Delivery Only */}
                                {actionRecord.type === 'DELIVERY' && (
                                    <div style={{ background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: '8px', borderLeft: '3px solid var(--brand-primary)', border: '1px solid var(--border-primary)' }}>
                                        <div style={{ fontSize: '11.5px', fontWeight: 600, marginBottom: '6px' }}>
                                            💰 Ödeme Girişi {getRemaining() > 0 ? '(Zorunlu)' : ''}
                                        </div>

                                        {paymentsList.map((p, idx) => (
                                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-primary)', padding: '3px 6px', borderRadius: '4px', marginBottom: '4px', fontSize: '11.5px' }}>
                                                <div>
                                                    <span style={{ fontWeight: 600 }}>{formatCurrency(p.amount)}</span>
                                                    <span style={{ color: 'var(--text-tertiary)', marginLeft: '4px', fontSize: '10.5px' }}>
                                                        ({PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS] || p.method})
                                                    </span>
                                                </div>
                                                <button type="button" className="btn btn-ghost btn-xs" style={{ color: 'var(--color-danger)', border: 'none', padding: '0 4px' }} onClick={() => setPaymentsList(prev => prev.filter((_, i) => i !== idx))}>✕</button>
                                            </div>
                                        ))}

                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                            <input type="number" className="form-input" placeholder="Tutar ₺" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} required={paymentsList.length === 0} style={{ flex: 1, minWidth: '80px', fontSize: '11px', padding: '3px 6px', height: '28px' }} />
                                            <select
                                                className="form-select"
                                                value={payMethod}
                                                onChange={(e) => {
                                                    const m = e.target.value;
                                                    setPayMethod(m);
                                                    const matching = accounts.filter((acc: any) => acc.type === m);
                                                    setPayAccountId(matching.length === 1 ? matching[0].id : '');
                                                }}
                                                style={{ width: '105px', fontSize: '11.5px', padding: '4px 22px 4px 6px', minHeight: '30px', height: '30px' }}
                                            >
                                                {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                            </select>
                                            <button
                                                type="button"
                                                className="btn btn-secondary btn-xs"
                                                onClick={() => {
                                                    if (!payAmount) return;
                                                    if ((payMethod === 'BANK_TRANSFER' || payMethod === 'CREDIT_CARD') && !payAccountId) {
                                                        alert('Lütfen ödemenin aktarıldığı banka/POS hesabını seçiniz.');
                                                        return;
                                                    }
                                                    setPaymentsList(prev => [...prev, { amount: Number(payAmount), method: payMethod, accountId: payAccountId || undefined, notes: payNotes || undefined }]);
                                                    const currentSum = paymentsList.reduce((acc, p) => acc + p.amount, 0) + Number(payAmount);
                                                    const rem = getRemaining() - currentSum;
                                                    setPayAmount(rem > 0 ? rem.toString() : '');
                                                    setPayNotes('');
                                                    const defMatch = accounts.filter((acc: any) => acc.type === payMethod);
                                                    setPayAccountId(defMatch.length === 1 ? defMatch[0].id : '');
                                                }}
                                                style={{ fontSize: '11px', padding: '3px 8px', height: '28px' }}
                                            >
                                                Ekle
                                            </button>
                                        </div>

                                        {(payMethod === 'BANK_TRANSFER' || payMethod === 'CREDIT_CARD') && (
                                            <div style={{ marginTop: '4px' }}>
                                                <select
                                                    className="form-select"
                                                    value={payAccountId}
                                                    onChange={(e) => setPayAccountId(e.target.value)}
                                                    style={{ fontSize: '11.5px', padding: '4px 24px 4px 6px', minHeight: '30px', height: '30px', width: '100%' }}
                                                >
                                                    {accounts.filter((acc: any) => acc.type === payMethod).length !== 1 && (
                                                        <option value="">-- Hedef Hesap Seçiniz (Zorunlu) --</option>
                                                    )}
                                                    {accounts
                                                        .filter((acc: any) => acc.type === payMethod)
                                                        .map((acc: any) => (
                                                            <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>
                                                        ))}
                                                    {accounts.filter((acc: any) => acc.type === payMethod).length === 0 && (
                                                        accounts.map((acc: any) => (
                                                            <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>
                                                        ))
                                                    )}
                                                </select>
                                            </div>
                                        )}

                                        {payMethod === 'BANK_TRANSFER' && (
                                            <input
                                                type="text"
                                                className="form-input"
                                                placeholder="Havale Gönderici Adı..."
                                                value={payNotes}
                                                onChange={(e) => setPayNotes(e.target.value)}
                                                style={{ marginTop: '4px', fontSize: '11px', padding: '3px 6px', height: '28px' }}
                                            />
                                        )}
                                    </div>
                                )}

                                {/* Compact Process Note */}
                                <div>
                                    <textarea
                                        className="form-textarea"
                                        placeholder="İşlem / teslimat notu..."
                                        value={actionNotes}
                                        onChange={(e) => setActionNotes(e.target.value)}
                                        rows={2}
                                        style={{ fontSize: '11.5px', padding: '6px 8px', resize: 'none', width: '100%' }}
                                    />
                                    {actionError && <div style={{ color: 'var(--color-danger)', fontSize: '11px', marginTop: '2px' }}>{actionError}</div>}
                                </div>
                            </div>
                        </div>

                        {/* Compact Modal Footer */}
                        <div className="modal-footer" style={{ padding: '10px 16px', borderTop: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowActionModal(false)} style={{ fontSize: '12px', padding: '4px 12px' }}>İptal</button>
                            <button className="btn btn-success btn-sm" disabled={savingAction} onClick={handleCompleteService} style={{ fontSize: '12px', padding: '4px 16px', fontWeight: 600 }}>
                                {savingAction ? 'Kaydediliyor...' : '✓ Tamamla'}
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
                            <button className="btn btn-close" onClick={() => setShowPostponeModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <input type="date" className="form-input" value={postponeDate} onChange={(e) => setPostponeDate(e.target.value)} />
                            <textarea className="form-textarea" placeholder="Erteleme nedeni..." value={postponeNotes} onChange={(e) => setPostponeNotes(e.target.value)} rows={3} style={{ marginTop: '10px' }} />
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowPostponeModal(false)}>İptal</button>
                            <button className="btn btn-primary" onClick={handlePostponeAction} disabled={!postponeDate || isPostponing}>Ertele</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Notes Modal */}
            {showNotesModal && notesContact && (
                <div className="modal-overlay" onClick={() => setShowNotesModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">{notesContact.name} - Notlar</h3>
                            <button className="btn btn-close" onClick={() => setShowNotesModal(false)}>✕</button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                            {notesContact.ticketNotes && (
                                <div style={{ padding: '10px 12px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '8px', marginBottom: '10px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--brand-primary)', fontWeight: 700, marginBottom: '2px' }}>
                                        📝 Fiş Notu
                                    </div>
                                    <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'pre-wrap' }}>
                                        {notesContact.ticketNotes}
                                    </div>
                                </div>
                            )}

                            {notesContact.orderNotes && (
                                <div style={{ padding: '10px 12px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '8px', marginBottom: '10px' }}>
                                    <div style={{ fontSize: '11px', color: '#d97706', fontWeight: 700, marginBottom: '2px' }}>
                                        🚐 Servis Talebi Notu
                                    </div>
                                    <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'pre-wrap' }}>
                                        {notesContact.orderNotes}
                                    </div>
                                </div>
                            )}

                            {isLoadingNotes ? <p>Yükleniyor...</p> : contactNotes.map(n => (
                                <div key={n.id} style={{ padding: '10px', background: 'var(--bg-tertiary)', borderRadius: '8px', marginBottom: '10px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                                        {n.personnel.name} · {new Date(n.createdAt).toLocaleString('tr-TR')}
                                    </div>
                                    <div style={{ fontSize: '14px' }}>{n.content}</div>
                                </div>
                            ))}
                            <textarea className="form-textarea" placeholder="Yeni not ekle..." value={newNote} onChange={e => setNewNote(e.target.value)} rows={3} />
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-primary" onClick={handleAddNote} disabled={!newNote.trim()}>Notu Kaydet</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function WorkOrderCard({
    order,
    onAction,
    onPostpone,
    onCancel,
    isSorting,
    onMove,
    canMoveUp,
    canMoveDown,
    onShowNotes,
}: {
    order: any;
    onAction: () => void;
    onPostpone: () => void;
    onCancel: () => void;
    isSorting?: boolean;
    onMove?: (dir: 'up' | 'down') => void;
    canMoveUp?: boolean;
    canMoveDown?: boolean;
    onShowNotes?: () => void;
}) {
    const [showNav, setShowNav] = useState<string | null>(null);
    const customer = order.ticket.customer || order.ticket.repairer;
    const isCompleted = order.status === 'COMPLETED';
    const customerName = customer?.name || '-';
    const customerPhone = customer?.phone;

    const notesCount = (order.ticket.customer?._count?.notes || 0) + (order.ticket.repairer?._count?.notes || 0) + (order.ticket.notes ? 1 : 0) + (order.notes ? 1 : 0);

    return (
        <div className="card" style={{ marginBottom: 'var(--space-2)', opacity: isCompleted ? 0.6 : 1, padding: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)', gap: '8px' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <Link href={`/tickets/${order.ticket.id}`} style={{ fontWeight: 800, fontSize: 'var(--font-size-lg)', color: 'inherit', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {order.ticket.ticketNo}
                    </Link>
                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                        <span className={`badge ${order.type === 'PICKUP' ? 'badge-info' : 'badge-success'}`} style={{ fontSize: '10px' }}>
                            {order.type === 'PICKUP' ? '📥 Alınacak' : '📤 Verilecek'}
                        </span>
                        <span className="badge" style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)', fontSize: '10px' }}>
                            🛠 {REQUEST_TYPE_LABELS[(order.ticket as any).requestType as keyof typeof REQUEST_TYPE_LABELS] || '—'}
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            if (!isCompleted) onShowNotes?.();
                        }}
                        style={{
                            position: 'relative',
                            border: '1px solid var(--border-color)',
                            background: 'transparent',
                            color: 'var(--text-tertiary)',
                            borderRadius: '50%',
                            width: '30px',
                            height: '30px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: isCompleted ? 'not-allowed' : 'pointer',
                            opacity: isCompleted ? 0.5 : 1,
                            filter: isCompleted ? 'grayscale(1)' : 'none',
                            fontSize: '14px',
                            padding: 0,
                            flexShrink: 0
                        }}
                    >
                        📋
                        {notesCount > 0 && (
                            <span style={{
                                position: 'absolute',
                                top: '-2px',
                                right: '-2px',
                                background: 'var(--color-danger)',
                                color: 'white',
                                borderRadius: '50%',
                                width: '16px',
                                height: '16px',
                                fontSize: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold',
                                border: '2px solid white'
                            }}>
                                {notesCount}
                            </span>
                        )}
                        {notesCount === 0 && (
                            <span style={{ position: 'absolute', bottom: '-2px', right: '-2px', fontSize: '10px', color: 'var(--text-tertiary)', background: '#fff', borderRadius: '50%', width: '14px', height: '14px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</span>
                        )}
                    </button>
                    <span className={`badge ${isCompleted ? 'badge-success' : 'badge-info'}`} style={{ whiteSpace: 'nowrap', padding: '4px 8px', fontSize: '11px', flexShrink: 0 }}>
                        {isCompleted ? '✅ Tamamlandı' : '⏳ Bekliyor'}
                    </span>
                </div>
            </div>

            <div style={{ marginBottom: 'var(--space-3)' }}>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{
                        fontSize: '10px',
                        background: (order.ticket as any).customerId ? 'rgba(59, 130, 246, 0.12)' : 'rgba(234, 179, 8, 0.12)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        color: (order.ticket as any).customerId ? 'var(--brand-primary)' : 'var(--color-warning)',
                        fontWeight: 800,
                        border: `1px solid ${(order.ticket as any).customerId ? 'rgba(59, 130, 246, 0.2)' : 'rgba(234, 179, 8, 0.2)'}`
                    }}>
                        {(order.ticket as any).customerId ? 'MÜŞTERİ' : 'TAMİRCİ'}
                    </span>
                    <span style={{ fontSize: '15px' }}>{customerName}</span>
                </div>
                {customerPhone && (
                    <div style={{ marginTop: '2px' }}>
                        <a href={`tel:${customerPhone}`} style={{ fontSize: 'var(--font-size-sm)', color: 'var(--brand-primary)', textDecoration: 'none' }}>
                            📞 {customerPhone}
                        </a>
                    </div>
                )}
                {customer?.address && (
                    <div style={{ marginTop: '4px', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', display: 'flex', gap: '4px' }}>
                        <span>📍</span>
                        <a
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                setShowNav(encodeURIComponent(`${customer.address}, ${customer.city} ${customer.district}`));
                            }}
                            style={{ color: 'var(--text-secondary)', textDecoration: 'none', borderBottom: '1px dashed var(--border-color)' }}
                        >
                            {customer.address}, {customer.city} {customer.district}
                        </a>
                    </div>
                )}
            </div>

            {/* Navigation selection dropdown if clicked on address */}
            {showNav && (
                <div style={{ padding: '8px', background: 'var(--bg-secondary)', borderRadius: '6px', marginBottom: '8px', fontSize: '12px' }}>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>🗺️ Haritada Aç:</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <a href={`https://www.google.com/maps/search/?api=1&query=${showNav}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-xs" style={{ flex: 1, textAlign: 'center' }}>Google Maps</a>
                        <a href={`https://yandex.com/maps/?text=${showNav}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-xs" style={{ flex: 1, textAlign: 'center' }}>Yandex Maps</a>
                        <button className="btn btn-ghost btn-xs" onClick={() => setShowNav(null)}>✕</button>
                    </div>
                </div>
            )}



            <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{(order.ticket as any).brand?.name} · {(order.ticket as any).model}</span>
            </div>

            {!isCompleted && (
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    {isSorting ? (
                        <>
                            <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => onMove?.('up')} disabled={!canMoveUp}>
                                ⬆ Yukarı
                            </button>
                            <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => onMove?.('down')} disabled={!canMoveDown}>
                                ⬇ Aşağı
                            </button>
                        </>
                    ) : (
                        <>
                            <button className="btn btn-primary btn-sm" style={{ flex: 2 }} onClick={onAction}>
                                📸 İşlem Yap
                            </button>
                            <button className="btn btn-warning btn-sm" style={{ flex: 1 }} onClick={onPostpone}>
                                ⏳ Ertele
                            </button>
                            <button className="btn btn-danger btn-sm" style={{ padding: '0 10px' }} onClick={onCancel}>
                                ✕
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}