'use client';

import { useState, useEffect, useTransition } from 'react';
import { getDailyServiceRecords, assignServicePersonnel, rescheduleServiceRecord, updateServiceRecordsOrder, deleteServiceRecord } from '@/actions/service-records';
import { getPersonnelByRole } from '@/actions/personnel';
import { getContactNotes, addContactNote } from '@/actions/contact-notes';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/state-machine';
import Link from 'next/link';
import { TicketStatus } from '@prisma/client';
import { REQUEST_TYPE_LABELS, getLocalDateString } from '@/lib/constants';

type ServiceRecord = Awaited<ReturnType<typeof getDailyServiceRecords>>[0];

export default function DailyPlanningPage() {
    const [records, setRecords] = useState<ServiceRecord[]>([]);
    const [personnel, setPersonnel] = useState<any[]>([]);
    const [selectedDate, setSelectedDate] = useState(getLocalDateString());
    const [isPending, startTransition] = useTransition();
    const [isLoading, setIsLoading] = useState(true);
    const [editOrder, setEditOrder] = useState(false);

    // Local order state (IDs only)
    const [displayOrder, setDisplayOrder] = useState<string[]>([]);

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
        getPersonnelByRole('SERVICE_STAFF').then(setPersonnel); 
    }, []);

    const handleAssign = async (recordId: string, personnelId: string) => {
        try {
            await assignServicePersonnel(recordId, personnelId);
            load();
        } catch (err: any) { alert(err.message); }
    };

    const handleReschedule = async (recordId: string, newDate: string) => {
        if (!newDate) return;
        try {
            await rescheduleServiceRecord(recordId, newDate);
            load();
        } catch (err: any) { alert(err.message); }
    };

    const handleDelete = async (recordId: string) => {
        if (!confirm('Bu servis talebini silmek istediğinize emin misiniz?')) return;
        try {
            await deleteServiceRecord(recordId);
            load();
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

    const items = displayOrder.map(id => records.find(r => r.id === id)).filter(Boolean) as ServiceRecord[];

    const handleSaveOrder = async () => {
        const toUpdate = items.map((r, i) => ({ id: r.id, sortOrder: i }));
        try {
            await updateServiceRecordsOrder(toUpdate);
            setEditOrder(false);
            load();
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
            load();
        } catch (err: any) { alert(err.message); }
    };

    return (
        <div>
            <div className="page-header">
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
                        <p className="page-subtitle">{records.length} servis kaydı</p>
                    </div>
                </div>
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
                        style={{ width: '160px' }}
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
                    <div className="empty-state-title">Bu tarihte servis kaydı yok</div>
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
                                const contactId = r.ticket.customerId || r.ticket.repairerId;
                                const contactName = (r.ticket.customer || r.ticket.repairer)?.name;
                                if (contactId && contactName) {
                                    handleShowNotes(contactId, contactName, r.ticket.customerId ? 'CUSTOMER' : 'REPAIRER', r);
                                }
                            }}
                        />
                    ))}
                </div>
            )}

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

    const customer = record.ticket.customer || record.ticket.repairer;
    const status = record.ticket.status as TicketStatus;
    const statusBadgeStyle = {
        background: `${STATUS_COLORS[status]}20`,
        color: STATUS_COLORS[status],
    };

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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <Link href={`/tickets/${record.ticket.id}`} style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)' }}>
                            {record.ticket.ticketNo}
                        </Link>
                        <span className={`badge ${record.type === 'PICKUP' ? 'badge-info' : 'badge-success'}`}>
                            {record.type === 'PICKUP' ? '📥 Alınacak' : '📤 Verilecek'}
                        </span>
                        <span className="badge" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                            🛠 {REQUEST_TYPE_LABELS[(record.ticket as any).requestType as keyof typeof REQUEST_TYPE_LABELS] || '—'}
                        </span>
                        <span className="badge" style={{ ...statusBadgeStyle }}>
                            {STATUS_LABELS[status]}
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
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
                            {((record.ticket.customer?._count?.notes || record.ticket.repairer?._count?.notes || 0) + (record.ticket.notes ? 1 : 0)) > 0 && (
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
                                    {(record.ticket.customer?._count?.notes || record.ticket.repairer?._count?.notes || 0) + (record.ticket.notes ? 1 : 0) + (record.notes ? 1 : 0)}
                                </span>
                            )}
                            {((record.ticket.customer?._count?.notes || record.ticket.repairer?._count?.notes || 0) + (record.ticket.notes ? 1 : 0) + (record.notes ? 1 : 0)) === 0 && (
                                <span style={{ position: 'absolute', bottom: '-2px', right: '-2px', fontSize: '10px', color: 'var(--text-tertiary)', background: '#fff', borderRadius: '50%', width: '14px', height: '14px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</span>
                            )}
                        </button>
                        <span className={`badge ${record.status === 'COMPLETED' ? 'badge-success' : record.status === 'POSTPONED' ? 'badge-warning' : record.status === 'CANCELLED' ? 'badge-danger' : 'badge-info'}`} style={{ whiteSpace: 'nowrap', padding: '6px 12px' }}>
                            {record.status === 'COMPLETED' ? 'Tamamlandı' : record.status === 'ASSIGNED' ? 'Atandı' : record.status === 'PLANNED' ? 'Planlandı' : record.status === 'POSTPONED' ? 'Ertelendi' : 'İptal'}
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
                            title="Servis Talebini Sil"
                        >
                            🗑️ Sil
                        </button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                    <div>
                        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <span style={{ 
                                fontSize: '10px', 
                                background: record.ticket.customerId ? 'rgba(59, 130, 246, 0.12)' : 'rgba(234, 179, 8, 0.12)', 
                                padding: '2px 8px', 
                                borderRadius: '4px', 
                                color: record.ticket.customerId ? 'var(--brand-primary)' : 'var(--color-warning)', 
                                fontWeight: 800,
                                border: `1px solid ${record.ticket.customerId ? 'rgba(59, 130, 246, 0.2)' : 'rgba(234, 179, 8, 0.2)'}`
                            }}>
                                {record.ticket.customerId ? 'MÜŞTERİ' : 'TAMİRCİ'}
                            </span>
                            <span style={{ fontSize: '15px' }}>{customer?.name || '-'}</span>
                        </div>
                        {customer?.phone && <a href={`tel:${customer.phone}`} style={{ fontSize: 'var(--font-size-sm)', display: 'block' }}>{customer.phone}</a>}
                    </div>
                    <div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Cihaz</div>
                        <div>{record.ticket.brand?.name} {record.ticket.model}</div>
                    </div>
                    {customer?.address && (
                        <div style={{ gridColumn: '1 / -1' }}>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Adres</div>
                            <div style={{ fontSize: 'var(--font-size-sm)' }}>{customer.address}, {customer.city}/{customer.district}</div>
                        </div>
                    )}
                </div>

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
