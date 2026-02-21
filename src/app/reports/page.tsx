// src/app/reports/page.tsx
"use client";
import { redirect } from "next/navigation";
import { ROLES } from "@/lib/roles";
import { getSystemReportData } from "@/app/actions/report-actions";
import { ReportsDashboardClient } from "./components/ReportsDashboardClient";
import { LayoutDashboard } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { SystemReportData } from "@/types/reports";

export default function ReportsPage() {
  const { data: session } = useSession();
  const [initialData, setInitialData] = useState<SystemReportData | null>(null);
  if (!session?.user) redirect("/auth");

  const isAdmin = session.user.roles.includes(ROLES.ADMIN);
  const isApprover = session.user.roles.includes(ROLES.DCOPS);

  if (!isAdmin && !isApprover) {
    redirect("/unauthorized");
  }
  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getSystemReportData();
        setInitialData(data);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
  }, []);



  return (
    <div className="p-6 md:p-10 space-y-8 bg-slate-50/20 min-h-screen">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
           <div className="p-2 bg-slate-900 rounded-lg text-white">
              <LayoutDashboard className="h-5 w-5" />
           </div>
           <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Analytical Insights</h1>
        </div>
        <p className="text-slate-500 font-medium ml-12">Executive overview of system performance, resource load, and allocation trends.</p>
      </div>

      <ReportsDashboardClient initialData={JSON.parse(JSON.stringify(initialData))} />
    </div>
  );
}
