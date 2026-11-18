import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireAuth, apiError, ApiError } from "@/lib/middleware";
import { calculateOutstanding, calculateMonthsPastDue, calculateOnboardingProgress } from "@/lib/business";
import { buildPdfReport } from "@/lib/pdf";
import ExcelJS from "exceljs";

const CURRENCY = () => process.env.ORG_CURRENCY || "UGX";

interface ReportColumn {
  header: string;
  key: string;
  width?: number;
  align?: "left" | "right" | "center";
  excelWidth?: number;
}

interface ReportDefinition {
  title: string;
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
}

/**
 * GET /api/reports?type=<report>&format=xlsx|pdf
 *
 * Supported types:
 *  members      - complete membership register
 *  payments     - payment collection report
 *  overdue      - overdue invoices
 *  onboarding   - onboarding progress
 *  expiry       - membership expiry report
 *  categories   - members by category
 *  status       - paid and unpaid members
 *  cancelled    - cancelled memberships
 *  reminders    - reminder history
 *  renewals     - annual renewal report
 */
export async function GET(req: NextRequest) {
  try {
    requirePermission(req, "reports");
    const { searchParams } = new URL(req.url);
    const reportType = searchParams.get("type") || "members";
    const format = searchParams.get("format") || "xlsx";

    const report = await buildReport(reportType, searchParams);

    if (format === "pdf") {
      const buffer = await buildPdfReport({
        title: report.title,
        subtitle: `${CURRENCY()} · ${report.rows.length} record(s)`,
        columns: report.columns,
        rows: report.rows,
      });
      return new Response(new Uint8Array(buffer) as any, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${reportType}-report.pdf"`,
        },
      });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = process.env.ORG_NAME || "Membership System";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(report.title.slice(0, 31));
    sheet.columns = report.columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.excelWidth ?? Math.max(12, (c.header.length ?? 10) + 2),
    }));

    for (const row of report.rows) {
      sheet.addRow(row);
    }

    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1D4ED8" },
    };
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: report.columns.length },
    };
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    // Right-align numeric columns
    report.columns.forEach((col, i) => {
      if (col.align === "right") {
        sheet.getColumn(i + 1).numFmt = "#,##0.00";
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer as any, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${reportType}-report.xlsx"`,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

async function buildReport(
  reportType: string,
  searchParams: URLSearchParams
): Promise<ReportDefinition> {
  const categoryId = searchParams.get("category") || "";
  const status = searchParams.get("status") || "";

  switch (reportType) {
    case "members":
      return membersReport(categoryId, status);
    case "payments":
      return paymentsReport(categoryId, status);
    case "overdue":
      return overdueReport(categoryId);
    case "onboarding":
      return onboardingReport(categoryId);
    case "expiry":
      return expiryReport(categoryId);
    case "categories":
      return categoriesReport();
    case "status":
      return statusReport();
    case "cancelled":
      return cancelledReport();
    case "reminders":
      return remindersReport(categoryId);
    case "renewals":
      return renewalsReport(categoryId);
    default:
      throw new ApiError(400, `Unknown report type: ${reportType}`);
  }
}

async function membersReport(categoryId: string, status: string): Promise<ReportDefinition> {
  const where: any = {};
  if (categoryId) where.categoryId = categoryId;
  if (status) where.status = status;

  const members = await prisma.member.findMany({
    where,
    include: {
      category: true,
      contacts: { where: { isPrimary: true } },
      membershipPeriods: { orderBy: { startDate: "desc" }, take: 1 },
      onboardingTasks: true,
    },
    orderBy: { companyName: "asc" },
  });

  return {
    title: "Complete Membership Register",
    columns: [
      { header: "Member Number", key: "memberNumber", width: 18, excelWidth: 20 },
      { header: "Company", key: "company", width: 26, excelWidth: 34 },
      { header: "Category", key: "category", width: 12 },
      { header: "Primary Contact", key: "contact", width: 20, excelWidth: 26 },
      { header: "Email", key: "email", width: 24, excelWidth: 32 },
      { header: "Phone", key: "phone", width: 16, excelWidth: 20 },
      { header: "Registered", key: "registered", width: 12 },
      { header: "Expiry", key: "expiry", width: 12 },
      { header: "Status", key: "status", width: 12 },
      { header: "Onboarding", key: "onboarding", width: 12, align: "right" },
    ],
    rows: members.map((m) => ({
      memberNumber: m.memberNumber,
      company: m.companyName,
      category: m.category.name,
      contact: m.contacts[0]?.fullName ?? "-",
      email: m.contacts[0]?.email ?? "-",
      phone: m.contacts[0]?.phone ?? "-",
      registered: m.registrationDate.toLocaleDateString(),
      expiry: m.membershipPeriods[0]?.expiryDate.toLocaleDateString() ?? "-",
      status: m.status,
      onboarding: `${calculateOnboardingProgress(
        m.onboardingTasks.filter((t) => t.status === "COMPLETED").length,
        6
      )}%`,
    })),
  };
}

async function paymentsReport(categoryId: string, status: string): Promise<ReportDefinition> {
  const where: any = {};
  if (status) where.status = status;
  if (categoryId) where.member = { categoryId };

  const invoices = await prisma.invoice.findMany({
    where,
    include: { member: { include: { category: true } }, payments: true },
    orderBy: { dueDate: "asc" },
  });

  return {
    title: "Payment Collection Report",
    columns: [
      { header: "Invoice", key: "invoice", width: 16, excelWidth: 20 },
      { header: "Company", key: "company", width: 24, excelWidth: 30 },
      { header: "Category", key: "category", width: 10 },
      { header: "Issued", key: "issued", width: 11 },
      { header: "Due", key: "due", width: 11 },
      { header: `Invoiced (${CURRENCY()})`, key: "invoiced", width: 14, align: "right" },
      { header: `Paid (${CURRENCY()})`, key: "paid", width: 14, align: "right" },
      { header: `Outstanding (${CURRENCY()})`, key: "outstanding", width: 14, align: "right" },
      { header: "Payments", key: "payments", width: 10, align: "right" },
      { header: "Months Due", key: "months", width: 10, align: "right" },
      { header: "Status", key: "status", width: 14 },
    ],
    rows: invoices.map((inv) => ({
      invoice: inv.invoiceNumber,
      company: inv.member.companyName,
      category: inv.member.category.name,
      issued: inv.invoiceDate.toLocaleDateString(),
      due: inv.dueDate.toLocaleDateString(),
      invoiced: inv.amount.toNumber(),
      paid: inv.amountPaid.toNumber(),
      outstanding: calculateOutstanding(inv.amount.toNumber(), inv.amountPaid.toNumber()),
      payments: inv.payments.length,
      months: calculateMonthsPastDue(inv.dueDate, inv.status === "PAID"),
      status: inv.status,
    })),
  };
}

async function overdueReport(categoryId: string): Promise<ReportDefinition> {
  const now = new Date();
  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
      dueDate: { lt: now },
      ...(categoryId ? { member: { categoryId } } : {}),
    },
    include: { member: { include: { category: true }, }, category: true },
    orderBy: { dueDate: "asc" },
  });

  return {
    title: "Overdue Invoices",
    columns: [
      { header: "Invoice", key: "invoice", width: 16, excelWidth: 20 },
      { header: "Company", key: "company", width: 26, excelWidth: 32 },
      { header: "Member Number", key: "memberNumber", width: 16, excelWidth: 20 },
      { header: `Outstanding (${CURRENCY()})`, key: "outstanding", width: 14, align: "right" },
      { header: "Due", key: "due", width: 11 },
      { header: "Months Past Due", key: "months", width: 12, align: "right" },
      { header: "Last Reminder", key: "reminder", width: 12 },
    ],
    rows: await Promise.all(
      invoices
        .filter((inv) => calculateMonthsPastDue(inv.dueDate, false, now) > 0)
        .map(async (inv) => {
          const lastReminder = await prisma.reminderHistory.findFirst({
            where: { memberId: inv.memberId },
            orderBy: { reminderDate: "desc" },
            select: { reminderDate: true },
          });
          return {
            invoice: inv.invoiceNumber,
            company: inv.member.companyName,
            memberNumber: inv.member.memberNumber,
            outstanding: calculateOutstanding(inv.amount.toNumber(), inv.amountPaid.toNumber()),
            due: inv.dueDate.toLocaleDateString(),
            months: calculateMonthsPastDue(inv.dueDate, false, now),
            reminder: lastReminder?.reminderDate.toLocaleDateString() ?? "-",
          };
        })
    ),
  };
}

