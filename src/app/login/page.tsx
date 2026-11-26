"use client";

import { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import Image from "next/image";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-50">
      <div className="max-w-md w-full px-4">
        <div className="text-center mb-8">
          <Image
            src="/images/logo.png"
            alt="FITSPA"
            width={120}
            height={120}
            className="mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold text-brand-900 tracking-tight">
            FITSPA Membership
          </h1>
          <p className="text-brand-600 mt-2 font-medium">
            Financial Technology Service Providers Association of Uganda
          </p>
          <p className="text-gray-500 text-sm mt-1">Sign in to your account</p>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm border border-red-100">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@organisation.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="Enter password"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
          <p className="text-xs text-center text-gray-500 mt-2">
            Admin email: admin@fitspa.ug
          </p>
        </form>
      </div>
    </div>
  );
}
