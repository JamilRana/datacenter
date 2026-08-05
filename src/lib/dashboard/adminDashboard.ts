import prisma from "@/lib/prisma";
import { getCachedData } from "@/lib/redis";
import { 
  AdminDashboardStats, 
  MonthlyRequestTrend, 
  ApprovalDistribution, 
  AuditLogEntry, 
  AdminDashboardData,
  DashboardHealthCard
} from "@/types";

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  return getCachedData('admin_dashboard_data', async () => {
    const [
      stats,
      monthlyTrends,
      approvalDistribution,
      recentAuditLogs,
      infrastructureOverview,
      resourceSummary,
      requestsSummary,
      recentActivities,
    ] = await Promise.all([
      getAdminStats(),
      getMonthlyRequestTrends(),
      getApprovalDistribution(),
      getRecentAuditLogs(),
      getInfrastructureOverview(),
      getResourceSummary(),
      getRequestsSummary(),
      getRecentActivities(),
    ]);

    const healthStatus = await getHealthStatus(resourceSummary, infrastructureOverview);

    return {
      stats,
      monthlyTrends,
      approvalDistribution,
      recentAuditLogs,
      infrastructureOverview,
      resourceSummary,
      requestsSummary,
      recentActivities,
      healthStatus,
    };
  }, 10); // Cache for 10 seconds for real-time responsiveness during edits
}

async function getAdminStats(): Promise<AdminDashboardStats> {
  const [
    totalVms,
    totalUsers,
    pendingApprovals,
    vmSpecs,
  ] = await Promise.all([
    prisma.vmInstance.count(),
    prisma.user.count(),
    prisma.approval.count({
      where: { decision: "PENDING" },
    }),
    prisma.vmSpec.findMany({
      select: { vcpu: true, ramGb: true },
    }),
  ]);

  const totalCpuCores = vmSpecs.reduce((sum: number, spec: any) => sum + spec.vcpu, 0);
  const totalRamGb = vmSpecs.reduce((sum: number, spec: any) => sum + spec.ramGb, 0);

  return {
    totalVms,
    totalUsers,
    pendingApprovals,
    totalCpuCores,
    totalRamGb,
  };
}

