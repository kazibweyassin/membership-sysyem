import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireAuth, apiError } from "@/lib/middleware";
import { calculateMonthsPastDue } from "@/lib/business";
import { sendEmail, REMINDER_TEMPLATES } from "@/lib/email";
import { jsonOk } from "@/lib/serialize";

const ORG_CURRENCY = () => process.env.ORG_CURRENCY || "UGX";

/**
 * GET /api/reminders/run
 *
 * Dispatches automated reminders for:
 *  - invoices due today (PAYMENT_DUE)
 *  - overdue invoices (PAYMENT_OVERDUE), one per month interval
 *  - memberships expiring at configured intervals (MEMBERSHIP_EXPIRY)
 *  - expired memberships (RENEWAL)
 *
 * Also refreshes invoice statuses (ISSUED -> OVERDUE).
 *
 * Duplicate automated reminders for the same member + reminder type on the
 * same calendar day are skipped (spec 8.3).
 */
export async function GET(req: NextRequest) {
  try {
    requirePermission(req, "payments");
    const now = new Date();
    const startOfToday = startOfDay(now);
    const endOfToday = endOfDay(now);

    const sent: { memberId: string; type: string; email: string; status: string }[] = [];
    const skipped: string[] = [];
    const failed: string[] = [];

    // ---------- 1. Refresh overdue invoice statuses ----------
    await prisma.invoice.updateMany({
      where: {
        status: { in: ["ISSUED", "PARTIALLY_PAID"] },
        dueDate: { lt: startOfToday },
      },
      data: { status: "OVERDUE" },
    });

    // ---------- 2. Invoice due today ----------
    const dueToday = await prisma.invoice.findMany({
      where: {
        status: { in: ["ISSUED", "PARTIALLY_PAID"] },
        dueDate: { gte: startOfToday, lte: endOfToday },
      },
      include: { member: { include: { contacts: true } } },
    });

    for (const inv of dueToday) {
      const result = await dispatch({
        memberId: inv.memberId,
        memberCompany: inv.member.companyName,
        contacts: inv.member.contacts.map((c) => c.email),
        reminderType: "PAYMENT_DUE",
        build: () =>
          REMINDER_TEMPLATES.PAYMENT_DUE(
            inv.member.companyName,
            inv.invoiceNumber,
            inv.dueDate.toLocaleDateString(),
            `${ORG_CURRENCY()} ${(inv.amount.toNumber() - inv.amountPaid.toNumber()).toFixed(2)}`
          ),
        now,
      });
      record(result, inv.memberId, "PAYMENT_DUE", sent, skipped, failed);
    }

    // ---------- 3. Overdue invoices ----------
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
        dueDate: { lt: startOfToday },
      },
      include: { member: { include: { contacts: true } } },
      orderBy: { dueDate: "asc" },
    });

    const overdueSentMonths = new Map<string, Set<number>>();

    for (const inv of overdueInvoices) {
      const months = calculateMonthsPastDue(inv.dueDate, false, now);
      if (months < 1) continue;

      const already = overdueSentMonths.get(inv.memberId) ?? new Set<number>();
      if (already.has(months)) continue;

      const result = await dispatch({
        memberId: inv.memberId,
        memberCompany: inv.member.companyName,
        contacts: inv.member.contacts.map((c) => c.email),
        reminderType: "PAYMENT_OVERDUE",
        build: () =>
          REMINDER_TEMPLATES.PAYMENT_OVERDUE(
            inv.member.companyName,
            inv.invoiceNumber,
            `${ORG_CURRENCY()} ${(inv.amount.toNumber() - inv.amountPaid.toNumber()).toFixed(2)}`,
            months
          ),
        now,
        intervalKey: String(months),
      });

      if (result.sent) {
        already.add(months);
        overdueSentMonths.set(inv.memberId, already);
      }
      record(result, inv.memberId, "PAYMENT_OVERDUE", sent, skipped, failed);
    }

    // ---------- 4. Membership expiry ----------
    const alertDays = await getAlertDays();
    const periods = await prisma.membershipPeriod.findMany({
      include: { member: { include: { contacts: true } } },
      orderBy: { expiryDate: "desc" },
    });

    const seen = new Set<string>();
    for (const period of periods) {
      if (seen.has(period.memberId)) continue;
      seen.add(period.memberId);

      for (const days of alertDays) {
        const target = startOfDay(period.expiryDate);
        const windowStart = new Date(startOfToday.getTime() - days * 86400000);
        const inWindow = target >= windowStart && target <= endOfToday;
        const expired = days === 0 && period.expiryDate < now;

        if (!inWindow && !expired) continue;

        const result = await dispatch({
          memberId: period.memberId,
          memberCompany: period.member.companyName,
          contacts: period.member.contacts.map((c) => c.email),
          reminderType: days === 0 ? "RENEWAL" : "MEMBERSHIP_EXPIRY",
          build: () =>
            days === 0
              ? REMINDER_TEMPLATES.RENEWAL(
                  period.member.companyName,
                  period.expiryDate.toLocaleDateString()
                )
              : REMINDER_TEMPLATES.MEMBERSHIP_EXPIRY(
                  period.member.companyName,
                  period.expiryDate.toLocaleDateString(),
                  days
                ),
          now,
          intervalKey: `${period.expiryDate.toISOString().slice(0, 10)}-${days}`,
        });

        record(
          result,
          period.memberId,
          days === 0 ? "RENEWAL" : "MEMBERSHIP_EXPIRY",
          sent,
          skipped,
          failed
        );
      }
    }

    return jsonOk({
      sent: sent.length,
      skipped: skipped.length,
      failed: failed.length,
      details: { sent, skipped, failed },
    });
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

