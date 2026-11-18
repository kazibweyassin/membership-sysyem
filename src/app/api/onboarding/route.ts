import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireAuth, apiError, ApiError } from "@/lib/middleware";
import { recordAudit } from "@/lib/audit";
import { calculateOnboardingProgress } from "@/lib/business";
import { TOTAL_STAGES } from "@/lib/onboarding";
import { jsonOk } from "@/lib/serialize";

// GET /api/onboarding - Get onboarding overview
export async function GET(req: NextRequest) {
  try {
    requirePermission(req, "onboarding");
    const members = await prisma.member.findMany({
      where: { status: { in: ["ONBOARDING", "PAID", "UNPAID"] } },
      include: {
        onboardingTasks: { orderBy: { stage: "asc" } },
        category: true,
        contacts: { where: { isPrimary: true } },
      },
    });

    const enriched = members.map((m) => {
      const completed = m.onboardingTasks.filter(
        (t) => t.status === "COMPLETED"
      ).length;
      return {
        ...m,
        completedStages: completed,
        totalStages: TOTAL_STAGES,
        progress: calculateOnboardingProgress(completed, TOTAL_STAGES),
      };
    });

    // Calculate summary stats
    const stats = {
      totalOnboarding: enriched.length,
      awaitingInvoice: enriched.filter((m) =>
        m.onboardingTasks.find((t) => t.stage === 2)?.status !== "COMPLETED"
      ).length,
      awaitingWhatsApp: enriched.filter((m) =>
        m.onboardingTasks.find((t) => t.stage === 3)?.status !== "COMPLETED"
      ).length,
      awaitingCertificate: enriched.filter((m) =>
        m.onboardingTasks.find((t) => t.stage === 4)?.status !== "COMPLETED"
      ).length,
      awaitingDatabase: enriched.filter((m) =>
        m.onboardingTasks.find((t) => t.stage === 5)?.status !== "COMPLETED"
      ).length,
      fullyOnboarded: enriched.filter((m) => m.progress === 100).length,
    };

    return jsonOk({ members: enriched, stats });
  } catch (error) {
    return apiError(error);
  }
}

// PUT /api/onboarding/[memberId]/[stage] - Update an onboarding task
export async function PUT(req: NextRequest) {
  try {
    const user = requirePermission(req, "onboarding");
    const body = await req.json();
    const { memberId, stage } = body;

    const task = await prisma.onboardingTask.findUnique({
      where: { memberId_stage: { memberId, stage } },
    });

    if (!task) throw new ApiError(404, "Onboarding task not found");

    const updated = await prisma.onboardingTask.update({
      where: { id: task.id },
      data: {
        status: body.status || task.status,
        completedDate:
          body.status === "COMPLETED" ? new Date() : body.completedDate ? new Date(body.completedDate) : task.completedDate,
        responsibleId: body.responsibleId || task.responsibleId,
        notes: body.notes !== undefined ? body.notes : task.notes,
      },
    });

    // Recalculate member's onboarding progress and update status if all complete
    const allTasks = await prisma.onboardingTask.findMany({
      where: { memberId },
    });
    const allCompleted = allTasks.every((t) => t.status === "COMPLETED");

    if (allCompleted) {
      await prisma.member.update({
        where: { id: memberId },
        data: { status: "PAID" },
      });
    }

    await recordAudit({
      userId: user.userId,
      memberId,
      action: "UPDATE_ONBOARDING",
      entity: "OnboardingTask",
      entityId: updated.id,
      newValue: { stage, status: updated.status },
    });

    return jsonOk({ task: updated });
  } catch (error) {
    return apiError(error);
  }
}
