import prisma from "@/lib/prisma";
import { ROLES } from "@/lib/roles";
import { RequestStatus, RequestType } from "@prisma/client";
import { DashboardRequest } from "@/types/approvals";
export type MetricColor = "slate" | "amber" | "emerald" | "red" | "blue";

export async function fetchDashboardData(userRoles: string[], isAdmin: boolean) {
  // Determine pending statuses based on roles
  const pendingStatusForRole = Array.from(
    new Set(
      [
        ...(userRoles.includes(ROLES.L1_APPROVER) ? ["PENDING_L1"] : []),
        ...(userRoles.includes(ROLES.L2_APPROVER) ? ["PENDING_L2"] : []),
        ...(userRoles.includes(ROLES.L3_APPROVER) ? ["PENDING_L3"] : []),
        ...(userRoles.includes(ROLES.DCOPS) ? ["APPROVED"] : []),
        ...(isAdmin ? ["PENDING_L1", "PENDING_L2", "PENDING_L3", "APPROVED"] : []),
      ] as RequestStatus[]
    )
  );

  // Fetch metrics
  const [
    reqTotal, reqPending, reqApproved, reqRejected, reqExecuted,
    custTotal, custPending, custApproved, custRejected, custExecuted
  ] = await Promise.all([
    prisma.request.count({ where: isAdmin ? {} : { status: { not: "DRAFT" } } }),
    prisma.request.count({ where: { status: { in: pendingStatusForRole } } }),
    prisma.request.count({ where: { status: "APPROVED" } }),
    prisma.request.count({ where: { status: "REJECTED" } }),
    prisma.request.count({ where: { status: { in: ["PROVISIONED", "CLOSED"] } } }),
    prisma.customizationRequest.count({ where: { status: { not: "DRAFT" } } }),
    prisma.customizationRequest.count({ where: { status: { in: pendingStatusForRole } } }),
    prisma.customizationRequest.count({ where: { status: "APPROVED" } }),
    prisma.customizationRequest.count({ where: { status: "REJECTED" } }),
    prisma.customizationRequest.count({ where: { status: { in: ["PROVISIONED", "CLOSED"] } } }),
  ]);

  // Fetch requests with proper typing
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
        targetVm: { select: { hostname: true, id: true } }
      },
      orderBy: { createdAt: "desc" }
    })
  ]);

  // Transform to DashboardRequest type
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
  
  return {
    metrics: {
      totalVisible: reqTotal + custTotal,
      pendingCount: reqPending + custPending,
      approvedCount: reqApproved + custApproved,
      rejectedCount: reqRejected + custRejected,
      executedCount: reqExecuted + custExecuted,
    },
    requests: initialRequests,
    userRoles,
    isAdmin
  };
}