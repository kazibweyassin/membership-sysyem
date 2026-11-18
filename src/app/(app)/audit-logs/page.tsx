"use client";

import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState("");

  useEffect(() => {
    fetchLogs();
  }, [entityFilter]);

  async function fetchLogs() {
    const token = localStorage.getItem("token");
    const params = new URLSearchParams();
    if (entityFilter) params.set("entity", entityFilter);
    const res = await fetch(`/api/audit-logs?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setLogs(data.logs || []);
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <p className="text-gray-500 mt-1">System activity and change history</p>
      </div>

      <div className="flex gap-3">
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="input w-auto"
        >
          <option value="">All Entities</option>
          <option value="Member">Member</option>
          <option value="Invoice">Invoice</option>
          <option value="Payment">Payment</option>
          <option value="User">User</option>
          <option value="OnboardingTask">Onboarding</option>
          <option value="ReminderHistory">Reminder</option>
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No audit logs found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table">
              <thead>
                <tr>
                  <th>Date/Time</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="text-xs">{new Date(log.createdAt).toLocaleString()}</td>
                    <td>{log.user?.name || log.user?.email || "System"}</td>
                    <td>
                      <span className="badge bg-brand-100 text-brand-700">{log.action}</span>
                    </td>
                    <td>{log.entity}</td>
                    <td className="text-xs text-gray-500 max-w-xs truncate">
                      {log.newValue ? JSON.stringify(log.newValue) : "-"}
                    </td>
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