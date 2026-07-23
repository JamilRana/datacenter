// lib/reports/hardwareReport.ts
import prisma from "@/lib/prisma";
import { Prisma, AssetType } from "@prisma/client";

interface AssetWithVms {
  id: string;
  name: string;
  type: AssetType;
  location: string | null;
  cpuCores: number | null;
  ramGb: number | null;
  storageGb: number | null;
  vms: Array<{
    id: string;
    currentSpec: { vcpu: number; ramGb: number; storageGb: number } | null;
  }>;
}

export interface HardwareReportParams {
  page?: number;
  pageSize?: number;
  dateFrom?: Date;
  dateTo?: Date;
  type?: string;
  location?: string;
  search?: string;
  userRoles?: string[];
}

export interface HardwareReportRow {
  id: string;
  assetName: string;
  type: string;
  location: string;
  totalCpu: number;
  totalRam: number;
  totalStorage: number;
  allocatedCpu: number;
  allocatedRam: number;
  allocatedStorage: number;
  utilizationPercent: number;
  vmCount: number;
  status: string;
}

export interface HardwareReportAnalytics {
  totalCount: number;
  byType: { type: string; count: number }[];
  byLocation: { location: string; count: number }[];
  utilizationDistribution: { range: string; count: number }[];
  overloadedCount: number;
  underutilizedCount: number;
  totalCapacity: { cpu: number; ram: number; storage: number };
  usedCapacity: { cpu: number; ram: number; storage: number };
}

export interface HardwareReportResult {
  data: HardwareReportRow[];
  analytics: HardwareReportAnalytics;
  total: number;
  page: number;
  totalPages: number;
}

export async function getHardwareReport(params: HardwareReportParams): Promise<HardwareReportResult> {
  const { 
    page = 1, 
    pageSize = 10, 
    type, 
    location, 
    search,
    userRoles 
  } = params;

  const skip = (page - 1) * pageSize;
  const isAdmin = userRoles?.some((r: any) => ["ADMIN", "DC_OPS"].includes(r.toUpperCase()));

  if (!isAdmin) {
    return { data: [], analytics: { totalCount: 0, byType: [], byLocation: [], utilizationDistribution: [], overloadedCount: 0, underutilizedCount: 0, totalCapacity: { cpu: 0, ram: 0, storage: 0 }, usedCapacity: { cpu: 0, ram: 0, storage: 0 } }, total: 0, page: 1, totalPages: 0 };
  }

  const where: Prisma.AssetWhereInput = {};

  if (type) where.type = type as AssetType;
  if (location) where.location = location;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { vendor: { contains: search, mode: "insensitive" } },
      { model: { contains: search, mode: "insensitive" } },
    ];
  }

  const [assets, total] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.asset.findMany as any)({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        vms: {
          where: { status: { not: "RETIRED" } },
          include: {
            currentSpec: { select: { vcpu: true, ramGb: true, storageGb: true } },
          },
        },
      },
    }) as Promise<AssetWithVms[]>,
    prisma.asset.count({ where }),
  ]);

  const analytics = await getHardwareReportAnalytics(where);

  const data: HardwareReportRow[] = assets.map((asset: any) => {
    const allocatedCpu = asset.vms.reduce((sum: number, vm: any) => sum + (vm.currentSpec?.vcpu || 0), 0);
    const allocatedRam = asset.vms.reduce((sum: number, vm: any) => sum + (vm.currentSpec?.ramGb || 0), 0);
    const allocatedStorage = asset.vms.reduce((sum: number, vm: any) => sum + (vm.currentSpec?.storageGb || 0), 0);
    
    const cpuPercent = asset.cpuCores ? (allocatedCpu / asset.cpuCores) * 100 : 0;
    const ramPercent = asset.ramGb ? (allocatedRam / asset.ramGb) * 100 : 0;
    const storagePercent = asset.storageGb ? (allocatedStorage / asset.storageGb) * 100 : 0;
    
    const utilizationPercent = Math.max(cpuPercent, ramPercent, storagePercent);
    
    let status = "Available";
    if (asset.vms.length > 0) {
      status = utilizationPercent > 90 ? "Overloaded" : utilizationPercent > 50 ? "Utilized" : "Underutilized";
    }

    return {
      id: asset.id,
      assetName: asset.name,
      type: asset.type,
      location: asset.location || "-",
      totalCpu: asset.cpuCores || 0,
      totalRam: asset.ramGb || 0,
      totalStorage: asset.storageGb || 0,
      allocatedCpu,
      allocatedRam,
      allocatedStorage,
      utilizationPercent: Math.round(utilizationPercent),
      vmCount: asset.vms.length,
      status,
    };
  });

  return {
    data,
    analytics,
    total,
    page,
    totalPages: Math.ceil(total / pageSize),
  };
}

