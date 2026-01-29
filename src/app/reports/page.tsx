// src/app/reports/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { ROLES } from "@/lib/roles";
import { getSystemReportData } from "@/app/actions/report-actions";
import { ReportsDashboardClient } from "./components/ReportsDashboardClient";
import { LayoutDashboard } from "lucide-react";

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth");

  const isAdmin = session.user.roles.includes(ROLES.ADMIN);
  const isApprover = session.user.roles.includes(ROLES.DCOPS);

  if (!isAdmin && !isApprover) {
    redirect("/unauthorized");
  }

  const initialData = await getSystemReportData();

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
