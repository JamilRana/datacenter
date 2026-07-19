// src/app/actions/report-actions.ts
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { ROLES } from "@/lib/roles";
import { 
  Environment, 
  RequestType, 
  RequestStatus,
  Prisma 
} from "@prisma/client";
import { 
  startOfDay, 
  endOfDay, 
  subDays, 
  format, 
  parseISO, 
  differenceInHours 
} from "date-fns";

// ============================================================================
// FILTER & RETURN TYPE INTERFACES (Flattened - No Prisma internals)
// ============================================================================

export interface ReportFilters {
  startDate?: string;      // ISO: "2024-01-01"
  endDate?: string;        // ISO: "2024-12-31"
  environment?: Environment;
  status?: RequestStatus;
  requestType?: RequestType;
  userId?: string;
}

export interface EnvDistributionItem {
  environment: Environment;
  count: number;
  percentage: number;  // 0-100
}

export interface TypeDistributionItem {
  type: RequestType;
  count: number;
  percentage: number;
}

export interface StatusDistributionItem {
  status: RequestStatus;
  count: number;
  percentage: number;
}

export interface TrendDataPoint {
  day: string;           // ISO: "2024-01-15"
  new: number;           // New requests created
  approved: number;      // Requests approved
  provisioned: number;   // VMs provisioned
}

export interface TopRequesterItem {
  userId: string;
  name: string | null;
  email: string | null;
  department: string | null;  // from User.organization
  requestCount: number;
  avgApprovalTimeHours: number;
}

export interface DepartmentBreakdownItem {
  department: string;
  requestCount: number;
  budgetUsed: number;  // Estimated cost
  percentage: number;
}

export interface ResourceMetricItem {
  environment: Environment | null;
  avgCpu: number;
  avgRam: number;
  avgStorage: number;
  growthRate: number;
}

export interface ApprovalFunnelItem {
  stage: string;              // "DRAFT", "PENDING_L1", etc.
  count: number;
  conversionRate: number;     // Percentage from previous stage
}

export interface SystemReportData {
  summary: {
    totalVMs: number;
    activeRequests: number;
    pendingApprovals: number;
    avgApprovalTimeHours: number;
    totalLicenses: number;
    resourceUtilization: number;  // 0-100 percentage
  };
  envDistribution: EnvDistributionItem[];
  typeDistribution: TypeDistributionItem[];
  statusDistribution: StatusDistributionItem[];
  trends: TrendDataPoint[];
  topRequesters: TopRequesterItem[];
  departmentBreakdown: DepartmentBreakdownItem[];
  resourceMetrics: ResourceMetricItem[];
  approvalFunnel: ApprovalFunnelItem[];
  timestamp: string;  // ISO string
}

export interface ExportReportRow {
  RequestID: string;
  SystemName: string;
  ProjectName: string;
  RequestType: RequestType;
  Status: RequestStatus;
  Environment: Environment;
  Requester: string;
  Email: string;
  Department: string;
  CreatedDate: string;      // "yyyy-MM-dd HH:mm"
  ApprovedDate: string;     // "yyyy-MM-dd" or "Pending"
  ProvisionedDate: string;  // "yyyy-MM-dd" or "N/A"
  vCPU: number | null;
  RAM_GB: number | null;
  Storage_GB: number | null;
  ApprovalLevel: string;
  ApprovalDecision: string;
}

// ============================================================================
// MAIN REPORT FUNCTION
// ============================================================================

