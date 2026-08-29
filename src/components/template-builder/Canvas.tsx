'use client';

import React, { useRef, useState } from 'react';

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
    borderWidth?: number;
    borderColor?: string;
    borderStyle?: 'solid' | 'dashed' | 'dotted' | 'double' | 'groove' | 'ridge' | 'none';
    borderRadius?: number;
    shapeType?: 'rect' | 'circle' | 'triangle';
    headerBackgroundColor?: string;
    headerColor?: string;
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

interface CanvasProps {
    elements: TemplateElement[];
    selectedElementId: string | null;
    canvasType: 'a4' | 'roll';
    rollWidth?: number;
    rollHeight?: number;
    zoom: number;
    onSelectElement: (id: string | null) => void;
    onUpdateElement: (id: string, updates: Partial<TemplateElement>) => void;
    onAddElementAt: (type: string, x: number, y: number, variableKey?: string) => void;
}

const PREVIEW_DATA: Record<string, string> = {
    ticketNo: 'SP-000123',
    customerName: 'Nihal Göy',
    customerPhone: '05054315045',
    customerAddress: 'Atatürk Mah. Karanfil Sok. No:5 Kadıköy / İstanbul',
    customerType: 'Şahıs',
    requestType: 'Ekran Değişimi',
    creationDate: '04.07.2026',
    entryDate: '04.07.2026',
    pickupDate: '05.07.2026',
    brand: 'Samsung',
    model: '50AU7000',
    totalAmount: '₺12.000,00',
    status: 'Kabul Edildi',
};

const MOCK_REPAIR_ITEMS = [
    { name: 'Ekran Değişimi', price: '₺12.000,00', qty: '1', total: '₺12.000,00' },
    { name: 'Kumanda Satışı', price: '₺350,00', qty: '1', total: '₺350,00' },
];

