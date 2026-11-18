"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import HelpLink from "@/components/help/HelpLink";

interface ReportDef {
  id: string;
  name: string;
  description: string;
  filters: ("category" | "status")[];
}

const reports: ReportDef[] = [
  { id: "members", name: "Complete Membership Register", description: "Every member with category, contacts, expiry and onboarding progress", filters: ["category", "status"] },
  { id: "categories", name: "Members by Category", description: "Bronze / Silver / Gold / Platinum counts, fees and status split", filters: [] },
  { id: "status", name: "Paid and Unpaid Members", description: "Membership status and expiry status for all members", filters: [] },
  { id: "overdue", name: "Overdue Invoices", description: "Outstanding balances with months past due and last reminder", filters: ["category"] },
  { id: "payments", name: "Payment Collection Report", description: "Invoiced, paid, outstanding and payment counts per invoice", filters: ["category", "status"] },
  { id: "expiry", name: "Membership Expiry Report", description: "Current expiry date and days remaining per member", filters: ["category"] },
  { id: "renewals", name: "Annual Renewal Report", description: "Membership periods, renewal dates, fees and payment dates", filters: ["category"] },
  { id: "onboarding", name: "Onboarding Progress Report", description: "Stage-by-stage completion grid for every member", filters: ["category"] },
  { id: "cancelled", name: "Cancelled Memberships", description: "Members with a cancelled status and their last update", filters: [] },
  { id: "reminders", name: "Reminder History", description: "Every reminder sent, recipient, type and delivery status", filters: ["category"] },
];

export default function ReportsPage() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [filters, setFilters] = useState<Record<string, { category: string; status: string }>>({});

  // Load categories once
  useState(() => {
    const token = localStorage.getItem("token");
    if (token) {
      fetch("/api/categories", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((d) => setCategories(d.categories ?? []));
    }
    return null;
  });

  async function downloadReport(type: string, format: "xlsx" | "pdf") {
    const key = `${type}-${format}`;
    setDownloading(key);
    const token = localStorage.getItem("token");
    const params = new URLSearchParams({ type, format });
    const f = filters[type];
    if (f?.category) params.set("category", f.category);
    if (f?.status) params.set("status", f.status);

    try {
      const res = await fetch(`/api/reports?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Report failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}-report.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message ?? "Failed to download report");
    } finally {
      setDownloading(null);
    }
  }

  function setFilter(reportId: string, field: "category" | "status", value: string) {
    setFilters((prev) => {
      const current = prev[reportId] ?? { category: "", status: "" };
      return { ...prev, [reportId]: { ...current, [field]: value } };
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500 mt-1">
            All figures are derived live from the database. Export to Excel or PDF.
          </p>
        </div>
        <HelpLink
          section="reports"
          label="Help on reports"
          className="w-8 h-8"
        />
      </div>

      <div className="space-y-4">
        {reports.map((report) => (
          <div key={report.id} className="card">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-sm">{report.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{report.description}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {report.filters.includes("category") && (
                  <select
                    value={filters[report.id]?.category ?? ""}
                    onChange={(e) => setFilter(report.id, "category", e.target.value)}
                    className="input w-auto text-sm py-1.5"
                  >
                    <option value="">All categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
                {report.filters.includes("status") && (
                  <select
                    value={filters[report.id]?.status ?? ""}
                    onChange={(e) => setFilter(report.id, "status", e.target.value)}
                    className="input w-auto text-sm py-1.5"
                  >
                    <option value="">All statuses</option>
                    <option value="PAID">Paid</option>
                    <option value="UNPAID">Unpaid</option>
                    <option value="ONBOARDING">Onboarding</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                )}

                <button
                  onClick={() => downloadReport(report.id, "xlsx")}
                  disabled={downloading === `${report.id}-xlsx`}
                  className="btn-primary text-sm py-1.5 disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-1" />
                  {downloading === `${report.id}-xlsx` ? "..." : "Excel"}
                </button>
                <button
                  onClick={() => downloadReport(report.id, "pdf")}
                  disabled={downloading === `${report.id}-pdf`}
                  className="btn-secondary text-sm py-1.5 disabled:opacity-50"
                >
                  <FileText className="w-4 h-4 mr-1" />
                  {downloading === `${report.id}-pdf` ? "..." : "PDF"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}