export interface ScreenPriceItem {
    id: string;
    size: string; // e.g. "55"
    description: string; // e.g. "55TU7000/FA01 (Orijinal)"
    usdPrice: number; // e.g. 290
    repairerPriceTL?: number; // optional manual override, otherwise calculated as usdPrice * usdRate
    customerPriceTL: number; // e.g. 14800
    highlight?: boolean;
    color?: 'default' | 'blue' | 'red' | string;
    order: number;
}

export interface LedPriceItem {
    id: string;
    size: string; // e.g. "49"
    model: string; // e.g. "Samsung 49NU-RU"
    repairerLaborPriceTL: number; // Tamirci İşçilik Fiyatı (₺)
    customerPriceTL: number; // Müşteri Fiyatı (₺)
    highlight?: boolean;
    color?: 'default' | 'blue' | 'red' | string;
    order: number;
}

export interface PriceListData {
    usdRate: number; // e.g. 48.60 (purely manual, no external API)
    screenItems: ScreenPriceItem[];
    ledItems: LedPriceItem[];
}

export const INITIAL_PRICE_LIST: PriceListData = {
    usdRate: 48.60,
    screenItems: [
        { id: 'sc-1', size: '24', description: 'HD ve Hd Ready', usdPrice: 70, customerPriceTL: 4500, order: 1 },
        { id: 'sc-2', size: '32', description: 'HD', usdPrice: 75, customerPriceTL: 4600, order: 2 },
        { id: 'sc-3', size: '32', description: 'FHD', usdPrice: 80, customerPriceTL: 5000, order: 3 },
        { id: 'sc-4', size: '40', description: 'FULL HD', usdPrice: 130, customerPriceTL: 7800, order: 4 },
        { id: 'sc-5', size: '40', description: '4K SAMSUNG-VESTEL', usdPrice: 140, customerPriceTL: 7200, order: 5 },
        { id: 'sc-6', size: '42', description: 'FULL HD', usdPrice: 135, customerPriceTL: 7800, order: 6 },
        { id: 'sc-7', size: '42', description: '4K', usdPrice: 150, customerPriceTL: 6750, order: 7 },
        { id: 'sc-8', size: '43', description: 'FULLHD', usdPrice: 120, customerPriceTL: 6800, order: 8 },
        { id: 'sc-9', size: '43', description: '43LH570-43DLK1723-43LH560-43L5740-43DMN13', usdPrice: 135, customerPriceTL: 7800, order: 9 },
        { id: 'sc-10', size: '43', description: '43 TCL FULLHD', usdPrice: 135, customerPriceTL: 7800, order: 10 },
        { id: 'sc-11', size: '43', description: '43D SERİSİ ARÇELİK-BEKO FULL HD', usdPrice: 135, customerPriceTL: 7800, highlight: true, order: 11 },
        { id: 'sc-12', size: '43', description: '43 4k VESTEL REGAL vs.', usdPrice: 135, customerPriceTL: 8500, order: 12 },
        { id: 'sc-13', size: '43', description: '4K LG -Philips-TCL-SAMSUNG', usdPrice: 140, customerPriceTL: 8500, order: 13 },
        { id: 'sc-14', size: '47', description: '47 LG-Vestel-Philips-LA-LB652-LB670', usdPrice: 175, customerPriceTL: 9800, order: 14 },
        { id: 'sc-15', size: '48', description: '48FHD Vestel-Arçelik-SAMSUNG', usdPrice: 175, customerPriceTL: 10500, order: 15 },
        { id: 'sc-16', size: '48', description: '48JU6070-6570-SAMSUNG', usdPrice: 240, customerPriceTL: 13000, order: 16 },
        { id: 'sc-17', size: '49', description: '49 inc FULLHD LG PANEL', usdPrice: 175, customerPriceTL: 9500, order: 17 },
        { id: 'sc-18', size: '49', description: '49 Vestel Arçelik Regal Axen 4K Philips', usdPrice: 185, customerPriceTL: 10500, order: 18 },
        { id: 'sc-19', size: '49', description: 'LG TV 49EGY- 49EQY ORJ', usdPrice: 200, customerPriceTL: 11500, order: 19 },
        { id: 'sc-20', size: '49', description: 'LG 49 TCONLU', usdPrice: 185, customerPriceTL: 11500, order: 20 },
        { id: 'sc-21', size: '49', description: '49" 120 HZ', usdPrice: 220, customerPriceTL: 12500, order: 21 },
        { id: 'sc-22', size: '49', description: '49" SONY', usdPrice: 250, customerPriceTL: 12500, order: 22 },
        { id: 'sc-23', size: '49', description: '49KS8500-9500', usdPrice: 250, customerPriceTL: 12800, order: 23 },
        { id: 'sc-24', size: '49', description: '49RU-NU-MU (Muadil Modifikasyonlu)', usdPrice: 185, customerPriceTL: 10000, highlight: true, order: 24 },
        { id: 'sc-25', size: '49', description: '49MU8000-9000 (Orijinal)', usdPrice: 235, customerPriceTL: 12800, order: 25 },
        { id: 'sc-26', size: '49', description: '49-KU- CURVED (Orijinal)', usdPrice: 235, customerPriceTL: 12800, highlight: true, order: 26 },
        { id: 'sc-27', size: '49', description: '49SK7900-2440', usdPrice: 230, customerPriceTL: 12800, order: 27 },
        { id: 'sc-28', size: '50', description: '50" Full HD VESTEL ARÇELİK YOK', usdPrice: 170, customerPriceTL: 10500, highlight: true, order: 28 },
        { id: 'sc-29', size: '50', description: '50" FHD SONY 50W serisi', usdPrice: 185, customerPriceTL: 11000, order: 29 },
        { id: 'sc-30', size: '50', description: '4K 120 HZ (LG-PHİLİPS-SONY VB)', usdPrice: 225, customerPriceTL: 12500, highlight: true, order: 30 },
        { id: 'sc-31', size: '50', description: '4K Beko-Vestel,Sunny-Philips', usdPrice: 165, customerPriceTL: 10800, order: 31 },
        { id: 'sc-32', size: '50', description: '4K Samsung -TCONLU LG', usdPrice: 165, customerPriceTL: 10800, order: 32 },
        { id: 'sc-33', size: '50', description: 'TCONSUZ LG', usdPrice: 170, customerPriceTL: 11000, order: 33 },
        { id: 'sc-34', size: '50', description: '50UA85006LA.UPEULWR', usdPrice: 170, customerPriceTL: 12000, highlight: true, order: 34 },
        { id: 'sc-35', size: '50', description: 'TCL-Samsung 50U8000-50DU8000', usdPrice: 170, customerPriceTL: 11000, highlight: true, order: 35 },
        { id: 'sc-36', size: '50', description: '120HZ-LG-PHİLİPS-SONY-120HZ', usdPrice: 220, customerPriceTL: 11800, order: 36 },
        { id: 'sc-37', size: '55', description: 'Vestel-HI level-Arçelik-Beko-Altus', usdPrice: 185, customerPriceTL: 11500, order: 37 },
        { id: 'sc-38', size: '55', description: 'Phılıps 60 hz Cihazlar', usdPrice: 185, customerPriceTL: 12800, order: 38 },
        { id: 'sc-39', size: '55', description: 'LG-TCL-SONY (60hz)', usdPrice: 250, customerPriceTL: 13800, order: 39 },
        { id: 'sc-40', size: '55', description: 'LG (60HZ) MODİFİKASYONLU', usdPrice: 200, customerPriceTL: 12500, highlight: true, order: 40 },
        { id: 'sc-41', size: '55', description: 'BU-CU SERİSİ 120HZ', usdPrice: 260, customerPriceTL: 12800, highlight: true, order: 41 },
        { id: 'sc-42', size: '55', description: '55TU7000/FA01 (Orijinal)', usdPrice: 290, customerPriceTL: 14800, highlight: true, order: 42 },
        { id: 'sc-43', size: '55', description: 'JU-MU-KU-NU-RU-TU-AU-BU-CU-Q60RAT', usdPrice: 200, customerPriceTL: 13500, order: 43 },
        { id: 'sc-44', size: '55', description: '55 CURVED SAMSUNG ORJİNAL', usdPrice: 300, customerPriceTL: 14800, highlight: true, order: 44 },
        { id: 'sc-45', size: '55', description: '55DU700-55Q60D-55DU8-', usdPrice: 245, customerPriceTL: 13800, order: 45 },
        { id: 'sc-46', size: '55', description: '55MU8000-9000', usdPrice: 230, customerPriceTL: 13800, highlight: true, order: 46 },
        { id: 'sc-47', size: '55', description: '55Q60R-55Q70-55Q80 Samsung ORJ', usdPrice: 250, customerPriceTL: 13800, highlight: true, order: 47 },
        { id: 'sc-48', size: '55', description: '55QN90-55QN80-55QN70', usdPrice: 280, customerPriceTL: 16800, highlight: true, order: 48 },
        { id: 'sc-49', size: '55', description: '55U8000F YENİ SAMSUNG', usdPrice: 250, customerPriceTL: 13800, order: 49 },
        { id: 'sc-50', size: '55', description: 'SAM- -SONY-LG-Philips-TCL 120HZ', usdPrice: 280, customerPriceTL: 14800, order: 50 },
        { id: 'sc-51', size: '55', description: 'FULL HD SAMSUNG - LG', usdPrice: 245, customerPriceTL: 13800, order: 51 },
        { id: 'sc-52', size: '55', description: 'FULL HD - ARÇELİK-VESTEL', usdPrice: 235, customerPriceTL: 11800, order: 52 },
        { id: 'sc-53', size: '58', description: 'Philips LG Samsung Vestel vs.', usdPrice: 230, customerPriceTL: 14000, order: 53 },
        { id: 'sc-54', size: '65', description: 'Grundig-Vestel-Arçelik-Beko-Philips', usdPrice: 280, customerPriceTL: 17000, order: 54 },
        { id: 'sc-55', size: '65', description: 'LG E9D-F7-F9 ÇIKAN CİHAZLAR', usdPrice: 370, customerPriceTL: 18800, highlight: true, order: 55 },
        { id: 'sc-56', size: '65', description: '60 HZ LG - TCL -', usdPrice: 350, customerPriceTL: 19800, order: 56 },
        { id: 'sc-57', size: '65', description: '120hz- TCL - LG - Philips', usdPrice: 370, customerPriceTL: 23377, order: 57 },
        { id: 'sc-58', size: '65', description: 'Samsung 65Q60-70-80 65DU-', usdPrice: 320, customerPriceTL: 21773, order: 58 },
        { id: 'sc-59', size: '65', description: 'Samsung 65 inc Muadil', usdPrice: 300, customerPriceTL: 18800, highlight: true, order: 59 },
        { id: 'sc-60', size: '65', description: 'SONY 120HZ -60HZ - TCL', usdPrice: 350, customerPriceTL: 19800, order: 60 },
        { id: 'sc-61', size: '70', description: 'SAMSUNG-LG-PHİLİPS-SONY-TCL', usdPrice: 370, customerPriceTL: 23377, order: 61 },
        { id: 'sc-62', size: '70', description: 'Toshiba-Vestel-Arçelik-Benzeri', usdPrice: 370, customerPriceTL: 22478, order: 62 },
        { id: 'sc-63', size: '75', description: 'SAMSUNG-LG-PHİLİPS-TCL', usdPrice: 430, customerPriceTL: 26500, order: 63 },
        { id: 'sc-64', size: '75', description: 'TOSHIBA-VESTEL-ARÇELİK', usdPrice: 400, customerPriceTL: 23800, order: 64 },
        { id: 'sc-65', size: '75', description: 'SONY', usdPrice: 455, customerPriceTL: 27500, order: 65 },
        { id: 'sc-66', size: '86-85', description: 'SAMSUNG-LG-PHİLİPS-SONY-TCL', usdPrice: 1000, customerPriceTL: 55500, order: 66 },
        { id: 'sc-67', size: '98', description: 'SAMSUNG-LG-PHILIPS-BEKO-VESTEL', usdPrice: 1500, customerPriceTL: 75000, order: 67 },
    ],
    ledItems: [
        { id: 'led-1', size: '32', model: 'Genel / Tüm Modeller', repairerLaborPriceTL: 600, customerPriceTL: 1800, order: 1 },
        { id: 'led-2', size: '39', model: 'Genel / Tüm Modeller', repairerLaborPriceTL: 800, customerPriceTL: 2500, order: 2 },
        { id: 'led-3', size: '40', model: 'Genel / Tüm Modeller', repairerLaborPriceTL: 1000, customerPriceTL: 2800, order: 3 },
        { id: 'led-4', size: '42', model: 'Genel / Tüm Modeller', repairerLaborPriceTL: 1000, customerPriceTL: 3400, order: 4 },
        { id: 'led-5', size: '43', model: 'Genel / Tüm Modeller', repairerLaborPriceTL: 1000, customerPriceTL: 3200, order: 5 },
        { id: 'led-6', size: '46', model: 'Genel / Tüm Modeller', repairerLaborPriceTL: 1200, customerPriceTL: 4200, order: 6 },
        { id: 'led-7', size: '47', model: 'Genel / Tüm Modeller', repairerLaborPriceTL: 1200, customerPriceTL: 4200, order: 7 },
        { id: 'led-8', size: '48', model: 'Genel / Tüm Modeller', repairerLaborPriceTL: 1200, customerPriceTL: 3800, order: 8 },
        { id: 'led-9', size: '49', model: 'Arçelik 49L9762', repairerLaborPriceTL: 1500, customerPriceTL: 5800, order: 9 },
        { id: 'led-10', size: '49', model: 'Vestel V.B', repairerLaborPriceTL: 1500, customerPriceTL: 3800, order: 10 },
        { id: 'led-11', size: '49', model: 'Samsung 49NU-RU', repairerLaborPriceTL: 1500, customerPriceTL: 4200, order: 11 },
        { id: 'led-12', size: '49', model: 'Samsung 49MU7400', repairerLaborPriceTL: 1500, customerPriceTL: 4800, order: 12 },
        { id: 'led-13', size: '50', model: 'Vestel V.B', repairerLaborPriceTL: 1500, customerPriceTL: 4500, order: 13 },
        { id: 'led-14', size: '50', model: 'Samsung 50NU-RU', repairerLaborPriceTL: 1500, customerPriceTL: 4800, order: 14 },
        { id: 'led-15', size: '55', model: 'Vestel V.B', repairerLaborPriceTL: 2000, customerPriceTL: 5800, order: 15 },
        { id: 'led-16', size: '55', model: 'Samsung 55MU SERİSİ', repairerLaborPriceTL: 2000, customerPriceTL: 9800, order: 16 },
        { id: 'led-17', size: '55', model: '55SK8500-55SM9010 (YOK GELMİYOR)', repairerLaborPriceTL: 2000, customerPriceTL: 0, order: 17 },
        { id: 'led-18', size: '58', model: 'Samsung 58NU-RU', repairerLaborPriceTL: 2000, customerPriceTL: 6200, order: 18 },
        { id: 'led-19', size: '65', model: 'Samsung 65NU-RU', repairerLaborPriceTL: 3000, customerPriceTL: 8800, order: 19 },
        { id: 'led-20', size: '65', model: 'Vestel V.B', repairerLaborPriceTL: 3000, customerPriceTL: 6800, order: 20 },
        { id: 'led-21', size: '75', model: 'Genel / Tüm Modeller', repairerLaborPriceTL: 4000, customerPriceTL: 12800, order: 21 },
    ]
};
