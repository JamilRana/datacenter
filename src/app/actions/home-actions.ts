"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { RequestStatus, VmStatus, ApprovalDecision } from "@prisma/client";
import { ROLES, hasRole } from "@/lib/roles";

export interface HomeDashboardData {
  activeVmCount: number;
  decommissionedVmCount: number;
  totalRequestCount: number;
  pendingCount: number;
  returnedRequests: Array<{
    id: string;
    systemName: string;
    status: RequestStatus;
  }>;
  rejectedCount: number;
  recentRequests: Array<{
    id: string;
    systemName: string;
    requestType: string;
    environment: string;
    status: RequestStatus;
    createdAt: Date;
  }>;
  roleContext: "REQUESTER" | "DEVELOPER" | "APPROVER" | "DCOPS" | "ADMIN";
  provisioningQueue?: Array<{
    id: string;
    systemName: string;
    requestType: string;
    createdAt: Date;
  }>;
  pendingApprovals?: Array<{
    id: string;
    systemName: string;
    level: number;
    createdAt: Date;
  }>;
  totalAllocatedResources?: {
    vcpu: number;
    ramGb: number;
    storageGb: number;
  };
  activityFeed?: Array<{
    id: string;
    action: string;
    actorName: string;
    entityName: string;
    timestamp: Date;
  }>;
}

export async function getHomeDashboardData(): Promise<HomeDashboardData> {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const userId = session.user.id;
  const userRoles = session.user.roles;
  const isAdmin = hasRole(userRoles, ROLES.ADMIN);
  const isDCOPS = hasRole(userRoles, ROLES.DCOPS);
  const isApprover = userRoles.some(r => r.startsWith("APPROVER"));
  const isDeveloper = hasRole(userRoles, ROLES.DEVELOPER);
  const isRequester = hasRole(userRoles, ROLES.REQUESTER);

  // Determine primary role context
  let roleContext: HomeDashboardData["roleContext"] = "REQUESTER";
  if (isAdmin) roleContext = "ADMIN";
  else if (isDCOPS) roleContext = "DCOPS";
  else if (isApprover) roleContext = "APPROVER";
  else if (isDeveloper) roleContext = "DEVELOPER";
  else if (isRequester) roleContext = "REQUESTER";

  // Base visibility: Admins and DCOPS see all, others see their own
  const requestVisibility = (isAdmin || isDCOPS) ? {} : {
    OR: [
      { requesterId: userId },
      { developerId: userId }
    ]
  };

  const vmVisibility = (isAdmin || isDCOPS) ? {} : {
    OR: [
      { ownerId: userId },
      { request: { requesterId: userId } }
    ]
  };

  // Parallelize all queries
  const [
    activeVmCount,
    decommissionedVmCount,
    totalRequestCount,
    pendingCount,
    returnedRequests,
    rejectedCount,
    recentRequests,
    provisioningQueue,
    pendingApprovals,
    totalResources,
    activityFeed
  ] = await Promise.all([
    prisma.vmInstance.count({
      where: { status: VmStatus.ACTIVE, ...vmVisibility }
    }),
    prisma.vmInstance.count({
      where: { status: VmStatus.RETIRED, ...vmVisibility }
    }),
    prisma.request.count({ where: requestVisibility }),
    prisma.request.count({
      where: { 
        ...requestVisibility,
        status: { in: [RequestStatus.PENDING_L1, RequestStatus.PENDING_L2, RequestStatus.PENDING_L3, RequestStatus.PENDING_L4] }
      }
    }),
    prisma.request.findMany({
      where: { 
        ...requestVisibility,
        status: RequestStatus.DRAFT,
        approvals: { some: { decision: ApprovalDecision.RETURNED } }
      },
      select: { id: true, systemName: true, status: true },
      take: 5
    }),
    prisma.request.count({
      where: { ...requestVisibility, status: RequestStatus.REJECTED }
    }),
    prisma.request.findMany({
      where: requestVisibility,
      select: {
        id: true,
        systemName: true,
        requestType: true,
        environment: true,
        status: true,
        createdAt: true
      },
      orderBy: { createdAt: "desc" },
      take: 5
    }),
    // Provisioning queue for DCOPS/Admin - Include all approved requests
    (isDCOPS || isAdmin) ? prisma.request.findMany({
      where: { 
        status: RequestStatus.APPROVED,
        requestType: { in: ["NEW_VM", "RENEWAL", "DECOMMISSION"] }
      },
      select: { id: true, systemName: true, requestType: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 10
    }) : [],
    // Pending approvals for approvers
    isApprover ? prisma.approval.findMany({
      where: {
        approverId: userId,
        decision: ApprovalDecision.PENDING
      },
      select: {
        id: true,
        level: true,
        createdAt: true,
        request: { select: { id: true, systemName: true } },
        customizationRequest: { select: { id: true, targetVm: { select: { hostname: true } } } }
      },
      orderBy: { createdAt: "desc" },
      take: 10
    }) : [],
    // Total allocated resources
    prisma.vmSpec.aggregate({
      _sum: { vcpu: true, ramGb: true, storageGb: true },
      where: { 
        vmInstance: { 
          status: VmStatus.ACTIVE,
          ...vmVisibility
        } 
      }
    }),
    // Activity feed from audit logs
    prisma.auditLog.findMany({
      where: (isAdmin || isDCOPS) ? {} : { actorId: userId },
      orderBy: { timestamp: "desc" },
      take: 10
    })
  ]);

  // Transform pending approvals
  const formattedPendingApprovals = pendingApprovals.map((a: {
    id: string;
    level: number;
    createdAt: Date;
    request?: { id: string; systemName: string } | null;
    customizationRequest?: { id: string; targetVm?: { hostname: string | null } | null } | null;
  }) => ({
    id: a.request?.id || a.customizationRequest?.id || a.id,
    systemName: a.request?.systemName || a.customizationRequest?.targetVm?.hostname || "Unknown",
    level: a.level,
    createdAt: a.createdAt
  }));

  // Transform activity feed - use details from the log
  const formattedActivityFeed = activityFeed.map((log: {
    id: string;
    action: string;
    timestamp: Date;
    details: Record<string, unknown> | unknown;
    actorId: string;
    entityType?: string | null;
    entityId?: string | null;
  }) => {
    let entityName = "System";
    if (log.details && typeof log.details === 'object') {
      const details = log.details as Record<string, unknown>;
      entityName = (details.systemName as string) || (details.vmHostname as string) || "System";
    }
    
    return {
      id: log.id,
      action: log.action,
      actorName: log.actorId ? "User" : "System",
      entityName,
      timestamp: log.timestamp
    };
  });

  return {
    activeVmCount,
    decommissionedVmCount,
    totalRequestCount,
    pendingCount,
    returnedRequests,
    rejectedCount,
    recentRequests,
    roleContext,
    provisioningQueue: (isDCOPS || isAdmin) ? provisioningQueue : undefined,
    pendingApprovals: isApprover ? formattedPendingApprovals : undefined,
    totalAllocatedResources: {
      vcpu: totalResources._sum.vcpu || 0,
      ramGb: totalResources._sum.ramGb || 0,
      storageGb: totalResources._sum.storageGb || 0
    },
    activityFeed: formattedActivityFeed
  };
}