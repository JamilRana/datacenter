// src/app/dashboard/page.tsx
import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import { getPrimaryRole, getRoleLabel, DashboardRole } from "@/lib/dashboard/registry";
import { getAdminDashboardData } from "@/lib/dashboard/adminDashboard";
import { getDcopsDashboardData } from "@/lib/dashboard/dcopsDashboard";
import { getApproverDashboardData } from "@/lib/dashboard/approverDashboard";
import { getRequesterDashboardData } from "@/lib/dashboard/requesterDashboard";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { DashboardRegistry } from "@/components/dashboard/dashboardRegistry";
import { RoleSwitcher } from "@/components/dashboard/RoleSwitcher";
import { Shield, Server, User, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect("/auth");
  }

  const userRoles = session.user?.roles || [];
  const primaryRole = getPrimaryRole(userRoles);

  let dashboardData;
  
  if (primaryRole === "ADMIN") {
    dashboardData = { role: "ADMIN" as const, data: await getAdminDashboardData() };
  } else if (primaryRole === "DCOPS") {
    dashboardData = { role: "DCOPS" as const, data: await getDcopsDashboardData() };
  } else if (primaryRole === "APPROVER") {
    dashboardData = { role: "APPROVER" as const, data: await getApproverDashboardData(session.user?.id || "", userRoles) };
  } else {
    dashboardData = { role: "REQUESTER" as const, data: await getRequesterDashboardData(session.user?.id || "") };
  }

  const getRoleIcon = (role: DashboardRole) => {
    switch (role) {
      case "ADMIN":
        return <Shield className="h-4 w-4 text-indigo-600" />;
      case "DCOPS":
        return <Server className="h-4 w-4 text-teal-600" />;
      case "APPROVER":
        return <CheckCircle2 className="h-4 w-4 text-amber-600" />;
      default:
        return <User className="h-4 w-4 text-blue-600" />;
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      <RoleSwitcher />
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              {getRoleLabel(primaryRole)} Dashboard
            </h1>
            <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-xs font-bold border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">
              {getRoleIcon(primaryRole)}
              {getRoleLabel(primaryRole)}
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Welcome back, <span className="font-semibold text-slate-700 dark:text-slate-300">{session.user?.name || "User"}</span> ({session.user?.email})
          </p>
        </div>
      </div>

      {/* Role badges */}
      {userRoles.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-semibold text-slate-400">Assigned Roles:</span>
          {userRoles.map((role) => (
            <Badge 
              key={role} 
              variant={role === primaryRole || (primaryRole === "DCOPS" && role === "DC_OPS") ? "default" : "secondary"}
              className="text-xs font-medium"
            >
              {role.replace(/_/g, " ")}
            </Badge>
          ))}
        </div>
      )}

      {/* Dashboard Content */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardRegistry data={dashboardData} />
      </Suspense>
    </div>
  );
}
