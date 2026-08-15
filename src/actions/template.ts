'use server';

import fs from 'fs/promises';
import path from 'path';

const A4_TEMPLATE_PATH = path.join(process.cwd(), 'src/lib/receipt-template-a4.json');
const ROLL_TEMPLATE_PATH = path.join(process.cwd(), 'src/lib/receipt-template-roll.json');
const LEGACY_TEMPLATE_PATH = path.join(process.cwd(), 'src/lib/receipt-template.json');

export async function getReceiptTemplate(format: 'a4' | 'roll' = 'a4') {
    const targetPath = format === 'roll' ? ROLL_TEMPLATE_PATH : A4_TEMPLATE_PATH;
    try {
        const data = await fs.readFile(targetPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        try {
            const legacyData = await fs.readFile(LEGACY_TEMPLATE_PATH, 'utf-8');
            const parsed = JSON.parse(legacyData);
            if (parsed && (parsed.format === format || (!parsed.format && format === 'a4'))) {
                return parsed;
            }
        } catch (e) {}
        return null;
    }
}

export async function saveReceiptTemplate(templateData: any, format: 'a4' | 'roll' = 'a4') {
    const targetPath = format === 'roll' ? ROLL_TEMPLATE_PATH : A4_TEMPLATE_PATH;
    try {
        await fs.writeFile(targetPath, JSON.stringify({ ...templateData, format }, null, 2), 'utf-8');
        return { success: true };
    } catch (error: any) {
        console.error('Error saving template:', error);
        throw new Error('Şablon kaydedilirken hata oluştu: ' + error.message);
    }
}
