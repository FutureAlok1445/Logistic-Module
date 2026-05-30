import { prisma } from '../../config/database';

interface AuditEntry {
  employeeId: string;
  action: string;
  entity: string;
  entityId: string;
  before?: object;
  after?: object;
  ip?: string;
  userAgent?: string;
}

export async function logAudit(entry: AuditEntry) {
  // Never throws — audit failure should not block operations
  try {
    await prisma.auditLog.create({ 
      data: {
        ...entry,
        before: entry.before ? JSON.stringify(entry.before) : undefined,
        after: entry.after ? JSON.stringify(entry.after) : undefined
      } as any
    });
  } catch (err) {
    // Log to file if DB is down — audit must never be lost
    console.error('AUDIT_FAIL:', JSON.stringify(entry));
  }
}