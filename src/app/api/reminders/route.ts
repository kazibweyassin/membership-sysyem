import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireAuth, apiError, ApiError } from "@/lib/middleware";
import { recordAudit } from "@/lib/audit";
import { calculateMonthsPastDue } from "@/lib/business";
import { sendEmail, REMINDER_TEMPLATES, isEmailConfigured } from "@/lib/email";
import { jsonOk } from "@/lib/serialize";

const ORG_CURRENCY = () => process.env.ORG_CURRENCY || "UGX";

// GET /api/reminders?memberId=...
export async function GET(req: NextRequest) {
  try {
    requirePermission(req, "payments");
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("memberId") || "";

    const where: any = {};
    if (memberId) where.memberId = memberId;

    const reminders = await prisma.reminderHistory.findMany({
      where,
      include: { member: { include: { category: true } }, responsible: true },
      orderBy: { reminderDate: "desc" },
    });

    return jsonOk({ reminders, emailConfigured: isEmailConfigured() });
  } catch (error) {
    return apiError(error);
  }
}

/**
 * POST /api/reminders
 * Sends a reminder email and records it in reminder history.
 * Never overwrites history: each send creates a new record.
 */
export async function POST(req: NextRequest) {
  try {
    const user = requirePermission(req, "payments");
    const body = await req.json();

    const member = await prisma.member.findUnique({
      where: { id: body.memberId },
      include: { contacts: true, category: true },
    });
    if (!member) throw new ApiError(404, "Member not found");

    const reminderType = body.reminderType || "MANUAL";
    const recipient =
      body.recipientEmail ||
      member.contacts.find((c) => c.isPrimary)?.email ||
      member.contacts[0]?.email;

    if (!recipient) throw new ApiError(400, "No recipient email available");

    // Build the message body
    let subject: string;
    let text: string;
    let html: string;

    if (reminderType === "MANUAL") {
      const tpl = REMINDER_TEMPLATES.MANUAL(
        member.companyName,
        body.subject || "Membership Notice",
        body.message || ""
      );
      subject = tpl.subject;
      text = tpl.text;
      html = tpl.html;
    } else if (reminderType === "PAYMENT_DUE" || reminderType === "PAYMENT_OVERDUE") {
      const invoice = body.invoiceId
        ? await prisma.invoice.findUnique({ where: { id: body.invoiceId } })
        : await prisma.invoice.findFirst({
            where: { memberId: member.id, status: { in: ["ISSUED", "PARTIALLY_PAID"] } },
            orderBy: { dueDate: "desc" },
          });

      if (!invoice) throw new ApiError(400, "No outstanding invoice for member");

      const outstanding = (
        invoice.amount.toNumber() - invoice.amountPaid.toNumber()
      ).toFixed(2);

      if (reminderType === "PAYMENT_DUE") {
        const tpl = REMINDER_TEMPLATES.PAYMENT_DUE(
          member.companyName,
          invoice.invoiceNumber,
          invoice.dueDate.toLocaleDateString(),
          `${ORG_CURRENCY()} ${outstanding}`
        );
        subject = tpl.subject;
        text = tpl.text;
        html = tpl.html;
      } else {
        const months = calculateMonthsPastDue(invoice.dueDate, false);
        const tpl = REMINDER_TEMPLATES.PAYMENT_OVERDUE(
          member.companyName,
          invoice.invoiceNumber,
          `${ORG_CURRENCY()} ${outstanding}`,
          months
        );
        subject = tpl.subject;
        text = tpl.text;
        html = tpl.html;
      }
    } else {
      const tpl = REMINDER_TEMPLATES.RENEWAL(
        member.companyName,
        body.expiryDate
          ? new Date(body.expiryDate).toLocaleDateString()
          : new Date().toLocaleDateString()
      );
      subject = tpl.subject;
      text = tpl.text;
      html = tpl.html;
    }

    // Send
    const result = await sendEmail({ to: recipient, subject, text, html });

    const reminder = await prisma.reminderHistory.create({
      data: {
        memberId: member.id,
        recipientEmail: recipient,
        reminderType: reminderType as any,
        subject,
        deliveryStatus: result.sent ? "SENT" : "FAILED",
        responsibleId: user.userId,
        notes: result.error || body.notes || null,
      },
      include: { member: true, responsible: true },
    });

    await recordAudit({
      userId: user.userId,
      memberId: member.id,
      action: "SEND_REMINDER",
      entity: "ReminderHistory",
      entityId: reminder.id,
      newValue: { type: reminderType, subject, sent: result.sent },
    });

    return jsonOk({ reminder, emailError: result.error ?? null }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
