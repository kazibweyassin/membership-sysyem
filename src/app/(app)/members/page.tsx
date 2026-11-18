"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Filter, UserPlus } from "lucide-react";

interface Member {
  id: string;
  memberNumber: string;
  companyName: string;
  status: string;
  expiryStatus: string;
  registrationDate: string;
  category: { name: string };
  contacts: { fullName: string; email: string; phone: string; isPrimary: boolean }[];
  onboardingTasks: { stage: number; status: string }[];
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [search, categoryFilter, statusFilter]);

  async function fetchCategories() {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/categories", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setCategories(data.categories || []);
  }

  async function fetchMembers() {
    setLoading(true);
    const token = localStorage.getItem("token");
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (categoryFilter) params.set("category", categoryFilter);
    if (statusFilter) params.set("status", statusFilter);

    const res = await fetch(`/api/members?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setMembers(data.members || []);
    setLoading(false);
  }

  function getOnboardingProgress(member: Member): number {
    const completed = member.onboardingTasks.filter((t) => t.status === "COMPLETED").length;
    return Math.round((completed / 6) * 100);
  }

  const statusColors: Record<string, string> = {
    PAID: "bg-green-100 text-green-700",
    UNPAID: "bg-yellow-100 text-yellow-700",
    ONBOARDING: "bg-blue-100 text-blue-700",
    CANCELLED: "bg-gray-100 text-gray-700",
  };

  const expiryColors: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700",
    EXPIRING_SOON: "bg-orange-100 text-orange-700",
    EXPIRED: "bg-red-100 text-red-700",
    RENEWAL_DUE: "bg-yellow-100 text-yellow-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Members</h1>
          <p className="text-gray-500 mt-1">Member directory</p>
        </div>
        <Link href="/members/new" className="btn-primary">
          <UserPlus className="w-4 h-4 mr-2" />
          Register Member
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="input w-auto"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input w-auto"
        >
          <option value="">All Statuses</option>
          <option value="PAID">Paid</option>
          <option value="UNPAID">Unpaid</option>
          <option value="ONBOARDING">Onboarding</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No members found. Register your first member to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table">
              <thead>
                <tr>
                  <th>Member #</th>
                  <th>Company</th>
                  <th>Category</th>
                  <th>Primary Contact</th>
                  <th>Status</th>
                  <th>Expiry</th>
                  <th>Onboarding</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const primaryContact = member.contacts.find((c) => c.isPrimary) || member.contacts[0];
                  return (
                    <tr key={member.id} className="hover:bg-gray-50 cursor-pointer">
                      <td className="font-mono text-xs">{member.memberNumber}</td>
                      <td>
                        <Link href={`/members/${member.id}`} className="font-medium text-brand-600 hover:underline">
                          {member.companyName}
                        </Link>
                      </td>
                      <td>{member.category.name}</td>
                      <td>
                        <div className="text-sm">
                          <div>{primaryContact?.fullName}</div>
                          <div className="text-gray-400 text-xs">{primaryContact?.email}</div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${statusColors[member.status] || "bg-gray-100 text-gray-700"}`}>
                          {member.status}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${expiryColors[member.expiryStatus] || "bg-gray-100 text-gray-700"}`}>
                          {member.expiryStatus.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand-500 rounded-full"
                              style={{ width: `${getOnboardingProgress(member)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">
                            {getOnboardingProgress(member)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-sm text-gray-500">
        Showing {members.length} member{members.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}