//src/app/approvals/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { ROLES } from "@/lib/roles";
import { ApproverDashboardClient } from "./components/ApproverDashboardClient";
import { fetchDashboardData } from "./lib";
import { getDistinctWorkflowLevels, getAllWorkflowConfigs } from "@/lib/workflow";

export default async function ApprovalsDashboard({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string; status?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth");

  const resolvedSearchParams = await searchParams;
  const page = resolvedSearchParams?.page ? parseInt(resolvedSearchParams.page, 10) : 1;
  const decisionFilter = resolvedSearchParams?.filter as "PENDING" | "APPROVED" | "REJECTED" | undefined;
  const initialStatusFilter = resolvedSearchParams?.status || resolvedSearchParams?.filter;
  const userRoles = session.user.roles;
  const isAdmin = userRoles.includes(ROLES.ADMIN);

  // Single source of truth: Fetch shared data and dynamic workflow levels
  const [{ requests }, workflowLevels, workflowConfigs] = await Promise.all([
    fetchDashboardData(session.user.id, userRoles, isAdmin, page, 100, decisionFilter),
    getDistinctWorkflowLevels(),
    getAllWorkflowConfigs(),
  ]);

  return (
    <div className="p-6 md:p-10 space-y-8 bg-slate-50/30 min-h-screen">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 capitalize">
          {userRoles.map(r => r.replace(/_/g, " ")).join(" & ")} Dashboard
        </h1>
      </div>

      {/* Metrics Grid - Passed to client for client-side filtering */}
      <ApproverDashboardClient
        initialRequests={JSON.parse(JSON.stringify(requests))}
        userRoles={userRoles}
        currentUserId={session.user.id}
        initialStatusFilter={initialStatusFilter}
        workflowLevels={workflowLevels}
        workflowConfigs={workflowConfigs}
      />
    </div>
  );
}