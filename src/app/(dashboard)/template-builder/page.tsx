'use client';

import React, { useState } from 'react';
import Sidebar from '@/components/template-builder/Sidebar';
import Canvas from '@/components/template-builder/Canvas';
import PropertiesPanel from '@/components/template-builder/PropertiesPanel';
import { Save, RefreshCw, Trash2, ArrowLeft, ZoomIn, ZoomOut, Copy, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getReceiptTemplate, saveReceiptTemplate } from '@/actions/template';
import { useEffect } from 'react';

interface ElementStyles {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string;
    lineHeight?: number;
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    color?: string;
    backgroundColor?: string;
    isTransparentFill?: boolean;
    isTransparentBorder?: boolean;
    headerBackgroundColor?: string;
    headerColor?: string;
    borderWidth?: number;
    borderColor?: string;
    borderStyle?: 'solid' | 'dashed' | 'dotted' | 'double' | 'groove' | 'ridge' | 'none';
    borderRadius?: number;
    shapeType?: 'rect' | 'circle' | 'triangle';
}

interface TableColumn {
    id: string;
    title: string;
    key: string;
    width: number;
}

interface TemplateElement {
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    content?: string;
    styles: ElementStyles;
    columns?: TableColumn[];
}

const DEFAULT_TEMPLATE_A4: TemplateElement[] = [
    {
        id: '1',
        type: 'image',
        x: 40,
        y: 40,
        width: 70,
        height: 70,
        content: '/logo.png',
        styles: {},
    },
    {
        id: '2',
        type: 'text',
        x: 130,
        y: 40,
        width: 320,
        height: 70,
        content: 'Zero Elektronik Tv Ekran Değişim ve\nTamir Servisi\nTelefon: 05347634654',
        styles: {
            fontFamily: 'sans-serif',
            fontSize: 14,
            fontWeight: 'bold',
            lineHeight: 1.3,
            color: '#1f2937',
        },
    },
    {
        id: '3',
        type: 'text',
        x: 520,
        y: 40,
        width: 230,
        height: 80,
        content: 'Fiş No : {{ticketNo}}\nTarih : {{creationDate}}\nDurum : {{status}}',
        styles: {
            fontFamily: 'sans-serif',
            fontSize: 12,
            fontWeight: 'normal',
            lineHeight: 1.5,
            color: '#374151',
            textAlign: 'right',
        },
    },
    {
        id: '4',
        type: 'divider',
        x: 40,
        y: 130,
        width: 714,
        height: 10,
        styles: {
            borderWidth: 2,
            borderColor: '#e5e7eb',
            borderStyle: 'solid',
        },
    },
    {
        id: '5',
        type: 'text',
        x: 40,
        y: 155,
        width: 714,
        height: 85,
        content: 'Samsung Tv Ekran Değişim Tamir Teslim Formu\nMüşteri: {{customerName}}\nTelefon: {{customerPhone}}',
        styles: {
            fontFamily: 'sans-serif',
            fontSize: 13,
            fontWeight: 'bold',
            lineHeight: 1.5,
            color: '#111827',
        },
    },
    {
        id: '6',
        type: 'table',
        x: 40,
        y: 250,
        width: 714,
        height: 200,
        styles: {
            fontSize: 12,
            borderWidth: 1,
            borderColor: '#e5e7eb',
            headerBackgroundColor: '#2461db',
            headerColor: '#ffffff',
            color: '#000000',
            backgroundColor: '#ffffff',
        },
        columns: [
            { id: 'c1', title: 'Ürün Veya Hizmet', key: 'name', width: 50 },
            { id: 'c2', title: 'Fiyat', key: 'price', width: 20 },
            { id: 'c3', title: 'Adet', key: 'qty', width: 10 },
            { id: 'c4', title: 'Satır Toplamı', key: 'total', width: 20 },
        ],
    },
    {
        id: '7',
        type: 'text',
        x: 40,
        y: 470,
        width: 450,
        height: 180,
        content: 'Ödeme teslimatta nakit olarak alınır.\n\nYasal Şartlar\n- Ekran değişim işlemi ORIGINAL yedek parçalar kullanılarak yapılır ve değişen parçalar için 12 Ay garanti verilir.\n- Onarım işlemi stoklu ürünler için 4-5 iş günüdür.\n- Müşteri tarafından belirtilen arıza dışında bir arıza tespit edilirse, ortaya çıkacak maliyet müşteriye yansıtılır.',
        styles: {
            fontFamily: 'sans-serif',
            fontSize: 10,
            lineHeight: 1.4,
            color: '#4b5563',
        },
    },
    {
        id: '8',
        type: 'text',
        x: 520,
        y: 470,
        width: 230,
        height: 80,
        content: 'Ara Toplam: {{totalAmount}}\nToplam Fiyat: {{totalAmount}}',
        styles: {
            fontFamily: 'sans-serif',
            fontSize: 13,
            fontWeight: 'bold',
            lineHeight: 1.6,
            color: '#111827',
            textAlign: 'right',
        },
    },
    {
        id: '9',
        type: 'text',
        x: 40,
        y: 690,
        width: 300,
        height: 50,
        content: 'Teslim Eden\n........................',
        styles: {
            fontFamily: 'sans-serif',
            fontSize: 12,
            fontWeight: 'bold',
            textAlign: 'center',
            color: '#374151',
        },
    },
    {
        id: '10',
        type: 'text',
        x: 454,
        y: 690,
        width: 300,
        height: 50,
        content: 'Teslim Alan\n........................',
        styles: {
            fontFamily: 'sans-serif',
            fontSize: 12,
            fontWeight: 'bold',
            textAlign: 'center',
            color: '#374151',
        },
    },
];

