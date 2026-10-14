// src/app/admin/components/AdminNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Shield, 
  Users, 
  Workflow, 
  Settings, 
  Mail, 
  Tag, 
  ScrollText, 
  BarChart4, 
  HardDrive,
  ChevronRight
} from "lucide-react";

const adminNavItems = [
  { href: "/admin", label: "Command Center", icon: Shield, exact: true },
  { href: "/admin/users", label: "Users & Access", icon: Users, exact: false },
  { href: "/admin/workflows", label: "Workflows", icon: Workflow, exact: false },
  { href: "/admin/settings", label: "System Settings", icon: Settings, exact: false },
  { href: "/admin/email-settings", label: "Email Alerts", icon: Mail, exact: false },
  { href: "/admin/tags", label: "Resource Tags", icon: Tag, exact: false },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText, exact: false },
];

export function AdminNav() {
  const pathname = usePathname();

  const isItemActive = (href: string, exact: boolean) => {
    if (exact) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Left: Branding badge + Admin nav links */}
          <div className="flex items-center gap-2 sm:gap-6 overflow-x-auto scrollbar-hide py-1">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 flex-shrink-0">
              <Shield className="h-3.5 w-3.5 text-indigo-600" />
              <span className="text-xs font-black text-indigo-900 uppercase tracking-wider">
                Admin
              </span>
            </div>

            <nav className="flex items-center space-x-1 sm:space-x-1.5 flex-nowrap" aria-label="Admin Navigation">
              {adminNavItems.map((item) => {
                const active = isItemActive(item.href, item.exact);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                      active
                        ? "bg-slate-900 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${active ? "text-indigo-400" : "text-slate-400"}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: Quick shortcuts to Reports and Inventory */}
          <div className="hidden lg:flex items-center gap-2 pl-4 border-l border-slate-100 flex-shrink-0">
            <Link
              href="/reports"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/60 transition-colors"
              title="Open Reports Dashboard"
            >
              <BarChart4 className="h-3.5 w-3.5 text-slate-400" />
              <span>Reports</span>
            </Link>
            <Link
              href="/inventory"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/60 transition-colors"
              title="Open Infrastructure Inventory"
            >
              <HardDrive className="h-3.5 w-3.5 text-slate-400" />
              <span>Inventory</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
