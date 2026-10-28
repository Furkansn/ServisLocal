'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
    getTechnicianOperationsList,
    updateOperation,
    deleteOperation,
    TechnicianOperationsFilter,
} from '@/actions/operations';
import { getProductsByCategory } from '@/actions/products';
import { getPersonnel } from '@/actions/personnel';
import {
    OPERATION_TYPE_LABELS,
    formatDateTime,
    getLocalDateString,
} from '@/lib/constants';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/state-machine';
import {
    Wrench,
    Search,
    Calendar,
    Edit3,
    Trash2,
    RotateCcw,
    CheckCircle2,
    AlertCircle,
    X,
    ExternalLink,
    Filter,
    Tv,
    Zap,
    Cpu,
    Sparkles,
    User,
    Package,
} from 'lucide-react';

type OperationRecord = Awaited<ReturnType<typeof getTechnicianOperationsList>>[0];

export default function TechnicianOperationsPage() {
    const { data: session } = useSession();
    const userRoles = (session?.user as any)?.roles || [];
    const isAuthorized = userRoles.includes('OPERATOR') || userRoles.includes('COMPANY_ADMIN');

    const [operations, setOperations] = useState<OperationRecord[]>([]);
    const [technicians, setTechnicians] = useState<any[]>([]);
    const [isPending, startTransition] = useTransition();
    const [initialLoading, setInitialLoading] = useState(true);

    // Filters
    const [datePreset, setDatePreset] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month'>('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedTechId, setSelectedTechId] = useState('ALL');
    const [selectedOpType, setSelectedOpType] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    // Catalog for editing
    const [screens, setScreens] = useState<any[]>([]);
    const [leds, setLeds] = useState<any[]>([]);
    const [lgps, setLgps] = useState<any[]>([]);
    const [accessories, setAccessories] = useState<any[]>([]);

    // Edit Modal State
    const [editingOp, setEditingOp] = useState<OperationRecord | null>(null);
    const [editOpType, setEditOpType] = useState('SCREEN_CHANGE');
    const [editTechId, setEditTechId] = useState('');
    const [editInstalledId, setEditInstalledId] = useState('');
    const [editRemovedPart, setEditRemovedPart] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [prodSearch, setProdSearch] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionSuccess, setActionSuccess] = useState<string | null>(null);

    // Load initial reference data
    useEffect(() => {
        getPersonnel().then(list => setTechnicians(list.filter(p => p.isActive))).catch(console.error);
        getProductsByCategory('SCREEN').then(setScreens).catch(console.error);
        getProductsByCategory('LED').then(setLeds).catch(console.error);
        getProductsByCategory('LGP').then(setLgps).catch(console.error);
        getProductsByCategory('ACCESSORY').then(setAccessories).catch(console.error);
    }, []);

    // Load operations from server
    const loadOperations = () => {
        startTransition(async () => {
            try {
                const filter: TechnicianOperationsFilter = {};
                if (startDate) filter.startDate = startDate;
                if (endDate) filter.endDate = endDate;
                if (selectedTechId !== 'ALL') filter.technicianId = selectedTechId;
                if (selectedOpType !== 'ALL') filter.operationType = selectedOpType;
                if (searchQuery.trim()) filter.search = searchQuery.trim();

                const data = await getTechnicianOperationsList(filter);
                setOperations(data);
            } catch (err: any) {
                console.error('Veri yüklenirken hata:', err);
            } finally {
                setInitialLoading(false);
            }
        });
    };

    // Trigger load on filter change
    useEffect(() => {
        loadOperations();
    }, [startDate, endDate, selectedTechId, selectedOpType]);

    // Handle Date Presets
    const handlePresetChange = (preset: 'all' | 'today' | 'yesterday' | 'week' | 'month') => {
        setDatePreset(preset);
        const todayStr = getLocalDateString(new Date());

        if (preset === 'all') {
            setStartDate('');
            setEndDate('');
        } else if (preset === 'today') {
            setStartDate(todayStr);
            setEndDate(todayStr);
        } else if (preset === 'yesterday') {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yestStr = getLocalDateString(yesterday);
            setStartDate(yestStr);
            setEndDate(yestStr);
        } else if (preset === 'week') {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            setStartDate(getLocalDateString(weekAgo));
            setEndDate(todayStr);
        } else if (preset === 'month') {
            const firstOfMonth = new Date();
            firstOfMonth.setDate(1);
            setStartDate(getLocalDateString(firstOfMonth));
            setEndDate(todayStr);
        }
    };

    // Client-side quick filter on search text
    const filteredOperations = useMemo(() => {
        if (!searchQuery.trim()) return operations;
        const q = searchQuery.toLowerCase().trim();
        return operations.filter(op => {
            const ticketNo = op.ticket?.ticketNo?.toLowerCase() || '';
            const model = op.ticket?.model?.toLowerCase() || '';
            const brand = op.ticket?.brand?.name?.toLowerCase() || '';
            const customer = op.ticket?.customer?.name?.toLowerCase() || '';
            const repairer = op.ticket?.repairer?.name?.toLowerCase() || '';
            const tech = op.performedBy?.name?.toLowerCase() || '';
            const prod = op.installedProduct?.name?.toLowerCase() || '';
            const removed = op.removedPart?.toLowerCase() || '';
            const notes = op.notes?.toLowerCase() || '';
            return ticketNo.includes(q) || model.includes(q) || brand.includes(q) ||
                customer.includes(q) || repairer.includes(q) || tech.includes(q) ||
                prod.includes(q) || removed.includes(q) || notes.includes(q);
        });
    }, [operations, searchQuery]);

    // Stats calculations
    const stats = useMemo(() => {
        const total = filteredOperations.length;
        const screenCount = filteredOperations.filter(o => o.operationType === 'SCREEN_CHANGE').length;
        const ledCount = filteredOperations.filter(o => o.operationType === 'LED_CHANGE').length;
        const boardCount = filteredOperations.filter(o => o.operationType === 'BOARD_REPAIR').length;
        const lgpOrOtherCount = total - (screenCount + ledCount + boardCount);

        // Unique technicians who performed operations
        const techSet = new Set(filteredOperations.map(o => o.performedById).filter(Boolean));
        return { total, screenCount, ledCount, boardCount, lgpOrOtherCount, activeTechs: techSet.size };
    }, [filteredOperations]);

    // Available products for modal picker based on selected operation type
    const availableProducts = useMemo(() => {
        let list: any[] = [];
        if (editOpType === 'SCREEN_CHANGE') list = screens;
        else if (editOpType === 'LED_CHANGE') list = leds;
        else if (editOpType === 'LGP_CHANGE') list = lgps;
        else list = [...screens, ...leds, ...lgps, ...accessories];

        if (!prodSearch.trim()) return list;
        const q = prodSearch.toLowerCase().trim();
        return list.filter(p => p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q));
    }, [editOpType, screens, leds, lgps, accessories, prodSearch]);

    // Open Edit Modal
    const handleOpenEdit = (op: OperationRecord) => {
        setEditingOp(op);
        setEditOpType(op.operationType);
        setEditTechId(op.performedById || '');
        setEditInstalledId(op.installedProductId || '');
        setEditRemovedPart(op.removedPart || '');
        setEditNotes(op.notes || '');
        setProdSearch('');
        setActionError(null);
        setActionSuccess(null);
    };

    // Save Edit
    const handleSaveEdit = async () => {
        if (!editingOp) return;
        setIsSaving(true);
        setActionError(null);

        try {
            await updateOperation({
                operationId: editingOp.id,
                operationType: editOpType,
                removedPart: editRemovedPart || undefined,
                installedProductId: editInstalledId || undefined,
                notes: editNotes || undefined,
                performedById: editTechId || undefined,
            });

            setActionSuccess('İşlem başarıyla revize edildi.');
            setTimeout(() => {
                setEditingOp(null);
                setActionSuccess(null);
                loadOperations();
            }, 800);
        } catch (err: any) {
            setActionError(err.message || 'Revize işlemi kaydedilemedi');
        } finally {
            setIsSaving(false);
        }
    };

    // Delete Operation
    const handleDeleteOp = async (op: OperationRecord) => {
        const confirmMsg = `Bu teknisyen işlemini silmek istediğinize emin misiniz?\n\nFiş No: ${op.ticket?.ticketNo}\nİşlem: ${OPERATION_TYPE_LABELS[op.operationType as keyof typeof OPERATION_TYPE_LABELS] || op.operationType}\n\nNot: Eğer takılan bir ürün varsa stoku geri yüklenecektir.`;
        if (!confirm(confirmMsg)) return;

        try {
            await deleteOperation(op.id);
            loadOperations();
        } catch (err: any) {
            alert('Hata: ' + (err.message || 'İşlem silinemedi'));
        }
    };

    // Reset filters
    const handleResetFilters = () => {
        setDatePreset('all');
        setStartDate('');
        setEndDate('');
        setSelectedTechId('ALL');
        setSelectedOpType('ALL');
        setSearchQuery('');
    };

    const getOpTypeBadge = (type: string) => {
        switch (type) {
            case 'SCREEN_CHANGE':
                return {
                    label: 'Ekran Değişimi',
                    bg: 'rgba(99, 102, 241, 0.15)',
                    border: 'rgba(99, 102, 241, 0.4)',
                    text: '#818cf8',
                    icon: '🖥️',
                };
            case 'LED_CHANGE':
                return {
                    label: 'LED Değişimi',
                    bg: 'rgba(234, 179, 8, 0.15)',
                    border: 'rgba(234, 179, 8, 0.4)',
                    text: '#facc15',
                    icon: '💡',
                };
            case 'LGP_CHANGE':
                return {
                    label: 'LGP Değişimi',
                    bg: 'rgba(14, 165, 233, 0.15)',
                    border: 'rgba(14, 165, 233, 0.4)',
                    text: '#38bdf8',
                    icon: '🔆',
                };
            case 'BOARD_REPAIR':
                return {
                    label: 'Kart Tamiri',
                    bg: 'rgba(239, 68, 68, 0.15)',
                    border: 'rgba(239, 68, 68, 0.4)',
                    text: '#f87171',
                    icon: '⚡',
                };
            default:
                return {
                    label: OPERATION_TYPE_LABELS[type as keyof typeof OPERATION_TYPE_LABELS] || type,
                    bg: 'rgba(148, 163, 184, 0.15)',
                    border: 'rgba(148, 163, 184, 0.4)',
                    text: '#cbd5e1',
                    icon: '🛠️',
                };
        }
    };

    return (
        <div className="technician-operations-container" style={{ padding: '16px 20px', width: '100%', maxWidth: '100%', boxSizing: 'border-box', fontFamily: 'Inter, system-ui, sans-serif' }}>
            
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '24px',
                flexWrap: 'wrap',
                gap: '16px',
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '26px' }}>🛠️</span>
                        <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                            Teknisyen İşlemleri
                        </h1>
                        <span style={{
                            background: 'rgba(59, 130, 246, 0.15)',
                            color: '#3b82f6',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            padding: '3px 10px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: 700,
                        }}>
                            Operatör & Firma Denetimi
                        </span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', marginTop: '6px', margin: 0 }}>
                        Atölyede teknisyenler tarafından girilen tüm parça değişim ve tamir işlemlerini listeleyin, filtreleyin ve gerektiğinde anında revize edin.
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                        onClick={loadOperations}
                        disabled={isPending}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer' }}
                        title="Listeyi Yenile"
                    >
                        <RotateCcw size={15} className={isPending ? 'animate-spin' : ''} />
                        <span>Yenile</span>
                    </button>
                    <Link
                        href="/tv-display"
                        className="btn btn-primary btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', textDecoration: 'none' }}
                    >
                        <Tv size={15} />
                        <span>TV Atölye Paneli</span>
                    </Link>
                </div>
            </div>

            {/* Stat Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                marginBottom: '24px',
            }}>
                {/* 1. Toplam İşlem */}
                <div style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '12px',
                    padding: '18px 20px',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <div>
                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Toplam İşlem
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', marginTop: '4px' }}>
                            {stats.total}
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {stats.activeTechs} farklı teknisyen
                        </div>
                    </div>
                    <div style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '12px', borderRadius: '12px' }}>
                        <Wrench size={24} />
                    </div>
                </div>

                {/* 2. Ekran Değişimi */}
                <div style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '12px',
                    padding: '18px 20px',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <div>
                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Ekran Değişimi
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 900, color: '#6366f1', marginTop: '4px' }}>
                            {stats.screenCount}
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            Panel Değiştirilen Cihazlar
                        </div>
                    </div>
                    <div style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', padding: '12px', borderRadius: '12px' }}>
                        <Tv size={24} />
                    </div>
                </div>

                {/* 3. LED Değişimi */}
                <div style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '12px',
                    padding: '18px 20px',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <div>
                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            LED Değişimi
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 900, color: '#eab308', marginTop: '4px' }}>
                            {stats.ledCount}
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            Arka Aydınlatma Seti
                        </div>
                    </div>
                    <div style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', padding: '12px', borderRadius: '12px' }}>
                        <Zap size={24} />
                    </div>
                </div>

                {/* 4. Anakart & Diğer */}
                <div style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '12px',
                    padding: '18px 20px',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <div>
                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Kart & LGP & Diğer
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 900, color: '#10b981', marginTop: '4px' }}>
                            {stats.boardCount + stats.lgpOrOtherCount}
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            Onarım ve revizyonlar
                        </div>
                    </div>
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '12px', borderRadius: '12px' }}>
                        <Cpu size={24} />
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                borderRadius: '12px',
                padding: '16px 20px',
                marginBottom: '20px',
                boxShadow: 'var(--shadow-sm)',
            }}>
                {/* Quick Date Presets */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '14px', borderBottom: '1px solid var(--border-primary)', paddingBottom: '12px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginRight: '6px' }}>
                        <Calendar size={14} /> Tarih Aralığı:
                    </span>
                    {(['all', 'today', 'yesterday', 'week', 'month'] as const).map(preset => {
                        const labels = {
                            all: 'Tüm Zamanlar',
                            today: 'Bugün',
                            yesterday: 'Dün',
                            week: 'Son 7 Gün',
                            month: 'Bu Ay',
                        };
                        const isActive = datePreset === preset;
                        return (
                            <button
                                key={preset}
                                onClick={() => handlePresetChange(preset)}
                                style={{
                                    padding: '5px 12px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: isActive ? 700 : 500,
                                    background: isActive ? 'var(--brand-primary, #6366f1)' : 'var(--bg-tertiary, rgba(255,255,255,0.05))',
                                    color: isActive ? '#ffffff' : 'var(--text-secondary)',
                                    border: `1px solid ${isActive ? 'var(--brand-primary, #6366f1)' : 'var(--border-primary)'}`,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                }}
                            >
                                {labels[preset]}
                            </button>
                        );
                    })}

                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                            onClick={handleResetFilters}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-tertiary)',
                                fontSize: '12px',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                padding: '4px 6px',
                            }}
                        >
                            Filtreleri Sıfırla
                        </button>
                    </div>
                </div>

                {/* Filter Inputs Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '12px',
                    alignItems: 'center',
                }}>
                    {/* Live Search */}
                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                        <input
                            type="text"
                            placeholder="Fiş no, model, müşteri, parça kodu..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '9px 12px 9px 36px',
                                background: 'var(--bg-input, #0f172a)',
                                border: '1px solid var(--border-primary)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                fontSize: '13px',
                                outline: 'none',
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    {/* Start Date */}
                    <div>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => {
                                setStartDate(e.target.value);
                                setDatePreset('all');
                            }}
                            title="Başlangıç Tarihi"
                            style={{
                                width: '100%',
                                padding: '9px 12px',
                                background: 'var(--bg-input, #0f172a)',
                                border: '1px solid var(--border-primary)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                fontSize: '13px',
                                outline: 'none',
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    {/* End Date */}
                    <div>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => {
                                setEndDate(e.target.value);
                                setDatePreset('all');
                            }}
                            title="Bitiş Tarihi"
                            style={{
                                width: '100%',
                                padding: '9px 12px',
                                background: 'var(--bg-input, #0f172a)',
                                border: '1px solid var(--border-primary)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                fontSize: '13px',
                                outline: 'none',
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    {/* Technician Selector */}
                    <div>
                        <select
                            value={selectedTechId}
                            onChange={(e) => setSelectedTechId(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '9px 12px',
                                background: 'var(--bg-input, #0f172a)',
                                border: '1px solid var(--border-primary)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                fontSize: '13px',
                                outline: 'none',
                                boxSizing: 'border-box',
                                cursor: 'pointer',
                            }}
                        >
                            <option value="ALL">👤 Tüm Teknisyenler</option>
                            {technicians.map((t) => (
                                <option key={t.id} value={t.id}>
                                    👤 {t.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Operation Type Selector */}
                    <div>
                        <select
                            value={selectedOpType}
                            onChange={(e) => setSelectedOpType(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '9px 12px',
                                background: 'var(--bg-input, #0f172a)',
                                border: '1px solid var(--border-primary)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                fontSize: '13px',
                                outline: 'none',
                                boxSizing: 'border-box',
                                cursor: 'pointer',
                            }}
                        >
                            <option value="ALL">🛠️ Tüm İşlem Türleri</option>
                            <option value="SCREEN_CHANGE">🖥️ Ekran Değişimi</option>
                            <option value="LED_CHANGE">💡 LED Değişimi</option>
                            <option value="LGP_CHANGE">🔆 LGP Değişimi</option>
                            <option value="BOARD_REPAIR">⚡ Kart Tamiri</option>
                            <option value="OTHER">🛠️ Diğer İşlemler</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Operations Table */}
            <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-sm)',
            }}>
                <div style={{
                    padding: '14px 20px',
                    borderBottom: '1px solid var(--border-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--bg-tertiary, rgba(255,255,255,0.02))',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '16px' }}>📋</span>
                        <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                            İşlem Kayıtları
                        </h2>
                        <span style={{
                            background: 'rgba(59, 130, 246, 0.12)',
                            color: '#3b82f6',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                        }}>
                            {filteredOperations.length} Kayıt
                        </span>
                    </div>

                    {isPending && (
                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <RotateCcw size={13} className="animate-spin" /> Veriler güncelleniyor...
                        </div>
                    )}
                </div>

                <div style={{ width: '100%' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                        <thead>
                            <tr style={{
                                background: 'var(--bg-tertiary, rgba(255,255,255,0.04))',
                                color: 'var(--text-tertiary)',
                                textTransform: 'uppercase',
                                fontSize: '10.5px',
                                letterSpacing: '0.5px',
                                borderBottom: '1px solid var(--border-primary)',
                            }}>
                                <th style={{ padding: '10px 12px', width: '13%' }}>Fiş & Tarih</th>
                                <th style={{ padding: '10px 12px', width: '22%' }}>Cihaz & Müşteri</th>
                                <th style={{ padding: '10px 10px', width: '14%' }}>İşlem Türü</th>
                                <th style={{ padding: '10px 12px', width: '22%' }}>Parça (Takılan / Çıkan)</th>
                                <th style={{ padding: '10px 10px', width: '12%' }}>Teknisyen</th>
                                <th style={{ padding: '10px 10px', width: '9%' }}>Notlar</th>
                                <th style={{ padding: '10px 12px', width: '8%', textAlign: 'right' }}>Aksiyon</th>
                            </tr>
                        </thead>
                        <tbody>
                            {initialLoading ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                                        <RotateCcw size={22} className="animate-spin" style={{ margin: '0 auto 10px' }} />
                                        <div>İşlem kayıtları yükleniyor...</div>
                                    </td>
                                </tr>
                            ) : filteredOperations.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</div>
                                        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)' }}>Kriterlere uygun işlem bulunamadı</div>
                                        <div style={{ fontSize: '12.5px', marginTop: '4px' }}>Filtreleri temizleyerek veya farklı bir tarih seçerek tekrar deneyin.</div>
                                        <button
                                            onClick={handleResetFilters}
                                            style={{
                                                marginTop: '12px',
                                                background: 'var(--brand-primary, #6366f1)',
                                                color: '#ffffff',
                                                border: 'none',
                                                padding: '6px 14px',
                                                borderRadius: '6px',
                                                fontSize: '12px',
                                                cursor: 'pointer',
                                                fontWeight: 600,
                                            }}
                                        >
                                            Filtreleri Sıfırla
                                        </button>
                                    </td>
                                </tr>
                            ) : (
                                filteredOperations.map((op, idx) => {
                                    const badge = getOpTypeBadge(op.operationType);
                                    const ticket = op.ticket;
                                    const customerName = ticket?.customer?.name || ticket?.repairer?.name || 'Belirtilmemiş';
                                    const isRepairer = ticket?.customerType === 'REPAIRER';

                                    return (
                                        <tr
                                            key={op.id}
                                            style={{
                                                borderBottom: '1px solid var(--border-primary)',
                                                background: idx % 2 === 0 ? 'transparent' : 'var(--bg-tertiary, rgba(255,255,255,0.015))',
                                                transition: 'background 0.15s ease',
                                            }}
                                        >
                                            {/* SÜTUN 1: Fiş No & Tarih */}
                                            <td style={{ padding: '9px 12px' }}>
                                                {ticket ? (
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                            <Link
                                                                href={`/tickets/${ticket.id}`}
                                                                target="_blank"
                                                                style={{
                                                                    color: 'var(--brand-primary, #38bdf8)',
                                                                    fontWeight: 800,
                                                                    textDecoration: 'none',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '3px',
                                                                    fontFamily: 'monospace',
                                                                    fontSize: '13px',
                                                                }}
                                                                title="Fiş Detayını Aç"
                                                            >
                                                                {ticket.ticketNo}
                                                                <ExternalLink size={11} />
                                                            </Link>
                                                            {ticket.status && (
                                                                <span style={{
                                                                    fontSize: '9.5px',
                                                                    padding: '1px 5px',
                                                                    borderRadius: '4px',
                                                                    fontWeight: 700,
                                                                    background: `${STATUS_COLORS[ticket.status as keyof typeof STATUS_COLORS] || '#64748b'}20`,
                                                                    color: STATUS_COLORS[ticket.status as keyof typeof STATUS_COLORS] || '#94a3b8',
                                                                    whiteSpace: 'nowrap',
                                                                }}>
                                                                    {STATUS_LABELS[ticket.status as keyof typeof STATUS_LABELS] || ticket.status}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <span>📅</span> {formatDateTime(op.createdAt)}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span style={{ color: 'var(--text-tertiary)' }}>-</span>
                                                )}
                                            </td>

                                            {/* SÜTUN 2: Cihaz Modeli & Müşteri */}
                                            <td style={{ padding: '9px 12px' }}>
                                                <div style={{
                                                    fontWeight: 700,
                                                    color: 'var(--text-primary)',
                                                    fontSize: '12.5px',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }} title={[ticket?.brand?.name, ticket?.model].filter(Boolean).join(' ')}>
                                                    {[ticket?.brand?.name, ticket?.model].filter(Boolean).join(' ') || '-'}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px', fontSize: '11px' }}>
                                                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }} title={customerName}>
                                                        {customerName}
                                                    </span>
                                                    <span style={{
                                                        fontSize: '9.5px',
                                                        padding: '1px 5px',
                                                        borderRadius: '3px',
                                                        fontWeight: 700,
                                                        background: isRepairer ? 'rgba(234, 179, 8, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                                        color: isRepairer ? '#fde047' : '#93c5fd',
                                                        flexShrink: 0,
                                                    }}>
                                                        {isRepairer ? 'Tamirci' : 'Bireysel'}
                                                    </span>
                                                    {ticket?.serialNo && (
                                                        <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90px' }} title={`Seri No: ${ticket.serialNo}`}>
                                                            SN:{ticket.serialNo}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* SÜTUN 3: İşlem Türü */}
                                            <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
                                                <span style={{
                                                    background: badge.bg,
                                                    border: `1px solid ${badge.border}`,
                                                    color: badge.text,
                                                    padding: '2px 8px',
                                                    borderRadius: '6px',
                                                    fontWeight: 700,
                                                    fontSize: '11px',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                }}>
                                                    <span>{badge.icon}</span>
                                                    <span>{badge.label}</span>
                                                </span>
                                            </td>

                                            {/* SÜTUN 4: Parça (Takılan / Çıkan) */}
                                            <td style={{ padding: '9px 12px' }}>
                                                {op.installedProduct ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                        <span style={{ fontWeight: 700, color: '#38bdf8', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }} title={op.installedProduct.name}>
                                                            📦 {op.installedProduct.name}
                                                        </span>
                                                        <span style={{ fontSize: '10px', color: op.installedProduct.stock > 0 ? '#10b981' : '#ef4444', fontWeight: 700, flexShrink: 0 }}>
                                                            ({op.installedProduct.stock})
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic', fontSize: '11px' }}>
                                                        Stoklu parça seçilmedi
                                                    </span>
                                                )}
                                                {op.removedPart && (
                                                    <div style={{ marginTop: '2px' }}>
                                                        <span style={{
                                                            background: 'var(--bg-tertiary, rgba(255,255,255,0.06))',
                                                            border: '1px solid var(--border-primary)',
                                                            padding: '1px 5px',
                                                            borderRadius: '3px',
                                                            fontFamily: 'monospace',
                                                            fontSize: '10.5px',
                                                            color: '#cbd5e1',
                                                            display: 'inline-block',
                                                            maxWidth: '180px',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                        }} title={`Çıkan Parça / Panel: ${op.removedPart}`}>
                                                            Çıkan: {op.removedPart}
                                                        </span>
                                                    </div>
                                                )}
                                            </td>

                                            {/* SÜTUN 5: Teknisyen */}
                                            <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--text-primary)', fontSize: '12px' }}>
                                                    <div style={{
                                                        width: '20px',
                                                        height: '20px',
                                                        borderRadius: '50%',
                                                        background: 'rgba(59, 130, 246, 0.2)',
                                                        color: '#60a5fa',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '10px',
                                                        fontWeight: 800,
                                                        flexShrink: 0,
                                                    }}>
                                                        {op.performedBy?.name ? op.performedBy.name.charAt(0).toUpperCase() : 'T'}
                                                    </div>
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px' }} title={op.performedBy?.name || ''}>
                                                        {op.performedBy?.name || 'Bilinmiyor'}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* SÜTUN 6: Notlar */}
                                            <td style={{ padding: '9px 10px', maxWidth: '120px' }}>
                                                {op.notes ? (
                                                    <div style={{
                                                        fontSize: '11px',
                                                        color: 'var(--text-secondary)',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                    }} title={op.notes}>
                                                        📝 {op.notes}
                                                    </div>
                                                ) : (
                                                    <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>-</span>
                                                )}
                                            </td>

                                            {/* SÜTUN 7: Aksiyonlar */}
                                            <td style={{ padding: '9px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                    <button
                                                        onClick={() => handleOpenEdit(op)}
                                                        style={{
                                                            background: 'rgba(59, 130, 246, 0.15)',
                                                            color: '#60a5fa',
                                                            border: '1px solid rgba(59, 130, 246, 0.3)',
                                                            padding: '4px 8px',
                                                            borderRadius: '5px',
                                                            cursor: 'pointer',
                                                            fontSize: '11px',
                                                            fontWeight: 700,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '3px',
                                                            transition: 'all 0.15s ease',
                                                        }}
                                                        title="Bu işlemi revize et / düzenle"
                                                    >
                                                        <Edit3 size={12} />
                                                        <span>Revize</span>
                                                    </button>

                                                    <button
                                                        onClick={() => handleDeleteOp(op)}
                                                        style={{
                                                            background: 'rgba(239, 68, 68, 0.1)',
                                                            color: '#f87171',
                                                            border: '1px solid rgba(239, 68, 68, 0.25)',
                                                            padding: '4px 6px',
                                                            borderRadius: '5px',
                                                            cursor: 'pointer',
                                                            fontSize: '11px',
                                                            transition: 'all 0.15s ease',
                                                        }}
                                                        title="İşlemi Sil"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Revize (Edit) Modal */}
            {editingOp && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.75)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    backdropFilter: 'blur(4px)',
                    padding: '20px',
                    boxSizing: 'border-box',
                }}>
                    <div style={{
                        background: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '560px',
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        overflow: 'hidden',
                        color: '#f8fafc',
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            padding: '16px 20px',
                            borderBottom: '1px solid #334155',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: '#111827',
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>🛠️</span> Teknisyen İşlemini Revize Et
                                </h3>
                                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '3px' }}>
                                    Fiş: <strong style={{ color: '#38bdf8' }}>{editingOp.ticket?.ticketNo}</strong> — {[editingOp.ticket?.brand?.name, editingOp.ticket?.model].filter(Boolean).join(' ')}
                                </div>
                            </div>
                            <button
                                onClick={() => setEditingOp(null)}
                                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {actionError && (
                                <div style={{
                                    background: 'rgba(239, 68, 68, 0.15)',
                                    border: '1px solid rgba(239, 68, 68, 0.4)',
                                    color: '#fca5a5',
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    fontSize: '12.5px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                }}>
                                    <AlertCircle size={16} />
                                    <span>{actionError}</span>
                                </div>
                            )}

                            {actionSuccess && (
                                <div style={{
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    border: '1px solid rgba(16, 185, 129, 0.4)',
                                    color: '#6ee7b7',
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    fontSize: '12.5px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                }}>
                                    <CheckCircle2 size={16} />
                                    <span>{actionSuccess}</span>
                                </div>
                            )}

                            {/* 1. İşlem Türü */}
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                                    İşlem Türü *
                                </label>
                                <select
                                    value={editOpType}
                                    onChange={(e) => {
                                        setEditOpType(e.target.value);
                                        setEditInstalledId(''); // Reset product when type changes
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        background: '#0f172a',
                                        border: '1px solid #334155',
                                        borderRadius: '8px',
                                        color: '#ffffff',
                                        fontSize: '13px',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                    }}
                                >
                                    <option value="SCREEN_CHANGE">🖥️ Ekran Değişimi</option>
                                    <option value="LED_CHANGE">💡 LED Değişimi</option>
                                    <option value="LGP_CHANGE">🔆 LGP Değişimi</option>
                                    <option value="BOARD_REPAIR">⚡ Kart Tamiri</option>
                                    <option value="OTHER">🛠️ Diğer İşlem</option>
                                </select>
                            </div>

                            {/* 2. İşlemi Yapan Teknisyen */}
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                                    İşlemi Yapan Teknisyen *
                                </label>
                                <select
                                    value={editTechId}
                                    onChange={(e) => setEditTechId(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        background: '#0f172a',
                                        border: '1px solid #334155',
                                        borderRadius: '8px',
                                        color: '#ffffff',
                                        fontSize: '13px',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                    }}
                                >
                                    <option value="">Teknisyen Seçiniz...</option>
                                    {technicians.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            👤 {t.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* 3. Takılan Ürün (Stok) */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#cbd5e1' }}>
                                        Takılan Parça / Ürün (Stoktan Düşülecek)
                                    </label>
                                    {editInstalledId && (
                                        <button
                                            type="button"
                                            onClick={() => setEditInstalledId('')}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                color: '#f87171',
                                                fontSize: '11px',
                                                cursor: 'pointer',
                                                textDecoration: 'underline',
                                            }}
                                        >
                                            Ürünü Kaldır (Parçasız Yap)
                                        </button>
                                    )}
                                </div>

                                {/* Current selection indicator */}
                                {editInstalledId ? (
                                    <div style={{
                                        background: '#0f172a',
                                        border: '1px solid #38bdf8',
                                        borderRadius: '8px',
                                        padding: '8px 12px',
                                        marginBottom: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 700 }}>
                                                {availableProducts.find(p => p.id === editInstalledId)?.name || editingOp.installedProduct?.name || 'Seçili Ürün'}
                                            </div>
                                            <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                                                Mevcut Parça Değişimi
                                            </div>
                                        </div>
                                        <span style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                                            Aktif Seçim
                                        </span>
                                    </div>
                                ) : (
                                    <div style={{ fontSize: '11.5px', color: '#94a3b8', marginBottom: '6px', fontStyle: 'italic' }}>
                                        Şu anda takılan bir parça seçili değil.
                                    </div>
                                )}

                                {/* Product search & select */}
                                <input
                                    type="text"
                                    placeholder="Ürün adı veya kodu ara..."
                                    value={prodSearch}
                                    onChange={(e) => setProdSearch(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        background: '#0f172a',
                                        border: '1px solid #334155',
                                        borderRadius: '8px',
                                        color: '#ffffff',
                                        fontSize: '12px',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                        marginBottom: '6px',
                                    }}
                                />

                                <select
                                    value={editInstalledId}
                                    onChange={(e) => setEditInstalledId(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '9px 12px',
                                        background: '#0f172a',
                                        border: '1px solid #334155',
                                        borderRadius: '8px',
                                        color: '#ffffff',
                                        fontSize: '12.5px',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                        maxHeight: '120px',
                                    }}
                                >
                                    <option value="">(Stoklu Ürün Seçilmesin)</option>
                                    {availableProducts.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} {p.sku ? `[${p.sku}]` : ''} - (Stok: {p.stock})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* 4. Çıkan Parça / Panel Kodu */}
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                                    Çıkan Parça / Panel Kodu
                                </label>
                                <input
                                    type="text"
                                    placeholder="Örn: LC550DUY-SHA1 veya Panel Etiket Kodu"
                                    value={editRemovedPart}
                                    onChange={(e) => setEditRemovedPart(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        background: '#0f172a',
                                        border: '1px solid #334155',
                                        borderRadius: '8px',
                                        color: '#ffffff',
                                        fontSize: '13px',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                    }}
                                />
                            </div>

                            {/* 5. Notlar */}
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                                    İşlem Notları / Açıklama
                                </label>
                                <textarea
                                    rows={3}
                                    placeholder="İşlemle alakalı notlar..."
                                    value={editNotes}
                                    onChange={(e) => setEditNotes(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        background: '#0f172a',
                                        border: '1px solid #334155',
                                        borderRadius: '8px',
                                        color: '#ffffff',
                                        fontSize: '13px',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                        resize: 'vertical',
                                    }}
                                />
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div style={{
                            padding: '14px 20px',
                            borderTop: '1px solid #334155',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '10px',
                            background: '#111827',
                        }}>
                            <button
                                type="button"
                                onClick={() => setEditingOp(null)}
                                disabled={isSaving}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    border: '1px solid #475569',
                                    background: 'transparent',
                                    color: '#cbd5e1',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                Vazgeç
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveEdit}
                                disabled={isSaving}
                                style={{
                                    padding: '8px 18px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: '#3b82f6',
                                    color: '#ffffff',
                                    fontSize: '13px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                }}
                            >
                                {isSaving ? (
                                    <>
                                        <RotateCcw size={14} className="animate-spin" />
                                        <span>Kaydediliyor...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={15} />
                                        <span>Değişiklikleri Kaydet (Revize Et)</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
