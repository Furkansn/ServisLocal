import { RequestType, Priority, OperationType, ProductCategory, PaymentMethod, CustomerType } from '@prisma/client';

// ─── Turkish Labels for Enums ────────────────────────────

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
    SCREEN_CHANGE: 'Ekran Değişimi',
    SCREEN_LED_CHANGE: 'Ekran + LED Değişimi',
    LED_CHANGE: 'LED Değişimi',
    LGP_REPAIR: 'LGP Tamir',
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

// ─── Default Values ──────────────────────────────────────

export const DEFAULTS = {
    CUSTOMER_TYPE: CustomerType.INDIVIDUAL,
    PRIORITY: Priority.STANDARD,
    HAS_WARRANTY: false,
    PAGE_SIZE: 20,
} as const;
