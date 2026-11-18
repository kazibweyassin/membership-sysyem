"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Clock, CheckCircle, AlertCircle } from "lucide-react";

export default function OnboardingPage() {
  const [members, setMembers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetchOnboarding();
  }, []);

  async function fetchOnboarding() {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/onboarding", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setMembers(data.members || []);
    setStats(data.stats || null);
    setLoading(false);
  }

  async function updateTask(memberId: string, stage: number, status: string) {
    const token = localStorage.getItem("token");
    await fetch("/api/onboarding", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ memberId, stage, status }),
    });
    fetchOnboarding();
  }

  const filteredMembers = members.filter((m) => {
    if (!filter) return true;
    const task = m.onboardingTasks.find((t: any) => t.stage === parseInt(filter));
    return task && task.status !== "COMPLETED";
  });

  const statCards = stats ? [
    { label: "Total Onboarding", value: stats.totalOnboarding, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Awaiting Invoice", value: stats.awaitingInvoice, color: "text-yellow-600", bg: "bg-yellow-50" },
    { label: "Awaiting WhatsApp", value: stats.awaitingWhatsApp, color: "text-green-600", bg: "bg-green-50" },
    { label: "Awaiting Certificate", value: stats.awaitingCertificate, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Awaiting Database", value: stats.awaitingDatabase, color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "Fully Onboarded", value: stats.fullyOnboarded, color: "text-green-600", bg: "bg-green-50" },
  ] : [];

  const stages = [
    { stage: 1, name: "Registration" },
    { stage: 2, name: "Invoice" },
    { stage: 3, name: "WhatsApp" },
    { stage: 4, name: "Certificate" },
    { stage: 5, name: "Database" },
    { stage: 6, name: "Completion" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Onboarding</h1>
        <p className="text-gray-500 mt-1">Track new member onboarding progress</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {statCards.map((stat) => (
            <div key={stat.label} className="card">
              <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
                <ClipboardCheck className={`w-5 h-5 ${stat.color}`} />
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-3">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="input w-auto"
        >
          <option value="">All Stages</option>
          {stages.map((s) => (
            <option key={s.stage} value={s.stage}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Members */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No members in onboarding
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Progress</th>
                  {stages.map((s) => (
                    <th key={s.stage} className="text-center">{s.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <Link href={`/members/${member.id}`} className="font-medium text-brand-600 hover:underline">
                        {member.companyName}
                      </Link>
                      <p className="text-xs text-gray-400 font-mono">{member.memberNumber}</p>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500 rounded-full" style={{ width: `${member.progress}%` }} />
                        </div>
                        <span className="text-xs font-medium">{member.progress}%</span>
                      </div>
                    </td>
                    {stages.map((s) => {
                      const task = member.onboardingTasks.find((t: any) => t.stage === s.stage);
                      const isComplete = task?.status === "COMPLETED";
                      const inProgress = task?.status === "IN_PROGRESS";
                      return (
                        <td key={s.stage} className="text-center">
                          <button
                            onClick={() => updateTask(member.id, s.stage, isComplete ? "PENDING" : "COMPLETED")}
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                              isComplete
                                ? "bg-green-100 text-green-600 hover:bg-green-200"
                                : inProgress
                                ? "bg-yellow-100 text-yellow-600 hover:bg-yellow-200"
                                : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                            }`}
                          >
                            {isComplete ? (
                              <CheckCircle className="w-5 h-5" />
                            ) : inProgress ? (
                              <Clock className="w-5 h-5" />
                            ) : (
                              <AlertCircle className="w-5 h-5" />
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}