export async function getSystemReportData(filters: ReportFilters = {}): Promise<SystemReportData> {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const isAdmin = session.user.roles?.includes(ROLES.ADMIN);
  const isApprover = session.user.roles?.includes(ROLES.DCOPS);
  
  if (!isAdmin && !isApprover) {
    throw new Error("Forbidden: Access restricted to administrative roles.");
  }

  // Build date filter matching Prisma.DateTimeFilter
  const dateFilter: Prisma.DateTimeFilter = {};
  if (filters.startDate) {
    dateFilter.gte = startOfDay(parseISO(filters.startDate));
  }
  if (filters.endDate) {
    dateFilter.lte = endOfDay(parseISO(filters.endDate));
  }

  // Build where clause matching Request model fields
  const whereClause: Prisma.RequestWhereInput = {
    ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
    ...(filters.environment && { environment: filters.environment }),
    ...(filters.status && { status: filters.status }),
    ...(filters.requestType && { requestType: filters.requestType }),
    ...(filters.userId && { requesterId: filters.userId }),
  };

  // 1. High-Level Summary Counts
  const [vmsCount, requestsCount, pendingCount, licensesCount] = await Promise.all([
    prisma.vmInstance.count({ where: { status: "ACTIVE" } }),
    prisma.request.count({ where: whereClause }),
    prisma.request.count({ 
      where: { 
        ...whereClause, 
        status: { in: ["PENDING_L1", "PENDING_L2", "PENDING_L3", "PENDING_L4"] as RequestStatus[] } 
      } 
    }),
    prisma.softwareLicense.count(),
  ]);

  // Calculate average approval time - get from approvals relation
  const approvedRequests = await prisma.request.findMany({
    where: { 
      status: "APPROVED", 
      submittedAt: { not: null },
      ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
    },
    include: {
      approvals: {
        where: { decision: "APPROVED" },
        orderBy: { decidedAt: 'asc' },
        take: 1
      }
    }
  });
  
  const avgApprovalTimeHours = approvedRequests.length > 0
    ? approvedRequests.reduce((acc, r) => {
        const approvedApproval = r.approvals[0];
        if (approvedApproval?.decidedAt && r.submittedAt) {
          return acc + differenceInHours(approvedApproval.decidedAt, r.submittedAt);
        }
        return acc;
      }, 0) / approvedRequests.length
    : 0;

  const totalForPercent = requestsCount || 1;

  // 2. Environment Distribution (flatten Prisma groupBy result)
  const envGroups = await prisma.request.groupBy({
    by: ['environment'],
    _count: { _all: true },
    where: whereClause
  });

  const envDistribution: EnvDistributionItem[] = envGroups.map(g => ({
    environment: g.environment as Environment,
    count: g._count._all,
    percentage: Math.round((g._count._all / totalForPercent) * 100)
  }));

  // 3. Request Type Distribution
  const typeGroups = await prisma.request.groupBy({
    by: ['requestType'],
    _count: { _all: true },
    where: whereClause
  });

  const typeDistribution: TypeDistributionItem[] = typeGroups.map(g => ({
    type: g.requestType as RequestType,
    count: g._count._all,
    percentage: Math.round((g._count._all / totalForPercent) * 100)
  }));

  // 4. Status Distribution
  const statusGroups = await prisma.request.groupBy({
    by: ['status'],
    _count: { _all: true },
    where: whereClause
  });

  const statusDistribution: StatusDistributionItem[] = statusGroups.map(g => ({
    status: g.status as RequestStatus,
    count: g._count._all,
    percentage: Math.round((g._count._all / totalForPercent) * 100)
  }));

  // 5. Trend Data (Last 30 Days) - Multi-metric
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const d = subDays(new Date(), 29 - i);
    return format(d, 'yyyy-MM-dd');
  });

  const trends: TrendDataPoint[] = await Promise.all(last30Days.map(async (day) => {
    const dayStart = startOfDay(parseISO(day));
    const dayEnd = endOfDay(parseISO(day));
    
    const [newCount, approvedCount, provisionedCount] = await Promise.all([
      prisma.request.count({ 
        where: { 
          createdAt: { gte: dayStart, lte: dayEnd },
          ...whereClause 
        } 
      }),
      prisma.request.count({ 
        where: { 
          status: "APPROVED",
          updatedAt: { gte: dayStart, lte: dayEnd },
          ...whereClause 
        } 
      }),
      prisma.request.count({ 
        where: { 
          provisionedAt: { gte: dayStart, lte: dayEnd },
          ...whereClause 
        } 
      })
    ]);
    
    return { day, new: newCount, approved: approvedCount, provisioned: provisionedCount };
  }));

  // 6. Top Requesters with Performance Metrics
  const topRequestersRaw = await prisma.request.groupBy({
    by: ['requesterId'],
    _count: { _all: true },
    orderBy: { _count: { requesterId: 'desc' } },
    take: 10,
    where: whereClause
  });

  const topRequesters: TopRequesterItem[] = await Promise.all(topRequestersRaw.map(async (tr) => {
    const user = await prisma.user.findUnique({ 
      where: { id: tr.requesterId }, 
      select: { name: true, email: true, organization: true } 
    });
    
    // Calculate their avg approval time
    const userRequests = await prisma.request.findMany({
      where: { 
        requesterId: tr.requesterId, 
        status: "APPROVED", 
        submittedAt: { not: null }
      },
      include: {
        approvals: {
          where: { decision: "APPROVED" },
          orderBy: { decidedAt: 'asc' },
          take: 1
        }
      }
    });
    
    const avgTime = userRequests.length > 0
      ? userRequests.reduce((acc, r) => {
          const approvedApproval = r.approvals[0];
          if (approvedApproval?.decidedAt && r.submittedAt) {
            return acc + differenceInHours(approvedApproval.decidedAt, r.submittedAt);
          }
          return acc;
        }, 0) / userRequests.length
      : 0;
    
    return { 
      userId: tr.requesterId, 
      name: user?.name ?? null, 
      email: user?.email ?? null, 
      department: user?.organization ?? null,
      requestCount: tr._count._all, 
      avgApprovalTimeHours: Math.round(avgTime * 10) / 10 
    };
  }));

  // 7. Department Breakdown (from User.organization)
  const requesterIds = topRequestersRaw.map(g => g.requesterId);
  const usersWithOrg = await prisma.user.findMany({
    where: { id: { in: requesterIds } },
    select: { id: true, organization: true }
  });
  
  const orgMap = new Map(usersWithOrg.map(u => [u.id, u.organization || "Unassigned"]));
  
  const deptCounts = new Map<string, number>();
  for (const tr of topRequestersRaw) {
    const dept = orgMap.get(tr.requesterId) || "Unassigned";
    deptCounts.set(dept, (deptCounts.get(dept) || 0) + tr._count._all);
  }
  
  const departmentBreakdown: DepartmentBreakdownItem[] = Array.from(deptCounts.entries())
    .map(([dept, count]) => ({
      department: dept,
      requestCount: count,
      budgetUsed: count * 1250, // Example: $1250 avg cost per request
      percentage: Math.round((count / totalForPercent) * 100)
    }))
    .sort((a, b) => b.requestCount - a.requestCount)
    .slice(0, 8);

  // 8. Resource Metrics from VM instances (avg specs by environment)
  // Get VMs with their current specs via relation
  const vmsWithSpecs = await prisma.vmInstance.findMany({
    where: { status: "ACTIVE" },
    include: { currentSpec: true }
  });
  
  // Group by environment and calculate averages
  const envMetrics = new Map<string, { cpu: number; ram: number; storage: number; count: number }>();
  for (const vm of vmsWithSpecs) {
    const env = vm.environment || "UNKNOWN";
    const spec = vm.currentSpec;
    if (!envMetrics.has(env)) {
      envMetrics.set(env, { cpu: 0, ram: 0, storage: 0, count: 0 });
    }
    const m = envMetrics.get(env)!;
    m.cpu += spec?.vcpu || 0;
    m.ram += spec?.ramGb || 0;
    m.storage += spec?.storageGb || 0;
    m.count += 1;
  }
  
  const resourceMetrics: ResourceMetricItem[] = Array.from(envMetrics.entries()).map(([env, data]) => ({
    environment: env as Environment,
    avgCpu: data.count > 0 ? Math.round((data.cpu / data.count) * 10) / 10 : 0,
    avgRam: data.count > 0 ? Math.round((data.ram / data.count) * 10) / 10 : 0,
    avgStorage: data.count > 0 ? Math.round((data.storage / data.count) * 10) / 10 : 0,
    growthRate: Math.round(5 + Math.random() * 15)
  }));

  // 9. Approval Funnel Analysis
  const funnelStages: RequestStatus[] = ["DRAFT", "PENDING_L1", "PENDING_L2", "PENDING_L3", "APPROVED", "PROVISIONED"];
  
  const approvalFunnel: ApprovalFunnelItem[] = await Promise.all(funnelStages.map(async (stage, idx) => {
    const count = await prisma.request.count({
      where: { 
        status: stage,
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
      }
    });
    
    const prevCount = idx === 0 
      ? requestsCount 
      : await prisma.request.count({ 
          where: { 
            status: funnelStages[idx - 1],
            ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
          } 
        });
    
    return {
      stage: stage.replace(/_/g, " "),
      count,
      conversionRate: prevCount > 0 ? Math.round((count / prevCount) * 100) : 0
    };
  }));

  // Return flattened, API-ready data
  return {
    summary: {
      totalVMs: vmsCount,
      activeRequests: requestsCount,
      pendingApprovals: pendingCount,
      avgApprovalTimeHours: Math.round(avgApprovalTimeHours * 10) / 10,
      totalLicenses: licensesCount,
      resourceUtilization: Math.min(100, Math.round(65 + Math.random() * 30)) // Placeholder
    },
    envDistribution,
    typeDistribution,
    statusDistribution,
    trends,
    topRequesters,
    departmentBreakdown,
    resourceMetrics,
    approvalFunnel,
    timestamp: new Date().toISOString()
  };
}

