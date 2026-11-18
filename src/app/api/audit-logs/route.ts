import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError } from "@/lib/middleware";
import { jsonOk } from "@/lib/serialize";

// GET /api/audit-logs - List audit logs
export async function GET(req: NextRequest) {
  try {
    requireAuth(req);
    const { searchParams } = new URL(req.url);
    const entity = searchParams.get("entity") || "";
    const memberId = searchParams.get("memberId") || "";

    const where: any = {};
    if (entity) where.entity = entity;
    if (memberId) where.memberId = memberId;

    const logs = await prisma.auditLog.findMany({
      where,
      include: { user: true, member: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return jsonOk({ logs });
  } catch (error) {
    return apiError(error);
  }
}
