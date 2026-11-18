"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  DollarSign,
  FileText,
  CreditCard,
  TrendingUp,
  RefreshCw,
  ClipboardCheck,
} from "lucide-react";

interface DashboardData {
  summary: {
    totalMembers: number;
    paidMembers: number;
    unpaidMembers: number;
    onboardingMembers: number;
    cancelledMembers: number;
    expiredMembers: number;
    expiringSoon: number;
    overdueInvoices: number;
  };
  payments: {
    receivedThisMonth: number;
    outstanding: number;
    overdue: number;
    totalInvoiced: number;
    totalCollected: number;
  };
  categoryOverview: { id: string; name: string; fee: number; memberCount: number }[];
  pendingActions: {
    paymentsDueToday: number;
    overduePayments: number;
    upcomingRenewals: number;
    pendingCertificates: number;
    pendingWhatsApp: number;
    incompleteOnboarding: number;
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch("/api/dashboard", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  if (!data) return <div>Failed to load dashboard</div>;

  const cards = [
    { label: "Total Members", value: data.summary.totalMembers, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Paid Members", value: data.summary.paidMembers, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
    { label: "Unpaid Members", value: data.summary.unpaidMembers, icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50" },
    { label: "Onboarding", value: data.summary.onboardingMembers, icon: ClipboardCheck, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Cancelled", value: data.summary.cancelledMembers, icon: XCircle, color: "text-gray-600", bg: "bg-gray-50" },
    { label: "Expired", value: data.summary.expiredMembers, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
    { label: "Expiring Soon", value: data.summary.expiringSoon, icon: RefreshCw, color: "text-orange-600", bg: "bg-orange-50" },
    { label: "Overdue Invoices", value: data.summary.overdueInvoices, icon: FileText, color: "text-red-600", bg: "bg-red-50" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Membership operations overview</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="card">
            <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="text-sm text-gray-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Payment Overview */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-brand-600" />
            Payment Overview
          </h2>
          <div className="space-y-3">
            <div className="flex justify-items-between justify-between">
              <span className="text-gray-600">Received This Month</span>
              <span className="font-semibold text-green-600">${data.payments.receivedThisMonth.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Outstanding</span>
              <span className="font-semibold text-yellow-600">${data.payments.outstanding.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Overdue</span>
              <span className="font-semibold text-red-600">${data.payments.overdue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Invoiced</span>
              <span className="font-semibold text-gray-900">${data.payments.totalInvoiced.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Collected</span>
              <span className="font-semibold text-gray-900">${data.payments.totalCollected.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Category Overview */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand-600" />
            Membership Categories
          </h2>
          <div className="space-y-3">
            {data.categoryOverview.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between">
                <span className="text-gray-600">{cat.name}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full"
                      style={{
                        width: `${data.summary.totalMembers > 0 ? (cat.memberCount / data.summary.totalMembers) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="font-semibold text-gray-900 w-8 text-right">{cat.memberCount}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pending Actions */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Pending Actions</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <Link href="/payments" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 border border-gray-100">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="font-medium text-sm">Payments Due Today</p>
              <p className="text-lg font-bold">{data.pendingActions.paymentsDueToday}</p>
            </div>
          </Link>
          <Link href="/payments" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 border border-gray-100">
            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="font-medium text-sm">Overdue Payments</p>
              <p className="text-lg font-bold">{data.pendingActions.overduePayments}</p>
            </div>
          </Link>
          <Link href="/renewals" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 border border-gray-100">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-sm">Upcoming Renewals</p>
              <p className="text-lg font-bold">{data.pendingActions.upcomingRenewals}</p>
            </div>
          </Link>
          <Link href="/onboarding" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 border border-gray-100">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="font-medium text-sm">Pending Certificates</p>
              <p className="text-lg font-bold">{data.pendingActions.pendingCertificates}</p>
            </div>
          </Link>
          <Link href="/onboarding" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 border border-gray-100">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-sm">Awaiting WhatsApp</p>
              <p className="text-lg font-bold">{data.pendingActions.pendingWhatsApp}</p>
            </div>
          </Link>
          <Link href="/onboarding" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 border border-gray-100">
            <div className="w-10 h-10 rounded-lg bg-yellow-50 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="font-medium text-sm">Incomplete Onboarding</p>
              <p className="text-lg font-bold">{data.pendingActions.incompleteOnboarding}</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}