'use client';

import { useState, useEffect, useTransition } from 'react';
import { getCompletedRepairs, addOperation, updateOperation, deleteOperation } from '@/actions/operations';
import { getProductsByCategory } from '@/actions/products';
import { getPersonnel } from '@/actions/personnel';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/state-machine';
import { PRIORITY_LABELS, OPERATION_TYPE_LABELS, REQUEST_TYPE_LABELS, CUSTOMER_TYPE_LABELS } from '@/lib/constants';

type Repair = Awaited<ReturnType<typeof getCompletedRepairs>>[0];

export default function CompletedRepairsPage() {
    const [repairs, setRepairs] = useState<Repair[]>([]);
    const [technicians, setTechnicians] = useState<any[]>([]);
    const [isPending, startTransition] = useTransition();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeId, setActiveId] = useState<string | null>(null);

    // Responsive screen detection
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Products
    const [screens, setScreens] = useState<any[]>([]);
    const [leds, setLeds] = useState<any[]>([]);
    const [lgps, setLgps] = useState<any[]>([]);
    const [accessories, setAccessories] = useState<any[]>([]);

    // Operation modal state
    const [showOp, setShowOp] = useState(false);
    const [editingOpId, setEditingOpId] = useState<string | null>(null);
    const [opType, setOpType] = useState('SCREEN_CHANGE');
    const [removed, setRemoved] = useState('');
    const [installed, setInstalled] = useState('');
    const [opNotes, setOpNotes] = useState('');
    const [selectedTechId, setSelectedTechId] = useState('');
    const [prodSearchQuery, setProdSearchQuery] = useState('');
    const [isProdDropdownOpen, setIsProdDropdownOpen] = useState(false);

    const load = () => {
        startTransition(async () => {
            const data = await getCompletedRepairs();
            setRepairs(data);
        });
    };

    useEffect(() => {
        load();
    }, []);

    useEffect(() => {
        getProductsByCategory('SCREEN').then(setScreens);
        getProductsByCategory('LED').then(setLeds);
        getProductsByCategory('LGP').then(setLgps);
        getProductsByCategory('ACCESSORY').then(setAccessories);
        getPersonnel().then(list => setTechnicians(list.filter(p => p.isActive))).catch(console.error);
    }, []);

    // Product search helper (Hide stock <= 0)
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

    const filteredRepairs = repairs.filter((r) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        const ticketNoMatch = r.ticketNo?.toLowerCase().includes(q);
        const modelMatch = r.model?.toLowerCase().includes(q);
        const brandMatch = r.brand?.name?.toLowerCase().includes(q);
        const customerMatch = r.customer?.name?.toLowerCase().includes(q);
        const repairerMatch = r.repairer?.name?.toLowerCase().includes(q);
        return ticketNoMatch || modelMatch || brandMatch || customerMatch || repairerMatch;
    });

    const handleEditOp = (op: any) => {
        setEditingOpId(op.id);
        setOpType(op.operationType);
        setRemoved(op.removedPart || '');
        setInstalled(op.installedProductId || '');
        setOpNotes(op.notes || '');
        setSelectedTechId(op.performedById || '');
        setProdSearchQuery('');
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
            setShowOp(false);
            setEditingOpId(null);
            setRemoved('');
            setInstalled('');
            setOpNotes('');
            setSelectedTechId('');
            setProdSearchQuery('');
            load();
        } catch (err: any) { alert(err.message); }
    };

    // ─────────────────────────────────────────────────────────────
    // RENDER: MOBILE LAYOUT
    // ─────────────────────────────────────────────────────────────
    if (isMobile) {
        return (
            <div style={{ padding: '14px', maxWidth: '840px', margin: '0 auto' }}>
                <div style={{
                    padding: '12px 16px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '8px',
                    marginBottom: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>✅</span>
                        <div>
                            <h1 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                                Tamamlanan İşlemler
                            </h1>
                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                Geçmiş tamamlanan tamirler ve yapılan işlemler
                            </div>
                        </div>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 700, background: 'rgba(34, 197, 94, 0.15)', color: 'var(--color-success)', padding: '4px 10px', borderRadius: '12px' }}>
                        {filteredRepairs.length} Fiş
                    </span>
                </div>

                {/* Search Box */}
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

                {filteredRepairs.length === 0 ? (
                    <div className="empty-state" style={{ padding: '30px 16px' }}>
                        <div className="empty-state-icon" style={{ fontSize: '28px', marginBottom: '8px' }}>📋</div>
                        <div className="empty-state-title" style={{ fontSize: '14px' }}>
                            {searchQuery ? 'Aramanıza uygun tamamlanan işlem bulunamadı' : 'Henüz tamamlanan işlem bulunmuyor'}
                        </div>
                    </div>
                ) : (
                    <div>
                        {filteredRepairs.map((repair) => {
                            const isLocked = repair.status === 'TESLIM_EDILDI' || repair.status === 'TAMAMLANDI';
                            const isExpanded = activeId === repair.id;

                            return (
                                <div
                                    key={repair.id}
                                    className="card"
                                    style={{
                                        marginBottom: '10px',
                                        padding: '10px 12px',
                                        border: isExpanded ? '1.5px solid var(--brand-primary)' : '1px solid var(--border-primary)',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                    }}
                                    onClick={() => setActiveId(isExpanded ? null : repair.id)}
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

                                    {isExpanded && (
                                        <div onClick={(e) => e.stopPropagation()} style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-primary)' }}>
                                            {/* Real-time Installed Parts Stock Check */}
                                            {repair.operations.some((op: any) => op.installedProduct) && (
                                                <div style={{ padding: '8px 10px', background: 'var(--bg-tertiary)', borderRadius: '6px', marginBottom: '8px', fontSize: '11.5px', border: '1px solid var(--border-primary)' }}>
                                                    <div style={{ fontWeight: 700, fontSize: '10.5px', color: 'var(--text-tertiary)', marginBottom: '4px', textTransform: 'uppercase' }}>
                                                        📦 TAKILAN EKRAN / PARÇA ANLIK STOK KONTROLÜ
                                                    </div>
                                                    {repair.operations.filter((op: any) => op.installedProduct).map((op: any) => {
                                                        const stockCount = op.installedProduct.stock ?? 0;
                                                        const hasStock = stockCount > 0;
                                                        return (
                                                            <div key={op.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '3px 0' }}>
                                                                <span style={{ fontWeight: 600 }}>{op.installedProduct.name}:</span>
                                                                <span className={`badge ${hasStock ? 'badge-success' : 'badge-danger'}`} style={{ fontWeight: 700, fontSize: '10.5px', padding: '2px 8px' }}>
                                                                    {hasStock ? `✅ STOKTA VAR (${stockCount} Adet)` : `❌ STOKTA YOK (${stockCount} Adet)`}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

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
                                                            {!isLocked ? (
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
                                                            ) : (
                                                                <span style={{ fontSize: '10.5px', color: 'var(--text-tertiary)', fontWeight: 600 }}>🔒 Kilitli</span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {isLocked ? (
                                                <div style={{ padding: '6px 10px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', borderRadius: '6px', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    🔒 Bu fiş teslim edildiği veya tamamlandığı için üzerinde tamir işlemi eklenemez / düzenlenemez.
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button className="btn btn-secondary btn-xs" style={{ flex: 1, fontSize: '11.5px', padding: '5px 10px' }} onClick={() => {
                                                        setEditingOpId(null);
                                                        setOpType('SCREEN_CHANGE');
                                                        setRemoved('');
                                                        setInstalled('');
                                                        setOpNotes('');
                                                        setSelectedTechId('');
                                                        setShowOp(true);
                                                    }}>
                                                        ➕ Ekstra İşlem Ekle
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {renderOperationModal()}
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────
    // RENDER: PC / DESKTOP LAYOUT (OPERATÖR DASHBOARD STİLİ)
    // ─────────────────────────────────────────────────────────────
    return (
        <div style={{ padding: 'var(--space-6)', maxWidth: '1440px', margin: '0 auto' }}>
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
                        ✅ Tamamlanan İşlemler Geçmişi (PC Terminali)
                    </h1>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
                        Tamamlanan tamirlerin, teslim edilen cihazların ve yapılan tüm teknik işlemlerin arşivi
                    </div>
                </div>
            </div>

            {/* PC Filter Bar */}
            <div className="card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4)' }}>
                <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '12px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                        🔍 Arama (Fiş No, Cihaz Modeli, Müşteri / Tamirci)
                    </label>
                    <input
                        type="text"
                        className="input"
                        placeholder="SP-000003, 49NU7100, Müşteri..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* PC Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {filteredRepairs.length === 0 ? (
                    <div className="empty-state" style={{ padding: '40px' }}>
                        <div className="empty-state-title">Tamamlanan işlem bulunamadı.</div>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Fiş No</th>
                                    <th>Müşteri / Tamirci</th>
                                    <th>Cihaz (Marka & Model)</th>
                                    <th>Durum</th>
                                    <th>Takılan Ekran / Parça Stok Kontrolü</th>
                                    <th>Yapılan İşlemler</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRepairs.map((repair) => {
                                    const isLocked = repair.status === 'TESLIM_EDILDI' || repair.status === 'TAMAMLANDI';
                                    return (
                                        <tr key={repair.id}>
                                            <td>
                                                <span className="badge badge-secondary" style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                                                    {repair.ticketNo}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 700 }}>{repair.customer?.name || repair.repairer?.name || '-'}</div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{CUSTOMER_TYPE_LABELS[repair.customerType as 'INDIVIDUAL' | 'REPAIRER']}</div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 700 }}>{repair.brand.name}</div>
                                                <div style={{ fontSize: '12.5px', fontFamily: 'monospace', color: 'var(--brand-primary)', fontWeight: 600 }}>{repair.model}</div>
                                            </td>
                                            <td>
                                                <span className="badge" style={{ background: `${STATUS_COLORS[repair.status]}20`, color: STATUS_COLORS[repair.status], fontSize: '11px' }}>
                                                    {STATUS_LABELS[repair.status]}
                                                </span>
                                            </td>
                                            <td>
                                                {repair.operations.filter((op: any) => op.installedProduct).length === 0 ? (
                                                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Parça takılmadı</span>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                        {repair.operations.filter((op: any) => op.installedProduct).map((op: any) => {
                                                            const stock = op.installedProduct.stock ?? 0;
                                                            const hasStock = stock > 0;
                                                            return (
                                                                <div key={op.id} style={{ fontSize: '11.5px' }}>
                                                                    <span>{op.installedProduct.name}: </span>
                                                                    <span className={`badge ${hasStock ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '10.5px', padding: '1px 5px' }}>
                                                                        {hasStock ? `✅ STOKTA VAR (${stock})` : `❌ STOKTA YOK (0)`}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    {repair.operations.map((op: any) => (
                                                        <div key={op.id} style={{ fontSize: '11.5px', padding: '4px 6px', background: 'var(--bg-secondary)', borderRadius: '4px' }}>
                                                            <strong>{OPERATION_TYPE_LABELS[op.operationType as keyof typeof OPERATION_TYPE_LABELS]}</strong>
                                                            {op.installedProduct && <span style={{ color: 'var(--brand-primary)', marginLeft: '4px' }}>→ {op.installedProduct.name}</span>}
                                                        </div>
                                                    ))}
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

            {renderOperationModal()}
        </div>
    );

    // ─────────────────────────────────────────────────────────────
    // HELPER: MODAL RENDER
    // ─────────────────────────────────────────────────────────────
    function renderOperationModal() {
        if (!showOp) return null;
        return (
            <div className="modal-overlay" onClick={() => setShowOp(false)}>
                <div className="modal" style={{ maxWidth: '540px', width: '95vw', maxHeight: '88vh', overflowY: 'auto', padding: 0 }} onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header" style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 className="modal-title" style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>
                            {editingOpId ? '✏️ İşlemi Düzenle' : '🔧 Ekstra İşlem Ekle'}
                        </h3>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowOp(false)} style={{ padding: '2px 6px' }}>✕</button>
                    </div>

                    <div className="modal-body" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {/* Shared Workshop PC Technician Selector */}
                        <div className="form-group" style={{ marginBottom: 0, padding: '8px 10px', background: 'rgba(59, 130, 246, 0.08)', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                            <label className="form-label" style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--brand-primary)', marginBottom: '3px' }}>
                                👷 İşlemi Yapan Teknisyen (Ortak PC Kullanımı)
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
                                placeholder="Sökülen parça açıklaması"
                                style={{ fontSize: '12px', padding: '4px 8px', minHeight: '32px', height: '32px' }}
                            />
                        </div>

                        <div className="form-group" style={{ position: 'relative', marginBottom: 0 }}>
                            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', fontWeight: 600, marginBottom: '3px' }}>
                                <span>Takılan Ürün {(opType === 'SCREEN_CHANGE' || opType === 'LED_CHANGE') && <span style={{ color: 'var(--color-danger)' }}>* (Zorunlu)</span>}</span>
                            </label>

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
                                    }}
                                />

                                {isProdDropdownOpen && (
                                    <>
                                        <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setIsProdDropdownOpen(false)} />
                                        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 100, maxHeight: '180px', overflowY: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '6px' }}>
                                            {filteredProducts.map((p) => {
                                                const isLimitedStock = p.stock <= 2;
                                                return (
                                                    <div
                                                        key={p.id}
                                                        onClick={() => {
                                                            setInstalled(p.id);
                                                            setProdSearchQuery('');
                                                            setIsProdDropdownOpen(false);
                                                        }}
                                                        style={{ padding: '8px 10px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', borderBottom: '1px solid var(--border-primary)' }}
                                                    >
                                                        <span>{p.name}</span>
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
                                            })}
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
                    </div>

                    <div className="modal-footer" style={{ padding: '10px 16px', borderTop: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setShowOp(false)}>İptal</button>
                        <button className="btn btn-primary btn-sm" onClick={handleAddOp}>💾 Kaydet</button>
                    </div>
                </div>
            </div>
        );
    }
}
