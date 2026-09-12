'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
    Search,
    Eye,
    EyeOff,
    Plus,
    Trash2,
    ArrowUpDown,
    Save,
    X,
    Check,
    Tv,
    Lightbulb,
    GripVertical,
    Layers,
    LayoutGrid
} from 'lucide-react';
import {
    getPriceListData,
    savePriceListData,
    searchTVModels,
    getModelSummaryAction
} from '@/actions/priceList';
import {
    PriceListData,
    ScreenPriceItem,
    LedPriceItem,
    INITIAL_PRICE_LIST
} from '@/lib/price-list-types';

function splitIntoChunks<T>(array: T[], chunkCount: number): T[][] {
    if (!array || array.length === 0) return Array.from({ length: chunkCount }, () => []);
    const safeCount = Math.max(1, chunkCount);
    const result: T[][] = [];
    const perChunk = Math.ceil(array.length / safeCount);
    for (let i = 0; i < safeCount; i++) {
        result.push(array.slice(i * perChunk, (i + 1) * perChunk));
    }
    return result;
}

function formatCurrencyTL(val: number | undefined | null): string {
    if (val === undefined || val === null || isNaN(val) || val === 0) return '-';
    return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Math.round(val)) + ' ₺';
}

function formatCurrencyUSD(val: number | undefined | null): string {
    if (val === undefined || val === null || isNaN(val) || val === 0) return '-';
    return '$' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(val);
}

