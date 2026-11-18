import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireAuth, apiError, ApiError } from "@/lib/middleware";
import { generateInvoiceNumber } from "@/lib/id-generator";
import { recordAudit } from "@/lib/audit";
import { calculateOutstanding } from "@/lib/business";
import { invoiceSchema } from "@/lib/validation";
import { jsonOk } from "@/lib/serialize";

// GET /api/invoices - List invoices
export async function GET(req: NextRequest) {
  try {
    requirePermission(req, "invoices");
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "";
    const memberId = searchParams.get("memberId") || "";

    const where: any = {};
    if (status) where.status = status;
    if (memberId) where.memberId = memberId;

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        member: { include: { category: true, contacts: { where: { isPrimary: true } } } },
        category: true,
        payments: { orderBy: { paymentDate: "desc" } },
      },
      orderBy: { invoiceDate: "desc" },
    });

    const enriched = invoices.map((inv) => ({
      ...inv,
      outstanding: calculateOutstanding(inv.amount.toNumber(), inv.amountPaid.toNumber()),
    }));

    return jsonOk({ invoices: enriched });
  } catch (error) {
    return apiError(error);
  }
}

// POST /api/invoices - Create a new invoice
export async function POST(req: NextRequest) {
  try {
    const user = requirePermission(req, "invoices");
    const raw = await req.json();

    const parsed = invoiceSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.errors[0]?.message ?? "Invalid invoice data");
    }
    const body = parsed.data;

    const member = await prisma.member.findUnique({
      where: { id: body.memberId },
      select: { id: true },
    });
    if (!member) throw new ApiError(404, "Member not found");

    const invoiceNumber = await generateInvoiceNumber();

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        memberId: body.memberId,
        categoryId: body.categoryId,
        dueDate: new Date(body.dueDate),
        amount: body.amount,
        currency: body.currency || "USD",
        status: "ISSUED",
        notes: body.notes || null,
      },
      include: {
        member: { include: { category: true } },
        category: true,
        payments: true,
      },
    });

    // Update onboarding task stage 2 (Invoice) to IN_PROGRESS
    await prisma.onboardingTask.updateMany({
      where: { memberId: body.memberId, stage: 2, status: "PENDING" },
      data: { status: "IN_PROGRESS" },
    });

    await recordAudit({
      userId: user.userId,
      memberId: body.memberId,
      action: "CREATE_INVOICE",
      entity: "Invoice",
      entityId: invoice.id,
      newValue: { invoiceNumber, amount: invoice.amount },
    });

    return jsonOk({ invoice }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
