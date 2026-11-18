import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireAuth, apiError, ApiError } from "@/lib/middleware";
import { recordAudit } from "@/lib/audit";
import { calculateOutstanding, calculateExpiryDate, calculateRenewalDate } from "@/lib/business";
import { paymentSchema } from "@/lib/validation";
import { getMembershipPeriodMonths } from "@/lib/settings";
import { jsonOk } from "@/lib/serialize";

// GET /api/payments - List all payments
export async function GET(req: NextRequest) {
  try {
    requirePermission(req, "payments");
    const payments = await prisma.payment.findMany({
      include: {
        invoice: {
          include: {
            member: { include: { category: true } },
            category: true,
          },
        },
        createdBy: true,
      },
      orderBy: { paymentDate: "desc" },
    });

    return jsonOk({ payments });
  } catch (error) {
    return apiError(error);
  }
}

// POST /api/payments - Record a new payment
export async function POST(req: NextRequest) {
  try {
    const user = requirePermission(req, "payments");
    const raw = await req.json();

    const parsed = paymentSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.errors[0]?.message ?? "Invalid payment data");
    }
    const body = parsed.data;

    // Get the invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id: body.invoiceId },
      include: { member: true, payments: true },
    });

    if (!invoice) throw new ApiError(404, "Invoice not found");
    if (invoice.status === "CANCELLED" || invoice.status === "DRAFT") {
      throw new ApiError(400, `Payments cannot be recorded against a ${invoice.status.toLowerCase()} invoice`);
    }

    // Prevent overpayment
    const currentOutstanding = calculateOutstanding(invoice.amount.toNumber(), invoice.amountPaid.toNumber());
    if (body.amount > currentOutstanding) {
      throw new ApiError(
        400,
        `Payment amount (${body.amount}) exceeds outstanding balance (${currentOutstanding})`
      );
    }

    // Record the payment (never overwrite existing payments)
    const payment = await prisma.payment.create({
      data: {
        invoiceId: body.invoiceId,
        amount: body.amount,
        paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
        method: body.method || null,
        reference: body.reference || null,
        notes: body.notes || null,
        createdById: user.userId,
      },
      include: {
        invoice: { include: { member: true } },
        createdBy: true,
      },
    });

    // Update invoice amountPaid and status
    const newAmountPaid = invoice.amountPaid.toNumber() + body.amount;
    const outstanding = calculateOutstanding(invoice.amount.toNumber(), newAmountPaid);

    let newStatus: "ISSUED" | "PAID" | "PARTIALLY_PAID" = "ISSUED";
    if (outstanding === 0) newStatus = "PAID";
    else if (newAmountPaid > 0) newStatus = "PARTIALLY_PAID";

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        amountPaid: newAmountPaid,
        status: newStatus,
      },
    });

    // If invoice is fully paid, calculate membership expiry and create membership period
    if (outstanding === 0) {
      const periodMonths = await getMembershipPeriodMonths();
      const paymentDate = payment.paymentDate;
      const expiryDate = calculateExpiryDate(paymentDate, periodMonths);
      const renewalDate = calculateRenewalDate(expiryDate);

      // Chain the new period onto the previous one so renewals extend the
      // membership instead of restarting it. Historical periods are preserved.
      const previous = await prisma.membershipPeriod.findFirst({
        where: { memberId: invoice.memberId },
        orderBy: { expiryDate: "desc" },
        select: { expiryDate: true },
      });

      const periodStart =
        previous && previous.expiryDate > invoice.member.startDate
          ? previous.expiryDate
          : invoice.member.startDate;

      await prisma.membershipPeriod.create({
        data: {
          memberId: invoice.memberId,
          startDate: periodStart,
          expiryDate,
          paymentDate,
          renewalDate,
          amount: invoice.amount,
        },
      });

      // Update member status and expiry status
      await prisma.member.update({
        where: { id: invoice.memberId },
        data: {
          status: "PAID",
          expiryStatus: "ACTIVE",
        },
      });

      // Mark onboarding stage 2 (Invoice) as completed
      await prisma.onboardingTask.updateMany({
        where: { memberId: invoice.memberId, stage: 2 },
        data: { status: "COMPLETED", completedDate: new Date() },
      });
    }

    await recordAudit({
      userId: user.userId,
      memberId: invoice.memberId,
      action: "RECORD_PAYMENT",
      entity: "Payment",
      entityId: payment.id,
      newValue: { amount: body.amount, invoiceId: invoice.id },
    });

    return jsonOk({ payment }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
