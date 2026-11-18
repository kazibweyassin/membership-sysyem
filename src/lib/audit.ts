import { prisma } from "./prisma";
import { Role } from "@prisma/client";

interface AuditLogEntry {
  userId?: string | null;
  memberId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  previousValue?: any;
  newValue?: any;
}

/**
 * Record an audit log entry. See spec.md section 12.
 */
export async function recordAudit(entry: AuditLogEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: entry.userId ?? null,
      memberId: entry.memberId ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      previousValue: entry.previousValue ?? undefined,
      newValue: entry.newValue ?? undefined,
    },
  });
}

/**
 * Check if a user has one of the allowed roles.
 */
export function hasRole(userRole: Role, allowed: Role[]): boolean {
  return allowed.includes(userRole);
}

/**
 * Role permission matrix (spec.md section 12).
 */
export const PERMISSIONS: Record<
  Role,
  { members: boolean; onboarding: boolean; invoices: boolean; payments: boolean; users: boolean; settings: boolean; reports: boolean }
> = {
  ADMINISTRATOR: {
    members: true,
    onboarding: true,
    invoices: true,
    payments: true,
    users: true,
    settings: true,
    reports: true,
  },
  MEMBERSHIP_OFFICER: {
    members: true,
    onboarding: true,
    invoices: false,
    payments: false,
    users: false,
    settings: false,
    reports: true,
  },
  FINANCE_OFFICER: {
    members: false,
    onboarding: false,
    invoices: true,
    payments: true,
    users: false,
    settings: false,
    reports: true,
  },
};