'use client';

import React from 'react';
import { AlignLeft, AlignCenter, AlignRight, AlignJustify, Trash2 } from 'lucide-react';

export interface ElementStyles {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string;
    lineHeight?: number;
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    color?: string;
    backgroundColor?: string;
    borderWidth?: number;
    borderColor?: string;
    borderStyle?: 'solid' | 'dashed' | 'dotted';
    headerBackgroundColor?: string;
    headerColor?: string;
}

export interface TableColumn {
    id: string;
    title: string;
    key: string;
    width: number; // percentage
}

export interface TemplateElement {
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

interface PropertiesPanelProps {
    element: TemplateElement | null;
    onUpdateElement: (id: string, updates: Partial<TemplateElement>) => void;
    onDeleteElement: (id: string) => void;
}

const VARIABLES = [
    { key: 'ticketNo', label: 'Fiş Numarası (ticketNo)' },
    { key: 'customerName', label: 'Müşteri Adı (customerName)' },
    { key: 'customerPhone', label: 'Müşteri Telefonu (customerPhone)' },
    { key: 'customerAddress', label: 'Müşteri Adresi (customerAddress)' },
    { key: 'customerType', label: 'Müşteri Tipi (customerType)' },
    { key: 'requestType', label: 'Arıza / Talep Türü (requestType)' },
    { key: 'entryDate', label: 'Geliş / Kayıt Tarihi (entryDate)' },
    { key: 'creationDate', label: 'Oluşturulma Tarihi (creationDate)' },
    { key: 'pickupDate', label: 'Servis / Teslim Tarihi (pickupDate)' },
    { key: 'brand', label: 'Cihaz Markası (brand)' },
    { key: 'model', label: 'Cihaz Modeli (model)' },
    { key: 'deviceCondition', label: 'Cihaz Fiziksel Durumu (deviceCondition)' },
    { key: 'totalAmount', label: 'Toplam Tutar (totalAmount)' },
    { key: 'status', label: 'Fiş Durumu (status)' },
];

export default function PropertiesPanel({ element, onUpdateElement, onDeleteElement }: PropertiesPanelProps) {
    if (!element) {
        return (
            <div style={{
                width: '320px',
                background: 'var(--bg-secondary)',
                borderLeft: '1px solid var(--border-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--text-tertiary)',
                fontSize: '13px',
                textAlign: 'center',
                padding: '20px',
            }}>
                Düzenlemek için tuvalden bir eleman seçin.
            </div>
        );
    }

    const updateStyles = (updates: Partial<ElementStyles>) => {
        onUpdateElement(element.id, {
            styles: {
                ...element.styles,
                ...updates,
            },
        });
    };

    const handleAddColumn = () => {
        const columns = element.columns || [];
        const newColumn: TableColumn = {
            id: Math.random().toString(36).substr(2, 9),
            title: 'Yeni Sütun',
            key: 'custom',
            width: 25,
        };
        onUpdateElement(element.id, { columns: [...columns, newColumn] });
    };

    const handleRemoveColumn = (colId: string) => {
        const columns = element.columns || [];
        onUpdateElement(element.id, { columns: columns.filter(c => c.id !== colId) });
    };

    const handleUpdateColumn = (colId: string, updates: Partial<TableColumn>) => {
        const columns = element.columns || [];
        onUpdateElement(element.id, {
            columns: columns.map(c => c.id === colId ? { ...c, ...updates } : c),
        });
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        background: 'var(--bg-input)',
        border: '1px solid var(--border-primary)',
        borderRadius: '6px',
        padding: '6px 10px',
        color: 'var(--text-primary)',
        fontSize: '12px',
        boxSizing: 'border-box',
        outline: 'none',
    };

    const labelStyle: React.CSSProperties = {
        display: 'block',
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--text-secondary)',
        marginBottom: '5px',
    };

