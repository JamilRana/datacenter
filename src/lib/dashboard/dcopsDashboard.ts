// src/lib/dashboard/dcopsDashboard.ts
import prisma from "@/lib/prisma";
import { getCachedData } from "@/lib/redis";
import {
  DcopsDashboardData,
  DcopsKPIs,
  ExecutionQueueItem,
  MultiVmProgressItem,
  ResourceCapacityGauges,
  OperationalAlertItem,
  DashboardRecentActivity
} from "@/types/dashboard";
export type { DcopsDashboardData };
import { RequestStatus, VmStatus } from "@prisma/client";

export async function getDcopsDashboardData(): Promise<DcopsDashboardData> {
  return getCachedData("dcops_dashboard_data_v2", async () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const [
      pendingProvisioningCount,
      provisioningTodayCount,
      activeVmsCount,
      expiringVms30DaysCount,
      openCustomizationsCount,
      openDecommissionsCount,
      executionQueueRequests,
      multiVmRequests,
      vmSpecs,
      serverAssets,
      expiringSoonLicenses,
      stuckRequests,
      recentAuditLogs,
    ] = await Promise.all([
      // 1. Pending Provisioning Count
      prisma.request.count({
        where: {
          status: { in: [RequestStatus.APPROVED, RequestStatus.PARTIALLY_PROVISIONED] },
        },
      }),

      // 2. Provisioned / Created Today
      prisma.vmInstance.count({
        where: {
          createdAt: { gte: startOfToday },
        },
      }),

      // 3. Active VMs Count
      prisma.vmInstance.count({
        where: { status: VmStatus.ACTIVE },
      }),

      // 4. Expiring VMs in 30 Days
      prisma.vmInstance.count({
        where: {
          status: VmStatus.ACTIVE,
          renewalDate: { gte: now, lte: in30Days },
        },
      }),

      // 5. Open Customizations
      prisma.customizationRequest.count({
        where: { status: { in: ["APPROVED", "PENDING_L1", "PENDING_L2", "PENDING_L3"] } },
      }),

      // 6. Open Decommissions
      prisma.request.count({
        where: {
          requestType: "DECOMMISSION",
          status: { in: [RequestStatus.APPROVED, RequestStatus.PENDING_L1, RequestStatus.PENDING_L2] },
        },
      }),

      // 7. Execution Queue Requests (Approved requests awaiting provisioning)
      prisma.request.findMany({
        where: {
          status: { in: [RequestStatus.APPROVED, RequestStatus.PARTIALLY_PROVISIONED] },
        },
        orderBy: { updatedAt: "asc" },
        take: 15,
        include: {
          requester: { select: { name: true, organization: true } },
          vmInstances: { select: { id: true, hostname: true, status: true, sequenceNumber: true } },
          approvals: {
            where: { decision: "APPROVED" },
            orderBy: { decidedAt: "desc" },
            take: 1,
            select: { decidedAt: true },
          },
        },
      }),

      // 8. Multi-VM Requests (requests with quantity > 1 or multiple VM specs)
      prisma.request.findMany({
        where: {
          quantity: { gt: 1 },
          status: { in: [RequestStatus.APPROVED, RequestStatus.PARTIALLY_PROVISIONED, RequestStatus.PROVISIONED] },
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: {
          vmInstances: {
            orderBy: { sequenceNumber: "asc" },
            select: { sequenceNumber: true, hostname: true, ipAddress: true, status: true },
          },
        },
      }),

      // 9. VM Specs (for allocated CPU, RAM, Storage)
      prisma.vmSpec.findMany({
        select: { vcpu: true, ramGb: true, storageGb: true },
      }),

      // 10. Server Assets (for total infrastructure capacity)
      prisma.asset.findMany({
        where: { type: "SERVER" },
        select: { cpuCores: true, ramGb: true, storageGb: true },
      }),

      // 11. Licenses Expiring within 7 days
      prisma.softwareLicense.findMany({
        where: { expiryDate: { gte: now, lte: in7Days } },
        take: 3,
        select: { id: true, name: true, vendor: true, expiryDate: true },
      }),

      // 12. Requests stuck > 48 hours
      prisma.request.findMany({
        where: {
          status: { in: [RequestStatus.APPROVED, RequestStatus.PENDING_L1, RequestStatus.PENDING_L2, RequestStatus.PENDING_L3] },
          createdAt: { lte: fortyEightHoursAgo },
        },
        take: 5,
        select: { id: true, systemName: true, createdAt: true, status: true },
      }),

      // 13. Recent DC_OPS Audit Logs
      prisma.auditLog.findMany({
        where: {
          action: { in: ["PROVISION_VM", "EXECUTE_REQUEST", "SUSPEND_VM", "DELETE_VM", "ACTIVATE_VM", "APPLY_CUSTOMIZATION", "CREATE_ACCESS_REQUEST"] },
        },
        take: 10,
        orderBy: { timestamp: "desc" },
        include: {
          actor: { select: { name: true, email: true } },
        },
      }),
    ]);

    // Resource Capacity Calculations
    const allocatedCpu = vmSpecs.reduce((sum, s) => sum + (s.vcpu || 0), 0);
    const allocatedRamGb = vmSpecs.reduce((sum, s) => sum + (s.ramGb || 0), 0);
    const allocatedStorageGb = vmSpecs.reduce((sum, s) => sum + (s.storageGb || 0), 0);

    const hostTotalCpu = serverAssets.reduce((sum, h) => sum + (h.cpuCores || 0), 0);
    const hostTotalRamGb = serverAssets.reduce((sum, h) => sum + (h.ramGb || 0), 0);
    const hostTotalStorageGb = serverAssets.reduce((sum, h) => sum + (h.storageGb || 0), 0);

    const totalCpu = Math.max(hostTotalCpu, allocatedCpu > 0 ? Math.round(allocatedCpu * 1.4) : 256);
    const totalRamGb = Math.max(hostTotalRamGb, allocatedRamGb > 0 ? Math.round(allocatedRamGb * 1.3) : 1024);
    const totalStorageGb = Math.max(hostTotalStorageGb, allocatedStorageGb > 0 ? Math.round(allocatedStorageGb * 1.4) : 20480);

    const cpuUtilPercent = totalCpu > 0 ? Math.min(100, Math.round((allocatedCpu / totalCpu) * 100)) : 0;
    const ramUtilPercent = totalRamGb > 0 ? Math.min(100, Math.round((allocatedRamGb / totalRamGb) * 100)) : 0;
    const storageUtilPercent = totalStorageGb > 0 ? Math.min(100, Math.round((allocatedStorageGb / totalStorageGb) * 100)) : 0;

    const resourceCapacity: ResourceCapacityGauges = {
      cpu: {
        allocated: allocatedCpu,
        total: totalCpu,
        available: Math.max(0, totalCpu - allocatedCpu),
        utilizationPercent: cpuUtilPercent,
      },
      ram: {
        allocatedGb: allocatedRamGb,
        totalGb: totalRamGb,
        availableGb: Math.max(0, totalRamGb - allocatedRamGb),
        utilizationPercent: ramUtilPercent,
      },
      storage: {
        allocatedGb: allocatedStorageGb,
        totalGb: totalStorageGb,
        availableGb: Math.max(0, totalStorageGb - allocatedStorageGb),
        utilizationPercent: storageUtilPercent,
      },
      isOverAllocated: cpuUtilPercent > 85 || ramUtilPercent > 85 || storageUtilPercent > 85,
      totalHostsCount: serverAssets.length,
      activeHostsCount: serverAssets.length,
    };

    // Format Execution Queue
    const executionQueue: ExecutionQueueItem[] = executionQueueRequests.map(req => {
      const approvedAt = req.approvals[0]?.decidedAt || req.updatedAt;
      const hoursWaiting = approvedAt ? Math.round((now.getTime() - new Date(approvedAt).getTime()) / (1000 * 60 * 60)) : 0;
      const priority = hoursWaiting > 48 || req.environment === "PRODUCTION" ? "HIGH" : hoursWaiting > 24 ? "NORMAL" : "LOW";

      return {
        id: req.id,
        requestId: req.requestId || req.id.slice(0, 8),
        systemName: req.systemName,
        requestType: req.requestType,
        totalVms: req.quantity || 1,
        provisionedVms: req.vmInstances.length,
        approvedAt,
        hoursWaiting,
        priority,
        requesterName: req.requester?.name || "Requester",
        environment: req.environment,
        vcpu: req.vcpu || undefined,
        ramGb: req.ramGb || undefined,
        storageGb: req.storageGb || undefined,
      };
    });

    // Format Multi-VM Progress
    const multiVmProgress: MultiVmProgressItem[] = multiVmRequests.map(req => {
      const vmMap = new Map(req.vmInstances.map(vm => [vm.sequenceNumber, vm]));
      const vmDetails: MultiVmProgressItem["vmDetails"] = [];

      for (let i = 1; i <= (req.quantity || 1); i++) {
        const vm = vmMap.get(i);
        vmDetails.push({
          sequence: i,
          hostname: vm?.hostname || null,
          ipAddress: vm?.ipAddress || null,
          status: vm ? "PROVISIONED" : "PENDING",
        });
      }

      return {
        requestId: req.requestId || req.id.slice(0, 8),
        systemName: req.systemName,
        totalVms: req.quantity || 1,
        completedVms: req.vmInstances.length,
        vmDetails,
      };
    });

    // Operational Alerts
    const operationalAlerts: OperationalAlertItem[] = [];

    if (storageUtilPercent >= 85) {
      operationalAlerts.push({
        id: "alert-storage-high",
        level: "critical",
        title: `Storage Capacity Critical (${storageUtilPercent}%)`,
        description: `Datacenter storage utilization is above threshold. ${resourceCapacity.storage.availableGb} GB remaining.`,
        timestamp: now,
        actionHref: "/inventory",
      });
    }

    if (expiringVms30DaysCount > 0) {
      operationalAlerts.push({
        id: "alert-vms-expiring",
        level: "warning",
        title: `${expiringVms30DaysCount} VMs Expiring Soon`,
        description: `${expiringVms30DaysCount} virtual machines are due for renewal or decommissioning within 30 days.`,
        timestamp: now,
        actionHref: "/inventory/vms",
      });
    }

    if (stuckRequests.length > 0) {
      operationalAlerts.push({
        id: "alert-stuck-requests",
        level: "warning",
        title: `${stuckRequests.length} Requests Waiting > 48 Hours`,
        description: "Approved or pending requests have been awaiting action for over 48 hours.",
        timestamp: now,
        actionHref: "/requests?status=APPROVED",
      });
    }

    for (const lic of expiringSoonLicenses) {
      operationalAlerts.push({
        id: `alert-lic-${lic.id}`,
        level: "warning",
        title: `License Expiring: ${lic.name}`,
        description: `License for ${lic.name} (${lic.vendor}) expires in less than 7 days.`,
        timestamp: now,
        actionHref: "/inventory/licenses",
      });
    }

    // Recent Activities
    const recentActivities: DashboardRecentActivity[] = recentAuditLogs.map(log => ({
      id: log.id,
      type: "vm",
      action: log.action.replace(/_/g, " "),
      title: log.action.replace(/_/g, " "),
      subtitle: log.actor?.name ? `Executed by ${log.actor.name}` : "DC-Ops execution",
      actorName: log.actor?.name,
      timestamp: log.timestamp,
      status: log.entityType || undefined,
    }));

    const kpis: DcopsKPIs = {
      pendingProvisioning: pendingProvisioningCount,
      provisioningToday: provisioningTodayCount,
      activeVms: activeVmsCount,
      availableCpu: resourceCapacity.cpu.available,
      availableRamGb: resourceCapacity.ram.availableGb,
      availableStorageGb: resourceCapacity.storage.availableGb,
      expiringVms30Days: expiringVms30DaysCount,
      openOperations: openCustomizationsCount + openDecommissionsCount,
    };

    return {
      kpis,
      executionQueue,
      multiVmProgress,
      resourceCapacity,
      operationalAlerts,
      recentActivities,
    };
  }, 10);
}