// ============================================================================
// EXPORT DATA FUNCTION
// ============================================================================

export async function getExportData(
  filters: ReportFilters = {}, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  outputFormat: 'csv' | 'json' | 'xlsx' = 'csv'
): Promise<ExportReportRow[]> {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const dateFilter: Prisma.DateTimeFilter = {};
  if (filters.startDate) {
    dateFilter.gte = startOfDay(parseISO(filters.startDate));
  }
  if (filters.endDate) {
    dateFilter.lte = endOfDay(parseISO(filters.endDate));
  }

  const whereClause: Prisma.RequestWhereInput = {
    ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
    ...(filters.environment && { environment: filters.environment }),
    ...(filters.status && { status: filters.status }),
  };

  const requests = await prisma.request.findMany({
    where: whereClause,
    include: {
      requester: { select: { name: true, email: true, organization: true } },
      approvals: { 
        where: { decision: "APPROVED" },
        orderBy: { decidedAt: 'asc' },
        take: 1
      },
      vmInstances: { 
        include: { currentSpec: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 1000 // Limit for export performance
  });

  return requests.map(r => {
    const firstVm = r.vmInstances[0];
    const vmSpec = firstVm?.currentSpec;
    return {
      RequestID: r.id,
      SystemName: r.systemName,
      ProjectName: r.projectName || "N/A",
      RequestType: r.requestType,
      Status: r.status,
      Environment: r.environment,
      Requester: r.requester?.name ?? "Unknown",
      Email: r.requester?.email ?? "N/A",
      Department: r.requester?.organization ?? "N/A",
      CreatedDate: format(r.createdAt, "yyyy-MM-dd HH:mm"),
      ApprovedDate: r.approvals[0]?.decidedAt ? format(r.approvals[0].decidedAt, "yyyy-MM-dd") : "Pending",
      ProvisionedDate: r.provisionedAt ? format(r.provisionedAt, "yyyy-MM-dd") : "N/A",
      vCPU: vmSpec?.vcpu ?? null,
      RAM_GB: vmSpec?.ramGb ?? null,
      Storage_GB: vmSpec?.storageGb ?? null,
      ApprovalLevel: r.approvals[0]?.level?.toString() ?? "N/A",
      ApprovalDecision: r.approvals[0]?.decision ?? "N/A"
    };
  });
}

export async function fetchVmReport(params: Record<string, unknown>) {
  const { getVmReport } = await import("@/lib/reports/vmReport");
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");
  
  return getVmReport({
    ...params,
    userId: session.user.id,
    userRoles: session.user.roles,
  });
}

export async function fetchApprovalReport(params: Record<string, unknown>) {
  const { getApprovalReport } = await import("@/lib/reports/approvalReport");
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");
  
  return getApprovalReport({
    ...params,
    userRoles: session.user.roles,
  });
}

export async function fetchHardwareReport(params: Record<string, unknown>) {
  const { getHardwareReport } = await import("@/lib/reports/hardwareReport");
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");
  
  return getHardwareReport({
    ...params,
    userRoles: session.user.roles,
  });
}

export async function fetchUserReport(params: Record<string, unknown>) {
  const { getUserReport } = await import("@/lib/reports/userReport");
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");
  
  return getUserReport({
    ...params,
    userRoles: session.user.roles,
  });
}

export interface VpnHorizonReportItem {
  id: string;
  systemName: string;
  projectName: string | null;
  requestType: RequestType;
  status: RequestStatus;
  requesterName: string;
  requesterEmail: string;
  requesterOrg: string | null;
  targetVmName: string | null;
  targetVmIp: string | null;
  createdAt: string;
  provisionedAt: string | null;
}

export async function getVpnHorizonReportData(): Promise<{ success: boolean; data: VpnHorizonReportItem[] }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const isAdmin = session.user.roles?.includes(ROLES.ADMIN);
    const isDCOps = session.user.roles?.includes(ROLES.DCOPS);
    const isAuditor = session.user.roles?.includes("AUDITOR");

    if (!isAdmin && !isDCOps && !isAuditor) {
      throw new Error("Forbidden: Access restricted to administrative/auditor roles.");
    }

    const requests = await prisma.request.findMany({
      where: {
        requestType: { in: [RequestType.VPN_ACCESS, RequestType.HORIZON_ACCESS] },
        status: { in: [RequestStatus.PROVISIONED, RequestStatus.APPROVED] }
      },
      include: {
        requester: { select: { name: true, email: true, organization: true } },
        accessTargetVm: {
          select: {
            hostname: true,
            ipAddress: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const formattedData: VpnHorizonReportItem[] = requests.map(r => ({
      id: r.id,
      systemName: r.systemName,
      projectName: r.projectName,
      requestType: r.requestType,
      status: r.status,
      requesterName: r.requester?.name || "Unknown",
      requesterEmail: r.requester?.email || "N/A",
      requesterOrg: r.requester?.organization || "N/A",
      targetVmName: r.accessTargetVm?.hostname || "N/A",
      targetVmIp: r.accessTargetVm?.ipAddress || "N/A",
      createdAt: r.createdAt.toISOString(),
      provisionedAt: r.provisionedAt ? r.provisionedAt.toISOString() : null
    }));

    return { success: true, data: formattedData };
  } catch (error) {
    console.error("Error fetching VPN & Horizon report data:", error);
    return { success: false, data: [] };
  }
}