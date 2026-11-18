import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError } from "@/lib/middleware";
import { jsonOk } from "@/lib/serialize";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true, role: true, active: true },
    });

    if (!user || !user.active) {
      return jsonOk({ error: "User not found" }, { status: 404 });
    }

    return jsonOk({ user });
  } catch (error) {
    return apiError(error);
  }
}
