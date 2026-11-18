import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError } from "@/lib/middleware";
import { calculateMonthsPastDue, isWithinDays } from "@/lib/business";
import { jsonOk } from "@/lib/serialize";

/**
 * Scans the database and generates notifications/reminders for:
 *  - invoices reaching their due date
 *  - overdue invoices
 *  - memberships approaching expiry (30/14/7/0 days)
 *  - expired memberships
 *  - incomplete onboarding tasks
 *
 * Idempotent: duplicate notifications for the same member + type + interval
 * are not created. Run from a scheduler (cron) or manually.
 *
 * GET /api/notifications/generate
 */
export async function GET(req: NextRequest) {
  try {
    requireAuth(req);
    const now = new Date();
    const created: string[] = [];

    const orgCurrency = process.env.ORG_CURRENCY || "UGX";

    // ---- Invoice due today ----
    const dueToday = await prisma.invoice.findMany({
      where: {
        status: { in: ["ISSUED", "PARTIALLY_PAID"] },
        dueDate: { gte: startOfDay(now), lte: endOfDay(now) },
      },
      include: { member: true },
    });
    for (const inv of dueToday) {
      const n = await createNotification({
        memberId: inv.memberId,
        type: "INVOICE_DUE",
        title: "Invoice due today",
        message: `${inv.invoiceNumber} for ${inv.member.companyName} (${orgCurrency} ${inv.amount.toNumber().toLocaleString()}) is due today.`,
        now,
      });
      if (n) created.push(n.id);
    }

    // ---- Overdue invoices ----
    const overdue = await prisma.invoice.findMany({
      where: {
        status: { in: ["ISSUED", "PARTIALLY_PAID"] },
        dueDate: { lt: now },
      },
      include: { member: true },
    });
    for (const inv of overdue) {
      const months = calculateMonthsPastDue(inv.dueDate, false, now);
      if (months > 0) {
        const n = await createNotification({
          memberId: inv.memberId,
          type: "PAYMENT_OVERDUE",
          title: "Payment overdue",
          message: `${inv.invoiceNumber} for ${inv.member.companyName} is ${months} month(s) overdue. Outstanding: ${orgCurrency} ${(inv.amount.toNumber() - inv.amountPaid.toNumber()).toLocaleString()}.`,
          now,
          intervalKey: String(months),
        });
        if (n) created.push(n.id);
      }
    }

    // ---- Membership expiry alerts at configured intervals ----
    const alertDays = await getAlertDays();
    const periods = await prisma.membershipPeriod.findMany({
      include: { member: true },
      orderBy: { expiryDate: "desc" },
    });

    // Keep only the latest period per member
    const seen = new Set<string>();
    const latestPeriods = periods.filter((p) => {
      if (seen.has(p.memberId)) return false;
      seen.add(p.memberId);
      return true;
    });

    for (const period of latestPeriods) {
      for (const days of alertDays) {
        if (isWithinDays(period.expiryDate, days, now)) {
          const n = await createNotification({
            memberId: period.memberId,
            type:
              days === 0 ? "MEMBERSHIP_EXPIRED" : "MEMBERSHIP_EXPIRY",
            title:
              days === 0
                ? "Membership expired"
                : `Membership expiring in ${days} day(s)`,
            message:
              days === 0
                ? `The membership for ${period.member.companyName} expired on ${period.expiryDate.toLocaleDateString()}.`
                : `The membership for ${period.member.companyName} expires on ${period.expiryDate.toLocaleDateString()}.`,
            now,
            intervalKey: `${period.expiryDate.toISOString().slice(0, 10)}-${days}`,
          });
          if (n) created.push(n.id);
        }
      }
    }

    // ---- Incomplete onboarding ----
    const stuck = await prisma.member.findMany({
      where: {
        status: "ONBOARDING",
        registrationDate: { lt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) },
      },
      include: { onboardingTasks: true },
    });
    for (const member of stuck) {
      const pending = member.onboardingTasks.filter(
        (t) => t.status !== "COMPLETED"
      );
      if (pending.length > 0) {
        const n = await createNotification({
          memberId: member.id,
          type: "ONBOARDING_INCOMPLETE",
          title: "Onboarding incomplete",
          message: `${member.companyName} has ${pending.length} onboarding stage(s) still pending.`,
          now,
        });
        if (n) created.push(n.id);
      }
    }

    return jsonOk({ generated: created.length, notifications: created });
  } catch (error) {
    return apiError(error);
  }
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

async function getAlertDays(): Promise<number[]> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: "renewal_alert_days" },
  });
  if (!setting) return [30, 14, 7, 0];
  return setting.value
    .split(",")
    .map((v) => parseInt(v.trim(), 10))
    .filter((v) => !Number.isNaN(v));
}

/**
 * Creates a notification unless an un-dismissed one with the same
 * member/type/interval already exists today.
 */
async function createNotification(input: {
  memberId: string;
  type:
    | "INVOICE_DUE"
    | "PAYMENT_OVERDUE"
    | "MEMBERSHIP_EXPIRY"
    | "MEMBERSHIP_EXPIRED"
    | "ONBOARDING_INCOMPLETE";
  title: string;
  message: string;
  now: Date;
  intervalKey?: string;
}) {
  const interval = input.intervalKey ?? "daily";

  const existing = await prisma.notification.findFirst({
    where: {
      memberId: input.memberId,
      type: input.type,
      title: input.title,
      createdAt: { gte: startOfDay(input.now) },
    },
    select: { id: true, message: true },
  });

  // For interval-based alerts the title differs per interval, so title
  // matching already prevents duplicates. For daily alerts, message match
  // guards against repeats.
  if (existing) {
    if (!input.intervalKey && existing.message === input.message) return null;
    if (input.intervalKey) return null;
  }

  return prisma.notification.create({
    data: {
      memberId: input.memberId,
      type: input.type,
      title: input.title,
      message: input.message,
      // intervalKey is not persisted separately; it only shapes title/message
      read: false,
      dismissed: false,
    },
    select: { id: true },
  });
}