const DEFAULT_TEMPLATE_ROLL: TemplateElement[] = [
    {
        id: 'r1',
        type: 'image',
        x: 125,
        y: 20,
        width: 70,
        height: 70,
        content: '/logo.png',
        styles: {},
    },
    {
        id: 'r2',
        type: 'text',
        x: 20,
        y: 100,
        width: 280,
        height: 40,
        content: 'Zero Elektronik Servis',
        styles: {
            fontFamily: 'sans-serif',
            fontSize: 14,
            fontWeight: 'bold',
            textAlign: 'center',
            color: '#1f2937',
        },
    },
    {
        id: 'r3',
        type: 'divider',
        x: 20,
        y: 145,
        width: 280,
        height: 6,
        styles: { borderWidth: 1, borderColor: '#e5e7eb', borderStyle: 'solid' },
    },
    {
        id: 'r4',
        type: 'text',
        x: 20,
        y: 160,
        width: 280,
        height: 120,
        content: 'Fiş No: {{ticketNo}}\nMüşteri: {{customerName}}\nTelefon: {{customerPhone}}\nCihaz: {{brand}} {{model}}\nTarih: {{creationDate}}',
        styles: {
            fontFamily: 'sans-serif',
            fontSize: 12,
            fontWeight: 'bold',
            lineHeight: 1.5,
            color: '#111827',
            textAlign: 'left',
        },
    },
    {
        id: 'r5',
        type: 'divider',
        x: 20,
        y: 290,
        width: 280,
        height: 6,
        styles: { borderWidth: 1, borderColor: '#e5e7eb', borderStyle: 'dashed' },
    },
    {
        id: 'r6',
        type: 'text',
        x: 20,
        y: 305,
        width: 280,
        height: 40,
        content: 'Toplam Tutar: {{totalAmount}}',
        styles: {
            fontFamily: 'sans-serif',
            fontSize: 14,
            fontWeight: 'bold',
            textAlign: 'center',
            color: '#111827',
        },
    },
];

