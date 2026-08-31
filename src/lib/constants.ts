import { RequestType, Priority, OperationType, ProductCategory, PaymentMethod, CustomerType } from '@prisma/client';

// ─── Turkish Labels for Enums ────────────────────────────

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
    SCREEN_CHANGE: 'Ekran Değişimi',
    SCREEN_LED_CHANGE: 'Ekran + LED Değişimi',
    LED_CHANGE: 'LED Değişimi',
    LED_LGP_CHANGE: 'Led ve LGP Değişimi',
    LGP_REPAIR: 'LGP Değişimi',
    BOARD_REPAIR: 'Kart Tamiri',
    OTHER: 'Diğer',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
    STANDARD: 'Standart',
    PRIORITY: 'Öncelikli',
    URGENT: 'Acil',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
    STANDARD: '#6B7280',
    PRIORITY: '#F59E0B',
    URGENT: '#EF4444',
};

export const OPERATION_TYPE_LABELS: Record<OperationType, string> = {
    SCREEN_CHANGE: 'Ekran Değişimi',
    LED_CHANGE: 'LED Değişimi',
    LGP_CHANGE: 'LGP Değişimi',
    BOARD_REPAIR: 'Kart Tamiri',
    OTHER: 'Diğer',
};

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
    ACCESSORY: 'Aksesuar',
    SCREEN: 'Ekran',
    LED: 'LED',
    LGP: 'LGP',
    OTHER: 'Diğer',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
    CASH: 'Nakit',
    BANK_TRANSFER: 'Havale',
    CREDIT_CARD: 'Kredi Kartı',
};

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
    INDIVIDUAL: 'Şahıs',
    REPAIRER: 'Tamirci',
};

export const SERVICE_RECORD_TYPE_LABELS: Record<'PICKUP' | 'DELIVERY', string> = {
    PICKUP: 'Alınacak',
    DELIVERY: 'Verilecek',
};

// ─── Ticket Number Format ────────────────────────────────

export function formatTicketNo(counter: number): string {
    return `SP-${String(counter).padStart(6, '0')}`;
}

// ─── Currency Format ─────────────────────────────────────

export function formatCurrency(amount: number | string): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 2,
    }).format(num);
}

// ─── Date Format ─────────────────────────────────────────

export function formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'Europe/Istanbul',
    }).format(d);
}

export function formatDateTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Istanbul',
    }).format(d);
}

export function getLocalDateString(date?: Date | string): string {
    const d = date ? (typeof date === 'string' ? new Date(date) : date) : new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ─── Phone Number Format & Validation ───────────────────

export function formatPhoneNumber(val: string): string {
    if (!val) return '0';
    let digits = val.replace(/\D/g, '');

    // If starts with 90 and has extra digits, strip leading 9
    if (digits.startsWith('90') && digits.length >= 11) {
        digits = '0' + digits.slice(2);
    }

    // Ensure it starts with 0
    if (!digits.startsWith('0')) {
        digits = '0' + digits;
    }

    // Cap at 11 digits (0XXX XXX XX XX)
    digits = digits.slice(0, 11);

    // Format: 0XXX XXX XX XX
    let formatted = digits.slice(0, 4);
    if (digits.length > 4) {
        formatted += ' ' + digits.slice(4, 7);
    }
    if (digits.length > 7) {
        formatted += ' ' + digits.slice(7, 9);
    }
    if (digits.length > 9) {
        formatted += ' ' + digits.slice(9, 11);
    }

    return formatted;
}

export function isPhoneComplete(val: string): boolean {
    if (!val) return false;
    const digits = val.replace(/\D/g, '');
    return digits.length === 11 && digits.startsWith('0');
}

// ─── Default Values ──────────────────────────────────────

export const DEFAULTS = {
    CUSTOMER_TYPE: CustomerType.INDIVIDUAL,
    PRIORITY: Priority.STANDARD,
    HAS_WARRANTY: false,
    PAGE_SIZE: 20,
} as const;