async function onboardingReport(categoryId: string): Promise<ReportDefinition> {
  const members = await prisma.member.findMany({
    where: categoryId ? { categoryId } : undefined,
    include: { category: true, onboardingTasks: { orderBy: { stage: "asc" } } },
    orderBy: { companyName: "asc" },
  });

  const stageNames = ["Registration", "Invoice", "WhatsApp", "Certificate", "Database", "Completion"];

  const columns: ReportColumn[] = [
    { header: "Member Number", key: "memberNumber", width: 16, excelWidth: 20 },
    { header: "Company", key: "company", width: 24, excelWidth: 30 },
    ...stageNames.map((n) => ({
      header: n,
      key: `stage${stageNames.indexOf(n) + 1}`,
      width: 11,
      align: "center" as const,
    })),
    { header: "Progress", key: "progress", width: 10, align: "right" },
    { header: "Pending Stages", key: "pending", width: 14 },
    { header: "Status", key: "status", width: 12 },
  ];

  return {
    title: "Onboarding Progress Report",
    columns,
    rows: members.map((m) => {
      const completed = m.onboardingTasks.filter((t) => t.status === "COMPLETED").length;
      const pending = m.onboardingTasks
        .filter((t) => t.status !== "COMPLETED")
        .map((t) => t.name);
      const row: Record<string, string | number> = {
        memberNumber: m.memberNumber,
        company: m.companyName,
        progress: `${calculateOnboardingProgress(completed, 6)}%`,
        pending: pending.join(", ") || "-",
        status: m.status,
      };
      for (let stage = 1; stage <= 6; stage++) {
        const task = m.onboardingTasks.find((t) => t.stage === stage);
        row[`stage${stage}`] =
          task?.status === "COMPLETED" ? "Done" : task?.status === "IN_PROGRESS" ? "In progress" : "Pending";
      }
      return row;
    }),
  };
}

