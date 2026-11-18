import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError } from "@/lib/middleware";
import { calculateOutstanding, calculateMonthsPastDue } from "@/lib/business";
import { jsonOk } from "@/lib/serialize";

// GET /api/dashboard - Get dashboard statistics
export async function GET(req: NextRequest) {
  try {
    requireAuth(req);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Summary card data
    const [totalMembers, paidMembers, unpaidMembers, onboardingMembers, cancelledMembers] = await Promise.all([
      prisma.member.count(),
      prisma.member.count({ where: { status: "PAID" } }),
      prisma.member.count({ where: { status: "UNPAID" } }),
      prisma.member.count({ where: { status: "ONBOARDING" } }),
      prisma.member.count({ where: { status: "CANCELLED" } }),
    ]);

    // Expired and expiring soon
    const [expiredMembers, expiringSoon] = await Promise.all([
      prisma.member.count({ where: { expiryStatus: "EXPIRED" } }),
      prisma.member.count({ where: { expiryStatus: "EXPIRING_SOON" } }),
    ]);

    // Overdue invoices
    const overdueInvoices = await prisma.invoice.count({
      where: {
        status: { in: ["ISSUED", "PARTIALLY_PAID"] },
        dueDate: { lt: now },
      },
    });

    // Payment overview
    const [paymentsThisMonth, allInvoices] = await Promise.all([
      prisma.payment.aggregate({
        where: { paymentDate: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      prisma.invoice.findMany({
        include: { payments: true },
      }),
    ]);

    const totalInvoiced = allInvoices.reduce((sum, inv) => sum + inv.amount.toNumber(), 0);
    const totalCollected = allInvoices.reduce((sum, inv) => sum + inv.amountPaid.toNumber(), 0);
    const outstandingPayments = totalInvoiced - totalCollected;

    const overduePayments = allInvoices
      .filter((inv) => {
        const monthsPastDue = calculateMonthsPastDue(
          inv.dueDate,
          inv.status === "PAID",
          now
        );
        return monthsPastDue > 0;
      })
      .reduce((sum, inv) => sum + calculateOutstanding(inv.amount.toNumber(), inv.amountPaid.toNumber()), 0);

    // Category overview
    const categoryCounts = await prisma.member.groupBy({
      by: ["categoryId"],
      _count: { id: true },
    });

    const categories = await prisma.membershipCategory.findMany();
    const categoryOverview = categories.map((cat) => {
      const count = categoryCounts.find((c) => c.categoryId === cat.id)?._count.id || 0;
      return { ...cat, memberCount: count };
    });

    // Pending actions
    const paymentsDueToday = allInvoices.filter(
      (inv) =>
        inv.status !== "PAID" &&
        inv.status !== "CANCELLED" &&
        inv.dueDate.toDateString() === now.toDateString()
    ).length;

    const upcomingRenewals = await prisma.membershipPeriod.count({
      where: {
        renewalDate: { gte: now, lte: thirtyDaysFromNow },
      },
    });

    const pendingCertificates = await prisma.onboardingTask.count({
      where: { stage: 4, status: { not: "COMPLETED" } },
    });

    const pendingWhatsApp = await prisma.onboardingTask.count({
      where: { stage: 3, status: { not: "COMPLETED" } },
    });

    const incompleteOnboarding = await prisma.onboardingTask.count({
      where: { status: { not: "COMPLETED" } },
    });

    return jsonOk({
      summary: {
        totalMembers,
        paidMembers,
        unpaidMembers,
        onboardingMembers,
        cancelledMembers,
        expiredMembers,
        expiringSoon,
        overdueInvoices,
      },
      payments: {
        receivedThisMonth: paymentsThisMonth._sum.amount?.toNumber() || 0,
        outstanding: Math.round(outstandingPayments * 100) / 100,
        overdue: Math.round(overduePayments * 100) / 100,
        totalInvoiced: Math.round(totalInvoiced * 100) / 100,
        totalCollected: Math.round(totalCollected * 100) / 100,
      },
      categoryOverview,
      pendingActions: {
        paymentsDueToday,
        overduePayments: overdueInvoices,
        upcomingRenewals,
        pendingCertificates,
        pendingWhatsApp,
        incompleteOnboarding,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
