"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  ClipboardCheck,
  FileText,
  CreditCard,
  RefreshCw,
  Bell,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  ScrollText,
  BookOpen,
} from "lucide-react";
import { useState, useEffect } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, area: null },
  { href: "/members", label: "Members", icon: Users, area: "members" },
  { href: "/members/new", label: "Register Member", icon: UserPlus, area: "members" },
  { href: "/onboarding", label: "Onboarding", icon: ClipboardCheck, area: "onboarding" },
  { href: "/invoices", label: "Invoices", icon: FileText, area: "invoices" },
  { href: "/payments", label: "Payments", icon: CreditCard, area: "payments" },
  { href: "/renewals", label: "Renewals", icon: RefreshCw, area: "members" },
  { href: "/notifications", label: "Notifications", icon: Bell, area: null },
  { href: "/reports", label: "Reports", icon: BarChart3, area: "reports" },
  { href: "/audit-logs", label: "Audit Log", icon: ScrollText, area: "reports" },
  { href: "/settings", label: "Settings", icon: Settings, area: "settings" },
  { href: "/help", label: "Help & Guide", icon: BookOpen, area: null },
];

// Mirrors the server-side permission matrix in src/lib/audit.ts. This only
// hides navigation; the API enforces access independently.
const ROLE_AREAS: Record<string, string[]> = {
  ADMINISTRATOR: ["members", "onboarding", "invoices", "payments", "users", "settings", "reports"],
  MEMBERSHIP_OFFICER: ["members", "onboarding", "reports"],
  FINANCE_OFFICER: ["invoices", "payments", "reports"],
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  if (!user) return null;

  const allowedAreas = ROLE_AREAS[user.role] ?? [];
  const visibleNav = navItems.filter(
    (item) => item.area === null || allowedAreas.includes(item.area)
  );

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <h1 className="text-lg font-bold text-gray-900">Memberships</h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleNav.map((item) => {
            const active = pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-gray-200">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-medium text-sm">
              {user.email.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user.email}
              </p>
              <p className="text-xs text-gray-500">
                {user.role.replace(/_/g, " ")}
              </p>
            </div>
            <button
              onClick={logout}
              className="text-gray-400 hover:text-red-600"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-64">
        <header className="lg:hidden flex items-center justify-between h-16 px-4 bg-white border-b border-gray-200">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-500"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-semibold">Memberships</span>
        </header>
        <main className="p-4 lg:p-8 max-w-7xl mx-auto">{children}</main>
      </div>
    </div>
  );
}