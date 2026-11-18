import { prisma } from "./prisma";

/**
 * Typed access to the SystemSetting key/value table.
 * Falls back to a default when the key is missing or unparseable.
 */

export const SETTING_DEFAULTS = {
  membership_period_months: 12,
  renewal_alert_days: [30, 14, 7, 0],
  automated_reminders_enabled: false,
  org_timezone: process.env.ORG_TIMEZONE || "Africa/Kampala",
  org_currency: process.env.ORG_CURRENCY || "UGX",
} as const;

export async function getIntSetting(
  key: keyof typeof SETTING_DEFAULTS,
  fallback: number
): Promise<number> {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  if (!row) return fallback;
  const parsed = parseInt(row.value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function getBoolSetting(
  key: keyof typeof SETTING_DEFAULTS,
  fallback: boolean
): Promise<boolean> {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  if (!row) return fallback;
  return ["true", "1", "yes", "on"].includes(row.value.trim().toLowerCase());
}

export async function getStringSetting(
  key: keyof typeof SETTING_DEFAULTS,
  fallback: string
): Promise<string> {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  return row?.value?.trim() ? row.value : fallback;
}

export async function getIntListSetting(
  key: keyof typeof SETTING_DEFAULTS,
  fallback: number[]
): Promise<number[]> {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  if (!row) return fallback;
  const values = row.value
    .split(",")
    .map((v) => parseInt(v.trim(), 10))
    .filter((v) => Number.isFinite(v) && v >= 0);
  return values.length > 0 ? values : fallback;
}

export async function getMembershipPeriodMonths(): Promise<number> {
  return getIntSetting("membership_period_months", SETTING_DEFAULTS.membership_period_months);
}

export async function getRenewalAlertDays(): Promise<number[]> {
  return getIntListSetting("renewal_alert_days", [
    ...SETTING_DEFAULTS.renewal_alert_days,
  ]);
}

export async function getOrgCurrency(): Promise<string> {
  return getStringSetting("org_currency", SETTING_DEFAULTS.org_currency);
}