export default function Canvas({
    elements,
    selectedElementId,
    canvasType,
    rollWidth = 320,
    rollHeight = 600,
    zoom,
    onSelectElement,
    onUpdateElement,
    onAddElementAt,
}: CanvasProps) {
    const canvasRef = useRef<HTMLDivElement>(null);
    const [dragStart, setDragStart] = useState<{ x: number; y: number; elX: number; elY: number } | null>(null);
    const [resizeStart, setResizeStart] = useState<{
        x: number;
        y: number;
        elX: number;
        elY: number;
        elW: number;
        elH: number;
        direction: string;
    } | null>(null);

    // Canvas sizes
    const canvasW = canvasType === 'a4' ? 794 : rollWidth;
    const canvasH = canvasType === 'a4' ? 1123 : rollHeight;

    const canvasStyles = {
        width: `${canvasW}px`,
        minHeight: `${canvasH}px`,
        background: '#ffffff',
        position: 'relative' as const,
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        flexShrink: 0
    };

    // HTML5 Drag-and-drop handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const data = e.dataTransfer.getData('text/plain');
        if (!data || !canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / zoom;
        const y = (e.clientY - rect.top) / zoom;
        
        if (data.startsWith('variable:')) {
            const varKey = data.split(':')[1];
            onAddElementAt('variable', x, y, varKey);
        } else {
            onAddElementAt(data, x, y);
        }
    };

    // Pointer-based Drag-and-Resize handlers
    const handleMouseDown = (e: React.MouseEvent, element: TemplateElement) => {
        e.stopPropagation();
        onSelectElement(element.id);

        setDragStart({
            x: e.clientX,
            y: e.clientY,
            elX: element.x,
            elY: element.y,
        });

        // Register window-level mouse move / up events for smooth drag
        const handleMouseMove = (moveEvent: MouseEvent) => {
            if (!canvasRef.current) return;
            const deltaX = (moveEvent.clientX - e.clientX) / zoom;
            const deltaY = (moveEvent.clientY - e.clientY) / zoom;

            let newX = element.x + deltaX;
            let newY = element.y + deltaY;

            newX = Math.max(0, Math.min(newX, canvasW - element.width));
            newY = Math.max(0, Math.min(newY, canvasH - element.height));

            onUpdateElement(element.id, { x: newX, y: newY });
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            setDragStart(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const handleResizeMouseDown = (e: React.MouseEvent, element: TemplateElement, direction: string) => {
        e.stopPropagation();
        e.preventDefault();

        setResizeStart({
            x: e.clientX,
            y: e.clientY,
            elX: element.x,
            elY: element.y,
            elW: element.width,
            elH: element.height,
            direction,
        });

        const handleMouseMove = (moveEvent: MouseEvent) => {
            if (!canvasRef.current) return;
            const deltaX = (moveEvent.clientX - e.clientX) / zoom;
            const deltaY = (moveEvent.clientY - e.clientY) / zoom;

            let newW = element.width;
            let newH = element.height;
            let newX = element.x;
            let newY = element.y;

            if (direction.includes('e')) {
                newW = Math.max(20, element.width + deltaX);
            }
            if (direction.includes('s')) {
                newH = Math.max(10, element.height + deltaY);
            }
            if (direction.includes('w')) {
                const possibleW = element.width - deltaX;
                if (possibleW > 20) {
                    newW = possibleW;
                    newX = element.x + deltaX;
                }
            }
            if (direction.includes('n')) {
                const possibleH = element.height - deltaY;
                if (possibleH > 10) {
                    newH = possibleH;
                    newY = element.y + deltaY;
                }
            }

            onUpdateElement(element.id, { x: newX, y: newY, width: newW, height: newH });
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            setResizeStart(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    // Text parser (HTML & Markdown aware)
    const renderTextContentHtml = (content?: string) => {
        let result = content || '';
        Object.entries(PREVIEW_DATA).forEach(([key, val]) => {
            result = result.replaceAll(`{{${key}}}`, val);
        });

        // Convert Markdown **bold** to <b>bold</b> and *italic* to <i>italic</i>
        result = result.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
        result = result.replace(/\*(.*?)\*/g, '<i>$1</i>');

        return result;
    };

    const scaleStyles = {
        transform: `scale(${zoom})`,
        transformOrigin: 'top center',
        transition: 'transform 0.1s ease-out',
    };

    return (
        <div 
            style={{
                flex: 1,
                background: 'var(--bg-tertiary, #111827)',
                padding: '40px',
                overflow: 'auto',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start',
                position: 'relative',
                userSelect: 'none',
            }}
            onClick={() => onSelectElement(null)}
        >
            <div
                ref={canvasRef}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                style={{
                    ...canvasStyles,
                    ...scaleStyles,
                }}
            >
                {/* Rulers / Guidelines (Optional indicator for A4 margins) */}
                {canvasType === 'a4' && (
                    <div style={{
                        position: 'absolute',
                        top: '20mm',
                        bottom: '20mm',
                        left: '15mm',
                        right: '15mm',
                        border: '1px dashed rgba(37, 99, 235, 0.15)',
                        pointerEvents: 'none',
                    }} />
                )}

                {/* Elements */}
                {elements.map((el) => {
                    const isSelected = selectedElementId === el.id;
                    
                    // Element render styles
                    const renderStyles: React.CSSProperties = {
                        fontFamily: el.styles.fontFamily || 'sans-serif',
                        fontSize: `${el.styles.fontSize || 14}px`,
                        fontWeight: el.styles.fontWeight || 'normal',
                        lineHeight: el.styles.lineHeight || 1.4,
                        textAlign: el.styles.textAlign || 'left',
                        color: el.styles.color || '#000000',
                        backgroundColor: el.styles.backgroundColor || 'transparent',
                        padding: el.type === 'text' || el.type === 'variable' ? '4px' : '0px',
                        boxSizing: 'border-box',
                        width: '100%',
                        height: '100%',
                        overflow: 'hidden',
                        whiteSpace: 'pre-wrap',
                    };

                    return (
                        <div
                            key={el.id}
                            style={{
                                position: 'absolute',
                                left: `${el.x}px`,
                                top: `${el.y}px`,
                                width: `${el.width}px`,
                                height: `${el.height}px`,
                                border: isSelected 
                                    ? '1.5px solid var(--brand-primary, #2563eb)' 
                                    : '1px dashed rgba(156, 163, 175, 0.5)',
                                cursor: 'move',
                                zIndex: isSelected ? 100 : 10,
                                boxSizing: 'border-box',
                            }}
                            onMouseDown={(e) => handleMouseDown(e, el)}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Resize Handles (rendered when selected) */}
                            {isSelected && (
                                <>
                                    {/* NW */}
                                    <div 
                                        onMouseDown={(e) => handleResizeMouseDown(e, el, 'nw')}
                                        style={{ position: 'absolute', width: '8px', height: '8px', background: '#2563eb', border: '1px solid #fff', left: '-4px', top: '-4px', cursor: 'nwse-resize', zIndex: 110 }} 
                                    />
                                    {/* NE */}
                                    <div 
                                        onMouseDown={(e) => handleResizeMouseDown(e, el, 'ne')}
                                        style={{ position: 'absolute', width: '8px', height: '8px', background: '#2563eb', border: '1px solid #fff', right: '-4px', top: '-4px', cursor: 'nesw-resize', zIndex: 110 }} 
                                    />
                                    {/* SW */}
                                    <div 
                                        onMouseDown={(e) => handleResizeMouseDown(e, el, 'sw')}
                                        style={{ position: 'absolute', width: '8px', height: '8px', background: '#2563eb', border: '1px solid #fff', left: '-4px', bottom: '-4px', cursor: 'nesw-resize', zIndex: 110 }} 
                                    />
                                    {/* SE */}
                                    <div 
                                        onMouseDown={(e) => handleResizeMouseDown(e, el, 'se')}
                                        style={{ position: 'absolute', width: '8px', height: '8px', background: '#2563eb', border: '1px solid #fff', right: '-4px', bottom: '-4px', cursor: 'nwse-resize', zIndex: 110 }} 
                                    />
                                    {/* N */}
                                    <div 
                                        onMouseDown={(e) => handleResizeMouseDown(e, el, 'n')}
                                        style={{ position: 'absolute', width: '8px', height: '8px', background: '#2563eb', border: '1px solid #fff', left: 'calc(50% - 4px)', top: '-4px', cursor: 'ns-resize', zIndex: 110 }} 
                                    />
                                    {/* S */}
                                    <div 
                                        onMouseDown={(e) => handleResizeMouseDown(e, el, 's')}
                                        style={{ position: 'absolute', width: '8px', height: '8px', background: '#2563eb', border: '1px solid #fff', left: 'calc(50% - 4px)', bottom: '-4px', cursor: 'ns-resize', zIndex: 110 }} 
                                    />
                                    {/* W */}
                                    <div 
                                        onMouseDown={(e) => handleResizeMouseDown(e, el, 'w')}
                                        style={{ position: 'absolute', width: '8px', height: '8px', background: '#2563eb', border: '1px solid #fff', left: '-4px', top: 'calc(50% - 4px)', cursor: 'ew-resize', zIndex: 110 }} 
                                    />
                                    {/* E */}
                                    <div 
                                        onMouseDown={(e) => handleResizeMouseDown(e, el, 'e')}
                                        style={{ position: 'absolute', width: '8px', height: '8px', background: '#2563eb', border: '1px solid #fff', right: '-4px', top: 'calc(50% - 4px)', cursor: 'ew-resize', zIndex: 110 }} 
                                    />
                                </>
                            )}

                            {/* Render Element Types */}
                            {el.type === 'text' && (
                                <div
                                    style={renderStyles}
                                    dangerouslySetInnerHTML={{ __html: renderTextContentHtml(el.content) || 'Metin girin...' }}
                                />
                            )}

                            {el.type === 'variable' && (
                                <div
                                    style={{
                                        ...renderStyles,
                                        border: '1px dashed #3b82f6',
                                        backgroundColor: el.styles.backgroundColor && el.styles.backgroundColor !== 'transparent' ? el.styles.backgroundColor : 'rgba(59, 130, 246, 0.05)',
                                        borderRadius: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: el.styles.textAlign === 'center' ? 'center' : el.styles.textAlign === 'right' ? 'flex-end' : 'flex-start',
                                        fontWeight: 700,
                                    }}
                                    dangerouslySetInnerHTML={{ __html: renderTextContentHtml(el.content) || 'Değişken Seçilmedi' }}
                                />
                            )}

                            {el.type === 'image' && (
                                <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                                    {el.content ? (
                                        <img 
                                            src={el.content} 
                                            alt="Logo / Visual" 
                                            style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} 
                                        />
                                    ) : (
                                        <div style={{
                                            width: '100%',
                                            height: '100%',
                                            backgroundColor: '#f3f4f6',
                                            color: '#9ca3af',
                                            fontSize: '11px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            textAlign: 'center',
                                            border: '1px dashed #d1d5db',
                                        }}>
                                            Logo Seçilmedi
                                        </div>
                                    )}
                                </div>
                            )}

                            {el.type === 'divider' && (
                                <div style={{
                                    width: '100%',
                                    height: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <div style={{
                                        width: '100%',
                                        borderTop: `${el.styles.borderWidth || 2}px ${el.styles.borderStyle || 'solid'} ${el.styles.borderColor || '#000000'}`,
                                    }} />
                                </div>
                            )}

                            {el.type === 'shape' && (
                                <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
                                    {el.styles?.shapeType === 'triangle' ? (
                                        <svg
                                            width="100%"
                                            height="100%"
                                            viewBox="0 0 100 100"
                                            preserveAspectRatio="none"
                                            style={{ display: 'block' }}
                                        >
                                            <polygon
                                                points="50,5 95,95 5,95"
                                                fill={el.styles?.isTransparentFill ? 'transparent' : (el.styles?.backgroundColor || '#e5e7eb')}
                                                stroke={el.styles?.isTransparentBorder ? 'transparent' : (el.styles?.borderColor || '#000000')}
                                                strokeWidth={el.styles?.isTransparentBorder ? 0 : (el.styles?.borderWidth || 2)}
                                                strokeDasharray={
                                                    el.styles?.borderStyle === 'dashed'
                                                        ? '6,4'
                                                        : el.styles?.borderStyle === 'dotted'
                                                        ? '2,2'
                                                        : undefined
                                                }
                                                strokeLinejoin="round"
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                    ) : (
                                        <div style={{
                                            width: '100%',
                                            height: '100%',
                                            boxSizing: 'border-box',
                                            borderRadius: el.styles?.shapeType === 'circle' ? '50%' : `${el.styles?.borderRadius ?? 8}px`,
                                            backgroundColor: el.styles?.isTransparentFill ? 'transparent' : (el.styles?.backgroundColor || '#e5e7eb'),
                                            border: el.styles?.isTransparentBorder 
                                                ? 'none' 
                                                : `${el.styles?.borderWidth || 2}px ${el.styles?.borderStyle || 'solid'} ${el.styles?.borderColor || '#000000'}`,
                                        }} />
                                    )}
                                </div>
                            )}

                            {el.type === 'table' && (
                                <div style={{
                                    ...renderStyles,
                                    fontSize: `${el.styles.fontSize || 12}px`,
                                    backgroundColor: 'transparent',
                                }}>
                                    <table style={{
                                        width: '100%',
                                        borderCollapse: 'collapse',
                                    }}>
                                        <thead>
                                            <tr style={{ backgroundColor: el.styles.headerBackgroundColor || '#2461db' }}>
                                                {el.columns?.map((col) => (
                                                    <th 
                                                        key={col.id} 
                                                        style={{
                                                            border: `${el.styles.borderWidth || 1}px solid ${el.styles.borderColor || '#cccccc'}`,
                                                            padding: '6px',
                                                            textAlign: col.key === 'price' || col.key === 'total' ? 'right' : col.key === 'qty' ? 'center' : 'left',
                                                            fontWeight: 'bold',
                                                            width: `${col.width}%`,
                                                            backgroundColor: el.styles.headerBackgroundColor || '#2461db',
                                                            color: el.styles.headerColor || '#ffffff',
                                                        }}
                                                    >
                                                        {col.title}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {MOCK_REPAIR_ITEMS.map((item, idx) => (
                                                <tr key={idx} style={{ backgroundColor: el.styles.backgroundColor || '#ffffff' }}>
                                                    {el.columns?.map((col) => (
                                                        <td 
                                                            key={col.id} 
                                                            style={{
                                                                border: `${el.styles.borderWidth || 1}px solid ${el.styles.borderColor || '#cccccc'}`,
                                                                padding: '6px',
                                                                textAlign: col.key === 'price' || col.key === 'total' ? 'right' : col.key === 'qty' ? 'center' : 'left',
                                                                color: el.styles.color || '#000000',
                                                                backgroundColor: el.styles.backgroundColor || '#ffffff',
                                                            }}
                                                        >
                                                            {col.key === 'name' && item.name}
                                                            {col.key === 'price' && item.price}
                                                            {col.key === 'qty' && item.qty}
                                                            {col.key === 'total' && item.total}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
