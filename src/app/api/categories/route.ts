import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireAuth, apiError } from "@/lib/middleware";
import { jsonOk } from "@/lib/serialize";

// GET /api/categories - List all categories
export async function GET(req: NextRequest) {
  try {
    requirePermission(req, "settings");
    const categories = await prisma.membershipCategory.findMany({
      orderBy: { fee: "asc" },
      include: { _count: { select: { members: true, invoices: true } } },
    });
    return jsonOk({ categories });
  } catch (error) {
    return apiError(error);
  }
}

// POST /api/categories - Create a new category
export async function POST(req: NextRequest) {
  try {
    requirePermission(req, "settings");
    const body = await req.json();
    const category = await prisma.membershipCategory.create({
      data: {
        name: body.name,
        fee: body.fee,
        description: body.description || null,
      },
    });
    return jsonOk({ category }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
