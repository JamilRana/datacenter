// src/lib/dashboard/adminDashboard.ts
import prisma from "@/lib/prisma";
import { getCachedData } from "@/lib/redis";
import { 
  AdminDashboardData,
  AdminKPIs,
  RequestPipelineCounts,
  ResourceOverviewData,
  ExpiringVmItem,
  ExpiringLicenseItem,
  StuckRequestItem,
  DashboardRecentActivity
} from "@/types/dashboard";
import { checkSystemHealth } from "./systemHealth";
import { RequestStatus, VmStatus } from "@prisma/client";

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  return getCachedData("admin_dashboard_data_v2", async () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    // Parallel DB Aggregations
    const [
      vmCounts,
      requestCounts,
      approvalLevelCounts,
      userCounts,
      expiringVmsCounts,
      expiringLicensesCounts,
      pipelineGroupings,
      vmSpecs,
      serverAssets,
      expiringVmsList,
      expiringLicensesList,
      stuckRequestsList,
      recentAuditLogs,
      systemHealth,
    ] = await Promise.all([
      // 1. VM Counts by Status
      Promise.all([
        prisma.vmInstance.count(),
        prisma.vmInstance.count({ where: { status: VmStatus.ACTIVE } }),
        prisma.vmInstance.count({ where: { status: VmStatus.SUSPENDED } }),
        prisma.vmInstance.count({ where: { status: VmStatus.RETIRED } }),
      ]),

      // 2. Request Counts (Total, This Month, Pending)
      Promise.all([
        prisma.request.count(),
        prisma.request.count({ where: { createdAt: { gte: startOfMonth } } }),
        prisma.request.count({
          where: {
            status: { in: [RequestStatus.PENDING_L1, RequestStatus.PENDING_L2, RequestStatus.PENDING_L3, RequestStatus.PENDING_L4] },
          },
        }),
      ]),

      // 3. Approvals by Level
      Promise.all([
        prisma.approval.count({ where: { decision: "PENDING", level: 1 } }),
        prisma.approval.count({ where: { decision: "PENDING", level: 2 } }),
        prisma.approval.count({ where: { decision: "PENDING", level: 3 } }),
        prisma.approval.count({ where: { decision: "PENDING", level: 4 } }),
      ]),

      // 4. User Counts (Total, Active, Inactive)
      Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.user.count({ where: { isActive: false } }),
      ]),

      // 5. Expiring VMs Counts
      Promise.all([
        prisma.vmInstance.count({
          where: {
            status: VmStatus.ACTIVE,
            renewalDate: { gte: now, lte: in30Days },
          },
        }),
        prisma.vmInstance.count({
          where: {
            status: VmStatus.ACTIVE,
            renewalDate: { gte: now, lte: in60Days },
          },
        }),
        prisma.vmInstance.count({
          where: {
            status: VmStatus.ACTIVE,
            renewalDate: { gte: now, lte: in90Days },
          },
        }),
      ]),

      // 6. Expiring Licenses Counts
      Promise.all([
        prisma.softwareLicense.count({
          where: { expiryDate: { gte: now, lte: in30Days } },
        }),
        prisma.softwareLicense.count({
          where: { expiryDate: { gte: now, lte: in60Days } },
        }),
        prisma.softwareLicense.count({
          where: { expiryDate: { gte: now, lte: in90Days } },
        }),
      ]),

      // 7. Pipeline Groupings
      prisma.request.groupBy({
        by: ["status"],
        _count: { id: true },
      }),

      // 8. VM Specs (for allocated CPU, RAM, Storage)
      prisma.vmSpec.findMany({
        select: { vcpu: true, ramGb: true, storageGb: true },
      }),

      // 9. Physical Server Assets (for total infrastructure capacity)
      prisma.asset.findMany({
        where: { type: "SERVER" },
        select: { cpuCores: true, ramGb: true, storageGb: true },
      }),

      // 10. Expiring VMs Detailed List (top 5)
      prisma.vmInstance.findMany({
        where: {
          status: VmStatus.ACTIVE,
          renewalDate: { gte: now, lte: in60Days },
        },
        orderBy: { renewalDate: "asc" },
        take: 5,
        include: {
          owner: { select: { name: true } },
          request: { select: { systemName: true } },
        },
      }),

      // 11. Expiring Licenses Detailed List (top 5)
      prisma.softwareLicense.findMany({
        where: { expiryDate: { gte: now, lte: in60Days } },
        orderBy: { expiryDate: "asc" },
        take: 5,
        select: { id: true, name: true, vendor: true, expiryDate: true },
      }),

      // 12. Stuck Requests (> 48 hours in pending status)
      prisma.request.findMany({
        where: {
          status: { in: [RequestStatus.PENDING_L1, RequestStatus.PENDING_L2, RequestStatus.PENDING_L3, RequestStatus.PENDING_L4, RequestStatus.APPROVED] },
          createdAt: { lte: fortyEightHoursAgo },
        },
        orderBy: { createdAt: "asc" },
        take: 5,
        include: {
          requester: { select: { name: true } },
        },
      }),

      // 13. Recent Audit Logs
      prisma.auditLog.findMany({
        take: 10,
        orderBy: { timestamp: "desc" },
        include: {
          actor: { select: { name: true, email: true } },
        },
      }),

      // 14. System Health Check
      checkSystemHealth(),
    ]);

    // Format Pipeline Counts
    const pipelineMap: Record<string, number> = {};
    for (const group of pipelineGroupings) {
      pipelineMap[group.status] = group._count.id;
    }

    const pendingDcOps = (pipelineMap[RequestStatus.APPROVED] || 0) + (pipelineMap[RequestStatus.PARTIALLY_PROVISIONED] || 0);

    const pipelineCounts: RequestPipelineCounts = {
      draft: pipelineMap[RequestStatus.DRAFT] || 0,
      l1: pipelineMap[RequestStatus.PENDING_L1] || 0,
      l2: pipelineMap[RequestStatus.PENDING_L2] || 0,
      l3: pipelineMap[RequestStatus.PENDING_L3] || 0,
      l4: pipelineMap[RequestStatus.PENDING_L4] || 0,
      dcops: pendingDcOps,
      provisioned: pipelineMap[RequestStatus.PROVISIONED] || 0,
      closed: pipelineMap[RequestStatus.CLOSED] || 0,
    };

    // Calculate Resource Overview
    const allocatedCpu = vmSpecs.reduce((sum, s) => sum + (s.vcpu || 0), 0);
    const allocatedRamGb = vmSpecs.reduce((sum, s) => sum + (s.ramGb || 0), 0);
    const allocatedStorageGb = vmSpecs.reduce((sum, s) => sum + (s.storageGb || 0), 0);

    const hostTotalCpu = serverAssets.reduce((sum, h) => sum + (h.cpuCores || 0), 0);
    const hostTotalRamGb = serverAssets.reduce((sum, h) => sum + (h.ramGb || 0), 0);
    const hostTotalStorageGb = serverAssets.reduce((sum, h) => sum + (h.storageGb || 0), 0);

    // Fallbacks if physical host inventory is not fully populated yet
    const totalCpu = Math.max(hostTotalCpu, allocatedCpu > 0 ? Math.round(allocatedCpu * 1.4) : 256);
    const totalRamGb = Math.max(hostTotalRamGb, allocatedRamGb > 0 ? Math.round(allocatedRamGb * 1.3) : 1024);
    const totalStorageGb = Math.max(hostTotalStorageGb, allocatedStorageGb > 0 ? Math.round(allocatedStorageGb * 1.4) : 20480);

    const resourceOverview: ResourceOverviewData = {
      cpu: {
        allocated: allocatedCpu,
        available: Math.max(0, totalCpu - allocatedCpu),
        total: totalCpu,
        utilizationPercent: totalCpu > 0 ? Math.min(100, Math.round((allocatedCpu / totalCpu) * 100)) : 0,
      },
      ram: {
        allocatedGb: allocatedRamGb,
        availableGb: Math.max(0, totalRamGb - allocatedRamGb),
        totalGb: totalRamGb,
        utilizationPercent: totalRamGb > 0 ? Math.min(100, Math.round((allocatedRamGb / totalRamGb) * 100)) : 0,
      },
      storage: {
        allocatedGb: allocatedStorageGb,
        availableGb: Math.max(0, totalStorageGb - allocatedStorageGb),
        totalGb: totalStorageGb,
        utilizationPercent: totalStorageGb > 0 ? Math.min(100, Math.round((allocatedStorageGb / totalStorageGb) * 100)) : 0,
      },
    };

    // Format Expiry & Attention Items
    const expiringVmsFormatted: ExpiringVmItem[] = expiringVmsList.map(vm => {
      const remainingMs = vm.renewalDate ? new Date(vm.renewalDate).getTime() - now.getTime() : 0;
      return {
        id: vm.id,
        hostname: vm.hostname || `VM-${vm.sequenceNumber}`,
        systemName: vm.request?.systemName || vm.systemName || "VM Instance",
        ownerName: vm.owner?.name || "Unassigned",
        renewalDate: vm.renewalDate,
        daysRemaining: Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24))),
      };
    });

    const expiringLicensesFormatted: ExpiringLicenseItem[] = expiringLicensesList.map(lic => {
      const remainingMs = lic.expiryDate ? new Date(lic.expiryDate).getTime() - now.getTime() : 0;
      return {
        id: lic.id,
        name: lic.name,
        vendor: lic.vendor,
        expiryDate: lic.expiryDate,
        daysRemaining: Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24))),
      };
    });

    const stuckRequestsFormatted: StuckRequestItem[] = stuckRequestsList.map(req => {
      const waitingMs = now.getTime() - new Date(req.createdAt).getTime();
      return {
        id: req.id,
        systemName: req.systemName,
        requestType: req.requestType,
        status: req.status,
        requesterName: req.requester?.name || "Requester",
        createdAt: req.createdAt,
        hoursWaiting: Math.round(waitingMs / (1000 * 60 * 60)),
      };
    });

    // Format Recent Activities
    const recentActivities: DashboardRecentActivity[] = recentAuditLogs.map(log => ({
      id: log.id,
      type: log.action.includes("REQUEST") ? "request" : log.action.includes("VM") ? "vm" : log.action.includes("APPROVAL") ? "approval" : "user",
      action: log.action.replace(/_/g, " "),
      title: log.action.replace(/_/g, " "),
      subtitle: log.actor?.name ? `By ${log.actor.name}` : "System event",
      actorName: log.actor?.name,
      timestamp: log.timestamp,
      status: log.entityType || undefined,
    }));

    const systemAlertsCount = systemHealth.filter(h => h.status !== "healthy").length;

    const kpis: AdminKPIs = {
      totalVms: {
        total: vmCounts[0],
        active: vmCounts[1],
        suspended: vmCounts[2],
        retired: vmCounts[3],
      },
      totalRequests: {
        total: requestCounts[0],
        thisMonth: requestCounts[1],
        pending: requestCounts[2],
      },
      pendingApprovals: {
        total: approvalLevelCounts[0] + approvalLevelCounts[1] + approvalLevelCounts[2] + approvalLevelCounts[3],
        l1: approvalLevelCounts[0],
        l2: approvalLevelCounts[1],
        l3: approvalLevelCounts[2],
        l4: approvalLevelCounts[3],
      },
      pendingDcOps,
      activeUsers: {
        total: userCounts[0],
        active: userCounts[1],
        inactive: userCounts[2],
      },
      expiringVms: {
        next30Days: expiringVmsCounts[0],
        next60Days: expiringVmsCounts[1],
        next90Days: expiringVmsCounts[2],
      },
      expiringLicenses: {
        next30Days: expiringLicensesCounts[0],
        next60Days: expiringLicensesCounts[1],
        next90Days: expiringLicensesCounts[2],
      },
      systemAlertsCount,
    };

    return {
      kpis,
      requestPipeline: pipelineCounts,
      resourceOverview,
      systemHealth,
      expiryAndAttention: {
        expiringVms: expiringVmsFormatted,
        expiringLicenses: expiringLicensesFormatted,
        stuckRequests: stuckRequestsFormatted,
      },
      recentActivities,
    };
  }, 10);
}
