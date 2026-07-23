import prisma from "@/lib/prisma";
import { getCachedData } from "@/lib/redis";
import { AdminDashboardStats, MonthlyRequestTrend, ApprovalDistribution, AuditLogEntry, AdminDashboardData } from "@/types";

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  return getCachedData('admin_dashboard_data', async () => {
    const [
      stats,
      monthlyTrends,
      approvalDistribution,
      recentAuditLogs,
    ] = await Promise.all([
      getAdminStats(),
      getMonthlyRequestTrends(),
      getApprovalDistribution(),
      getRecentAuditLogs(),
    ]);

    return {
      stats,
      monthlyTrends,
      approvalDistribution,
      recentAuditLogs,
    };
  }, 300); // Cache for 5 minutes
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
