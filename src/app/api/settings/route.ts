import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireAuth, apiError } from "@/lib/middleware";
import { jsonOk } from "@/lib/serialize";

// GET /api/settings - Get all settings
export async function GET(req: NextRequest) {
  try {
    requirePermission(req, "settings");
    const settings = await prisma.systemSetting.findMany({
      orderBy: { key: "asc" },
    });
    return jsonOk({ settings });
  } catch (error) {
    return apiError(error);
  }
}

// PUT /api/settings - Update a setting
export async function PUT(req: NextRequest) {
  try {
    requirePermission(req, "settings");
    const body = await req.json();

    const setting = await prisma.systemSetting.upsert({
      where: { key: body.key },
      update: { value: body.value, description: body.description },
      create: {
        key: body.key,
        value: body.value,
        description: body.description || null,
      },
    });

    return jsonOk({ setting });
  } catch (error) {
    return apiError(error);
  }
}
