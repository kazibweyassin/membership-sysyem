import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireAuth, apiError, ApiError } from "@/lib/middleware";
import { recordAudit } from "@/lib/audit";
import { calculateOnboardingProgress } from "@/lib/business";
import { jsonOk } from "@/lib/serialize";

// GET /api/members/[id] - Get a single member
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requirePermission(req, "members");
    const member = await prisma.member.findUnique({
      where: { id: params.id },
      include: {
        category: true,
        contacts: { orderBy: { isPrimary: "desc" } },
        onboardingTasks: { orderBy: { stage: "asc" } },
        membershipPeriods: { orderBy: { startDate: "desc" } },
        invoices: { orderBy: { invoiceDate: "desc" }, include: { payments: true } },
        reminders: { orderBy: { reminderDate: "desc" } },
        documents: true,
      },
    });

    if (!member) throw new ApiError(404, "Member not found");
    return jsonOk({ member });
  } catch (error) {
    return apiError(error);
  }
}

// PUT /api/members/[id] - Update a member
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = requirePermission(req, "members");
    const body = await req.json();

    const existing = await prisma.member.findUnique({
      where: { id: params.id },
    });
    if (!existing) throw new ApiError(404, "Member not found");

    const member = await prisma.member.update({
      where: { id: params.id },
      data: {
        ...(body.companyName && { companyName: body.companyName }),
        ...(body.categoryId && { categoryId: body.categoryId }),
        ...(body.startDate && { startDate: new Date(body.startDate) }),
        ...(body.status && { status: body.status }),
        ...(body.address !== undefined && { address: body.address }),
        ...(body.website !== undefined && { website: body.website }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
      include: {
        category: true,
        contacts: true,
        onboardingTasks: { orderBy: { stage: "asc" } },
      },
    });

    await recordAudit({
      userId: user.userId,
      memberId: member.id,
      action: "UPDATE",
      entity: "Member",
      entityId: member.id,
      previousValue: { companyName: existing.companyName, status: existing.status },
      newValue: { companyName: member.companyName, status: member.status },
    });

    return jsonOk({ member });
  } catch (error) {
    return apiError(error);
  }
}

// DELETE /api/members/[id] - Cancel a member (soft delete)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = requirePermission(req, "members");
    const member = await prisma.member.update({
      where: { id: params.id },
      data: { status: "CANCELLED" },
    });

    await recordAudit({
      userId: user.userId,
      memberId: member.id,
      action: "CANCEL",
      entity: "Member",
      entityId: member.id,
    });

    return jsonOk({ member });
  } catch (error) {
    return apiError(error);
  }
}
