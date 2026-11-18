"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, CreditCard } from "lucide-react";

export default function PaymentsPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  const [form, setForm] = useState({
    amount: "",
    paymentDate: new Date().toISOString().split("T")[0],
    method: "",
    reference: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const token = localStorage.getItem("token");
    const [invRes, payRes] = await Promise.all([
      fetch("/api/invoices", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/payments", { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const [invData, payData] = await Promise.all([invRes.json(), payRes.json()]);
    setInvoices(invData.invoices || []);
    setPayments(payData.payments || []);
    setLoading(false);
  }

  function openPaymentModal(invoice: any) {
    setSelectedInvoice(invoice);
    setForm({
      amount: invoice.outstanding.toString(),
      paymentDate: new Date().toISOString().split("T")[0],
      method: "",
      reference: "",
      notes: "",
    });
    setError("");
    setShowModal(true);
  }

  async function handlePayment(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const token = localStorage.getItem("token");
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        invoiceId: selectedInvoice.id,
        amount: parseFloat(form.amount),
        paymentDate: form.paymentDate,
        method: form.method,
        reference: form.reference,
        notes: form.notes,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error || "Failed to record payment");
      return;
    }
    setShowModal(false);
    fetchData();
  }

  const statusColors: Record<string, string> = {
    PAID: "bg-green-100 text-green-700",
    UNPAID: "bg-red-100 text-red-700",
    PARTIALLY_PAID: "bg-yellow-100 text-yellow-700",
    OVERDUE: "bg-red-100 text-red-700",
  };

  const unpaidInvoices = invoices.filter((inv) => inv.outstanding > 0 && inv.status !== "CANCELLED");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
        <p className="text-gray-500 mt-1">Record and track membership payments</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500">Total Collected</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            ${invoices.reduce((sum, inv) => sum + inv.amountPaid, 0).toLocaleString()}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Outstanding</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">
            ${invoices.reduce((sum, inv) => sum + inv.outstanding, 0).toLocaleString()}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Overdue</p>
          <p className="text-2xl font-bold text-red-600 mt-1">
            ${unpaidInvoices.filter((inv) => new Date(inv.dueDate) < new Date()).reduce((sum, inv) => sum + inv.outstanding, 0).toLocaleString()}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Total Invoiced</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            ${invoices.reduce((sum, inv) => sum + inv.amount, 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Unpaid Invoices */}
      <div className="card p-0 overflow-hidden">
        <h2 className="text-lg font-semibold p-4 border-b border-gray-100">Unpaid Invoices</h2>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
          </div>
        ) : unpaidInvoices.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No unpaid invoices</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Member</th>
                  <th>Amount</th>
                  <th>Paid</th>
                  <th>Outstanding</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {unpaidInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="font-mono text-xs">{inv.invoiceNumber}</td>
                    <td>
                      <Link href={`/members/${inv.memberId}`} className="font-medium text-brand-600 hover:underline">
                        {inv.member.companyName}
                      </Link>
                    </td>
                    <td>${inv.amount.toLocaleString()}</td>
                    <td>${inv.amountPaid.toLocaleString()}</td>
                    <td className="font-semibold text-red-600">${inv.outstanding.toLocaleString()}</td>
                    <td>{new Date(inv.dueDate).toLocaleDateString()}</td>
                    <td>
                      <span className={`badge ${statusColors[inv.status] || "bg-gray-100 text-gray-700"}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => openPaymentModal(inv)}
                        className="btn-primary text-sm py-1 px-3"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Record
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment History */}
      <div className="card p-0 overflow-hidden">
        <h2 className="text-lg font-semibold p-4 border-b border-gray-100">Payment History</h2>
        {payments.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No payments recorded</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Invoice</th>
                  <th>Member</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{new Date(p.paymentDate).toLocaleDateString()}</td>
                    <td className="font-mono text-xs">{p.invoice.invoiceNumber}</td>
                    <td>{p.invoice.member.companyName}</td>
                    <td className="font-semibold text-green-600">${p.amount.toLocaleString()}</td>
                    <td>{p.method || "N/A"}</td>
                    <td>{p.reference || "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <h2 className="text-xl font-semibold mb-1">Record Payment</h2>
            <p className="text-sm text-gray-500 mb-4">
              {selectedInvoice.invoiceNumber} - {selectedInvoice.member.companyName}
            </p>
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}
            <form onSubmit={handlePayment} className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <div className="flex justify-between">
                  <span>Invoice Amount:</span>
                  <span className="font-semibold">${selectedInvoice.amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Outstanding:</span>
                  <span className="font-semibold text-red-600">${selectedInvoice.outstanding.toLocaleString()}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  max={selectedInvoice.outstanding}
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date *</label>
                <input
                  type="date"
                  value={form.paymentDate}
                  onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
                <select
                  value={form.method}
                  onChange={(e) => setForm({ ...form, method: e.target.value })}
                  className="input"
                >
                  <option value="">Select method</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Cash">Cash</option>
                  <option value="Check">Check</option>
                  <option value="Online">Online</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                <input
                  type="text"
                  value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                  className="input"
                  placeholder="Transaction reference"
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
                  {submitting ? "Recording..." : "Record Payment"}
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