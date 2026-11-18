import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/middleware";
import { jsonOk } from "@/lib/serialize";

/**
 * GET /api/cron/run
 *
 * Single entry point for an external scheduler (cron, GitHub Actions,
 * Vercel Cron, Kubernetes CronJob). Runs:
 *   1. Automated reminder dispatch (emails)
 *   2. Notification generation (in-app alerts)
 *
 * Protected by the CRON_SECRET environment variable, supplied either as
 * `Authorization: Bearer <CRON_SECRET>` or `?secret=<CRON_SECRET>`.
 */
export async function GET(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      return jsonOk(
        { error: "CRON_SECRET is not configured" },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(req.url);
    const provided =
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      searchParams.get("secret") ||
      "";

    if (provided !== secret) {
      return jsonOk({ error: "Unauthorized" }, { status: 401 });
    }

    const result: Record<string, unknown> = { ranAt: new Date().toISOString() };

    // 1. Automated reminders
    const reminderRes = await internalFetch("/api/reminders/run", req);
    result.reminders = reminderRes;

    // 2. In-app notifications
    const notifRes = await internalFetch("/api/notifications/generate", req);
    result.notifications = notifRes;

    // 3. Refresh expiry status flags on members (spec 3.1, 7.1)
    result.expiryStatus = await refreshExpiryStatuses();

    return jsonOk(result);
  } catch (error) {
    return apiError(error);
  }
}

async function internalFetch(path: string, req: NextRequest) {
  const base = process.env.APP_URL || new URL(req.url).origin;
  const res = await fetch(`${base}${path}`, {
    headers: {
      Authorization: req.headers.get("authorization") || "",
    },
  });
  return res.json().catch(() => ({ status: res.status }));
}

/**
 * Recomputes each member's expiryStatus from their latest membership period so
 * the dashboard "expired" / "expiring soon" cards stay accurate without
 * depending on cron writes.
 */
async function refreshExpiryStatuses() {
  const { calculateExpiryStatus } = await import("@/lib/business");
  const now = new Date();

  const periods = await prisma.membershipPeriod.findMany({
    orderBy: { expiryDate: "desc" },
    select: { memberId: true, expiryDate: true, startDate: true, renewalDate: true },
  });

  const seen = new Set<string>();
  let updated = 0;

  for (const period of periods) {
    if (seen.has(period.memberId)) continue;
    seen.add(period.memberId);

    const status = calculateExpiryStatus(period.expiryDate, now);
    const result = await prisma.member.updateMany({
      where: { id: period.memberId },
      data: {
        expiryStatus:
          status === "RENEWAL_DUE" ? "RENEWAL_DUE" : status,
      },
    });
    updated += result.count;
  }

  return { updated };
}
