"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Rocket,
  Users,
  ClipboardCheck,
  FileText,
  CreditCard,
  RefreshCw,
  Bell,
  BarChart3,
  Settings as SettingsIcon,
  ScrollText,
  HelpCircle,
  AlertTriangle,
  Upload,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import HelpLink from "@/components/help/HelpLink";

const SECTIONS = [
  { id: "getting-started", label: "Getting started", icon: Rocket },
  { id: "roles", label: "Roles and access", icon: ShieldCheck },
  { id: "register", label: "Registering a member", icon: Users },
  { id: "onboarding", label: "Onboarding", icon: ClipboardCheck },
  { id: "invoices", label: "Invoices", icon: FileText },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "renewals", label: "Renewals and expiry", icon: RefreshCw },
  { id: "reminders", label: "Reminders and alerts", icon: Bell },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "documents", label: "Documents", icon: Upload },
  { id: "settings", label: "Settings and users", icon: SettingsIcon },
  { id: "audit", label: "Audit log", icon: ScrollText },
  { id: "statuses", label: "Status reference", icon: BookOpen },
  { id: "troubleshooting", label: "Troubleshooting", icon: AlertTriangle },
];

const MEMBER_STATUSES = [
  ["Onboarding", "The member is still working through the six onboarding stages. This is where every new member starts."],
  ["Paid", "Membership fees are settled for the current period. Set automatically when an invoice is paid in full, or when the final onboarding stage is ticked."],
  ["Unpaid", "The member is registered and no payment has been settled. Historical status, kept so records stay accurate."],
  ["Cancelled", "The membership has been cancelled. The record and all its invoices, payments and history are preserved, never deleted."],
];

const EXPIRY_STATUSES = [
  ["Active", "More than 60 days until the membership expires."],
  ["Renewal due", "Between 31 and 60 days to expiry. Time to start the renewal conversation."],
  ["Expiring soon", "30 days or fewer. Renewal alerts are being sent at 30, 14, 7 and 0 days."],
  ["Expired", "The expiry date has arrived. The membership is still on record for renewal."],
];

const INVOICE_STATUSES = [
  ["Draft", "Created but not yet issued. Payments cannot be recorded against it."],
  ["Issued", "Sent to the member and awaiting payment."],
  ["Partially paid", "Some payment received, a balance remains."],
  ["Paid", "Settled in full."],
  ["Overdue", "Past the due date with a balance outstanding. The nightly job sets this automatically."],
  ["Cancelled", "Void. Payments cannot be recorded against it."],
];

const ONBOARDING_STAGES = [
  ["1", "Registration", "Company and contact details captured. Ticked automatically when you register the member."],
  ["2", "Invoice", "Membership invoice issued. Moves to In progress when you create an invoice, and completes when it is paid in full."],
  ["3", "WhatsApp", "Member added to the relevant WhatsApp group. Tick it yourself once the admin confirms."],
  ["4", "Certificate", "Membership certificate prepared and issued. Attach the certificate PDF as supporting evidence."],
  ["5", "Database", "Member added to the official membership database. Attach a screenshot or confirmation."],
  ["6", "Completion", "All onboarding activities signed off. Final check that nothing is outstanding."],
];

