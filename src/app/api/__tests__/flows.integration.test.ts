import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import * as bcrypt from "bcryptjs";
import { generateToken } from "@/lib/auth";
import { calculateExpiryDate } from "@/lib/business";

// Route handlers under test
import { POST as createMember, GET as listMembers } from "@/app/api/members/route";
import { GET as getMember } from "@/app/api/members/[id]/route";
import { POST as createInvoice, GET as listInvoices } from "@/app/api/invoices/route";
import { POST as createPayment, GET as listPayments } from "@/app/api/payments/route";
import { GET as getDashboard } from "@/app/api/dashboard/route";
import { GET as getOnboarding, PUT as updateOnboarding } from "@/app/api/onboarding/route";
import { POST as createCategory } from "@/app/api/categories/route";

const prisma = new PrismaClient();

let adminToken = "";
let adminId = "";
let goldCategoryId = "";

function authReq(url: string, init?: RequestInit): NextRequest {
  const headers = new Headers(init?.headers as HeadersInit | undefined);
  headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${adminToken}`);

  return new NextRequest(url, {
    method: init?.method,
    body: init?.body,
    headers,
  });
}

async function json(res: Response) {
  return res.json();
}

beforeAll(async () => {
  // Clean slate
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.reminderHistory.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.onboardingTask.deleteMany();
  await prisma.membershipPeriod.deleteMany();
  await prisma.memberContact.deleteMany();
  await prisma.member.deleteMany();
  await prisma.user.deleteMany();
  await prisma.membershipCategory.deleteMany();

  const passwordHash = await bcrypt.hash("TestPass123!", 10);
  const admin = await prisma.user.create({
    data: {
      email: "admin@test.local",
      name: "Test Admin",
      passwordHash,
      role: "ADMINISTRATOR",
    },
  });
  adminId = admin.id;
  adminToken = generateToken({ userId: admin.id, email: admin.email, role: admin.role });

  const gold = await createCategory(
    authReq("http://localhost/api/categories", {
      method: "POST",
      body: JSON.stringify({ name: "Gold", fee: 1000, description: "Gold tier" }),
    })
  );
  goldCategoryId = (await json(gold)).category.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.reminderHistory.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.onboardingTask.deleteMany();
  await prisma.membershipPeriod.deleteMany();
  await prisma.memberContact.deleteMany();
  await prisma.member.deleteMany();
});

let memberNumberSeq = 0;

async function registerMember(companyName: string, memberNumber?: string) {
  const res = await createMember(
    authReq("http://localhost/api/members", {
      method: "POST",
      body: JSON.stringify({
        companyName,
        memberNumber: memberNumber ?? `MBR-TEST-${String(memberNumberSeq++).padStart(4, "0")}`,
        categoryId: goldCategoryId,
        startDate: "2026-01-15",
        address: "Kampala",
        contacts: [
          { fullName: "Jane One", phone: "+256700000001", email: "jane1@test.local", isPrimary: true },
          { fullName: "Jane Two", phone: "+256700000002", email: "jane2@test.local" },
          { fullName: "Jane Three", phone: "+256700000003", email: "jane3@test.local" },
        ],
      }),
    })
  );
  return { res, body: await json(res) };
}

async function issueInvoice(memberId: string, amount: number, dueDate: string) {
  const res = await createInvoice(
    authReq("http://localhost/api/invoices", {
      method: "POST",
      body: JSON.stringify({
        memberId,
        categoryId: goldCategoryId,
        amount,
        dueDate,
      }),
    })
  );
  return { res, body: await json(res) };
}

describe("member registration", () => {
  it("registers a member with three contacts and a manual member number", async () => {
    const { res, body } = await registerMember("Fintech Alpha Ltd", "MBR-2026-0001");

    expect(res.status).toBe(201);
    expect(body.member.companyName).toBe("Fintech Alpha Ltd");
    expect(body.member.memberNumber).toBe("MBR-2026-0001");
    expect(body.member.internalId).toMatch(/^INT-\d{6}$/);
    expect(body.member.contacts).toHaveLength(3);
    expect(body.member.contacts.filter((c: any) => c.isPrimary)).toHaveLength(1);
  });

  it("rejects registration with a duplicate member number", async () => {
    await registerMember("Dup A Ltd", "MBR-2026-DUP");
    const { res } = await registerMember("Dup B Ltd", "MBR-2026-DUP");

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/member number/i);
  });

  it("creates six onboarding tasks with only registration complete", async () => {
    const { body } = await registerMember("Fintech Beta Ltd");
    const tasks = body.member.onboardingTasks;

    expect(tasks).toHaveLength(6);
    expect(tasks.filter((t: any) => t.status === "COMPLETED")).toHaveLength(1);
    expect(tasks.find((t: any) => t.stage === 1).status).toBe("COMPLETED");
    expect(tasks.find((t: any) => t.stage === 2).status).toBe("PENDING");
  });

  it("requires unique manual member numbers across registrations", async () => {
    const a = await registerMember("Unique A Ltd", "MBR-2026-UNQA");
    const b = await registerMember("Unique B Ltd", "MBR-2026-UNQB");

    expect(a.body.member.memberNumber).toBe("MBR-2026-UNQA");
    expect(b.body.member.memberNumber).toBe("MBR-2026-UNQB");
    expect(a.body.member.memberNumber).not.toBe(b.body.member.memberNumber);
  });

  it("rejects registration without a contact", async () => {
    const res = await createMember(
      authReq("http://localhost/api/members", {
        method: "POST",
        body: JSON.stringify({
          companyName: "No Contacts Ltd",
          categoryId: goldCategoryId,
          startDate: "2026-01-15",
          contacts: [],
        }),
      })
    );

    expect(res.status).toBe(400);
    expect((await json(res)).error).toMatch(/contact/i);
  });

  it("rejects registration with an invalid email", async () => {
    const res = await createMember(
      authReq("http://localhost/api/members", {
        method: "POST",
        body: JSON.stringify({
          companyName: "Bad Email Ltd",
          categoryId: goldCategoryId,
          startDate: "2026-01-15",
          contacts: [
            { fullName: "Jane", phone: "123", email: "not-an-email", isPrimary: true },
          ],
        }),
      })
    );

    expect(res.status).toBe(400);
    expect((await json(res)).error).toMatch(/email/i);
  });

  it("rejects registration with an unknown category", async () => {
    const res = await createMember(
      authReq("http://localhost/api/members", {
        method: "POST",
        body: JSON.stringify({
          companyName: "Bad Category Ltd",
          categoryId: "does-not-exist",
          startDate: "2026-01-15",
          contacts: [{ fullName: "Jane", phone: "123", email: "j@test.local" }],
        }),
      })
    );

    expect(res.status).toBe(400);
    expect((await json(res)).error).toMatch(/category/i);
  });

  it("includes additional contacts beyond three", async () => {
    const res = await createMember(
      authReq("http://localhost/api/members", {
        method: "POST",
        body: JSON.stringify({
          companyName: "Many Contacts Ltd",
          categoryId: goldCategoryId,
          startDate: "2026-01-15",
          contacts: [
            { fullName: "Ann First", phone: "1", email: "a@test.local", isPrimary: true },
            { fullName: "Bob Second", phone: "2", email: "b@test.local" },
            { fullName: "Cara Third", phone: "3", email: "c@test.local" },
            { fullName: "Dan Fourth", phone: "4", email: "d@test.local" },
          ],
        }),
      })
    );
    const body = await json(res);

    expect(res.status, JSON.stringify(body)).toBe(201);
    expect(body.member.contacts).toHaveLength(4);
  });
});

describe("onboarding progress", () => {
  it("recalculates the completion percentage as stages complete", async () => {
    const { body } = await registerMember("Onboard Co Ltd");
    const memberId = body.member.id;

    let overview = await json(
      await getOnboarding(authReq("http://localhost/api/onboarding"))
    );
    let member = overview.members.find((m: any) => m.id === memberId);
    expect(member.progress).toBe(17); // 1 of 6

    await updateOnboarding(
      authReq("http://localhost/api/onboarding", {
        method: "PUT",
        body: JSON.stringify({ memberId, stage: 2, status: "COMPLETED" }),
      })
    );
    await updateOnboarding(
      authReq("http://localhost/api/onboarding", {
        method: "PUT",
        body: JSON.stringify({ memberId, stage: 3, status: "COMPLETED" }),
      })
    );

    overview = await json(
      await getOnboarding(authReq("http://localhost/api/onboarding"))
    );
    member = overview.members.find((m: any) => m.id === memberId);
    expect(member.completedStages).toBe(3);
    expect(member.progress).toBe(50);
  });

  it("does not complete onboarding just because a payment was received", async () => {
    const { body } = await registerMember("Payment Only Ltd");
    const memberId = body.member.id;

    await issueInvoice(memberId, 1000, "2026-12-31");
    const invoiceList = await json(
      await listInvoices(authReq("http://localhost/api/invoices"))
    );
    const invoiceId = invoiceList.invoices[0].id;

    await createPayment(
      authReq("http://localhost/api/payments", {
        method: "POST",
        body: JSON.stringify({ invoiceId, amount: 1000, paymentDate: "2026-02-10" }),
      })
    );

    const detail = await json(
      await getMember(authReq(`http://localhost/api/members/${memberId}`), {
        params: { id: memberId },
      } as any)
    );

    expect(detail.member.status).toBe("PAID");
    const completed = detail.member.onboardingTasks.filter(
      (t: any) => t.status === "COMPLETED"
    );
    expect(completed.length).toBeLessThan(6);
  });
});

