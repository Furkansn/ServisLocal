'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { REQUEST_TYPE_LABELS, OPERATION_TYPE_LABELS } from '@/lib/constants';

interface DailyPlanPrintModalProps {
    isOpen: boolean;
    onClose: () => void;
    records: any[];
    personnelList: any[];
    dateStr: string;
    currentUserRole?: string;
    currentUserId?: string;
}

export default function DailyPlanPrintModal({
    isOpen,
    onClose,
    records,
    personnelList,
    dateStr,
    currentUserId,
}: DailyPlanPrintModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Rule: If only 1 service personnel, select them by default
    const defaultPersonnel = useMemo(() => {
        if (currentUserId && personnelList.some(p => p.id === currentUserId)) {
            return currentUserId;
        }
        if (personnelList.length === 1) {
            return personnelList[0].id;
        }
        return 'ALL';
    }, [personnelList, currentUserId]);

    const [selectedPersonnelId, setSelectedPersonnelId] = useState<string>(defaultPersonnel);

    // Keep synced if personnelList changes
    useEffect(() => {
        if (selectedPersonnelId === 'ALL' && personnelList.length === 1) {
            setSelectedPersonnelId(personnelList[0].id);
        }
    }, [personnelList]);

    // Filter records by selected personnel
    const filteredRecords = useMemo(() => {
        if (selectedPersonnelId === 'ALL') {
            return records;
        }
        return records.filter(r => r.assignedPersonnelId === selectedPersonnelId);
    }, [records, selectedPersonnelId]);

    // Format human-friendly Turkish date
    const formattedDate = useMemo(() => {
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('tr-TR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                weekday: 'long',
            });
        } catch {
            return dateStr;
        }
    }, [dateStr]);

    const selectedPersonnelName = useMemo(() => {
        if (selectedPersonnelId === 'ALL') return 'Tüm Servis Personelleri (Toplu Dağıtım)';
        const p = personnelList.find(item => item.id === selectedPersonnelId);
        return p?.name || 'Belirtilmemiş';
    }, [selectedPersonnelId, personnelList]);

    const stats = useMemo(() => {
        let pickups = 0;
        let deliveries = 0;
        let tasks = 0;
        let totalToCollect = 0;

        filteredRecords.forEach(r => {
            if (r.type === 'PICKUP') pickups++;
            else if (r.type === 'DELIVERY') deliveries++;
            else if (r.type === 'TASK') tasks++;

            if (r.ticket) {
                const rem = Number(r.ticket.remainingAmount ?? (Number(r.ticket.totalAmount || 0) - Number(r.ticket.paidAmount || 0)));
                if (rem > 0 && r.type === 'DELIVERY') {
                    totalToCollect += rem;
                }
            }
        });

        return { pickups, deliveries, tasks, totalToCollect, total: filteredRecords.length };
    }, [filteredRecords]);

    if (!isOpen) return null;

    const handlePrint = () => {
        window.print();
    };

    // Shared Document Content (Used both in Modal Preview and in isolated Print Portal)
    const renderPrintDocument = () => (
        <div style={{ width: '100%', boxSizing: 'border-box' }}>
            {/* Top Document Header */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    borderBottom: '2px solid #0f172a',
                    paddingBottom: '8px',
                    marginBottom: '10px',
                }}
            >
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h1
                            style={{
                                fontSize: '18px',
                                fontWeight: 900,
                                letterSpacing: '-0.5px',
                                margin: 0,
                                color: '#0f172a',
                                textTransform: 'uppercase',
                            }}
                        >
                            GÜNLÜK SERVİS VE İŞ DAĞITIM PLANI
                        </h1>
                        <span
                            style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                color: '#475569',
                            }}
                        >
                            YATAY ÇIKTI
                        </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#475569', marginTop: '3px', display: 'flex', gap: '16px' }}>
                        <span>📅 <strong>Tarih:</strong> {formattedDate}</span>
                        <span>👤 <strong>Servis Görevlisi:</strong> <strong style={{ color: '#0f172a' }}>{selectedPersonnelName}</strong></span>
                    </div>
                </div>

                <div style={{ textAlign: 'right', fontSize: '11px', color: '#64748b' }}>
                    <div><strong>Toplam İş:</strong> {stats.total} adet</div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '2px', justifyContent: 'flex-end' }}>
                        <span style={{ color: '#0284c7' }}>📥 Alma: {stats.pickups}</span>
                        <span style={{ color: '#7c3aed' }}>📤 Teslim: {stats.deliveries}</span>
                        {stats.tasks > 0 && <span style={{ color: '#d97706' }}>📋 Görev: {stats.tasks}</span>}
                    </div>
                    {stats.totalToCollect > 0 && (
                        <div style={{ marginTop: '2px', fontWeight: 800, color: '#dc2626' }}>
                            💵 Tahsil Edilecek: {stats.totalToCollect.toLocaleString('tr-TR')} ₺
                        </div>
                    )}
                </div>
            </div>

            {/* Table */}
            {filteredRecords.length === 0 ? (
                <div
                    style={{
                        textAlign: 'center',
                        padding: '30px',
                        background: '#f8fafc',
                        borderRadius: '6px',
                        border: '1px dashed #cbd5e1',
                        color: '#64748b',
                    }}
                >
                    Seçilen personele veya güne ait servis kaydı bulunmamaktadır.
                </div>
            ) : (
                <table
                    style={{
                        width: '100%',
                        tableLayout: 'fixed',
                        borderCollapse: 'collapse',
                        fontSize: '10.5px',
                        lineHeight: '1.25',
                        border: '1px solid #94a3b8',
                        boxSizing: 'border-box',
                    }}
                >
                    <thead>
                        <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #64748b', textAlign: 'left' }}>
                            <th style={{ padding: '5px 3px', width: '3%', textAlign: 'center', borderRight: '1px solid #cbd5e1' }}>#</th>
                            <th style={{ padding: '5px 5px', width: '7%', borderRight: '1px solid #cbd5e1' }}>İş Türü</th>
                            <th style={{ padding: '5px 5px', width: '8%', borderRight: '1px solid #cbd5e1' }}>Fiş No</th>
                            <th style={{ padding: '5px 6px', width: '18%', borderRight: '1px solid #cbd5e1' }}>Müşteri / Firma</th>
                            <th style={{ padding: '5px 6px', width: '13%', borderRight: '1px solid #cbd5e1' }}>Telefon</th>
                            <th style={{ padding: '5px 6px', width: '25%', borderRight: '1px solid #cbd5e1' }}>Adres / İlçe</th>
                            <th style={{ padding: '5px 6px', width: '15%', borderRight: '1px solid #cbd5e1' }}>Cihaz & Model / Tanım</th>
                            <th style={{ padding: '5px 4px', width: '6%', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>Ödeme</th>
                            <th style={{ padding: '5px 4px', width: '5%', textAlign: 'center' }}>Not</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredRecords.map((r, index) => {
                            const isTask = r.type === 'TASK';
                            const ticket = r.ticket;
                            const customer = ticket?.customer || ticket?.repairer;
                            const customerName = isTask ? (r.taskTitle || 'Manuel Görev') : (customer?.name || '—');
                            const phone = isTask ? r.taskContactPhone : customer?.phone;
                            const address = isTask ? r.taskAddress : (customer?.address ? `${customer.address}${customer.district ? ` - ${customer.district}/${customer.city || ''}` : ''}` : '—');
                            const deviceModel = isTask
                                ? (r.taskDescription || 'Manuel İş Tanımı')
                                : `${ticket?.brand?.name || ''} ${ticket?.model || ''}`.trim() || '—';

                            const requestTypeLabel = !isTask && ticket?.requestType
                                ? (ticket.requestType === 'OTHER' && (ticket as any)?.customRequestType
                                    ? (ticket as any).customRequestType
                                    : (REQUEST_TYPE_LABELS[ticket.requestType as keyof typeof REQUEST_TYPE_LABELS]
                                        || OPERATION_TYPE_LABELS[ticket.requestType as keyof typeof OPERATION_TYPE_LABELS]
                                        || ticket.requestType))
                                : '';

                            // Payment status calculation
                            let paymentBadge = <span style={{ color: '#64748b' }}>—</span>;
                            if (!isTask && ticket) {
                                const totalAmt = Number(ticket.totalAmount || 0);
                                const paidAmt = Number(ticket.paidAmount || 0);
                                const remaining = Math.max(0, Number(ticket.remainingAmount ?? (totalAmt - paidAmt)));

                                if (remaining > 0) {
                                    paymentBadge = (
                                        <span
                                            style={{
                                                background: '#fee2e2',
                                                color: '#b91c1c',
                                                border: '1px solid #fca5a5',
                                                padding: '2px 4px',
                                                borderRadius: '3px',
                                                fontWeight: 800,
                                                fontSize: '10px',
                                                display: 'inline-block',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {remaining.toLocaleString('tr-TR')} ₺
                                        </span>
                                    );
                                } else if (totalAmt > 0 && remaining === 0) {
                                    paymentBadge = (
                                        <span
                                            style={{
                                                background: '#dcfce7',
                                                color: '#15803d',
                                                border: '1px solid #86efac',
                                                padding: '2px 4px',
                                                borderRadius: '3px',
                                                fontWeight: 700,
                                                fontSize: '9.5px',
                                                display: 'inline-block',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            Ödeme Yapıldı
                                        </span>
                                    );
                                } else {
                                    paymentBadge = <span style={{ color: '#64748b', fontSize: '10px' }}>—</span>;
                                }
                            }

                            // Check if customer or ticket has any notes
                            const hasNotes = Boolean(
                                (customer?._count?.notes && customer._count.notes > 0) ||
                                ticket?.notes ||
                                r.notes
                            );

                            // Type badge style
                            let typeBadge = null;
                            if (r.type === 'PICKUP') {
                                typeBadge = (
                                    <span
                                        style={{
                                            background: '#e0f2fe',
                                            color: '#0369a1',
                                            border: '1px solid #bae6fd',
                                            padding: '1px 4px',
                                            borderRadius: '3px',
                                            fontWeight: 700,
                                            fontSize: '9px',
                                            display: 'inline-block',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        📥 Alma
                                    </span>
                                );
                            } else if (r.type === 'DELIVERY') {
                                typeBadge = (
                                    <span
                                        style={{
                                            background: '#f3e8ff',
                                            color: '#6b21a8',
                                            border: '1px solid #e9d5ff',
                                            padding: '1px 4px',
                                            borderRadius: '3px',
                                            fontWeight: 700,
                                            fontSize: '9px',
                                            display: 'inline-block',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        📤 Teslim
                                    </span>
                                );
                            } else {
                                typeBadge = (
                                    <span
                                        style={{
                                            background: '#fef3c7',
                                            color: '#b45309',
                                            border: '1px solid #fde68a',
                                            padding: '1px 4px',
                                            borderRadius: '3px',
                                            fontWeight: 700,
                                            fontSize: '9px',
                                            display: 'inline-block',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        📋 Görev
                                    </span>
                                );
                            }

                            return (
                                <tr
                                    key={r.id}
                                    style={{
                                        borderBottom: '1px solid #cbd5e1',
                                        background: index % 2 === 0 ? '#ffffff' : '#f8fafc',
                                        pageBreakInside: 'avoid',
                                    }}
                                >
                                    {/* Sequence Number */}
                                    <td style={{ padding: '5px 3px', textAlign: 'center', fontWeight: 700, borderRight: '1px solid #cbd5e1' }}>
                                        {index + 1}
                                    </td>

                                    {/* Type */}
                                    <td style={{ padding: '5px 5px', borderRight: '1px solid #cbd5e1' }}>
                                        {typeBadge}
                                    </td>

                                    {/* Ticket No / Code */}
                                    <td style={{ padding: '5px 5px', fontWeight: 700, fontFamily: 'monospace', borderRight: '1px solid #cbd5e1' }}>
                                        {ticket?.ticketNo || 'GÖREV'}
                                    </td>

                                    {/* Customer */}
                                    <td style={{ padding: '5px 6px', fontWeight: 600, borderRight: '1px solid #cbd5e1', wordBreak: 'break-word' }}>
                                        <div>{customerName}</div>
                                        {!isTask && ticket?.repairer && (
                                            <span style={{ fontSize: '8.5px', color: '#b45309', background: '#fef3c7', padding: '1px 3px', borderRadius: '2px' }}>
                                                TAMİRCİ
                                            </span>
                                        )}
                                    </td>

                                    {/* Phone (Prominent) */}
                                    <td style={{ padding: '5px 6px', fontWeight: 800, fontSize: '10.5px', borderRight: '1px solid #cbd5e1', wordBreak: 'break-word' }}>
                                        {phone ? <span>📞 {phone}</span> : <span style={{ color: '#94a3b8' }}>—</span>}
                                    </td>

                                    {/* Address */}
                                    <td style={{ padding: '5px 6px', fontSize: '10px', borderRight: '1px solid #cbd5e1', wordBreak: 'break-word' }}>
                                        {address}
                                    </td>

                                    {/* Device & Model / Task Detail */}
                                    <td style={{ padding: '5px 6px', borderRight: '1px solid #cbd5e1', wordBreak: 'break-word' }}>
                                        <div style={{ fontWeight: 600 }}>{deviceModel}</div>
                                        {requestTypeLabel && (
                                            <div style={{ fontSize: '9px', color: '#475569', marginTop: '1px', fontWeight: 500 }}>
                                                {requestTypeLabel}
                                            </div>
                                        )}
                                    </td>

                                    {/* Payment Status */}
                                    <td style={{ padding: '5px 4px', textAlign: 'center', borderRight: '1px solid #cbd5e1' }}>
                                        {paymentBadge}
                                    </td>

                                    {/* Customer Note Indicator */}
                                    <td style={{ padding: '5px 4px', textAlign: 'center' }}>
                                        {hasNotes ? (
                                            <span
                                                style={{
                                                    background: '#fef3c7',
                                                    color: '#b45309',
                                                    border: '1px solid #fde68a',
                                                    padding: '2px 4px',
                                                    borderRadius: '3px',
                                                    fontWeight: 800,
                                                    fontSize: '9px',
                                                    display: 'inline-block',
                                                    whiteSpace: 'nowrap',
                                                }}
                                                title="Sistemde müşteri/servis notu kayıtlı"
                                            >
                                                📝 Not Var
                                            </span>
                                        ) : (
                                            <span style={{ color: '#94a3b8', fontSize: '10px' }}>Yok</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}

            {/* Footer Notes for Printout */}
            <div
                style={{
                    marginTop: '8px',
                    paddingTop: '6px',
                    borderTop: '1px solid #cbd5e1',
                    fontSize: '9.5px',
                    color: '#64748b',
                }}
            >
                📌 <em>"📝 Not Var" ibaresi olan müşterilerin detaylı notlarını servis personeli mobil panelden (📋 butonu) görebilir.</em>
            </div>
        </div>
    );

    return (
        <>
            {/* Global Print Isolation Stylesheet */}
            <style jsx global>{`
                @media screen {
                    #daily-plan-print-portal {
                        display: none !important;
                    }
                }
                @media print {
                    @page {
                        size: landscape !important;
                        margin: 5mm 6mm !important;
                    }
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        box-sizing: border-box !important;
                    }
                    html, body {
                        width: 100% !important;
                        height: auto !important;
                        min-height: 0 !important;
                        max-height: none !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #ffffff !important;
                        overflow: visible !important;
                    }
                    /* HIDE THE ENTIRE DASHBOARD / APP SHELL AND MODAL OVERLAY ON PRINT */
                    body > *:not(#daily-plan-print-portal) {
                        display: none !important;
                        height: 0 !important;
                        overflow: hidden !important;
                        visibility: hidden !important;
                    }
                    /* SHOW ONLY THE PRINT PORTAL - ZERO EXTRA PAGES */
                    body > #daily-plan-print-portal {
                        display: block !important;
                        position: static !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #ffffff !important;
                        color: #0f172a !important;
                        visibility: visible !important;
                        page-break-after: avoid !important;
                        break-after: avoid !important;
                    }
                    #daily-plan-print-portal table {
                        width: 100% !important;
                        table-layout: fixed !important;
                        page-break-inside: auto !important;
                    }
                    #daily-plan-print-portal tr {
                        page-break-inside: avoid !important;
                        page-break-after: auto !important;
                    }
                }
            `}</style>

            {/* Screen Modal Dialog (For Preview & Interaction) */}
            <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
                <div
                    className="modal"
                    onClick={e => e.stopPropagation()}
                    style={{
                        maxWidth: '1200px',
                        width: '96vw',
                        maxHeight: '92vh',
                        display: 'flex',
                        flexDirection: 'column',
                        padding: 0,
                        overflow: 'hidden',
                    }}
                >
                    {/* Modal Header & Controls */}
                    <div
                        className="modal-header"
                        style={{
                            padding: '14px 20px',
                            borderBottom: '1px solid var(--border-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'var(--bg-secondary)',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '24px' }}>🖨️</span>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    Günlük Servis Planı — Yatay Çıktı Önizleme
                                </h3>
                                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    A4 Yatay (Landscape) formatında yazdırma sayfası
                                </p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {/* Personnel Filter Dropdown */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    Personel:
                                </label>
                                <select
                                    className="form-select"
                                    value={selectedPersonnelId}
                                    onChange={e => setSelectedPersonnelId(e.target.value)}
                                    style={{ fontSize: '13px', padding: '6px 10px', minWidth: '180px' }}
                                >
                                    <option value="ALL">📋 Tüm Personeller ({records.length})</option>
                                    {personnelList.map(p => {
                                        const count = records.filter(r => r.assignedPersonnelId === p.id).length;
                                        return (
                                            <option key={p.id} value={p.id}>
                                                👤 {p.name} ({count} İş)
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={handlePrint}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '8px 16px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                }}
                            >
                                <span>🖨️</span>
                                <span>Yazdır (Landscape)</span>
                            </button>

                            <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={onClose}
                                style={{ padding: '6px 12px', fontSize: '16px' }}
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    {/* Preview Area */}
                    <div
                        style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: '24px',
                            background: '#ffffff',
                            color: '#0f172a',
                        }}
                    >
                        {renderPrintDocument()}
                    </div>
                </div>
            </div>

            {/* Direct Body Portal for Clean Print Without Extra Pages */}
            {mounted && typeof document !== 'undefined' && createPortal(
                <div id="daily-plan-print-portal">
                    {renderPrintDocument()}
                </div>,
                document.body
            )}
        </>
    );
}
