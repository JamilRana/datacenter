// src/app/reports/page.tsx
import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import { ROLES } from "@/lib/roles";
import { ReportsDashboardClient } from "./components/ReportsDashboardClient";
import { Loader2 } from "lucide-react";

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect("/auth");
  }

  const userRoles = session.user?.roles || [];
  const isAdmin = userRoles.includes(ROLES.ADMIN);
  const isDcops = userRoles.includes(ROLES.DCOPS);
  const isApprover = userRoles.some(r => r.startsWith("APPROVER_"));
  const isAuditor = userRoles.includes("AUDITOR");

  // Determine authorized sections based on roles
  const permissions = {
    canViewAllocation: isAdmin || isDcops || isApprover || isAuditor,
    canViewInventory: true, // Requesters see only their own, handled in action
    canViewCapacity: isAdmin || isDcops || isApprover,
    canViewRequests: true, // Requesters see only their own
    canViewRenewals: true, // Requesters see only their own
    canViewAudit: isAdmin || isAuditor
  };

  return (
    <div className="flex-1 w-full bg-slate-50/50">
      <Suspense fallback={
        <div className="flex h-[80vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      }>
        <ReportsDashboardClient 
          user={session.user} 
          permissions={permissions} 
        />
      </Suspense>
    </div>
  );
}