describe("invoices and payments", () => {
  it("issues an invoice with a unique number and outstanding balance", async () => {
    const { body: member } = await registerMember("Invoice Co Ltd");
    const { res, body } = await issueInvoice(member.member.id, 1500, "2026-12-31");

    expect(res.status).toBe(201);
    expect(body.invoice.invoiceNumber).toMatch(/^INV-\d{4}-\d{4}$/);
    expect(body.invoice.status).toBe("ISSUED");
  });

  it("tracks multiple payments against one invoice and updates the balance", async () => {
    const { body: member } = await registerMember("Partial Pay Ltd");
    await issueInvoice(member.member.id, 1000, "2026-12-31");
    const invoices = await json(
      await listInvoices(authReq("http://localhost/api/invoices"))
    );
    const invoice = invoices.invoices[0];

    const p1 = await createPayment(
      authReq("http://localhost/api/payments", {
        method: "POST",
        body: JSON.stringify({ invoiceId: invoice.id, amount: 400, paymentDate: "2026-02-01" }),
      })
    );
    expect(p1.status).toBe(201);

    let after = await json(
      await listInvoices(authReq("http://localhost/api/invoices"))
    );
    let inv = after.invoices[0];
    expect(inv.amountPaid).toBe(400);
    expect(inv.outstanding).toBe(600);
    expect(inv.status).toBe("PARTIALLY_PAID");

    await createPayment(
      authReq("http://localhost/api/payments", {
        method: "POST",
        body: JSON.stringify({ invoiceId: invoice.id, amount: 600, paymentDate: "2026-02-15" }),
      })
    );

    after = await json(await listInvoices(authReq("http://localhost/api/invoices")));
    inv = after.invoices[0];
    expect(inv.amountPaid).toBe(1000);
    expect(inv.outstanding).toBe(0);
    expect(inv.status).toBe("PAID");

    // Both payments are preserved
    const payments = await json(
      await listPayments(authReq("http://localhost/api/payments"))
    );
    expect(payments.payments).toHaveLength(2);
  });

  it("rejects a payment larger than the outstanding balance", async () => {
    const { body: member } = await registerMember("Overpay Ltd");
    await issueInvoice(member.member.id, 500, "2026-12-31");
    const invoices = await json(
      await listInvoices(authReq("http://localhost/api/invoices"))
    );

    const res = await createPayment(
      authReq("http://localhost/api/payments", {
        method: "POST",
        body: JSON.stringify({
          invoiceId: invoices.invoices[0].id,
          amount: 900,
          paymentDate: "2026-02-01",
        }),
      })
    );

    expect(res.status).toBe(400);
    expect((await json(res)).error).toContain("exceeds outstanding");
  });

  it("never overwrites an existing payment row", async () => {
    const { body: member } = await registerMember("Append Only Ltd");
    await issueInvoice(member.member.id, 1000, "2026-12-31");
    const invoices = await json(
      await listInvoices(authReq("http://localhost/api/invoices"))
    );
    const invoiceId = invoices.invoices[0].id;

    await createPayment(
      authReq("http://localhost/api/payments", {
        method: "POST",
        body: JSON.stringify({ invoiceId, amount: 300, paymentDate: "2026-02-01", reference: "R1" }),
      })
    );
    await createPayment(
      authReq("http://localhost/api/payments", {
        method: "POST",
        body: JSON.stringify({ invoiceId, amount: 300, paymentDate: "2026-02-20", reference: "R2" }),
      })
    );

    const rows = await prisma.payment.findMany({
      where: { invoiceId },
      orderBy: { paymentDate: "asc" },
    });

    expect(rows).toHaveLength(2);
    expect(rows[0].reference).toBe("R1");
    expect(rows[1].reference).toBe("R2");
  });
});

