import * as XLSX from 'xlsx';
import { REQUEST_TYPE_LABELS, OPERATION_TYPE_LABELS, PAYMENT_METHOD_LABELS, formatDate, formatDateTime } from './constants';

export interface CollectionsExportData {
    accounts: any[];
    accountSummaries: any[];
    payments: any[];
    expenses: any[];
    settlements: any[];
    transfers: any[];
    periodLabel: string;
    accountFilterLabel?: string;
}

export function exportCollectionsToExcel(data: CollectionsExportData, filenamePrefix = 'ServisPlus_Kasa_Tahsilat_Raporu') {
    const {
        accounts,
        accountSummaries,
        payments,
        expenses,
        settlements,
        transfers,
        periodLabel,
        accountFilterLabel = 'Tüm Hesaplar',
    } = data;

    const wb = XLSX.utils.book_new();

    // ─────────────────────────────────────────────────────────────
    // 1. SHEET: KASA VE HESAP BAKİYE ÖZETLERİ
    // ─────────────────────────────────────────────────────────────
    const summaryHeader = [
        'Kasa / Hesap Adı',
        'Hesap Türü',
        'Açıklama',
        'Toplam Tahsilat (TL)',
        'Giderler / Harcamalar (TL)',
        'Giren Virman (TL)',
        'Çıkan Virman (TL)',
        'Müdür Onaylı Tahsilat (TL)',
        'Onay Bekleyen Tahsilat (TL)',
        'Güncel Net Kasa Bakiyesi (TL)',
    ];

    let grandCollected = 0;
    let grandExpenses = 0;
    let grandTransfersIn = 0;
    let grandTransfersOut = 0;
    let grandApproved = 0;
    let grandPending = 0;
    let grandBalance = 0;

    const summaryRows = accountSummaries.map((s: any) => {
        const accTypeMap: Record<string, string> = {
            CASH: 'Nakit Kasa',
            BANK_TRANSFER: 'Banka / Havale',
            CREDIT_CARD: 'POS Terminali',
        };

        const totalCollected = Number(s.totalCollected || 0);
        const totalExpenses = Number(s.totalExpenses || 0);
        const totalTransfersIn = Number(s.totalTransfersIn || 0);
        const totalTransfersOut = Number(s.totalTransfersOut || 0);
        const totalApproved = Number(s.totalApproved || 0);
        const totalPending = Number(s.totalPending || 0);
        const currentBalance = Number(s.currentBalance || 0);

        grandCollected += totalCollected;
        grandExpenses += totalExpenses;
        grandTransfersIn += totalTransfersIn;
        grandTransfersOut += totalTransfersOut;
        grandApproved += totalApproved;
        grandPending += totalPending;
        grandBalance += currentBalance;

        return [
            s.account?.name || 'Hesap',
            accTypeMap[s.account?.type] || s.account?.type || '-',
            s.account?.description || '-',
            totalCollected,
            totalExpenses,
            totalTransfersIn,
            totalTransfersOut,
            totalApproved,
            totalPending,
            currentBalance,
        ];
    });

    const summaryData = [
        ['SERVİSPLUS KASA VE HESAP BAKİYE ÖZET RAPORU'],
        [`Dönem / Kapsam: ${periodLabel}`, `Hesap Filtresi: ${accountFilterLabel}`, `Rapor Alınma Tarihi: ${formatDateTime(new Date())}`],
        [],
        summaryHeader,
        ...summaryRows,
        [],
        [
            'GENEL TOPLAM',
            '',
            '',
            grandCollected,
            grandExpenses,
            grandTransfersIn,
            grandTransfersOut,
            grandApproved,
            grandPending,
            grandBalance,
        ],
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary['!cols'] = [
        { wch: 28 }, // Hesap Adı
        { wch: 18 }, // Hesap Türü
        { wch: 30 }, // Açıklama
        { wch: 22 }, // Tahsilat
        { wch: 24 }, // Gider
        { wch: 18 }, // Giren Virman
        { wch: 18 }, // Çıkan Virman
        { wch: 24 }, // Onaylı
        { wch: 24 }, // Bekleyen
        { wch: 28 }, // Net Bakiye
    ];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Kasa Özetleri');

    // ─────────────────────────────────────────────────────────────
    // 2. SHEET: TÜM İŞLEMLER (BİRLEŞİK EKSTRE / LEDGER)
    // ─────────────────────────────────────────────────────────────
    interface LedgerItem {
        date: Date;
        type: string;
        refNo: string;
        person: string;
        details: string;
        accountName: string;
        income: number;
        expense: number;
        performedBy: string;
        status: string;
    }

    const ledgerItems: LedgerItem[] = [];

    // Payments -> Income
    payments.forEach((p: any) => {
        const operationsText = p.ticket?.operations?.map((o: any) =>
            OPERATION_TYPE_LABELS[o.operationType as keyof typeof OPERATION_TYPE_LABELS] || o.operationType
        ).filter(Boolean).join(', ');

        const deviceText = [p.ticket?.brand?.name, p.ticket?.model].filter(Boolean).join(' ');
        const reqText = REQUEST_TYPE_LABELS[p.ticket?.requestType as keyof typeof REQUEST_TYPE_LABELS] || p.ticket?.requestType || '';

        ledgerItems.push({
            date: new Date(p.createdAt),
            type: 'Tahsilat (Gelir)',
            refNo: p.ticket?.ticketNo || '-',
            person: p.ticket?.customer?.name || p.ticket?.repairer?.name || '-',
            details: [reqText, deviceText, operationsText].filter(Boolean).join(' | '),
            accountName: p.account?.name || p.method,
            income: Number(p.amount),
            expense: 0,
            performedBy: p.receivedBy?.name || '-',
            status: p.method !== 'CASH' ? 'Elektronik (Onaylı)' : p.isApproved ? `Müdür Onaylı (${p.approvedBy?.name || 'Müdür'})` : 'Onay Bekliyor',
        });
    });

    // Expenses -> Expense
    expenses.forEach((e: any) => {
        ledgerItems.push({
            date: new Date(e.createdAt),
            type: 'Gider / Harcama',
            refNo: `GID-${e.id.slice(-6).toUpperCase()}`,
            person: '-',
            details: `${e.title}${e.category ? ` [${e.category}]` : ''}${e.notes ? ` - ${e.notes}` : ''}`,
            accountName: e.account?.name || '-',
            income: 0,
            expense: Number(e.amount),
            performedBy: e.createdBy?.name || '-',
            status: 'Tamamlandı',
        });
    });

    // Settlements -> Expense / Extraction
    settlements.forEach((s: any) => {
        ledgerItems.push({
            date: new Date(s.createdAt),
            type: 'Kasa Sıfırlama / Çekim',
            refNo: `SIF-${s.id.slice(-6).toUpperCase()}`,
            person: 'Servis Müdürü',
            details: `Kasa Sıfırlama / Para Teslim Alma - ${s.notes || ''}`,
            accountName: s.account?.name || '-',
            income: 0,
            expense: Number(s.amount),
            performedBy: s.performedBy?.name || '-',
            status: 'Teslim Alındı',
        });
    });

    // Transfers -> Out & In
    transfers.forEach((t: any) => {
        // Çıkan
        ledgerItems.push({
            date: new Date(t.createdAt),
            type: 'Virman (Çıkış)',
            refNo: `VIR-${t.id.slice(-6).toUpperCase()}`,
            person: `Hedef: ${t.toAccount?.name || 'Hesap'}`,
            details: `Virman Transferi: ${t.fromAccount?.name} -> ${t.toAccount?.name} (${t.notes || ''})`,
            accountName: t.fromAccount?.name || '-',
            income: 0,
            expense: Number(t.amount),
            performedBy: t.performedBy?.name || '-',
            status: 'Aktarıldı',
        });

        // Giren
        ledgerItems.push({
            date: new Date(t.createdAt),
            type: 'Virman (Giriş)',
            refNo: `VIR-${t.id.slice(-6).toUpperCase()}`,
            person: `Kaynak: ${t.fromAccount?.name || 'Hesap'}`,
            details: `Virman Transferi: ${t.fromAccount?.name} -> ${t.toAccount?.name} (${t.notes || ''})`,
            accountName: t.toAccount?.name || '-',
            income: Number(t.amount),
            expense: 0,
            performedBy: t.performedBy?.name || '-',
            status: 'Giriş Yapıldı',
        });
    });

    // Sort ledger items by date descending
    ledgerItems.sort((a, b) => b.date.getTime() - a.date.getTime());

    let totalLedgerIncome = 0;
    let totalLedgerExpense = 0;

    const ledgerRows = ledgerItems.map(item => {
        totalLedgerIncome += item.income;
        totalLedgerExpense += item.expense;
        const netChange = item.income - item.expense;

        return [
            formatDate(item.date),
            formatDateTime(item.date).split(' ')[1] || '',
            item.type,
            item.refNo,
            item.person,
            item.details,
            item.accountName,
            item.income > 0 ? item.income : 0,
            item.expense > 0 ? item.expense : 0,
            netChange,
            item.performedBy,
            item.status,
        ];
    });

    const ledgerData = [
        ['SERVİSPLUS KASA VE İŞLEM HAREKETLERİ EKSTRESİ (TÜM HAREKETLER)'],
        [`Dönem / Kapsam: ${periodLabel}`, `Hesap Filtresi: ${accountFilterLabel}`, `Toplam Hareket Adedi: ${ledgerItems.length}`],
        [],
        [
            'Tarih',
            'Saat',
            'İşlem Türü',
            'Fiş No / Referans',
            'Müşteri / Muhatap',
            'İşlem Detayı / Cihaz',
            'Kasa / Hesap',
            'Giriş (Gelir TL)',
            'Çıkış (Gider TL)',
            'Net Değişim (TL)',
            'İşlemi Yapan',
            'Durum / Onay',
        ],
        ...ledgerRows,
        [],
        [
            'TOPLAM',
            '',
            '',
            '',
            '',
            '',
            '',
            totalLedgerIncome,
            totalLedgerExpense,
            totalLedgerIncome - totalLedgerExpense,
            '',
            '',
        ],
    ];

    const wsLedger = XLSX.utils.aoa_to_sheet(ledgerData);
    wsLedger['!cols'] = [
        { wch: 13 }, // Tarih
        { wch: 9 },  // Saat
        { wch: 18 }, // İşlem Türü
        { wch: 16 }, // Fiş No
        { wch: 25 }, // Müşteri
        { wch: 38 }, // Detay
        { wch: 22 }, // Hesap
        { wch: 16 }, // Giriş
        { wch: 16 }, // Çıkış
        { wch: 16 }, // Net
        { wch: 20 }, // Yapan
        { wch: 24 }, // Onay
    ];
    XLSX.utils.book_append_sheet(wb, wsLedger, 'Tüm Hareketler (Ekstre)');

    // ─────────────────────────────────────────────────────────────
    // 3. SHEET: TAHSİLATLAR (AYRINTILI)
    // ─────────────────────────────────────────────────────────────
    let totalPaymentsAmount = 0;
    const paymentRows = payments.map((p: any) => {
        const amt = Number(p.amount);
        totalPaymentsAmount += amt;

        const operationsText = p.ticket?.operations?.map((o: any) =>
            OPERATION_TYPE_LABELS[o.operationType as keyof typeof OPERATION_TYPE_LABELS] || o.operationType
        ).filter(Boolean).join(', ');

        const d = new Date(p.createdAt);
        const reqType = REQUEST_TYPE_LABELS[p.ticket?.requestType as keyof typeof REQUEST_TYPE_LABELS] || p.ticket?.requestType || '-';
        const methodLabel = PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS] || p.method || '-';

        return [
            formatDate(d),
            formatDateTime(d).split(' ')[1] || '',
            p.ticket?.ticketNo || '-',
            p.ticket?.customer?.name || p.ticket?.repairer?.name || '-',
            p.ticket?.customer?.phone || p.ticket?.repairer?.phone || '-',
            reqType,
            p.ticket?.brand?.name || '-',
            p.ticket?.model || '-',
            p.ticket?.serialNo || '-',
            operationsText || '-',
            p.receivedBy?.name || '-',
            p.account?.name || methodLabel,
            methodLabel,
            amt,
            p.method !== 'CASH'
                ? 'Elektronik (Otomatik Onaylı)'
                : p.isApproved
                    ? 'Onaylandı'
                    : 'Müdür Onayı Bekliyor',
            p.approvedBy?.name || '-',
            p.approvedAt ? formatDateTime(p.approvedAt) : '-',
        ];
    });

    const paymentsData = [
        ['SERVİSPLUS AYRINTILI TAHSİLAT LİSTESİ'],
        [`Dönem: ${periodLabel}`, `Hesap: ${accountFilterLabel}`, `Toplam Tahsilat Sayısı: ${payments.length}`],
        [],
        [
            'Tarih',
            'Saat',
            'Fiş No',
            'Müşteri / Tamirci',
            'Telefon',
            'Talep Türü',
            'Cihaz Marka',
            'Cihaz Model',
            'Seri No',
            'Yapılan İşlemler',
            'Tahsil Eden Personel',
            'Kasa / Hesap',
            'Ödeme Yöntemi',
            'Tutar (TL)',
            'Müdür Onayı',
            'Onaylayan Kişi',
            'Onay Tarihi',
        ],
        ...paymentRows,
        [],
        [
            'TOPLAM TAHSİLAT',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            totalPaymentsAmount,
            '',
            '',
            '',
        ],
    ];

    const wsPayments = XLSX.utils.aoa_to_sheet(paymentsData);
    wsPayments['!cols'] = [
        { wch: 13 }, // Tarih
        { wch: 9 },  // Saat
        { wch: 14 }, // Fiş No
        { wch: 25 }, // Müşteri
        { wch: 16 }, // Telefon
        { wch: 22 }, // Talep Türü
        { wch: 16 }, // Marka
        { wch: 20 }, // Model
        { wch: 18 }, // Seri No
        { wch: 28 }, // İşlemler
        { wch: 20 }, // Tahsil Eden
        { wch: 24 }, // Kasa / Hesap
        { wch: 14 }, // Ödeme Yöntemi
        { wch: 16 }, // Tutar
        { wch: 24 }, // Onay
        { wch: 18 }, // Onaylayan
        { wch: 18 }, // Onay Tarihi
    ];
    XLSX.utils.book_append_sheet(wb, wsPayments, 'Tahsilatlar');

    // ─────────────────────────────────────────────────────────────
    // 4. SHEET: GİDERLER VE HARCAMALAR
    // ─────────────────────────────────────────────────────────────
    let totalExpensesAmount = 0;
    const expenseRows = expenses.map((e: any) => {
        const amt = Number(e.amount);
        totalExpensesAmount += amt;
        const d = new Date(e.createdAt);

        return [
            formatDate(d),
            formatDateTime(d).split(' ')[1] || '',
            e.title,
            e.category || 'Genel',
            e.account?.name || '-',
            amt,
            e.createdBy?.name || '-',
            e.notes || '-',
        ];
    });

    const expenseData = [
        ['SERVİSPLUS GİDER VE HARCAMA LİSTESİ'],
        [`Dönem: ${periodLabel}`, `Hesap: ${accountFilterLabel}`, `Toplam Gider Kaydı: ${expenses.length}`],
        [],
        [
            'Tarih',
            'Saat',
            'Gider Başlığı',
            'Kategori',
            'Ödenen Kasa / Hesap',
            'Tutar (TL)',
            'Kaydeden Personel',
            'Açıklama / Not',
        ],
        ...expenseRows,
        [],
        [
            'TOPLAM GİDER',
            '',
            '',
            '',
            '',
            totalExpensesAmount,
            '',
            '',
        ],
    ];

    const wsExpenses = XLSX.utils.aoa_to_sheet(expenseData);
    wsExpenses['!cols'] = [
        { wch: 13 }, // Tarih
        { wch: 9 },  // Saat
        { wch: 30 }, // Başlık
        { wch: 18 }, // Kategori
        { wch: 24 }, // Hesap
        { wch: 16 }, // Tutar
        { wch: 20 }, // Kaydeden
        { wch: 35 }, // Not
    ];
    XLSX.utils.book_append_sheet(wb, wsExpenses, 'Giderler');

    // ─────────────────────────────────────────────────────────────
    // 5. SHEET: VİRMAN VE TRANSFERLER
    // ─────────────────────────────────────────────────────────────
    let totalTransfersAmount = 0;
    const transferRows = (transfers || []).map((t: any) => {
        const amt = Number(t.amount);
        totalTransfersAmount += amt;
        const d = new Date(t.createdAt);

        return [
            formatDate(d),
            formatDateTime(d).split(' ')[1] || '',
            t.fromAccount?.name || '-',
            t.toAccount?.name || '-',
            amt,
            t.performedBy?.name || '-',
            t.notes || '-',
        ];
    });

    const transferData = [
        ['SERVİSPLUS HESAPLAR ARASI VİRMAN VE TRANSFER LİSTESİ'],
        [`Dönem: ${periodLabel}`, `Hesap: ${accountFilterLabel}`, `Toplam Virman Kaydı: ${transfers?.length || 0}`],
        [],
        [
            'Tarih',
            'Saat',
            'Kaynak Hesap (Çıkan)',
            'Hedef Hesap (Giren)',
            'Transfer Tutarı (TL)',
            'İşlemi Yapan Personel',
            'Açıklama / Not',
        ],
        ...transferRows,
        [],
        [
            'TOPLAM TRANSFER',
            '',
            '',
            '',
            totalTransfersAmount,
            '',
            '',
        ],
    ];

    const wsTransfers = XLSX.utils.aoa_to_sheet(transferData);
    wsTransfers['!cols'] = [
        { wch: 13 }, // Tarih
        { wch: 9 },  // Saat
        { wch: 25 }, // Çıkan
        { wch: 25 }, // Giren
        { wch: 20 }, // Tutar
        { wch: 22 }, // Yapan
        { wch: 35 }, // Açıklama
    ];
    XLSX.utils.book_append_sheet(wb, wsTransfers, 'Virman ve Transferler');

    // ─────────────────────────────────────────────────────────────
    // 6. SHEET: KASA SIFIRLAMALARI
    // ─────────────────────────────────────────────────────────────
    let totalSettlementsAmount = 0;
    const settlementRows = settlements.map((s: any) => {
        const amt = Number(s.amount);
        totalSettlementsAmount += amt;
        const d = new Date(s.createdAt);

        return [
            formatDate(d),
            formatDateTime(d).split(' ')[1] || '',
            s.account?.name || '-',
            amt,
            s.performedBy?.name || '-',
            s.notes || '-',
        ];
    });

    const settlementData = [
        ['SERVİSPLUS KASA SIFIRLAMA VE TESLİM ALMA KAYITLARI'],
        [`Dönem: ${periodLabel}`, `Hesap: ${accountFilterLabel}`, `Toplam Sıfırlama Kaydı: ${settlements.length}`],
        [],
        [
            'Tarih',
            'Saat',
            'Sıfırlanan Kasa / Hesap',
            'Teslim Alınan Tutar (TL)',
            'Teslim Alan (Servis Müdürü)',
            'Açıklama / Not',
        ],
        ...settlementRows,
        [],
        [
            'TOPLAM TESLİM ALINAN',
            '',
            '',
            totalSettlementsAmount,
            '',
            '',
        ],
    ];

    const wsSettlements = XLSX.utils.aoa_to_sheet(settlementData);
    wsSettlements['!cols'] = [
        { wch: 13 }, // Tarih
        { wch: 9 },  // Saat
        { wch: 25 }, // Sıfırlanan Kasa
        { wch: 22 }, // Tutar
        { wch: 24 }, // Teslim Alan
        { wch: 35 }, // Açıklama
    ];
    XLSX.utils.book_append_sheet(wb, wsSettlements, 'Kasa Sıfırlamaları');

    // ─────────────────────────────────────────────────────────────
    // Trigger File Download
    // ─────────────────────────────────────────────────────────────
    const cleanPeriod = periodLabel.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\u00C0-\u017F]/g, '');
    const nowStr = formatDate(new Date()).replace(/\./g, '-');
    const finalFilename = `${filenamePrefix}_${cleanPeriod}_${nowStr}.xlsx`;

    XLSX.writeFile(wb, finalFilename);
}
