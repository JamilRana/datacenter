// src/app/reports/page.tsx
"use client";
import { useRouter } from "next/navigation";
import { ROLES } from "@/lib/roles";
import { getSystemReportData } from "@/app/actions/report-actions";
import { ReportsDashboardClient } from "./components/ReportsDashboardClient";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { SystemReportData } from "@/types/reports";

export default function ReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [initialData, setInitialData] = useState<SystemReportData | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) {
      router.push("/auth");
      return;
    }
    const isAdmin = session.user.roles.includes(ROLES.ADMIN);
    const isApprover = session.user.roles.includes(ROLES.DCOPS);
    if (!isAdmin && !isApprover) {
      router.push("/unauthorized");
      return;
    }
    setIsAuthorized(true);
  }, [session, status, router]);

  useEffect(() => {
    if (!isAuthorized) return;
    const fetchData = async () => {
      try {
        const data = await getSystemReportData();
        setInitialData(data);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
  }, [isAuthorized]);

  if (status === "loading" || !isAuthorized) {
    return (
      <div className="p-6 md:p-10 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-64"></div>
          <div className="h-64 bg-slate-200 rounded-xl"></div>
          <div className="h-96 bg-slate-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <a href="/" className="hover:text-indigo-600">Home</a>
        <span>/</span>
        <span className="text-slate-900 font-medium">Reports</span>
      </nav>

      <div className="space-y-1">
        <h1 className="text-3xl font-black tracking-tight text-slate-900">System Analytics</h1>
        <p className="text-slate-500">
          Executive overview of system performance, resource load, and allocation trends.
        </p>
      </div>

      <ReportsDashboardClient initialData={JSON.parse(JSON.stringify(initialData))} />
    </div>
  );
}
