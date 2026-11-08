import { toPng } from 'html-to-image';

export function formatWhatsAppPhone(phone?: string): string {
    if (!phone) return '';
    let digits = phone.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('0')) {
        digits = '90' + digits.slice(1);
    } else if (!digits.startsWith('90') && digits.length === 10) {
        digits = '90' + digits;
    }
    return digits;
}

export function generateWhatsAppMessage(ticket: any): string {
    const customerName = ticket?.customer?.name || ticket?.repairer?.name || 'Değerli Müşterimiz';
    const brand = ticket?.brand?.name || '';
    const model = ticket?.model || '';
    const device = [brand, model].filter(Boolean).join(' ');
    const ticketNo = ticket?.ticketNo || '';
    const totalAmount = ticket?.currency === 'USD'
        ? `$ ${Number(ticket?.totalAmount || 0).toLocaleString('tr-TR')}`
        : `${Number(ticket?.totalAmount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`;

    let msg = `*ZERO ELEKTRONİK TV TAMİR SERVİSİ*\n`;
    msg += `📄 *Cihaz Servis & Teslim Fişi*\n\n`;
    msg += `*Sayın:* ${customerName}\n`;
    msg += `*Fiş No:* ${ticketNo}\n`;
    if (device) msg += `*Cihaz:* ${device}\n`;
    msg += `*Toplam Tutar:* ${totalAmount}\n`;
    if (ticket?.deviceCondition) {
        msg += `*Cihaz Durumu / Hasar:* ${ticket.deviceCondition}\n`;
    }
    msg += `\nServis fişiniz ekte yer almaktadır. İyi günler dileriz.`;
    return msg;
}

/**
 * Shares the rendered receipt element directly via mobile Web Share API as an Image file (PNG).
 * If Web Share API with files is not supported (e.g. desktop browser), falls back to opening WhatsApp Web/App with text.
 */
export async function shareReceiptViaWhatsApp({
    receiptElement,
    ticket,
}: {
    receiptElement: HTMLElement;
    ticket: any;
}): Promise<{ success: boolean; method: 'web-share' | 'wa-link' | 'fallback'; error?: string }> {
    try {
        const phone = formatWhatsAppPhone(ticket?.customer?.phone || ticket?.repairer?.phone);
        const textMessage = generateWhatsAppMessage(ticket);
        const filename = `Servis-Fisi-${ticket?.ticketNo || 'zero'}.png`;

        // 1. Generate PNG Blob from DOM
        const dataUrl = await toPng(receiptElement, {
            quality: 0.95,
            pixelRatio: 2,
            backgroundColor: '#ffffff',
            cacheBust: true,
        });

        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], filename, { type: 'image/png' });

        // 2. Check if Web Share API with files is supported (Mobile Safari, Chrome on Android, etc.)
        if (
            typeof navigator !== 'undefined' &&
            navigator.share &&
            navigator.canShare &&
            navigator.canShare({ files: [file] })
        ) {
            await navigator.share({
                title: `Servis Fişi - ${ticket?.ticketNo}`,
                text: textMessage,
                files: [file],
            });
            return { success: true, method: 'web-share' };
        }

        // 3. Fallback for Desktop: Trigger download of image + open WhatsApp chat
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        const waUrl = phone
            ? `https://wa.me/${phone}?text=${encodeURIComponent(textMessage)}`
            : `https://wa.me/?text=${encodeURIComponent(textMessage)}`;
        
        window.open(waUrl, '_blank');
        return { success: true, method: 'wa-link' };
    } catch (err: any) {
        // User cancelled share dialog or error occurred
        if (err?.name === 'AbortError') {
            return { success: false, method: 'web-share', error: 'Paylaşım iptal edildi.' };
        }
        console.error('Receipt sharing error:', err);
        return { success: false, method: 'fallback', error: err.message || 'Fiş paylaşılamadı.' };
    }
}