    return (
        <div style={{
            width: '320px',
            background: 'var(--bg-secondary)',
            borderLeft: '1px solid var(--border-primary)',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            color: 'var(--text-primary)',
            overflowY: 'auto',
            fontSize: '13px',
        }}>
            {/* Header */}
            <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-primary)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <span style={{ fontWeight: 700, fontSize: '14px', textTransform: 'capitalize', color: 'var(--text-primary)' }}>
                    {element.type === 'text' && '✍️ Metin Kutusu'}
                    {element.type === 'variable' && '🏷️ Değişken Alanı'}
                    {element.type === 'image' && '📸 Görsel / Logo'}
                    {element.type === 'divider' && '➖ Çizgi / Ayırıcı'}
                    {element.type === 'table' && '📊 Hizmet Tablosu'}
                </span>
                <button
                    onClick={() => onDeleteElement(element.id)}
                    style={{
                        background: 'var(--color-danger-bg, rgba(239, 68, 68, 0.15))',
                        color: 'var(--color-danger, #ef4444)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        padding: '6px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s',
                    }}
                    title="Elemanı Sil"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Content Configuration */}
                {element.type === 'text' && (
                    <div>
                        <label style={labelStyle}>Metin İçeriği</label>
                        <textarea
                            value={element.content || ''}
                            onChange={(e) => onUpdateElement(element.id, { content: e.target.value })}
                            style={{
                                ...inputStyle,
                                minHeight: '65px',
                                fontFamily: 'inherit',
                                resize: 'vertical',
                            }}
                        />
                    </div>
                )}

                {element.type === 'variable' && (
                    <div>
                        <label style={labelStyle}>Veri Değişkeni</label>
                        <select
                            value={element.content?.replace(/[{}]/g, '') || ''}
                            onChange={(e) => onUpdateElement(element.id, { content: `{{${e.target.value}}}` })}
                            style={inputStyle}
                        >
                            <option value="">Değişken Seçin</option>
                            {VARIABLES.map((v) => (
                                <option key={v.key} value={v.key}>{v.label}</option>
                            ))}
                        </select>
                    </div>
                )}

                {element.type === 'image' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                            <label style={labelStyle}>📁 Bilgisayardan Logo / Görsel Seç</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onload = (evt) => {
                                            if (evt.target?.result) {
                                                onUpdateElement(element.id, { content: evt.target.result as string });
                                            }
                                        };
                                        reader.readAsDataURL(file);
                                    }
                                }}
                                style={{
                                    ...inputStyle,
                                    padding: '6px',
                                    cursor: 'pointer',
                                }}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>veya Görsel URL / Kaynağı</label>
                            <input
                                type="text"
                                value={element.content || ''}
                                onChange={(e) => onUpdateElement(element.id, { content: e.target.value })}
                                placeholder="/logo.png veya resim linki..."
                                style={inputStyle}
                            />
                        </div>
                        {element.content && (
                            <div style={{
                                padding: '10px',
                                background: 'var(--bg-tertiary)',
                                borderRadius: '6px',
                                border: '1px solid var(--border-primary)',
                                textAlign: 'center',
                            }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Görsel Önizleme:</span>
                                <img 
                                    src={element.content} 
                                    alt="Önizleme" 
                                    style={{ maxHeight: '90px', maxWidth: '100%', objectFit: 'contain', borderRadius: '4px' }} 
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Typography Settings (applicable for text, variable, table) */}
                {['text', 'variable', 'table'].includes(element.type) && (
                    <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '16px' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            Yazı Tipi (Tipografi)
                        </h4>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {/* Font Family & Weight */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                    <label style={labelStyle}>Font Ailesi</label>
                                    <select
                                        value={element.styles.fontFamily || 'sans-serif'}
                                        onChange={(e) => updateStyles({ fontFamily: e.target.value })}
                                        style={inputStyle}
                                    >
                                        <option value="sans-serif">Sans-Serif</option>
                                        <option value="serif">Serif</option>
                                        <option value="monospace">Monospace</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>Kalınlık</label>
                                    <select
                                        value={element.styles.fontWeight || 'normal'}
                                        onChange={(e) => updateStyles({ fontWeight: e.target.value })}
                                        style={inputStyle}
                                    >
                                        <option value="normal">Normal</option>
                                        <option value="bold">Bold</option>
                                        <option value="800">Extra Bold</option>
                                    </select>
                                </div>
                            </div>

                            {/* Font Size & Line Height */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                    <label style={labelStyle}>Boyut (px)</label>
                                    <input
                                        type="number"
                                        min="8"
                                        max="72"
                                        value={element.styles.fontSize || 14}
                                        onChange={(e) => updateStyles({ fontSize: parseInt(e.target.value) || 14 })}
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Satır Yük. (em)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="3"
                                        step="0.1"
                                        value={element.styles.lineHeight || 1.4}
                                        onChange={(e) => updateStyles({ lineHeight: parseFloat(e.target.value) || 1.4 })}
                                        style={inputStyle}
                                    />
                                </div>
                            </div>

                            {/* Text Align */}
                            {element.type !== 'table' && (
                                <div>
                                    <label style={labelStyle}>Hizalama</label>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        {[
                                            { key: 'left', icon: AlignLeft },
                                            { key: 'center', icon: AlignCenter },
                                            { key: 'right', icon: AlignRight },
                                            { key: 'justify', icon: AlignJustify },
                                        ].map((align) => {
                                            const Icon = align.icon;
                                            const active = element.styles.textAlign === align.key;
                                            return (
                                                <button
                                                    key={align.key}
                                                    onClick={() => updateStyles({ textAlign: align.key as any })}
                                                    style={{
                                                        flex: 1,
                                                        padding: '6px',
                                                        background: active ? 'var(--brand-primary)' : 'var(--bg-tertiary)',
                                                        color: active ? '#ffffff' : 'var(--text-secondary)',
                                                        border: '1px solid var(--border-primary)',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                    }}
                                                >
                                                    <Icon size={16} />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Color Configuration */}
                <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '16px' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        🎨 Renkler
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {element.type !== 'divider' && (
                            <div>
                                <label style={labelStyle}>
                                    {element.type === 'table' ? 'Tablo Hücre Yazı Rengi (HEX)' : 'Yazı Rengi (HEX)'}
                                </label>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input
                                        type="color"
                                        value={element.styles.color || '#000000'}
                                        onChange={(e) => updateStyles({ color: e.target.value })}
                                        style={{ width: '36px', height: '36px', border: '1px solid var(--border-primary)', borderRadius: '6px', padding: '2px', cursor: 'pointer', background: 'transparent' }}
                                    />
                                    <input
                                        type="text"
                                        value={element.styles.color || '#000000'}
                                        onChange={(e) => updateStyles({ color: e.target.value })}
                                        style={inputStyle}
                                    />
                                </div>
                            </div>
                        )}

                        {element.type !== 'divider' && (
                            <div>
                                <label style={labelStyle}>
                                    {element.type === 'table' ? 'Tablo Hücre Arka Plan Rengi (HEX)' : 'Arka Plan Rengi (HEX)'}
                                </label>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input
                                        type="color"
                                        value={element.styles.backgroundColor || '#ffffff'}
                                        onChange={(e) => updateStyles({ backgroundColor: e.target.value })}
                                        style={{ width: '36px', height: '36px', border: '1px solid var(--border-primary)', borderRadius: '6px', padding: '2px', cursor: 'pointer', background: 'transparent' }}
                                    />
                                    <input
                                        type="text"
                                        value={element.styles.backgroundColor || '#ffffff'}
                                        onChange={(e) => updateStyles({ backgroundColor: e.target.value })}
                                        style={inputStyle}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Table Header Color Settings */}
                        {element.type === 'table' && (
                            <>
                                <div style={{ borderTop: '1px dashed var(--border-primary)', paddingTop: '10px', marginTop: '4px' }}>
                                    <label style={labelStyle}>
                                        📋 Tablo Başlık Arka Plan Rengi (HEX)
                                    </label>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <input
                                            type="color"
                                            value={element.styles.headerBackgroundColor || '#f3f4f6'}
                                            onChange={(e) => updateStyles({ headerBackgroundColor: e.target.value })}
                                            style={{ width: '36px', height: '36px', border: '1px solid var(--border-primary)', borderRadius: '6px', padding: '2px', cursor: 'pointer', background: 'transparent' }}
                                        />
                                        <input
                                            type="text"
                                            value={element.styles.headerBackgroundColor || '#f3f4f6'}
                                            onChange={(e) => updateStyles({ headerBackgroundColor: e.target.value })}
                                            style={inputStyle}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label style={labelStyle}>
                                        📋 Tablo Başlık Yazı Rengi (HEX)
                                    </label>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <input
                                            type="color"
                                            value={element.styles.headerColor || '#000000'}
                                            onChange={(e) => updateStyles({ headerColor: e.target.value })}
                                            style={{ width: '36px', height: '36px', border: '1px solid var(--border-primary)', borderRadius: '6px', padding: '2px', cursor: 'pointer', background: 'transparent' }}
                                        />
                                        <input
                                            type="text"
                                            value={element.styles.headerColor || '#000000'}
                                            onChange={(e) => updateStyles({ headerColor: e.target.value })}
                                            style={inputStyle}
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {element.type === 'divider' && (
                            <div>
                                <label style={labelStyle}>Çizgi Rengi (HEX)</label>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input
                                        type="color"
                                        value={element.styles.borderColor || '#000000'}
                                        onChange={(e) => updateStyles({ borderColor: e.target.value })}
                                        style={{ width: '36px', height: '36px', border: '1px solid var(--border-primary)', borderRadius: '6px', padding: '2px', cursor: 'pointer', background: 'transparent' }}
                                    />
                                    <input
                                        type="text"
                                        value={element.styles.borderColor || '#000000'}
                                        onChange={(e) => updateStyles({ borderColor: e.target.value })}
                                        style={inputStyle}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Table Column & Layout Config */}
                {element.type === 'table' && (
                    <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Sütun Ayarları</h4>
                            <button
                                onClick={handleAddColumn}
                                style={{
                                    background: 'var(--brand-primary)',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '4px 10px',
                                    borderRadius: '5px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                + Ekle
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {element.columns?.map((col) => (
                                <div key={col.id} style={{
                                    border: '1px solid var(--border-primary)',
                                    padding: '10px',
                                    borderRadius: '8px',
                                    background: 'var(--bg-tertiary)',
                                }}>
                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                        <input
                                            type="text"
                                            value={col.title}
                                            onChange={(e) => handleUpdateColumn(col.id, { title: e.target.value })}
                                            placeholder="Başlık"
                                            style={{
                                                ...inputStyle,
                                                padding: '4px 8px',
                                                fontSize: '11px',
                                            }}
                                        />
                                        <button
                                            onClick={() => handleRemoveColumn(col.id)}
                                            style={{
                                                background: 'var(--color-danger-bg, rgba(239, 68, 68, 0.15))',
                                                color: '#ef4444',
                                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                padding: '0 8px',
                                                fontSize: '12px',
                                            }}
                                            title="Sütunu Sil"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <div style={{ flex: 1 }}>
                                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 500 }}>Genişlik (%)</span>
                                            <input
                                                type="number"
                                                min="5"
                                                max="100"
                                                value={col.width}
                                                onChange={(e) => handleUpdateColumn(col.id, { width: parseInt(e.target.value) || 20 })}
                                                style={{
                                                    ...inputStyle,
                                                    padding: '4px 6px',
                                                    fontSize: '11px',
                                                    marginTop: '2px',
                                                }}
                                            />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 500 }}>Alan (Key)</span>
                                            <select
                                                value={col.key}
                                                onChange={(e) => handleUpdateColumn(col.id, { key: e.target.value })}
                                                style={{
                                                    ...inputStyle,
                                                    padding: '4px 6px',
                                                    fontSize: '11px',
                                                    marginTop: '2px',
                                                }}
                                            >
                                                <option value="name">Hizmet Adı (name)</option>
                                                <option value="price">Fiyatı (price)</option>
                                                <option value="qty">Miktar (qty)</option>
                                                <option value="total">Toplam (total)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '14px' }}>
                            <div>
                                <label style={labelStyle}>Çizgi Kalınlığı</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="5"
                                    value={element.styles.borderWidth || 1}
                                    onChange={(e) => updateStyles({ borderWidth: parseInt(e.target.value) || 0 })}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Çizgi Rengi</label>
                                <input
                                    type="color"
                                    value={element.styles.borderColor || '#e5e7eb'}
                                    onChange={(e) => updateStyles({ borderColor: e.target.value })}
                                    style={{ width: '100%', height: '32px', border: '1px solid var(--border-primary)', borderRadius: '6px', padding: '2px', cursor: 'pointer', background: 'transparent' }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Divider Layout Settings */}
                {element.type === 'divider' && (
                    <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '16px' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Çizgi Detayları</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                                <label style={labelStyle}>Kalınlık (px)</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={element.styles.borderWidth || 2}
                                    onChange={(e) => updateStyles({ borderWidth: parseInt(e.target.value) || 1 })}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Stil</label>
                                <select
                                    value={element.styles.borderStyle || 'solid'}
                                    onChange={(e) => updateStyles({ borderStyle: e.target.value as any })}
                                    style={inputStyle}
                                >
                                    <option value="solid">Düz (Solid)</option>
                                    <option value="dashed">Kesikli (Dashed)</option>
                                    <option value="dotted">Noktalı (Dotted)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {/* Geometry Properties */}
                <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '16px' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Konum & Boyut</h4>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                        <div>
                            <label style={labelStyle}>X Pozisyonu (px)</label>
                            <input
                                type="number"
                                value={Math.round(element.x)}
                                onChange={(e) => onUpdateElement(element.id, { x: parseInt(e.target.value) || 0 })}
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Y Pozisyonu (px)</label>
                            <input
                                type="number"
                                value={Math.round(element.y)}
                                onChange={(e) => onUpdateElement(element.id, { y: parseInt(e.target.value) || 0 })}
                                style={inputStyle}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                            <label style={labelStyle}>Genişlik (px)</label>
                            <input
                                type="number"
                                value={Math.round(element.width)}
                                onChange={(e) => onUpdateElement(element.id, { width: parseInt(e.target.value) || 10 })}
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Yükseklik (px)</label>
                            <input
                                type="number"
                                value={Math.round(element.height)}
                                onChange={(e) => onUpdateElement(element.id, { height: parseInt(e.target.value) || 10 })}
                                style={inputStyle}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