async function getHardwareReportAnalytics(where: Prisma.AssetWhereInput) {
  const [allAssets, byType, byLocation] = await Promise.all([
    prisma.asset.findMany({
      where,
      include: {
        vms: {
          where: { status: { not: "RETIRED" } },
          include: {
            currentSpec: { select: { vcpu: true, ramGb: true, storageGb: true } },
          },
        },
      },
    }),
    prisma.asset.groupBy({
      by: ["type"],
      _count: true,
      where,
    }),
    prisma.asset.groupBy({
      by: ["location"],
      _count: true,
      where: { ...where, location: { not: null } },
    }),
  ]);

  let overloadedCount = 0;
  let underutilizedCount = 0;
  const totalCapacity = { cpu: 0, ram: 0, storage: 0 };
  const usedCapacity = { cpu: 0, ram: 0, storage: 0 };

  const utilizationRanges = [
    { range: "0-25%", min: 0, max: 25, count: 0 },
    { range: "25-50%", min: 25, max: 50, count: 0 },
    { range: "50-75%", min: 50, max: 75, count: 0 },
    { range: "75-100%", min: 75, max: 100, count: 0 },
    { range: ">100%", min: 100, max: Infinity, count: 0 },
  ];

  for (const asset of allAssets) {
    const cpuPercent = asset.cpuCores ? (asset.vms.reduce((s: number, v: any) => s + (v.currentSpec?.vcpu || 0), 0) / asset.cpuCores) * 100 : 0;
    const ramPercent = asset.ramGb ? (asset.vms.reduce((s: number, v: any) => s + (v.currentSpec?.ramGb || 0), 0) / asset.ramGb) * 100 : 0;
    const storagePercent = asset.storageGb ? (asset.vms.reduce((s: number, v: any) => s + (v.currentSpec?.storageGb || 0), 0) / asset.storageGb) * 100 : 0;
    
    const utilizationPercent = Math.max(cpuPercent, ramPercent, storagePercent);
    
    if (utilizationPercent > 100) overloadedCount++;
    else if (utilizationPercent < 25 && asset.vms.length > 0) underutilizedCount++;

    for (const r of utilizationRanges) {
      if (utilizationPercent >= r.min && utilizationPercent < r.max) {
        r.count++;
        break;
      }
    }

    totalCapacity.cpu += asset.cpuCores || 0;
    totalCapacity.ram += asset.ramGb || 0;
    totalCapacity.storage += asset.storageGb || 0;
    usedCapacity.cpu += asset.vms.reduce((s: number, v: any) => s + (v.currentSpec?.vcpu || 0), 0);
    usedCapacity.ram += asset.vms.reduce((s: number, v: any) => s + (v.currentSpec?.ramGb || 0), 0);
    usedCapacity.storage += asset.vms.reduce((s: number, v: any) => s + (v.currentSpec?.storageGb || 0), 0);
  }

  return {
    totalCount: allAssets.length,
    byType: byType.map((r: any) => ({ type: r.type, count: r._count })),
    byLocation: byLocation.map((r: any) => ({ location: r.location || "Unknown", count: r._count })),
    utilizationDistribution: utilizationRanges.map((r: any) => ({ range: r.range, count: r.count })),
    overloadedCount,
    underutilizedCount,
    totalCapacity,
    usedCapacity,
  };
}
