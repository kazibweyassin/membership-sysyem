import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireAuth, apiError, ApiError } from "@/lib/middleware";
import { recordAudit } from "@/lib/audit";
import { calculateOutstanding } from "@/lib/business";
import { jsonOk } from "@/lib/serialize";

// GET /api/invoices/[id] - Get a single invoice
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requirePermission(req, "invoices");
    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        member: { include: { category: true, contacts: true } },
        category: true,
        payments: { orderBy: { paymentDate: "desc" }, include: { createdBy: true } },
        documents: true,
      },
    });

    if (!invoice) throw new ApiError(404, "Invoice not found");

    return jsonOk({
      invoice: {
        ...invoice,
        outstanding: calculateOutstanding(invoice.amount.toNumber(), invoice.amountPaid.toNumber()),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

// PUT /api/invoices/[id] - Update an invoice
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = requirePermission(req, "invoices");
    const body = await req.json();

    const existing = await prisma.invoice.findUnique({
      where: { id: params.id },
    });
    if (!existing) throw new ApiError(404, "Invoice not found");

    const invoice = await prisma.invoice.update({
      where: { id: params.id },
      data: {
        ...(body.dueDate && { dueDate: new Date(body.dueDate) }),
        ...(body.amount !== undefined && { amount: body.amount }),
        ...(body.status && { status: body.status }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
      include: { member: true, payments: true },
    });

    await recordAudit({
      userId: user.userId,
      memberId: invoice.memberId,
      action: "UPDATE_INVOICE",
      entity: "Invoice",
      entityId: invoice.id,
      previousValue: { status: existing.status, amount: existing.amount },
      newValue: { status: invoice.status, amount: invoice.amount },
    });

    return jsonOk({ invoice });
  } catch (error) {
    return apiError(error);
  }
}
