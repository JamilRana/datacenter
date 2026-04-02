// src/app/dashboard/page.tsx
import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import { getPrimaryRole, getRoleLabel } from "@/lib/dashboard/registry";
import { getAdminDashboardData } from "@/lib/dashboard/adminDashboard";
import { getDcopsDashboardData } from "@/lib/dashboard/dcopsDashboard";
import { getRequesterDashboardData } from "@/lib/dashboard/requesterDashboard";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { DashboardRegistry } from "@/components/dashboard/dashboardRegistry";
import { RoleSwitcher } from "@/components/dashboard/RoleSwitcher";
import { Shield, Server, User } from "lucide-react";
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
  } else {
    dashboardData = { role: "REQUESTER" as const, data: await getRequesterDashboardData(session.user?.id || "") };
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "ADMIN":
        return <Shield className="h-4 w-4" />;
      case "DCOPS":
        return <Server className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <RoleSwitcher />
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <Badge variant="outline" className="gap-1">
              {getRoleIcon(primaryRole)}
              {getRoleLabel(primaryRole)}
            </Badge>
          </div>
          <p className="text-slate-500 mt-1">
            Welcome back, {session.user?.name || "User"}
          </p>
        </div>
      </div>

      {/* Role badges */}
      {userRoles.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {userRoles.map((role) => (
            <Badge 
              key={role} 
              variant={role === primaryRole ? "default" : "secondary"}
              className="text-xs"
            >
              {role}
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
