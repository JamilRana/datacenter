// src/app/reports/layout.tsx
"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { LayoutDashboard, Server, FileCheck, HardDrive, Users, ArrowLeft } from "lucide-react";
import Link from "next/link";

const analyticsNavItems = [
  { href: "/reports/users", label: "User Resource Report", icon: Users },
  { href: "/reports/vm", label: "VM Report", icon: Server },
  { href: "/reports/approvals", label: "Approval Report", icon: FileCheck },
  { href: "/reports/hardware", label: "Hardware Report", icon: HardDrive },
];

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/auth");
    }
  }, [session, status, router]);

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  const isMainReportsPage = pathname === "/reports";
  const currentSubPage = analyticsNavItems.find((item) => pathname.startsWith(item.href));

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-[1650px] mx-auto space-y-5">
      {/* Dynamic Breadcrumbs & Back Nav */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="hover:text-indigo-600 transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          {isMainReportsPage ? (
            <span className="text-slate-900 font-semibold">Reports</span>
          ) : (
            <>
              <Link href="/reports" className="hover:text-indigo-600 transition-colors">
                Reports
              </Link>
              <span>/</span>
              <span className="text-slate-900 font-semibold">
                {currentSubPage?.label || "Report Details"}
              </span>
            </>
          )}
        </div>

        {!isMainReportsPage && (
          <Link
            href="/reports"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors border border-indigo-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Reports Overview
          </Link>
        )}
      </div>

      {/* Subpage Report Switcher (Only visible when viewing dedicated analytics reports) */}
      {!isMainReportsPage && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
          <Link
            href="/reports"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/70 transition-all"
          >
            <LayoutDashboard className="h-4 w-4" />
            Overview Hub
          </Link>
          <div className="h-4 w-px bg-slate-300 mx-1 hidden sm:block" />
          {analyticsNavItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200"
                    : "text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/70"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}

      {children}
    </div>
  );
}
