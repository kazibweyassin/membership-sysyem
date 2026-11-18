const BASE = process.env.SMOKE_BASE || "http://localhost:3100";

let token = "";
const results = [];

function check(name, condition, detail) {
  results.push({ name, ok: Boolean(condition), detail });
  if (!condition) {
    console.error(`FAIL ${name}`, detail ?? "");
  } else {
    console.log(`ok   ${name}`);
  }
}

async function api(path, { method = "GET", body, auth = true } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, body: json };
}

async function main() {
  // 1. Login
  const login = await api("/api/auth/login", {
    method: "POST",
    auth: false,
    body: { email: "admin@fitspa.ug", password: "ChangeMe123!" },
  });
  check("login with seeded admin", login.status === 200 && login.body.token, login.body);
  token = login.body.token;
  check("login returns administrator role", login.body.user?.role === "ADMINISTRATOR");

  // 2. Unauthenticated access is blocked
  const anon = await api("/api/members", { auth: false });
  check("unauthenticated members list is 401", anon.status === 401, anon.status);

  // 3. Categories
  const cats = await api("/api/categories");
  check("categories seeded", cats.status === 200 && cats.body.categories?.length === 4,
    cats.body.categories?.map((c) => c.name));
  const gold = cats.body.categories.find((c) => c.name === "Gold");

  // 4. Register a member
  const reg = await api("/api/members", {
    method: "POST",
    body: {
      companyName: "Smoke Test Fintech Ltd",
      categoryId: gold.id,
      startDate: "2026-11-01",
      address: "Kampala",
      website: "https://example.com",
      contacts: [
        { fullName: "Alice Mukasa", jobTitle: "CEO", phone: "+256700111222", email: "alice@smoke.local", isPrimary: true },
        { fullName: "Brian Okello", jobTitle: "CFO", phone: "+256700333444", email: "brian@smoke.local" },
        { fullName: "Claire Namu", jobTitle: "Ops", phone: "+256700555666", email: "claire@smoke.local" },
      ],
    },
  });
  check("register member", reg.status === 201, reg.body);
  const member = reg.body.member;
  check("member number generated", /^MBR-\d{4}-\d{4}$/.test(member?.memberNumber ?? ""), member?.memberNumber);
  check("internal id generated", /^INT-\d{6}$/.test(member?.internalId ?? ""), member?.internalId);
  check("three contacts stored", member?.contacts?.length === 3);
  check("six onboarding tasks created", member?.onboardingTasks?.length === 6);
  check("onboarding starts at 17%", Math.round(
    member.onboardingTasks.filter((t) => t.status === "COMPLETED").length / 6 * 100) === 17);

  // 5. Validation rejects a bad payload
  const bad = await api("/api/members", {
    method: "POST",
    body: { companyName: "Bad Ltd", categoryId: gold.id, startDate: "2026-11-01", contacts: [] },
  });
  check("registration without contacts is rejected", bad.status === 400, bad.body);

  // 6. Create invoice
  const inv = await api("/api/invoices", {
    method: "POST",
    body: { memberId: member.id, categoryId: gold.id, amount: 1000, dueDate: "2026-12-15" },
  });
  check("invoice created", inv.status === 201, inv.body);
  const invoice = inv.body.invoice;
  check("invoice number generated", /^INV-\d{4}-\d{4}$/.test(invoice?.invoiceNumber ?? ""), invoice?.invoiceNumber);
  check("invoice marked ISSUED", invoice?.status === "ISSUED");
  check("onboarding invoice stage in progress",
    await (async () => {
      const m = await api(`/api/members/${member.id}`);
      return m.body.member.onboardingTasks.find((t) => t.stage === 2).status === "IN_PROGRESS";
    })());

  // 7. Partial payment
  const p1 = await api("/api/payments", {
    method: "POST",
    body: { invoiceId: invoice.id, amount: 400, paymentDate: "2026-11-10", method: "Bank Transfer", reference: "TT-001" },
  });
  check("partial payment recorded", p1.status === 201, p1.body);

  let invList = await api("/api/invoices");
  let current = invList.body.invoices.find((i) => i.id === invoice.id);
  check("amountPaid is 400", current.amountPaid === 400, current.amountPaid);
  check("outstanding is 600", current.outstanding === 600, current.outstanding);
  check("status PARTIALLY_PAID", current.status === "PARTIALLY_PAID", current.status);
  check("no membership period before full payment",
    await (async () => {
      const m = await api(`/api/members/${member.id}`);
      return m.body.member.membershipPeriods.length === 0;
    })());

  // 8. Overpayment rejected
  const over = await api("/api/payments", {
    method: "POST",
    body: { invoiceId: invoice.id, amount: 900, paymentDate: "2026-11-11" },
  });
  check("overpayment rejected", over.status === 400, over.body);

  // 9. Full payment
  const p2 = await api("/api/payments", {
    method: "POST",
    body: { invoiceId: invoice.id, amount: 600, paymentDate: "2026-11-12", method: "Bank Transfer", reference: "TT-002" },
  });
  check("second payment recorded", p2.status === 201, p2.body);

  invList = await api("/api/invoices");
  current = invList.body.invoices.find((i) => i.id === invoice.id);
  check("invoice fully paid", current.status === "PAID" && current.outstanding === 0, current);

  const payments = await api("/api/payments");
  const mine = payments.body.payments.filter((p) => p.invoice.id === invoice.id);
  check("both payments preserved", mine.length === 2, mine.length);

  // 10. Membership period created with expiry = payment date + 12 months
  const detail = await api(`/api/members/${member.id}`);
  const period = detail.body.member.membershipPeriods[0];
  check("membership period created", Boolean(period));
  check("expiry is one year after payment",
    period?.expiryDate?.slice(0, 10) === "2027-11-12", period?.expiryDate);
  check("renewal date equals expiry",
    period?.renewalDate?.slice(0, 10) === "2027-11-12", period?.renewalDate);
  check("member status PAID", detail.body.member.status === "PAID");

  // 11. Onboarding is not auto-completed by payment
  const completed = detail.body.member.onboardingTasks.filter((t) => t.status === "COMPLETED").length;
  check("onboarding not auto-completed (2 of 6)", completed === 2, completed);

  // 12. Complete remaining onboarding stages
  for (const stage of [3, 4, 5, 6]) {
    await api("/api/onboarding", {
      method: "PUT",
      body: { memberId: member.id, stage, status: "COMPLETED" },
    });
  }
  const ob = await api("/api/onboarding");
  const obMember = ob.body.members.find((m) => m.id === member.id);
  check("onboarding progress 100%", obMember?.progress === 100, obMember?.progress);
  check("fully onboarded counted", ob.body.stats.fullyOnboarded >= 1);

  // 13. Dashboard derived from data
  const dash = await api("/api/dashboard");
  check("dashboard total members >= 1", dash.body.summary?.totalMembers >= 1, dash.body.summary);
  check("dashboard collected >= 1000", dash.body.payments?.totalCollected >= 1000, dash.body.payments);

  // 14. Notifications generated
  const gen = await api("/api/notifications/generate");
  check("notification generation runs", gen.status === 200, gen.body);

  // 15. Renewals endpoint
  const ren = await api("/api/renewals");
  check("renewals lists the new period", ren.status === 200 && ren.body.active?.length >= 1, ren.body.active?.length);

  // 16. Reminder recorded even without SMTP configured
  const rem = await api("/api/reminders", {
    method: "POST",
    body: { memberId: member.id, reminderType: "MANUAL", recipientEmail: "alice@smoke.local", subject: "Smoke check", message: "Hello" },
  });
  check("reminder recorded", rem.status === 201, rem.body.reminder?.deliveryStatus);
  const remList = await api(`/api/reminders?memberId=${member.id}`);
  check("reminder appears in history", remList.body.reminders?.length === 1);

  // 17. Reports: Excel and PDF
  for (const type of ["members", "payments", "overdue", "onboarding", "expiry", "renewals", "categories", "status", "reminders"]) {
    const xlsx = await fetch(`${BASE}/api/reports?type=${type}&format=xlsx`, { headers: { Authorization: `Bearer ${token}` } });
    const ct = xlsx.headers.get("content-type") ?? "";
    check(`xlsx report ${type}`, xlsx.status === 200 && ct.includes("spreadsheetml"), `${xlsx.status} ${ct}`);
  }
  for (const type of ["members", "payments", "onboarding"]) {
    const pdf = await fetch(`${BASE}/api/reports?type=${type}&format=pdf`, { headers: { Authorization: `Bearer ${token}` } });
    const buf = Buffer.from(await pdf.arrayBuffer());
    const isPdf = buf.subarray(0, 5).toString() === "%PDF-";
    check(`pdf report ${type}`, pdf.status === 200 && isPdf, `${pdf.status} ${buf.length}b`);
  }

  // 18. Audit log captured the flow
  const logs = await api("/api/audit-logs?memberId=" + member.id);
  const actions = (logs.body.logs ?? []).map((l) => l.action);
  for (const expected of ["CREATE", "CREATE_INVOICE", "RECORD_PAYMENT", "UPDATE_ONBOARDING", "SEND_REMINDER"]) {
    check(`audit log has ${expected}`, actions.includes(expected), actions);
  }

  // 19. Settings and RBAC surface
  const settings = await api("/api/settings");
  check("settings seeded", settings.status === 200 && settings.body.settings?.length >= 5,
    settings.body.settings?.map((s) => s.key));

  // 20. Document upload + download round trip
  const form = new FormData();
  form.append("memberId", member.id);
  form.append("file", new Blob(["certificate body"], { type: "text/plain" }), "certificate.txt");
  const up = await fetch(`${BASE}/api/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const upBody = await up.json();
  check("document uploaded", up.status === 201, upBody);
  if (upBody.document) {
    const dl = await fetch(`${BASE}/api/documents/${upBody.document.id}`, { headers: { Authorization: `Bearer ${token}` } });
    const text = await dl.text();
    check("document downloads with original content", dl.status === 200 && text === "certificate body", text);

    const anonDl = await fetch(`${BASE}/api/documents/${upBody.document.id}`);
    check("document download requires auth", anonDl.status === 401, anonDl.status);
  }

  // 21. Cron endpoint is guarded
  const cron = await api("/api/cron/run");
  check("cron rejects missing secret", cron.status === 503 || cron.status === 401, cron.status);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log("Failures:");
    for (const f of failed) console.log(` - ${f.name}`, f.detail ?? "");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("smoke test crashed:", err);
  process.exit(1);
});