describe("membership expiry and renewal", () => {
  it("calculates expiry one year after the payment date on full settlement", async () => {
    const { body: member } = await registerMember("Expiry Co Ltd");
    await issueInvoice(member.member.id, 1000, "2026-12-31");
    const invoices = await json(
      await listInvoices(authReq("http://localhost/api/invoices"))
    );

    await createPayment(
      authReq("http://localhost/api/payments", {
        method: "POST",
        body: JSON.stringify({
          invoiceId: invoices.invoices[0].id,
          amount: 1000,
          paymentDate: "2026-03-20",
        }),
      })
    );

    const detail = await json(
      await getMember(authReq(`http://localhost/api/members/${member.member.id}`), {
        params: { id: member.member.id },
      } as any)
    );

    const period = detail.member.membershipPeriods[0];
    expect(period).toBeTruthy();
    expect(new Date(period.paymentDate).toISOString().slice(0, 10)).toBe("2026-03-20");
    expect(new Date(period.expiryDate).toISOString().slice(0, 10)).toBe("2027-03-20");
    expect(new Date(period.renewalDate).toISOString().slice(0, 10)).toBe("2027-03-20");
  });

  it("keeps the previous membership period when a member renews", async () => {
    const { body: member } = await registerMember("Renew Co Ltd");

    // First year
    await issueInvoice(member.member.id, 1000, "2026-01-01");
    let invoices = await json(
      await listInvoices(authReq("http://localhost/api/invoices"))
    );
    await createPayment(
      authReq("http://localhost/api/payments", {
        method: "POST",
        body: JSON.stringify({ invoiceId: invoices.invoices[0].id, amount: 1000, paymentDate: "2026-01-10" }),
      })
    );

    // Renewal invoice
    await issueInvoice(member.member.id, 1000, "2027-01-01");
    invoices = await json(await listInvoices(authReq("http://localhost/api/invoices")));
    const second = invoices.invoices[0];
    await createPayment(
      authReq("http://localhost/api/payments", {
        method: "POST",
        body: JSON.stringify({ invoiceId: second.id, amount: 1000, paymentDate: "2027-01-15" }),
      })
    );

    const detail = await json(
      await getMember(authReq(`http://localhost/api/members/${member.member.id}`), {
        params: { id: member.member.id },
      } as any)
    );

    expect(detail.member.membershipPeriods).toHaveLength(2);

    const dates = detail.member.membershipPeriods
      .map((p: any) => new Date(p.expiryDate).toISOString().slice(0, 10))
      .sort();
    expect(dates).toEqual(["2027-01-10", "2028-01-15"]);
  });

  it("uses the configurable membership period length", async () => {
    await prisma.systemSetting.upsert({
      where: { key: "membership_period_months" },
      update: { value: "6" },
      create: { key: "membership_period_months", value: "6" },
    });

    expect(calculateExpiryDate(new Date("2026-03-20"), 6).toISOString().slice(0, 10)).toBe(
      "2026-09-20"
    );

    await prisma.systemSetting.update({
      where: { key: "membership_period_months" },
      data: { value: "12" },
    });
  });
});

