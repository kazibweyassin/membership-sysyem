import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireAuth, apiError, ApiError } from "@/lib/middleware";
import { recordAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";
import { Role } from "@prisma/client";
import { jsonOk } from "@/lib/serialize";

// PUT /api/users/[id] - Update a user
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = requirePermission(req, "users");
    const body = await req.json();

    const existing = await prisma.user.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError(404, "User not found");

    const user2 = await prisma.user.update({
      where: { id: params.id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.email && { email: body.email.toLowerCase() }),
        ...(body.role && { role: body.role as Role }),
        ...(body.active !== undefined && { active: body.active }),
        ...(body.password && { passwordHash: await hashPassword(body.password) }),
      },
      select: { id: true, email: true, name: true, role: true, active: true },
    });

    await recordAudit({
      userId: user.userId,
      action: "UPDATE_USER",
      entity: "User",
      entityId: user2.id,
      previousValue: { role: existing.role, active: existing.active },
      newValue: { role: user2.role, active: user2.active },
    });

    return jsonOk({ user: user2 });
  } catch (error) {
    return apiError(error);
  }
}

// DELETE /api/users/[id] - Deactivate a user
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = requirePermission(req, "users");
    const user2 = await prisma.user.update({
      where: { id: params.id },
      data: { active: false },
    });

    await recordAudit({
      userId: user.userId,
      action: "DEACTIVATE_USER",
      entity: "User",
      entityId: user2.id,
    });

    return jsonOk({ user: user2 });
  } catch (error) {
    return apiError(error);
  }
}
