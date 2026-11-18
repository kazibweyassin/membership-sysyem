"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

interface Contact {
  fullName: string;
  jobTitle: string;
  phone: string;
  email: string;
  isPrimary: boolean;
}

export default function RegisterMemberPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<{ id: string; name: string; fee: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    companyName: "",
    categoryId: "",
    startDate: new Date().toISOString().split("T")[0],
    address: "",
    website: "",
    notes: "",
  });

  const [contacts, setContacts] = useState<Contact[]>([
    { fullName: "", jobTitle: "", phone: "", email: "", isPrimary: true },
    { fullName: "", jobTitle: "", phone: "", email: "", isPrimary: false },
    { fullName: "", jobTitle: "", phone: "", email: "", isPrimary: false },
  ]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch("/api/categories", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setCategories(data.categories || []));
  }, []);

  function updateContact(index: number, field: keyof Contact, value: any) {
    setContacts((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  }

  function addContact() {
    setContacts((prev) => [
      ...prev,
      { fullName: "", jobTitle: "", phone: "", email: "", isPrimary: false },
    ]);
  }

  function removeContact(index: number) {
    setContacts((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const token = localStorage.getItem("token");
    const res = await fetch("/api/members", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ...form, contacts }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Failed to register member");
      return;
    }

    router.push(`/members/${data.member.id}`);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Register Member</h1>
        <p className="text-gray-500 mt-1">Add a new member to the system</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Company Information */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Company Information</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company Name *
              </label>
              <input
                type="text"
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Membership Category *
              </label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="input"
                required
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (${c.fee})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Membership Start Date *
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Website
              </label>
              <input
                type="url"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                className="input"
                placeholder="https://example.com"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <textarea
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="input"
                rows={2}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="input"
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* Contact Persons */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Contact Persons</h2>
            <button
              type="button"
              onClick={addContact}
              className="btn-secondary text-sm"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Contact
            </button>
          </div>
          <div className="space-y-4">
            {contacts.map((contact, i) => (
              <div key={i} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-sm">
                    Contact Person {i + 1}
                    {contact.isPrimary && (
                      <span className="ml-2 badge bg-brand-100 text-brand-700">Primary</span>
                    )}
                  </h3>
                  {contacts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeContact(i)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <input
                      type="text"
                      placeholder="Full Name *"
                      value={contact.fullName}
                      onChange={(e) => updateContact(i, "fullName", e.target.value)}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Job Title"
                      value={contact.jobTitle}
                      onChange={(e) => updateContact(i, "jobTitle", e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <input
                      type="tel"
                      placeholder="Phone *"
                      value={contact.phone}
                      onChange={(e) => updateContact(i, "phone", e.target.value)}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <input
                      type="email"
                      placeholder="Email *"
                      value={contact.email}
                      onChange={(e) => updateContact(i, "email", e.target.value)}
                      className="input"
                      required
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={contact.isPrimary}
                      onChange={(e) => updateContact(i, "isPrimary", e.target.checked)}
                      className="mr-2"
                    />
                    <label className="text-sm text-gray-600">Primary Contact</label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary disabled:opacity-50"
          >
            {loading ? "Registering..." : "Register Member"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}