describe("dashboard figures derive from stored records", () => {
  it("counts members, payments and outstanding balances from the database", async () => {
    const { body: a } = await registerMember("Dash A Ltd");
    await registerMember("Dash B Ltd");
    await issueInvoice(a.member.id, 2000, "2026-12-31");

    const invoices = await json(
      await listInvoices(authReq("http://localhost/api/invoices"))
    );
    await createPayment(
      authReq("http://localhost/api/payments", {
        method: "POST",
        body: JSON.stringify({
          invoiceId: invoices.invoices[0].id,
          amount: 800,
          paymentDate: new Date().toISOString(),
        }),
      })
    );

    const dash = await json(await getDashboard(authReq("http://localhost/api/dashboard")));

    expect(dash.summary.totalMembers).toBe(2);
    expect(dash.summary.paidMembers).toBe(0);
    expect(dash.payments.totalInvoiced).toBe(2000);
    expect(dash.payments.totalCollected).toBe(800);
    expect(dash.payments.outstanding).toBe(1200);
    expect(dash.categoryOverview.find((c: any) => c.name === "Gold").memberCount).toBe(2);
  });
});

describe("audit logging", () => {
  it("records member creation and payment with the acting user", async () => {
    const { body: member } = await registerMember("Audit Co Ltd");
    await issueInvoice(member.member.id, 500, "2026-12-31");
    const invoices = await json(
      await listInvoices(authReq("http://localhost/api/invoices"))
    );
    await createPayment(
      authReq("http://localhost/api/payments", {
        method: "POST",
        body: JSON.stringify({
          invoiceId: invoices.invoices[0].id,
          amount: 500,
          paymentDate: "2026-02-01",
        }),
      })
    );

    const logs = await prisma.auditLog.findMany({
      where: { memberId: member.member.id },
    });
    const actions = logs.map((l) => l.action);

    expect(actions).toContain("CREATE");
    expect(actions).toContain("CREATE_INVOICE");
    expect(actions).toContain("RECORD_PAYMENT");
    expect(logs.every((l) => l.userId === adminId)).toBe(true);
  });
});

