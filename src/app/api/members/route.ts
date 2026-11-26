import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireAuth, apiError, ApiError } from "@/lib/middleware";
import { generateInternalId } from "@/lib/id-generator";
import { recordAudit } from "@/lib/audit";
import { ONBOARDING_STAGES } from "@/lib/onboarding";
import { registerSchema } from "@/lib/validation";
import { jsonOk } from "@/lib/serialize";

// GET /api/members - List members with search and filters
export async function GET(req: NextRequest) {
  try {
    requirePermission(req, "members");
    const { searchParams } = new URL(req.url);

    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const status = searchParams.get("status") || "";
    const expiryStatus = searchParams.get("expiryStatus") || "";

    const where: any = {};

    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: "insensitive" } },
        { memberNumber: { contains: search, mode: "insensitive" } },
        { contacts: { some: {
          OR: [
            { fullName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
          ],
        }}},
      ];
    }

    if (category) where.categoryId = category;
    if (status) where.status = status;
    if (expiryStatus) where.expiryStatus = expiryStatus;

    const members = await prisma.member.findMany({
      where,
      include: {
        category: true,
        contacts: true,
        onboardingTasks: { orderBy: { stage: "asc" } },
      },
      orderBy: { registrationDate: "desc" },
    });

    return jsonOk({ members });
  } catch (error) {
    return apiError(error);
  }
}

// POST /api/members - Register a new member
export async function POST(req: NextRequest) {
  try {
    const user = requirePermission(req, "members");
    const raw = await req.json();

    const parsed = registerSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.errors[0]?.message ?? "Invalid member data");
    }
    const body = parsed.data;

    const category = await prisma.membershipCategory.findUnique({
      where: { id: body.categoryId },
      select: { id: true },
    });
    if (!category) throw new ApiError(400, "Unknown membership category");

    // Member numbers are entered manually (existing members keep their numbers)
    const existingNumber = await prisma.member.findUnique({
      where: { memberNumber: body.memberNumber },
      select: { id: true },
    });
    if (existingNumber) throw new ApiError(400, "Member number already in use");

    const internalId = await generateInternalId();

    // Create member with contacts and default onboarding tasks
    const member = await prisma.member.create({
      data: {
        internalId,
        memberNumber: body.memberNumber,
        companyName: body.companyName,
        categoryId: body.categoryId,
        startDate: new Date(body.startDate),
        address: body.address || null,
        website: body.website || null,
        notes: body.notes || null,
        contacts: {
          create: body.contacts.map((c, i) => ({
            fullName: c.fullName,
            jobTitle: c.jobTitle || null,
            phone: c.phone,
            email: c.email,
            isPrimary: c.isPrimary || i === 0,
          })),
        },
        onboardingTasks: {
          create: ONBOARDING_STAGES.map((s) => ({
            stage: s.stage,
            name: s.name,
            status: s.stage === 1 ? "COMPLETED" : "PENDING",
            completedDate: s.stage === 1 ? new Date() : null,
          })),
        },
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
      action: "CREATE",
      entity: "Member",
      entityId: member.id,
      newValue: { companyName: member.companyName, memberNumber: member.memberNumber },
    });

    return jsonOk({ member }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