interface DispatchResult {
  sent: boolean;
  skipped: boolean;
  email: string;
  error?: string;
}

async function dispatch(input: {
  memberId: string;
  memberCompany: string;
  contacts: string[];
  reminderType: string;
  build: () => { subject: string; text: string; html: string };
  now: Date;
  intervalKey?: string;
}): Promise<DispatchResult> {
  const recipient = input.contacts.find((e) => Boolean(e));

  if (!recipient) {
    return { sent: false, skipped: false, email: "", error: "No contact email" };
  }

  // Duplicate prevention: same member + same reminder type today
  const existing = await prisma.reminderHistory.findFirst({
    where: {
      memberId: input.memberId,
      reminderType: input.reminderType as any,
      reminderDate: { gte: startOfDay(input.now), lte: endOfDay(input.now) },
    },
    select: { id: true, subject: true },
  });

  const tpl = input.build();

  if (existing) {
    // For interval-based reminders (overdue month N, expiry N days) the
    // subject encodes the interval, so a differing subject is a new event.
    if (!input.intervalKey || existing.subject === tpl.subject) {
      return { sent: false, skipped: true, email: recipient };
    }
  }

  const result = await sendEmail({
    to: recipient,
    subject: tpl.subject,
    text: tpl.text,
    html: tpl.html,
  });

  await prisma.reminderHistory.create({
    data: {
      memberId: input.memberId,
      recipientEmail: recipient,
      reminderType: input.reminderType as any,
      subject: tpl.subject,
      deliveryStatus: result.sent ? "SENT" : "FAILED",
      notes: result.error ?? "Automated reminder",
    },
  });

  return { sent: result.sent, skipped: false, email: recipient, error: result.error };
}

function record(
  result: DispatchResult,
  memberId: string,
  type: string,
  sent: { memberId: string; type: string; email: string; status: string }[],
  skipped: string[],
  failed: string[]
) {
  if (result.sent) {
    sent.push({ memberId, type, email: result.email, status: "SENT" });
  } else if (result.skipped) {
    skipped.push(`${memberId}:${type}`);
  } else {
    failed.push(`${memberId}:${type}:${result.error ?? "unknown"}`);
  }
}
