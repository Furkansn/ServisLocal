'use client';

import { useState, useEffect, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { getTicketById, changeTicketStatus, addOperationToRepairItems, removeOperationFromRepairItems, updateTicketNotes, updateTicketDeviceCondition, getTicketAuditLogs } from '@/actions/tickets';
import { addPayment, deletePayment, closeTicket, closeWithoutPayment } from '@/actions/payments';
import { createServiceRecord } from '@/actions/service-records';
import { getProductsByCategory, addAccessoryToTicket, removeAccessoryFromTicket } from '@/actions/products';
import { getContactNotes, addContactNote } from '@/actions/contact-notes';
import { getPersonnelByRole } from '@/actions/personnel';
import { getAccounts } from '@/actions/collections';
import { STATUS_LABELS, STATUS_COLORS, getNextStatuses, isReadOnly } from '@/lib/state-machine';
import { CUSTOMER_TYPE_LABELS, SERVICE_RECORD_TYPE_LABELS, REQUEST_TYPE_LABELS, PRIORITY_LABELS, PAYMENT_METHOD_LABELS, OPERATION_TYPE_LABELS, formatDate, formatDateTime, formatCurrency, getLocalDateString } from '@/lib/constants';
import { TicketStatus, Role } from '@prisma/client';

type Ticket = Awaited<ReturnType<typeof getTicketById>>;

export default function TicketDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { data: session } = useSession();
    const ticketId = params.id as string;
    const [ticket, setTicket] = useState<Ticket>(null);
    const [isPending, startTransition] = useTransition();
    const [showPayment, setShowPayment] = useState(false);
    const [showAudit, setShowAudit] = useState(false);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);

    // Contact notes state
    const [contactNotes, setContactNotes] = useState<any[]>([]);
    const [newNoteText, setNewNoteText] = useState('');
    const [noteLoading, setNoteLoading] = useState(false);
    const [noteError, setNoteError] = useState('');

    // Operation Price Modal State
    const [showOpModal, setShowOpModal] = useState(false);
    const [selectedOp, setSelectedOp] = useState<any | null>(null);
    const [opPriceInput, setOpPriceInput] = useState('');
    const [opLabelInput, setOpLabelInput] = useState('');
    const [opError, setOpError] = useState('');

    // Ticket Note Edit State
    const [isEditingTicketNote, setIsEditingTicketNote] = useState(false);
    const [ticketNoteInput, setTicketNoteInput] = useState('');
    const [isSavingTicketNote, setIsSavingTicketNote] = useState(false);

    // Device Condition Edit State
    const [isEditingDeviceCondition, setIsEditingDeviceCondition] = useState(false);
    const [deviceConditionInput, setDeviceConditionInput] = useState('');
    const [isSavingDeviceCondition, setIsSavingDeviceCondition] = useState(false);

    const handleSaveDeviceCondition = async () => {
        setIsSavingDeviceCondition(true);
        try {
            await updateTicketDeviceCondition(ticketId, deviceConditionInput);
            setIsEditingDeviceCondition(false);
            loadTicket();
        } catch (err: any) {
            alert(err.message || 'Cihaz fiziksel durumu kaydedilemedi');
        } finally {
            setIsSavingDeviceCondition(false);
        }
    };

    const handleSaveTicketNotes = async () => {
        setIsSavingTicketNote(true);
        try {
            await updateTicketNotes(ticketId, ticketNoteInput);
            setIsEditingTicketNote(false);
            loadTicket();
        } catch (err: any) {
            alert(err.message || 'Not kaydedilemedi');
        } finally {
            setIsSavingTicketNote(false);
        }
    };

    // Accessory Form
    const [showAccessory, setShowAccessory] = useState(false);
    const [accessories, setAccessories] = useState<any[]>([]);
    const [selectedAcs, setSelectedAcs] = useState('');
    const [acsQty, setAcsQty] = useState(1);
    const [acsPrice, setAcsPrice] = useState('');
    const [acsError, setAcsError] = useState('');

    // Service record form
    const [showServiceForm, setShowServiceForm] = useState(false);
    const [srvType, setSrvType] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');
    const [srvDate, setSrvDate] = useState(getLocalDateString());
    const [srvPersonnelId, setSrvPersonnelId] = useState('');
    const [srvNotes, setSrvNotes] = useState('');
    const [servicePersonnel, setServicePersonnel] = useState<any[]>([]);
    const [srvError, setSrvError] = useState('');

    // Payment form
    const [payMethod, setPayMethod] = useState('CASH');
    const [payAccountId, setPayAccountId] = useState('');
    const [accounts, setAccounts] = useState<any[]>([]);
    const [payAmount, setPayAmount] = useState('');
    const [payNotes, setPayNotes] = useState('');
    const [payError, setPayError] = useState('');

    const loadTicket = () => {
        startTransition(async () => {
            const data = await getTicketById(ticketId);
            setTicket(data);
        });
    };

    useEffect(() => {
        loadTicket();
    }, [ticketId]);

    useEffect(() => {
        getProductsByCategory('ACCESSORY').then(setAccessories);
        getPersonnelByRole(Role.SERVICE_STAFF).then(setServicePersonnel);
        getAccounts().then(setAccounts);
    }, []);

    // Auto refresh
    useEffect(() => {
        const interval = setInterval(loadTicket, 15000);
        return () => clearInterval(interval);
    }, [ticketId]);

    const [selectedPhoto, setSelectedPhoto] = useState<any>(null);

    const handleDownload = (url: string, filename: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!ticket) {
        return (
            <div className="loading-container">
                <div className="spinner spinner-lg" />
            </div>
        );
    }

    const userRoles = (session?.user as any)?.roles || [];
    const isManager = userRoles.includes('OPERATOR');
    const isClosed = ticket.status === TicketStatus.TAMAMLANDI;
    const readOnly = isReadOnly(ticket.status) || (isClosed && !isManager);
    const nextStatuses = isClosed && !isManager ? [] : getNextStatuses(ticket.status);
    const remaining = Number(ticket.totalAmount) - Number(ticket.paidAmount);
    const customerName = ticket.customer?.name || ticket.repairer?.name || '-';
    const customerPhone = ticket.customer?.phone || ticket.repairer?.phone || '';

    const handleStatusChange = async (newStatus: TicketStatus) => {
        try {
            await changeTicketStatus(ticketId, newStatus);
            loadTicket();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleAddAccessory = async () => {
        setAcsError('');
        if (!selectedAcs) return setAcsError('Aksesuar seçiniz');
        if (acsQty <= 0) return setAcsError('Geçerli bir miktar girin');
        if (!acsPrice || Number(acsPrice) < 0) return setAcsError('Geçerli bir fiyat girin');

        try {
            await addAccessoryToTicket({
                ticketId,
                productId: selectedAcs,
                quantity: acsQty,
                unitPrice: Number(acsPrice),
            });
            setShowAccessory(false);
            setSelectedAcs('');
            setAcsQty(1);
            setAcsPrice('');
            loadTicket();
        } catch (err: any) {
            setAcsError(err.message);
        }
    };

    const handleAddPayment = async () => {
        setPayError('');
        const amount = parseFloat(payAmount);
        if (!amount || amount <= 0) {
            setPayError('Geçerli bir tutar girin');
            return;
        }
        try {
            await addPayment({
                ticketId,
                method: payMethod,
                accountId: payAccountId || undefined,
                amount,
                notes: payNotes || undefined,
            });
            setPayAmount('');
            setPayNotes('');
            setPayAccountId('');
            setShowPayment(false);
            loadTicket();
        } catch (err: any) {
            setPayError(err.message);
        }
    };

    const handleDeletePayment = async (paymentId: string) => {
        if (!confirm('Bu ödeme kaydını silmek istediğinize emin misiniz?')) return;
        try {
            await deletePayment(paymentId);
            loadTicket();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleRemoveAccessory = async (accessoryId: string, name: string) => {
        if (!confirm(`"${name}" aksesuar satışını iptal edip stoğa iade etmek istediğinize emin misiniz?`)) return;
        try {
            await removeAccessoryFromTicket(accessoryId);
            loadTicket();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleCloseTicket = async () => {
        try {
            await closeTicket(ticketId);
            loadTicket();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleCloseWithoutPayment = async () => {
        if (!confirm('Ödeme almadan kapatmak istediğinize emin misiniz?')) return;
        try {
            await closeWithoutPayment(ticketId);
            loadTicket();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const loadAuditLogs = async () => {
        const logs = await getTicketAuditLogs(ticketId);
        setAuditLogs(logs);
        setShowAudit(true);
    };

    const PHOTO_TYPE_LABELS: Record<string, string> = {
        BROKEN_DEVICE: '📸 Arızalı Cihaz',
        BARCODE: '🔖 Barkod',
        WORKING_DEVICE: '✅ Çalışır Hali',
        OTHER: '📷 Diğer',
    };

    const handleAddOpPrice = async () => {
        if (!selectedOp || !opPriceInput) return;
        const priceNum = parseFloat(opPriceInput);
        if (isNaN(priceNum) || priceNum < 0) {
            setOpError('Lütfen geçerli bir tutar girin.');
            return;
        }
        try {
            await addOperationToRepairItems(
                ticketId,
                selectedOp.id,
                opLabelInput || OPERATION_TYPE_LABELS[selectedOp.operationType as keyof typeof OPERATION_TYPE_LABELS] || selectedOp.operationType,
                priceNum
            );
            setShowOpModal(false);
            setSelectedOp(null);
            setOpPriceInput('');
            setOpLabelInput('');
            loadTicket();
        } catch (err: any) {
            setOpError(err.message);
        }
    };

    const handleRemoveOpPrice = async (opId: string) => {
        if (confirm('Bu işlemin tutarını fiş kalemlerinden çıkarmak istiyor musunuz?')) {
            try {
                await removeOperationFromRepairItems(ticketId, opId);
                loadTicket();
            } catch (err: any) {
                alert(err.message);
            }
        }
    };

    const handleAddContactNote = async () => {
        const contactId = ticket?.customerId || ticket?.repairerId;
        const contactType = ticket?.customerType === 'REPAIRER' ? 'REPAIRER' : 'CUSTOMER';
        if (!contactId || !newNoteText.trim()) return;

        setNoteLoading(true);
        setNoteError('');
        try {
            await addContactNote(contactId, contactType, newNoteText.trim());
            setNewNoteText('');
            const updatedNotes = await getContactNotes(contactId, contactType);
            setContactNotes(updatedNotes);
        } catch (err: any) {
            setNoteError(err.message);
        } finally {
            setNoteLoading(false);
        }
    };

    const handlePrintLabel = () => {
        const existing = document.getElementById('roll-print-iframe');
        if (existing) existing.remove();

        const iframe = document.createElement('iframe');
        iframe.id = 'roll-print-iframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.border = '0px';
        iframe.src = `/print/ticket/${ticketId}?format=roll&autoPrint=1`;

        document.body.appendChild(iframe);
    };

    return (
        <div>
            {/* Header */}
            <div className="page-header">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="page-title">{ticket.ticketNo} {ticket.serviceRecords?.length > 0 && '🚗'}</h1>
                        <span
                            className="badge"
                            style={{
                                background: `${STATUS_COLORS[ticket.status]}20`,
                                color: STATUS_COLORS[ticket.status],
                                fontSize: 'var(--font-size-sm)',
                            }}
                        >
                            {STATUS_LABELS[ticket.status]}
                        </span>
                        <span className={`badge badge-priority-${ticket.priority}`}>
                            {PRIORITY_LABELS[ticket.priority]}
                        </span>
                        {ticket.closedWithoutPayment && (
                            <span className="badge badge-danger">⚠ Ödemesiz Kapatıldı</span>
                        )}
                    </div>
                    <p className="page-subtitle">
                        {CUSTOMER_TYPE_LABELS[ticket.customerType as 'INDIVIDUAL' | 'REPAIRER']} · {formatDateTime(ticket.createdAt)} · {ticket.createdBy.name}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button className="btn btn-secondary btn-sm" onClick={handlePrintLabel}>🏷️ Etiket Yazdır</button>
                    <button className="btn btn-primary btn-sm" onClick={() => window.open(`/print/ticket/${ticketId}`, '_blank')}>🖨️ Fiş Yazdır</button>
                    {!readOnly && (
                        <button className="btn btn-secondary btn-sm" onClick={() => router.push(`/tickets/${ticketId}/edit`)}>✏️ Düzenle</button>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={loadAuditLogs}>📋 Log</button>
                    <button className="btn btn-secondary btn-sm" onClick={loadTicket}>🔄</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => router.back()}>← Geri</button>
                </div>
            </div>

            {ticket.status === TicketStatus.IPTAL && (
                <div style={{ padding: 'var(--space-3)', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
                    ⚠️ Bu kayıt iptal edilmiştir. Değişiklik yapılamaz.
                </div>
            )}

            {isClosed && !isManager && (
                <div style={{ padding: 'var(--space-3)', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', fontWeight: 600 }}>
                    🔒 Bu fiş tamamlandığı (kapatıldığı) için düzenleme yetkisi sadece Servis Müdürü'ne aittir.
                </div>
            )}

            {isClosed && isManager && (
                <div style={{ padding: 'var(--space-3)', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', fontWeight: 600 }}>
                    ℹ️ Bu fiş tamamlanmıştır. Servis Müdürü yetkiniz ile düzenleme yapabilirsiniz.
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-4)' }}>
                {/* Main Content */}
                <div>
                    {/* Customer/Repairer Info */}
                    <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                        <div className="card-header">
                            <h3 className="card-title">👤 {ticket.customerType === 'INDIVIDUAL' ? 'Müşteri' : 'Tamirci'} Bilgileri</h3>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                            <div>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Ad Soyad</div>
                                <div style={{ fontWeight: 600 }}>{customerName}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Telefon</div>
                                <a href={`tel:${customerPhone}`} style={{ fontWeight: 600 }}>{customerPhone}</a>
                            </div>
                            {(ticket.customer?.city || ticket.repairer?.city) && (
                                <div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>İl/İlçe</div>
                                    <div>{ticket.customer?.city || ticket.repairer?.city} / {ticket.customer?.district || ticket.repairer?.district}</div>
                                </div>
                            )}
                            {(ticket.customer?.address || ticket.repairer?.address) && (
                                <div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Adres</div>
                                    <div>{ticket.customer?.address || ticket.repairer?.address}</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Device Info */}
                    <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                        <div className="card-header">
                            <h3 className="card-title">📺 Cihaz Bilgileri</h3>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
                            <div>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Marka</div>
                                <div style={{ fontWeight: 600 }}>{ticket.brand.name}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Model</div>
                                <div style={{ fontWeight: 600 }}>{ticket.model}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Seri No</div>
                                <div>{ticket.serialNo || '-'}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Talep Türü</div>
                                <div>{REQUEST_TYPE_LABELS[ticket.requestType]}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Garanti</div>
                                <div>{ticket.hasWarranty ? '✅ Servis Garantili' : '❌ Yok'}</div>
                            </div>
                        </div>
                    </div>

                    {/* Cihaz Fiziksel Durumu / Çizik & Hasar Notu */}
                    <div className="card" style={{ marginBottom: 'var(--space-4)', borderLeft: '4px solid #f59e0b' }}>
                        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 className="card-title" style={{ fontSize: '14px', color: '#d97706', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                                🔍 Cihaz Fiziksel Durumu / Hasar Bilgisi
                            </h3>
                            {!readOnly && !isEditingDeviceCondition && (
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#d97706', fontWeight: 600 }}
                                    onClick={() => {
                                        setDeviceConditionInput(ticket.deviceCondition || '');
                                        setIsEditingDeviceCondition(true);
                                    }}
                                >
                                    ✏️ {ticket.deviceCondition ? 'Düzenle' : 'Durum Ekle'}
                                </button>
                            )}
                        </div>

                        {isEditingDeviceCondition ? (
                            <div style={{ marginTop: '8px' }}>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={deviceConditionInput}
                                    onChange={(e) => setDeviceConditionInput(e.target.value)}
                                    placeholder="Örn: Arka kapak kırık, ekranda çizikler var..."
                                    style={{ fontSize: '13px', marginBottom: '8px', width: '100%' }}
                                    autoFocus
                                />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => setIsEditingDeviceCondition(false)}
                                        disabled={isSavingDeviceCondition}
                                    >
                                        İptal
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-primary btn-sm"
                                        onClick={handleSaveDeviceCondition}
                                        disabled={isSavingDeviceCondition}
                                        style={{ background: '#d97706', borderColor: '#d97706' }}
                                    >
                                        {isSavingDeviceCondition ? 'Kaydediliyor...' : '💾 Durumu Kaydet'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ padding: 'var(--space-3)', background: 'rgba(245, 158, 11, 0.08)', borderRadius: 'var(--radius-md)', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500, marginTop: '8px' }}>
                                {ticket.deviceCondition || <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Henüz cihaz fiziksel durum bilgisi girilmemiş. Düzenlemek için sağdaki 'Durum Ekle' butonuna tıklayın.</span>}
                            </div>
                        )}
                    </div>

                    {/* Fiş Notu */}
                    <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 className="card-title">📝 Fiş Notu</h3>
                            {!readOnly && !isEditingTicketNote && (
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--brand-primary)', fontWeight: 600 }}
                                    onClick={() => {
                                        setTicketNoteInput(ticket.notes || '');
                                        setIsEditingTicketNote(true);
                                    }}
                                >
                                    ✏️ {ticket.notes ? 'Düzenle' : 'Not Ekle'}
                                </button>
                            )}
                        </div>

                        {isEditingTicketNote ? (
                            <div style={{ marginTop: '8px' }}>
                                <textarea
                                    className="form-textarea"
                                    rows={3}
                                    value={ticketNoteInput}
                                    onChange={(e) => setTicketNoteInput(e.target.value)}
                                    placeholder="Fiş notunu buraya yazın..."
                                    style={{ fontSize: '13px', marginBottom: '8px', width: '100%' }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => setIsEditingTicketNote(false)}
                                        disabled={isSavingTicketNote}
                                    >
                                        İptal
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-primary btn-sm"
                                        onClick={handleSaveTicketNotes}
                                        disabled={isSavingTicketNote}
                                    >
                                        {isSavingTicketNote ? 'Kaydediliyor...' : '💾 Notu Kaydet'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ padding: 'var(--space-3)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', fontSize: '14px', whiteSpace: 'pre-wrap' }}>
                                {ticket.notes ? ticket.notes : <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Henüz bir fiş notu eklenmemiş.</span>}
                            </div>
                        )}
                    </div>

                    {/* Service Record Notes */}
                    {ticket.serviceRecords.some(sr => sr.notes) && (
                        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                            <div className="card-header">
                                <h3 className="card-title">📝 Servis Notları</h3>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                {ticket.serviceRecords.filter(sr => sr.notes).map(sr => (
                                    <div key={sr.id} style={{
                                        padding: 'var(--space-3)',
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-md)',
                                        borderLeft: `4px solid ${sr.type === 'PICKUP' ? 'var(--brand-primary)' : 'var(--color-success)'}`
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                                            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                                                {SERVICE_RECORD_TYPE_LABELS[sr.type]}
                                            </span>
                                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                                                {sr.assignedPersonnel?.name} · {formatDate(sr.scheduledDate)}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: 'var(--font-size-sm)' }}>{sr.notes}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}



                    {/* Operations */}
                    {ticket.operations.length > 0 && (
                        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                            <h3 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>🔧 Tamir İşlemleri</h3>
                            {(() => {
                                const parsedRepairItems: any[] = ticket?.repairItems
                                    ? (typeof ticket.repairItems === 'string'
                                        ? (() => { try { return JSON.parse(ticket.repairItems); } catch (e) { return []; } })()
                                        : Array.isArray(ticket.repairItems) ? ticket.repairItems : [])
                                    : [];

                                return ticket.operations.map((op) => {
                                    const pricedItem = parsedRepairItems.find((item: any) => item.operationId === op.id);

                                    return (
                                        <div key={op.id} style={{
                                            padding: 'var(--space-3)',
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: 'var(--radius-md)',
                                            marginBottom: 'var(--space-2)',
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                    <span style={{ fontWeight: 600 }}>{OPERATION_TYPE_LABELS[op.operationType]}</span>
                                                    {pricedItem && (
                                                        <span style={{
                                                            fontSize: '11px',
                                                            fontWeight: 700,
                                                            padding: '2px 8px',
                                                            borderRadius: '12px',
                                                            background: '#dcfce7',
                                                            color: '#15803d',
                                                            border: '1px solid #86efac',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px'
                                                        }}>
                                                            💰 ₺{formatCurrency(Number(pricedItem.price))} (Fiyata Eklendi)
                                                        </span>
                                                    )}
                                                </div>
                                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>{op.performedBy.name}</span>
                                            </div>

                                            {op.removedPart && <div style={{ fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>Çıkan: {op.removedPart}</div>}
                                            {op.installedProduct && <div style={{ fontSize: 'var(--font-size-sm)', marginTop: '2px' }}>Takılan: {op.installedProduct.name}</div>}
                                            {op.notes && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-1)' }}>{op.notes}</div>}

                                            {/* Action to Add / Remove Price */}
                                            {!readOnly && (
                                                <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed var(--border-primary)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                    {pricedItem ? (
                                                        <button
                                                            className="btn btn-ghost btn-sm"
                                                            style={{ color: 'var(--color-danger)', fontSize: '11px', padding: '2px 8px' }}
                                                            onClick={() => handleRemoveOpPrice(op.id)}
                                                        >
                                                            🗑️ Fiyat Kalemini Çıkar
                                                        </button>
                                                    ) : (
                                                        <button
                                                            className="btn btn-secondary btn-sm"
                                                            style={{ fontSize: '12px', padding: '3px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                            onClick={() => {
                                                                setSelectedOp(op);
                                                                setOpLabelInput(OPERATION_TYPE_LABELS[op.operationType] || op.operationType);
                                                                setOpPriceInput('');
                                                                setOpError('');
                                                                setShowOpModal(true);
                                                            }}
                                                        >
                                                            ➕ Fiyata / Kaleme Ekle
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    )}

                    {/* Status History */}
                    <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                        <h3 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>📜 Statü Geçmişi</h3>
                        {ticket.statusHistory.map((sh) => (
                            <div key={sh.id} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-3)',
                                padding: 'var(--space-2) 0',
                                borderBottom: '1px solid var(--border-primary)',
                                fontSize: 'var(--font-size-sm)',
                            }}>
                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', minWidth: '120px' }}>
                                    {formatDateTime(sh.createdAt)}
                                </span>
                                {sh.fromStatus && (
                                    <>
                                        <span className="badge badge-neutral" style={{ fontSize: '10px' }}>{STATUS_LABELS[sh.fromStatus]}</span>
                                        <span>→</span>
                                    </>
                                )}
                                <span className="badge" style={{ background: `${STATUS_COLORS[sh.toStatus]}20`, color: STATUS_COLORS[sh.toStatus], fontSize: '10px' }}>
                                    {STATUS_LABELS[sh.toStatus]}
                                </span>
                                <span style={{ color: 'var(--text-tertiary)' }}>{sh.changedBy.name}</span>
                                {sh.notes && <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>{sh.notes}</span>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Sidebar Actions */}
                <div>
                    {/* Actions Card */}
                    {!readOnly && (
                        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                                <h3 className="card-title" style={{ margin: 0 }}>⚡ İşlemler</h3>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '2px' }}>
                                        🛠 Tamir Durumu
                                    </div>
                                    <div>
                                        {ticket.status === 'IPTAL'
                                            ? <span style={{ color: 'var(--color-danger)', fontWeight: 700, fontSize: '13px' }}>❌ İptal Edildi</span>
                                            : (ticket.operations.length > 0 || ['TAMIR_TAMAMLANDI', 'TESLIMAT_SERVIS_ISTENDI', 'TESLIM_EDILDI', 'ODEME_BEKLIYOR', 'TAMAMLANDI'].includes(ticket.status))
                                                ? <span style={{ color: 'var(--color-success)', fontWeight: 700, fontSize: '13px' }}>✅ Tamamlandı</span>
                                                : <span style={{ color: 'var(--color-warning)', fontWeight: 700, fontSize: '13px' }}>⏳ Devam Ediyor</span>}
                                    </div>
                                </div>
                            </div>



                            {/* Status transitions */}
                            {nextStatuses.length > 0 && (
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Durum Güncelle</label>
                                    <select
                                        className="form-select"
                                        value={ticket.status}
                                        onChange={(e) => {
                                            if (e.target.value && e.target.value !== ticket.status) handleStatusChange(e.target.value as TicketStatus);
                                        }}
                                    >
                                        <option value="">— Seçiniz —</option>
                                        {nextStatuses.map((ns) => (
                                            <option key={ns} value={ns}>
                                                {STATUS_LABELS[ns]}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <button className="btn btn-primary btn-block" onClick={() => { setSrvError(''); setShowServiceForm(true); }}>🚗 Servis Talebi Oluştur</button>
                            </div>

                            <div className="form-group" style={{ marginBottom: 0, marginTop: 'var(--space-2)' }}>
                                <button className="btn btn-secondary btn-block" onClick={() => setShowAccessory(true)}>🛍 Aksesuar Satışı Ekle</button>
                            </div>
                        </div>
                    )}

                    {/* Financial Summary */}
                    <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                        <h3 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>💰 Finansal Özet</h3>
                        {(((ticket as any).repairItems && typeof (ticket as any).repairItems === 'string' ? JSON.parse((ticket as any).repairItems) : (ticket as any).repairItems) as any[])?.length > 0 ? (
                            (((ticket as any).repairItems && typeof (ticket as any).repairItems === 'string' ? JSON.parse((ticket as any).repairItems) : (ticket as any).repairItems) as any[]).map((item, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>{REQUEST_TYPE_LABELS[item.type as keyof typeof REQUEST_TYPE_LABELS] || item.type || 'Tamir Tutarı'}</span>
                                    <span style={{ fontWeight: 500 }}>{formatCurrency(Number(item.price))}</span>
                                </div>
                            ))
                        ) : (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Tamir Ücreti</span>
                                <span style={{ fontWeight: 500 }}>{formatCurrency(Number(ticket.repairPrice || 0))}</span>
                            </div>
                        )}

                        {ticket.accessories.length > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Aksesuarlar</span>
                                <span style={{ fontWeight: 500 }}>
                                    {formatCurrency(ticket.accessories.reduce((acc, item) => acc + Number(item.totalPrice), 0))}
                                </span>
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--border-primary)' }}>
                            <span style={{ fontWeight: 600 }}>Genel Toplam</span>
                            <span style={{ fontWeight: 700 }}>{formatCurrency(Number(ticket.totalAmount))}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Ödenen</span>
                            <span style={{ fontWeight: 700, color: 'var(--color-success)' }}>{formatCurrency(Number(ticket.paidAmount))}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--border-primary)' }}>
                            <span style={{ fontWeight: 600 }}>Kalan</span>
                            <span style={{ fontWeight: 700, color: remaining > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                                {formatCurrency(remaining)}
                            </span>
                        </div>
                        <div className="payment-bar">
                            <div className="payment-bar-fill" style={{ width: `${Number(ticket.totalAmount) > 0 ? (Number(ticket.paidAmount) / Number(ticket.totalAmount)) * 100 : 0}%` }} />
                        </div>

                        {/* Payment actions */}
                        {!readOnly && ticket.status === TicketStatus.ODEME_BEKLIYOR && (
                            <div style={{ marginTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                <button className="btn btn-primary btn-sm btn-block" onClick={() => setShowPayment(true)}>
                                    💳 Ödeme Al
                                </button>
                                {remaining <= 0 && (
                                    <button className="btn btn-success btn-sm btn-block" onClick={handleCloseTicket}>
                                        ✅ Fişi Kapat
                                    </button>
                                )}
                                <button className="btn btn-ghost btn-sm btn-block" style={{ color: 'var(--color-danger)' }} onClick={handleCloseWithoutPayment}>
                                    Ödeme Almadan Kapat
                                </button>
                            </div>
                        )}

                        <div style={{ marginTop: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                            <button className="btn btn-secondary btn-sm btn-block" onClick={() => window.open(`/print/ticket/${ticketId}`, '_blank')}>
                                🖨️ Fişi Yazdır / İndir
                            </button>
                        </div>

                        {/* Payments list */}
                        {ticket.payments.length > 0 && (
                            <div style={{ marginTop: 'var(--space-3)' }}>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-2)' }}>Alınan Ödemeler</div>
                                {ticket.payments.map((p) => {
                                    const hoursSinceCreation = (new Date().getTime() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60);
                                    const userRoles = (session?.user as any)?.roles || [];
                                    const isManager = userRoles.includes('OPERATOR');
                                    const canDelete = !p.isApproved && (hoursSinceCreation <= 24 || isManager);

                                    return (
                                        <div key={p.id} style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '6px 0',
                                            borderBottom: '1px solid var(--border-primary)',
                                            fontSize: 'var(--font-size-sm)',
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span>{PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS] || p.method}</span>
                                                    {p.isApproved ? (
                                                        <span className="badge badge-success" style={{ fontSize: '10px' }} title="Müdür tarafından onaylanıp teslim alındı (Değiştirilemez)">✅ Onaylı</span>
                                                    ) : (
                                                        <span className="badge badge-warning" style={{ fontSize: '10px' }}>⏳ Onay Bekliyor</span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                                    {formatDateTime(p.createdAt)}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontWeight: 700, color: 'var(--color-success)' }}>{formatCurrency(Number(p.amount))}</span>
                                                {p.isApproved ? (
                                                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }} title="Müdür tarafından onaylandı ve teslim alındı (Kilitli)">🔒</span>
                                                ) : canDelete ? (
                                                    <button
                                                        className="btn btn-ghost btn-xs"
                                                        onClick={() => handleDeletePayment(p.id)}
                                                        title="Ödemeyi Sil"
                                                        style={{ color: 'var(--color-danger)', fontSize: '12px', padding: '2px 4px' }}
                                                    >
                                                        🗑️
                                                    </button>
                                                ) : (
                                                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }} title="24 saat dolduğu için sadece Servis Müdürü silebilir">⏳ 24s Doldu</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Accessories */}
                    {ticket.accessories.length > 0 && (
                        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                            <h3 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>🛍 Aksesuar Satışları</h3>
                            {ticket.accessories.map((a) => (
                                <div key={a.id} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: 'var(--space-2) 0',
                                    borderBottom: '1px solid var(--border-primary)',
                                    fontSize: 'var(--font-size-sm)',
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 500 }}>{a.product.name}</div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                                            {a.quantity} adet × {formatCurrency(Number(a.unitPrice))}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ fontWeight: 600 }}>{formatCurrency(Number(a.totalPrice))}</div>
                                        {!readOnly && (
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-xs"
                                                onClick={() => handleRemoveAccessory(a.id, a.product.name)}
                                                title="Aksesuar Satışını İptal Et / Stoğa İade Et"
                                                style={{ color: 'var(--color-danger)', fontSize: '11px', padding: '2px 6px' }}
                                            >
                                                🗑️ İptal
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}



                    {/* Photos */}
                    {ticket.photos.length > 0 && (
                        <div className="card">
                            <h3 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>📷 Fotoğraflar</h3>
                            <div className="photo-grid">
                                {ticket.photos.map((photo) => (
                                    <div key={photo.id} className="photo-card" onClick={() => setSelectedPhoto(photo)} style={{ cursor: 'pointer' }}>
                                        <img src={photo.url} alt={photo.type} loading="lazy" />
                                        <div style={{ fontSize: '10px', textAlign: 'center', marginTop: '4px', color: 'var(--text-tertiary)' }}>
                                            {PHOTO_TYPE_LABELS[photo.type] || photo.type}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column - Financial Summary */}
                <div>
                    <div className="card">
                        <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Hesap Özeti</h3>

                        {(((ticket as any).repairItems && typeof (ticket as any).repairItems === 'string' ? JSON.parse((ticket as any).repairItems) : (ticket as any).repairItems) as any[])?.length > 0 ? (
                            (((ticket as any).repairItems && typeof (ticket as any).repairItems === 'string' ? JSON.parse((ticket as any).repairItems) : (ticket as any).repairItems) as any[]).map((item, idx) => (
                                <div key={idx} style={{ marginBottom: 'var(--space-2)', display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>{REQUEST_TYPE_LABELS[item.type as keyof typeof REQUEST_TYPE_LABELS] || item.type || 'Tamir Tutarı'}</span>
                                    <span style={{ fontWeight: 600 }}>{formatCurrency(Number(item.price))}</span>
                                </div>
                            ))
                        ) : (
                            <div style={{ marginBottom: 'var(--space-2)', display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Tamir Tutarı</span>
                                <span style={{ fontWeight: 600 }}>{formatCurrency(Number(ticket.repairPrice))}</span>
                            </div>
                        )}

                        {ticket.accessories.length > 0 && (
                            <div style={{ marginBottom: 'var(--space-2)', display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Aksesuarlar</span>
                                <span style={{ fontWeight: 600 }}>
                                    +{formatCurrency(ticket.accessories.reduce((sum, a) => sum + Number(a.totalPrice), 0))}
                                </span>
                            </div>
                        )}

                        <div style={{ borderTop: '1px solid var(--border-primary)', margin: 'var(--space-3) 0' }} />

                        <div style={{ marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-lg)' }}>
                            <span style={{ fontWeight: 600 }}>Genel Toplam</span>
                            <span style={{ fontWeight: 700, color: 'var(--brand-primary)' }}>{formatCurrency(Number(ticket.totalAmount))}</span>
                        </div>

                        <div style={{ marginBottom: 'var(--space-2)', display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Ödenen</span>
                            <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>{formatCurrency(Number(ticket.paidAmount))}</span>
                        </div>

                        <div style={{ marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Kalan</span>
                            <span style={{ fontWeight: 700, color: remaining > 0 ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                                {formatCurrency(remaining)}
                            </span>
                        </div>

                        {!readOnly && remaining > 0 && (
                            <button
                                className="btn btn-primary btn-full"
                                onClick={() => setShowPayment(true)}
                            >
                                💳 Ödeme Al
                            </button>
                        )}
                        <button
                            className="btn btn-secondary btn-full"
                            style={{ marginTop: 'var(--space-2)' }}
                            onClick={() => window.open(`/print/ticket/${ticketId}`, '_blank')}
                        >
                            🖨️ Fişi Yazdır / İndir
                        </button>
                    </div>
                </div>
            </div>

            {/* Payment Modal */}
            {showPayment && (
                <div className="modal-overlay" onClick={() => setShowPayment(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">💳 Ödeme Al</h3>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowPayment(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Kalan Tutar</div>
                                <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-danger)' }}>
                                    {formatCurrency(remaining)}
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label required">Ödeme Yöntemi</label>
                                <select className="form-select" value={payMethod} onChange={(e) => { setPayMethod(e.target.value); setPayAccountId(''); }}>
                                    <option value="CASH">Nakit</option>
                                    <option value="BANK_TRANSFER">Havale</option>
                                    <option value="CREDIT_CARD">Kredi Kartı</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Aktarılacak Kasa / Banka Hesabı</label>
                                <select className="form-select" value={payAccountId} onChange={(e) => setPayAccountId(e.target.value)}>
                                    <option value="">— Otomatik (Varsayılan Kasa) —</option>
                                    {accounts
                                        .filter(acc => acc.type === payMethod)
                                        .map(acc => (
                                            <option key={acc.id} value={acc.id}>{acc.name}</option>
                                        ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label required">Tutar (₺)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={payAmount}
                                    onChange={(e) => setPayAmount(e.target.value)}
                                    placeholder="0.00"
                                    step="0.01"
                                    min="0"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Not</label>
                                <textarea
                                    className="form-textarea"
                                    value={payNotes}
                                    onChange={(e) => setPayNotes(e.target.value)}
                                    placeholder="Ödeme notu..."
                                    rows={2}
                                />
                            </div>

                            {payError && (
                                <div style={{
                                    padding: 'var(--space-2)',
                                    background: 'var(--color-danger-bg)',
                                    color: 'var(--color-danger)',
                                    borderRadius: 'var(--radius-md)',
                                    fontSize: 'var(--font-size-sm)',
                                }}>
                                    {payError}
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowPayment(false)}>İptal</button>
                            <button className="btn btn-primary" onClick={handleAddPayment}>Ödemeyi Kaydet</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Audit Log Modal */}
            {showAudit && (
                <div className="modal-overlay" onClick={() => setShowAudit(false)}>
                    <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">📋 Değişiklik Logları</h3>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowAudit(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            {auditLogs.length === 0 ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>Log bulunamadı</p>
                            ) : (
                                <div className="table-container">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Tarih</th>
                                                <th>İşlem</th>
                                                <th>Alan</th>
                                                <th>Eski</th>
                                                <th>Yeni</th>
                                                <th>Kişi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {auditLogs.map((log) => (
                                                <tr key={log.id}>
                                                    <td style={{ fontSize: 'var(--font-size-xs)' }}>{formatDateTime(log.createdAt)}</td>
                                                    <td><span className="badge badge-info">{log.action}</span></td>
                                                    <td>{log.field || '-'}</td>
                                                    <td style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-xs)' }}>{log.oldValue || '-'}</td>
                                                    <td style={{ color: 'var(--color-success)', fontSize: 'var(--font-size-xs)' }}>{log.newValue || '-'}</td>
                                                    <td>{log.changedBy.name}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Service Record Modal */}
            {showServiceForm && (
                <div className="modal-overlay" onClick={() => setShowServiceForm(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">🚗 Servis Talebi Oluştur</h3>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowServiceForm(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Servis Türü</label>
                                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                    <button
                                        type="button"
                                        className={`btn flex-1 ${srvType === 'PICKUP' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setSrvType('PICKUP')}
                                    >
                                        📥 Teslim Alma
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn flex-1 ${srvType === 'DELIVERY' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setSrvType('DELIVERY')}
                                    >
                                        📤 Teslim Etme
                                    </button>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label required">Planlanan Tarih</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={srvDate}
                                    onChange={(e) => setSrvDate(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Atanacak Sürücü / Personel</label>
                                <select
                                    className="form-select"
                                    value={srvPersonnelId}
                                    onChange={(e) => setSrvPersonnelId(e.target.value)}
                                >
                                    <option value="">— Sürücü Seçimi (İsteğe Bağlı) —</option>
                                    {servicePersonnel.map((p) => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Servis Notu</label>
                                <textarea
                                    className="form-textarea"
                                    rows={2}
                                    value={srvNotes}
                                    onChange={(e) => setSrvNotes(e.target.value)}
                                    placeholder="Örn: Zili çalmayın, kapıya bırakın, saat 14:00'ten sonra gelin..."
                                />
                            </div>
                            {srvError && (
                                <div style={{
                                    padding: 'var(--space-2)',
                                    background: 'var(--color-danger-bg)',
                                    color: 'var(--color-danger)',
                                    borderRadius: 'var(--radius-md)',
                                    fontSize: 'var(--font-size-sm)',
                                }}>
                                    {srvError}
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowServiceForm(false)}>İptal</button>
                            <button className="btn btn-primary" onClick={async () => {
                                setSrvError('');
                                if (!srvDate) { setSrvError('Tarih seçiniz'); return; }
                                try {
                                    await createServiceRecord({
                                        ticketId,
                                        type: srvType,
                                        scheduledDate: srvDate,
                                        assignedPersonnelId: srvPersonnelId || undefined,
                                        notes: srvNotes || undefined,
                                    });
                                    setShowServiceForm(false);
                                    setSrvPersonnelId('');
                                    setSrvNotes('');
                                    loadTicket();
                                    alert('Servis talebi oluşturuldu!');
                                } catch (err: any) {
                                    setSrvError(err.message);
                                }
                            }}>Oluştur</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Accessory Modal */}
            {showAccessory && (
                <div className="modal-overlay" onClick={() => setShowAccessory(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">🛍 Aksesuar Satışı Ekle</h3>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowAccessory(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label required">Aksesuar Seçimi</label>
                                <select className="form-select" value={selectedAcs} onChange={(e) => {
                                    setSelectedAcs(e.target.value);
                                    const prod = accessories.find(a => a.id === e.target.value);
                                    if (prod) setAcsPrice(prod.price.toString());
                                }}>
                                    <option value="">— Seçiniz —</option>
                                    {accessories.map(a => (
                                        <option key={a.id} value={a.id}>{a.name} (Stok: {a.stock})</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                <div className="form-group">
                                    <label className="form-label required">Miktar</label>
                                    <input type="number" min="1" className="form-input" value={acsQty} onChange={(e) => setAcsQty(parseInt(e.target.value) || 1)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label required">Birim Satış Fiyatı (₺)</label>
                                    <input type="number" step="0.01" className="form-input" value={acsPrice} onChange={(e) => setAcsPrice(e.target.value)} />
                                </div>
                            </div>
                            {acsError && (
                                <div style={{ padding: 'var(--space-2)', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)' }}>
                                    {acsError}
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowAccessory(false)}>İptal</button>
                            <button className="btn btn-primary" onClick={handleAddAccessory}>Aksesuarı Sat</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Photo Lightbox Modal */}
            {selectedPhoto && (
                <div className="modal-overlay" onClick={() => setSelectedPhoto(null)} style={{ zIndex: 9999 }}>
                    <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', background: 'transparent', boxShadow: 'none' }}>
                        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)' }}>
                            <button
                                className="btn btn-ghost btn-icon"
                                onClick={() => setSelectedPhoto(null)}
                                style={{ position: 'absolute', top: -40, right: 0, color: '#fff', fontSize: '24px' }}
                            >
                                ✕
                            </button>
                            <img
                                src={selectedPhoto.url}
                                alt={selectedPhoto.type}
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '75vh',
                                    borderRadius: 'var(--radius-lg)',
                                    boxShadow: 'var(--shadow-xl)',
                                    objectFit: 'contain'
                                }}
                            />
                            <div style={{
                                background: 'rgba(0,0,0,0.7)',
                                padding: 'var(--space-3) var(--space-6)',
                                borderRadius: 'var(--radius-pill)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-6)',
                                color: '#fff'
                            }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fotoğraf Türü</div>
                                    <div style={{ fontWeight: 600 }}>{selectedPhoto.type}</div>
                                </div>
                                <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.2)' }} />
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Yükleme Tarihi</div>
                                    <div style={{ fontWeight: 600 }}>{formatDate(selectedPhoto.createdAt)}</div>
                                </div>
                                <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.2)' }} />
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => handleDownload(selectedPhoto.url, `ticket-${ticket.ticketNo}-${selectedPhoto.type}.jpg`)}
                                    style={{ padding: 'var(--space-2) var(--space-4)' }}
                                >
                                    📥 İndir
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Operation Price Modal */}
            {showOpModal && selectedOp && (
                <div className="modal-overlay" onClick={() => setShowOpModal(false)} style={{ zIndex: 9999 }}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
                        <div className="modal-header">
                            <h3>➕ Yapılan İşlemi Fiyata Ekle</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowOpModal(false)}>✕</button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                Teknisyenin yaptığı <b>{OPERATION_TYPE_LABELS[selectedOp.operationType as keyof typeof OPERATION_TYPE_LABELS] || selectedOp.operationType}</b> işlemini fişin kalemleri arasına ekleyerek fiyatlandırın. Eklediğiniz bu işlem kalemi müşteri fiş çıktısında da yer alacaktır.
                            </p>
                            {opError && <div className="alert alert-danger" style={{ padding: '8px 12px', fontSize: '12px' }}>{opError}</div>}

                            <div className="form-group">
                                <label className="form-label">İşlem Kalem Başlığı</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={opLabelInput}
                                    onChange={(e) => setOpLabelInput(e.target.value)}
                                    placeholder="Örn: Ekran Değişimi, Kart Onarımı..."
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">İşlem Ücreti (₺)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    className="form-input"
                                    value={opPriceInput}
                                    onChange={(e) => setOpPriceInput(e.target.value)}
                                    placeholder="0.00"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                            <button className="btn btn-secondary" onClick={() => setShowOpModal(false)}>İptal</button>
                            <button className="btn btn-primary" onClick={handleAddOpPrice}>➕ Fişe ve Fiyata Ekle</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