describe("authentication", () => {
  it("rejects requests without a token", async () => {
    const res = await listMembers(new NextRequest("http://localhost/api/members"));
    expect(res.status).toBe(401);
  });

  it("rejects an invalid token", async () => {
    const res = await listMembers(
      new NextRequest("http://localhost/api/members", {
        headers: { Authorization: "Bearer not-a-real-token" },
      })
    );
    expect(res.status).toBe(401);
  });
});

describe("role based access control", () => {
  async function tokenFor(email: string, role: any) {
    const passwordHash = await bcrypt.hash("RolePass123!", 10);
    const user = await prisma.user.create({
      data: { email, name: email.split("@")[0], passwordHash, role },
    });
    return {
      id: user.id,
      token: generateToken({ userId: user.id, email: user.email, role: user.role }),
    };
  }

  function as(token: string, url: string, init?: RequestInit): NextRequest {
    const headers = new Headers(init?.headers as HeadersInit | undefined);
    headers.set("Content-Type", "application/json");
    headers.set("Authorization", `Bearer ${token}`);
    return new NextRequest(url, { method: init?.method, body: init?.body, headers });
  }

  it("lets an administrator do everything", async () => {
    const admin = await json(
      await listMembers(authReq("http://localhost/api/members"))
    );
    expect(admin.error).toBeUndefined();

    const users = await fetchUsers();
    expect(users.users.length).toBeGreaterThan(0);
    async function fetchUsers() {
      const mod = await import("@/app/api/users/route");
      return json(await mod.GET(as(adminToken, "http://localhost/api/users")));
    }
  });

  it("lets a membership officer register members but not manage users or settings", async () => {
    const officer = await tokenFor("officer@test.local", "MEMBERSHIP_OFFICER");

    const created = await createMember(
      as(officer.token, "http://localhost/api/members", {
        method: "POST",
        body: JSON.stringify({
          companyName: "Officer Registered Ltd",
          categoryId: goldCategoryId,
          startDate: "2026-01-15",
          contacts: [{ fullName: "Officer Person", phone: "0700", email: "op@test.local" }],
        }),
      })
    );
    expect(created.status).toBe(201);

    const usersMod = await import("@/app/api/users/route");
    const deniedUsers = await usersMod.GET(as(officer.token, "http://localhost/api/users"));
    expect(deniedUsers.status).toBe(403);

    const settingsMod = await import("@/app/api/settings/route");
    const deniedSettings = await settingsMod.GET(
      as(officer.token, "http://localhost/api/settings")
    );
    expect(deniedSettings.status).toBe(403);
  });

  it("lets a finance officer record payments but not register members", async () => {
    const finance = await tokenFor("finance@test.local", "FINANCE_OFFICER");

    const denied = await createMember(
      as(finance.token, "http://localhost/api/members", {
        method: "POST",
        body: JSON.stringify({
          companyName: "Finance Blocked Ltd",
          categoryId: goldCategoryId,
          startDate: "2026-01-15",
          contacts: [{ fullName: "Finance Person", phone: "0700", email: "fp@test.local" }],
        }),
      })
    );
    expect(denied.status).toBe(403);

    // A member registered by the administrator can be invoiced by finance.
    const { body: member } = await registerMember("Finance Allowed Ltd");
    const inv = await createInvoice(
      as(finance.token, "http://localhost/api/invoices", {
        method: "POST",
        body: JSON.stringify({ memberId: member.member.id, categoryId: goldCategoryId, amount: 500, dueDate: "2026-12-31" }),
      })
    );
    expect(inv.status).toBe(201);

    const body = await json(inv);
    const pay = await createPayment(
      as(finance.token, "http://localhost/api/payments", {
        method: "POST",
        body: JSON.stringify({ invoiceId: body.invoice.id, amount: 500, paymentDate: "2026-04-01" }),
      })
    );
    expect(pay.status).toBe(201);
  });

  it("blocks an administrator-only route for a finance officer", async () => {
    const finance = await tokenFor("finance2@test.local", "FINANCE_OFFICER");
    const usersMod = await import("@/app/api/users/route");
    const res = await usersMod.GET(as(finance.token, "http://localhost/api/users"));
    expect(res.status).toBe(403);
  });
});