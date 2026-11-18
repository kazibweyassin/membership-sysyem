import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError } from "@/lib/middleware";
import { jsonOk } from "@/lib/serialize";

// GET /api/renewals - Get renewal tracking data
export async function GET(req: NextRequest) {
  try {
    requireAuth(req);
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const periods = await prisma.membershipPeriod.findMany({
      include: {
        member: {
          include: {
            category: true,
            contacts: { where: { isPrimary: true } },
            invoices: { orderBy: { invoiceDate: "desc" }, take: 1 },
          },
        },
      },
      orderBy: { expiryDate: "asc" },
    });

    const expired = periods.filter((p) => p.expiryDate < now);
    const expiringSoon = periods.filter(
      (p) => p.expiryDate >= now && p.expiryDate <= thirtyDaysFromNow
    );
    const active = periods.filter((p) => p.expiryDate > thirtyDaysFromNow);

    return jsonOk({
      all: periods,
      expired,
      expiringSoon,
      active,
    });
  } catch (error) {
    return apiError(error);
  }
}