const FAQ = [
  {
    q: "I paid a member's invoice. Why is onboarding still incomplete?",
    a: "By design. Paying settles the money, but the other five onboarding stages are real-world tasks someone has to do — adding the member to WhatsApp, issuing a certificate, entering them into the membership database. The system deliberately does not assume those happened just because cash arrived. Open the Onboarding page and tick them off as they are actually completed.",
  },
  {
    q: "Why won't it let me record a payment larger than the balance?",
    a: "Payments are capped at the outstanding balance on that invoice. Record what was actually received. If a member overpays deliberately, record it against the correct invoice, or issue a credit note outside the system and note the reason in the payment notes.",
  },
  {
    q: "A payment was entered incorrectly. Can I edit or delete it?",
    a: "No. Payment rows are append-only on purpose, so the financial history cannot be quietly rewritten. If a payment was genuinely wrong, the correct approach is a reversing entry: record a negative correction through your accounting process and note it in the payment notes. This protects the audit trail.",
  },
  {
    q: "A member renewed. Why do I now see two expiry dates?",
    a: "That is the renewal history working correctly. Each settled invoice creates a new membership period. The member profile shows the current one, and the Renewals report lists every period the member has ever had. Old periods are never overwritten.",
  },
  {
    q: "Can I cancel a membership?",
    a: "Yes, from the member's profile, and it is reversible in effect: the member is marked Cancelled but nothing is deleted. Invoices, payments, reminders and documents all remain attached. Cancelled memberships still appear in reports.",
  },
  {
    q: "Do reminders send themselves?",
    a: "Only when a scheduler is hitting the cron endpoint. The app registers a daily 07:00 UTC job on Vercel. Reminders cover invoices due today, overdue invoices (one per month of overdue), memberships at 30/14/7/0 days to expiry, and expired memberships. Duplicate reminders for the same member and event on the same day are skipped.",
  },
  {
    q: "A reminder shows as Failed. What happened?",
    a: "Either outgoing email is not configured, or the mail server rejected it. Open the member's Reminders tab for the reason. The reminder is still recorded either way, so the history is complete and you can resend once mail is working.",
  },
  {
    q: "Where do I set the annual membership fee?",
    a: "Settings → Categories. Click Edit on the category and set the fee. This changes what new invoices default to; it does not alter invoices already issued.",
  },
  {
    q: "Can I change how long a membership lasts?",
    a: "Yes. Settings → General → membership period months. The default is 12. Expiry is always calculated from the date the payment was actually received, not from the invoice date.",
  },
  {
    q: "I forgot the administrator password.",
    a: "Set the SEED_ADMIN_PASSWORD environment variable in your host and redeploy; the seed applies it to the administrator account. Remove the variable afterwards so the deploy pipeline does not retain your password.",
  },
  {
    q: "Can I import my existing Excel spreadsheet?",
    a: "Not automatically. Members are added through Register Member or the API. Export the spreadsheet, then register each company — the form takes a couple of minutes per member and gives you clean data with proper onboarding tracking.",
  },
];

