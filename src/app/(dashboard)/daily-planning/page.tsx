'use client';

import { useState, useEffect, useTransition } from 'react';
import {
    getDailyServiceRecords,
    assignServicePersonnel,
    rescheduleServiceRecord,
    updateServiceRecordsOrder,
    deleteServiceRecord,
    createManualServiceTask,
} from '@/actions/service-records';
import { getPersonnelByRole } from '@/actions/personnel';
import { getContactNotes, addContactNote } from '@/actions/contact-notes';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/state-machine';
import Link from 'next/link';
import { TicketStatus } from '@prisma/client';
import { REQUEST_TYPE_LABELS, getLocalDateString } from '@/lib/constants';
import DailyPlanPrintModal from '@/components/service/DailyPlanPrintModal';

type ServiceRecord = Awaited<ReturnType<typeof getDailyServiceRecords>>[0];

export default function DailyPlanningPage() {
    const [records, setRecords] = useState<ServiceRecord[]>([]);
    const [personnel, setPersonnel] = useState<any[]>([]);
    const [selectedDate, setSelectedDate] = useState(getLocalDateString());
    const [isPending, startTransition] = useTransition();
    const [isLoading, setIsLoading] = useState(true);
    const [editOrder, setEditOrder] = useState(false);

    const [typeStatusFilter, setTypeStatusFilter] = useState<'ALL' | 'PICKUP' | 'DELIVERY' | 'TASK' | 'COMPLETED' | 'IN_PROGRESS'>('ALL');

    // Local order state (IDs only)
    const [displayOrder, setDisplayOrder] = useState<string[]>([]);

    // Print Modal State
    const [showPrintModal, setShowPrintModal] = useState(false);

    // Manual Task Modal State
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [taskTitle, setTaskTitle] = useState('');
    const [taskDescription, setTaskDescription] = useState('');
    const [taskAddress, setTaskAddress] = useState('');
    const [taskContactPhone, setTaskContactPhone] = useState('');
    const [taskPersonnelId, setTaskPersonnelId] = useState('');
    const [taskDate, setTaskDate] = useState(selectedDate);
    const [isSavingTask, setIsSavingTask] = useState(false);
    const [taskError, setTaskError] = useState('');

    // Notes modal state
    const [showNotesModal, setShowNotesModal] = useState(false);
    const [notesContact, setNotesContact] = useState<{ id: string, name: string, type: 'CUSTOMER' | 'REPAIRER' } | null>(null);
    const [contactNotes, setContactNotes] = useState<any[]>([]);
    const [newNote, setNewNote] = useState('');
    const [isLoadingNotes, setIsLoadingNotes] = useState(false);

    const load = (showSpinner = true) => {
        if (showSpinner) setIsLoading(true);
        startTransition(async () => {
            try {
                const data = await getDailyServiceRecords(selectedDate);
                setRecords(data);
                setDisplayOrder(data.map(r => r.id));
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        });
    };

    useEffect(() => { 
        load(true); 
        setEditOrder(false); 
    }, [selectedDate]);

    useEffect(() => { 
        getPersonnelByRole('SERVICE_STAFF').then(p => {
            setPersonnel(p || []);
        }); 
    }, []);

    const openCreateTaskModal = () => {
        setTaskTitle('');
        setTaskDescription('');
        setTaskAddress('');
        setTaskContactPhone('');
        setTaskDate(selectedDate);
        setTaskError('');
        // RULE: "eğer tek bir servis personeli varsa o seçili olarak gelecek her zaman"
        if (personnel.length === 1) {
            setTaskPersonnelId(personnel[0].id);
        } else {
            setTaskPersonnelId('');
        }
        setShowTaskModal(true);
    };

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!taskTitle.trim()) {
            setTaskError('Lütfen iş tanımı veya görev başlığı giriniz.');
            return;
        }

        setIsSavingTask(true);
        setTaskError('');
        try {
            await createManualServiceTask({
                title: taskTitle,
                description: taskDescription,
                address: taskAddress,
                contactPhone: taskContactPhone,
                scheduledDate: taskDate || selectedDate,
                assignedPersonnelId: taskPersonnelId || undefined,
            });
            setShowTaskModal(false);
            load(false);
        } catch (err: any) {
            setTaskError(err.message || 'Görev oluşturulurken bir hata meydana geldi.');
        } finally {
            setIsSavingTask(false);
        }
    };

    const handleAssign = async (recordId: string, personnelId: string) => {
        try {
            await assignServicePersonnel(recordId, personnelId);
            load(false);
        } catch (err: any) { alert(err.message); }
    };

    const handleReschedule = async (recordId: string, newDate: string) => {
        if (!newDate) return;
        try {
            await rescheduleServiceRecord(recordId, newDate);
            load(false);
        } catch (err: any) { alert(err.message); }
    };

    const handleDelete = async (recordId: string) => {
        if (!confirm('Bu servis talebini veya görevi silmek istediğinize emin misiniz?')) return;
        try {
            await deleteServiceRecord(recordId);
            load(false);
        } catch (err: any) {
            alert(err.message || 'Servis talebi silinemedi');
        }
    };

    const move = (index: number, direction: -1 | 1) => {
        const next = [...displayOrder];
        const swapIdx = index + direction;
        if (swapIdx < 0 || swapIdx >= next.length) return;
        [next[index], next[swapIdx]] = [next[swapIdx], next[index]];
        setDisplayOrder(next);
    };

    const filteredRecords = records.filter(r => {
        if (typeStatusFilter === 'PICKUP') return r.type === 'PICKUP';
        if (typeStatusFilter === 'DELIVERY') return r.type === 'DELIVERY';
        if (typeStatusFilter === 'TASK') return r.type === 'TASK';
        if (typeStatusFilter === 'COMPLETED') return r.status === 'COMPLETED';
        if (typeStatusFilter === 'IN_PROGRESS') return ['IN_PROGRESS', 'ASSIGNED', 'PLANNED'].includes(r.status);
        return true;
    });

    const items = displayOrder.map(id => filteredRecords.find(r => r.id === id)).filter(Boolean) as ServiceRecord[];

    const handleSaveOrder = async () => {
        const toUpdate = items.map((r, i) => ({ id: r.id, sortOrder: i }));
        try {
            await updateServiceRecordsOrder(toUpdate);
            setEditOrder(false);
            load(false);
        } catch (err: any) { alert(err.message); }
    };

    const handleShowNotes = async (contactId: string, name: string, type: 'CUSTOMER' | 'REPAIRER', record: ServiceRecord) => {
        setNotesContact({ id: contactId, name, type });
        setShowNotesModal(true);
        setIsLoadingNotes(true);
        try {
            const notes = await getContactNotes(contactId, type);
            const ticket = record.ticket as any;

            let allVisibleNotes: any[] = [];

            // 1. Customer / Repairer Contact Notes
            notes.forEach((n: any) => {
                allVisibleNotes.push({
                    id: n.id,
                    tag: '📌 Müşteri Notu',
                    content: n.content,
                    createdAt: n.createdAt,
                    personnelName: n.personnel?.name || 'Operatör',
                    tagBg: 'rgba(59, 130, 246, 0.12)',
                    tagColor: 'var(--brand-primary)',
                });
            });

            // 2. Initial Device Note (First reception)
            if (ticket?.notes) {
                allVisibleNotes.push({
                    id: 'device-note',
                    tag: '📥 Cihaz İlk Kayıt / Teslim Notu',
                    content: ticket.notes,
                    createdAt: ticket.createdAt,
                    personnelName: 'Teslim Alan / Kayıt',
                    tagBg: 'rgba(234, 179, 8, 0.15)',
                    tagColor: 'var(--color-warning)',
                });
            }

            // 3. Service Record Note
            if (record?.notes) {
                allVisibleNotes.push({
                    id: 'service-note-' + record.id,
                    tag: '🚗 Servis Planlama Notu',
                    content: record.notes,
                    createdAt: record.updatedAt || record.createdAt,
                    personnelName: 'Servis',
                    tagBg: 'rgba(99, 102, 241, 0.15)',
                    tagColor: '#6366f1',
                });
            }

            // Sort all notes newest first
            allVisibleNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            setContactNotes(allVisibleNotes);
        } catch (err: any) { alert(err.message); }
        finally { setIsLoadingNotes(false); }
    };

    const handleAddNote = async () => {
        if (!notesContact || !newNote.trim()) return;
        try {
            await addContactNote(notesContact.id, notesContact.type, newNote);
            setNewNote('');
            const notes = await getContactNotes(notesContact.id, notesContact.type);
            setContactNotes(notes);
            load(false);
        } catch (err: any) { alert(err.message); }
    };

    return (
        <div>
            <div className="page-header" style={{ flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <button 
                        className={`btn btn-sm ${editOrder ? 'btn-success' : 'btn-secondary'}`}
                        onClick={() => editOrder ? handleSaveOrder() : setEditOrder(true)}
                        title="Sıralamayı Düzenle"
                    >
                        {editOrder ? '💾 Kaydet' : '📋 Sıralama'}
                    </button>
                    <div>
                        <h1 className="page-title">Günlük Planlama</h1>
                        <p className="page-subtitle">{records.length} servis ve iş kaydı</p>
                    </div>
                </div>

                {/* Action Buttons: Add Task & Landscape Print */}
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setShowPrintModal(true)}
                        title="Yatay A4 Günlük Plan Çıktısı Al"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: 600,
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-primary)',
                        }}
                    >
                        <span>🖨️</span>
                        <span>Günlük Plan Çıktısı (Yatay)</span>
                    </button>

                    <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={openCreateTaskModal}
                        title="Personele Manuel Görev / İş Ata"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: 600,
                        }}
                    >
                        <span>➕</span>
                        <span>Manuel İş / Görev Ekle</span>
                    </button>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap', width: '100%', justifyContent: 'space-between', marginTop: '4px' }}>
                    {/* Filter Pills with Counts */}
                    {(() => {
                        const pickupCount = records.filter(r => r.type === 'PICKUP').length;
                        const deliveryCount = records.filter(r => r.type === 'DELIVERY').length;
                        const taskCount = records.filter(r => r.type === 'TASK').length;
                        const completedCount = records.filter(r => r.status === 'COMPLETED').length;
                        const inProgressCount = records.filter(r => ['IN_PROGRESS', 'ASSIGNED', 'PLANNED'].includes(r.status)).length;

                        return (
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                background: 'var(--bg-secondary)',
                                padding: '3px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border-primary)',
                                flexWrap: 'wrap',
                            }}>
                                <button
                                    type="button"
                                    className={`btn btn-xs ${typeStatusFilter === 'ALL' ? 'btn-primary' : 'btn-ghost'}`}
                                    onClick={() => setTypeStatusFilter('ALL')}
                                    style={{ padding: '3px 8px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                >
                                    <span>Tümü</span>
                                    <span style={{
                                        background: typeStatusFilter === 'ALL' ? 'rgba(255,255,255,0.25)' : 'var(--bg-card)',
                                        padding: '1px 6px',
                                        borderRadius: '10px',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                    }}>
                                        {records.length}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    className={`btn btn-xs ${typeStatusFilter === 'PICKUP' ? 'btn-primary' : 'btn-ghost'}`}
                                    onClick={() => setTypeStatusFilter(typeStatusFilter === 'PICKUP' ? 'ALL' : 'PICKUP')}
                                    title="Teslim Alınacak Cihazlar"
                                    style={{ padding: '3px 8px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                >
                                    <span>📥 Teslim Alma</span>
                                    <span style={{
                                        background: typeStatusFilter === 'PICKUP' ? 'rgba(255,255,255,0.25)' : 'rgba(59, 130, 246, 0.18)',
                                        color: typeStatusFilter === 'PICKUP' ? '#ffffff' : '#3b82f6',
                                        padding: '1px 6px',
                                        borderRadius: '10px',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                    }}>
                                        {pickupCount}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    className={`btn btn-xs ${typeStatusFilter === 'DELIVERY' ? 'btn-primary' : 'btn-ghost'}`}
                                    onClick={() => setTypeStatusFilter(typeStatusFilter === 'DELIVERY' ? 'ALL' : 'DELIVERY')}
                                    title="Teslim Edilecek Cihazlar"
                                    style={{ padding: '3px 8px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                >
                                    <span>📤 Teslim Etme</span>
                                    <span style={{
                                        background: typeStatusFilter === 'DELIVERY' ? 'rgba(255,255,255,0.25)' : 'rgba(168, 85, 247, 0.18)',
                                        color: typeStatusFilter === 'DELIVERY' ? '#ffffff' : '#a855f7',
                                        padding: '1px 6px',
                                        borderRadius: '10px',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                    }}>
                                        {deliveryCount}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    className={`btn btn-xs ${typeStatusFilter === 'TASK' ? 'btn-primary' : 'btn-ghost'}`}
                                    onClick={() => setTypeStatusFilter(typeStatusFilter === 'TASK' ? 'ALL' : 'TASK')}
                                    title="Manuel Görevler ve İşler"
                                    style={{ padding: '3px 8px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                >
                                    <span>📋 Görevler</span>
                                    <span style={{
                                        background: typeStatusFilter === 'TASK' ? 'rgba(255,255,255,0.25)' : 'rgba(245, 158, 11, 0.18)',
                                        color: typeStatusFilter === 'TASK' ? '#ffffff' : '#f59e0b',
                                        padding: '1px 6px',
                                        borderRadius: '10px',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                    }}>
                                        {taskCount}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    className={`btn btn-xs ${typeStatusFilter === 'COMPLETED' ? 'btn-primary' : 'btn-ghost'}`}
                                    onClick={() => setTypeStatusFilter(typeStatusFilter === 'COMPLETED' ? 'ALL' : 'COMPLETED')}
                                    title="Tamamlanan Servisler"
                                    style={{ padding: '3px 8px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                >
                                    <span>✅ Yapılan</span>
                                    <span style={{
                                        background: typeStatusFilter === 'COMPLETED' ? 'rgba(255,255,255,0.25)' : 'rgba(16, 185, 129, 0.18)',
                                        color: typeStatusFilter === 'COMPLETED' ? '#ffffff' : '#10b981',
                                        padding: '1px 6px',
                                        borderRadius: '10px',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                    }}>
                                        {completedCount}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    className={`btn btn-xs ${typeStatusFilter === 'IN_PROGRESS' ? 'btn-primary' : 'btn-ghost'}`}
                                    onClick={() => setTypeStatusFilter(typeStatusFilter === 'IN_PROGRESS' ? 'ALL' : 'IN_PROGRESS')}
                                    title="Yapılıyor / Bekleyen Servisler"
                                    style={{ padding: '3px 8px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                >
                                    <span>⏳ Yapılıyor</span>
                                    <span style={{
                                        background: typeStatusFilter === 'IN_PROGRESS' ? 'rgba(255,255,255,0.25)' : 'rgba(245, 158, 11, 0.18)',
                                        color: typeStatusFilter === 'IN_PROGRESS' ? '#ffffff' : '#f59e0b',
                                        padding: '1px 6px',
                                        borderRadius: '10px',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                    }}>
                                        {inProgressCount}
                                    </span>
                                </button>
                            </div>
                        );
                    })()}

                    {/* Date Controls */}
                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                        {[
                            { label: 'Dün', offset: -1 },
                            { label: 'Bugün', offset: 0 },
                            { label: 'Yarın', offset: 1 },
                        ].map(({ label, offset }) => {
                            const d = new Date();
                            d.setDate(d.getDate() + offset);
                            const dateStr = getLocalDateString(d);
                            const isActive = selectedDate === dateStr;
                            return (
                                <button
                                    key={label}
                                    className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setSelectedDate(dateStr)}
                                >
                                    {label}
                                </button>
                            );
                        })}
                        <input
                            type="date"
                            className="form-input"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            style={{ width: '150px' }}
                        />
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => load(true)}
                            disabled={isLoading || isPending}
                            title="Verileri Yenile"
                        >
                            {isLoading || isPending ? '⏳' : '🔄'}
                        </button>
                    </div>
                </div>
            </div>

            {(isLoading || isPending) ? (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '60px 20px',
                    gap: '16px',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-primary)',
                    marginBottom: 'var(--space-4)',
                }}>
                    <div className="spinner spinner-lg" />
                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Servis Planlama Verileri Yükleniyor...
                    </div>
                </div>
            ) : records.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📅</div>
                    <div className="empty-state-title">Bu tarihte servis veya iş kaydı yok</div>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                        Yukarıdaki <strong>➕ Manuel İş / Görev Ekle</strong> butonunu kullanarak personelinize iş atayabilirsiniz.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                    {items.map((r, i) => (
                        <ServiceRecordCard
                            key={r.id}
                            record={r}
                            personnel={personnel}
                            onAssign={handleAssign}
                            onReschedule={handleReschedule}
                            onDelete={handleDelete}
                            editMode={editOrder}
                            onMove={(dir) => move(i, dir)}
                            isFirst={i === 0}
                            isLast={i === items.length - 1}
                            onShowNotes={() => {
                                if (r.type === 'TASK') return;
                                const contactId = r.ticket?.customerId || r.ticket?.repairerId;
                                const contactName = (r.ticket?.customer || r.ticket?.repairer)?.name;
                                if (contactId && contactName) {
                                    handleShowNotes(contactId, contactName, r.ticket?.customerId ? 'CUSTOMER' : 'REPAIRER', r);
                                }
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Manual Task Creation Modal */}
            {showTaskModal && (
                <div className="modal-overlay" onClick={() => setShowTaskModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">📋 Manuel Servis İşi / Görevi Ata</h3>
                            <button className="btn btn-close" onClick={() => setShowTaskModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleCreateTask}>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                {taskError && (
                                    <div style={{
                                        padding: '10px 12px',
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        border: '1px solid var(--color-danger)',
                                        borderRadius: '6px',
                                        color: 'var(--color-danger)',
                                        fontSize: '13px',
                                    }}>
                                        ⚠️ {taskError}
                                    </div>
                                )}

                                <div>
                                    <label className="form-label" style={{ fontWeight: 600 }}>
                                        İş / Görev Tanımı <span style={{ color: 'var(--color-danger)' }}>*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Örn: A deposundan ürün al, Servis Bey'e uğra..."
                                        value={taskTitle}
                                        onChange={e => setTaskTitle(e.target.value)}
                                        required
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label className="form-label">
                                        Servis Personeli Seçimi
                                    </label>
                                    <select
                                        className="form-select"
                                        value={taskPersonnelId}
                                        onChange={e => setTaskPersonnelId(e.target.value)}
                                    >
                                        <option value="">— Personel Seçiniz (Daha sonra atanabilir) —</option>
                                        {personnel.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                    {personnel.length === 1 && (
                                        <span style={{ fontSize: '11px', color: 'var(--brand-primary)', marginTop: '4px', display: 'block' }}>
                                            ℹ️ Sistemdeki tek servis personeli otomatik seçildi.
                                        </span>
                                    )}
                                </div>

                                <div>
                                    <label className="form-label">Tarih</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={taskDate}
                                        onChange={e => setTaskDate(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="form-label">İletişim / Muhatap Telefonu</label>
                                    <input
                                        type="tel"
                                        className="form-input"
                                        placeholder="Örn: 0532 123 45 67"
                                        value={taskContactPhone}
                                        onChange={e => setTaskContactPhone(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="form-label">Adres / Lokasyon</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Örn: Organize Sanayi Bölgesi 4. Cad No:12"
                                        value={taskAddress}
                                        onChange={e => setTaskAddress(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="form-label">Açıklama / Talimat Notu</label>
                                    <textarea
                                        className="form-textarea"
                                        rows={3}
                                        placeholder="Personele iletilecek özel talimatlar..."
                                        value={taskDescription}
                                        onChange={e => setTaskDescription(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowTaskModal(false)}>
                                    İptal
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={isSavingTask}>
                                    {isSavingTask ? 'Kaydediliyor...' : '💾 Görevi Oluştur'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Landscape Print Modal */}
            <DailyPlanPrintModal
                isOpen={showPrintModal}
                onClose={() => setShowPrintModal(false)}
                records={records}
                personnelList={personnel}
                dateStr={selectedDate}
            />

            {/* Notes Modal */}
            {showNotesModal && notesContact && (
                <div className="modal-overlay" onClick={() => setShowNotesModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">📋 {notesContact.name} — Not Geçmişi ve Ekleme</h3>
                            <button className="btn btn-close" onClick={() => setShowNotesModal(false)}>✕</button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                            {isLoadingNotes ? (
                                <p style={{ padding: '20px', textAlign: 'center' }}>Notlar yükleniyor...</p>
                            ) : contactNotes.length === 0 ? (
                                <p style={{ padding: '16px', textAlign: 'center', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                                    Henüz bu müşteri veya servis için kaydedilmiş not yok.
                                </p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                                    {contactNotes.map((n) => (
                                        <div key={n.id} style={{
                                            padding: '10px 12px',
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-primary)',
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{
                                                        fontSize: '10px',
                                                        fontWeight: 700,
                                                        padding: '2px 6px',
                                                        borderRadius: '4px',
                                                        background: n.tagBg || 'var(--bg-secondary)',
                                                        color: n.tagColor || 'var(--text-primary)',
                                                    }}>
                                                        {n.tag}
                                                    </span>
                                                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                                        {n.personnelName} · {new Date(n.createdAt).toLocaleString('tr-TR')}
                                                    </span>
                                                </div>
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    style={{
                                                        fontSize: '11px',
                                                        padding: '2px 8px',
                                                        color: 'var(--brand-primary)',
                                                        fontWeight: 600,
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        background: 'var(--bg-secondary)',
                                                        borderRadius: '4px',
                                                        border: '1px solid var(--border-primary)',
                                                    }}
                                                    onClick={() => setNewNote(prev => prev ? `${prev}\n${n.content}` : n.content)}
                                                    title="Bu notu servis notu alanına ekle"
                                                >
                                                    ➕ Notu Aktar
                                                </button>
                                            </div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                                                {n.content}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '12px', marginTop: '8px' }}>
                                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                                    ✏️ Yeni Servis / Müşteri Notu Yazın (veya yukarıdan ➕ ile Aktarın):
                                </label>
                                <textarea
                                    className="form-textarea"
                                    placeholder="Servis veya müşteri için not ekleyin..."
                                    value={newNote}
                                    onChange={e => setNewNote(e.target.value)}
                                    rows={3}
                                    style={{ fontSize: '13px' }}
                                />
                            </div>
                        </div>
                        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <button className="btn btn-secondary" onClick={() => setShowNotesModal(false)}>Kapat</button>
                            <button className="btn btn-primary" onClick={handleAddNote} disabled={!newNote.trim()}>
                                💾 Notu Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ServiceRecordCard({
    record,
    personnel,
    onAssign,
    onReschedule,
    onDelete,
    editMode,
    onMove,
    isFirst,
    isLast,
    onShowNotes,
}: {
    record: any;
    personnel: any[];
    onAssign: (recordId: string, personnelId: string) => void;
    onReschedule: (recordId: string, newDate: string) => void;
    onDelete?: (recordId: string) => void;
    editMode?: boolean;
    onMove?: (dir: -1 | 1) => void;
    isFirst?: boolean;
    isLast?: boolean;
    onShowNotes?: () => void;
}) {
    const [rescheduleDate, setRescheduleDate] = useState('');
    const [showReschedule, setShowReschedule] = useState(false);

    const isTask = record.type === 'TASK';
    const ticket = record.ticket;
    const customer = !isTask && ticket ? (ticket.customer || ticket.repairer) : null;
    const status = !isTask && ticket ? (ticket.status as TicketStatus) : null;
    const statusBadgeStyle = status ? {
        background: `${STATUS_COLORS[status]}20`,
        color: STATUS_COLORS[status],
    } : {};

    return (
        <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
            {editMode && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                    <button 
                        className="btn btn-ghost btn-icon btn-sm" 
                        onClick={() => onMove?.(-1)}
                        disabled={isFirst}
                        style={{ padding: 0, height: '24px', width: '24px' }}
                    >
                        ▲
                    </button>
                    <button 
                        className="btn btn-ghost btn-icon btn-sm" 
                        onClick={() => onMove?.(1)}
                        disabled={isLast}
                        style={{ padding: 0, height: '24px', width: '24px' }}
                    >
                        ▼
                    </button>
                </div>
            )}
            
            <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                    {isTask ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                            <span style={{
                                background: 'rgba(245, 158, 11, 0.15)',
                                color: '#b45309',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontWeight: 800,
                                fontSize: '12px',
                            }}>
                                📋 MANUEL GÖREV
                            </span>
                            <span style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', color: 'var(--text-primary)' }}>
                                {record.taskTitle}
                            </span>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                            <Link href={`/tickets/${ticket?.id}`} style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)' }}>
                                {ticket?.ticketNo}
                            </Link>
                            <span className={`badge ${record.type === 'PICKUP' ? 'badge-info' : 'badge-success'}`}>
                                {record.type === 'PICKUP' ? '📥 Alınacak' : '📤 Verilecek'}
                            </span>
                            <span className="badge" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                                🛠 {REQUEST_TYPE_LABELS[ticket?.requestType as keyof typeof REQUEST_TYPE_LABELS] || '—'}
                            </span>
                            {status && (
                                <span className="badge" style={{ ...statusBadgeStyle }}>
                                    {STATUS_LABELS[status]}
                                </span>
                            )}
                        </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        {!isTask && (
                            <button 
                                onClick={(e) => { e.preventDefault(); onShowNotes?.(); }}
                                style={{ 
                                    position: 'relative',
                                    border: '1px solid var(--border-color)', 
                                    background: 'transparent', 
                                    color: 'var(--text-tertiary)', 
                                    borderRadius: '50%', 
                                    width: '32px', 
                                    height: '32px', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    fontSize: '16px',
                                    padding: 0
                                }}
                            >
                                📋
                                {((ticket?.customer?._count?.notes || ticket?.repairer?._count?.notes || 0) + (ticket?.notes ? 1 : 0)) > 0 && (
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
                                        {(ticket?.customer?._count?.notes || ticket?.repairer?._count?.notes || 0) + (ticket?.notes ? 1 : 0) + (record.notes ? 1 : 0)}
                                    </span>
                                )}
                                {((ticket?.customer?._count?.notes || ticket?.repairer?._count?.notes || 0) + (ticket?.notes ? 1 : 0)) === 0 && (
                                    <span style={{ position: 'absolute', bottom: '-2px', right: '-2px', fontSize: '10px', color: 'var(--text-tertiary)', background: '#fff', borderRadius: '50%', width: '14px', height: '14px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</span>
                                )}
                            </button>
                        )}

                        <span className={`badge ${record.status === 'COMPLETED' ? 'badge-success' : record.status === 'POSTPONED' ? 'badge-warning' : record.status === 'CANCELLED' ? 'badge-danger' : 'badge-info'}`} style={{ whiteSpace: 'nowrap', padding: '6px 12px' }}>
                            {record.status === 'COMPLETED' ? 'Tamamlandı' : record.status === 'ASSIGNED' ? 'Atandı' : record.status === 'PLANNED' ? 'Planlandı' : record.status === 'POSTPONED' ? 'Ertelendi' : 'İptal / Yapılmadı'}
                        </span>

                        <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{
                                color: 'var(--color-danger)',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                background: 'rgba(239, 68, 68, 0.05)',
                                padding: '4px 10px',
                                fontSize: '12px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer'
                            }}
                            onClick={(e) => {
                                e.preventDefault();
                                onDelete?.(record.id);
                            }}
                            title="Kaydı Sil"
                        >
                            🗑️ Sil
                        </button>
                    </div>
                </div>

                {/* Details Section */}
                {isTask ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', background: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                        <div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Açıklama / Talimat</div>
                            <div style={{ fontSize: '14px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                                {record.taskDescription || '—'}
                            </div>
                        </div>
                        <div>
                            {record.taskContactPhone && (
                                <div style={{ marginBottom: '6px' }}>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>İletişim Telefonu</div>
                                    <a href={`tel:${record.taskContactPhone}`} style={{ fontSize: '14px', fontWeight: 700, color: 'var(--brand-primary)' }}>
                                        📞 {record.taskContactPhone}
                                    </a>
                                </div>
                            )}
                            {record.taskAddress && (
                                <div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Adres / Lokasyon</div>
                                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                        📍 {record.taskAddress}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                        <div>
                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <span style={{ 
                                    fontSize: '10px', 
                                    background: ticket?.customerId ? 'rgba(59, 130, 246, 0.12)' : 'rgba(234, 179, 8, 0.12)', 
                                    padding: '2px 8px', 
                                    borderRadius: '4px', 
                                    color: ticket?.customerId ? 'var(--brand-primary)' : 'var(--color-warning)', 
                                    fontWeight: 800,
                                    border: `1px solid ${ticket?.customerId ? 'rgba(59, 130, 246, 0.2)' : 'rgba(234, 179, 8, 0.2)'}`
                                }}>
                                    {ticket?.customerId ? 'MÜŞTERİ' : 'TAMİRCİ'}
                                </span>
                                <span style={{ fontSize: '15px' }}>{customer?.name || '-'}</span>
                            </div>
                            {customer?.phone && <a href={`tel:${customer.phone}`} style={{ fontSize: 'var(--font-size-sm)', display: 'block', fontWeight: 600 }}>📞 {customer.phone}</a>}
                        </div>
                        <div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Cihaz & Model</div>
                            <div style={{ fontWeight: 600 }}>{ticket?.brand?.name} {ticket?.model}</div>
                        </div>
                        {customer?.address && (
                            <div style={{ gridColumn: '1 / -1' }}>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Adres</div>
                                <div style={{ fontSize: 'var(--font-size-sm)' }}>{customer.address}, {customer.city}/{customer.district}</div>
                            </div>
                        )}
                    </div>
                )}

                {/* Assignment + Reschedule */}
                {record.status !== 'COMPLETED' && record.status !== 'CANCELLED' && !editMode && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                            <select
                                className="form-select"
                                value={record.assignedPersonnelId || ''}
                                onChange={(e) => onAssign(record.id, e.target.value)}
                                style={{ flex: 1 }}
                            >
                                <option value="">— Personel Seçin —</option>
                                {personnel.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setShowReschedule(!showReschedule)}
                                title="Yeniden Planla"
                            >
                                📅 Ertele
                            </button>
                        </div>

                        {showReschedule && (
                            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', padding: 'var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Yeni Tarih:</span>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={rescheduleDate}
                                    onChange={(e) => setRescheduleDate(e.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                    style={{ flex: 1 }}
                                />
                                <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    disabled={!rescheduleDate}
                                    onClick={() => {
                                        onReschedule(record.id, rescheduleDate);
                                        setShowReschedule(false);
                                        setRescheduleDate('');
                                    }}
                                >
                                    Onayla
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => { setShowReschedule(false); setRescheduleDate(''); }}
                                >
                                    İptal
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
