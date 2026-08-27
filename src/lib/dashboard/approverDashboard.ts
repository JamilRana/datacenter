// src/lib/dashboard/approverDashboard.ts
import prisma from "@/lib/prisma";
import { getCachedData } from "@/lib/redis";
import {
  ApproverDashboardData,
  ApproverKPIs,
  DecisionQueueItem,
  ReturnedQueueItem,
  ApproverHistoryItem
} from "@/types/dashboard";
import { ApprovalDecision, RequestStatus } from "@prisma/client";
import { ROLES } from "@/lib/roles";

export async function getApproverDashboardData(
  userId: string,
  userRoles: string[]
): Promise<ApproverDashboardData> {
  const cacheKey = `approver_dashboard_data_v2_${userId}`;

  return getCachedData(cacheKey, async () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const isAdmin = userRoles.includes(ROLES.ADMIN);
    const isL1 = userRoles.includes(ROLES.L1_APPROVER) || userRoles.includes("APPROVER_L1");
    const isL2 = userRoles.includes(ROLES.L2_APPROVER) || userRoles.includes("APPROVER_L2");
    const isL3 = userRoles.includes(ROLES.L3_APPROVER) || userRoles.includes("APPROVER_L3");
    const isL4 = userRoles.includes(ROLES.L4_APPROVER) || userRoles.includes("APPROVER_L4");

    const targetStatuses: RequestStatus[] = [];
    const targetLevels: number[] = [];

    if (isL1 || isAdmin) { targetStatuses.push(RequestStatus.PENDING_L1); targetLevels.push(1); }
    if (isL2 || isAdmin) { targetStatuses.push(RequestStatus.PENDING_L2); targetLevels.push(2); }
    if (isL3 || isAdmin) { targetStatuses.push(RequestStatus.PENDING_L3); targetLevels.push(3); }
    if (isL4 || isAdmin) { targetStatuses.push(RequestStatus.PENDING_L4); targetLevels.push(4); }

    const [
      pendingMyApprovalsCount,
      agingApprovalsCount,
      returnedCount,
      approvedThisMonthCount,
      pendingRequests,
      returnedRequests,
      myRecentApprovals,
    ] = await Promise.all([
      // 1. Pending Approvals count for this approver's levels
      prisma.request.count({
        where: {
          status: { in: targetStatuses },
        },
      }),

      // 2. Aging Approvals (> 48h)
      prisma.request.count({
        where: {
          status: { in: targetStatuses },
          createdAt: { lte: fortyEightHoursAgo },
        },
      }),

      // 3. Returned requests count
      prisma.request.count({
        where: {
          status: RequestStatus.DRAFT,
          approvals: { some: { decision: ApprovalDecision.RETURNED } },
        },
      }),

      // 4. Approved this month by this user
      prisma.approval.count({
        where: {
          approverId: userId,
          decision: ApprovalDecision.APPROVED,
          decidedAt: { gte: startOfMonth },
        },
      }),

      // 5. Pending Decision Queue Requests
      prisma.request.findMany({
        where: {
          status: { in: targetStatuses },
        },
        orderBy: { createdAt: "asc" },
        take: 20,
        include: {
          requester: { select: { id: true, name: true, email: true, organization: true } },
          approvals: {
            where: { decision: ApprovalDecision.PENDING },
            orderBy: { level: "asc" },
            take: 1,
            select: { id: true, level: true },
          },
          requestResources: { select: { id: true } },
        },
      }),

      // 6. Returned Requests Queue
      prisma.request.findMany({
        where: {
          status: RequestStatus.DRAFT,
          approvals: { some: { decision: ApprovalDecision.RETURNED } },
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: {
          requester: { select: { name: true } },
          approvals: {
            where: { decision: ApprovalDecision.RETURNED },
            orderBy: { decidedAt: "desc" },
            take: 1,
            select: { comments: true, decidedAt: true },
          },
        },
      }),

      // 7. My Recent Approval Decisions
      prisma.approval.findMany({
        where: {
          approverId: userId,
          decision: { in: [ApprovalDecision.APPROVED, ApprovalDecision.REJECTED, ApprovalDecision.RETURNED, ApprovalDecision.FORWARDED] },
        },
        orderBy: { decidedAt: "desc" },
        take: 10,
        include: {
          request: { select: { systemName: true, requestType: true } },
        },
      }),
    ]);

    // Format Decision Queue Items
    const decisionQueue: DecisionQueueItem[] = pendingRequests.map(req => {
      const hoursWaiting = Math.round((now.getTime() - new Date(req.createdAt).getTime()) / (1000 * 60 * 60));
      const pendingApproval = req.approvals[0];

      return {
        id: req.id,
        approvalId: pendingApproval?.id || req.id,
        systemName: req.systemName,
        requestType: req.requestType,
        level: pendingApproval?.level || (req.status === RequestStatus.PENDING_L1 ? 1 : req.status === RequestStatus.PENDING_L2 ? 2 : req.status === RequestStatus.PENDING_L3 ? 3 : 4),
        requesterName: req.requester?.name || "Requester",
        requesterEmail: req.requester?.email || "",
        requesterOrg: req.requester?.organization || null,
        environment: req.environment,
        createdAt: req.createdAt,
        hoursWaiting,
        resourcesSummary: {
          vcpu: req.vcpu,
          ramGb: req.ramGb,
          storageGb: req.storageGb,
          vmCount: req.quantity || 1,
          accessType: req.accessType,
        },
      };
    });

    const agingApprovals = decisionQueue.filter(q => q.hoursWaiting >= 48);

    // Format Returned Queue Items
    const returnedQueue: ReturnedQueueItem[] = returnedRequests.map(req => ({
      id: req.id,
      systemName: req.systemName,
      requesterName: req.requester?.name || "Requester",
      returnedAt: req.approvals[0]?.decidedAt || req.updatedAt,
      comments: req.approvals[0]?.comments || "Returned for amendments",
    }));

    // Format My Recent Decisions
    const myRecentDecisions: ApproverHistoryItem[] = myRecentApprovals.map(app => ({
      id: app.id,
      systemName: app.request?.systemName || "Request",
      requestType: app.request?.requestType || "NEW_VM",
      decision: app.decision as ApproverHistoryItem["decision"],
      level: app.level,
      decidedAt: app.decidedAt,
      comments: app.comments,
    }));

    const kpis: ApproverKPIs = {
      pendingMyApproval: pendingMyApprovalsCount,
      agingRequestsCount: agingApprovalsCount,
      returnedToRequester: returnedCount,
      recentlyApprovedThisMonth: approvedThisMonthCount,
    };

    return {
      kpis,
      decisionQueue,
      agingApprovals,
      returnedQueue,
      myRecentDecisions,
    };
  }, 10);
}
