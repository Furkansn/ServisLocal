import { z } from 'zod';

// ─── Customer Validations ────────────────────────────────

export const customerSchema = z.object({
    name: z.string().min(2, 'Ad Soyad en az 2 karakter olmalı'),
    phone: z.string().min(10, 'Geçerli bir telefon numarası girin'),
    taxId: z.string().optional(),
    address: z.string().optional(),
    city: z.string().min(1, 'İl seçiniz'),
    district: z.string().min(1, 'İlçe seçiniz'),
});

// ─── Repairer Validations ────────────────────────────────

export const repairerSchema = z.object({
    name: z.string().min(2, 'Ad Soyad en az 2 karakter olmalı'),
    phone: z.string().min(10, 'Geçerli bir telefon numarası girin'),
    taxId: z.string().min(1, 'VKN zorunludur'),
    address: z.string().optional(),
    city: z.string().min(1, 'İl seçiniz'),
    district: z.string().min(1, 'İlçe seçiniz'),
});

// ─── Ticket Validations ──────────────────────────────────

export const createTicketSchema = z.object({
    requestType: z.enum([
        'SCREEN_CHANGE', 'SCREEN_LED_CHANGE', 'LED_CHANGE',
        'LGP_REPAIR', 'BOARD_REPAIR', 'OTHER'
    ]),
    priority: z.enum(['STANDARD', 'PRIORITY', 'URGENT']).default('STANDARD'),
    customerType: z.enum(['INDIVIDUAL', 'REPAIRER']),
    customerId: z.string().optional(),
    repairerId: z.string().optional(),
    brandId: z.string().min(1, 'Marka seçiniz'),
    model: z.string().min(1, 'Model zorunludur'),
    serialNo: z.string().optional(),
    hasWarranty: z.boolean().default(false),
    notes: z.string().optional(),
    // SRV fields
    serviceDate: z.string().optional(),
    servicePersonnelId: z.string().optional(),
    repairPrice: z.number().min(0, 'Tutar 0 veya üzeri olmalı').default(0),
}).refine(
    (data) => {
        if (data.customerType === 'INDIVIDUAL') return !!data.customerId;
        if (data.customerType === 'REPAIRER') return !!data.repairerId;
        return true;
    },
    { message: 'Müşteri veya tamirci seçiniz', path: ['customerId'] }
);

// ─── Payment Validations ─────────────────────────────────

export const paymentSchema = z.object({
    ticketId: z.string().min(1),
    method: z.enum(['CASH', 'BANK_TRANSFER', 'CREDIT_CARD']),
    amount: z.number().positive('Tutar 0\'dan büyük olmalı'),
    notes: z.string().optional(),
});

// ─── Product Validations ─────────────────────────────────

export const productSchema = z.object({
    name: z.string().min(1, 'Ürün adı zorunludur'),
    sku: z.string().optional(),
    category: z.enum(['ACCESSORY', 'SCREEN', 'LED', 'LGP']),
    price: z.number().min(0, 'Fiyat 0 veya üzeri olmalı'),
    cost: z.number().optional(),
    stock: z.number().int().min(0).default(0),
});

// ─── Personnel Validations ───────────────────────────────

export const personnelSchema = z.object({
    name: z.string().min(2, 'Ad Soyad en az 2 karakter olmalı'),
    email: z.string().email('Geçerli bir email girin'),
    password: z.string().min(6, 'Şifre en az 6 karakter olmalı'),
    phone: z.string().optional(),
    roles: z.array(z.enum(['OPERATOR', 'SERVICE_STAFF', 'TECHNICIAN'])).min(1, 'En az bir rol seçiniz'),
});

// ─── Brand Validations ───────────────────────────────────

export const brandSchema = z.object({
    name: z.string().min(1, 'Marka adı zorunludur'),
});

// ─── Service Record Validations ──────────────────────────

export const serviceRecordSchema = z.object({
    ticketId: z.string().min(1),
    type: z.enum(['PICKUP', 'DELIVERY']),
    scheduledDate: z.string().min(1, 'Tarih seçiniz'),
    assignedPersonnelId: z.string().optional(),
});

// ─── Operation Validations ───────────────────────────────

export const operationSchema = z.object({
    ticketId: z.string().min(1),
    operationType: z.enum(['SCREEN_CHANGE', 'LED_CHANGE', 'LGP_CHANGE', 'BOARD_REPAIR', 'OTHER']),
    removedPart: z.string().optional(),
    installedProductId: z.string().optional(),
    notes: z.string().optional(),
});
