'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    getServiceRecordById,
    completePickup,
    completeDelivery,
    postponeService,
    cancelService,
    saveTicketPhoto,
    getServiceRecordPhotos,
} from '@/actions/service-records';
import { addContactNote, getContactNotes } from '@/actions/contact-notes';
import { addPayment } from '@/actions/payments';
import { getAccounts } from '@/actions/collections';
import { getProductsByCategory, addAccessoryToTicket } from '@/actions/products';
import { updateTicketDeviceCondition, addRepairItemToTicket } from '@/actions/tickets';
import { compressImage } from '@/lib/image-utils';
import {
    REQUEST_TYPE_LABELS,
    OPERATION_TYPE_LABELS,
    PAYMENT_METHOD_LABELS,
    formatCurrency,
    parseCurrencyInput,
    getLocalDateString,
} from '@/lib/constants';

function formatWhatsAppLink(phone: string) {
    if (!phone) return '#';
    let digits = phone.replace(/\D/g, '');
    if (!digits) return '#';
    if (digits.startsWith('0')) {
        digits = '90' + digits.slice(1);
    } else if (!digits.startsWith('90') && digits.length === 10) {
        digits = '90' + digits;
    }
    return `https://wa.me/${digits}`;
}

export default function ServiceProcessPage() {
    const params = useParams();
    const recordId = (params?.id as string) || '';
    const router = useRouter();

    const [record, setRecord] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    // Notes
    const [contactNotes, setContactNotes] = useState<any[]>([]);
    const [newNoteText, setNewNoteText] = useState('');
    const [isSavingNote, setIsSavingNote] = useState(false);

    // Photos
    const [photos, setPhotos] = useState<{ type: string; base64: string; label: string }[]>([]);
    const [existingPhotos, setExistingPhotos] = useState<any[]>([]);
    const [pendingPhotoType, setPendingPhotoType] = useState<'BROKEN_DEVICE' | 'BARCODE' | 'WORKING_DEVICE' | 'OTHER'>('BROKEN_DEVICE');
    const photoInputRef = useRef<HTMLInputElement>(null);

    // Device Condition
    const [deviceCondition, setDeviceCondition] = useState('');
    const [isEditingCondition, setIsEditingCondition] = useState(false);
    const [isSavingCondition, setIsSavingCondition] = useState(false);

    // Extra Operations Form
    const [showAddOp, setShowAddOp] = useState(false);
    const [newOpType, setNewOpType] = useState('LED_CHANGE');
    const [newOpCustom, setNewOpCustom] = useState('');
    const [newOpPrice, setNewOpPrice] = useState('');
    const [isAddingOp, setIsAddingOp] = useState(false);

    // Accessory Sale
    const [addAccessory, setAddAccessory] = useState(false);
    const [accessoriesList, setAccessoriesList] = useState<any[]>([]);
    const [selectedAccId, setSelectedAccId] = useState('');
    const [accQty, setAccQty] = useState('1');
    const [accPrice, setAccPrice] = useState('');

    // Payment (Delivery)
    const [accounts, setAccounts] = useState<any[]>([]);
    const [paymentsList, setPaymentsList] = useState<{ amount: number; method: string; accountId?: string; notes?: string }[]>([]);
    const [payAmount, setPayAmount] = useState('');
    const [payMethod, setPayMethod] = useState('CASH');
    const [payAccountId, setPayAccountId] = useState('');
    const [payNotes, setPayNotes] = useState('');

    // Postpone & Cancel Forms
    const [showPostponeBox, setShowPostponeBox] = useState(false);
    const [postponeDate, setPostponeDate] = useState('');
    const [postponeReason, setPostponeReason] = useState('');
    const [isPostponing, setIsPostponing] = useState(false);

    const [showCancelBox, setShowCancelBox] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [isCancelling, setIsCancelling] = useState(false);

    // Completion
    const [completionNotes, setCompletionNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState('');

    const loadData = async () => {
        if (!recordId) return;
        setLoading(true);
        try {
            const [rec, accs, prods, existingPh] = await Promise.all([
                getServiceRecordById(recordId),
                getAccounts(),
                getProductsByCategory('ACCESSORY'),
                getServiceRecordPhotos(recordId),
            ]);

            if (!rec) {
                alert('Servis kaydı bulunamadı.');
                router.push('/service');
                return;
            }

            setRecord(rec);
            setAccounts(accs || []);
            setAccessoriesList(prods || []);
            setExistingPhotos(existingPh || []);
            setDeviceCondition((rec.ticket as any)?.deviceCondition || '');

            const initialNotes = (rec.ticket as any)?.customer?.notes || (rec.ticket as any)?.repairer?.notes || [];
            setContactNotes(initialNotes);

            // Default remaining payment
            if (rec.type === 'DELIVERY') {
                const ticket = rec.ticket as any;
                const rem = Math.max(0, Number(ticket?.totalAmount || 0) - Number(ticket?.paidAmount || 0));
                setPayAmount(rem > 0 ? rem.toString() : '');
                const defaultCash = (accs || []).filter((a: any) => a.type === 'CASH');
                if (defaultCash.length === 1) {
                    setPayAccountId(defaultCash[0].id);
                }
            }
        } catch (err: any) {
            console.error('Service process load error:', err);
            setFormError('İşlem bilgileri yüklenemedi: ' + (err.message || 'Bilinmeyen hata'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [recordId]);

    // Financial calculations
    const ticket = record?.ticket as any;
    const isPickup = record?.type === 'PICKUP';
    const isDelivery = record?.type === 'DELIVERY';

    const getNewAccessoryTotal = () => {
        if (!addAccessory || !selectedAccId) return 0;
        return (Number(accQty) || 1) * (Number(accPrice) || 0);
    };

    const getGrandTotal = () => {
        if (!ticket) return 0;
        return Number(ticket.totalAmount || 0) + getNewAccessoryTotal();
    };

    const getPaidAmount = () => {
        if (!ticket) return 0;
        return Number(ticket.paidAmount || 0);
    };

    const getRemaining = () => {
        return Math.max(0, getGrandTotal() - getPaidAmount());
    };

    const listPaymentSum = paymentsList.reduce((sum, p) => sum + p.amount, 0);
    const currentEnteredPayment = paymentsList.length === 0 ? (parseCurrencyInput(payAmount) || 0) : 0;
    const totalCollected = listPaymentSum + currentEnteredPayment;
    const remainingToCollect = Math.max(0, getRemaining() - totalCollected);

    // Photo Capture
    const triggerPhotoSelect = (type: 'BROKEN_DEVICE' | 'BARCODE' | 'WORKING_DEVICE' | 'OTHER') => {
        setPendingPhotoType(type);
        if (photoInputRef.current) {
            photoInputRef.current.value = '';
            photoInputRef.current.click();
        }
    };

    const handleFileCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const PHOTO_LABELS: Record<string, string> = {
            BROKEN_DEVICE: '📸 Arızalı Cihaz',
            BARCODE: '🔖 Barkod',
            WORKING_DEVICE: '✅ Çalışır Hali',
            OTHER: '📷 Diğer Foto',
        };

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const compressedBase64 = await compressImage(file, 1280, 1280, 0.7);
                setPhotos(prev => [
                    ...prev,
                    {
                        type: pendingPhotoType,
                        base64: compressedBase64,
                        label: PHOTO_LABELS[pendingPhotoType] || 'Fotoğraf',
                    },
                ]);
            }
        } catch (err: any) {
            alert('Fotoğraf işlenirken hata: ' + err.message);
        }
        e.target.value = '';
    };

    const requiredPhotos = isPickup ? 2 : 1;
    const totalPhotoCount = existingPhotos.length + photos.length;
    const isPhotoSatisfied = totalPhotoCount >= requiredPhotos;

    // Contact Note Add
    const handleAddNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newNoteText.trim()) return;

        const contact = ticket?.customer || ticket?.repairer;
        const contactType = ticket?.customer ? 'CUSTOMER' : 'REPAIRER';
        if (!contact?.id) return;

        setIsSavingNote(true);
        try {
            await addContactNote(contact.id, contactType, newNoteText.trim());
            setNewNoteText('');
            const updatedNotes = await getContactNotes(contact.id, contactType);
            setContactNotes(updatedNotes || []);
        } catch (err: any) {
            alert('Not eklenirken hata: ' + err.message);
        } finally {
            setIsSavingNote(false);
        }
    };

    // Device Condition Save
    const handleSaveCondition = async () => {
        if (!ticket?.id) return;
        setIsSavingCondition(true);
        try {
            await updateTicketDeviceCondition(ticket.id, deviceCondition);
            setIsEditingCondition(false);
        } catch (err: any) {
            alert('Cihaz durumu güncellenemedi: ' + err.message);
        } finally {
            setIsSavingCondition(false);
        }
    };

    // Postpone Action
    const handlePostpone = async () => {
        if (!postponeDate) {
            alert('Lütfen erteleme tarihi seçin.');
            return;
        }
        setIsPostponing(true);
        try {
            await postponeService(recordId, postponeDate, postponeReason.trim() || undefined);
            alert('Servis başarıyla ertelendi.');
            router.push('/service');
        } catch (err: any) {
            alert('Erteleme hatası: ' + err.message);
        } finally {
            setIsPostponing(false);
        }
    };

    // Cancel Action
    const handleCancel = async () => {
        if (!cancelReason.trim()) {
            alert('Lütfen iptal sebebi belirtin.');
            return;
        }
        if (!confirm('Bu servisi iptal etmek istediğinize emin misiniz?')) return;
        setIsCancelling(true);
        try {
            await cancelService(recordId, cancelReason.trim());
            alert('Servis kaydı iptal edildi.');
            router.push('/service');
        } catch (err: any) {
            alert('İptal hatası: ' + err.message);
        } finally {
            setIsCancelling(false);
        }
    };

    // Complete Service Action
    const handleComplete = async () => {
        setFormError('');

        if (!isPhotoSatisfied) {
            setFormError(`Zorunlu fotoğraf sayısı eksik! En az ${requiredPhotos} fotoğraf eklenmelidir.`);
            window.scrollTo({ top: 300, behavior: 'smooth' });
            return;
        }

        if (isDelivery) {
            if (Math.abs(totalCollected - getRemaining()) > 0.01) {
                setFormError(`Alınan toplam ödeme tutarı (${formatCurrency(totalCollected)}) kalan borca (${formatCurrency(getRemaining())}) tam eşit olmalıdır.`);
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const ticketId = ticket.id;

            // Save device condition if changed
            if (deviceCondition !== (ticket.deviceCondition || '')) {
                await updateTicketDeviceCondition(ticketId, deviceCondition);
            }

            // Save photos
            for (const p of photos) {
                await saveTicketPhoto({
                    ticketId,
                    serviceRecordId: recordId,
                    type: p.type as any,
                    base64: p.base64,
                });
            }

            // Save payments for delivery
            if (isDelivery) {
                const finalPayments = [...paymentsList];
                if (paymentsList.length === 0 && payAmount !== '') {
                    const amt = parseCurrencyInput(payAmount);
                    if (amt > 0) {
                        if ((payMethod === 'BANK_TRANSFER' || payMethod === 'CREDIT_CARD') && !payAccountId) {
                            throw new Error('Lütfen ödemenin aktarılacağı banka/POS hesabını seçiniz.');
                        }
                        finalPayments.push({
                            amount: amt,
                            method: payMethod,
                            accountId: payAccountId || undefined,
                            notes: payNotes || undefined,
                        });
                    }
                }
                for (const p of finalPayments) {
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

            // Save accessory
            if (addAccessory && selectedAccId) {
                await addAccessoryToTicket({
                    ticketId,
                    productId: selectedAccId,
                    quantity: Number(accQty) || 1,
                    unitPrice: Number(accPrice) || 0,
                });
            }

            // Complete service
            if (isPickup) {
                await completePickup(recordId, completionNotes || undefined);
            } else if (isDelivery) {
                await completeDelivery(recordId, completionNotes || undefined);
            }

            alert(isPickup ? '✅ Cihaz başarıyla teslim alındı!' : '✅ Cihaz başarıyla teslim edildi!');
            router.push('/service');
        } catch (err: any) {
            setFormError(err.message || 'Bir hata oluştu.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div style={{ maxWidth: '680px', margin: '0 auto', padding: '12px 14px calc(140px + env(safe-area-inset-bottom, 0px)) 14px' }}>
                {/* Top Bar Skeleton */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid var(--border-primary)' }}>
                    <div className="skeleton-pulse" style={{ width: '100px', height: '32px', borderRadius: '8px' }} />
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <div className="skeleton-pulse" style={{ width: '110px', height: '26px', borderRadius: '20px' }} />
                        <div className="skeleton-pulse" style={{ width: '70px', height: '26px', borderRadius: '6px' }} />
                    </div>
                </div>

                {/* Customer Card Skeleton */}
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <div>
                            <div className="skeleton-pulse" style={{ width: '150px', height: '20px', borderRadius: '6px', marginBottom: '6px' }} />
                            <div className="skeleton-pulse" style={{ width: '110px', height: '14px', borderRadius: '4px' }} />
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <div className="skeleton-pulse" style={{ width: '60px', height: '30px', borderRadius: '6px' }} />
                            <div className="skeleton-pulse" style={{ width: '50px', height: '30px', borderRadius: '6px' }} />
                        </div>
                    </div>
                    <div className="skeleton-pulse" style={{ width: '100%', height: '14px', borderRadius: '4px', marginBottom: '8px' }} />
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <div className="skeleton-pulse" style={{ flex: 1, height: '28px', borderRadius: '6px' }} />
                        <div className="skeleton-pulse" style={{ flex: 1, height: '28px', borderRadius: '6px' }} />
                    </div>
                </div>

                {/* Notes Card Skeleton */}
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
                    <div className="skeleton-pulse" style={{ width: '160px', height: '18px', borderRadius: '4px', marginBottom: '10px' }} />
                    <div className="skeleton-pulse" style={{ width: '100%', height: '48px', borderRadius: '8px', marginBottom: '8px' }} />
                    <div className="skeleton-pulse" style={{ width: '100%', height: '34px', borderRadius: '6px' }} />
                </div>

                {/* Device Card Skeleton */}
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <div className="skeleton-pulse" style={{ width: '140px', height: '18px', borderRadius: '4px' }} />
                        <div className="skeleton-pulse" style={{ width: '80px', height: '20px', borderRadius: '10px' }} />
                    </div>
                    <div className="skeleton-pulse" style={{ width: '100%', height: '40px', borderRadius: '8px' }} />
                </div>

                {/* Financial Card Skeleton */}
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
                    <div className="skeleton-pulse" style={{ width: '130px', height: '18px', borderRadius: '4px', marginBottom: '10px' }} />
                    <div className="skeleton-pulse" style={{ width: '100%', height: '16px', borderRadius: '4px', marginBottom: '6px' }} />
                    <div className="skeleton-pulse" style={{ width: '100%', height: '16px', borderRadius: '4px', marginBottom: '6px' }} />
                    <div className="skeleton-pulse" style={{ width: '100%', height: '24px', borderRadius: '6px' }} />
                </div>

                {/* Photo Capture Skeleton */}
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
                    <div className="skeleton-pulse" style={{ width: '150px', height: '18px', borderRadius: '4px', marginBottom: '10px' }} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                        <div className="skeleton-pulse" style={{ height: '60px', borderRadius: '8px' }} />
                        <div className="skeleton-pulse" style={{ height: '60px', borderRadius: '8px' }} />
                    </div>
                </div>
            </div>
        );
    }

    if (!record) return null;

    const contact = ticket?.customer || ticket?.repairer;
    const isCustomer = !!ticket?.customer;
    const address = contact?.address || '';
    const phone = contact?.phone || '';
    const mapsQuery = encodeURIComponent(address);

    return (
        <div style={{ maxWidth: '680px', margin: '0 auto', padding: '12px 14px calc(140px + env(safe-area-inset-bottom, 0px)) 14px' }}>
            {/* Top Navigation Bar */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '14px',
                    paddingBottom: '10px',
                    borderBottom: '1px solid var(--border-primary)',
                }}
            >
                <Link
                    href="/service"
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '6px 12px' }}
                >
                    ← İşlerime Dön
                </Link>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                        style={{
                            padding: '4px 10px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: 700,
                            background: isPickup ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                            color: isPickup ? '#2563eb' : '#059669',
                            border: `1px solid ${isPickup ? 'rgba(59, 130, 246, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                        }}
                    >
                        {isPickup ? '📥 Teslim Alınacak' : '📤 Teslim Edilecek'}
                    </span>
                    <span
                        style={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            fontSize: '12px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-primary)',
                        }}
                    >
                        {ticket?.ticketNo}
                    </span>
                </div>
            </div>

            {/* Error Banner */}
            {formError && (
                <div
                    style={{
                        padding: '12px 14px',
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '10px',
                        color: 'var(--color-danger)',
                        fontWeight: 600,
                        fontSize: '13px',
                        marginBottom: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                    }}
                >
                    <span>⚠️</span>
                    <span>{formError}</span>
                </div>
            )}

            {/* 1. Customer & Location Card */}
            <div
                style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '12px',
                    padding: '14px',
                    marginBottom: '14px',
                    boxShadow: 'var(--shadow-sm)',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                                {contact?.name || 'Müşteri Bilgisi Yok'}
                            </h2>
                            <span
                                style={{
                                    fontSize: '9.5px',
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    fontWeight: 600,
                                    background: isCustomer ? 'rgba(59, 130, 246, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                                    color: isCustomer ? 'var(--brand-primary)' : '#d97706',
                                    border: `1px solid ${isCustomer ? 'rgba(59, 130, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
                                    lineHeight: '14px',
                                }}
                            >
                                {isCustomer ? 'Müşteri' : 'Tamirci'}
                            </span>
                        </div>
                        {phone && (
                            <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '2px', fontWeight: 500 }}>
                                📞 {phone}
                            </div>
                        )}
                    </div>

                    {/* Quick Call & WhatsApp Buttons */}
                    {phone && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <a
                                href={`tel:${phone}`}
                                className="btn btn-primary btn-sm"
                                style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                                📞 Ara
                            </a>
                            <a
                                href={formatWhatsAppLink(phone)}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '6px 10px', fontSize: '12px', background: '#25D366', color: '#fff', borderColor: '#25D366' }}
                            >
                                💬 WP
                            </a>
                        </div>
                    )}
                </div>

                {/* Address & Navigation */}
                {address && (
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-primary)' }}>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '8px' }}>
                            📍 {address}
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <a
                                href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-secondary btn-xs"
                                style={{ flex: 1, textAlign: 'center', fontSize: '11px', padding: '5px' }}
                            >
                                🗺️ Google Haritalar
                            </a>
                            <a
                                href={`https://yandex.com/maps/?text=${mapsQuery}`}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-secondary btn-xs"
                                style={{ flex: 1, textAlign: 'center', fontSize: '11px', padding: '5px' }}
                            >
                                📍 Yandex Haritalar
                            </a>
                        </div>
                    </div>
                )}
            </div>

            {/* 2. Customer & Service Notes Section (Enhanced & Interactive) */}
            <div
                style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '12px',
                    padding: '14px',
                    marginBottom: '14px',
                    boxShadow: 'var(--shadow-sm)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '16px' }}>📝</span>
                        <h3 style={{ fontSize: '14.5px', fontWeight: 700, margin: 0 }}>Müşteri & Servis Notları</h3>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                        {contactNotes.length} Not Kayıtlı
                    </span>
                </div>

                {/* Ticket Opening Note */}
                {ticket?.notes && (
                    <div
                        style={{
                            padding: '10px 12px',
                            background: 'rgba(59, 130, 246, 0.08)',
                            border: '1px solid rgba(59, 130, 246, 0.25)',
                            borderRadius: '8px',
                            marginBottom: '8px',
                        }}
                    >
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--brand-primary)', marginBottom: '2px' }}>
                            📌 Fiş Açılış Notu:
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                            {ticket.notes}
                        </div>
                    </div>
                )}

                {/* Service Order Specific Note */}
                {record.notes && (
                    <div
                        style={{
                            padding: '10px 12px',
                            background: 'rgba(245, 158, 11, 0.08)',
                            border: '1px solid rgba(245, 158, 11, 0.25)',
                            borderRadius: '8px',
                            marginBottom: '8px',
                        }}
                    >
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#d97706', marginBottom: '2px' }}>
                            🚐 Servis Planlama Notu:
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                            {record.notes}
                        </div>
                    </div>
                )}

                {/* Past Customer Notes List */}
                <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                    {contactNotes.length === 0 && !ticket?.notes && !record.notes ? (
                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontStyle: 'italic', padding: '6px 0' }}>
                            Bu müşteriye ait henüz bir geçmiş not kaydedilmemiş.
                        </div>
                    ) : (
                        contactNotes.map((n) => (
                            <div
                                key={n.id}
                                style={{
                                    padding: '8px 10px',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-primary)',
                                    fontSize: '12px',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-tertiary)', fontSize: '10.5px', marginBottom: '2px' }}>
                                    <span>👤 {n.personnel?.name || 'Personel'}</span>
                                    <span>{new Date(n.createdAt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <div style={{ color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'pre-wrap' }}>
                                    {n.content}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Add New Note Inline */}
                <form onSubmit={handleAddNote} style={{ display: 'flex', gap: '6px' }}>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Müşteriye yeni not ekle (örn: Kapı kodu, zil arızalı)..."
                        value={newNoteText}
                        onChange={(e) => setNewNoteText(e.target.value)}
                        style={{ flex: 1, fontSize: '12px', padding: '6px 10px', height: '34px' }}
                    />
                    <button
                        type="submit"
                        className="btn btn-secondary btn-sm"
                        disabled={isSavingNote || !newNoteText.trim()}
                        style={{ fontSize: '12px', padding: '0 12px', height: '34px', whiteSpace: 'nowrap' }}
                    >
                        {isSavingNote ? '...' : '➕ Not Ekle'}
                    </button>
                </form>
            </div>

            {/* 3. Device & Condition Card */}
            <div
                style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '12px',
                    padding: '14px',
                    marginBottom: '14px',
                    boxShadow: 'var(--shadow-sm)',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>Cihaz Bilgisi</div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {ticket?.brand?.name} {ticket?.model}
                        </div>
                    </div>
                    <span className="badge badge-info" style={{ fontSize: '11px' }}>
                        {REQUEST_TYPE_LABELS[ticket?.requestType as keyof typeof REQUEST_TYPE_LABELS] || ticket?.requestType || 'Tamir'}
                    </span>
                </div>

                {/* Device Condition & Damage Box */}
                <div
                    style={{
                        padding: '10px 12px',
                        background: 'rgba(245, 158, 11, 0.08)',
                        border: '1px solid rgba(245, 158, 11, 0.25)',
                        borderRadius: '8px',
                        marginTop: '10px',
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '11.5px', color: '#d97706', fontWeight: 700 }}>
                            🔍 Cihaz Durumu / Hasar Kaydı
                        </span>
                        {!isEditingCondition ? (
                            <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                onClick={() => setIsEditingCondition(true)}
                                style={{ fontSize: '11px', color: '#d97706', padding: '2px 6px' }}
                            >
                                ✏️ {deviceCondition ? 'Düzenle' : 'Not Ekle'}
                            </button>
                        ) : (
                            <button
                                type="button"
                                className="btn btn-primary btn-xs"
                                onClick={handleSaveCondition}
                                disabled={isSavingCondition}
                                style={{ fontSize: '11px', padding: '2px 8px', background: '#d97706', borderColor: '#d97706' }}
                            >
                                {isSavingCondition ? 'Kaydediliyor...' : '💾 Kaydet'}
                            </button>
                        )}
                    </div>

                    {isEditingCondition ? (
                        <textarea
                            className="form-textarea"
                            value={deviceCondition}
                            onChange={(e) => setDeviceCondition(e.target.value)}
                            placeholder="Örn: Arka kapak çizik, ekran sağ alt köşede çatlak, stand ayağı eksik..."
                            rows={2}
                            style={{ fontSize: '12px', padding: '6px', width: '100%', marginTop: '4px' }}
                            autoFocus
                        />
                    ) : (
                        <div style={{ fontSize: '12.5px', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.4 }}>
                            {deviceCondition || (
                                <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                                    Hasar veya kozmetik durum notu girilmedi.
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* 4. Financial & Extra Repair Item */}
            <div
                style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '12px',
                    padding: '14px',
                    marginBottom: '14px',
                    boxShadow: 'var(--shadow-sm)',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '14.5px', fontWeight: 700, margin: 0 }}>💰 Ücret & İşlemler</h3>
                    <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() => setShowAddOp(prev => !prev)}
                        style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: 'var(--brand-primary)',
                            border: '1px solid var(--brand-primary)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                        }}
                    >
                        ➕ Fişe İşlem Ekle
                    </button>
                </div>

                {/* Form to Add Extra Repair Item */}
                {showAddOp && (
                    <div
                        style={{
                            padding: '10px',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--brand-primary)',
                            borderRadius: '8px',
                            marginBottom: '10px',
                        }}
                    >
                        <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--brand-primary)' }}>
                            ➕ Fişe Ekstra Onarım / İşlem Ekle
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <select
                                    className="form-select"
                                    value={newOpType}
                                    onChange={(e) => setNewOpType(e.target.value)}
                                    style={{ flex: 1, fontSize: '12px', height: '32px' }}
                                >
                                    <option value="LED_CHANGE">LED Değişimi</option>
                                    <option value="LGP_REPAIR">LGP Değişimi</option>
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
                                    style={{ width: '90px', fontSize: '12px', height: '32px' }}
                                />
                            </div>
                            {newOpType === 'OTHER' && (
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="İşlem Açıklaması..."
                                    value={newOpCustom}
                                    onChange={(e) => setNewOpCustom(e.target.value)}
                                    style={{ fontSize: '12px', height: '32px' }}
                                />
                            )}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-xs"
                                    onClick={() => setShowAddOp(false)}
                                    style={{ fontSize: '11px', padding: '3px 8px' }}
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
                                            const finalType = newOpType === 'OTHER' ? (newOpCustom.trim() || 'Özel İşlem') : newOpType;
                                            const updated = await addRepairItemToTicket(ticket.id, finalType, Number(newOpPrice));
                                            setRecord((prev: any) => ({
                                                ...prev,
                                                ticket: {
                                                    ...prev.ticket,
                                                    repairItems: updated.repairItems,
                                                    repairPrice: Number(updated.repairPrice),
                                                    totalAmount: Number(updated.totalAmount),
                                                },
                                            }));
                                            setShowAddOp(false);
                                            setNewOpPrice('');
                                            setNewOpCustom('');
                                        } catch (err: any) {
                                            alert(err.message);
                                        } finally {
                                            setIsAddingOp(false);
                                        }
                                    }}
                                    style={{ fontSize: '11px', padding: '3px 10px' }}
                                >
                                    {isAddingOp ? 'Ekleniyor...' : '💾 Kaydet'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Financial Breakdown Table */}
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    {(() => {
                        const rawItems = ticket?.repairItems;
                        const parsed: any[] = rawItems
                            ? (typeof rawItems === 'string'
                                ? (() => { try { return JSON.parse(rawItems); } catch { return []; } })()
                                : Array.isArray(rawItems) ? rawItems : [])
                            : [];

                        if (parsed.length > 0) {
                            return parsed.map((item: any, idx: number) => {
                                const itemLabel = item.type
                                    ? (OPERATION_TYPE_LABELS[item.type as keyof typeof OPERATION_TYPE_LABELS] || REQUEST_TYPE_LABELS[item.type as keyof typeof REQUEST_TYPE_LABELS] || item.type)
                                    : 'Tamir İşlemi';
                                return (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                                        <span>{itemLabel}</span>
                                        <span style={{ fontWeight: 600 }}>{formatCurrency(Number(item.price || 0))}</span>
                                    </div>
                                );
                            });
                        }

                        return (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                                <span>{REQUEST_TYPE_LABELS[ticket?.requestType as keyof typeof REQUEST_TYPE_LABELS] || 'Tamir Ücreti'}</span>
                                <span style={{ fontWeight: 600 }}>{formatCurrency(Number(ticket?.repairPrice || 0))}</span>
                            </div>
                        );
                    })()}

                    {/* Accessories */}
                    {(ticket?.accessories || []).map((acc: any) => (
                        <div key={acc.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', color: 'var(--text-secondary)' }}>
                            <span>🛍️ {acc.product?.name || 'Aksesuar'} (x{acc.quantity})</span>
                            <span style={{ fontWeight: 600 }}>{formatCurrency(Number(acc.unitPrice) * acc.quantity)}</span>
                        </div>
                    ))}

                    {/* New Accessory if selected */}
                    {getNewAccessoryTotal() > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--brand-primary)', fontWeight: 600, marginBottom: '3px' }}>
                            <span>+ Yeni Satış ({accQty}x):</span>
                            <span>{formatCurrency(getNewAccessoryTotal())}</span>
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid var(--border-primary)', fontWeight: 700, color: 'var(--text-primary)' }}>
                        <span>Toplam Tutar:</span>
                        <span>{formatCurrency(getGrandTotal())}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                        <span>Önceden Tahsil Edilen:</span>
                        <span>- {formatCurrency(getPaidAmount())}</span>
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: '6px',
                            paddingTop: '6px',
                            borderTop: '1px solid var(--border-primary)',
                            fontWeight: 800,
                            color: getRemaining() > 0 ? 'var(--color-danger)' : 'var(--color-success)',
                            fontSize: '14.5px',
                        }}
                    >
                        <span>Kalan Ödeme Tutarı:</span>
                        <span>{formatCurrency(getRemaining())}</span>
                    </div>
                </div>
            </div>

            {/* 5. Photo Capture Section (Mandatory Requirement) */}
            <div
                style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '12px',
                    padding: '14px',
                    marginBottom: '14px',
                    boxShadow: 'var(--shadow-sm)',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '16px' }}>📷</span>
                        <h3 style={{ fontSize: '14.5px', fontWeight: 700, margin: 0 }}>
                            Fotoğraf Çek / Yükle <span style={{ color: 'var(--color-danger)' }}>*</span>
                        </h3>
                    </div>
                    <span
                        style={{
                            fontSize: '11.5px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '10px',
                            background: isPhotoSatisfied ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: isPhotoSatisfied ? '#059669' : '#dc2626',
                        }}
                    >
                        {totalPhotoCount} / {requiredPhotos} Adet (Zorunlu)
                    </span>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '10px' }}>
                    {isPickup
                        ? 'Cihazı teslim alırken en az 2 fotoğraf (Arızalı Cihaz + Barkod) çekmelisiniz.'
                        : 'Cihazı teslim ederken en az 1 fotoğraf (Çalışır Hali) çekmelisiniz.'}
                </div>

                {/* Hidden File Input */}
                <input ref={photoInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFileCapture} />

                {/* Big Touch-Friendly Photo Buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '12px' }}>
                    {isPickup ? (
                        <>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => triggerPhotoSelect('BROKEN_DEVICE')}
                                style={{ padding: '10px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                            >
                                <span style={{ fontSize: '20px' }}>📸</span>
                                <span style={{ fontWeight: 600 }}>Arızalı Cihaz</span>
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => triggerPhotoSelect('BARCODE')}
                                style={{ padding: '10px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                            >
                                <span style={{ fontSize: '20px' }}>🔖</span>
                                <span style={{ fontWeight: 600 }}>Barkod / Etiket</span>
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => triggerPhotoSelect('WORKING_DEVICE')}
                            style={{ padding: '10px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                        >
                            <span style={{ fontSize: '20px' }}>✅</span>
                            <span style={{ fontWeight: 600 }}>Çalışır Hali</span>
                        </button>
                    )}
                    <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => triggerPhotoSelect('OTHER')}
                        style={{ padding: '10px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', fontSize: '12px', border: '1px dashed var(--border-primary)' }}
                    >
                        <span style={{ fontSize: '20px' }}>➕</span>
                        <span style={{ fontWeight: 600 }}>Ek Fotoğraf</span>
                    </button>
                </div>

                {/* Photo Previews */}
                {(photos.length > 0 || existingPhotos.length > 0) && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingTop: '8px', borderTop: '1px solid var(--border-primary)' }}>
                        {/* New Photos */}
                        {photos.map((p, idx) => (
                            <div key={idx} style={{ position: 'relative', width: '70px', height: '70px' }}>
                                <img
                                    src={p.base64}
                                    alt={p.label}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--brand-primary)' }}
                                />
                                <span
                                    style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        left: 0,
                                        right: 0,
                                        background: 'rgba(0,0,0,0.7)',
                                        color: '#fff',
                                        fontSize: '9px',
                                        padding: '2px',
                                        textAlign: 'center',
                                        borderBottomLeftRadius: '8px',
                                        borderBottomRightRadius: '8px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {p.label}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setPhotos(prev => prev.filter((_, i) => i !== idx))}
                                    style={{
                                        position: 'absolute',
                                        top: '-5px',
                                        right: '-5px',
                                        background: '#dc2626',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '50%',
                                        width: '18px',
                                        height: '18px',
                                        fontSize: '10px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                        ))}

                        {/* Previously Uploaded Photos */}
                        {existingPhotos.map((p: any) => (
                            <div key={p.id} style={{ position: 'relative', width: '70px', height: '70px' }}>
                                <img
                                    src={p.url || p.base64}
                                    alt="Yüklü Foto"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border-primary)', opacity: 0.8 }}
                                />
                                <span
                                    style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        left: 0,
                                        right: 0,
                                        background: 'rgba(0,0,0,0.6)',
                                        color: '#fff',
                                        fontSize: '9px',
                                        padding: '2px',
                                        textAlign: 'center',
                                        borderBottomLeftRadius: '8px',
                                        borderBottomRightRadius: '8px',
                                    }}
                                >
                                    Kayıtlı Foto
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 6. Accessory Sale (Optional) */}
            <div
                style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '12px',
                    padding: '14px',
                    marginBottom: '14px',
                    boxShadow: 'var(--shadow-sm)',
                }}
            >
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                    <input
                        type="checkbox"
                        checked={addAccessory}
                        onChange={(e) => setAddAccessory(e.target.checked)}
                        style={{ width: '18px', height: '18px' }}
                    />
                    <span style={{ fontSize: '14px', fontWeight: 700 }}>🛍️ Müşteriye Aksesuar Satışı Yap</span>
                </label>

                {addAccessory && (
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <select
                            className="form-select"
                            value={selectedAccId}
                            onChange={(e) => {
                                const id = e.target.value;
                                setSelectedAccId(id);
                                const found = accessoriesList.find(a => a.id === id);
                                if (found) {
                                    setAccPrice(String(found.price || 0));
                                    setAccQty('1');
                                }
                            }}
                            style={{ fontSize: '13px', height: '36px' }}
                        >
                            <option value="">-- Aksesuar Seçin --</option>
                            {accessoriesList.map(a => (
                                <option key={a.id} value={a.id}>
                                    {a.name} (Stok: {a.stock}) - {formatCurrency(Number(a.price || 0))}
                                </option>
                            ))}
                        </select>

                        {selectedAccId && (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <div style={{ width: '90px' }}>
                                    <label style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Adet</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={accQty}
                                        onChange={(e) => setAccQty(e.target.value)}
                                        min="1"
                                        style={{ fontSize: '13px', height: '36px' }}
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Birim Fiyat ₺</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={accPrice}
                                        onChange={(e) => setAccPrice(e.target.value)}
                                        min="0"
                                        style={{ fontSize: '13px', height: '36px' }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 7. Payment Collection (For Delivery) */}
            {isDelivery && (
                <div
                    style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-primary)',
                        borderLeft: '4px solid var(--brand-primary)',
                        borderRadius: '12px',
                        padding: '14px',
                        marginBottom: '14px',
                        boxShadow: 'var(--shadow-sm)',
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '16px' }}>💰</span>
                            <h3 style={{ fontSize: '14.5px', fontWeight: 700, margin: 0 }}>Ödeme Tahsilatı</h3>
                        </div>
                        {remainingToCollect > 0 && (
                            <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                onClick={() => setPayAmount(remainingToCollect.toString())}
                                style={{ fontSize: '11px', color: 'var(--brand-primary)', fontWeight: 700 }}
                            >
                                ⚡ Kalanı Yaz ({formatCurrency(remainingToCollect)})
                            </button>
                        )}
                    </div>

                    {/* Added Payments List */}
                    {paymentsList.map((p, idx) => (
                        <div
                            key={idx}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: 'var(--bg-primary)',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                marginBottom: '6px',
                                fontSize: '12.5px',
                            }}
                        >
                            <div>
                                <span style={{ fontWeight: 700 }}>{formatCurrency(p.amount)}</span>
                                <span style={{ color: 'var(--text-tertiary)', marginLeft: '6px', fontSize: '11px' }}>
                                    ({PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS] || p.method})
                                </span>
                            </div>
                            <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                style={{ color: 'var(--color-danger)', padding: '2px 6px' }}
                                onClick={() => setPaymentsList(prev => prev.filter((_, i) => i !== idx))}
                            >
                                ✕ Sil
                            </button>
                        </div>
                    ))}

                    {/* Add Payment Input Row */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                        <input
                            type="text"
                            inputMode="decimal"
                            className="form-input"
                            placeholder="Tutar ₺"
                            value={payAmount}
                            onChange={(e) => setPayAmount(e.target.value)}
                            style={{ flex: 1, minWidth: '90px', fontSize: '13px', height: '36px' }}
                        />
                        <select
                            className="form-select"
                            value={payMethod}
                            onChange={(e) => {
                                const m = e.target.value;
                                setPayMethod(m);
                                const match = accounts.filter(a => a.type === m);
                                setPayAccountId(match.length === 1 ? match[0].id : '');
                            }}
                            style={{ width: '120px', fontSize: '12.5px', height: '36px' }}
                        >
                            {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                            ))}
                        </select>
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                                const parsed = parseCurrencyInput(payAmount);
                                if (!parsed || parsed <= 0) return;
                                if ((payMethod === 'BANK_TRANSFER' || payMethod === 'CREDIT_CARD') && !payAccountId) {
                                    alert('Lütfen hedef kasa/banka/POS hesabını seçiniz.');
                                    return;
                                }
                                setPaymentsList(prev => [
                                    ...prev,
                                    {
                                        amount: parsed,
                                        method: payMethod,
                                        accountId: payAccountId || undefined,
                                        notes: payNotes || undefined,
                                    },
                                ]);
                                setPayAmount('');
                                setPayNotes('');
                                const match = accounts.filter(a => a.type === payMethod);
                                setPayAccountId(match.length === 1 ? match[0].id : '');
                            }}
                            style={{ fontSize: '12px', padding: '0 12px', height: '36px' }}
                        >
                            ➕ Ekle
                        </button>
                    </div>

                    {/* Account Selector for Bank / Card */}
                    {(payMethod === 'BANK_TRANSFER' || payMethod === 'CREDIT_CARD') && (
                        <div style={{ marginTop: '8px' }}>
                            <select
                                className="form-select"
                                value={payAccountId}
                                onChange={(e) => setPayAccountId(e.target.value)}
                                style={{ fontSize: '12.5px', height: '36px', width: '100%' }}
                            >
                                {accounts.filter(a => a.type === payMethod).length !== 1 && (
                                    <option value="">-- Hedef Banka / POS Hesabı Seçin (Zorunlu) --</option>
                                )}
                                {accounts
                                    .filter(a => a.type === payMethod)
                                    .map(a => (
                                        <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
                                    ))}
                            </select>
                        </div>
                    )}
                </div>
            )}

            {/* 8. Process Completion Note */}
            <div
                style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '12px',
                    padding: '14px',
                    marginBottom: '14px',
                    boxShadow: 'var(--shadow-sm)',
                }}
            >
                <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
                    📋 İşlem / Teslimat Notu (Opsiyonel)
                </div>
                <textarea
                    className="form-textarea"
                    placeholder="Örn: Cihaz kontrol edilerek teslim alındı / Test edilerek müşteriye çalışır vaziyette verildi..."
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    rows={2}
                    style={{ fontSize: '12.5px', padding: '8px 10px', width: '100%' }}
                />
            </div>

            {/* 9. Ertele & İptal (Hızlı Aksiyonlar) */}
            <div
                style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '12px',
                    padding: '14px',
                    marginBottom: '20px',
                }}
            >
                <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-tertiary)' }}>
                    ⚙️ Diğer Hızlı İşlemler
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        type="button"
                        className={`btn btn-sm ${showPostponeBox ? 'btn-warning' : 'btn-secondary'}`}
                        onClick={() => {
                            setShowPostponeBox(prev => !prev);
                            setShowCancelBox(false);
                        }}
                        style={{ flex: 1, fontSize: '12px', padding: '8px' }}
                    >
                        ⏳ Servisi Ertele
                    </button>
                    <button
                        type="button"
                        className={`btn btn-sm ${showCancelBox ? 'btn-danger' : 'btn-secondary'}`}
                        onClick={() => {
                            setShowCancelBox(prev => !prev);
                            setShowPostponeBox(false);
                        }}
                        style={{ flex: 1, fontSize: '12px', padding: '8px' }}
                    >
                        ✕ Servisi İptal Et
                    </button>
                </div>

                {/* Inline Postpone Box */}
                {showPostponeBox && (
                    <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-primary)', border: '1px solid #f59e0b', borderRadius: '8px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#d97706', marginBottom: '8px' }}>
                            ⏳ Yeni Servis Tarihi & Nedeni
                        </div>
                        <input
                            type="date"
                            className="form-input"
                            value={postponeDate}
                            onChange={(e) => setPostponeDate(e.target.value)}
                            style={{ fontSize: '13px', height: '36px', marginBottom: '8px' }}
                        />
                        <textarea
                            className="form-textarea"
                            placeholder="Erteleme nedeni (örn: Müşteri evde yoktu, randevu talep etti)..."
                            value={postponeReason}
                            onChange={(e) => setPostponeReason(e.target.value)}
                            rows={2}
                            style={{ fontSize: '12.5px', width: '100%', marginBottom: '8px' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowPostponeBox(false)}>
                                Kapat
                            </button>
                            <button
                                type="button"
                                className="btn btn-warning btn-sm"
                                disabled={isPostponing || !postponeDate}
                                onClick={handlePostpone}
                            >
                                {isPostponing ? 'Erteleniyor...' : '✓ Ertele ve Listeye Dön'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Inline Cancel Box */}
                {showCancelBox && (
                    <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-primary)', border: '1px solid #ef4444', borderRadius: '8px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#dc2626', marginBottom: '8px' }}>
                            ✕ Servis İptal Nedeni
                        </div>
                        <textarea
                            className="form-textarea"
                            placeholder="İptal sebebini yazınız (örn: Müşteri yaptırmaktan vazgeçti)..."
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            rows={2}
                            style={{ fontSize: '12.5px', width: '100%', marginBottom: '8px' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCancelBox(false)}>
                                Kapat
                            </button>
                            <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                disabled={isCancelling || !cancelReason.trim()}
                                onClick={handleCancel}
                            >
                                {isCancelling ? 'İptal Ediliyor...' : '✓ Servisi İptal Et'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Sticky Bottom Bar with Primary Action (Positioned cleanly above the bottom navbar) */}
            <div
                style={{
                    position: 'fixed',
                    bottom: 'calc(54px + env(safe-area-inset-bottom, 0px))',
                    left: 0,
                    right: 0,
                    background: 'var(--bg-secondary)',
                    borderTop: '1px solid var(--border-primary)',
                    padding: '8px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 -4px 14px rgba(0,0,0,0.12)',
                    zIndex: 95,
                    backdropFilter: 'blur(8px)',
                }}
            >
                <div style={{ maxWidth: '680px', width: '100%', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                        type="button"
                        className={`btn ${isPickup ? 'btn-primary' : 'btn-success'}`}
                        style={{
                            flex: 1,
                            padding: '11px',
                            fontSize: '14.5px',
                            fontWeight: 700,
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                        }}
                        disabled={isSubmitting}
                        onClick={handleComplete}
                    >
                        {isSubmitting ? (
                            'İşlem Kaydediliyor...'
                        ) : (
                            <>
                                <span>{isPickup ? '📥 Cihazı Teslim Al' : '📤 Cihazı Teslim Et'}</span>
                                <span style={{ fontSize: '12px', opacity: 0.85, fontWeight: 500 }}>
                                    ({totalPhotoCount}/{requiredPhotos} Foto)
                                </span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