export default function TemplateBuilderPage() {
    const router = useRouter();
    const [zoom, setZoom] = useState<number>(0.85);
    const [canvasType, setCanvasType] = useState<'a4' | 'roll'>('a4');
    const [rollWidthMmInput, setRollWidthMmInput] = useState<string>('80');
    const [rollHeightMmInput, setRollHeightMmInput] = useState<string>('150');
    const [rollPreset, setRollPreset] = useState<string>('80x150');
    const [a4Elements, setA4Elements] = useState<TemplateElement[]>(DEFAULT_TEMPLATE_A4);
    const [rollElements, setRollElements] = useState<TemplateElement[]>(DEFAULT_TEMPLATE_ROLL);
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
    const [savedJson, setSavedJson] = useState<string | null>(null);
    const [copiedJson, setCopiedJson] = useState<boolean>(false);

    const handleCopyJson = () => {
        if (!savedJson) return;
        navigator.clipboard.writeText(savedJson);
        setCopiedJson(true);
        setTimeout(() => setCopiedJson(false), 2000);
    };

    // Derived numeric canvas dimensions (1mm = 4px)
    const rollWidth = Number(rollWidthMmInput) > 0 ? Math.round(Number(rollWidthMmInput) * 4) : 320;
    const rollHeight = Number(rollHeightMmInput) > 0 ? Math.round(Number(rollHeightMmInput) * 4) : 600;

    // Active elements based on current canvas format
    const elements = canvasType === 'a4' ? a4Elements : rollElements;
    const setElements = (newEls: TemplateElement[]) => {
        if (canvasType === 'a4') {
            setA4Elements(newEls);
        } else {
            setRollElements(newEls);
        }
    };

    // Load templates on mount
    useEffect(() => {
        Promise.all([
            getReceiptTemplate('a4'),
            getReceiptTemplate('roll'),
        ]).then(([a4Data, rollData]) => {
            if (a4Data && a4Data.elements) {
                setA4Elements(a4Data.elements);
            }
            if (rollData) {
                if (rollData.elements) setRollElements(rollData.elements);
                const wMm = rollData.widthMm || (rollData.width ? Math.round(rollData.width / 4) : 80);
                const hMm = rollData.heightMm || (rollData.height ? Math.round(rollData.height / 4) : 150);
                setRollWidthMmInput(String(wMm));
                setRollHeightMmInput(String(hMm));
                const matched = ['80x150', '58x125', '50x30', '60x40', '100x150'].find((p) => p === `${wMm}x${hMm}`);
                setRollPreset(matched || 'custom');
            }
        }).catch((err) => {
            console.error('Error loading custom templates:', err);
        });
    }, []);

    // Helpers to update state
    const handleAddElement = (type: string, variableKey?: string) => {
        const newEl: TemplateElement = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            x: canvasType === 'a4' ? 200 : 50,
            y: 150,
            width: type === 'table' || type === 'divider' ? (canvasType === 'a4' ? 600 : 280) : 180,
            height: type === 'table' ? 120 : type === 'divider' ? 15 : 60,
            content: type === 'text' 
                ? 'Yeni Metin Kutusu' 
                : type === 'variable' 
                ? (variableKey ? `{{${variableKey}}}` : '{{customerName}}')
                : type === 'image' 
                ? '/logo.png' 
                : '',
            styles: {
                fontFamily: 'sans-serif',
                fontSize: 13,
                fontWeight: type === 'variable' ? 'bold' : 'normal',
                lineHeight: 1.4,
                color: '#000000',
                backgroundColor: 'transparent',
                textAlign: 'left',
            },
        };

        if (type === 'table') {
            newEl.styles.headerBackgroundColor = '#2461db';
            newEl.styles.headerColor = '#ffffff';
            newEl.styles.color = '#000000';
            newEl.styles.backgroundColor = '#ffffff';
            newEl.columns = [
                { id: 'c1', title: 'Ürün Veya Hizmet', key: 'name', width: 50 },
                { id: 'c2', title: 'Fiyat', key: 'price', width: 25 },
                { id: 'c3', title: 'Toplam', key: 'total', width: 25 },
            ];
        } else if (type === 'shape') {
            const shapeType = (variableKey || 'rect') as 'rect' | 'circle' | 'triangle';
            newEl.width = 120;
            newEl.height = 100;
            newEl.styles = {
                shapeType,
                borderWidth: 2,
                borderColor: '#000000',
                borderStyle: 'solid',
                backgroundColor: '#e5e7eb',
                isTransparentFill: false,
                isTransparentBorder: false,
                borderRadius: shapeType === 'circle' ? 999 : 8,
            };
        }

        setElements([...elements, newEl]);
        setSelectedElementId(newEl.id);
    };

    const handleAddElementAt = (type: string, x: number, y: number, variableKey?: string) => {
        let actualType = type;
        let actualShapeKey = variableKey;
        if (type.startsWith('shape:')) {
            actualType = 'shape';
            actualShapeKey = type.split(':')[1];
        }

        const newEl: TemplateElement = {
            id: Math.random().toString(36).substr(2, 9),
            type: actualType,
            x,
            y,
            width: actualType === 'table' || actualType === 'divider' ? (canvasType === 'a4' ? 600 : 280) : 180,
            height: actualType === 'table' ? 120 : actualType === 'divider' ? 15 : 60,
            content: actualType === 'text' 
                ? 'Yeni Metin Kutusu' 
                : actualType === 'variable' 
                ? (actualShapeKey ? `{{${actualShapeKey}}}` : '{{customerName}}')
                : actualType === 'image' 
                ? '/logo.png' 
                : '',
            styles: {
                fontFamily: 'sans-serif',
                fontSize: 13,
                fontWeight: actualType === 'variable' ? 'bold' : 'normal',
                lineHeight: 1.4,
                color: '#000000',
                backgroundColor: 'transparent',
                textAlign: 'left',
            },
        };

        if (actualType === 'table') {
            newEl.styles.headerBackgroundColor = '#2461db';
            newEl.styles.headerColor = '#ffffff';
            newEl.styles.color = '#000000';
            newEl.styles.backgroundColor = '#ffffff';
            newEl.columns = [
                { id: 'c1', title: 'Ürün Veya Hizmet', key: 'name', width: 50 },
                { id: 'c2', title: 'Fiyat', key: 'price', width: 25 },
                { id: 'c3', title: 'Toplam', key: 'total', width: 25 },
            ];
        } else if (actualType === 'shape') {
            const shapeType = (actualShapeKey || 'rect') as 'rect' | 'circle' | 'triangle';
            newEl.width = 120;
            newEl.height = 100;
            newEl.styles = {
                shapeType,
                borderWidth: 2,
                borderColor: '#000000',
                borderStyle: 'solid',
                backgroundColor: '#e5e7eb',
                isTransparentFill: false,
                isTransparentBorder: false,
                borderRadius: shapeType === 'circle' ? 999 : 8,
            };
        }

        setElements([...elements, newEl]);
        setSelectedElementId(newEl.id);
    };

    const handleUpdateElement = (id: string, updates: Partial<TemplateElement>) => {
        setElements(elements.map((el) => (el.id === id ? { ...el, ...updates } : el)));
    };

    const handleDeleteElement = (id: string) => {
        setElements(elements.filter((el) => el.id !== id));
        if (selectedElementId === id) setSelectedElementId(null);
    };

    const handleSaveTemplate = async () => {
        const data = {
            format: canvasType,
            widthMm: canvasType === 'roll' ? (Number(rollWidthMmInput) || 80) : 210,
            heightMm: canvasType === 'roll' ? (Number(rollHeightMmInput) || 150) : 297,
            width: canvasType === 'roll' ? rollWidth : 794,
            height: canvasType === 'roll' ? rollHeight : 1123,
            elements: elements,
            updatedAt: new Date().toISOString(),
        };
        try {
            await saveReceiptTemplate(data, canvasType);
            setSavedJson(JSON.stringify(data, null, 2));
            setTimeout(() => setSavedJson(null), 8000);
            alert(`${canvasType === 'a4' ? 'A4' : 'Rulo (Termal Etiket)'} şablonu başarıyla kaydedildi!`);
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleClearCanvas = () => {
        if (confirm('Tüm elemanları silmek istediğinizden emin misiniz?')) {
            setElements([]);
            setSelectedElementId(null);
        }
    };

    const handleResetTemplate = () => {
        if (confirm(`${canvasType === 'a4' ? 'A4' : 'Rulo'} varsayılan şablonunu geri yüklemek istiyor musunuz?`)) {
            if (canvasType === 'a4') {
                setA4Elements(DEFAULT_TEMPLATE_A4);
            } else {
                setRollElements(DEFAULT_TEMPLATE_ROLL);
            }
            setSelectedElementId(null);
        }
    };

    const selectedElement = elements.find((el) => el.id === selectedElementId) || null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
            {/* Top Navigation / Action Bar */}
            <div style={{
                height: '60px',
                background: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 24px',
                color: 'var(--text-primary)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button
                        onClick={() => router.back()}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: 500,
                        }}
                    >
                        <ArrowLeft size={16} /> Geri
                    </button>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Şablon Oluşturucu (Template Builder)</h2>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Teknik servis fişinizi A4 veya Rulo formatında tasarlayın.</span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Format Selector */}
                    <div style={{ display: 'flex', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: '6px', padding: '3px' }}>
                        <button
                            onClick={() => setCanvasType('a4')}
                            style={{
                                background: canvasType === 'a4' ? 'var(--brand-primary)' : 'transparent',
                                border: 'none',
                                color: canvasType === 'a4' ? '#ffffff' : 'var(--text-secondary)',
                                padding: '6px 12px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            📃 A4 Formatı
                        </button>
                        <button
                            onClick={() => setCanvasType('roll')}
                            style={{
                                background: canvasType === 'roll' ? 'var(--brand-primary)' : 'transparent',
                                border: 'none',
                                color: canvasType === 'roll' ? '#ffffff' : 'var(--text-secondary)',
                                padding: '6px 12px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            🧾 Rulo (Termal / Etiket)
                        </button>
                    </div>

                    {/* Roll Paper Dimension Controls */}
                    {canvasType === 'roll' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: '6px', padding: '3px 8px', fontSize: '12px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>📏 Kağıt:</span>
                            <select
                                className="form-select"
                                style={{ padding: '2px 6px', fontSize: '12px', height: '28px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
                                value={rollPreset}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setRollPreset(val);
                                    if (val !== 'custom') {
                                        const [w, h] = val.split('x');
                                        setRollWidthMmInput(w);
                                        setRollHeightMmInput(h);
                                    }
                                }}
                            >
                                <option value="80x150">80mm Termal (80mm x 150mm)</option>
                                <option value="58x125">58mm Termal (58mm x 125mm)</option>
                                <option value="50x30">50x30mm Etiket (50mm x 30mm)</option>
                                <option value="60x40">60x40mm Etiket (60mm x 40mm)</option>
                                <option value="100x150">100x150mm Etiket (100mm x 150mm)</option>
                                <option value="custom">Özel Boyut (mm)...</option>
                            </select>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>G:</span>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={rollWidthMmInput}
                                    onChange={(e) => {
                                        setRollWidthMmInput(e.target.value);
                                        setRollPreset('custom');
                                    }}
                                    style={{ width: '50px', padding: '2px 4px', fontSize: '12px', height: '28px', textAlign: 'center' }}
                                    placeholder="80"
                                    title="Genişlik (mm)"
                                />
                                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>mm x Y:</span>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={rollHeightMmInput}
                                    onChange={(e) => {
                                        setRollHeightMmInput(e.target.value);
                                        setRollPreset('custom');
                                    }}
                                    style={{ width: '50px', padding: '2px 4px', fontSize: '12px', height: '28px', textAlign: 'center' }}
                                    placeholder="150"
                                    title="Yükseklik (mm)"
                                />
                                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>mm</span>
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: '6px', padding: '3px' }}>
                        <button
                            onClick={() => setZoom(Math.max(0.5, zoom - 0.05))}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '4px' }}
                            title="Küçült"
                        >
                            <ZoomOut size={16} />
                        </button>
                        <span style={{ fontSize: '11px', fontWeight: 600, minWidth: '36px', textAlign: 'center', color: 'var(--text-primary)' }}>
                            {Math.round(zoom * 100)}%
                        </span>
                        <button
                            onClick={() => setZoom(Math.min(1.2, zoom + 0.05))}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '4px' }}
                            title="Büyüt"
                        >
                            <ZoomIn size={16} />
                        </button>
                    </div>

                    <div style={{ width: '1px', height: '24px', background: 'var(--border-primary)' }}></div>

                    {/* Actions */}
                    <button
                        onClick={handleResetTemplate}
                        style={{
                            background: 'var(--bg-tertiary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-primary)',
                            borderRadius: '6px',
                            padding: '8px 14px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                        }}
                    >
                        <RefreshCw size={14} /> Varsayılana Sıfırla
                    </button>
                    <button
                        onClick={handleClearCanvas}
                        style={{
                            background: 'transparent',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '6px',
                            padding: '8px 14px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                        }}
                    >
                        <Trash2 size={14} /> Temizle
                    </button>
                    <button
                        onClick={handleSaveTemplate}
                        style={{
                            background: 'var(--brand-primary, #2563eb)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '8px 16px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                        }}
                    >
                        <Save size={14} /> Şablonu Kaydet
                    </button>
                </div>
            </div>

            {/* Main Area */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
                <Sidebar onAddElement={handleAddElement} />
                <Canvas
                    elements={elements}
                    selectedElementId={selectedElementId}
                    canvasType={canvasType}
                    rollWidth={rollWidth}
                    rollHeight={rollHeight}
                    zoom={zoom}
                    onSelectElement={setSelectedElementId}
                    onUpdateElement={handleUpdateElement}
                    onAddElementAt={handleAddElementAt}
                />
                <PropertiesPanel
                    element={selectedElement}
                    onUpdateElement={handleUpdateElement}
                    onDeleteElement={handleDeleteElement}
                />

                {/* Save Toast Modal */}
                {savedJson && (
                    <div style={{
                        position: 'absolute',
                        bottom: '24px',
                        left: '24px',
                        width: '450px',
                        maxHeight: '300px',
                        background: 'var(--bg-secondary, #1f2937)',
                        border: '1px solid var(--brand-primary, #2563eb)',
                        borderRadius: '8px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        zIndex: 9999,
                        color: '#fff',
                        fontFamily: 'monospace',
                        animation: 'slideUp 0.3s ease-out',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid var(--border-color, #374151)', paddingBottom: '6px' }}>
                            <span style={{ fontWeight: 'bold', color: '#10b981', fontFamily: 'sans-serif', fontSize: '13px' }}>✓ Şablon Kaydedildi (Konsol Çıktısı)</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                    onClick={handleCopyJson}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        background: copiedJson ? '#10b981' : '#374151',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        padding: '4px 10px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                    }}
                                    title="JSON Çıktısını Kopyala"
                                >
                                    {copiedJson ? <Check size={13} /> : <Copy size={13} />}
                                    <span>{copiedJson ? 'Kopyalandı!' : 'Kopyala'}</span>
                                </button>
                                <button 
                                    onClick={() => setSavedJson(null)} 
                                    style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '14px', padding: '2px 4px' }}
                                    title="Kapat"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                        <div style={{ overflowY: 'auto', flex: 1, fontSize: '11px', whiteSpace: 'pre-wrap', background: 'var(--bg-tertiary, #111827)', padding: '10px', borderRadius: '4px' }}>
                            {savedJson}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
