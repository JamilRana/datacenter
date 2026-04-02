// src/app/reports/layout.tsx
"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Server, FileCheck, HardDrive, Users } from "lucide-react";
import Link from "next/link";

const navItems = [
  { href: "/reports/vm", label: "VM Report", icon: Server },
  { href: "/reports/approvals", label: "Approval Report", icon: FileCheck },
  { href: "/reports/hardware", label: "Hardware Report", icon: HardDrive },
  { href: "/reports/users", label: "User Report", icon: Users },
];

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

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

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
        <Link href="/dashboard" className="hover:text-indigo-600">Dashboard</Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">Reports</span>
      </div>
      
      <div className="flex gap-2 border-b border-slate-200 pb-4">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </div>

      {children}
    </div>
  );
}
