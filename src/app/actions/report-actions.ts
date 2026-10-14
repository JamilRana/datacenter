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
import { resolveVmResourceSpecs } from "@/lib/reports/spec-resolver";
import { getReportScope, formatSystemName, getEffectiveSpec } from "@/lib/reports/shared-reporting";

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
    prisma.vmInstance.count({ where: { status: "ACTIVE", decommissionedAt: null } }),
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
    ? approvedRequests.reduce((acc: number, r: any) => {
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

  const envDistribution: EnvDistributionItem[] = envGroups.map((g: any) => ({
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

  const typeDistribution: TypeDistributionItem[] = typeGroups.map((g: any) => ({
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

  const statusDistribution: StatusDistributionItem[] = statusGroups.map((g: any) => ({
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

  const topRequesters: TopRequesterItem[] = await Promise.all(topRequestersRaw.map(async (tr: any) => {
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
      ? userRequests.reduce((acc: number, r: any) => {
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
  const requesterIds = topRequestersRaw.map((g: any) => g.requesterId);
  const usersWithOrg = await prisma.user.findMany({
    where: { id: { in: requesterIds } },
    select: { id: true, organization: true }
  });
  
  const orgMap = new Map<string, string>(usersWithOrg.map((u: any) => [u.id, u.organization || "Unassigned"]));
  
  const deptCounts = new Map<string, number>();
  for (const tr of topRequestersRaw as any[]) {
    const dept = orgMap.get(tr.requesterId) || "Unassigned";
    deptCounts.set(dept, (deptCounts.get(dept) || 0) + tr._count._all);
  }
  
  const departmentBreakdown: DepartmentBreakdownItem[] = Array.from(deptCounts.entries())
    .map(([dept, count]: any) => ({
      department: dept,
      requestCount: count,
      budgetUsed: count * 1250, // Example: $1250 avg cost per request
      percentage: Math.round((count / totalForPercent) * 100)
    }))
    .sort((a: any, b: any) => b.requestCount - a.requestCount)
    .slice(0, 8);

  // 8. Resource Metrics from VM instances (avg specs by environment)
  // Get VMs with their current specs via relation and fallback chain
  const vmsWithSpecs = await prisma.vmInstance.findMany({
    where: { status: "ACTIVE", decommissionedAt: null },
    include: { 
      currentSpec: true,
      specHistory: { orderBy: { effectiveFrom: 'desc' }, take: 1 },
      request: { select: { vcpu: true, ramGb: true, storageGb: true, vmSpecifications: true } }
    }
  });
  
  // Group by environment and calculate averages
  const envMetrics = new Map<string, { cpu: number; ram: number; storage: number; count: number }>();
  for (const vm of vmsWithSpecs) {
    const env = vm.environment || "UNKNOWN";
    const spec = resolveVmResourceSpecs(vm);
    if (!envMetrics.has(env)) {
      envMetrics.set(env, { cpu: 0, ram: 0, storage: 0, count: 0 });
    }
    const m = envMetrics.get(env)!;
    m.cpu += spec.vcpu;
    m.ram += spec.ramGb;
    m.storage += spec.storageGb;
    m.count += 1;
  }
  
  const resourceMetrics: ResourceMetricItem[] = Array.from(envMetrics.entries()).map(([env, data]: any) => ({
    environment: env as Environment,
    avgCpu: data.count > 0 ? Math.round((data.cpu / data.count) * 10) / 10 : 0,
    avgRam: data.count > 0 ? Math.round((data.ram / data.count) * 10) / 10 : 0,
    avgStorage: data.count > 0 ? Math.round((data.storage / data.count) * 10) / 10 : 0,
    growthRate: Math.round(5 + Math.random() * 15)
  }));

  // 9. Approval Funnel Analysis
  const funnelStages: RequestStatus[] = ["DRAFT", "PENDING_L1", "PENDING_L2", "PENDING_L3", "APPROVED", "PROVISIONED"];
  
  const approvalFunnel: ApprovalFunnelItem[] = await Promise.all(funnelStages.map(async (stage: RequestStatus, idx: number) => {
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

  const scope = getReportScope({ id: session.user.id, roles: session.user.roles });

  const dateFilter: Prisma.DateTimeFilter = {};
  if (filters.startDate) {
    dateFilter.gte = startOfDay(parseISO(filters.startDate));
  }
  if (filters.endDate) {
    dateFilter.lte = endOfDay(parseISO(filters.endDate));
  }

  const whereClause: Prisma.RequestWhereInput = {
    ...scope.requestWhere,
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
        include: { 
          currentSpec: true,
          specHistory: { orderBy: { effectiveFrom: 'desc' } }
        }
      },
      vmSpecifications: true
    },
    orderBy: { createdAt: 'desc' },
    take: 1000 // Limit for export performance
  });

  return requests.map((r: any) => {
    const firstVm = r.vmInstances[0];
    const effective = firstVm ? getEffectiveSpec({ ...firstVm, request: r }) : null;
    return {
      RequestID: r.id,
      SystemName: formatSystemName(r.systemName),
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
      vCPU: effective ? effective.vcpu : (r.vcpu ?? null),
      RAM_GB: effective ? effective.ramGb : (r.ramGb ?? null),
      Storage_GB: effective ? effective.storageGb : (r.storageGb ?? null),
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

export async function fetchUserResourceDetail(userId: string) {
  const { getUserResourceDetail } = await import("@/lib/reports/userReport");
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");
  
  const userRoles = session.user.roles || [];
  const isAdmin = userRoles.some((r: any) => ["ADMIN", "DC_OPS"].includes(r.toUpperCase()));
  if (!isAdmin && session.user.id !== userId) {
    throw new Error("Forbidden");
  }

  return getUserResourceDetail(userId);
}

import type { VpnHorizonUserReportItem, VpnHorizonReportItem } from "@/types/reports";
import { transformVpnHorizonAssignmentsToUsers } from "@/lib/reports/vpn-horizon-reporting";
export type { VpnHorizonUserReportItem, VpnHorizonReportItem };

export async function getVpnHorizonReportData(): Promise<{ success: boolean; data: VpnHorizonUserReportItem[] }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const actor = { id: session.user.id, roles: session.user.roles || [] };
    const scope = getReportScope(actor);
    const isRequester = !scope.isAdminOrDcOps;

    // Build Prisma where clauses respecting requester scope
    // Requesters only see assignments that point at their own VMs and namespaces
    let horizonWhere: Prisma.HorizonAssignmentWhereInput = {};
    let vpnWhere: Prisma.VpnAssignmentWhereInput = {};
    let requesterScopedVmIds: Set<string> | undefined;
    let requesterScopedNamespaceIds: Set<string> | undefined;

    if (isRequester) {
      horizonWhere = {
        OR: [
          { vm: scope.vmWhere },
          { namespace: scope.namespaceWhere },
          { oldVm: scope.vmWhere },
        ]
      };
      vpnWhere = {
        OR: [
          { vm: scope.vmWhere },
          { namespace: scope.namespaceWhere },
        ]
      };

      const [scopedVms, scopedNamespaces] = await Promise.all([
        prisma.vmInstance.findMany({
          where: scope.vmWhere,
          select: { id: true },
        }),
        prisma.k8sNamespace.findMany({
          where: scope.namespaceWhere,
          select: { id: true },
        })
      ]);
      requesterScopedVmIds = new Set(scopedVms.map(v => v.id));
      requesterScopedNamespaceIds = new Set(scopedNamespaces.map(n => n.id));
    }

    // Query assignments and accounts
    const [horizonAssignments, vpnAssignments, vpnUsers, horizonUsers] = await Promise.all([
      prisma.horizonAssignment.findMany({
        where: horizonWhere,
        include: {
          horizonUser: {
            include: {
              user: { select: { id: true, name: true, email: true, organization: true } }
            }
          },
          vm: {
            select: {
              id: true,
              hostname: true,
              ipAddress: true,
              systemName: true,
              environment: true,
              status: true,
              request: { select: { systemName: true, projectName: true } }
            }
          },
          namespace: {
            select: {
              id: true,
              name: true,
              supervisorIp: true,
              clusters: { select: { clusterName: true } },
              requests: { select: { systemName: true, projectName: true } }
            }
          },
          assignedBy: { select: { name: true, email: true } },
          oldVm: {
            select: {
              id: true,
              hostname: true,
              ipAddress: true,
              systemName: true,
              environment: true,
              status: true,
              request: { select: { systemName: true, projectName: true } }
            }
          },
        },
        orderBy: { assignedAt: "desc" }
      }),
      prisma.vpnAssignment.findMany({
        where: vpnWhere,
        include: {
          vpnUser: {
            include: {
              user: { select: { id: true, name: true, email: true, organization: true } }
            }
          },
          vm: {
            select: {
              id: true,
              hostname: true,
              ipAddress: true,
              systemName: true,
              environment: true,
              status: true,
              request: { select: { systemName: true, projectName: true } }
            }
          },
          namespace: {
            select: {
              id: true,
              name: true,
              supervisorIp: true,
              clusters: { select: { clusterName: true } },
              requests: { select: { systemName: true, projectName: true } }
            }
          },
          assignedBy: { select: { name: true, email: true } },
        },
        orderBy: { assignedAt: "desc" }
      }),
      !isRequester ? prisma.vpnUser.findMany({
        include: {
          user: { select: { id: true, name: true, email: true, organization: true } }
        }
      }) : Promise.resolve([]),
      !isRequester ? prisma.horizonUser.findMany({
        include: {
          user: { select: { id: true, name: true, email: true, organization: true } }
        }
      }) : Promise.resolve([]),
    ]);

    const formattedData = transformVpnHorizonAssignmentsToUsers({
      horizonAssignments,
      vpnAssignments,
      vpnUsers,
      horizonUsers,
      requesterScopedVmIds,
      requesterScopedNamespaceIds,
      isRequester,
    });

    return { success: true, data: formattedData };
  } catch (error) {
    console.error("Error fetching VPN & Horizon report data:", error);
    return { success: false, data: [] };
  }
}