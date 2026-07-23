// lib/reports/vmReport.ts
import prisma from "@/lib/prisma";
import { Prisma, VmStatus, Environment } from "@prisma/client";

export interface VmReportParams {
  page?: number;
  pageSize?: number;
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
    dateFrom, 
    dateTo, 
    status, 
    ownerId, 
    environment, 
    search,
    userId,
    userRoles 
  } = params;

  const skip = (page - 1) * pageSize;
  const isAdmin = userRoles?.some((r: any) => ["ADMIN", "DC_OPS"].includes(r.toUpperCase()));

  const where: Prisma.VmInstanceWhereInput = {};

  // Role-based filtering
  if (!isAdmin) {
    if (ownerId) {
      where.ownerId = ownerId;
    } else if (userId) {
      where.ownerId = userId;
    }
  }

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = dateFrom;
    if (dateTo) where.createdAt.lte = dateTo;
  }

  if (status) where.status = status as VmStatus;
  if (ownerId && isAdmin) where.ownerId = ownerId;
  if (environment) where.environment = environment as Environment;
  
  if (search) {
    where.OR = [
      { hostname: { contains: search, mode: "insensitive" } },
      { subdomain: { contains: search, mode: "insensitive" } },
    ];
  }

  // Include request for system name
  const [vms, total, analytics] = await Promise.all([
    prisma.vmInstance.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { name: true, email: true } },
        request: { select: { systemName: true } },
      },
    }),
    prisma.vmInstance.count({ where }),
    getVmReportAnalytics(where),
  ]);

  return {
    data: vms.map((vm: any) => ({
      id: vm.id,
      vmName: vm.request?.systemName || "Manual VM",
      hostname: vm.hostname || "-",
      ownerName: vm.owner?.name || "Unassigned",
      ownerEmail: vm.owner?.email || "-",
      systemName: vm.request?.systemName || "Manual",
      domain: vm.subdomain || "-",
      environment: vm.environment || "-",
      vcpu: 0,
      ramGb: 0,
      storageGb: 0,
      status: vm.status,
      createdAt: vm.createdAt,
    })),
    analytics,
    total,
    page,
    totalPages: Math.ceil(total / pageSize),
  };
}

async function getVmReportAnalytics(where: Prisma.VmInstanceWhereInput) {
  const [allVms, byOwner, bySystem, byStatus] = await Promise.all([
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
      by: ["environment"],
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

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  const monthlyTrend = await prisma.vmInstance.groupBy({
    by: ["createdAt"],
    _count: true,
    where: {
      ...where,
      createdAt: { gte: sixMonthsAgo },
    },
    orderBy: { createdAt: "asc" },
  });

  const monthlyMap: Record<string, number> = {};
  for (const vm of monthlyTrend) {
    const month = vm.createdAt.toISOString().slice(0, 7);
    monthlyMap[month] = (monthlyMap[month] || 0) + vm._count;
  }

  return {
    totalCount: allVms.length,
    byOwner: byOwner.map((r: any) => ({
      ownerName: ownerMap.get(r.ownerId!) || "Unknown",
      count: r._count,
    })),
    bySystem: bySystem.map((r: any) => ({
      systemName: r.environment || "Unknown",
      count: r._count,
    })),
    byStatus: byStatus.map((r: any) => ({
      status: r.status,
      count: r._count,
    })),
    monthlyTrend: Object.entries(monthlyMap).map(([month, count]: any) => ({ month, count })),
  };
}
