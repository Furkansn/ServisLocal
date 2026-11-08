import React from 'react';
import { formatCurrency, formatDate, REQUEST_TYPE_LABELS, CUSTOMER_TYPE_LABELS } from '@/lib/constants';
import { STATUS_LABELS } from '@/lib/state-machine';

interface PrintableReceiptProps {
    ticket: any;
}

export const PrintableReceipt: React.FC<PrintableReceiptProps> = ({ ticket }) => {
    if (!ticket) return null;

    const customerName = ticket.customer?.name || ticket.repairer?.name || '-';
    const customerPhone = ticket.customer?.phone || ticket.repairer?.phone || '-';
    const customerAddress = ticket.customer?.address || ticket.repairer?.address || '';
    const customerCity = ticket.customer?.city || ticket.repairer?.city || '';
    const customerDistrict = ticket.customer?.district || ticket.repairer?.district || '';
    const fullAddress = [customerAddress, customerDistrict, customerCity].filter(Boolean).join(' ');
    const creationDate = formatDate(ticket.createdAt);
    const pickupRecord = ticket.serviceRecords?.find((sr: any) => sr.type === 'PICKUP');
    const pickupDate = pickupRecord ? formatDate(pickupRecord.scheduledDate) : formatDate(ticket.createdAt);

    let fallbackItems: { name: string; price: number; quantity: number }[] = [];
    const rawItems = ticket.repairItems;
    let parsedItems: any[] = [];
    if (rawItems) {
        if (typeof rawItems === 'string') {
            try {
                parsedItems = JSON.parse(rawItems);
            } catch {
                parsedItems = [];
            }
        } else if (Array.isArray(rawItems)) {
            parsedItems = rawItems;
        }
    }

    if (parsedItems.length > 0) {
        parsedItems.forEach((item) => {
            fallbackItems.push({
                name: REQUEST_TYPE_LABELS[item.type as keyof typeof REQUEST_TYPE_LABELS] || item.type || 'Tamir Ücreti',
                price: Number(item.price),
                quantity: 1,
            });
        });
    } else {
        fallbackItems.push({
            name: REQUEST_TYPE_LABELS[ticket.requestType as keyof typeof REQUEST_TYPE_LABELS] || 'Tamir Ücreti',
            price: Number(ticket.repairPrice || 0),
            quantity: 1,
        });
    }

    if (ticket.accessories && ticket.accessories.length > 0) {
        ticket.accessories.forEach((acc: any) => {
            fallbackItems.push({
                name: acc.product?.name || 'Aksesuar',
                price: Number(acc.unitPrice),
                quantity: acc.quantity,
            });
        });
    }

    const subtotal = fallbackItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const grandTotal = Number(ticket.totalAmount || 0);

    return (
        <div
            style={{
                width: '794px',
                minHeight: '1123px',
                background: '#ffffff',
                margin: '0 auto',
                padding: '20mm 15mm',
                boxSizing: 'border-box',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                color: '#1f2937',
            }}
        >
            {/* Top Section: Header & Metadata */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                    {/* Left Side: Logo & Address */}
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <img src="/logo.png" alt="Logo" width={70} height={70} style={{ objectFit: 'contain' }} />
                        <div>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: '#1f2937', marginBottom: '4px' }}>
                                Zero Elektronik Tv Ekran Değişim ve
                            </div>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: '#1f2937', marginBottom: '8px' }}>
                                Tamir Servisi
                            </div>
                            <div style={{ fontSize: '11px', color: '#4b5563', lineHeight: '1.4' }}>
                                Turgut Reis mah. Armutlu Sok.<br />
                                Sultanbeyli - İstanbul<br />
                                zero@ledtvpaneli.com<br />
                                Telefon: 05347634654
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Status Badge & System Info */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right' }}>
                        <div
                            style={{
                                background: '#00B0FF',
                                color: '#ffffff',
                                fontSize: '13px',
                                fontWeight: 800,
                                padding: '6px 20px',
                                borderRadius: '4px',
                                textTransform: 'uppercase',
                                marginBottom: '20px',
                                letterSpacing: '0.5px',
                            }}
                        >
                            {STATUS_LABELS[ticket.status as keyof typeof STATUS_LABELS] || 'Kabul Edildi'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#374151', lineHeight: '1.6' }}>
                            <div><b>Fiş No :</b> <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 600 }}>{ticket.ticketNo}</span></div>
                            <div><b>Fiş Oluşturulma Tarihi :</b> {creationDate}</div>
                            <div><b>Cihaz Teslim Alma Tarihi :</b> {pickupDate}</div>
                        </div>
                    </div>
                </div>

                <div style={{ borderBottom: '1px solid #e5e7eb', marginBottom: '20px' }}></div>

                {/* Middle Section: Form Title & Customer info */}
                <div style={{ marginBottom: '25px' }}>
                    <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#111827', margin: '0 0 12px 0' }}>
                        {ticket.brand?.name} Tv {REQUEST_TYPE_LABELS[ticket.requestType as keyof typeof REQUEST_TYPE_LABELS] || 'Cihaz'} Tamir Teslim Formu
                    </h2>
                    <div style={{ fontSize: '13px', color: '#111827', fontWeight: 700, lineHeight: '1.6' }}>
                        <div>{customerName}</div>
                        <div style={{ fontWeight: 500 }}>{customerPhone}</div>
                        <div style={{ fontWeight: 400, color: '#4b5563', marginTop: '2px', maxWidth: '500px' }}>
                            {fullAddress}
                        </div>
                    </div>

                    {/* Cihaz Hasar Durumu (Varsa) */}
                    {ticket.deviceCondition && (
                        <div
                            style={{
                                marginTop: '12px',
                                padding: '8px 12px',
                                background: '#fef3c7',
                                border: '1px solid #fde68a',
                                borderRadius: '6px',
                                fontSize: '12px',
                                color: '#92400e',
                                lineHeight: '1.4',
                            }}
                        >
                            <span style={{ fontWeight: 800 }}>🔍 Cihaz Hasar / Teslim Durumu: </span>
                            <span>{ticket.deviceCondition}</span>
                        </div>
                    )}
                </div>

                {/* Services and Accessories Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px', fontSize: '13px' }}>
                    <thead>
                        <tr style={{ background: '#EFF6FF', borderBottom: '1px solid #bfdbfe' }}>
                            <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 700, color: '#1e40af', width: '50%' }}>Ürün Veya Hizmet</th>
                            <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700, color: '#1e40af', width: '16%' }}>Fiyat</th>
                            <th style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 700, color: '#1e40af', width: '14%' }}>Adet</th>
                            <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700, color: '#1e40af', width: '20%' }}>Satır Toplamı</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td colSpan={4} style={{ padding: '12px 12px 6px 12px', fontWeight: 800, color: '#111827', fontSize: '14px' }}>
                                {ticket.model}
                            </td>
                        </tr>

                        {fallbackItems.map((item, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '8px 12px', color: '#374151' }}>{item.name}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#374151' }}>
                                    {ticket.currency === 'USD' ? `$ ${item.price.toLocaleString('tr-TR')}` : formatCurrency(item.price)}
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'center', color: '#374151' }}>{item.quantity}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#111827' }}>
                                    {ticket.currency === 'USD' ? `$ ${(item.price * item.quantity).toLocaleString('tr-TR')}` : formatCurrency(item.price * item.quantity)}
                                </td>
                            </tr>
                        ))}

                        <tr>
                            <td colSpan={2}></td>
                            <td style={{ textAlign: 'right', padding: '12px 12px 8px 12px', fontWeight: 600, color: '#4b5563' }}>Ara Toplam</td>
                            <td style={{ textAlign: 'right', padding: '12px 12px 8px 12px', fontWeight: 600, color: '#374151' }}>
                                {ticket.currency === 'USD' ? `$ ${subtotal.toLocaleString('tr-TR')}` : formatCurrency(subtotal)}
                            </td>
                        </tr>
                        <tr style={{ background: '#EFF6FF' }}>
                            <td colSpan={2}></td>
                            <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 800, color: '#1e40af' }}>Toplam Fiyat</td>
                            <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 800, color: '#1e40af', fontSize: '14px' }}>
                                {ticket.currency === 'USD' ? `$ ${grandTotal.toLocaleString('tr-TR')}` : formatCurrency(grandTotal)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Bottom Section: Footer notes & Signatures */}
            <div>
                {/* Payment Info & Legal Terms */}
                <div style={{ marginBottom: '30px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>
                        Ödeme teslimatta nakit olarak alınır.
                    </div>

                    <div style={{ fontSize: '11px', color: '#374151', lineHeight: '1.6' }}>
                        <div style={{ fontWeight: 800, color: '#111827', marginBottom: '4px' }}>Yasal Şartlar</div>
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '3px' }}>
                            <span>-</span>
                            <span>Ekran değişim işlemi ORIGINAL yedek parçalar kullanılarak yapılır ve değişen parçalar için 12 Ay garanti verilir.</span>
                        </div>
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '3px' }}>
                            <span>-</span>
                            <span>Onarım işlemi stoklu ürünler için 4-5 iş günüdür.</span>
                        </div>
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '3px' }}>
                            <span>-</span>
                            <span>Müşteri tarafından belirtilen arıza dışında bir arıza tespit edilirse, ortaya çıkacak maliyet müşteriye yansıtılır.</span>
                        </div>
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '3px' }}>
                            <span>-</span>
                            <span><b>Ödeme Kredi kartı veya EFT olursa hizmet bedeli +KDV olarak ödeme alınır.</b></span>
                        </div>
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '3px' }}>
                            <span>-</span>
                            <span>Eğer verilen fiyat kabul edilmez veya her hangi bir işlem yapılmaz ise <b>1.000₺ servis hizmet ücreti alınır.</b></span>
                        </div>
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '3px' }}>
                            <span>-</span>
                            <span>Bu belge garanti servis formudur. Burada belirtilen ücret KDV hariç nakit indirimli ücretidir.</span>
                        </div>
                    </div>

                    <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '12px', lineHeight: '1.4' }}>
                        Zero Elektronik - Tv Ekran Değişim Servisi<br />
                        05347634654
                    </div>
                </div>

                {/* Signatures */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '20px' }}>
                    <div style={{ textAlign: 'center', width: '200px', fontSize: '13px', fontWeight: 700, color: '#374151' }}>
                        <div style={{ marginBottom: '50px' }}>Teslim Eden</div>
                        <div style={{ borderTop: '1px dashed #d1d5db', width: '100%' }}></div>
                    </div>
                    <div style={{ textAlign: 'center', width: '200px', fontSize: '13px', fontWeight: 700, color: '#374151' }}>
                        <div style={{ marginBottom: '50px' }}>Teslim Alan</div>
                        <div style={{ borderTop: '1px dashed #d1d5db', width: '100%' }}></div>
                    </div>
                </div>

                {/* Logo at the very bottom right */}
                <div style={{ position: 'absolute', bottom: '10mm', right: '10mm' }}>
                    <img src="/logo.png" alt="Logo" width={42} height={42} style={{ objectFit: 'contain' }} />
                </div>
            </div>
        </div>
    );
};

