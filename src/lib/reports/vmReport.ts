import prisma from "@/lib/prisma";
import { Prisma, VmStatus, Environment } from "@prisma/client";
import { resolveVmResourceSpecs } from "@/lib/reports/spec-resolver";

export interface VmReportParams {
  page?: number;
  pageSize?: number;
  getAll?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  status?: string;
  ownerId?: string;
  environment?: string;
  search?: string;
  userId?: string;
  userRoles?: string[];
}

export interface VmReportRow {
  id: string;
  vmName: string;
  hostname: string;
  ownerName: string;
  ownerEmail: string;
  systemName: string;
  domain: string;
  environment: string;
  vcpu: number;
  ramGb: number;
  storageGb: number;
  status: string;
  createdAt: Date;
}

export interface VmReportAnalytics {
  totalCount: number;
  byOwner: { ownerName: string; count: number }[];
  bySystem: { systemName: string; count: number }[];
  byStatus: { status: string; count: number }[];
  monthlyTrend: { month: string; count: number }[];
}

export interface VmReportResult {
  data: VmReportRow[];
  analytics: VmReportAnalytics;
  total: number;
  page: number;
  totalPages: number;
}

export async function getVmReport(params: VmReportParams): Promise<VmReportResult> {
  const { 
    page = 1, 
    pageSize = 10, 
    getAll = false,
    dateFrom, 
    dateTo, 
    status, 
    ownerId, 
    environment, 
    search,
    userId,
    userRoles 
  } = params;

  const skip = getAll ? undefined : (page - 1) * pageSize;
  const take = getAll ? undefined : pageSize;
  const isAdmin = userRoles?.some((r: any) => ["ADMIN", "DC_OPS"].includes(r.toUpperCase()));

  const where: Prisma.VmInstanceWhereInput = {};

  // Role-based filtering: correct requester scope (ownerId OR request.requesterId)
  if (!isAdmin) {
    const targetUserId = ownerId || userId;
    if (targetUserId) {
      where.OR = [
        { ownerId: targetUserId },
        { request: { requesterId: targetUserId } }
      ];
    }
  }

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = dateFrom;
    if (dateTo) where.createdAt.lte = dateTo;
  }

  if (status) {
    where.status = status as VmStatus;
    if (status === 'ACTIVE') {
      where.decommissionedAt = null;
    }
  }
  if (ownerId && isAdmin) where.ownerId = ownerId;
  if (environment) where.environment = environment as Environment;
  
  if (search) {
    where.OR = [
      { hostname: { contains: search, mode: "insensitive" } },
      { subdomain: { contains: search, mode: "insensitive" } },
      { ipAddress: { contains: search, mode: "insensitive" } },
      { systemName: { contains: search, mode: "insensitive" } },
      { request: { systemName: { contains: search, mode: "insensitive" } } },
      { owner: { name: { contains: search, mode: "insensitive" } } },
      { owner: { email: { contains: search, mode: "insensitive" } } },
    ];
  }

  // Include request for system name, specHistory and currentSpec for allocated specs
  const [vms, total, analytics] = await Promise.all([
    prisma.vmInstance.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { name: true, email: true } },
        request: {
          select: {
            systemName: true,
            vcpu: true,
            ramGb: true,
            storageGb: true,
            osName: true,
            osVersion: true,
            vmSpecifications: true
          }
        },
        currentSpec: true,
        specHistory: { orderBy: { effectiveFrom: 'desc' as const }, take: 1 },
      },
    }),
    prisma.vmInstance.count({ where }),
    getVmReportAnalytics(where),
  ]);

  return {
    data: vms.map((vm: any) => {
      const resolvedSystem = vm.systemName || vm.request?.systemName || "Standalone / Unassigned";
      const spec = resolveVmResourceSpecs(vm);
      return {
        id: vm.id,
        vmName: vm.hostname || resolvedSystem,
        hostname: vm.hostname || "-",
        ownerName: vm.owner?.name || "Unassigned",
        ownerEmail: vm.owner?.email || "-",
        systemName: resolvedSystem,
        domain: vm.subdomain || "-",
        environment: vm.environment || "-",
        vcpu: spec.vcpu,
        ramGb: spec.ramGb,
        storageGb: spec.storageGb,
        status: vm.status,
        createdAt: vm.createdAt,
      };
    }),
    analytics,
    total,
    page,
    totalPages: Math.ceil(total / pageSize),
  };
}

async function getVmReportAnalytics(where: Prisma.VmInstanceWhereInput) {
  const [allVms, byOwner, byStatus] = await Promise.all([
    prisma.vmInstance.findMany({
      where,
      include: {
        owner: { select: { name: true } },
        request: { select: { systemName: true } },
      },
    }),
    prisma.vmInstance.groupBy({
      by: ["ownerId"],
      _count: true,
      where,
    }),
    prisma.vmInstance.groupBy({
      by: ["status"],
      _count: true,
      where,
    }),
  ]);

  const ownerIds = byOwner.map((r: any) => r.ownerId).filter(Boolean) as string[];
  const owners = await prisma.user.findMany({
    where: { id: { in: ownerIds } },
    select: { id: true, name: true },
  });
  const ownerMap = new Map(owners.map((u: any) => [u.id, u.name]));

  // Calculate actual system distribution
  const systemCounts: Record<string, number> = {};
  for (const vm of allVms) {
    const sys = (vm as any).systemName || vm.request?.systemName || "Standalone / Unassigned";
    systemCounts[sys] = (systemCounts[sys] || 0) + 1;
  }
  const bySystem = Object.entries(systemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([systemName, count]) => ({ systemName, count }));

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  const recentVms = await prisma.vmInstance.findMany({
    where: {
      ...where,
      createdAt: { gte: sixMonthsAgo },
    },
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const monthlyMap: Record<string, number> = {};
  for (const vm of recentVms) {
    const month = vm.createdAt.toISOString().slice(0, 7);
    monthlyMap[month] = (monthlyMap[month] || 0) + 1;
  }

  return {
    totalCount: allVms.length,
    byOwner: byOwner.map((r: any) => ({
      ownerName: ownerMap.get(r.ownerId!) || "Unknown",
      count: r._count,
    })),
    bySystem,
    byStatus: byStatus.map((r: any) => ({
      status: r.status,
      count: r._count,
    })),
    monthlyTrend: Object.entries(monthlyMap).map(([month, count]: any) => ({ month, count })),
  };
}
