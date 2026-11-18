import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireAuth, apiError, ApiError } from "@/lib/middleware";
import { recordAudit } from "@/lib/audit";
import { jsonOk } from "@/lib/serialize";

// PUT /api/categories/[id] - Rename a category or change its fee
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = requirePermission(req, "settings");
    const body = await req.json();

    const existing = await prisma.membershipCategory.findUnique({
      where: { id: params.id },
    });
    if (!existing) throw new ApiError(404, "Category not found");

    const category = await prisma.membershipCategory.update({
      where: { id: params.id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.fee !== undefined && { fee: body.fee }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.active !== undefined && { active: body.active }),
      },
    });

    await recordAudit({
      userId: user.userId,
      action: "UPDATE_CATEGORY",
      entity: "MembershipCategory",
      entityId: category.id,
      previousValue: { name: existing.name, fee: existing.fee.toNumber() },
      newValue: { name: category.name, fee: category.fee.toNumber() },
    });

    return jsonOk({ category });
  } catch (error) {
    return apiError(error);
  }
}
