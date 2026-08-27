// src/lib/dashboard/requesterDashboard.ts
import prisma from "@/lib/prisma";
import { getCachedData } from "@/lib/redis";
import {
  RequesterDashboardData,
  RequesterKPIs,
  ActionRequiredItem,
  RequesterPipelineCounts,
  RequesterVmItem,
  RequesterRecentRequestItem
} from "@/types/dashboard";
export type { RequesterDashboardData };
import { ApprovalDecision, RequestStatus, VmStatus } from "@prisma/client";

export async function getRequesterDashboardData(userId: string): Promise<RequesterDashboardData> {
  const cacheKey = `requester_dashboard_data_v2_${userId}`;

  return getCachedData(cacheKey, async () => {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      totalMyRequests,
      myPendingApprovalsCount,
      myApprovedCount,
      myActiveVmsCount,
      myExpiringVmsCount,
      returnedRequests,
      statusGroups,
      myVmsList,
      myRecentRequestsList,
    ] = await Promise.all([
      // 1. Total My Requests
      prisma.request.count({
        where: { requesterId: userId },
      }),

      // 2. Pending Approval
      prisma.request.count({
        where: {
          requesterId: userId,
          status: { in: [RequestStatus.PENDING_L1, RequestStatus.PENDING_L2, RequestStatus.PENDING_L3, RequestStatus.PENDING_L4] },
        },
      }),

      // 3. Approved (awaiting DC-Ops provisioning)
      prisma.request.count({
        where: {
          requesterId: userId,
          status: { in: [RequestStatus.APPROVED, RequestStatus.PARTIALLY_PROVISIONED] },
        },
      }),

      // 4. My Active VMs
      prisma.vmInstance.count({
        where: {
          ownerId: userId,
          status: VmStatus.ACTIVE,
        },
      }),

      // 5. My Expiring VMs (in 30 days)
      prisma.vmInstance.count({
        where: {
          ownerId: userId,
          status: VmStatus.ACTIVE,
          renewalDate: { gte: now, lte: in30Days },
        },
      }),

      // 6. Action Required (Returned requests with comments)
      prisma.request.findMany({
        where: {
          requesterId: userId,
          status: RequestStatus.DRAFT,
          approvals: { some: { decision: ApprovalDecision.RETURNED } },
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: {
          approvals: {
            where: { decision: ApprovalDecision.RETURNED },
            orderBy: { decidedAt: "desc" },
            take: 1,
            include: {
              approver: { select: { name: true, designation: true } },
            },
          },
        },
      }),

      // 7. Status Pipeline Groupings
      prisma.request.groupBy({
        by: ["status"],
        where: { requesterId: userId },
        _count: { id: true },
      }),

      // 8. My VMs List
      prisma.vmInstance.findMany({
        where: { ownerId: userId },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          currentSpec: { select: { vcpu: true, ramGb: true, storageGb: true } },
        },
      }),

      // 9. My Recent Requests List
      prisma.request.findMany({
        where: { requesterId: userId },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, systemName: true, requestType: true, status: true, createdAt: true },
      }),
    ]);

    // Format Action Required Items
    const actionRequired: ActionRequiredItem[] = returnedRequests.map(req => {
      const returnedApproval = req.approvals[0];
      return {
        id: req.id,
        systemName: req.systemName,
        requestType: req.requestType,
        status: "RETURNED",
        reviewerName: returnedApproval?.approver?.name || "Reviewer",
        reviewerRole: returnedApproval?.approver?.designation || `Level ${returnedApproval?.level || 1} Approver`,
        comments: returnedApproval?.comments || "Request requires revisions before approval.",
        updatedAt: returnedApproval?.decidedAt || req.updatedAt,
      };
    });

    // Format Status Pipeline Counts
    const statusMap: Record<string, number> = {};
    for (const g of statusGroups) {
      statusMap[g.status] = g._count.id;
    }

    const pendingTotal = 
      (statusMap[RequestStatus.PENDING_L1] || 0) +
      (statusMap[RequestStatus.PENDING_L2] || 0) +
      (statusMap[RequestStatus.PENDING_L3] || 0) +
      (statusMap[RequestStatus.PENDING_L4] || 0);

    const statusPipeline: RequesterPipelineCounts = {
      draft: statusMap[RequestStatus.DRAFT] || 0,
      pendingApproval: pendingTotal,
      returned: actionRequired.length,
      approved: (statusMap[RequestStatus.APPROVED] || 0) + (statusMap[RequestStatus.PARTIALLY_PROVISIONED] || 0),
      provisioned: (statusMap[RequestStatus.PROVISIONED] || 0) + (statusMap[RequestStatus.CLOSED] || 0),
      rejected: statusMap[RequestStatus.REJECTED] || 0,
    };

    // Format My VMs
    const myVms: RequesterVmItem[] = myVmsList.map(vm => {
      const remainingMs = vm.renewalDate ? new Date(vm.renewalDate).getTime() - now.getTime() : null;
      return {
        id: vm.id,
        hostname: vm.hostname || `VM-${vm.sequenceNumber}`,
        ipAddress: vm.ipAddress,
        environment: vm.environment,
        status: vm.status,
        vcpu: vm.currentSpec?.vcpu || 2,
        ramGb: vm.currentSpec?.ramGb || 4,
        storageGb: vm.currentSpec?.storageGb || 50,
        renewalDate: vm.renewalDate,
        daysUntilRenewal: remainingMs !== null ? Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24))) : null,
      };
    });

    // Format My Recent Requests
    const myRecentRequests: RequesterRecentRequestItem[] = myRecentRequestsList.map(req => ({
      id: req.id,
      systemName: req.systemName,
      requestType: req.requestType,
      status: req.status,
      createdAt: req.createdAt,
    }));

    const kpis: RequesterKPIs = {
      myTotalRequests: totalMyRequests,
      myPendingApprovals: myPendingApprovalsCount,
      myActionRequiredCount: actionRequired.length,
      myApprovedAwaitingOps: myApprovedCount,
      myActiveVms: myActiveVmsCount,
      myExpiringVms: myExpiringVmsCount,
    };

    return {
      kpis,
      actionRequired,
      statusPipeline,
      myVms,
      myRecentRequests,
    };
  }, 10);
}
