import * as XLSX from 'xlsx';
import { STATUS_LABELS } from './state-machine';
import { REQUEST_TYPE_LABELS, formatDate, formatDateTime } from './constants';

function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ─── 1. EXPORT OPERATIONAL REPORT ────────────────────────
export function exportOperationalReportExcel(data: any, periodLabel = 'Seçilen Dönem') {
    const wb = XLSX.utils.book_new();

    const header = [
        'Fiş No',
        'Tarih',
        'Müşteri / Tamirci',
        'Müşteri Türü',
        'Telefon',
        'Cihaz Bilgisi',
        'Durum',
        'Atanan Teknisyen',
        'Talep Türü',
        'Fiş Tutarı (TL)',
        'Parça Maliyeti (TL)',
        'Net Kâr (TL)',
        'Alınan Ödeme (TL)',
        'Kalan Bakiye (TL)',
    ];

    const rows = (data.items || []).map((t: any) => [
        t.ticketNo,
        formatDate(t.createdAt),
        t.customerName,
        t.customerType === 'REPAIRER' ? 'Tamirci' : 'Şahıs / Son Müşteri',
        t.customerPhone,
        t.device,
        STATUS_LABELS[t.status as keyof typeof STATUS_LABELS] || t.status,
        t.technicianName,
        REQUEST_TYPE_LABELS[t.requestType as keyof typeof REQUEST_TYPE_LABELS] || t.requestType || '-',
        t.totalPrice,
        t.partsCost,
        t.netProfit,
        t.totalPaid,
        t.remaining,
    ]);

    const grandTotalPrice = rows.reduce((s: number, r: any[]) => s + Number(r[9] || 0), 0);
    const grandCost = rows.reduce((s: number, r: any[]) => s + Number(r[10] || 0), 0);
    const grandProfit = rows.reduce((s: number, r: any[]) => s + Number(r[11] || 0), 0);
    const grandPaid = rows.reduce((s: number, r: any[]) => s + Number(r[12] || 0), 0);
    const grandRemaining = rows.reduce((s: number, r: any[]) => s + Number(r[13] || 0), 0);

    const sheetData = [
        ['SERVİSPLUS - GENEL OPERASYON VE İŞLER RAPORU'],
        [`Rapor Dönemi: ${periodLabel}`, `Oluşturulma Tarihi: ${formatDateTime(new Date())}`, `Toplam Fiş: ${data.totalTickets || rows.length}`],
        [`Tamamlanan: ${data.completedTickets || 0}`, `Teslim Edilen: ${data.deliveredTickets || 0}`, `Devam Eden: ${data.inProgressTickets || 0}`, `İptal/İade: ${data.cancelledTickets || 0}`],
        [],
        header,
        ...rows,
        [],
        [
            'GENEL TOPLAM',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            grandTotalPrice,
            grandCost,
            grandProfit,
            grandPaid,
            grandRemaining,
        ],
    ];

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws['!cols'] = [
        { wch: 14 }, // Fiş No
        { wch: 14 }, // Tarih
        { wch: 26 }, // Müşteri
        { wch: 18 }, // Tür
        { wch: 16 }, // Tel
        { wch: 24 }, // Cihaz
        { wch: 20 }, // Durum
        { wch: 20 }, // Teknisyen
        { wch: 22 }, // Talep
        { wch: 16 }, // Tutar
        { wch: 18 }, // Maliyet
        { wch: 16 }, // Kâr
        { wch: 18 }, // Alınan
        { wch: 18 }, // Kalan
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Genel İşler Raporu');
    downloadWorkbook(wb, 'ServisPlus_Genel_Isler_Raporu');
}

// ─── 2. EXPORT TECHNICIAN REPORT ─────────────────────────
export function exportTechnicianReportExcel(data: any, periodLabel = 'Seçilen Dönem') {
    const wb = XLSX.utils.book_new();

    // 1. Sheet: Özet
    const summaryHeader = [
        'Teknisyen Adı',
        'Toplam Atanan Fiş',
        'Tamamlanan Fiş',
        'Devam Eden Fiş',
        'Oluşturulan Ciro (TL)',
        'Kullanılan Parça Maliyeti (TL)',
        'Net Kâr Katkısı (TL)',
        'Kârlılık Marjı (%)',
    ];

    const summaryRows = (data.technicians || []).map((t: any) => {
        const margin = t.totalRevenue > 0 ? ((t.netProfitContribution / t.totalRevenue) * 100).toFixed(1) : '0.0';
        return [
            t.technicianName,
            t.totalAssigned,
            t.completedCount,
            t.inProgressCount,
            t.totalRevenue,
            t.totalPartsCost,
            t.netProfitContribution,
            `%${margin}`,
        ];
    });

    const summarySheetData = [
        ['SERVİSPLUS - TEKNİSYEN PERFORMANS VE KÂRLILIK RAPORU'],
        [`Rapor Dönemi: ${periodLabel}`, `Oluşturulma Tarihi: ${formatDateTime(new Date())}`],
        [],
        summaryHeader,
        ...summaryRows,
        [],
        [
            'GENEL TOPLAM',
            (data.technicians || []).reduce((s: number, t: any) => s + t.totalAssigned, 0),
            data.totalCompletedAll || 0,
            (data.technicians || []).reduce((s: number, t: any) => s + t.inProgressCount, 0),
            data.totalRevenueAll || 0,
            data.totalPartsCostAll || 0,
            data.totalNetProfitAll || 0,
            data.totalRevenueAll > 0 ? `%${(((data.totalNetProfitAll || 0) / data.totalRevenueAll) * 100).toFixed(1)}` : '%0.0',
        ],
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summarySheetData);
    wsSummary['!cols'] = [
        { wch: 26 }, // Teknisyen
        { wch: 18 }, // Atanan
        { wch: 18 }, // Tamamlanan
        { wch: 18 }, // Devam Eden
        { wch: 22 }, // Ciro
        { wch: 26 }, // Parça Maliyeti
        { wch: 22 }, // Net Kâr
        { wch: 18 }, // Marj
    ];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Teknisyen Özet');

    // 2. Sheet: Teknisyen İşlem Dökümü
    const detailHeader = [
        'Teknisyen',
        'Fiş No',
        'Tarih',
        'Müşteri',
        'Cihaz (Marka/Model)',
        'Durum',
        'Fiş Satış Bedeli (TL)',
        'Kullanılan Parça Maliyeti (TL)',
        'Net Kâr (TL)',
    ];

    const detailRows: any[] = [];
    (data.technicians || []).forEach((tech: any) => {
        (tech.ticketDetails || []).forEach((d: any) => {
            detailRows.push([
                tech.technicianName,
                d.ticketNo,
                formatDate(d.date),
                d.customer,
                d.device,
                STATUS_LABELS[d.status as keyof typeof STATUS_LABELS] || d.status,
                d.revenue,
                d.cost,
                d.profit,
            ]);
        });
    });

    const detailSheetData = [
        ['SERVİSPLUS - TEKNİSYEN İŞLEM DÖKÜMÜ'],
        [`Rapor Dönemi: ${periodLabel}`, `Oluşturulma Tarihi: ${formatDateTime(new Date())}`],
        [],
        detailHeader,
        ...detailRows,
    ];

    const wsDetail = XLSX.utils.aoa_to_sheet(detailSheetData);
    wsDetail['!cols'] = [
        { wch: 24 }, // Teknisyen
        { wch: 14 }, // Fiş No
        { wch: 14 }, // Tarih
        { wch: 26 }, // Müşteri
        { wch: 24 }, // Cihaz
        { wch: 20 }, // Durum
        { wch: 20 }, // Satış
        { wch: 24 }, // Maliyet
        { wch: 18 }, // Net Kâr
    ];
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Teknisyen Cihaz Dökümü');

    downloadWorkbook(wb, 'ServisPlus_Teknisyen_Performans_Raporu');
}

// ─── 3. EXPORT FINANCIAL DETAIL REPORT ───────────────────
export function exportFinancialDetailReportExcel(data: any, periodLabel = 'Seçilen Dönem') {
    const wb = XLSX.utils.book_new();

    const header = [
        'Fiş No',
        'Tarih',
        'Müşteri / Tamirci',
        'Tür',
        'Cihaz Bilgisi',
        'Talep / Arıza',
        'Kullanılan Parça / Ürün',
        'Parça Alış Maliyeti (TL)',
        'Tamir Satış Bedeli (TL)',
        'Satılan Aksesuarlar',
        'Aksesuar Satış Tutarı (TL)',
        'Nakit Ödeme (TL)',
        'Kredi Kartı (TL)',
        'Havale / EFT (TL)',
        'Toplam Tahsilat (TL)',
        'Tahsil Eden Personel',
        'Toplam Satış / Ciro (TL)',
        'Toplam Parça Maliyeti (TL)',
        'NET KÂR (TL)',
    ];

    const rows = (data.rows || []).map((r: any) => [
        r.ticketNo,
        formatDate(r.date),
        r.customerName,
        r.customerType,
        r.device,
        REQUEST_TYPE_LABELS[r.requestType as keyof typeof REQUEST_TYPE_LABELS] || r.requestType || '-',
        r.installedParts,
        r.totalPartsCost,
        r.repairSales,
        r.accessoriesSold,
        r.totalAccessorySales,
        r.paymentsCash,
        r.paymentsCard,
        r.paymentsTransfer,
        r.totalPaid,
        r.receivers,
        r.totalRevenue,
        r.totalPartsCost,
        r.netProfit,
    ]);

    const sheetData = [
        ['SERVİSPLUS - DETAYLI FİNANS, PARÇA, AKSESUAR VE NET KÂR RAPORU'],
        [`Rapor Dönemi: ${periodLabel}`, `Oluşturulma Tarihi: ${formatDateTime(new Date())}`],
        [],
        header,
        ...rows,
        [],
        [
            'GENEL TOPLAM',
            '',
            '',
            '',
            '',
            '',
            '',
            data.grandTotalCost || 0,
            rows.reduce((s: number, r: any[]) => s + Number(r[8] || 0), 0),
            '',
            rows.reduce((s: number, r: any[]) => s + Number(r[10] || 0), 0),
            rows.reduce((s: number, r: any[]) => s + Number(r[11] || 0), 0),
            rows.reduce((s: number, r: any[]) => s + Number(r[12] || 0), 0),
            rows.reduce((s: number, r: any[]) => s + Number(r[13] || 0), 0),
            data.grandTotalPaid || 0,
            '',
            data.grandTotalRevenue || 0,
            data.grandTotalCost || 0,
            data.grandTotalProfit || 0,
        ],
    ];

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws['!cols'] = [
        { wch: 14 }, // Fiş No
        { wch: 14 }, // Tarih
        { wch: 24 }, // Müşteri
        { wch: 14 }, // Tür
        { wch: 22 }, // Cihaz
        { wch: 20 }, // Talep
        { wch: 32 }, // Kullanılan Parça
        { wch: 22 }, // Parça Maliyeti
        { wch: 20 }, // Tamir Satış
        { wch: 28 }, // Aksesuar
        { wch: 24 }, // Aksesuar Tutar
        { wch: 16 }, // Nakit
        { wch: 16 }, // Kart
        { wch: 16 }, // Havale
        { wch: 20 }, // Toplam Tahsilat
        { wch: 22 }, // Tahsil Eden
        { wch: 22 }, // Toplam Ciro
        { wch: 24 }, // Toplam Maliyet
        { wch: 20 }, // NET KÂR
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Finans & Parça & Kâr Detay');
    downloadWorkbook(wb, 'ServisPlus_Detayli_Finans_Ve_Karlilik_Raporu');
}

// ─── 4. EXPORT INVENTORY REPORT ──────────────────────────
export function exportInventoryReportExcel(data: any) {
    const wb = XLSX.utils.book_new();

    const categoryNames: Record<string, string> = {
        SCREEN: 'Ekran',
        LED: 'LED',
        ACCESSORY: 'Aksesuar',
        LGP: 'LGP',
        OTHER: 'Diğer',
    };

    const header = [
        'Barkod / Kod',
        'Ürün Adı',
        'Kategori',
        'Entegrasyon Kaynağı',
        'Mevcut Stok (Adet)',
        'Birim Alış Maliyeti (TL)',
        'Birim Satış Fiyatı (TL)',
        'Toplam Stok Maliyet Değeri (TL)',
        'Toplam Potansiyel Satış Değeri (TL)',
        'Potansiyel Net Kâr (TL)',
        'Durum',
    ];

    const rows = (data.items || []).map((p: any) => [
        p.barcode,
        p.name,
        categoryNames[p.category] || p.category,
        p.source,
        p.stock,
        p.cost,
        p.price,
        p.totalCostVal,
        p.totalSalesVal,
        p.totalSalesVal - p.totalCostVal,
        p.isActive ? 'Aktif' : 'Pasif / Kapalı',
    ]);

    const sheetData = [
        ['SERVİSPLUS - GÜNCEL ÜRÜN VE STOK ENVANTER RAPORU'],
        [`Rapor Tarihi: ${formatDateTime(new Date())}`, `Toplam Ürün Çeşidi: ${data.totalItemsCount || rows.length}`, `Toplam Stok Adedi: ${data.totalStockCount || 0}`],
        [`Toplam Stok Maliyeti: ${data.totalStockCostValue || 0} TL`, `Toplam Satış Değeri: ${data.totalStockSalesValue || 0} TL`, `Potansiyel Stok Kârı: ${data.potentialProfit || 0} TL`],
        [],
        header,
        ...rows,
        [],
        [
            'GENEL TOPLAM',
            '',
            '',
            '',
            data.totalStockCount || 0,
            '',
            '',
            data.totalStockCostValue || 0,
            data.totalStockSalesValue || 0,
            data.potentialProfit || 0,
            '',
        ],
    ];

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws['!cols'] = [
        { wch: 18 }, // Barkod
        { wch: 34 }, // Ürün Adı
        { wch: 16 }, // Kategori
        { wch: 22 }, // Kaynak
        { wch: 18 }, // Stok
        { wch: 22 }, // Alış Maliyet
        { wch: 22 }, // Satış Fiyat
        { wch: 28 }, // Toplam Stok Maliyet
        { wch: 30 }, // Toplam Satış Değeri
        { wch: 22 }, // Potansiyel Kâr
        { wch: 16 }, // Durum
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Ürün & Stok Envanteri');
    downloadWorkbook(wb, 'ServisPlus_Urun_Stok_Envanteri');
}

// ─── 5. EXPORT ALL 4 REPORTS COMBINED ────────────────────
export function exportAllReportsCombinedExcel(data: {
    operational: any;
    technician: any;
    financial: any;
    inventory: any;
}, periodLabel = 'Seçilen Dönem') {
    const wb = XLSX.utils.book_new();

    // 1. Sheet: Genel İşler
    {
        const header = ['Fiş No', 'Tarih', 'Müşteri / Tamirci', 'Cihaz', 'Durum', 'Teknisyen', 'Fiş Tutarı (TL)', 'Parça Maliyeti (TL)', 'Net Kâr (TL)', 'Alınan Ödeme (TL)', 'Kalan (TL)'];
        const rows = (data.operational?.items || []).map((t: any) => [
            t.ticketNo,
            formatDate(t.createdAt),
            t.customerName,
            t.device,
            STATUS_LABELS[t.status as keyof typeof STATUS_LABELS] || t.status,
            t.technicianName,
            t.totalPrice,
            t.partsCost,
            t.netProfit,
            t.totalPaid,
            t.remaining,
        ]);
        const sheetData = [
            ['1. GENEL OPERASYON VE İŞLER ÖZETİ'],
            [`Dönem: ${periodLabel}`, `Rapor Tarihi: ${formatDateTime(new Date())}`],
            [],
            header,
            ...rows,
        ];
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 26 }, { wch: 24 }, { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 16 }];
        XLSX.utils.book_append_sheet(wb, ws, '1-Genel İşler');
    }

    // 2. Sheet: Teknisyen Performansı
    {
        const header = ['Teknisyen Adı', 'Atanan Fiş', 'Tamamlanan', 'Devam Eden', 'Ciro (TL)', 'Parça Maliyeti (TL)', 'Net Kâr Katkısı (TL)', 'Kârlılık Oranı (%)'];
        const rows = (data.technician?.technicians || []).map((t: any) => [
            t.technicianName,
            t.totalAssigned,
            t.completedCount,
            t.inProgressCount,
            t.totalRevenue,
            t.totalPartsCost,
            t.netProfitContribution,
            t.totalRevenue > 0 ? `%${((t.netProfitContribution / t.totalRevenue) * 100).toFixed(1)}` : '%0.0',
        ]);
        const sheetData = [
            ['2. TEKNİSYEN PERFORMANS VE KÂRLILIK DAĞILIMI'],
            [`Dönem: ${periodLabel}`],
            [],
            header,
            ...rows,
        ];
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws['!cols'] = [{ wch: 26 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 24 }, { wch: 22 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, ws, '2-Teknisyen Performans');
    }

    // 3. Sheet: Detaylı Finans ve Parça / Tahsilat
    {
        const header = ['Fiş No', 'Tarih', 'Müşteri', 'Cihaz', 'Kullanılan Parça', 'Parça Maliyeti (TL)', 'Tamir Satış (TL)', 'Satılan Aksesuar', 'Aksesuar Satış (TL)', 'Tahsil Edilen (TL)', 'Tahsil Eden', 'Toplam Ciro (TL)', 'NET KÂR (TL)'];
        const rows = (data.financial?.rows || []).map((r: any) => [
            r.ticketNo,
            formatDate(r.date),
            r.customerName,
            r.device,
            r.installedParts,
            r.totalPartsCost,
            r.repairSales,
            r.accessoriesSold,
            r.totalAccessorySales,
            r.totalPaid,
            r.receivers,
            r.totalRevenue,
            r.netProfit,
        ]);
        const sheetData = [
            ['3. DETAYLI FİNANS, PARÇA, AKSESUAR VE NET KÂR DÖKÜMÜ'],
            [`Dönem: ${periodLabel}`],
            [],
            header,
            ...rows,
        ];
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 24 }, { wch: 22 }, { wch: 30 }, { wch: 20 }, { wch: 18 }, { wch: 26 }, { wch: 20 }, { wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, ws, '3-Finans & Parça & Kâr');
    }

    // 4. Sheet: Ürün ve Stok Envanteri
    {
        const categoryNames: Record<string, string> = { SCREEN: 'Ekran', LED: 'LED', ACCESSORY: 'Aksesuar', LGP: 'LGP', OTHER: 'Diğer' };
        const header = ['Barkod', 'Ürün Adı', 'Kategori', 'Kaynak', 'Stok', 'Alış Maliyeti (TL)', 'Satış Fiyatı (TL)', 'Stok Maliyet Değeri (TL)', 'Satış Değeri (TL)', 'Potansiyel Kâr (TL)'];
        const rows = (data.inventory?.items || []).map((p: any) => [
            p.barcode,
            p.name,
            categoryNames[p.category] || p.category,
            p.source,
            p.stock,
            p.cost,
            p.price,
            p.totalCostVal,
            p.totalSalesVal,
            p.totalSalesVal - p.totalCostVal,
        ]);
        const sheetData = [
            ['4. GÜNCEL ÜRÜN VE STOK ENVANTERİ'],
            [`Rapor Tarihi: ${formatDateTime(new Date())}`],
            [],
            header,
            ...rows,
        ];
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws['!cols'] = [{ wch: 18 }, { wch: 32 }, { wch: 16 }, { wch: 20 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 24 }, { wch: 24 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, ws, '4-Stok Envanteri');
    }

    downloadWorkbook(wb, 'ServisPlus_Kapsamli_Yonetim_Paketi');
}
