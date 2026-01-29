// src/app/approvals/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { ROLES } from "@/lib/roles";
import { RequestStatus, RequestType } from "@prisma/client";
import { ApproverDashboardClient } from "./components/ApproverDashboardClient";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock, XCircle, PlayCircle, Layers } from "lucide-react";
import { DashboardRequest } from "@/types/approvals"; // ✅ Import types

// ✅ Type-safe icon color mapping
type MetricColor = "slate" | "amber" | "emerald" | "red" | "blue";

interface MetricCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  color: MetricColor;
}

function MetricCard({ title, value, icon: Icon, color }: MetricCardProps) {
  const colors: Record<MetricColor, string> = {
    slate: "text-slate-600 bg-slate-100",
    amber: "text-amber-600 bg-amber-100",
    emerald: "text-emerald-600 bg-emerald-100",
    red: "text-red-600 bg-red-100",
    blue: "text-blue-600 bg-blue-100",
  };

  return (
    <Card className="border-none shadow-sm overflow-hidden group">
      <CardContent className="p-0">
        <div className="p-4 flex items-center justify-between">
           <div className="space-y-1">
             <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
             <p className="text-2xl font-bold text-slate-900">{value}</p>
           </div>
           <div className={`p-3 rounded-xl transition-all duration-300 group-hover:scale-110 ${colors[color]}`}>
             <Icon className="w-5 h-5" />
           </div>
        </div>
        <div className={`h-1 w-full bg-current opacity-20 ${colors[color].split(" ")[0]}`} />
      </CardContent>
    </Card>
  );
}

export default async function ApprovalsDashboard() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth");

  const userRoles = session.user.roles;
  const isAdmin = userRoles.includes(ROLES.ADMIN);

  // 1. Aggregate pending statuses for all possessed roles
  let pendingStatusForRole: RequestStatus[] = [];
  if (userRoles.includes(ROLES.L1_APPROVER)) pendingStatusForRole.push("PENDING_L1");
  if (userRoles.includes(ROLES.L2_APPROVER)) pendingStatusForRole.push("PENDING_L2");
  if (userRoles.includes(ROLES.L3_APPROVER)) pendingStatusForRole.push("PENDING_L3");
  if (userRoles.includes(ROLES.DCOPS)) pendingStatusForRole.push("APPROVED");
  
  if (isAdmin) {
    pendingStatusForRole = ["PENDING_L1", "PENDING_L2", "PENDING_L3", "APPROVED"];
  }

  // Deduplicate
  pendingStatusForRole = Array.from(new Set(pendingStatusForRole));

  // 2. Fetch Metrics (Role-aware counts from both models)
  const [
    reqTotal, reqPending, reqApproved, reqRejected, reqExecuted,
    custTotal, custPending, custApproved, custRejected, custExecuted
  ] = await Promise.all([
    // Basic Requests
    prisma.request.count({ where: isAdmin ? {} : { status: { not: "DRAFT" } } }),
    prisma.request.count({ where: { status: { in: pendingStatusForRole } } }),
    prisma.request.count({ where: { status: "APPROVED" } }),
    prisma.request.count({ where: { status: "REJECTED" } }),
    prisma.request.count({ where: { status: { in: ["PROVISIONED", "CLOSED"] } } }),
    // Customization Requests
    prisma.customizationRequest.count({ where: { status: { not: "DRAFT" } } }),
    prisma.customizationRequest.count({ where: { status: { in: pendingStatusForRole } } }),
    prisma.customizationRequest.count({ where: { status: "APPROVED" } }),
    prisma.customizationRequest.count({ where: { status: "REJECTED" } }),
    prisma.customizationRequest.count({ where: { status: { in: ["PROVISIONED", "CLOSED"] } } }),
  ]);

  const totalVisible = reqTotal + custTotal;
  const pendingCount = reqPending + custPending;
  const approvedCount = reqApproved + custApproved;
  const rejectedCount = reqRejected + custRejected;
  const executedCount = reqExecuted + custExecuted;

  // 3. Fetch Data from both models
  const [requests, customizations] = await Promise.all([
    prisma.request.findMany({
      where: isAdmin ? {} : { status: { not: "DRAFT" } },
      include: { requester: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" }
    }),
    prisma.customizationRequest.findMany({
      where: { status: { not: "DRAFT" } },
      include: { 
        requester: { select: { name: true, email: true } },
        targetVm: { select: { hostname: true } }
      },
      orderBy: { createdAt: "desc" }
    })
  ]);

  // In your page component
const initialRequests: DashboardRequest[] = [
  // Transform regular Requests
  ...requests.map(req => ({
    id: req.id,
    createdAt: req.createdAt,
    status: req.status,
    requestType: req.requestType,
    systemName: req.systemName,
    projectName: req.projectName,
    requester: req.requester || null,
    // targetVm is not applicable for regular requests
  })),
  
  // Transform CustomizationRequests
  ...customizations.map(cust => ({
    id: cust.id,
    createdAt: cust.createdAt,
    status: cust.status,
    requestType: "CUSTOMIZED" as RequestType,
    systemName: cust.targetVm?.hostname || "System Customization",
    projectName: "Infrastructure Update",
    requester: cust.requester || null,
    targetVm: cust.targetVm || null
  }))
].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  

  return (
    <div className="p-6 md:p-10 space-y-8 bg-slate-50/30 min-h-screen">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 capitalize">
           {userRoles.join(" & ").replace(/_/g, " ")} Dashboard
        </h1>
        <p className="text-slate-500">Manage and execute virtual machine requests across the datacenter.</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard title="Assigned" value={totalVisible} icon={Layers} color="slate" />
        <MetricCard title="Pending Action" value={pendingCount} icon={Clock} color="amber" />
        <MetricCard title="Approved" value={approvedCount} icon={CheckCircle2} color="emerald" />
        <MetricCard title="Rejected" value={rejectedCount} icon={XCircle} color="red" />
        <MetricCard title="Executed" value={executedCount} icon={PlayCircle} color="blue" />
      </div>

      {/* Main List */}
      <ApproverDashboardClient 
        initialRequests={JSON.parse(JSON.stringify(initialRequests))} 
        userRoles={userRoles} 
      />
    </div>
  );
}