function formatDateValue(val: any): string {
    if (!val) return '-';
    const str = String(val).trim();
    if (/^\d{4,5}(\.\d+)?$/.test(str)) {
        const num = parseFloat(str);
        const dateObj = new Date(Math.round((num - 25569) * 86400 * 1000));
        if (!isNaN(dateObj.getTime())) {
            return dateObj.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
    }
    return str;
}

function isValidValue(val: any): boolean {
    if (!val) return false;
    const str = String(val).trim().toLowerCase();
    return str !== '' && str !== 'false' && str !== 'true' && str !== 'null' && str !== 'undefined' && str !== '-';
}

export default function PriceListPage() {
    const { data: session, status } = useSession();
    const userRoles = (session?.user as any)?.roles || [];
    const isOperator = userRoles.includes('OPERATOR');

    // Data states
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Selected record detail modal (for past repair tickets)
    const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

    // Main Price List Content
    const [usdRate, setUsdRate] = useState<number>(48.60);
    const [usdRateInput, setUsdRateInput] = useState<string>('48.60');
    const [screenItems, setScreenItems] = useState<ScreenPriceItem[]>([]);
    const [ledItems, setLedItems] = useState<LedPriceItem[]>([]);

    // View & Visibility Preferences
    const [showCosts, setShowCosts] = useState<boolean>(true);
    const [tableSearchQuery, setTableSearchQuery] = useState<string>('');
    // Görünüm Modu: 'ALL' (Tümü - İkisi bir arada) | 'SCREEN' (Sadece Ekran) | 'LED' (Sadece LED)
    const [viewMode, setViewMode] = useState<'ALL' | 'SCREEN' | 'LED'>('ALL');
    // Sadece Ekran seçildiğinde kaç sütun yan yana gösterilsin: 2 | 3 | 4 (Varsayılan 3 sütun - kaydırmasız tam görünüm)
    const [screenCols, setScreenCols] = useState<number>(3);
    // Sadece LED seçildiğinde kolon sayısı: 1 | 2 (Varsayılan 2 sütun)
    const [ledCols, setLedCols] = useState<number>(2);

    // Sorting states
    const [screenSortCol, setScreenSortCol] = useState<string | null>(null);
    const [screenSortAsc, setScreenSortAsc] = useState<boolean>(true);
    const [ledSortCol, setLedSortCol] = useState<string | null>(null);
    const [ledSortAsc, setLedSortAsc] = useState<boolean>(true);

    // Editing states
    const [editingScreenId, setEditingScreenId] = useState<string | null>(null);
    const [editingLedId, setEditingLedId] = useState<string | null>(null);

    // Drag & Drop reorder states
    const [draggedScreenIdx, setDraggedScreenIdx] = useState<number | null>(null);
    const [dragOverScreenIdx, setDragOverScreenIdx] = useState<number | null>(null);
    const [draggedLedIdx, setDraggedLedIdx] = useState<number | null>(null);
    const [dragOverLedIdx, setDragOverLedIdx] = useState<number | null>(null);

    // TV Model Search ("Ne Takılır?" integration)
    const [modelSearch, setModelSearch] = useState<string>('');
    const [modelResults, setModelResults] = useState<string[]>([]);
    const [isSearchingModels, setIsSearchingModels] = useState<boolean>(false);
    const [showDropdown, setShowDropdown] = useState<boolean>(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Compatibility Modal
    const [selectedModelName, setSelectedModelName] = useState<string | null>(null);
    const [modelSummaryData, setModelSummaryData] = useState<any | null>(null);
    const [isLoadingModelSummary, setIsLoadingModelSummary] = useState<boolean>(false);

    // Load initial visibility & view preferences from localStorage
    useEffect(() => {
        try {
            const savedShowCosts = localStorage.getItem('price_list_show_costs');
            if (savedShowCosts !== null) {
                setShowCosts(savedShowCosts === 'true');
            }
            const savedViewMode = localStorage.getItem('price_list_view_mode');
            if (savedViewMode === 'ALL' || savedViewMode === 'SCREEN' || savedViewMode === 'LED') {
                setViewMode(savedViewMode);
            }
            const savedScreenCols = localStorage.getItem('price_list_screen_cols');
            if (savedScreenCols && [2, 3, 4].includes(Number(savedScreenCols))) {
                setScreenCols(Number(savedScreenCols));
            }
            const savedLedCols = localStorage.getItem('price_list_led_cols');
            if (savedLedCols && [1, 2, 3].includes(Number(savedLedCols))) {
                setLedCols(Number(savedLedCols));
            }
        } catch (e) {}
    }, []);

    const toggleShowCosts = () => {
        const next = !showCosts;
        setShowCosts(next);
        try {
            localStorage.setItem('price_list_show_costs', String(next));
        } catch (e) {}
    };

    const handleViewModeChange = (mode: 'ALL' | 'SCREEN' | 'LED') => {
        setViewMode(mode);
        try {
            localStorage.setItem('price_list_view_mode', mode);
        } catch (e) {}
    };

    const handleScreenColsChange = (cols: number) => {
        setScreenCols(cols);
        try {
            localStorage.setItem('price_list_screen_cols', String(cols));
        } catch (e) {}
    };

    const handleLedColsChange = (cols: number) => {
        setLedCols(cols);
        try {
            localStorage.setItem('price_list_led_cols', String(cols));
        } catch (e) {}
    };

    // Load Price List from Server
    useEffect(() => {
        let isMounted = true;
        async function loadData() {
            try {
                setIsLoading(true);
                const data = await getPriceListData();
                if (isMounted && data) {
                    setUsdRate(data.usdRate || 48.60);
                    setUsdRateInput(String(data.usdRate || 48.60));
                    setScreenItems(data.screenItems && data.screenItems.length > 0 ? data.screenItems : INITIAL_PRICE_LIST.screenItems);
                    setLedItems(data.ledItems && data.ledItems.length > 0 ? data.ledItems : INITIAL_PRICE_LIST.ledItems);
                }
            } catch (err) {
                console.error('Error loading price list, using fallback:', err);
                if (isMounted) {
                    setUsdRate(INITIAL_PRICE_LIST.usdRate);
                    setUsdRateInput(String(INITIAL_PRICE_LIST.usdRate));
                    setScreenItems(INITIAL_PRICE_LIST.screenItems);
                    setLedItems(INITIAL_PRICE_LIST.ledItems);
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        }
        loadData();
        return () => { isMounted = false; };
    }, []);

    // Close model dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Düzenleme modundayken ekranın herhangi bir yerine dokunulduğunda/tıklandığında otomatik onayla ve kapat
    useEffect(() => {
        if (!editingScreenId && !editingLedId) return;

        const handleOutsideRowClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // Eğer tıklanan yer o an düzenlenen satırın veya bir butonun içiyse kapatma
            if (target && target.closest('tr[data-editing="true"]')) {
                return;
            }
            setEditingScreenId(null);
            setEditingLedId(null);
        };

        document.addEventListener('mousedown', handleOutsideRowClick);
        return () => document.removeEventListener('mousedown', handleOutsideRowClick);
    }, [editingScreenId, editingLedId]);

    // TV Model Autocomplete Search
    useEffect(() => {
        if (!modelSearch || modelSearch.trim().length < 2) {
            setModelResults([]);
            setShowDropdown(false);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearchingModels(true);
            try {
                const results = await searchTVModels(modelSearch);
                const cleanResults = Array.from(new Set(results.map(r => r.trim().toUpperCase())));
                setModelResults(cleanResults);
                setShowDropdown(cleanResults.length > 0);
            } catch (e) {
                console.error(e);
            } finally {
                setIsSearchingModels(false);
            }
        }, 250);

        return () => clearTimeout(timer);
    }, [modelSearch]);

    // Open Model Compatibility Modal
    const handleOpenModelSummary = async (modelName: string) => {
        if (!modelName) return;
        const cleanName = modelName.trim().toUpperCase();
        setSelectedModelName(cleanName);
        setShowDropdown(false);
        setIsLoadingModelSummary(true);
        try {
            const res = await getModelSummaryAction(cleanName);
            setModelSummaryData(res);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingModelSummary(false);
        }
    };

    // Dolar Kuru Manuel Giriş & Güncelleme
    const handleUsdRateChange = (valStr: string) => {
        setUsdRateInput(valStr);
        const parsed = parseFloat(valStr.replace(',', '.'));
        if (!isNaN(parsed) && parsed > 0) {
            setUsdRate(parsed);
            setHasUnsavedChanges(true);
        }
    };

    // Save all modifications
    const handleSaveAll = async () => {
        if (usdRate <= 0) {
            alert('Lütfen geçerli bir dolar kuru giriniz.');
            return;
        }

        setIsSaving(true);
        try {
            const payload: PriceListData = {
                usdRate,
                screenItems,
                ledItems,
            };
            await savePriceListData(payload);
            setHasUnsavedChanges(false);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err: any) {
            alert(err?.message || 'Kaydetme hatası oluştu');
        } finally {
            setIsSaving(false);
        }
    };

    // Reset to initial factory data
    const handleResetToDefault = () => {
        if (!confirm('Tüm fiyat listesini başlangıçtaki Excel tablosu ayarlarına döndürmek istediğinize emin misiniz?')) {
            return;
        }
        setUsdRate(INITIAL_PRICE_LIST.usdRate);
        setUsdRateInput(String(INITIAL_PRICE_LIST.usdRate));
        setScreenItems([...INITIAL_PRICE_LIST.screenItems]);
        setLedItems([...INITIAL_PRICE_LIST.ledItems]);
        setHasUnsavedChanges(true);
    };

    // ─── Screen Table Operations ──────────────────────────────────────────
    const moveScreenRow = (index: number, direction: 'UP' | 'DOWN') => {
        const targetIndex = direction === 'UP' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= screenItems.length) return;

        const newItems = [...screenItems];
        const temp = newItems[index];
        newItems[index] = newItems[targetIndex];
        newItems[targetIndex] = temp;

        newItems.forEach((item, idx) => { item.order = idx + 1; });
        setScreenItems(newItems);
        setHasUnsavedChanges(true);
    };

    const handleScreenDragStart = (e: React.DragEvent, index: number) => {
        setEditingScreenId(null);
        setDraggedScreenIdx(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
    };

    const handleScreenDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverScreenIdx !== index) {
            setDragOverScreenIdx(index);
        }
    };

    const handleScreenDrop = (targetIndex: number) => {
        if (draggedScreenIdx === null || draggedScreenIdx === targetIndex) {
            setDraggedScreenIdx(null);
            setDragOverScreenIdx(null);
            return;
        }

        const currentList = screenSortCol ? [...sortedScreens] : [...screenItems];
        const [movedItem] = currentList.splice(draggedScreenIdx, 1);
        currentList.splice(targetIndex, 0, movedItem);

        currentList.forEach((item, idx) => { item.order = idx + 1; });
        setScreenSortCol(null);
        setScreenItems(currentList);
        setHasUnsavedChanges(true);
        setDraggedScreenIdx(null);
        setDragOverScreenIdx(null);
    };

    const addScreenRow = () => {
        const newId = `sc-${Date.now()}`;
        const newRow: ScreenPriceItem = {
            id: newId,
            size: '55',
            description: 'Yeni Ekran Modeli',
            usdPrice: 200,
            customerPriceTL: 12000,
            order: screenItems.length + 1,
        };
        setScreenItems([newRow, ...screenItems]);
        setEditingScreenId(newId);
        setHasUnsavedChanges(true);
    };

    const deleteScreenRow = (id: string) => {
        if (!confirm('Bu ekran satırını silmek istediğinizden emin misiniz?')) return;
        setScreenItems(screenItems.filter(item => item.id !== id));
        setHasUnsavedChanges(true);
    };

    const getItemTextColor = (item: { color?: string; highlight?: boolean }) => {
        if (item.color === 'blue') return '#2563eb';
        if (item.color === 'red' || (!item.color && item.highlight)) return '#ef4444';
        return 'var(--text-primary)';
    };

    const getItemFontWeight = (item: { color?: string; highlight?: boolean }) => {
        if (item.color === 'blue') return 850;
        if (item.color === 'red' || (!item.color && item.highlight)) return 900;
        return 750;
    };

    const getItemActiveColor = (item: { color?: string; highlight?: boolean }): 'default' | 'blue' | 'red' => {
        if (item.color === 'blue') return 'blue';
        if (item.color === 'red' || (!item.color && item.highlight)) return 'red';
        return 'default';
    };

    const updateScreenRowColor = (id: string, color: 'default' | 'blue' | 'red') => {
        setScreenItems(screenItems.map(item => {
            if (item.id !== id) return item;
            return {
                ...item,
                color,
                highlight: color === 'red'
            };
        }));
        setHasUnsavedChanges(true);
    };

    const updateScreenRow = (id: string, field: keyof ScreenPriceItem, value: any) => {
        setScreenItems(screenItems.map(item => {
            if (item.id !== id) return item;
            return { ...item, [field]: value };
        }));
        setHasUnsavedChanges(true);
    };

    const toggleScreenSort = (col: string) => {
        if (screenSortCol === col) {
            setScreenSortAsc(!screenSortAsc);
        } else {
            setScreenSortCol(col);
            setScreenSortAsc(true);
        }
    };

    // ─── LED Table Operations ─────────────────────────────────────────────
    const moveLedRow = (index: number, direction: 'UP' | 'DOWN') => {
        const targetIndex = direction === 'UP' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= ledItems.length) return;

        const newItems = [...ledItems];
        const temp = newItems[index];
        newItems[index] = newItems[targetIndex];
        newItems[targetIndex] = temp;

        newItems.forEach((item, idx) => { item.order = idx + 1; });
        setLedItems(newItems);
        setHasUnsavedChanges(true);
    };

    const handleLedDragStart = (e: React.DragEvent, index: number) => {
        setEditingLedId(null);
        setDraggedLedIdx(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
    };

    const handleLedDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverLedIdx !== index) {
            setDragOverLedIdx(index);
        }
    };

    const handleLedDrop = (targetIndex: number) => {
        if (draggedLedIdx === null || draggedLedIdx === targetIndex) {
            setDraggedLedIdx(null);
            setDragOverLedIdx(null);
            return;
        }

        const currentList = ledSortCol ? [...sortedLeds] : [...ledItems];
        const [movedItem] = currentList.splice(draggedLedIdx, 1);
        currentList.splice(targetIndex, 0, movedItem);

        currentList.forEach((item, idx) => { item.order = idx + 1; });
        setLedSortCol(null);
        setLedItems(currentList);
        setHasUnsavedChanges(true);
        setDraggedLedIdx(null);
        setDragOverLedIdx(null);
    };

    const addLedRow = () => {
        const newId = `led-${Date.now()}`;
        const newRow: LedPriceItem = {
            id: newId,
            size: '50',
            model: 'Yeni LED Modeli',
            repairerLaborPriceTL: 1500,
            customerPriceTL: 4500,
            order: ledItems.length + 1,
        };
        setLedItems([newRow, ...ledItems]);
        setEditingLedId(newId);
        setHasUnsavedChanges(true);
    };

    const deleteLedRow = (id: string) => {
        if (!confirm('Bu LED satırını silmek istediğinizden emin misiniz?')) return;
        setLedItems(ledItems.filter(item => item.id !== id));
        setHasUnsavedChanges(true);
    };

    const updateLedRow = (id: string, field: keyof LedPriceItem, value: any) => {
        setLedItems(ledItems.map(item => {
            if (item.id !== id) return item;
            return { ...item, [field]: value };
        }));
        setHasUnsavedChanges(true);
    };

    const updateLedRowColor = (id: string, color: 'default' | 'blue' | 'red') => {
        setLedItems(ledItems.map(item => {
            if (item.id !== id) return item;
            return {
                ...item,
                color,
                highlight: color === 'red'
            };
        }));
        setHasUnsavedChanges(true);
    };

    const toggleLedSort = (col: string) => {
        if (ledSortCol === col) {
            setLedSortAsc(!ledSortAsc);
        } else {
            setLedSortCol(col);
            setLedSortAsc(true);
        }
    };

    // ─── Filtering & Sorting Logic ────────────────────────────────────────
    const filteredScreens = screenItems.filter(item => {
        if (!tableSearchQuery) return true;
        const q = tableSearchQuery.toLowerCase();
        return (
            item.size.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q) ||
            String(item.usdPrice).includes(q) ||
            String(item.customerPriceTL).includes(q)
        );
    });

    const sortedScreens = [...filteredScreens].sort((a, b) => {
        if (!screenSortCol) return 0;
        let valA: any = a[screenSortCol as keyof ScreenPriceItem];
        let valB: any = b[screenSortCol as keyof ScreenPriceItem];

        if (screenSortCol === 'size') {
            const numA = parseInt(a.size, 10) || 0;
            const numB = parseInt(b.size, 10) || 0;
            return screenSortAsc ? numA - numB : numB - numA;
        }
        if (screenSortCol === 'tamirciPrice') {
            valA = (a.usdPrice || 0) * usdRate;
            valB = (b.usdPrice || 0) * usdRate;
        }

        if (valA < valB) return screenSortAsc ? -1 : 1;
        if (valA > valB) return screenSortAsc ? 1 : -1;
        return 0;
    });

    const filteredLeds = ledItems.filter(item => {
        if (!tableSearchQuery) return true;
        const q = tableSearchQuery.toLowerCase();
        return (
            item.size.toLowerCase().includes(q) ||
            item.model.toLowerCase().includes(q) ||
            String(item.repairerLaborPriceTL).includes(q) ||
            String(item.customerPriceTL).includes(q)
        );
    });

    const sortedLeds = [...filteredLeds].sort((a, b) => {
        if (!ledSortCol) return 0;
        let valA: any = a[ledSortCol as keyof LedPriceItem];
        let valB: any = b[ledSortCol as keyof LedPriceItem];

        if (ledSortCol === 'size') {
            const numA = parseInt(a.size, 10) || 0;
            const numB = parseInt(b.size, 10) || 0;
            return ledSortAsc ? numA - numB : numB - numA;
        }

        if (valA < valB) return ledSortAsc ? -1 : 1;
        if (valA > valB) return ledSortAsc ? 1 : -1;
        return 0;
    });

    // ─── Render Helpers for Multi-Column & Standard Views ─────────────────
    const renderScreenTableHeader = (isCompact: boolean = false) => (
        <thead>
            <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)', position: 'sticky', top: 0, zIndex: 10 }}>
                <th style={{ width: isCompact ? '20px' : '24px', textAlign: 'center', padding: isCompact ? '4px 1px' : '6px 1px', color: 'var(--text-tertiary)' }}>Sıra</th>
                <th
                    onClick={() => toggleScreenSort('size')}
                    style={{ width: isCompact ? '34px' : '42px', cursor: 'pointer', padding: isCompact ? '4px 2px' : '6px 3px', userSelect: 'none', color: 'var(--text-secondary)' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <span>Boyut</span>
                        <ArrowUpDown size={8} style={{ opacity: screenSortCol === 'size' ? 1 : 0.4 }} />
                    </div>
                </th>
                <th
                    onClick={() => toggleScreenSort('description')}
                    style={{ cursor: 'pointer', padding: isCompact ? '4px 3px' : '6px 4px', userSelect: 'none', color: 'var(--text-secondary)' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <span>Ekran - Çözünürlük</span>
                        <ArrowUpDown size={8} style={{ opacity: screenSortCol === 'description' ? 1 : 0.4 }} />
                    </div>
                </th>
                <th
                    onClick={() => toggleScreenSort('usdPrice')}
                    style={{ width: isCompact ? '48px' : '60px', textAlign: 'right', cursor: 'pointer', padding: isCompact ? '4px 2px' : '6px 4px', userSelect: 'none', color: '#10b981' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px' }}>
                        <span>DOLAR</span>
                        <ArrowUpDown size={8} style={{ opacity: screenSortCol === 'usdPrice' ? 1 : 0.4 }} />
                    </div>
                </th>
                <th
                    onClick={() => toggleScreenSort('tamirciPrice')}
                    style={{ width: isCompact ? '60px' : '75px', textAlign: 'right', cursor: 'pointer', padding: isCompact ? '4px 2px' : '6px 4px', userSelect: 'none', color: '#60a5fa' }}
                    title="Dolar x Manuel Kur"
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px' }}>
                        <span>Tamirci</span>
                        <ArrowUpDown size={8} style={{ opacity: screenSortCol === 'tamirciPrice' ? 1 : 0.4 }} />
                    </div>
                </th>
                <th
                    onClick={() => toggleScreenSort('customerPriceTL')}
                    style={{ width: isCompact ? '62px' : '75px', textAlign: 'right', cursor: 'pointer', padding: isCompact ? '4px 2px' : '6px 4px', userSelect: 'none', color: '#f87171' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px' }}>
                        <span>MÜŞTERİ</span>
                        <ArrowUpDown size={8} style={{ opacity: screenSortCol === 'customerPriceTL' ? 1 : 0.4 }} />
                    </div>
                </th>
                <th style={{ width: isCompact ? '20px' : '24px', textAlign: 'center', padding: isCompact ? '4px 1px' : '6px 1px' }}></th>
            </tr>
        </thead>
    );

    const renderScreenRow = (row: ScreenPriceItem, displayIdx: number, originalIdx: number, isCompact: boolean = false) => {
        const calculatedRepairerTL = Math.round((row.usdPrice || 0) * usdRate);
        const isEditing = editingScreenId === row.id;
        const isBeingDragged = draggedScreenIdx === originalIdx;
        const isOverThis = dragOverScreenIdx === originalIdx;
        const isDroppingAbove = isOverThis && draggedScreenIdx !== null && draggedScreenIdx > originalIdx;
        const isDroppingBelow = isOverThis && draggedScreenIdx !== null && draggedScreenIdx < originalIdx;

        const rowPadding = isCompact ? '2.5px 3px' : '4px 4px';
        const fontSize = isCompact ? '11px' : '12px';
        const titleFontSize = isCompact ? '11.5px' : '13.5px';

        return (
            <tr
                key={row.id}
                data-editing={isEditing ? 'true' : undefined}
                draggable={!isEditing}
                onDragStart={(e) => handleScreenDragStart(e, originalIdx)}
                onDragOver={(e) => handleScreenDragOver(e, originalIdx)}
                onDrop={() => handleScreenDrop(originalIdx)}
                onDragEnd={() => {
                    setDraggedScreenIdx(null);
                    setDragOverScreenIdx(null);
                }}
                style={{
                    background: isEditing
                        ? 'rgba(59, 130, 246, 0.14)'
                        : isBeingDragged
                        ? 'rgba(59, 130, 246, 0.15)'
                        : displayIdx % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                    opacity: isBeingDragged ? 0.4 : 1,
                    transform: isEditing ? 'translateY(-1px) scale(1.004)' : 'none',
                    boxShadow: isEditing ? '0 4px 14px rgba(0, 0, 0, 0.35), 0 0 0 1.5px #3b82f6' : 'none',
                    position: isEditing ? 'relative' : 'static',
                    zIndex: isEditing ? 15 : 1,
                    borderTop: isDroppingAbove ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.03)',
                    borderBottom: isDroppingBelow ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.03)',
                    cursor: isEditing ? 'default' : 'grab',
                    transition: 'all 0.15s ease'
                }}
            >
                {/* Reorder & Drag Handle */}
                <td style={{ textAlign: 'center', padding: isCompact ? '1px 1px' : '3px 1px', width: isCompact ? '20px' : '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Sıralamayı değiştirmek için basılı tutup yukarı/aşağı sürükleyin">
                        <GripVertical size={isCompact ? 11 : 13} style={{ opacity: 0.45, cursor: 'grab' }} />
                    </div>
                </td>

                {/* Boyut */}
                <td style={{ padding: rowPadding, whiteSpace: 'nowrap', width: isCompact ? '34px' : '42px' }}>
                    {isEditing ? (
                        <input
                            type="text"
                            value={row.size}
                            onChange={(e) => updateScreenRow(row.id, 'size', e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') setEditingScreenId(null); }}
                            style={{
                                width: '100%',
                                padding: '1px 2px',
                                fontSize: '11px',
                                fontWeight: 800,
                                color: '#000000',
                                background: '#ffffff',
                                border: '1.5px solid #3b82f6',
                                borderRadius: '3px',
                                outline: 'none'
                            }}
                        />
                    ) : (
                        <span
                            onClick={() => setEditingScreenId(row.id)}
                            style={{ fontWeight: 800, fontFamily: 'monospace', fontSize: isCompact ? '11.5px' : '13px', cursor: 'pointer' }}
                            title="Düzenlemek için tıkla"
                        >
                            {row.size}&quot;
                        </span>
                    )}
                </td>

                {/* Ekran - Çözünürlük */}
                <td style={{ padding: rowPadding, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: isEditing ? 'text' : 'grab' }}>
                    {isEditing ? (
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                            <input
                                type="text"
                                value={row.description}
                                onChange={(e) => updateScreenRow(row.id, 'description', e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') setEditingScreenId(null); }}
                                style={{
                                    width: '100%',
                                    padding: '1px 48px 1px 4px',
                                    fontSize: '12px',
                                    fontWeight: 800,
                                    color: '#000000',
                                    background: '#ffffff',
                                    border: '1.5px solid #3b82f6',
                                    borderRadius: '4px',
                                    outline: 'none'
                                }}
                            />
                            <div
                                style={{
                                    position: 'absolute',
                                    right: '3px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '2px',
                                    background: '#f8fafc',
                                    padding: '1px 3px',
                                    borderRadius: '8px',
                                    border: '1px solid #cbd5e1'
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <button
                                    type="button"
                                    title="Siyah (Standart)"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        updateScreenRowColor(row.id, 'default');
                                    }}
                                    style={{
                                        width: '10px',
                                        height: '10px',
                                        borderRadius: '50%',
                                        background: '#0f172a',
                                        border: getItemActiveColor(row) === 'default' ? '1.5px solid #3b82f6' : '1px solid #94a3b8',
                                        transform: getItemActiveColor(row) === 'default' ? 'scale(1.2)' : 'scale(1)',
                                        cursor: 'pointer',
                                        padding: 0
                                    }}
                                />
                                <button
                                    type="button"
                                    title="Mavi"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        updateScreenRowColor(row.id, 'blue');
                                    }}
                                    style={{
                                        width: '10px',
                                        height: '10px',
                                        borderRadius: '50%',
                                        background: '#2563eb',
                                        border: getItemActiveColor(row) === 'blue' ? '1.5px solid #1d4ed8' : '1px solid #93c5fd',
                                        transform: getItemActiveColor(row) === 'blue' ? 'scale(1.2)' : 'scale(1)',
                                        cursor: 'pointer',
                                        padding: 0
                                    }}
                                />
                                <button
                                    type="button"
                                    title="Kırmızı"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        updateScreenRowColor(row.id, 'red');
                                    }}
                                    style={{
                                        width: '10px',
                                        height: '10px',
                                        borderRadius: '50%',
                                        background: '#ef4444',
                                        border: getItemActiveColor(row) === 'red' ? '1.5px solid #b91c1c' : '1px solid #fca5a5',
                                        transform: getItemActiveColor(row) === 'red' ? 'scale(1.2)' : 'scale(1)',
                                        cursor: 'pointer',
                                        padding: 0
                                    }}
                                />
                            </div>
                        </div>
                    ) : (
                        <span
                            onClick={() => setEditingScreenId(row.id)}
                            style={{
                                fontWeight: getItemFontWeight(row),
                                fontSize: titleFontSize,
                                letterSpacing: '0.01em',
                                color: getItemTextColor(row),
                                cursor: 'grab'
                            }}
                            title={`${row.description} (Basılı tutup sürükleyebilirsiniz)`}
                        >
                            {row.description}
                        </span>
                    )}
                </td>

                {/* DOLAR ($) */}
                <td style={{ textAlign: 'right', padding: rowPadding, fontFamily: 'monospace', whiteSpace: 'nowrap', width: isCompact ? '48px' : '60px' }}>
                    {!showCosts ? (
                        <span style={{ color: 'var(--text-tertiary)', letterSpacing: '1px' }}>•••</span>
                    ) : isEditing ? (
                        <input
                            type="number"
                            value={row.usdPrice}
                            onChange={(e) => updateScreenRow(row.id, 'usdPrice', parseFloat(e.target.value) || 0)}
                            onKeyDown={(e) => { if (e.key === 'Enter') setEditingScreenId(null); }}
                            style={{
                                width: isCompact ? '46px' : '58px',
                                padding: '1px 2px',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#000000',
                                background: '#ffffff',
                                border: '1.5px solid #10b981',
                                borderRadius: '3px',
                                outline: 'none',
                                textAlign: 'right'
                            }}
                        />
                    ) : (
                        <span
                            onClick={() => setEditingScreenId(row.id)}
                            style={{ fontWeight: 700, fontSize: fontSize, color: '#10b981', cursor: 'pointer' }}
                        >
                            {formatCurrencyUSD(row.usdPrice)}
                        </span>
                    )}
                </td>

                {/* Tamirci (₺) */}
                <td style={{ textAlign: 'right', padding: rowPadding, fontFamily: 'monospace', whiteSpace: 'nowrap', width: isCompact ? '60px' : '75px' }}>
                    {!showCosts ? (
                        <span style={{ color: 'var(--text-tertiary)', letterSpacing: '1px' }}>•••</span>
                    ) : (
                        <span style={{ fontWeight: 650, fontSize: fontSize, color: '#60a5fa' }}>
                            {formatCurrencyTL(calculatedRepairerTL)}
                        </span>
                    )}
                </td>

                {/* MÜŞTERİ (₺) */}
                <td style={{ textAlign: 'right', padding: rowPadding, fontFamily: 'monospace', whiteSpace: 'nowrap', width: isCompact ? '62px' : '75px' }}>
                    {isEditing ? (
                        <input
                            type="number"
                            value={row.customerPriceTL}
                            onChange={(e) => updateScreenRow(row.id, 'customerPriceTL', parseFloat(e.target.value) || 0)}
                            onKeyDown={(e) => { if (e.key === 'Enter') setEditingScreenId(null); }}
                            style={{
                                width: isCompact ? '56px' : '66px',
                                padding: '1px 2px',
                                fontSize: '11px',
                                fontWeight: 800,
                                color: '#000000',
                                background: '#ffffff',
                                border: '1.5px solid #ef4444',
                                borderRadius: '3px',
                                outline: 'none',
                                textAlign: 'right'
                            }}
                        />
                    ) : (
                        <span
                            onClick={() => setEditingScreenId(row.id)}
                            style={{ fontWeight: 800, fontSize: fontSize, color: '#f87171', cursor: 'pointer' }}
                        >
                            {formatCurrencyTL(row.customerPriceTL)}
                        </span>
                    )}
                </td>

                {/* Sil / Onayla */}
                <td style={{ textAlign: 'center', padding: isCompact ? '1px 1px' : '3px 1px', width: isCompact ? '20px' : '24px' }}>
                    {isEditing ? (
                        <button
                            type="button"
                            onClick={() => setEditingScreenId(null)}
                            style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: '1px' }}
                            title="Tamamla"
                        >
                            <Check size={isCompact ? 10 : 11} />
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => deleteScreenRow(row.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '1px' }}
                            title="Sil"
                        >
                            <Trash2 size={isCompact ? 10 : 11} />
                        </button>
                    )}
                </td>
            </tr>
        );
    };

    const renderLedTableHeader = (isCompact: boolean = false) => (
        <thead>
            <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)', position: 'sticky', top: 0, zIndex: 10 }}>
                <th style={{ width: isCompact ? '20px' : '24px', textAlign: 'center', padding: isCompact ? '4px 1px' : '6px 1px', color: 'var(--text-tertiary)' }}>Sıra</th>
                <th
                    onClick={() => toggleLedSort('size')}
                    style={{ width: isCompact ? '34px' : '42px', cursor: 'pointer', padding: isCompact ? '4px 2px' : '6px 3px', userSelect: 'none', color: 'var(--text-secondary)' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <span>Boyut</span>
                        <ArrowUpDown size={8} style={{ opacity: ledSortCol === 'size' ? 1 : 0.4 }} />
                    </div>
                </th>
                <th
                    onClick={() => toggleLedSort('model')}
                    style={{ cursor: 'pointer', padding: isCompact ? '4px 3px' : '6px 4px', userSelect: 'none', color: 'var(--text-secondary)' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <span>Model / Seri / Marka</span>
                        <ArrowUpDown size={8} style={{ opacity: ledSortCol === 'model' ? 1 : 0.4 }} />
                    </div>
                </th>
                <th
                    onClick={() => toggleLedSort('repairerLaborPriceTL')}
                    style={{ width: isCompact ? '66px' : '80px', textAlign: 'right', cursor: 'pointer', padding: isCompact ? '4px 2px' : '6px 4px', userSelect: 'none', color: '#fbbf24' }}
                    title="Tamirciye özel net LED işçilik bedeli"
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px' }}>
                        <span>Tamirci İşçilik</span>
                        <ArrowUpDown size={8} style={{ opacity: ledSortCol === 'repairerLaborPriceTL' ? 1 : 0.4 }} />
                    </div>
                </th>
                <th
                    onClick={() => toggleLedSort('customerPriceTL')}
                    style={{ width: isCompact ? '66px' : '80px', textAlign: 'right', cursor: 'pointer', padding: isCompact ? '4px 2px' : '6px 4px', userSelect: 'none', color: '#f87171' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px' }}>
                        <span>Müşteri</span>
                        <ArrowUpDown size={8} style={{ opacity: ledSortCol === 'customerPriceTL' ? 1 : 0.4 }} />
                    </div>
                </th>
                <th style={{ width: isCompact ? '20px' : '24px', textAlign: 'center', padding: isCompact ? '4px 1px' : '6px 1px' }}></th>
            </tr>
        </thead>
    );

    const renderLedRow = (row: LedPriceItem, displayIdx: number, originalIdx: number, isCompact: boolean = false) => {
        const isEditing = editingLedId === row.id;
        const isBeingDragged = draggedLedIdx === originalIdx;
        const isOverThis = dragOverLedIdx === originalIdx;
        const isDroppingAbove = isOverThis && draggedLedIdx !== null && draggedLedIdx > originalIdx;
        const isDroppingBelow = isOverThis && draggedLedIdx !== null && draggedLedIdx < originalIdx;

        const rowPadding = isCompact ? '2.5px 3px' : '4px 4px';
        const fontSize = isCompact ? '11px' : '12px';
        const titleFontSize = isCompact ? '11.5px' : '13.5px';

        return (
            <tr
                key={row.id}
                data-editing={isEditing ? 'true' : undefined}
                draggable={!isEditing}
                onDragStart={(e) => handleLedDragStart(e, originalIdx)}
                onDragOver={(e) => handleLedDragOver(e, originalIdx)}
                onDrop={() => handleLedDrop(originalIdx)}
                onDragEnd={() => {
                    setDraggedLedIdx(null);
                    setDragOverLedIdx(null);
                }}
                style={{
                    background: isEditing
                        ? 'rgba(16, 185, 129, 0.14)'
                        : isBeingDragged
                        ? 'rgba(16, 185, 129, 0.15)'
                        : displayIdx % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                    opacity: isBeingDragged ? 0.4 : 1,
                    transform: isEditing ? 'translateY(-1px) scale(1.004)' : 'none',
                    boxShadow: isEditing ? '0 4px 14px rgba(0, 0, 0, 0.35), 0 0 0 1.5px #10b981' : 'none',
                    position: isEditing ? 'relative' : 'static',
                    zIndex: isEditing ? 15 : 1,
                    borderTop: isDroppingAbove ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.03)',
                    borderBottom: isDroppingBelow ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.03)',
                    cursor: isEditing ? 'default' : 'grab',
                    transition: 'all 0.15s ease'
                }}
            >
                {/* Reorder & Drag Handle */}
                <td style={{ textAlign: 'center', padding: isCompact ? '1px 1px' : '3px 1px', width: isCompact ? '20px' : '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Sıralamayı değiştirmek için basılı tutup yukarı/aşağı sürükleyin">
                        <GripVertical size={isCompact ? 11 : 13} style={{ opacity: 0.45, cursor: 'grab' }} />
                    </div>
                </td>

                {/* Boyut */}
                <td style={{ padding: rowPadding, whiteSpace: 'nowrap', width: isCompact ? '34px' : '42px' }}>
                    {isEditing ? (
                        <input
                            type="text"
                            value={row.size}
                            onChange={(e) => updateLedRow(row.id, 'size', e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') setEditingLedId(null); }}
                            style={{
                                width: '100%',
                                padding: '1px 2px',
                                fontSize: '11px',
                                fontWeight: 800,
                                color: '#000000',
                                background: '#ffffff',
                                border: '1.5px solid #10b981',
                                borderRadius: '3px',
                                outline: 'none'
                            }}
                        />
                    ) : (
                        <span
                            onClick={() => setEditingLedId(row.id)}
                            style={{ fontWeight: 800, fontFamily: 'monospace', fontSize: isCompact ? '11.5px' : '13px', cursor: 'pointer' }}
                            title="Düzenlemek için tıkla"
                        >
                            {row.size}&quot;
                        </span>
                    )}
                </td>

                {/* Model */}
                <td style={{ padding: rowPadding, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: isEditing ? 'text' : 'grab' }}>
                    {isEditing ? (
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                            <input
                                type="text"
                                value={row.model}
                                onChange={(e) => updateLedRow(row.id, 'model', e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') setEditingLedId(null); }}
                                style={{
                                    width: '100%',
                                    padding: '1px 48px 1px 4px',
                                    fontSize: '12px',
                                    fontWeight: 800,
                                    color: '#000000',
                                    background: '#ffffff',
                                    border: '1.5px solid #10b981',
                                    borderRadius: '4px',
                                    outline: 'none'
                                }}
                            />
                            <div
                                style={{
                                    position: 'absolute',
                                    right: '3px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '2px',
                                    background: '#f8fafc',
                                    padding: '1px 3px',
                                    borderRadius: '8px',
                                    border: '1px solid #cbd5e1'
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <button
                                    type="button"
                                    title="Siyah (Standart)"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        updateLedRowColor(row.id, 'default');
                                    }}
                                    style={{
                                        width: '10px',
                                        height: '10px',
                                        borderRadius: '50%',
                                        background: '#0f172a',
                                        border: getItemActiveColor(row) === 'default' ? '1.5px solid #10b981' : '1px solid #94a3b8',
                                        transform: getItemActiveColor(row) === 'default' ? 'scale(1.2)' : 'scale(1)',
                                        cursor: 'pointer',
                                        padding: 0
                                    }}
                                />
                                <button
                                    type="button"
                                    title="Mavi"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        updateLedRowColor(row.id, 'blue');
                                    }}
                                    style={{
                                        width: '10px',
                                        height: '10px',
                                        borderRadius: '50%',
                                        background: '#2563eb',
                                        border: getItemActiveColor(row) === 'blue' ? '1.5px solid #1d4ed8' : '1px solid #93c5fd',
                                        transform: getItemActiveColor(row) === 'blue' ? 'scale(1.2)' : 'scale(1)',
                                        cursor: 'pointer',
                                        padding: 0
                                    }}
                                />
                                <button
                                    type="button"
                                    title="Kırmızı"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        updateLedRowColor(row.id, 'red');
                                    }}
                                    style={{
                                        width: '10px',
                                        height: '10px',
                                        borderRadius: '50%',
                                        background: '#ef4444',
                                        border: getItemActiveColor(row) === 'red' ? '1.5px solid #b91c1c' : '1px solid #fca5a5',
                                        transform: getItemActiveColor(row) === 'red' ? 'scale(1.2)' : 'scale(1)',
                                        cursor: 'pointer',
                                        padding: 0
                                    }}
                                />
                            </div>
                        </div>
                    ) : (
                        <span
                            onClick={() => setEditingLedId(row.id)}
                            style={{
                                fontWeight: getItemFontWeight(row),
                                fontSize: titleFontSize,
                                letterSpacing: '0.01em',
                                color: getItemTextColor(row),
                                cursor: 'grab'
                            }}
                            title={`${row.model} (Basılı tutup sürükleyebilirsiniz)`}
                        >
                            {row.model}
                        </span>
                    )}
                </td>

                {/* Tamirci İşçilik (₺) */}
                <td style={{ textAlign: 'right', padding: rowPadding, fontFamily: 'monospace', whiteSpace: 'nowrap', width: isCompact ? '66px' : '80px' }}>
                    {!showCosts ? (
                        <span style={{ color: 'var(--text-tertiary)', letterSpacing: '1px' }}>•••</span>
                    ) : isEditing ? (
                        <input
                            type="number"
                            value={row.repairerLaborPriceTL}
                            onChange={(e) => updateLedRow(row.id, 'repairerLaborPriceTL', parseFloat(e.target.value) || 0)}
                            onKeyDown={(e) => { if (e.key === 'Enter') setEditingLedId(null); }}
                            style={{
                                width: isCompact ? '52px' : '58px',
                                padding: '1px 2px',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#000000',
                                background: '#ffffff',
                                border: '1.5px solid #fbbf24',
                                borderRadius: '3px',
                                outline: 'none',
                                textAlign: 'right'
                            }}
                        />
                    ) : (
                        <span
                            onClick={() => setEditingLedId(row.id)}
                            style={{ fontWeight: 700, fontSize: fontSize, color: '#fbbf24', cursor: 'pointer' }}
                        >
                            {formatCurrencyTL(row.repairerLaborPriceTL)}
                        </span>
                    )}
                </td>

                {/* Müşteri Fiyatı (₺) */}
                <td style={{ textAlign: 'right', padding: rowPadding, fontFamily: 'monospace', whiteSpace: 'nowrap', width: isCompact ? '66px' : '80px' }}>
                    {isEditing ? (
                        <input
                            type="number"
                            value={row.customerPriceTL}
                            onChange={(e) => updateLedRow(row.id, 'customerPriceTL', parseFloat(e.target.value) || 0)}
                            onKeyDown={(e) => { if (e.key === 'Enter') setEditingLedId(null); }}
                            style={{
                                width: isCompact ? '56px' : '66px',
                                padding: '1px 2px',
                                fontSize: '11px',
                                fontWeight: 800,
                                color: '#000000',
                                background: '#ffffff',
                                border: '1.5px solid #ef4444',
                                borderRadius: '3px',
                                outline: 'none',
                                textAlign: 'right'
                            }}
                        />
                    ) : (
                        <span
                            onClick={() => setEditingLedId(row.id)}
                            style={{ fontWeight: 800, fontSize: fontSize, color: '#f87171', cursor: 'pointer' }}
                        >
                            {formatCurrencyTL(row.customerPriceTL)}
                        </span>
                    )}
                </td>

                {/* Sil / Onayla */}
                <td style={{ textAlign: 'center', padding: isCompact ? '1px 1px' : '3px 1px', width: isCompact ? '20px' : '24px' }}>
                    {isEditing ? (
                        <button
                            type="button"
                            onClick={() => setEditingLedId(null)}
                            style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: '1px' }}
                            title="Tamamla"
                        >
                            <Check size={isCompact ? 10 : 11} />
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => deleteLedRow(row.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '1px' }}
                            title="Sil"
                        >
                            <Trash2 size={isCompact ? 10 : 11} />
                        </button>
                    )}
                </td>
            </tr>
        );
    };

    // Guard: only operator role can view
    if (status === 'loading' || isLoading) {
        return (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div className="spinner" style={{ margin: '0 auto 16px' }} />
                <div>Fiyat listesi yükleniyor...</div>
            </div>
        );
    }

    if (!isOperator) {
        return (
            <div style={{ padding: '40px', maxWidth: '600px', margin: '60px auto', textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '12px' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
                <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Erişim Yetkisi Yok</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                    Bu sayfayı sadece Admin ve Operatör yetkisine sahip kullanıcılar görüntüleyebilir.
                </p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
            {/* ─── Top Control & Search Bar (Kompakt Tek Satır Başlık) ─────────────── */}
            <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-primary)',
                borderRadius: '8px',
                padding: '10px 14px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.15)'
            }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                    {/* Title & Görünüm Seçenekleri (Tümü / Sadece Ekran / Sadece LED) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <h1 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap' }}>
                            Panel & LED Fiyat Rehberi
                        </h1>

                        {/* Görünüm Filtresi Segmenti */}
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            background: 'var(--bg-secondary)',
                            padding: '3px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-primary)',
                            gap: '3px'
                        }}>
                            <button
                                type="button"
                                onClick={() => handleViewModeChange('ALL')}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '4px 9px',
                                    fontSize: '11px',
                                    fontWeight: viewMode === 'ALL' ? 750 : 500,
                                    color: viewMode === 'ALL' ? '#ffffff' : 'var(--text-secondary)',
                                    background: viewMode === 'ALL' ? 'var(--brand-primary)' : 'transparent',
                                    borderRadius: '6px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    boxShadow: viewMode === 'ALL' ? '0 1px 4px rgba(0,0,0,0.2)' : 'none'
                                }}
                                title="Ekran ve LED listesini yan yana iki tablo olarak görüntüler"
                            >
                                <Layers size={13} />
                                <span>Tümü (İkisi Bir Arada)</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleViewModeChange('SCREEN')}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '4px 10px',
                                    fontSize: '11px',
                                    fontWeight: viewMode === 'SCREEN' ? 750 : 500,
                                    color: viewMode === 'SCREEN' ? '#ffffff' : 'var(--text-secondary)',
                                    background: viewMode === 'SCREEN' ? '#2563eb' : 'transparent',
                                    borderRadius: '6px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    boxShadow: viewMode === 'SCREEN' ? '0 1px 4px rgba(37,99,235,0.35)' : 'none'
                                }}
                                title="Sadece Ekran listesini açar ve kaydırmaya gerek olmadan yan yana tüm modelleri tam gösterir"
                            >
                                <Tv size={13} />
                                <span>Sadece Ekran</span>
                                <span style={{
                                    fontSize: '9.5px',
                                    fontWeight: 750,
                                    padding: '1px 5px',
                                    borderRadius: '10px',
                                    background: viewMode === 'SCREEN' ? 'rgba(255,255,255,0.25)' : 'var(--bg-tertiary)',
                                    color: viewMode === 'SCREEN' ? '#ffffff' : 'var(--text-tertiary)'
                                }}>
                                    {sortedScreens.length}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleViewModeChange('LED')}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '4px 10px',
                                    fontSize: '11px',
                                    fontWeight: viewMode === 'LED' ? 750 : 500,
                                    color: viewMode === 'LED' ? '#ffffff' : 'var(--text-secondary)',
                                    background: viewMode === 'LED' ? '#059669' : 'transparent',
                                    borderRadius: '6px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    boxShadow: viewMode === 'LED' ? '0 1px 4px rgba(5,150,105,0.35)' : 'none'
                                }}
                                title="Sadece LED listesini görüntüler"
                            >
                                <Lightbulb size={13} />
                                <span>Sadece LED</span>
                                <span style={{
                                    fontSize: '9.5px',
                                    fontWeight: 750,
                                    padding: '1px 5px',
                                    borderRadius: '10px',
                                    background: viewMode === 'LED' ? 'rgba(255,255,255,0.25)' : 'var(--bg-tertiary)',
                                    color: viewMode === 'LED' ? '#ffffff' : 'var(--text-tertiary)'
                                }}>
                                    {sortedLeds.length}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Middle: Model Search & Table Filter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 360px', maxWidth: '500px' }}>
                        {/* TV Model Autocomplete ("Ne Takılır?") */}
                        <div ref={dropdownRef} style={{ position: 'relative', flex: 1 }}>
                            <Search size={13} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--brand-primary)' }} />
                            <input
                                type="text"
                                value={modelSearch}
                                onChange={(e) => setModelSearch(e.target.value)}
                                onFocus={() => { if (modelResults.length > 0) setShowDropdown(true); }}
                                placeholder="TV Modeli Ara (örn. 50W805C) — Ne Takılır?.."
                                style={{
                                    width: '100%',
                                    padding: '5px 24px 5px 26px',
                                    fontSize: '11px',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-secondary)',
                                    borderRadius: '6px',
                                    color: 'var(--text-primary)'
                                }}
                            />
                            {isSearchingModels && (
                                <div className="spinner" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px' }} />
                            )}
                            {modelSearch && !isSearchingModels && (
                                <button
                                    type="button"
                                    onClick={() => { setModelSearch(''); setShowDropdown(false); }}
                                    style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}
                                >
                                    <X size={12} />
                                </button>
                            )}

                            {/* Dropdown Menu */}
                            {showDropdown && modelResults.length > 0 && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    marginTop: '4px',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--brand-primary)',
                                    borderRadius: '8px',
                                    boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                                    zIndex: 50,
                                    maxHeight: '260px',
                                    overflowY: 'auto'
                                }}>
                                    <div style={{ padding: '4px 8px', fontSize: '10px', fontWeight: 700, color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-tertiary)' }}>
                                        EŞLEŞEN TV MODELLERİ — 'Ne Takılır?' Özeti İçin Tıklayın
                                    </div>
                                    {modelResults.map((m) => (
                                        <div
                                            key={m}
                                            onClick={() => handleOpenModelSummary(m)}
                                            style={{
                                                padding: '7px 10px',
                                                fontSize: '11.5px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                borderBottom: '1px solid var(--border-primary)'
                                            }}
                                            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Tv size={13} style={{ color: 'var(--brand-primary)' }} />
                                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m}</span>
                                            </div>
                                            <span className="badge badge-primary" style={{ fontSize: '10px', padding: '1px 6px' }}>
                                                💡 Uyumluluk & Fişler
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Filter within table */}
                        <div style={{ position: 'relative', width: '150px' }}>
                            <input
                                type="text"
                                value={tableSearchQuery}
                                onChange={(e) => setTableSearchQuery(e.target.value)}
                                placeholder="Tabloda filtrele..."
                                style={{
                                    width: '100%',
                                    padding: '5px 20px 5px 8px',
                                    fontSize: '11px',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-primary)',
                                    borderRadius: '6px',
                                    color: 'var(--text-primary)'
                                }}
                            />
                            {tableSearchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setTableSearchQuery('')}
                                    style={{ position: 'absolute', right: '5px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}
                                >
                                    <X size={11} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Right Controls: Manuel Dolar Kuru + Gizlilik + Kaydet */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* Manuel Dolar Kuru */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            background: 'var(--bg-secondary)',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-primary)',
                            gap: '6px'
                        }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#10b981' }}>
                                💵 Kur:
                            </span>
                            <input
                                type="text"
                                value={usdRateInput}
                                onChange={(e) => handleUsdRateChange(e.target.value)}
                                placeholder="48.60"
                                style={{
                                    width: '56px',
                                    padding: '2px 4px',
                                    fontSize: '12px',
                                    fontWeight: 800,
                                    fontFamily: 'monospace',
                                    color: '#10b981',
                                    background: 'var(--bg-tertiary)',
                                    border: '1px solid #10b981',
                                    borderRadius: '4px',
                                    textAlign: 'center'
                                }}
                                title="Sistem dışarıdan otomatik kur çekmez. Buraya girilen kur sabittir ve Dolar x Kur = Tamirci Fiyatı hesabında kullanılır."
                            />
                            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>₺</span>
                        </div>

                        {/* Maliyet Gizle/Aç */}
                        <button
                            type="button"
                            onClick={toggleShowCosts}
                            className={`btn ${showCosts ? 'btn-secondary' : 'btn-outline'}`}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '11px',
                                background: showCosts ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-secondary)',
                                borderColor: showCosts ? 'var(--brand-primary)' : 'var(--border-primary)',
                                color: showCosts ? 'var(--brand-primary)' : 'var(--text-secondary)'
                            }}
                            title="Müşteri yanındayken maliyet ve tamirci fiyatlarını gizler"
                        >
                            {showCosts ? <Eye size={13} /> : <EyeOff size={13} />}
                            <span>Maliyet: {showCosts ? 'Açık' : 'Gizli'}</span>
                        </button>

                        {/* Save Button */}
                        <button
                            type="button"
                            onClick={handleSaveAll}
                            disabled={isSaving}
                            className="btn btn-primary"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '11.5px',
                                position: 'relative'
                            }}
                        >
                            {isSaving ? (
                                <span>...</span>
                            ) : saveSuccess ? (
                                <>
                                    <Check size={13} style={{ color: '#10b981' }} />
                                    <span>Kaydedildi</span>
                                </>
                            ) : (
                                <>
                                    <Save size={13} />
                                    <span>Kaydet</span>
                                    {hasUnsavedChanges && (
                                        <span style={{
                                            position: 'absolute',
                                            top: '-2px',
                                            right: '-2px',
                                            width: '7px',
                                            height: '7px',
                                            borderRadius: '50%',
                                            background: '#ef4444'
                                        }} />
                                    )}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* ─── Görünüm Modlarına Göre Dinamik Tablo Yapısı ─────────────────── */}

            {/* 1) TÜMÜ (İKİSİ BİR ARADA) GÖRÜNÜMÜ ─────────────────────────────────── */}
            {viewMode === 'ALL' && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 0.95fr)',
                    gap: '12px',
                    width: '100%',
                    maxWidth: '100%',
                    overflow: 'hidden'
                }}>
                    {/* SOL TABLO: ZERO TV SERVİSİ — EKRAN DEĞİŞİM FİYATLARI */}
                    <div style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        minWidth: 0,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}>
                        <div style={{
                            padding: '6px 10px',
                            background: 'linear-gradient(90deg, rgba(37, 99, 235, 0.18), rgba(99, 102, 241, 0.05))',
                            borderBottom: '1px solid var(--border-primary)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Tv size={14} style={{ color: '#60a5fa' }} />
                                <span style={{ fontWeight: 800, fontSize: '11.5px', color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                    ZERO TV SERVİSİ — Ekran Değişimi ({sortedScreens.length})
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={addScreenRow}
                                className="btn btn-secondary"
                                style={{ fontSize: '10px', padding: '2px 6px', gap: '3px', borderRadius: '4px' }}
                            >
                                <Plus size={11} />
                                <span>Ekle</span>
                            </button>
                        </div>

                        <div style={{ maxHeight: 'calc(100vh - 165px)', overflowY: 'auto', overflowX: 'hidden' }}>
                            <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                                {renderScreenTableHeader(false)}
                                <tbody>
                                    {sortedScreens.map((row, idx) => renderScreenRow(row, idx, idx, false))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* SAĞ TABLO: LED DEĞİŞİMİ & TAMİRCİ İŞÇİLİK */}
                    <div style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        minWidth: 0,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}>
                        <div style={{
                            padding: '6px 10px',
                            background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.18), rgba(99, 102, 241, 0.05))',
                            borderBottom: '1px solid var(--border-primary)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Lightbulb size={14} style={{ color: '#34d399' }} />
                                <span style={{ fontWeight: 800, fontSize: '11.5px', color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                    LED Değişimi & Tamirci İşçilik ({sortedLeds.length})
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={addLedRow}
                                className="btn btn-secondary"
                                style={{ fontSize: '10px', padding: '2px 6px', gap: '3px', borderRadius: '4px' }}
                            >
                                <Plus size={11} />
                                <span>Ekle</span>
                            </button>
                        </div>

                        <div style={{ maxHeight: 'calc(100vh - 165px)', overflowY: 'auto', overflowX: 'hidden' }}>
                            <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                                {renderLedTableHeader(false)}
                                <tbody>
                                    {sortedLeds.map((row, idx) => renderLedRow(row, idx, idx, false))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* 2) SADECE EKRAN GÖRÜNÜMÜ: SIFIR KAYDIRMA, YAN YANA TAM LİSTE ────────── */}
            {viewMode === 'SCREEN' && (
                <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.15)'
                }}>
                    {/* Üst Başlık & Kontroller */}
                    <div style={{
                        padding: '8px 12px',
                        background: 'linear-gradient(90deg, rgba(37, 99, 235, 0.2), rgba(99, 102, 241, 0.06))',
                        borderBottom: '1px solid var(--border-primary)',
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <Tv size={16} style={{ color: '#60a5fa' }} />
                            <span style={{ fontWeight: 800, fontSize: '13px', color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                ZERO TV SERVİSİ — Ekran Değişimi ({sortedScreens.length} Kalem Model)
                            </span>
                            <span style={{
                                fontSize: '11px',
                                color: '#93c5fd',
                                background: 'rgba(37, 99, 235, 0.15)',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                ⚡ Yan yana tam görünüm: Sayfayı aşağı kaydırmadan tüm modeller tek bakışta
                            </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {/* Sütun Düzeni Seçici */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                background: 'var(--bg-secondary)',
                                padding: '2px 4px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-primary)',
                                gap: '2px'
                            }}>
                                <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-tertiary)', padding: '0 4px' }}>
                                    Düzen:
                                </span>
                                {[2, 3, 4].map(c => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => handleScreenColsChange(c)}
                                        style={{
                                            padding: '2px 8px',
                                            fontSize: '10.5px',
                                            fontWeight: screenCols === c ? 800 : 500,
                                            color: screenCols === c ? '#ffffff' : 'var(--text-secondary)',
                                            background: screenCols === c ? '#2563eb' : 'transparent',
                                            borderRadius: '4px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease'
                                        }}
                                        title={c === 3 ? '3 Sütun (Önerilen: Sıfır Kaydırma)' : `${c} Sütunlu Görünüm`}
                                    >
                                        {c === 3 ? '3 Sütun (Sıfır Kaydırma ★)' : `${c} Sütun`}
                                    </button>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={addScreenRow}
                                className="btn btn-primary"
                                style={{ fontSize: '11px', padding: '3px 10px', gap: '4px', borderRadius: '5px' }}
                            >
                                <Plus size={12} />
                                <span>Yeni Ekran Ekle</span>
                            </button>
                        </div>
                    </div>

                    {/* Çok Sütunlu Grid: 67 satır eşit bölünür, ekrana tam oturur */}
                    <div style={{
                        padding: '6px',
                        display: 'grid',
                        gridTemplateColumns: `repeat(${screenCols}, minmax(0, 1fr))`,
                        gap: '8px',
                        width: '100%',
                        alignItems: 'start'
                    }}>
                        {splitIntoChunks(sortedScreens, screenCols).map((chunk, colIdx) => (
                            <div
                                key={colIdx}
                                style={{
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-primary)',
                                    borderRadius: '6px',
                                    overflow: 'hidden',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                                }}
                            >
                                <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                                    {renderScreenTableHeader(true)}
                                    <tbody>
                                        {chunk.map((row, rowInChunkIdx) => {
                                            const originalIdx = sortedScreens.findIndex(s => s.id === row.id);
                                            return renderScreenRow(row, rowInChunkIdx, originalIdx, true);
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 3) SADECE LED GÖRÜNÜMÜ: SIFIR KAYDIRMA, YAN YANA TAM LİSTE ──────────── */}
            {viewMode === 'LED' && (
                <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.15)'
                }}>
                    {/* Üst Başlık & Kontroller */}
                    <div style={{
                        padding: '8px 12px',
                        background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.2), rgba(99, 102, 241, 0.06))',
                        borderBottom: '1px solid var(--border-primary)',
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <Lightbulb size={16} style={{ color: '#34d399' }} />
                            <span style={{ fontWeight: 800, fontSize: '13px', color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                LED Değişimi & Tamirci İşçilik ({sortedLeds.length} Kalem)
                            </span>
                            <span style={{
                                fontSize: '11px',
                                color: '#6ee7b7',
                                background: 'rgba(16, 185, 129, 0.15)',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                ⚡ Yan yana tam görünüm: Sayfayı aşağı kaydırmadan tüm modeller tek bakışta
                            </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {/* Sütun Düzeni Seçici */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                background: 'var(--bg-secondary)',
                                padding: '2px 4px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-primary)',
                                gap: '2px'
                            }}>
                                <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-tertiary)', padding: '0 4px' }}>
                                    Düzen:
                                </span>
                                {[1, 2, 3].map(c => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => handleLedColsChange(c)}
                                        style={{
                                            padding: '2px 8px',
                                            fontSize: '10.5px',
                                            fontWeight: ledCols === c ? 800 : 500,
                                            color: ledCols === c ? '#ffffff' : 'var(--text-secondary)',
                                            background: ledCols === c ? '#059669' : 'transparent',
                                            borderRadius: '4px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease'
                                        }}
                                        title={c === 2 ? '2 Sütun (Önerilen: Sıfır Kaydırma)' : `${c} Sütunlu Görünüm`}
                                    >
                                        {c === 2 ? '2 Sütun (Sıfır Kaydırma ★)' : `${c} Sütun`}
                                    </button>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={addLedRow}
                                className="btn btn-primary"
                                style={{ fontSize: '11px', padding: '3px 10px', gap: '4px', borderRadius: '5px' }}
                            >
                                <Plus size={12} />
                                <span>Yeni LED Ekle</span>
                            </button>
                        </div>
                    </div>

                    {/* Çok Sütunlu Grid */}
                    <div style={{
                        padding: '6px',
                        display: 'grid',
                        gridTemplateColumns: `repeat(${ledCols}, minmax(0, 1fr))`,
                        gap: '8px',
                        width: '100%',
                        alignItems: 'start'
                    }}>
                        {splitIntoChunks(sortedLeds, ledCols).map((chunk, colIdx) => (
                            <div
                                key={colIdx}
                                style={{
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-primary)',
                                    borderRadius: '6px',
                                    overflow: 'hidden',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                                }}
                            >
                                <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                                    {renderLedTableHeader(true)}
                                    <tbody>
                                        {chunk.map((row, rowInChunkIdx) => {
                                            const originalIdx = sortedLeds.findIndex(s => s.id === row.id);
                                            return renderLedRow(row, rowInChunkIdx, originalIdx, true);
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── Modal: TV Model Ekran & LED Uyumluluk Özeti ("Ne Takılır?" Modalı) ── */}
            {selectedModelName && (
                <div className="modal-overlay" onClick={() => { setSelectedModelName(null); setModelSummaryData(null); }}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1280px', width: '95vw', maxHeight: '92vh', overflowY: 'auto' }}>
                        <div className="modal-header">
                            <div>
                                <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    📺 {selectedModelName} — TV Model Ekran & LED Uyumluluk Özeti
                                </h3>
                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                    Bu modelde daha önce sökülen ekranlar, takılan uyumlu ekranlar ve geçmiş işlem notları
                                </div>
                            </div>
                            <button className="modal-close" onClick={() => { setSelectedModelName(null); setModelSummaryData(null); }}>×</button>
                        </div>

                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {isLoadingModelSummary || !modelSummaryData ? (
                                <div style={{ padding: '40px', textAlign: 'center' }}>
                                    <div className="spinner" style={{ margin: '0 auto 12px' }} />
                                    <div>Model uyumluluk özeti yükleniyor...</div>
                                </div>
                            ) : (
                                <>
                                    {/* Summary Cards */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
                                        {/* Original Screens */}
                                        <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
                                            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '8px' }}>
                                                📤 Çıkan Orijinal Ekranlar (Paneller)
                                            </div>
                                            {modelSummaryData.originalScreens.length === 0 ? (
                                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Kayıt bulunmuyor</div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    {modelSummaryData.originalScreens.map((item: any) => (
                                                        <div key={item.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontFamily: 'monospace', padding: '4px 8px', background: 'var(--bg-tertiary)', borderRadius: '4px' }}>
                                                            <span style={{ fontWeight: 600 }}>{item.code}</span>
                                                            <span className="badge badge-secondary" style={{ fontSize: '10.5px' }}>{item.count} Kez</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Installed Compatible Screens */}
                                        <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.06)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                                            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-success)', textTransform: 'uppercase', marginBottom: '8px' }}>
                                                📥 Takılan Uyumlu Ekranlar
                                            </div>
                                            {modelSummaryData.installedScreens.length === 0 ? (
                                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Kayıt bulunmuyor</div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                    {modelSummaryData.installedScreens.map((item: any) => (
                                                        <div key={item.code} style={{ fontSize: '12px', padding: '6px 8px', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-primary)' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'monospace' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    <span style={{ fontWeight: 700, color: 'var(--color-success)' }}>{item.code}</span>
                                                                    {item.inStock ? (
                                                                        <span className="badge badge-success" style={{ fontSize: '10px', padding: '1px 6px' }}>
                                                                            ✅ STOKTA VAR ({item.stock} Adet)
                                                                        </span>
                                                                    ) : (
                                                                        <span className="badge" style={{ fontSize: '10px', padding: '1px 6px', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--color-danger)' }}>
                                                                            ❌ STOKTA YOK
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className="badge badge-success" style={{ fontSize: '10.5px' }}>{item.count} Kez Takıldı</span>
                                                            </div>
                                                            {item.actions.length > 0 && (
                                                                <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                                                                    Uygulama: {item.actions.join(', ')}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Installed LED Sets */}
                                        {modelSummaryData.installedLeds.length > 0 && (
                                            <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.06)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                                                <div style={{ fontSize: '11px', fontWeight: 700, color: '#d97706', textTransform: 'uppercase', marginBottom: '8px' }}>
                                                    💡 Takılan LED Setleri
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    {modelSummaryData.installedLeds.map((item: any) => (
                                                        <div key={item.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontFamily: 'monospace', padding: '4px 8px', background: 'var(--bg-tertiary)', borderRadius: '4px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <span style={{ fontWeight: 600, color: '#d97706' }}>{item.code}</span>
                                                                {item.inStock ? (
                                                                    <span className="badge badge-success" style={{ fontSize: '10px', padding: '1px 6px' }}>
                                                                        ✅ STOKTA VAR ({item.stock} Adet)
                                                                    </span>
                                                                ) : (
                                                                    <span className="badge" style={{ fontSize: '10px', padding: '1px 6px', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--color-danger)' }}>
                                                                        ❌ STOKTA YOK
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', fontSize: '10.5px' }}>{item.count} Kez</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Detailed Past Repair Tickets Table */}
                                    <div>
                                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span>📋 Bu Model için Tüm Geçmiş Fiş & Tamir Kayıtları ({modelSummaryData.records.length})</span>
                                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 400 }}>Tam detay için satıra tıklayın</span>
                                        </div>

                                        <div className="table-container" style={{ maxHeight: '340px', overflowY: 'auto' }}>
                                            <table className="table" style={{ fontSize: '12px' }}>
                                                <thead>
                                                    <tr>
                                                        <th>Fiş No</th>
                                                        <th>Tarih / Teknisyen</th>
                                                        <th>Çıkan Ekran</th>
                                                        <th>Takılan Ekran</th>
                                                        <th>İşlem Notu</th>
                                                        <th>Takılan LED</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {modelSummaryData.records.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-tertiary)' }}>
                                                                Bu modele ait geçmiş fiş kaydı bulunmamaktadır.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        modelSummaryData.records.map((r: any) => (
                                                            <tr
                                                                key={r.id || r.legacyTicketNo}
                                                                style={{ cursor: 'pointer' }}
                                                                onClick={() => setSelectedRecord(r)}
                                                            >
                                                                <td>
                                                                    <span className="badge badge-secondary" style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                                                                        #{isValidValue(r.legacyTicketNo) ? r.legacyTicketNo : '-'}
                                                                    </span>
                                                                </td>
                                                                <td style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                                                    <div>{isValidValue(r.technicianName) ? r.technicianName : '-'}</div>
                                                                    <div>{formatDateValue(r.date)}</div>
                                                                </td>
                                                                <td style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                                                                    {isValidValue(r.originalScreen) ? r.originalScreen : '-'}
                                                                </td>
                                                                <td style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--color-success)', fontWeight: 600 }}>
                                                                    {isValidValue(r.installedScreen) ? r.installedScreen : '-'}
                                                                </td>
                                                                <td>
                                                                    {isValidValue(r.screenAction) ? (
                                                                        <span className="badge badge-success" style={{ fontSize: '10.5px' }}>
                                                                            {r.screenAction}
                                                                        </span>
                                                                    ) : '-'}
                                                                </td>
                                                                <td style={{ fontFamily: 'monospace', fontSize: '11px', color: '#d97706' }}>
                                                                    {isValidValue(r.installedLed) ? r.installedLed : '-'}
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Modal: Geçmiş Fiş & Tamir Kaydı Detayı (Ticket Detay Modalı) ── */}
            {selectedRecord && (
                <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => setSelectedRecord(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">💡 {selectedRecord.brand} {selectedRecord.model} — Fiş & Tamir Detayı</h3>
                            <button className="modal-close" onClick={() => setSelectedRecord(null)}>×</button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', wordBreak: 'break-word' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>MARKA & MODEL</div>
                                    <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--brand-primary)' }}>{selectedRecord.brand} {selectedRecord.model}</div>
                                </div>
                                <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>TCON</div>
                                    <div style={{ fontWeight: 600 }}>{isValidValue(selectedRecord.tcon) ? selectedRecord.tcon : '-'}</div>
                                </div>
                            </div>

                            <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '8px' }}>
                                <div style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: 700, marginBottom: '6px' }}>📱 EKRAN UYUMLULUK BİLGİSİ</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {isValidValue(selectedRecord.originalScreen) && (
                                        <div><strong>Orijinal Ekran:</strong> <span style={{ fontFamily: 'monospace' }}>{selectedRecord.originalScreen}</span></div>
                                    )}
                                    {isValidValue(selectedRecord.installedScreen) && (
                                        <div><strong>Takılan Ekran:</strong> <span style={{ fontFamily: 'monospace', color: 'var(--color-success)', fontWeight: 700 }}>{selectedRecord.installedScreen}</span></div>
                                    )}
                                    {isValidValue(selectedRecord.screenAction) && (
                                        <div style={{ marginTop: '6px', fontSize: '12px', background: 'rgba(16, 185, 129, 0.12)', padding: '8px 10px', borderRadius: '6px', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                                            <strong>Yapılan İşlem:</strong> {selectedRecord.screenAction}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {isValidValue(selectedRecord.installedLed) && (
                                <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '11px', color: '#d97706', fontWeight: 700, marginBottom: '6px' }}>💡 LED UYUMLULUK BİLGİSİ</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div><strong>Takılan LED Seti:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{selectedRecord.installedLed}</span></div>
                                        {isValidValue(selectedRecord.ledAction) && (
                                            <div style={{ marginTop: '4px', whiteSpace: 'pre-wrap' }}><strong>LED İşlemi:</strong> {selectedRecord.ledAction}</div>
                                        )}
                                        {isValidValue(selectedRecord.installedQuantity) && (
                                            <div><strong>Adet:</strong> {selectedRecord.installedQuantity}</div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {isValidValue(selectedRecord.notes) && (
                                <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>BİLGİ NOTU</div>
                                    <div style={{ whiteSpace: 'pre-wrap', marginTop: '2px' }}>{selectedRecord.notes}</div>
                                </div>
                            )}

                            {isValidValue(selectedRecord.panelData) && (
                                <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>PANEL DATASI</div>
                                    <div style={{ fontFamily: 'monospace', marginTop: '2px', fontSize: '12px', whiteSpace: 'pre-wrap' }}>{selectedRecord.panelData}</div>
                                </div>
                            )}

                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-primary)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                                <span>Eski Fiş No: #{isValidValue(selectedRecord.legacyTicketNo) ? selectedRecord.legacyTicketNo : '-'}</span>
                                <span>Teknisyen: {isValidValue(selectedRecord.technicianName) ? selectedRecord.technicianName : '-'} · Tarih: {formatDateValue(selectedRecord.date)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
