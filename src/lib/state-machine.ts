import { TicketStatus } from '@prisma/client';

// ─── State Machine: Valid Status Transitions ──────────────

const VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
    YENI_KAYIT: [
        TicketStatus.SERVIS_ISTENDI,
        TicketStatus.TESLIM_ALINDI,
        TicketStatus.ERTELENDI,
        TicketStatus.ATOLYEYE_ALINDI,
        TicketStatus.TEKNISYENE_VERILDI,
        TicketStatus.TEST_EDILIYOR,
        TicketStatus.PARCA_BEKLIYOR,
        TicketStatus.TAMIR_TAMAMLANDI,
        TicketStatus.TESLIMAT_SERVIS_ISTENDI,
        TicketStatus.TESLIM_EDILDI,
        TicketStatus.ODEME_BEKLIYOR,
        TicketStatus.IADE,
        TicketStatus.TAMAMLANDI,
        TicketStatus.IPTAL,
    ],
    SERVIS_ISTENDI: [
        TicketStatus.TESLIM_ALINDI,
        TicketStatus.ERTELENDI,
        TicketStatus.IPTAL,
    ],
    ERTELENDI: [
        TicketStatus.SERVIS_ISTENDI,
    ],
    TESLIM_ALINDI: [
        TicketStatus.ATOLYEYE_ALINDI,
    ],
    ATOLYEYE_ALINDI: [
        TicketStatus.TEKNISYENE_VERILDI,
    ],
    TEKNISYENE_VERILDI: [
        TicketStatus.TEST_EDILIYOR,
        TicketStatus.PARCA_BEKLIYOR,
        TicketStatus.TAMIR_TAMAMLANDI,
    ],
    TEST_EDILIYOR: [
        TicketStatus.TAMIR_TAMAMLANDI,
        TicketStatus.PARCA_BEKLIYOR,
    ],
    PARCA_BEKLIYOR: [
        TicketStatus.TEKNISYENE_VERILDI,
    ],
    TAMIR_TAMAMLANDI: [
        TicketStatus.TESLIMAT_SERVIS_ISTENDI,
        TicketStatus.ODEME_BEKLIYOR,
        TicketStatus.IADE,
    ],
    TESLIMAT_SERVIS_ISTENDI: [
        TicketStatus.TESLIM_EDILDI,
    ],
    TESLIM_EDILDI: [
        TicketStatus.ODEME_BEKLIYOR,
    ],
    ODEME_BEKLIYOR: [
        TicketStatus.TAMAMLANDI,
    ],
    IADE: [],
    TAMAMLANDI: [],
    IPTAL: [],
};

/**
 * Check if a status transition is valid
 */
export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
    if (isReadOnly(from)) return false;
    return true; // Bütün aşamalar liste halinde açılsın operatör istediği şeye seçsin
}

/**
 * Get all valid next statuses from current status
 */
export function getNextStatuses(current: TicketStatus): TicketStatus[] {
    if (isReadOnly(current)) return [];
    return Object.values(TicketStatus);
}

/**
 * Check if a status is a final (terminal) status
 */
export function isFinalStatus(status: TicketStatus): boolean {
    return ([TicketStatus.TAMAMLANDI, TicketStatus.IPTAL] as TicketStatus[]).includes(status);
}

/**
 * Check if a status is read-only (cancelled)
 */
export function isReadOnly(status: TicketStatus): boolean {
    return status === TicketStatus.IPTAL;
}

/**
 * Turkish labels for statuses
 */
export const STATUS_LABELS: Record<TicketStatus, string> = {
    YENI_KAYIT: 'Bir Atama Yapın',
    SERVIS_ISTENDI: 'Servis İstendi',
    TESLIM_ALINDI: 'Teslim Alındı',
    ERTELENDI: 'Ertelendi',
    ATOLYEYE_ALINDI: 'Atölyeye Alındı',
    TEKNISYENE_VERILDI: 'Teknisyene Verildi',
    TEST_EDILIYOR: 'Test Ediliyor',
    PARCA_BEKLIYOR: 'Parça Bekliyor',
    TAMIR_TAMAMLANDI: 'Teslimat Bekliyor',
    TESLIMAT_SERVIS_ISTENDI: 'Teslimat Servis İstendi',
    TESLIM_EDILDI: 'Teslim Edildi',
    ODEME_BEKLIYOR: 'Ödeme Bekliyor',
    IADE: 'İade',
    TAMAMLANDI: 'Tamamlandı',
    IPTAL: 'İptal',
};

/**
 * Status colors for UI badges
 */
export const STATUS_COLORS: Record<TicketStatus, string> = {
    YENI_KAYIT: '#9CA3AF',         // gray-400
    SERVIS_ISTENDI: '#3B82F6',     // blue
    TESLIM_ALINDI: '#6366F1',      // indigo
    ERTELENDI: '#F59E0B',          // amber
    ATOLYEYE_ALINDI: '#8B5CF6',   // violet
    TEKNISYENE_VERILDI: '#06B6D4', // cyan
    TEST_EDILIYOR: '#14B8A6',      // teal
    PARCA_BEKLIYOR: '#F97316',     // orange
    TAMIR_TAMAMLANDI: '#22C55E',   // green
    TESLIMAT_SERVIS_ISTENDI: '#3B82F6', // blue
    TESLIM_EDILDI: '#10B981',      // emerald
    ODEME_BEKLIYOR: '#EAB308',     // yellow
    IADE: '#EF4444',               // red
    TAMAMLANDI: '#059669',         // dark green
    IPTAL: '#6B7280',              // gray
};
