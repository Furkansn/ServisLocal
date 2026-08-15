import prisma from './prisma';
import { AuditAction } from '@prisma/client';

interface AuditLogEntry {
    ticketId?: string;
    entityType: string;
    entityId: string;
    action: AuditAction;
    field?: string;
    oldValue?: string | null;
    newValue?: string | null;
    changedById: string;
}

/**
 * Create a single audit log entry
 */
export async function createAuditLog(entry: AuditLogEntry) {
    return prisma.auditLog.create({
        data: {
            ticketId: entry.ticketId,
            entityType: entry.entityType,
            entityId: entry.entityId,
            action: entry.action,
            field: entry.field,
            oldValue: entry.oldValue ?? null,
            newValue: entry.newValue ?? null,
            changedById: entry.changedById,
        },
    });
}

/**
 * Log multiple field changes for an entity update (diff-based)
 */
export async function logFieldChanges(params: {
    ticketId?: string;
    entityType: string;
    entityId: string;
    changedById: string;
    changes: { field: string; oldValue: string | null; newValue: string | null }[];
}) {
    const { ticketId, entityType, entityId, changedById, changes } = params;

    if (changes.length === 0) return;

    return prisma.auditLog.createMany({
        data: changes.map((change) => ({
            ticketId,
            entityType,
            entityId,
            action: AuditAction.UPDATE,
            field: change.field,
            oldValue: change.oldValue,
            newValue: change.newValue,
            changedById,
        })),
    });
}

/**
 * Compare two objects and return changed fields
 */
export function diffFields<T extends Record<string, unknown>>(
    oldObj: T,
    newObj: Partial<T>,
    fieldsToTrack: (keyof T)[]
): { field: string; oldValue: string | null; newValue: string | null }[] {
    const changes: { field: string; oldValue: string | null; newValue: string | null }[] = [];

    for (const field of fieldsToTrack) {
        const oldVal = oldObj[field];
        const newVal = newObj[field];

        if (newVal !== undefined && String(oldVal) !== String(newVal)) {
            changes.push({
                field: String(field),
                oldValue: oldVal != null ? String(oldVal) : null,
                newValue: newVal != null ? String(newVal) : null,
            });
        }
    }

    return changes;
}

/**
 * Get audit logs for a specific ticket
 */
export async function getTicketAuditLogs(ticketId: string) {
    return prisma.auditLog.findMany({
        where: { ticketId },
        include: {
            changedBy: {
                select: { id: true, name: true },
            },
        },
        orderBy: { createdAt: 'desc' },
    });
}
