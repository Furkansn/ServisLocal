'use client';

import { useEffect } from 'react';

interface PrintToolbarProps {
    ticketNo: string;
    autoPrint?: boolean;
}

export default function PrintToolbar({ ticketNo, autoPrint }: PrintToolbarProps) {
    useEffect(() => {
        if (autoPrint) {
            const timer = setTimeout(() => {
                window.print();
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [autoPrint]);

    return (
        <>
            {/* Top Toolbar (no-print) */}
            <div className="no-print" style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                height: '60px',
                background: '#ffffff',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                zIndex: 1000
            }}>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#1f2937' }}>
                    Yazdırma Ekranı — Fiş No: {ticketNo}
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        type="button"
                        onClick={() => window.print()}
                        style={{
                            background: '#2563eb',
                            color: '#ffffff',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '6px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        🖨️ Yazdır / PDF Kaydet
                    </button>
                    <button
                        type="button"
                        onClick={() => window.close()}
                        style={{
                            background: '#ffffff',
                            color: '#4b5563',
                            border: '1px solid #d1d5db',
                            padding: '8px 16px',
                            borderRadius: '6px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        ✕ Kapat
                    </button>
                </div>
            </div>

            {/* Print Tips Info Alert (no-print) */}
            <div className="no-print" style={{
                maxWidth: '800px',
                margin: '70px auto 10px auto',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                padding: '12px 16px',
                borderRadius: '8px',
                color: '#1e40af',
                fontSize: '13px',
                lineHeight: '1.5'
            }}>
                💡 <b>İpucu:</b> Telefonunuza veya bilgisayarınıza PDF olarak kaydetmek için <b>"Yazdır / PDF Kaydet"</b> butonuna tıklayın, açılan pencerede hedef yazıcıyı <b>"PDF Olarak Kaydet"</b> olarak seçin. İndirdiğiniz PDF'i kolayca WhatsApp üzerinden müşterilerinize gönderebilirsiniz.
            </div>
        </>
    );
}
