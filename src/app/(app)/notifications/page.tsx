"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Check, X } from "lucide-react";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("unread");

  useEffect(() => {
    fetchNotifications();
  }, []);

  async function fetchNotifications() {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/notifications", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setNotifications(data.notifications || []);
    setLoading(false);
  }

  async function markRead(id: string) {
    const token = localStorage.getItem("token");
    await fetch("/api/notifications", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id, read: true }),
    });
    fetchNotifications();
  }

  async function dismiss(id: string) {
    const token = localStorage.getItem("token");
    await fetch("/api/notifications", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id, dismissed: true }),
    });
    fetchNotifications();
  }

  const unread = notifications.filter((n) => !n.read && !n.dismissed);
  const read = notifications.filter((n) => n.read && !n.dismissed);

  const current = tab === "unread" ? unread : read;

  const typeIcons: Record<string, any> = {
    INVOICE_DUE: Bell,
    PAYMENT_OVERDUE: Bell,
    MEMBERSHIP_EXPIRY: Bell,
    MEMBERSHIP_EXPIRED: Bell,
    ONBOARDING_INCOMPLETE: Bell,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <p className="text-gray-500 mt-1">View and manage system notifications</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-gray-200">
        <button
          onClick={() => setTab("unread")}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
            tab === "unread"
              ? "border-brand-600 text-brand-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Unread ({unread.length})
        </button>
        <button
          onClick={() => setTab("read")}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
            tab === "read"
              ? "border-brand-600 text-brand-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Read ({read.length})
        </button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
          </div>
        ) : current.length === 0 ? (
          <div className="card text-center py-12 text-gray-500">
            {tab === "unread" ? "No unread notifications" : "No read notifications"}
          </div>
        ) : (
          current.map((n) => {
            const Icon = typeIcons[n.type] || Bell;
            return (
              <div
                key={n.id}
                className={`card flex items-start gap-3 ${
                  !n.read ? "border-l-4 border-l-brand-500" : ""
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{n.title}</p>
                  <p className="text-sm text-gray-500 mt-1">{n.message}</p>
                  {n.member && (
                    <Link
                      href={`/members/${n.memberId}`}
                      className="text-xs text-brand-600 hover:underline mt-1 inline-block"
                    >
                      {n.member.companyName}
                    </Link>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-1">
                  {!n.read && (
                    <button
                      onClick={() => markRead(n.id)}
                      className="text-gray-400 hover:text-green-600 p-1"
                      title="Mark as read"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => dismiss(n.id)}
                    className="text-gray-400 hover:text-red-600 p-1"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}