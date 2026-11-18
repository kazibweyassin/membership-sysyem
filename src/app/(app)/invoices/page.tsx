"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, FileText, Search } from "lucide-react";
import HelpLink from "@/components/help/HelpLink";

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [form, setForm] = useState({
    memberId: "",
    categoryId: "",
    dueDate: "",
    amount: "",
    currency: "USD",
    notes: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchInvoices();
    fetchMembers();
    fetchCategories();
  }, []);

  async function fetchInvoices() {
    const token = localStorage.getItem("token");
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/invoices?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setInvoices(data.invoices || []);
    setLoading(false);
  }

  async function fetchMembers() {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/members", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setMembers(data.members || []);
  }

  async function fetchCategories() {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/categories", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setCategories(data.categories || []);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const token = localStorage.getItem("token");
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...form,
        amount: parseFloat(form.amount),
        dueDate: form.dueDate,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error || "Failed to create invoice");
      return;
    }
    setShowModal(false);
    setForm({ memberId: "", categoryId: "", dueDate: "", amount: "", currency: "USD", notes: "" });
    fetchInvoices();
  }

  const filtered = invoices.filter((inv) =>
    inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
    inv.member.companyName.toLowerCase().includes(search.toLowerCase())
  );

  const statusColors: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-700",
    ISSUED: "bg-blue-100 text-blue-700",
    PARTIALLY_PAID: "bg-yellow-100 text-yellow-700",
    PAID: "bg-green-100 text-green-700",
    OVERDUE: "bg-red-100 text-red-700",
    CANCELLED: "bg-gray-100 text-gray-500",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500 mt-1">Manage membership invoices</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Create Invoice
          </button>
          <HelpLink section="invoices" label="Help on invoices" className="w-8 h-8" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search invoices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input w-auto"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="ISSUED">Issued</option>
          <option value="PARTIALLY_PAID">Partially Paid</option>
          <option value="PAID">Paid</option>
          <option value="OVERDUE">Overdue</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No invoices found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Member</th>
                  <th>Amount</th>
                  <th>Outstanding</th>
                  <th>Due Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="font-mono text-xs">{inv.invoiceNumber}</td>
                    <td>
                      <Link href={`/members/${inv.memberId}`} className="font-medium text-brand-600 hover:underline">
                        {inv.member.companyName}
                      </Link>
                    </td>
                    <td>${inv.amount.toLocaleString()}</td>
                    <td>${inv.outstanding.toLocaleString()}</td>
                    <td>{new Date(inv.dueDate).toLocaleDateString()}</td>
                    <td>
                      <span className={`badge ${statusColors[inv.status] || "bg-gray-100 text-gray-700"}`}>
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

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">Create Invoice</h2>
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Member *</label>
                <select
                  value={form.memberId}
                  onChange={(e) => setForm({ ...form, memberId: e.target.value })}
                  className="input"
                  required
                >
                  <option value="">Select member</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.companyName} ({m.memberNumber})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className="input"
                  required
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="input"
                  rows={2}
                />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
                  {submitting ? "Creating..." : "Create Invoice"}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}