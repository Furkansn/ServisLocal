'use server';

import fs from 'fs/promises';
import path from 'path';
import prisma from '@/lib/prisma';

const A4_TEMPLATE_PATH = path.join(process.cwd(), 'src/lib/receipt-template-a4.json');
const ROLL_TEMPLATE_PATH = path.join(process.cwd(), 'src/lib/receipt-template-roll.json');
const LEGACY_TEMPLATE_PATH = path.join(process.cwd(), 'src/lib/receipt-template.json');

export async function getReceiptTemplate(format: 'a4' | 'roll' = 'a4') {
    // 1. Try database first (persistent across Vercel deployments)
    try {
        const dbTemplate = await prisma.receiptTemplate.findUnique({
            where: { format },
        });
        if (dbTemplate && dbTemplate.content) {
            const contentObj = typeof dbTemplate.content === 'string' 
                ? JSON.parse(dbTemplate.content) 
                : dbTemplate.content;
            return { ...(contentObj as any), format };
        }
    } catch (e) {
        console.warn('Database template fetch warning:', e);
    }

    // 2. Fallback to filesystem
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
    try {
        const payload = { ...templateData, format };

        // 1. Save to Database (Neon PostgreSQL) - persistent across serverless instances
        await prisma.receiptTemplate.upsert({
            where: { format },
            update: { content: payload },
            create: { format, content: payload },
        });

        // 2. Best-effort save to local filesystem (works in local dev, safe ignore on read-only serverless)
        try {
            const targetPath = format === 'roll' ? ROLL_TEMPLATE_PATH : A4_TEMPLATE_PATH;
            await fs.writeFile(targetPath, JSON.stringify(payload, null, 2), 'utf-8');
        } catch (fsError) {
            // Ignored on read-only serverless environment
        }

        return { success: true };
    } catch (error: any) {
        console.error('Error saving template:', error);
        throw new Error('Şablon kaydedilirken hata oluştu: ' + (error.message || 'Veritabanı hatası'));
    }
}
