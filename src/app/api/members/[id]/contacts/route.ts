import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireAuth, apiError, ApiError } from "@/lib/middleware";
import { recordAudit } from "@/lib/audit";
import { jsonOk } from "@/lib/serialize";

// POST /api/members/[id]/contacts - Add a contact to a member
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = requirePermission(req, "members");
    const body = await req.json();

    const member = await prisma.member.findUnique({
      where: { id: params.id },
    });
    if (!member) throw new ApiError(404, "Member not found");

    const contact = await prisma.memberContact.create({
      data: {
        memberId: params.id,
        fullName: body.fullName,
        jobTitle: body.jobTitle || null,
        phone: body.phone,
        email: body.email,
        isPrimary: body.isPrimary || false,
      },
    });

    await recordAudit({
      userId: user.userId,
      memberId: params.id,
      action: "ADD_CONTACT",
      entity: "MemberContact",
      entityId: contact.id,
      newValue: { fullName: contact.fullName, email: contact.email },
    });

    return jsonOk({ contact }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