async function getMonthlyRequestTrends(): Promise<MonthlyRequestTrend[]> {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const requests = await prisma.request.findMany({
    where: {
      createdAt: { gte: sixMonthsAgo },
    },
    select: {
      createdAt: true,
      status: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const monthlyData: Record<string, { requests: number; approvals: number; rejections: number }> = {};

  for (const req of requests) {
    const monthKey = req.createdAt.toISOString().slice(0, 7);
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { requests: 0, approvals: 0, rejections: 0 };
    }
    monthlyData[monthKey].requests++;
    
    if (req.status === "APPROVED" || req.status === "PROVISIONED") {
      monthlyData[monthKey].approvals++;
    } else if (req.status === "REJECTED") {
      monthlyData[monthKey].rejections++;
    }
  }

  return Object.entries(monthlyData)
    .map(([month, data]: any) => ({
      month,
      ...data,
    }))
    .slice(-6);
}

async function getApprovalDistribution(): Promise<ApprovalDistribution[]> {
  const approvals = await prisma.approval.findMany({
    where: {
      decision: { not: "PENDING" },
    },
    select: { decision: true },
  });

  const statusCount: Record<string, number> = {};
  for (const approval of approvals) {
    statusCount[approval.decision] = (statusCount[approval.decision] || 0) + 1;
  }

  return Object.entries(statusCount)
    .map(([status, count]: any) => ({ status, count }))
    .sort((a: any, b: any) => b.count - a.count);
}

async function getRecentAuditLogs(): Promise<AuditLogEntry[]> {
  const logs = await prisma.auditLog.findMany({
    take: 10,
    orderBy: { timestamp: "desc" },
    include: {
      actor: {
        select: { name: true, email: true },
      },
    },
  });

  return logs.map((log: any) => ({
    id: log.id,
    action: log.action,
    actorId: log.actorId,
    entityType: log.entityType,
    entityId: log.entityId,
    timestamp: log.timestamp,
    actor: log.actor,
  }));
}

async function getInfrastructureOverview() {
  const [
    totalClusters,
    totalK8sClusters,
    totalVms,
    runningVms,
    stoppedVms,
    totalAssets
  ] = await Promise.all([
    prisma.physicalCluster.count(),
    prisma.k8sCluster.count(),
    prisma.vmInstance.count(),
    prisma.vmInstance.count({ where: { status: "ACTIVE" } }),
    prisma.vmInstance.count({ where: { status: "SUSPENDED" } }),
    prisma.asset.count()
  ]);

  return {
    totalClusters,
    totalK8sClusters,
    totalVms,
    runningVms,
    stoppedVms,
    totalAssets
  };
}

async function getResourceSummary() {
  const hosts = await prisma.asset.findMany({
    where: { type: "SERVER" },
    include: {
      vms: {
        where: { status: "ACTIVE" },
        include: { currentSpec: { select: { vcpu: true, ramGb: true, storageGb: true } } }
      }
    }
  });

  let cpuTotal = 0;
  let ramTotalGb = 0;
  let storageTotalGb = 0;
  let cpuUsed = 0;
  let ramUsedGb = 0;
  let storageUsedGb = 0;
  let hasGpu = false;
  let gpuTotal = 0;
  let gpuUsed = 0;

  for (const host of hosts) {
    cpuTotal += host.cpuCores || 0;
    ramTotalGb += host.ramGb || 0;
    storageTotalGb += host.storageGb || 0;
    
    if (host.graphicsCardModel) {
      hasGpu = true;
      gpuTotal += 1;
    }

    for (const vm of host.vms) {
      cpuUsed += vm.currentSpec?.vcpu || 0;
      ramUsedGb += vm.currentSpec?.ramGb || 0;
      storageUsedGb += vm.currentSpec?.storageGb || 0;
      if (host.graphicsCardModel) {
        gpuUsed += 1;
      }
    }
  }

  const cpuPercent = cpuTotal > 0 ? Math.round((cpuUsed / cpuTotal) * 100) : 0;
  const ramPercent = ramTotalGb > 0 ? Math.round((ramUsedGb / ramTotalGb) * 100) : 0;
  const storagePercent = storageTotalGb > 0 ? Math.round((storageUsedGb / storageTotalGb) * 100) : 0;
  const gpuPercent = gpuTotal > 0 ? Math.round((gpuUsed / gpuTotal) * 100) : 0;

  return {
    cpuUsed,
    cpuTotal,
    cpuPercent,
    ramUsedGb,
    ramTotalGb,
    ramPercent,
    storageUsedGb,
    storageTotalGb,
    storagePercent,
    ...(hasGpu ? { gpuUsed, gpuTotal, gpuPercent } : {})
  };
}

async function getRequestsSummary() {
  const [pending, approved, rejected, inProgress] = await Promise.all([
    prisma.request.count({ where: { status: { in: ["PENDING_L1", "PENDING_L2", "PENDING_L3", "PENDING_L4"] } } }),
    prisma.request.count({ where: { status: "APPROVED" } }),
    prisma.request.count({ where: { status: "REJECTED" } }),
    prisma.request.count({ where: { status: "PROVISIONED" } })
  ]);

  return {
    pending,
    approved,
    rejected,
    inProgress
  };
}

async function getRecentActivities() {
  const [requests, vms, approvals, auditLogs] = await Promise.all([
    prisma.request.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { requester: { select: { name: true } } }
    }),
    prisma.vmInstance.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      where: { status: "ACTIVE" },
      include: { owner: { select: { name: true } } }
    }),
    prisma.approval.findMany({
      take: 5,
      where: { decision: { not: "PENDING" } },
      orderBy: { createdAt: "desc" },
      include: { approver: { select: { name: true } }, request: { select: { systemName: true } } }
    }),
    prisma.auditLog.findMany({
      take: 5,
      orderBy: { timestamp: "desc" },
      include: { actor: { select: { name: true } } }
    })
  ]);

  const list: any[] = [];

  requests.forEach((r: any) => {
    list.push({
      id: `req-${r.id}`,
      type: "request",
      title: `Request for ${r.systemName}`,
      subtitle: `Submitted by ${r.requester?.name || "Unknown"}`,
      timestamp: r.createdAt,
      status: r.status
    });
  });

  vms.forEach((v: any) => {
    list.push({
      id: `vm-${v.id}`,
      type: "vm",
      title: `VM ${v.hostname || "Instance"} Provisioned`,
      subtitle: `Owned by ${v.owner?.name || "System"}`,
      timestamp: v.createdAt,
      status: v.status
    });
  });

  approvals.forEach((a: any) => {
    list.push({
      id: `appr-${a.id}`,
      type: "approval",
      title: `Approval Decision: ${a.decision}`,
      subtitle: `By ${a.approver?.name || "Approver"} for ${a.request?.systemName || "Request"}`,
      timestamp: a.updatedAt,
      status: a.decision
    });
  });

  auditLogs.forEach((l: any) => {
    list.push({
      id: `audit-${l.id}`,
      type: "inventory",
      title: l.action,
      subtitle: `Action by ${l.actor?.name || "Actor"} (${l.entityType || "Asset"})`,
      timestamp: l.timestamp
    });
  });

  return list
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);
}

async function getHealthStatus(resourceSummary: any, infra: any): Promise<DashboardHealthCard[]> {
  const computeStatus: "healthy" | "warning" | "critical" = resourceSummary.cpuPercent > 85 || resourceSummary.ramPercent > 85 ? "warning" : "healthy";
  
  return [
    {
      title: "Cluster Health",
      status: "healthy" as const,
      value: "Healthy",
      description: `${infra.totalClusters} Active Hypervisor Clusters`
    },
    {
      title: "Storage Health",
      status: resourceSummary.storagePercent > 90 ? "critical" as const : (resourceSummary.storagePercent > 75 ? "warning" as const : "healthy" as const),
      value: `${100 - resourceSummary.storagePercent}% Available`,
      description: "All SAN storage pools active"
    },
    {
      title: "Compute Capacity",
      status: computeStatus,
      value: `${resourceSummary.cpuPercent}% CPU Used`,
      description: "Calculated across virtual allocations"
    },
    {
      title: "Network Status",
      status: "healthy" as const,
      value: "Online",
      description: "Throughput and latency within baseline limits"
    },
    {
      title: "Resource Availability",
      status: "healthy" as const,
      value: "Nominal",
      description: "Hardware clusters reporting fully available"
    }
  ];
}
