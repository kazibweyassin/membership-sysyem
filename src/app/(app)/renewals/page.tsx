"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, AlertTriangle, Clock, CheckCircle } from "lucide-react";
import HelpLink from "@/components/help/HelpLink";

export default function RenewalsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("expiring");

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch("/api/renewals", {
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

  if (!data) return <div>Failed to load renewals</div>;

  const tabs = [
    { id: "expiring", label: "Expiring Soon", count: data.expiringSoon.length, icon: Clock, color: "text-orange-600" },
    { id: "expired", label: "Expired", count: data.expired.length, icon: AlertTriangle, color: "text-red-600" },
    { id: "active", label: "Active", count: data.active.length, icon: CheckCircle, color: "text-green-600" },
  ];

  const currentData = tab === "expiring" ? data.expiringSoon : tab === "expired" ? data.expired : data.active;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Renewals</h1>
          <p className="text-gray-500 mt-1">Track membership expiry and renewals</p>
        </div>
        <HelpLink
          section="renewals"
          label="Help on renewals"
          className="w-8 h-8"
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`card text-left transition-all hover:shadow-md ${
              tab === t.id ? "ring-2 ring-brand-500" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
                <t.icon className={`w-5 h-5 ${t.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{t.count}</p>
                <p className="text-sm text-gray-500">{t.label}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {currentData.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No {tab === "expiring" ? "memberships expiring soon" : tab === "expired" ? "expired memberships" : "active memberships"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Category</th>
                  <th>Start Date</th>
                  <th>Expiry Date</th>
                  <th>Renewal Date</th>
                  <th>Days Until Expiry</th>
                </tr>
              </thead>
              <tbody>
                {currentData.map((period: any) => {
                  const daysUntil = Math.ceil((new Date(period.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <tr key={period.id} className="hover:bg-gray-50">
                      <td>
                        <Link href={`/members/${period.memberId}`} className="font-medium text-brand-600 hover:underline">
                          {period.member.companyName}
                        </Link>
                        <p className="text-xs text-gray-400 font-mono">{period.member.memberNumber}</p>
                      </td>
                      <td>{period.member.category.name}</td>
                      <td>{new Date(period.startDate).toLocaleDateString()}</td>
                      <td>{new Date(period.expiryDate).toLocaleDateString()}</td>
                      <td>{new Date(period.renewalDate).toLocaleDateString()}</td>
                      <td>
                        <span className={`badge ${
                          daysUntil < 0 ? "bg-red-100 text-red-700" :
                          daysUntil <= 7 ? "bg-red-100 text-red-700" :
                          daysUntil <= 14 ? "bg-orange-100 text-orange-700" :
                          daysUntil <= 30 ? "bg-yellow-100 text-yellow-700" :
                          "bg-green-100 text-green-700"
                        }`}>
                          {daysUntil < 0 ? `${Math.abs(daysUntil)} days ago` : `${daysUntil} days`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}