async function expiryReport(categoryId: string): Promise<ReportDefinition> {
  const now = new Date();
  const periods = await prisma.membershipPeriod.findMany({
    where: categoryId ? { member: { categoryId } } : undefined,
    include: { member: { include: { category: true } } },
    orderBy: { expiryDate: "asc" },
  });

  const seen = new Set<string>();

  return {
    title: "Membership Expiry Report",
    columns: [
      { header: "Company", key: "company", width: 26, excelWidth: 32 },
      { header: "Member Number", key: "memberNumber", width: 16, excelWidth: 20 },
      { header: "Category", key: "category", width: 10 },
      { header: "Start", key: "start", width: 11 },
      { header: "Expiry", key: "expiry", width: 11 },
      { header: "Days Remaining", key: "days", width: 12, align: "right" },
      { header: "State", key: "state", width: 14 },
    ],
    rows: periods
      .filter((p) => {
        if (seen.has(p.memberId)) return false;
        seen.add(p.memberId);
        return true;
      })
      .map((p) => {
        const days = Math.ceil((p.expiryDate.getTime() - now.getTime()) / 86400000);
        return {
          company: p.member.companyName,
          memberNumber: p.member.memberNumber,
          category: p.member.category.name,
          start: p.startDate.toLocaleDateString(),
          expiry: p.expiryDate.toLocaleDateString(),
          days,
          state: days < 0 ? "Expired" : days <= 30 ? "Expiring soon" : "Active",
        };
      }),
  };
}

async function categoriesReport(): Promise<ReportDefinition> {
  const categories = await prisma.membershipCategory.findMany({ orderBy: { fee: "desc" } });
  const counts = await prisma.member.groupBy({ by: ["categoryId"], _count: { id: true } });
  const statuses = await prisma.member.groupBy({
    by: ["categoryId", "status"],
    _count: { id: true },
  });

  return {
    title: "Members by Category",
    columns: [
      { header: "Category", key: "name", width: 16 },
      { header: `Annual Fee (${CURRENCY()})`, key: "fee", width: 14, align: "right" },
      { header: "Total Members", key: "total", width: 12, align: "right" },
      { header: "Paid", key: "paid", width: 10, align: "right" },
      { header: "Unpaid", key: "unpaid", width: 10, align: "right" },
      { header: "Onboarding", key: "onboarding", width: 12, align: "right" },
      { header: "Cancelled", key: "cancelled", width: 10, align: "right" },
    ],
    rows: categories.map((c) => {
      const pick = (s: string) =>
        statuses.find((x) => x.categoryId === c.id && x.status === s)?._count.id ?? 0;
      return {
        name: c.name,
        fee: c.fee.toNumber(),
        total: counts.find((x) => x.categoryId === c.id)?._count.id ?? 0,
        paid: pick("PAID"),
        unpaid: pick("UNPAID"),
        onboarding: pick("ONBOARDING"),
        cancelled: pick("CANCELLED"),
      };
    }),
  };
}

