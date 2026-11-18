import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError } from "@/lib/middleware";
import { jsonOk } from "@/lib/serialize";

// GET /api/notifications - Get notifications for a user
export async function GET(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const notifications = await prisma.notification.findMany({
      where: {
        OR: [{ userId: user.userId }, { userId: null }],
        dismissed: false,
      },
      include: { member: true, user: true },
      orderBy: { createdAt: "desc" },
    });

    return jsonOk({ notifications });
  } catch (error) {
    return apiError(error);
  }
}

// POST /api/notifications - Create a notification
export async function POST(req: NextRequest) {
  try {
    requireAuth(req);
    const body = await req.json();

    const notification = await prisma.notification.create({
      data: {
        userId: body.userId || null,
        memberId: body.memberId || null,
        type: body.type,
        title: body.title,
        message: body.message,
      },
    });

    return jsonOk({ notification }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

// PUT /api/notifications - Mark notification as read or dismiss
export async function PUT(req: NextRequest) {
  try {
    requireAuth(req);
    const body = await req.json();

    const notification = await prisma.notification.update({
      where: { id: body.id },
      data: {
        ...(body.read !== undefined && { read: body.read }),
        ...(body.dismissed !== undefined && { dismissed: body.dismissed }),
      },
    });

    return jsonOk({ notification });
  } catch (error) {
    return apiError(error);
  }
}