export default function HelpPage() {
  const [active, setActive] = useState("getting-started");
  const [showToc, setShowToc] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: [0, 1] }
    );

    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  function jump(id: string) {
    setActive(id);
    setShowToc(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Help &amp; Guide</h1>
          <p className="text-gray-500 mt-1">
            How to run membership operations in this system
          </p>
        </div>
        <button
          onClick={() => setShowToc(!showToc)}
          className="lg:hidden btn-secondary text-sm"
        >
          <BookOpen className="w-4 h-4 mr-1" />
          Contents
        </button>
      </div>

      {/* Mobile contents */}
      {showToc && (
        <div className="lg:hidden card p-2 space-y-1">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => jump(s.id)}
              className={`block w-full text-left px-3 py-2 rounded-lg text-sm ${
                active === s.id
                  ? "bg-brand-50 text-brand-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-8 items-start">
        {/* Desktop TOC */}
        <aside className="hidden lg:block w-56 flex-shrink-0">
          <div className="sticky top-6 space-y-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-3">
              Contents
            </p>
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => jump(s.id)}
                className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  active === s.id
                    ? "bg-brand-50 text-brand-700 font-medium"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <s.icon className="w-4 h-4 flex-shrink-0" />
                {s.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-10 pb-16">
          {/* Getting started */}
          <section id="getting-started" className="card scroll-mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Rocket className="w-5 h-5 text-brand-600" />
                Getting started
              </h2>
              <HelpLink section="getting-started" label="Help on getting started" />
            </div>

            <ol className="space-y-4 text-sm">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-medium text-xs">
                  1
                </span>
                <div>
                  <p className="font-medium text-gray-900">Sign in</p>
                  <p className="text-gray-600 mt-1">
                    Use the email and password issued by your administrator. Your role
                    determines which parts of the system you can see.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-medium text-xs">
                  2
                </span>
                <div>
                  <p className="font-medium text-gray-900">
                    Set your fees before anything else
                  </p>
                  <p className="text-gray-600 mt-1">
                    Go to{" "}
                    <Link href="/settings" className="text-brand-600 hover:underline">
                      Settings → Categories
                    </Link>{" "}
                    and enter the annual fee for Bronze, Silver, Gold and Platinum.
                    Invoices use these amounts. Fees start at zero, so invoices will
                    bill nothing until you set them.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-medium text-xs">
                  3
                </span>
                <div>
                  <p className="font-medium text-gray-900">Register your first member</p>
                  <p className="text-gray-600 mt-1">
                    Use{" "}
                    <Link href="/members/new" className="text-brand-600 hover:underline">
                      Register Member
                    </Link>
                    . You will need the company name, category, start date and at
                    least one contact. Three contacts are created by default; add more
                    if needed.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-medium text-xs">
                  4
                </span>
                <div>
                  <p className="font-medium text-gray-900">Work the cycle</p>
                  <p className="text-gray-600 mt-1">
                    Issue an invoice, record the payment when it arrives, then complete
                    the remaining onboarding stages. Each step is covered below.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-medium text-xs">
                  5
                </span>
                <div>
                  <p className="font-medium text-gray-900">Watch the dashboard</p>
                  <p className="text-gray-600 mt-1">
                    The{" "}
                    <Link href="/dashboard" className="text-brand-600 hover:underline">
                      Dashboard
                    </Link>{" "}
                    shows what needs attention today: payments due, overdue balances,
                    upcoming renewals and incomplete onboarding. Every figure comes
                    from live records.
                  </p>
                </div>
              </li>
            </ol>
          </section>

          {/* Roles */}
          <section id="roles" className="card scroll-mt-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <ShieldCheck className="w-5 h-5 text-brand-600" />
              Roles and access
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              What you can see and do depends on your role. If a page is missing from
              your sidebar, your role does not grant it — ask an administrator.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full table">
                <thead>
                  <tr>
                    <th>Capability</th>
                    <th className="text-center">Administrator</th>
                    <th className="text-center">Membership Officer</th>
                    <th className="text-center">Finance Officer</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Members and directory", true, true, false],
                    ["Onboarding", true, true, false],
                    ["Invoices", true, false, true],
                    ["Payments and reminders", true, false, true],
                    ["Reports and audit log", true, true, true],
                    ["Users, settings, categories", true, false, false],
                  ].map((row) => (
                    <tr key={String(row[0])}>
                      <td className="font-medium text-gray-700">{row[0]}</td>
                      {row.slice(1).map((v, i) => (
                        <td key={i} className="text-center">
                          {v ? (
                            <span className="text-green-600 font-medium">Yes</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Access is enforced on the server, not just hidden in the interface.
              Adding users is done in{" "}
              <Link href="/settings" className="text-brand-600 hover:underline">
                Settings → Users
              </Link>
              .
            </p>
          </section>

          {/* Register */}
          <section id="register" className="card scroll-mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Users className="w-5 h-5 text-brand-600" />
                Registering a member
              </h2>
              <Link href="/members/new" className="btn-primary text-sm py-1.5">
                Register a member
              </Link>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium text-gray-900 mb-1">Company information</p>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  <li>
                    <strong>Member number</strong> is generated automatically, in the
                    form <code className="bg-gray-100 px-1 rounded">MBR-2026-0001</code>.
                    You do not type it.
                  </li>
                  <li>
                    <strong>Internal ID</strong> is also generated, as{" "}
                    <code className="bg-gray-100 px-1 rounded">INT-000001</code>.
                  </li>
                  <li>
                    <strong>Category</strong> determines the fee used for invoices.
                  </li>
                  <li>
                    <strong>Start date</strong> is when the membership begins. Expiry
                    is calculated separately from the payment date.
                  </li>
                </ul>
              </div>

              <div>
                <p className="font-medium text-gray-900 mb-1">Contact persons</p>
                <p className="text-gray-600">
                  Three contact slots are created for you. Each needs a name, phone and
                  email; job title is optional. Tick <strong>Primary contact</strong> on
                  one — reminders are sent to that person first. Use{" "}
                  <strong>Add Contact</strong> for a fourth or fifth person.
                </p>
              </div>

              <div className="bg-brand-50 border border-brand-100 rounded-lg p-4">
                <p className="font-medium text-brand-900 mb-1">What happens next</p>
                <p className="text-sm text-brand-800">
                  The member is created with status <strong>Onboarding</strong> and six
                  onboarding stages. Stage 1 is ticked for you. The member now appears
                  in the directory and on the onboarding board at 17% progress.
                </p>
              </div>

              <p className="text-xs text-gray-500">
                Validation runs on the server. A company name under two characters, an
                invalid email, or a member with no contacts will be rejected with a
                message explaining what to fix.
              </p>
            </div>
          </section>

          {/* Onboarding */}
          <section id="onboarding" className="card scroll-mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-brand-600" />
                Onboarding
              </h2>
              <Link href="/onboarding" className="btn-secondary text-sm py-1.5">
                Open onboarding board
              </Link>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Six stages, each with its own checkbox. Progress is simply the number of
              completed stages out of six — three of six shows 50%.
            </p>

            <div className="space-y-2 mb-5">
              {ONBOARDING_STAGES.map(([num, name, desc]) => (
                <div
                  key={num}
                  className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg"
                >
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-medium text-xs">
                    {num}
                  </span>
                  <div>
                    <p className="font-medium text-sm text-gray-900">{name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm">
              <p className="font-medium text-yellow-900 mb-1">
                Payment does not complete onboarding
              </p>
              <p className="text-yellow-800">
                This is deliberate. Receiving money settles the invoice, but adding the
                member to WhatsApp, issuing the certificate and entering them into the
                membership database are separate real-world tasks. The system will not
                tick those for you.
              </p>
            </div>

            <p className="text-sm text-gray-600 mt-4">
              The onboarding board also lets you filter to only the members stuck at a
              particular stage — for example everyone still awaiting a certificate.
            </p>
          </section>

          {/* Invoices */}
          <section id="invoices" className="card scroll-mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-600" />
                Invoices
              </h2>
              <Link href="/invoices" className="btn-secondary text-sm py-1.5">
                Open invoices
              </Link>
            </div>

            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 mb-4">
              <li>
                Choose <strong>Create Invoice</strong>, then pick the member and
                category.
              </li>
              <li>
                Enter the amount — it defaults to nothing, so type the fee or the
                negotiated amount. Set a payment due date.
              </li>
              <li>
                The invoice number is generated as{" "}
                <code className="bg-gray-100 px-1 rounded">INV-2026-0001</code>.
              </li>
              <li>
                The member&apos;s onboarding stage 2 moves to <em>In progress</em>{" "}
                automatically.
              </li>
            </ol>

            <p className="text-sm text-gray-600 mb-2">
              Invoice statuses move like this:
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs mb-4">
              {["Draft", "Issued", "Partially paid", "Paid"].map((s, i) => (
                <span key={s} className="flex items-center gap-2">
                  <span className="badge bg-gray-100 text-gray-700">{s}</span>
                  {i < 3 && <span className="text-gray-400">→</span>}
                </span>
              ))}
            </div>
            <p className="text-sm text-gray-600">
              An invoice becomes <strong>Overdue</strong> automatically once its due
              date passes with a balance outstanding. You do not set that by hand.
            </p>
          </section>

          {/* Payments */}
          <section id="payments" className="card scroll-mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-brand-600" />
                Payments
              </h2>
              <Link href="/payments" className="btn-secondary text-sm py-1.5">
                Open payments
              </Link>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              The Payments page lists every invoice with a balance. Click{" "}
              <strong>Record</strong> on one to take a payment against it.
            </p>

            <div className="space-y-3 text-sm">
              <div className="border border-gray-200 rounded-lg p-4">
                <p className="font-medium text-gray-900 mb-1">Partial payments</p>
                <p className="text-gray-600">
                  Record what actually arrived. The outstanding balance recalculates,
                  the invoice shows <strong>Partially paid</strong>, and every payment
                  stays in the history below. Take a second payment later for the
                  remainder.
                </p>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <p className="font-medium text-gray-900 mb-1">
                  Settling an invoice in full
                </p>
                <p className="text-gray-600">
                  When the balance reaches zero, several things happen at once: the
                  invoice becomes <strong>Paid</strong>, the member becomes{" "}
                  <strong>Paid</strong>, a membership period is created with expiry set
                  to one year from the payment date, and onboarding stage 2 is ticked.
                </p>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <p className="font-medium text-gray-900 mb-1">
                  Corrections are not deletions
                </p>
                <p className="text-gray-600">
                  Payments cannot be edited or removed. This is deliberate, so the
                  financial record cannot be quietly rewritten. A genuine error is
                  corrected with a reversing entry through your accounting process,
                  noted in the payment notes.
                </p>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <p className="font-medium text-gray-900 mb-1">Overpayment is blocked</p>
                <p className="text-gray-600">
                  You cannot record more than the outstanding balance. The system
                  refuses it with the amount that is actually owed.
                </p>
              </div>
            </div>
          </section>

          {/* Renewals */}
          <section id="renewals" className="card scroll-mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-brand-600" />
                Renewals and expiry
              </h2>
              <Link href="/renewals" className="btn-secondary text-sm py-1.5">
                Open renewals
              </Link>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Membership runs annually. You never type an expiry date — it is
              calculated from the date the payment was <em>received</em>, not the
              invoice date.
            </p>

            <div className="bg-gray-50 rounded-lg p-4 text-sm mb-4">
              <p className="font-medium text-gray-900 mb-1">The calculation</p>
              <code className="text-xs block text-gray-700">
                expiry = payment date + N months (default 12)
                <br />
                renewal date = expiry
              </code>
              <p className="text-xs text-gray-500 mt-2">
                N is configurable in Settings → membership period months.
              </p>
            </div>

            <p className="text-sm text-gray-600 mb-2">
              The Renewals page groups members into three tabs:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 mb-4">
              <li>
                <strong>Expiring soon</strong> — inside 30 days. Act on these.
              </li>
              <li>
                <strong>Expired</strong> — the date has passed and renewal is pending.
              </li>
              <li>
                <strong>Active</strong> — more than 30 days out.
              </li>
            </ul>

            <p className="text-sm text-gray-600 mb-4">
              To renew: issue a new invoice for the new period and record the payment.
              A second membership period is created, chained onto the first so the
              membership extends rather than restarts. Previous periods are kept, so
              the member&apos;s renewal history stays intact.
            </p>

            <p className="text-xs text-gray-500">
              Renewal alerts fire at 30, 14, 7 and 0 days before expiry, plus once
              after expiry. The intervals are configurable in Settings.
            </p>
          </section>

          {/* Reminders */}
          <section id="reminders" className="card scroll-mt-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5 text-brand-600" />
              Reminders and alerts
            </h2>

            <p className="text-sm text-gray-600 mb-4">
              There are two separate things here, and it helps to keep them apart.
            </p>

            <div className="grid md:grid-cols-2 gap-4 mb-5">
              <div className="border border-gray-200 rounded-lg p-4">
                <p className="font-medium text-sm text-gray-900 mb-1">
                  In-app notifications
                </p>
                <p className="text-xs text-gray-600">
                  Alerts inside the system, under Notifications. They appear for
                  invoices reaching their due date, overdue balances, memberships
                  approaching or past expiry, and onboarding that has stalled. You can
                  mark them read or dismiss them; they stay in history.
                </p>
              </div>
              <div className="border border-gray-200 rounded-lg p-4">
                <p className="font-medium text-sm text-gray-900 mb-1">
                  Email reminders
                </p>
                <p className="text-xs text-gray-600">
                  Actual emails to the member. Open a member&apos;s profile, go to the
                  Reminders tab and choose <strong>Send Reminder</strong>. Pick the
                  type, or write a manual message. Every send is recorded with its
                  delivery status.
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-2">
              Reminder types, and when to use them:
            </p>
            <div className="overflow-x-auto mb-4">
              <table className="w-full table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Use it when</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {[
                    ["Payment due", "An invoice is approaching its due date"],
                    ["Payment overdue", "The due date has passed with a balance"],
                    ["Membership expiring", "Renewal is coming up"],
                    ["Expired / renewal", "The membership has lapsed"],
                    ["Manual", "Anything else you want to say"],
                  ].map(([t, u]) => (
                    <tr key={t}>
                      <td className="font-medium whitespace-nowrap text-gray-700">{t}</td>
                      <td className="text-gray-600">{u}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm">
              <p className="font-medium text-blue-900 mb-1">
                The last reminder date
              </p>
              <p className="text-blue-800">
                Updates automatically after a successful send, and shows on the
                member&apos;s profile summary and in the overdue report.
              </p>
            </div>
          </section>

          {/* Reports */}
          <section id="reports" className="card scroll-mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-brand-600" />
                Reports
              </h2>
              <Link href="/reports" className="btn-secondary text-sm py-1.5">
                Open reports
              </Link>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Ten reports, each downloadable as <strong>Excel</strong> or{" "}
              <strong>PDF</strong>. Every figure is computed from the database at the
              moment you download, so there is nothing to refresh or reconcile.
            </p>

            <div className="grid md:grid-cols-2 gap-2 mb-4">
              {[
                ["Membership register", "Every member with contacts, expiry and onboarding"],
                ["Members by category", "Bronze / Silver / Gold / Platinum counts and fees"],
                ["Paid and unpaid", "Status and expiry status for all members"],
                ["Overdue invoices", "Balances with months past due and last reminder"],
                ["Payment collection", "Invoiced, paid, outstanding per invoice"],
                ["Membership expiry", "Current expiry and days remaining"],
                ["Annual renewal", "Every membership period, fee and payment date"],
                ["Onboarding progress", "Stage-by-stage completion grid"],
                ["Cancelled memberships", "Cancelled records and last update"],
                ["Reminder history", "Every reminder, recipient and delivery status"],
              ].map(([name, desc]) => (
                <div
                  key={name}
                  className="flex items-start gap-2 p-2.5 rounded-lg bg-gray-50"
                >
                  <FileText className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{name}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-sm text-gray-600">
              Most reports can be filtered by category and status before you export.
              Excel files open with frozen headers and filters already applied.
            </p>
          </section>

          {/* Documents */}
          <section id="documents" className="card scroll-mt-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <Upload className="w-5 h-5 text-brand-600" />
              Documents
            </h2>

            <p className="text-sm text-gray-600 mb-4">
              Open a member&apos;s profile and go to the Documents tab. Certificates,
              signed forms and supporting evidence live there, attached to the member.
            </p>

            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 mb-4">
              <li>Accepted: PDF, PNG, JPEG, WebP, Word, Excel, text and CSV.</li>
              <li>Maximum 10 MB per file.</li>
              <li>
                Files are stored outside the public web root and can only be opened
                through the system, while signed in.
              </li>
              <li>
                Onboarding stages 4 and 5 ask for a certificate or database
                confirmation — attach the evidence here.
              </li>
            </ul>

            <p className="text-xs text-gray-500">
              If uploads fail, the storage location is not writable. On a
              serverless host, point the storage directory at durable storage.
            </p>
          </section>

          {/* Settings */}
          <section id="settings" className="card scroll-mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-brand-600" />
                Settings and users
              </h2>
              <Link href="/settings" className="btn-secondary text-sm py-1.5">
                Open settings
              </Link>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium text-gray-900 mb-1">Categories</p>
                <p className="text-gray-600">
                  Rename a tier or change its annual fee. Changing a fee affects new
                  invoices only — existing invoices keep the amount they were issued
                  with.
                </p>
              </div>

              <div>
                <p className="font-medium text-gray-900 mb-1">General</p>
                <p className="text-gray-600">
                  Membership length in months (default 12), the renewal alert
                  intervals, and organisation details used on emails and reports.
                </p>
              </div>

              <div>
                <p className="font-medium text-gray-900 mb-1">Users</p>
                <p className="text-gray-600">
                  Add colleagues with the right role. Passwords are stored hashed; they
                  are never readable, and cannot be emailed. Deactivating a user keeps
                  their audit history intact.
                </p>
              </div>

              <div>
                <p className="font-medium text-gray-900 mb-1">Reminders</p>
                <p className="text-gray-600">
                  Reminder intervals and whether automated sending is enabled.
                </p>
              </div>
            </div>
          </section>

          {/* Audit */}
          <section id="audit" className="card scroll-mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <ScrollText className="w-5 h-5 text-brand-600" />
                Audit log
              </h2>
              <Link href="/audit-logs" className="btn-secondary text-sm py-1.5">
                Open audit log
              </Link>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Every significant change is recorded: who did it, what they did, which
              record was affected, and the value before and after.
            </p>

            <p className="text-sm text-gray-600 mb-2">Typical actions you will see:</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                "Member created",
                "Member updated",
                "Membership cancelled",
                "Invoice created",
                "Payment recorded",
                "Onboarding stage updated",
                "Reminder sent",
                "Document uploaded",
                "Category changed",
                "User created",
              ].map((a) => (
                <span key={a} className="badge bg-gray-100 text-gray-600">
                  {a}
                </span>
              ))}
            </div>

            <p className="text-xs text-gray-500">
              The log is append-only. Financial records and membership history are
              never permanently deleted through ordinary administrative actions.
            </p>
          </section>

          {/* Status reference */}
          <section id="statuses" className="card scroll-mt-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <BookOpen className="w-5 h-5 text-brand-600" />
              Status reference
            </h2>

            <div className="space-y-6">
              <div>
                <h3 className="font-medium text-sm text-gray-900 mb-2">
                  Membership status
                </h3>
                <dl className="space-y-2">
                  {MEMBER_STATUSES.map(([name, desc]) => (
                    <div key={name} className="flex gap-3 text-sm">
                      <dt className="w-24 flex-shrink-0">
                        <span className="badge bg-gray-100 text-gray-700">{name}</span>
                      </dt>
                      <dd className="text-gray-600">{desc}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div>
                <h3 className="font-medium text-sm text-gray-900 mb-2">
                  Expiry status
                </h3>
                <dl className="space-y-2">
                  {EXPIRY_STATUSES.map(([name, desc]) => (
                    <div key={name} className="flex gap-3 text-sm">
                      <dt className="w-24 flex-shrink-0">
                        <span className="badge bg-blue-100 text-blue-700">{name}</span>
                      </dt>
                      <dd className="text-gray-600">{desc}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div>
                <h3 className="font-medium text-sm text-gray-900 mb-2">
                  Invoice status
                </h3>
                <dl className="space-y-2">
                  {INVOICE_STATUSES.map(([name, desc]) => (
                    <div key={name} className="flex gap-3 text-sm">
                      <dt className="w-24 flex-shrink-0">
                        <span className="badge bg-gray-100 text-gray-700">{name}</span>
                      </dt>
                      <dd className="text-gray-600">{desc}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div>
                <h3 className="font-medium text-sm text-gray-900 mb-2">
                  Delivery status
                </h3>
                <dl className="space-y-2">
                  {[
                    ["Sent", "The email was accepted by the mail server."],
                    ["Failed", "Email was not delivered. The reason is recorded in the reminder notes."],
                    ["Pending", "Queued but not yet attempted."],
                  ].map(([name, desc]) => (
                    <div key={name} className="flex gap-3 text-sm">
                      <dt className="w-24 flex-shrink-0">
                        <span className="badge bg-gray-100 text-gray-700">{name}</span>
                      </dt>
                      <dd className="text-gray-600">{desc}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </section>

          {/* Troubleshooting */}
          <section id="troubleshooting" className="card scroll-mt-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Troubleshooting
            </h2>

            <div className="space-y-2">
              {FAQ.map((item) => (
                <details
                  key={item.q}
                  className="group border border-gray-200 rounded-lg overflow-hidden"
                >
                  <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer list-none hover:bg-gray-50">
                    <span className="text-sm font-medium text-gray-800 flex items-start gap-2">
                      <HelpCircle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                      {item.q}
                    </span>
                  </summary>
                  <div className="px-4 pb-4 pl-10 text-sm text-gray-600">
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
          </section>

          {/* Support footer */}
          <section className="card bg-brand-50 border-brand-100">
            <div className="flex items-start gap-3">
              <UserCog className="w-5 h-5 text-brand-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-brand-900 mb-1">
                  Still stuck?
                </p>
                <p className="text-brand-800">
                  Your administrator can check the{" "}
                  <Link
                    href="/audit-logs"
                    className="underline font-medium"
                  >
                    audit log
                  </Link>{" "}
                  to see exactly what happened to a record, and can adjust your
                  role in{" "}
                  <Link
                    href="/settings"
                    className="underline font-medium"
                  >
                    Settings
                  </Link>{" "}
                  if a page you need is missing.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}