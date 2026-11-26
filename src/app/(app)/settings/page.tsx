"use client";

import { useEffect, useState } from "react";
import { Save, Settings, Users, CreditCard, Bell } from "lucide-react";
import HelpLink from "@/components/help/HelpLink";
import { formatMoney } from "@/lib/currency";

interface Setting {
  id: string;
  key: string;
  value: string;
  description: string | null;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("general");
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userForm, setUserForm] = useState({ email: "", name: "", password: "", role: "MEMBERSHIP_OFFICER" });
  const [error, setError] = useState("");
  const [catNameDraft, setCatNameDraft] = useState("");
  const [catFeeDraft, setCatFeeDraft] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const token = localStorage.getItem("token");
    const [settingsRes, usersRes, catRes] = await Promise.all([
      fetch("/api/settings", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/categories", { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const [settingsData, usersData, catData] = await Promise.all([
      settingsRes.json(),
      usersRes.json(),
      catRes.json(),
    ]);
    setSettings(settingsData.settings || []);
    setUsers(usersData.users || []);
    setCategories(catData.categories || []);
    setLoading(false);
  }

  async function saveSetting(key: string, value: string) {
    setSaving(true);
    const token = localStorage.getItem("token");
    await fetch("/api/settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ key, value }),
    });
    setSaving(false);
    setEditing(null);
    fetchData();
  }

  async function saveCategory(id: string) {
    setSaving(true);
    const token = localStorage.getItem("token");
    await fetch(`/api/categories/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: catNameDraft,
        fee: parseFloat(catFeeDraft) || 0,
      }),
    });
    setSaving(false);
    setEditing(null);
    fetchData();
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const token = localStorage.getItem("token");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(userForm),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to create user");
      return;
    }
    setShowUserModal(false);
    setUserForm({ email: "", name: "", password: "", role: "MEMBERSHIP_OFFICER" });
    fetchData();
  }

  const tabs = [
    { id: "general", label: "General", icon: Settings },
    { id: "categories", label: "Categories", icon: CreditCard },
    { id: "users", label: "Users", icon: Users },
    { id: "reminders", label: "Reminders", icon: Bell },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 mt-1">Manage system configuration</p>
        </div>
        <HelpLink
          section="settings"
          label="Help on settings and users"
          className="w-8 h-8"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-gray-200 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              tab === t.id
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : (
        <>
          {tab === "general" && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">General Settings</h2>
              <div className="space-y-4">
                {settings.map((s) => (
                  <div key={s.id} className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700">
                        {s.key.replace(/_/g, " ")}
                      </label>
                      {s.description && (
                        <p className="text-xs text-gray-400 mt-1">{s.description}</p>
                      )}
                    </div>
                    {editing === s.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="input w-48"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveSetting(s.key, editValue);
                            if (e.key === "Escape") setEditing(null);
                          }}
                        />
                        <button
                          onClick={() => saveSetting(s.key, editValue)}
                          disabled={saving}
                          className="btn-primary text-sm py-1 px-3 disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono bg-gray-50 px-3 py-1 rounded">
                          {s.value}
                        </span>
                        <button
                          onClick={() => {
                            setEditing(s.id);
                            setEditValue(s.value);
                          }}
                          className="text-brand-600 hover:text-brand-700 text-sm"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "categories" && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-1">Membership Categories</h2>
              <p className="text-sm text-gray-500 mb-4">
                Names and annual fees are used when issuing invoices. Changing a fee does not
                affect existing invoices.
              </p>
              <div className="space-y-2">
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{cat.name}</p>
                      <p className="text-sm text-gray-500">
                        {cat.description || "No description"}
                        {cat._count?.members !== undefined && ` · ${cat._count.members} member(s)`}
                      </p>
                    </div>
                    {editing === cat.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={catNameDraft}
                          onChange={(e) => setCatNameDraft(e.target.value)}
                          className="input w-32 text-sm py-1.5"
                          placeholder="Name"
                        />
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={catFeeDraft}
                          onChange={(e) => setCatFeeDraft(e.target.value)}
                          className="input w-28 text-sm py-1.5"
                          placeholder="Fee"
                        />
                        <button
                          onClick={() => saveCategory(cat.id)}
                          disabled={saving}
                          className="btn-primary text-sm py-1 px-3 disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="btn-secondary text-sm py-1 px-3"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="font-semibold">{formatMoney(Number(cat.fee))}</span>
                        <button
                          onClick={() => {
                            setEditing(cat.id);
                            setCatNameDraft(cat.name);
                            setCatFeeDraft(String(Number(cat.fee)));
                          }}
                          className="text-brand-600 hover:text-brand-700 text-sm"
                        >
                          Edit
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "users" && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Users</h2>
                <button onClick={() => setShowUserModal(true)} className="btn-primary text-sm">
                  Add User
                </button>
              </div>
              {error && !showUserModal && (
                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div>
                      <p className="font-medium">{u.name}</p>
                      <p className="text-sm text-gray-500">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`badge ${
                        u.role === "ADMINISTRATOR" ? "bg-purple-100 text-purple-700" :
                        u.role === "FINANCE_OFFICER" ? "bg-blue-100 text-blue-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>
                        {u.role.replace(/_/g, " ")}
                      </span>
                      {!u.active && (
                        <span className="badge bg-red-100 text-red-700">Inactive</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "reminders" && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Reminder Configuration</h2>
              <div className="space-y-4">
                {settings.filter((s) => s.key.includes("reminder") || s.key.includes("renewal")).map((s) => (
                  <div key={s.id} className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700">
                        {s.key.replace(/_/g, " ")}
                      </label>
                      {s.description && (
                        <p className="text-xs text-gray-400 mt-1">{s.description}</p>
                      )}
                    </div>
                    {editing === s.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="input w-48"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveSetting(s.key, editValue);
                            if (e.key === "Escape") setEditing(null);
                          }}
                        />
                        <button
                          onClick={() => saveSetting(s.key, editValue)}
                          disabled={saving}
                          className="btn-primary text-sm py-1 px-3 disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono bg-gray-50 px-3 py-1 rounded">
                          {s.value}
                        </span>
                        <button
                          onClick={() => {
                            setEditing(s.id);
                            setEditValue(s.value);
                          }}
                          className="text-brand-600 hover:text-brand-700 text-sm"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Create User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <h2 className="text-xl font-semibold mb-4">Add User</h2>
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}
            <form onSubmit={createUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className="input"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                  className="input"
                >
                  <option value="ADMINISTRATOR">Administrator</option>
                  <option value="MEMBERSHIP_OFFICER">Membership Officer</option>
                  <option value="FINANCE_OFFICER">Finance Officer</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn-primary">Create User</button>
                <button type="button" onClick={() => setShowUserModal(false)} className="btn-secondary">
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