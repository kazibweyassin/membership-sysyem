import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireAuth, apiError, ApiError } from "@/lib/middleware";
import { hashPassword } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { Role } from "@prisma/client";
import { jsonOk } from "@/lib/serialize";

// GET /api/users - List all users
export async function GET(req: NextRequest) {
  try {
    requirePermission(req, "users");
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return jsonOk({ users });
  } catch (error) {
    return apiError(error);
  }
}

// POST /api/users - Create a new user
export async function POST(req: NextRequest) {
  try {
    const user = requirePermission(req, "users");
    const body = await req.json();

    const existing = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });
    if (existing) throw new ApiError(400, "User with this email already exists");

    const passwordHash = await hashPassword(body.password);

    const newUser = await prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        name: body.name,
        passwordHash,
        role: body.role as Role,
      },
      select: { id: true, email: true, name: true, role: true, active: true },
    });

    await recordAudit({
      userId: user.userId,
      action: "CREATE_USER",
      entity: "User",
      entityId: newUser.id,
      newValue: { email: newUser.email, role: newUser.role },
    });

    return jsonOk({ user: newUser }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
