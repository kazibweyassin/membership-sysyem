"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, Globe, MapPin, FileText, CreditCard, ClipboardCheck, Bell, RefreshCw, Send, Upload, Download } from "lucide-react";

export default function MemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [member, setMember] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reminder modal
  const [showReminder, setShowReminder] = useState(false);
  const [reminderForm, setReminderForm] = useState({
    reminderType: "PAYMENT_DUE",
    recipientEmail: "",
    subject: "",
    message: "",
  });
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderResult, setReminderResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  const token = () => localStorage.getItem("token") || "";

  function reload() {
    fetch(`/api/members/${params.id}`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          router.push("/members");
          return;
        }
        setMember(data.member);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, router]);

  async function sendReminder(e: React.FormEvent) {
    e.preventDefault();
    setReminderBusy(true);
    setReminderResult(null);

    const res = await fetch("/api/reminders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
      },
      body: JSON.stringify({ memberId: params.id, ...reminderForm }),
    });
    const data = await res.json();
    setReminderBusy(false);

    if (!res.ok) {
      setReminderResult({ ok: false, text: data.error || "Failed to send reminder" });
      return;
    }

    setReminderResult(
      data.emailError
        ? { ok: false, text: `Recorded, but email not delivered: ${data.emailError}` }
        : { ok: true, text: `Reminder sent to ${data.reminder.recipientEmail}` }
    );
    reload();
  }

  async function uploadDocument(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    form.append("memberId", String(params.id));

    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { Authorization: `Bearer ${token()}` },
      body: form,
    });
    const data = await res.json();
    setUploading(false);

    if (!res.ok) {
      alert(data.error || "Upload failed");
      return;
    }
    reload();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  if (!member) return <div>Member not found</div>;

  const primaryContact = member.contacts.find((c: any) => c.isPrimary) || member.contacts[0];
  const completedStages = member.onboardingTasks.filter((t: any) => t.status === "COMPLETED").length;
  const progress = Math.round((completedStages / 6) * 100);
  const latestPeriod = member.membershipPeriods[0];
  const latestReminder = member.reminders[0];

  const statusColors: Record<string, string> = {
    PAID: "bg-green-100 text-green-700",
    UNPAID: "bg-yellow-100 text-yellow-700",
    ONBOARDING: "bg-blue-100 text-blue-700",
    CANCELLED: "bg-gray-100 text-gray-700",
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: null },
    { id: "contacts", label: "Contacts", icon: null },
    { id: "onboarding", label: "Onboarding", icon: ClipboardCheck },
    { id: "invoices", label: "Invoices", icon: FileText },
    { id: "payments", label: "Payments", icon: CreditCard },
    { id: "reminders", label: "Reminders", icon: Bell },
    { id: "renewals", label: "Renewals", icon: RefreshCw },
    { id: "documents", label: "Documents", icon: FileText },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/members" className="text-gray-400 hover:text-gray-600 mt-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{member.companyName}</h1>
          <p className="text-gray-500 mt-1 font-mono text-sm">{member.memberNumber}</p>
        </div>
        <span className={`badge ${statusColors[member.status] || "bg-gray-100 text-gray-700"}`}>
          {member.status}
        </span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500">Category</p>
          <p className="font-semibold mt-1">{member.category.name}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Onboarding Progress</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-brand-500 rounded-full" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-sm font-medium">{progress}%</span>
          </div>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Membership Expiry</p>
          <p className="font-semibold mt-1">
            {latestPeriod ? new Date(latestPeriod.expiryDate).toLocaleDateString() : "N/A"}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Last Reminder</p>
          <p className="font-semibold mt-1">
            {latestReminder ? new Date(latestReminder.reminderDate).toLocaleDateString() : "None"}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-brand-600 text-brand-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="card">
        {activeTab === "overview" && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Company Details</h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-gray-500">Address</p>
                    <p>{member.address || "Not provided"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Globe className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-gray-500">Website</p>
                    {member.website ? (
                      <a href={member.website} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
                        {member.website}
                      </a>
                    ) : (
                      <p>Not provided</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Primary Contact</h3>
              <div className="text-sm">
                <p className="font-medium">{primaryContact?.fullName}</p>
                <p className="text-gray-500">{primaryContact?.jobTitle}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <a href={`mailto:${primaryContact?.email}`} className="text-brand-600 hover:underline">
                    {primaryContact?.email}
                  </a>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <a href={`tel:${primaryContact?.phone}`} className="text-brand-600 hover:underline">
                    {primaryContact?.phone}
                  </a>
                </div>
              </div>
            </div>
            {member.notes && (
              <div>
                <h3 className="font-semibold mb-2">Notes</h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{member.notes}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "contacts" && (
          <div className="space-y-4">
            {member.contacts.map((contact: any) => (
              <div key={contact.id} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <p className="font-medium">{contact.fullName}</p>
                  {contact.isPrimary && <span className="badge bg-brand-100 text-brand-700">Primary</span>}
                </div>
                <p className="text-sm text-gray-500">{contact.jobTitle}</p>
                <div className="flex items-center gap-2 mt-2 text-sm">
                  <Mail className="w-4 h-4 text-gray-400" />
                  {contact.email}
                </div>
                <div className="flex items-center gap-2 mt-1 text-sm">
                  <Phone className="w-4 h-4 text-gray-400" />
                  {contact.phone}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "onboarding" && (
          <div className="space-y-3">
            {member.onboardingTasks.map((task: any) => (
              <div key={task.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  task.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                  task.status === "IN_PROGRESS" ? "bg-yellow-100 text-yellow-700" :
                  "bg-gray-100 text-gray-500"
                }`}>
                  {task.stage}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{task.name}</p>
                  {task.completedDate && (
                    <p className="text-xs text-gray-500">
                      Completed: {new Date(task.completedDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <span className={`badge ${
                  task.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                  task.status === "IN_PROGRESS" ? "bg-yellow-100 text-yellow-700" :
                  "bg-gray-100 text-gray-500"
                }`}>
                  {task.status.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        )}

        {activeTab === "invoices" && (
          <div>
            {member.invoices.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No invoices yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table">
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Date</th>
                      <th>Due Date</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {member.invoices.map((inv: any) => (
                      <tr key={inv.id}>
                        <td className="font-mono text-xs">{inv.invoiceNumber}</td>
                        <td>{new Date(inv.invoiceDate).toLocaleDateString()}</td>
                        <td>{new Date(inv.dueDate).toLocaleDateString()}</td>
                        <td>${inv.amount.toLocaleString()}</td>
                        <td>
                          <span className={`badge ${
                            inv.status === "PAID" ? "bg-green-100 text-green-700" :
                            inv.status === "OVERDUE" ? "bg-red-100 text-red-700" :
                            "bg-yellow-100 text-yellow-700"
                          }`}>
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "payments" && (
          <div>
            {member.invoices.flatMap((inv: any) => inv.payments).length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No payments yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Invoice</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {member.invoices.flatMap((inv: any) =>
                      inv.payments.map((p: any) => (
                        <tr key={p.id}>
                          <td>{new Date(p.paymentDate).toLocaleDateString()}</td>
                          <td className="font-mono text-xs">{inv.invoiceNumber}</td>
                          <td>${p.amount.toLocaleString()}</td>
                          <td>{p.method || "N/A"}</td>
                          <td>{p.reference || "N/A"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "reminders" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">
                Every send is appended to history; the latest date shows on the profile.
              </p>
              <button
                onClick={() => {
                  setReminderResult(null);
                  setReminderForm({
                    reminderType: "PAYMENT_DUE",
                    recipientEmail: primaryContact?.email || member.contacts[0]?.email || "",
                    subject: "",
                    message: "",
                  });
                  setShowReminder(true);
                }}
                className="btn-primary text-sm"
              >
                <Send className="w-4 h-4 mr-1" />
                Send Reminder
              </button>
            </div>

            {member.reminders.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No reminders sent yet</p>
            ) : (
              <div className="space-y-2">
                {member.reminders.map((r: any) => (
                  <div key={r.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{r.subject}</p>
                      <p className="text-xs text-gray-500">
                        {r.recipientEmail} · {r.reminderType.replace(/_/g, " ")} ·{" "}
                        {new Date(r.reminderDate).toLocaleString()}
                      </p>
                      {r.notes && r.deliveryStatus === "FAILED" && (
                        <p className="text-xs text-red-500 mt-1">{r.notes}</p>
                      )}
                    </div>
                    <span className={`badge ${
                      r.deliveryStatus === "SENT" ? "bg-green-100 text-green-700" :
                      r.deliveryStatus === "FAILED" ? "bg-red-100 text-red-700" :
                      "bg-gray-100 text-gray-500"
                    }`}>
                      {r.deliveryStatus}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "renewals" && (
          <div className="space-y-4">
            {member.membershipPeriods.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No membership periods yet</p>
            ) : (
              member.membershipPeriods.map((period: any) => (
                <div key={period.id} className="p-4 border border-gray-200 rounded-lg">
                  <div className="grid md:grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Start Date</p>
                      <p className="font-medium">{new Date(period.startDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Expiry Date</p>
                      <p className="font-medium">{new Date(period.expiryDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Payment Date</p>
                      <p className="font-medium">{period.paymentDate ? new Date(period.paymentDate).toLocaleDateString() : "N/A"}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "documents" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">
                PDF, images, Office documents, text and CSV up to 10 MB.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="btn-primary text-sm disabled:opacity-50"
              >
                <Upload className="w-4 h-4 mr-1" />
                {uploading ? "Uploading..." : "Upload"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadDocument(file);
                  e.target.value = "";
                }}
              />
            </div>

            {member.documents.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">
                No documents uploaded. Attach certificates, signed forms or supporting files here.
              </p>
            ) : (
              <div className="space-y-2">
                {member.documents.map((doc: any) => (
                  <div key={doc.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{doc.name}</p>
                      <p className="text-xs text-gray-500">
                        {(doc.size / 1024).toFixed(1)} KB ·{" "}
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <a
                      href={`/api/documents/${doc.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-600 hover:text-brand-700 p-1"
                      title="Open document"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Send reminder modal */}
      {showReminder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">Send Reminder</h2>

            {reminderResult && (
              <div
                className={`px-4 py-3 rounded-lg text-sm mb-4 ${
                  reminderResult.ok
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-600"
                }`}
              >
                {reminderResult.text}
              </div>
            )}

            <form onSubmit={sendReminder} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reminder type
                </label>
                <select
                  value={reminderForm.reminderType}
                  onChange={(e) =>
                    setReminderForm({ ...reminderForm, reminderType: e.target.value })
                  }
                  className="input"
                >
                  <option value="PAYMENT_DUE">Payment due</option>
                  <option value="PAYMENT_OVERDUE">Payment overdue</option>
                  <option value="MEMBERSHIP_EXPIRY">Membership expiring</option>
                  <option value="RENEWAL">Membership expired / renewal</option>
                  <option value="MANUAL">Manual message</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recipient email
                </label>
                <input
                  type="email"
                  value={reminderForm.recipientEmail}
                  onChange={(e) =>
                    setReminderForm({ ...reminderForm, recipientEmail: e.target.value })
                  }
                  className="input"
                  required
                />
              </div>

              {reminderForm.reminderType === "MANUAL" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={reminderForm.subject}
                      onChange={(e) =>
                        setReminderForm({ ...reminderForm, subject: e.target.value })
                      }
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Message
                    </label>
                    <textarea
                      value={reminderForm.message}
                      onChange={(e) =>
                        setReminderForm({ ...reminderForm, message: e.target.value })
                      }
                      className="input"
                      rows={4}
                    />
                  </div>
                </>
              )}

              {reminderForm.reminderType !== "MANUAL" && (
                <p className="text-xs text-gray-500">
                  The message is built from the member&apos;s latest relevant invoice or
                  membership period using the configured email template.
                </p>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={reminderBusy}
                  className="btn-primary disabled:opacity-50"
                >
                  <Send className="w-4 h-4 mr-1" />
                  {reminderBusy ? "Sending..." : "Send"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowReminder(false)}
                  className="btn-secondary"
                >
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}