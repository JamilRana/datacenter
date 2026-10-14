// src/app/reports/hardware/page.tsx
"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, HardDrive } from "lucide-react";
import { HardwareReportTable } from "@/app/reports/components/tables/HardwareReportTable";

export default function HardwareReportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === "loading") {
    return (
      <div className="p-6 md:p-10 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-64"></div>
          <div className="h-48 bg-slate-200 rounded-xl"></div>
          <div className="h-96 bg-slate-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (!session) {
    router.push("/auth");
    return null;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <Link 
              href="/reports" 
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back to Reports Dashboard
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-200 flex-shrink-0">
              <HardDrive size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Hardware & Hosts Report</h1>
              <p className="text-slate-500 text-xs md:text-sm">
                Physical rack inventory, type-specific hardware specs, per-host utilisation, hosted VMs, and mapped licenses
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Expandable Hardware Table */}
      <HardwareReportTable />
    </div>
  );
}
