'use client';

import React from 'react';
import { Type, Image, Minus, Table, Braces } from 'lucide-react';

interface SidebarProps {
    onAddElement: (type: string, variableKey?: string) => void;
}

export default function Sidebar({ onAddElement }: SidebarProps) {
    const tools = [
        {
            type: 'text',
            label: 'Metin Kutusu',
            icon: Type,
            desc: 'Dinamik veya sabit metin ekleyin',
        },
        {
            type: 'variable',
            label: 'Boş Değişken Alanı',
            icon: Braces,
            desc: 'Dinamik verileri bağlayın',
        },
        {
            type: 'image',
            label: 'Görsel / Logo',
            icon: Image,
            desc: 'Fiş logosu veya resim',
        },
        {
            type: 'table',
            label: 'Hizmet Tablosu',
            icon: Table,
            desc: 'Yapılan onarımları listeleyen tablo',
        },
        {
            type: 'divider',
            label: 'Çizgi / Ayırıcı',
            icon: Minus,
            desc: 'Bölümleri ayıran çizgi',
        },
    ];

    const variables = [
        { key: 'customerName', label: '👤 Müşteri Adı', desc: 'Müşteri ismi (customerName)' },
        { key: 'customerPhone', label: '📞 Telefon No', desc: 'Telefon numarası (customerPhone)' },
        { key: 'customerAddress', label: '📍 Müşteri Adresi', desc: 'Müşteri açık adresi (customerAddress)' },
        { key: 'customerType', label: '👥 Müşteri Tipi', desc: 'Şahıs / Tamirci (customerType)' },
        { key: 'requestType', label: '🛠️ Arıza / Talep Türü', desc: 'Ekran Değişimi vb. (requestType)' },
        { key: 'entryDate', label: '📅 Geliş / Kayıt Tarihi', desc: 'Cihaz kayıt tarihi (entryDate)' },
        { key: 'ticketNo', label: '🏷️ Fiş No', desc: 'Tamir fiş numarası (ticketNo)' },
        { key: 'brand', label: '🏷️ Cihaz Markası', desc: 'Cihaz markası (brand)' },
        { key: 'model', label: '📺 Cihaz Modeli', desc: 'Televizyon modeli (model)' },
        { key: 'deviceCondition', label: '🔍 Cihaz Fiziksel Durumu', desc: 'Çizik/hasar notu (deviceCondition)' },
        { key: 'totalAmount', label: '💰 Toplam Tutar', desc: 'Genel toplam tutar (totalAmount)' },
        { key: 'pickupDate', label: '🚗 Servis/Teslim Tarihi', desc: 'Planlanan servis tarihi (pickupDate)' },
        { key: 'status', label: '⚙️ Fiş Durumu', desc: 'Güncel fiş statüsü (status)' },
    ];

    const handleDragStart = (e: React.DragEvent, type: string) => {
        e.dataTransfer.setData('text/plain', type);
    };

    return (
        <div style={{
            width: '280px',
            background: 'var(--bg-secondary)',
            borderRight: '1px solid var(--border-primary)',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            color: 'var(--text-primary)',
        }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border-primary)' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Araç Kutusu</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Öğeleri tuvale sürükleyin veya tıklayarak ekleyin.
                </p>
            </div>

            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1 }}>
                {tools.map((tool) => {
                    const Icon = tool.icon;
                    return (
                        <div
                            key={tool.type}
                            draggable
                            onDragStart={(e) => handleDragStart(e, tool.type)}
                            onClick={() => onAddElement(tool.type)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '10px 14px',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-primary)',
                                borderRadius: '8px',
                                cursor: 'grab',
                                transition: 'all 0.2s',
                                userSelect: 'none',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = 'var(--brand-primary)';
                                e.currentTarget.style.background = 'var(--bg-hover)';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'var(--border-primary)';
                                e.currentTarget.style.background = 'var(--bg-tertiary)';
                                e.currentTarget.style.transform = 'none';
                            }}
                        >
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '6px',
                                background: 'var(--brand-primary-light)',
                                color: 'var(--brand-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}>
                                <Icon size={18} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{tool.label}</div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div style={{ padding: '16px', borderTop: '1px solid var(--border-primary)' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Dinamik Değişken Ekle
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {variables.map((v) => (
                        <button
                            key={v.key}
                            onClick={() => onAddElement('variable', v.key)}
                            draggable
                            onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', `variable:${v.key}`);
                            }}
                            title={v.desc}
                            style={{
                                padding: '8px 10px',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-primary)',
                                borderRadius: '6px',
                                color: 'var(--text-primary)',
                                fontSize: '11px',
                                fontWeight: 600,
                                textAlign: 'left',
                                cursor: 'grab',
                                transition: 'all 0.15s',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = 'var(--brand-primary)';
                                e.currentTarget.style.background = 'var(--brand-primary-light)';
                                e.currentTarget.style.color = 'var(--brand-primary)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'var(--border-primary)';
                                e.currentTarget.style.background = 'var(--bg-tertiary)';
                                e.currentTarget.style.color = 'var(--text-primary)';
                            }}
                        >
                            {v.label}
                        </button>
                    ))}
                </div>
            </div>
            
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-primary)', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                💡 Hızlı butonlara tıklayarak doğrudan tuvale müşteri, cihaz veya ücret alanları ekleyebilirsiniz.
            </div>
        </div>
    );
}