async function statusReport(): Promise<ReportDefinition> {
  const members = await prisma.member.findMany({
    include: { category: true, membershipPeriods: { orderBy: { startDate: "desc" }, take: 1 } },
    orderBy: { companyName: "asc" },
  });

  return {
    title: "Paid and Unpaid Members",
    columns: [
      { header: "Member Number", key: "memberNumber", width: 16, excelWidth: 20 },
      { header: "Company", key: "company", width: 26, excelWidth: 32 },
      { header: "Category", key: "category", width: 12 },
      { header: "Status", key: "status", width: 14 },
      { header: "Expiry Status", key: "expiryStatus", width: 14 },
      { header: "Last Payment", key: "payment", width: 12 },
    ],
    rows: members.map((m) => {
      const period = m.membershipPeriods[0];
      return {
        memberNumber: m.memberNumber,
        company: m.companyName,
        category: m.category.name,
        status: m.status,
        expiryStatus: m.expiryStatus.replace(/_/g, " "),
        payment: period?.paymentDate?.toLocaleDateString() ?? "-",
      };
    }),
  };
}

async function cancelledReport(): Promise<ReportDefinition> {
  const members = await prisma.member.findMany({
    where: { status: "CANCELLED" },
    include: { category: true },
    orderBy: { companyName: "asc" },
  });

  return {
    title: "Cancelled Memberships",
    columns: [
      { header: "Member Number", key: "memberNumber", width: 16, excelWidth: 20 },
      { header: "Company", key: "company", width: 26, excelWidth: 32 },
      { header: "Category", key: "category", width: 12 },
      { header: "Registered", key: "registered", width: 12 },
      { header: "Last Updated", key: "updated", width: 12 },
    ],
    rows: members.map((m) => ({
      memberNumber: m.memberNumber,
      company: m.companyName,
      category: m.category.name,
      registered: m.registrationDate.toLocaleDateString(),
      updated: m.updatedAt.toLocaleDateString(),
    })),
  };
}

async function remindersReport(categoryId: string): Promise<ReportDefinition> {
  const reminders = await prisma.reminderHistory.findMany({
    where: categoryId ? { member: { categoryId } } : undefined,
    include: { member: true, responsible: true },
    orderBy: { reminderDate: "desc" },
  });

  return {
    title: "Reminder History",
    columns: [
      { header: "Date", key: "date", width: 11 },
      { header: "Company", key: "company", width: 24, excelWidth: 30 },
      { header: "Recipient", key: "recipient", width: 24, excelWidth: 30 },
      { header: "Type", key: "type", width: 16 },
      { header: "Subject", key: "subject", width: 32, excelWidth: 44 },
      { header: "Delivery", key: "delivery", width: 10 },
      { header: "By", key: "by", width: 18 },
    ],
    rows: reminders.map((r) => ({
      date: r.reminderDate.toLocaleDateString(),
      company: r.member.companyName,
      recipient: r.recipientEmail,
      type: r.reminderType.replace(/_/g, " "),
      subject: r.subject,
      delivery: r.deliveryStatus,
      by: r.responsible?.name ?? "Automation",
    })),
  };
}

async function renewalsReport(categoryId: string): Promise<ReportDefinition> {
  const now = new Date();
  const periods = await prisma.membershipPeriod.findMany({
    where: categoryId ? { member: { categoryId } } : undefined,
    include: {
      member: {
        include: {
          category: true,
          invoices: { orderBy: { invoiceDate: "desc" }, take: 1 },
        },
      },
    },
    orderBy: { renewalDate: "asc" },
  });

  return {
    title: "Annual Renewal Report",
    columns: [
      { header: "Company", key: "company", width: 26, excelWidth: 32 },
      { header: "Member Number", key: "memberNumber", width: 16, excelWidth: 20 },
      { header: "Category", key: "category", width: 10 },
      { header: "Period Start", key: "start", width: 12 },
      { header: "Period Expiry", key: "expiry", width: 12 },
      { header: "Renewal Date", key: "renewal", width: 12 },
      { header: `Fee (${CURRENCY()})`, key: "amount", width: 14, align: "right" },
      { header: "Paid On", key: "payment", width: 12 },
      { header: "Renewal State", key: "state", width: 14 },
    ],
    rows: periods.map((p) => {
      const days = Math.ceil((p.expiryDate.getTime() - now.getTime()) / 86400000);
      return {
        company: p.member.companyName,
        memberNumber: p.member.memberNumber,
        category: p.member.category.name,
        start: p.startDate.toLocaleDateString(),
        expiry: p.expiryDate.toLocaleDateString(),
        renewal: p.renewalDate ? p.renewalDate.toLocaleDateString() : "-",
        amount: p.amount.toNumber(),
        payment: p.paymentDate?.toLocaleDateString() ?? "-",
        state: days < 0 ? "Expired" : days <= 30 ? "Renewal due" : "Active",
      };
    }),
  };
}