// src/lib/reports/hardwareReport.ts
import prisma from "@/lib/prisma";
import { Prisma, AssetType } from "@prisma/client";
import { getEffectiveSpec, resolveSystemName } from "@/lib/reports/shared-reporting";
import { differenceInDays, addDays } from "date-fns";

export interface HostedVmSummary {
  id: string;
  hostname: string;
  ipAddress: string;
  systemName: string;
  environment: string;
  status: string;
  vcpu: number;
  ramGb: number;
  storageGb: number;
  ownerName: string;
}

export interface AttachedLicenseSummary {
  id: string;
  name: string;
  vendor: string;
  type: string;
  expiryDate: string | null;
  maintenanceExpiry: string | null;
  notes?: string | null;
}

export interface HardwareReportRow {
  id: string;
  assetName: string;
  type: AssetType;
  vendor: string;
  model: string;
  serial: string;
  location: string;
  clusterName?: string;

  // Type-specific hardware specifications
  // 1. Servers
  cpuCores?: number | null;
  ramGb?: number | null;
  graphicsCardModel?: string | null;
  graphicsCardSpec?: string | null;

  // 2. Network devices (Router, Switch, Firewall, Console Server)
  interfaces?: number | null;
  throughputGbps?: number | null;
  vlanSupport?: boolean | null;

  // 3. Storage
  capacityTb?: number | null;
  noOfDisks?: number | null;

  // Per-host utilisation metrics (for hosts running VMs)
  allocatedCpu: number;
  allocatedRam: number;
  allocatedStorage: number;
  cpuUtilPercent: number;
  ramUtilPercent: number;
  storageUtilPercent: number;
  utilizationPercent: number;
  utilizationStatus: "Available" | "Utilized" | "Overloaded" | "Underutilized" | "N/A";

  // Warranty lifecycle tracking
  warrantyExpiry?: string | null;
  warrantyStatus: "EXPIRED" | "EXPIRING_30D" | "EXPIRING_90D" | "ACTIVE" | "UNKNOWN";
  daysUntilWarrantyExpiry?: number | null;
  isWarrantySoon: boolean;
  isWarrantyExpired: boolean;
  status: string;

  // Expandable children: hosted VMs and licenses
  vmCount: number;
  hostedVms: HostedVmSummary[];
  licenseCount: number;
  licenses: AttachedLicenseSummary[];
}

export interface HardwareReportAnalytics {
  totalCount: number;
  byType: { type: string; count: number }[];
  byLocation: { location: string; count: number }[];
  byWarranty: { status: string; count: number }[];
  utilizationDistribution: { range: string; count: number }[];
  overloadedCount: number;
  underutilizedCount: number;
  totalCapacity: { cpu: number; ram: number; storage: number };
  usedCapacity: { cpu: number; ram: number; storage: number };
  unassignedVmCount?: number;
  unassignedCapacity?: { cpu: number; ram: number; storage: number };
}

export interface HardwareReportParams {
  page?: number;
  pageSize?: number;
  getAll?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  type?: string;
  location?: string;
  search?: string;
  clusterId?: string;
  warrantyStatus?: string; // "ALL" | "EXPIRED" | "EXPIRING_30D" | "EXPIRING_90D" | "ACTIVE" | "UNKNOWN"
  userRoles?: string[];
}

export interface HardwareReportResult {
  permitted?: boolean;
  message?: string;
  data: HardwareReportRow[];
  analytics: HardwareReportAnalytics;
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Computes warranty lifecycle classification and days remaining.
 */
export function computeWarrantyStatus(
  warrantyExpiry: Date | string | null | undefined,
  currentDate: Date = new Date()
): {
  warrantyStatus: "EXPIRED" | "EXPIRING_30D" | "EXPIRING_90D" | "ACTIVE" | "UNKNOWN";
  daysUntilWarrantyExpiry: number | null;
  isWarrantySoon: boolean;
  isWarrantyExpired: boolean;
} {
  if (!warrantyExpiry) {
    return {
      warrantyStatus: "UNKNOWN",
      daysUntilWarrantyExpiry: null,
      isWarrantySoon: false,
      isWarrantyExpired: false,
    };
  }

  const exp = typeof warrantyExpiry === "string" ? new Date(warrantyExpiry) : warrantyExpiry;
  if (isNaN(exp.getTime())) {
    return {
      warrantyStatus: "UNKNOWN",
      daysUntilWarrantyExpiry: null,
      isWarrantySoon: false,
      isWarrantyExpired: false,
    };
  }

  const diffDays = differenceInDays(exp, currentDate);

  if (diffDays < 0) {
    return {
      warrantyStatus: "EXPIRED",
      daysUntilWarrantyExpiry: diffDays,
      isWarrantySoon: false,
      isWarrantyExpired: true,
    };
  }
  if (diffDays <= 30) {
    return {
      warrantyStatus: "EXPIRING_30D",
      daysUntilWarrantyExpiry: diffDays,
      isWarrantySoon: true,
      isWarrantyExpired: false,
    };
  }
  if (diffDays <= 90) {
    return {
      warrantyStatus: "EXPIRING_90D",
      daysUntilWarrantyExpiry: diffDays,
      isWarrantySoon: true,
      isWarrantyExpired: false,
    };
  }
  return {
    warrantyStatus: "ACTIVE",
    daysUntilWarrantyExpiry: diffDays,
    isWarrantySoon: false,
    isWarrantyExpired: false,
  };
}

export async function getHardwareReport(params: HardwareReportParams): Promise<HardwareReportResult> {
  const { 
    page = 1, 
    pageSize = 10, 
    getAll = false,
    type, 
    location, 
    search, 
    clusterId, 
    warrantyStatus = "ALL",
    dateFrom,
    dateTo,
    userRoles 
  } = params;

  const skip = getAll ? undefined : (page - 1) * pageSize;
  const take = getAll ? undefined : pageSize;
  const isAdmin = userRoles?.some((r: any) => ["ADMIN", "DC_OPS", "DCOPS"].includes(String(r).toUpperCase()));

  if (!isAdmin) {
    return {
      permitted: false,
      message: "Infrastructure reports (Hardware & Hosts) are restricted to Administrator and DC Operations roles.",
      data: [],
      analytics: {
        totalCount: 0,
        byType: [],
        byLocation: [],
        byWarranty: [],
        utilizationDistribution: [],
        overloadedCount: 0,
        underutilizedCount: 0,
        totalCapacity: { cpu: 0, ram: 0, storage: 0 },
        usedCapacity: { cpu: 0, ram: 0, storage: 0 }
      },
      total: 0,
      page: 1,
      totalPages: 0
    };
  }

  const now = new Date();
  const in30Days = addDays(now, 30);
  const in90Days = addDays(now, 90);

  // Build Prisma where clause
  const andClauses: Prisma.AssetWhereInput[] = [];

  if (type && type !== "all" && type !== "ALL") {
    andClauses.push({ type: type as AssetType });
  }

  if (location && location !== "all" && location !== "ALL") {
    andClauses.push({ location });
  }

  if (clusterId && clusterId !== "all" && clusterId !== "ALL") {
    if (clusterId === "none") {
      andClauses.push({ clusterId: null });
    } else {
      andClauses.push({ clusterId });
    }
  }

  if (search && search.trim()) {
    const q = search.trim();
    andClauses.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { vendor: { contains: q, mode: "insensitive" } },
        { model: { contains: q, mode: "insensitive" } },
        { serial: { contains: q, mode: "insensitive" } },
        { cluster: { name: { contains: q, mode: "insensitive" } } },
        { vms: { some: { hostname: { contains: q, mode: "insensitive" } } } },
      ]
    });
  }

  // Warranty status filter
  if (warrantyStatus && warrantyStatus !== "ALL" && warrantyStatus !== "all") {
    switch (warrantyStatus) {
      case "EXPIRED":
        andClauses.push({ warrantyExpiry: { lt: now } });
        break;
      case "EXPIRING_30D":
        andClauses.push({ warrantyExpiry: { gte: now, lte: in30Days } });
        break;
      case "EXPIRING_90D":
        andClauses.push({ warrantyExpiry: { gte: now, lte: in90Days } });
        break;
      case "ACTIVE":
        andClauses.push({ warrantyExpiry: { gte: now } });
        break;
      case "UNKNOWN":
        andClauses.push({ warrantyExpiry: null });
        break;
    }
  }

  // Date range filter
  if (dateFrom || dateTo) {
    andClauses.push({
      warrantyExpiry: {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {}),
      }
    });
  }

  const where: Prisma.AssetWhereInput = andClauses.length > 0 ? { AND: andClauses } : {};

  const [assets, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        cluster: { select: { name: true } },
        vms: {
          where: { status: { not: "RETIRED" }, decommissionedAt: null },
          include: {
            owner: { select: { name: true } },
            request: { 
              select: { 
                systemName: true, 
                projectName: true,
                vcpu: true, 
                ramGb: true, 
                storageGb: true, 
                vmSpecifications: true 
              } 
            },
            currentSpec: true,
            specHistory: { orderBy: { effectiveFrom: 'desc' }, take: 1 },
          },
        },
        licenses: {
          select: {
            id: true,
            name: true,
            vendor: true,
            type: true,
            expiryDate: true,
            maintenanceExpiry: true,
            notes: true,
          }
        }
      },
    }),
    prisma.asset.count({ where }),
  ]);

  const analytics = await getHardwareReportAnalytics(where);

  const data: HardwareReportRow[] = assets.map((asset) => {
    let allocatedCpu = 0;
    let allocatedRam = 0;
    let allocatedStorage = 0;

    const hostedVms: HostedVmSummary[] = asset.vms.map((vm: any) => {
      const spec = getEffectiveSpec(vm);
      allocatedCpu += spec.vcpu;
      allocatedRam += spec.ramGb;
      allocatedStorage += spec.storageGb;

      return {
        id: vm.id,
        hostname: vm.hostname || "UNNAMED",
        ipAddress: vm.ipAddress || "PENDING",
        systemName: resolveSystemName(vm),
        environment: vm.environment || "PRODUCTION",
        status: vm.status || "ACTIVE",
        vcpu: spec.vcpu,
        ramGb: spec.ramGb,
        storageGb: spec.storageGb,
        ownerName: vm.owner?.name || "Unknown",
      };
    });

    const licenses: AttachedLicenseSummary[] = asset.licenses.map(lic => ({
      id: lic.id,
      name: lic.name,
      vendor: lic.vendor,
      type: lic.type,
      expiryDate: lic.expiryDate ? lic.expiryDate.toISOString() : null,
      maintenanceExpiry: lic.maintenanceExpiry ? lic.maintenanceExpiry.toISOString() : null,
      notes: lic.notes || null,
    }));

    // Utilisation calculations
    const isServer = asset.type === "SERVER";
    const cpuPercent = asset.cpuCores ? (allocatedCpu / asset.cpuCores) * 100 : 0;
    const ramPercent = asset.ramGb ? (allocatedRam / asset.ramGb) * 100 : 0;
    const storagePercent = asset.storageGb ? (allocatedStorage / asset.storageGb) * 100 : 0;
    const maxUtil = Math.max(cpuPercent, ramPercent, storagePercent);
    const utilizationPercent = Math.round(maxUtil);

    let utilizationStatus: HardwareReportRow["utilizationStatus"] = "N/A";
    if (isServer || asset.vms.length > 0) {
      if (asset.vms.length === 0) {
        utilizationStatus = "Available";
      } else if (utilizationPercent > 90) {
        utilizationStatus = "Overloaded";
      } else if (utilizationPercent >= 40) {
        utilizationStatus = "Utilized";
      } else {
        utilizationStatus = "Underutilized";
      }
    }

    const {
      warrantyStatus: calculatedWarrantyStatus,
      daysUntilWarrantyExpiry,
      isWarrantySoon,
      isWarrantyExpired
    } = computeWarrantyStatus(asset.warrantyExpiry, now);

    return {
      id: asset.id,
      assetName: asset.name,
      type: asset.type,
      vendor: asset.vendor || "N/A",
      model: asset.model || "N/A",
      serial: asset.serial || "N/A",
      location: asset.location || "-",
      clusterName: asset.cluster?.name || "-",

      // Server specs
      cpuCores: asset.cpuCores,
      ramGb: asset.ramGb,
      graphicsCardModel: asset.graphicsCardModel,
      graphicsCardSpec: asset.graphicsCardSpec,

      // Network specs
      interfaces: asset.interfaces,
      throughputGbps: asset.throughputGbps,
      vlanSupport: asset.vlanSupport,

      // Storage specs
      capacityTb: asset.capacityTb,
      noOfDisks: asset.noOfDisks,

      // Utilization metrics
      allocatedCpu,
      allocatedRam,
      allocatedStorage,
      cpuUtilPercent: Math.round(cpuPercent),
      ramUtilPercent: Math.round(ramPercent),
      storageUtilPercent: Math.round(storagePercent),
      utilizationPercent,
      utilizationStatus,

      // Warranty status
      warrantyExpiry: asset.warrantyExpiry ? asset.warrantyExpiry.toISOString() : null,
      warrantyStatus: calculatedWarrantyStatus,
      daysUntilWarrantyExpiry,
      isWarrantySoon,
      isWarrantyExpired,
      status: utilizationStatus,

      // Expandable children
      vmCount: hostedVms.length,
      hostedVms,
      licenseCount: licenses.length,
      licenses,
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

async function getHardwareReportAnalytics(where: Prisma.AssetWhereInput): Promise<HardwareReportAnalytics> {
  const [allAssets, byTypeRaw, byLocationRaw, unassignedVms] = await Promise.all([
    prisma.asset.findMany({
      where,
      include: {
        vms: {
          where: { status: { not: "RETIRED" }, decommissionedAt: null },
          include: {
            currentSpec: true,
            specHistory: { orderBy: { effectiveFrom: 'desc' }, take: 1 },
          }
        }
      }
    }),
    prisma.asset.groupBy({
      by: ["type"],
      where,
      _count: { _all: true }
    }),
    prisma.asset.groupBy({
      by: ["location"],
      where,
      _count: { _all: true }
    }),
    // Query active unassigned VMs if overall infrastructure or compute servers are viewed
    (!where.clusterId && (!where.type || where.type === 'SERVER'))
      ? prisma.vmInstance.findMany({
          where: {
            hostAssetId: null,
            status: { not: "RETIRED" },
            decommissionedAt: null,
          },
          include: {
            currentSpec: true,
            specHistory: { orderBy: { effectiveFrom: 'desc' }, take: 1 },
          }
        })
      : Promise.resolve([]),
  ]);

  const now = new Date();
  const byWarrantyCount: Record<string, number> = {
    ACTIVE: 0,
    EXPIRING_30D: 0,
    EXPIRING_90D: 0,
    EXPIRED: 0,
    UNKNOWN: 0,
  };

  let overloadedCount = 0;
  let underutilizedCount = 0;
  let totalCpu = 0;
  let totalRam = 0;
  let totalStorage = 0;
  let usedCpu = 0;
  let usedRam = 0;
  let usedStorage = 0;

  const utilBrackets = {
    "0-25%": 0,
    "26-50%": 0,
    "51-75%": 0,
    "76-90%": 0,
    ">90%": 0,
  };

  for (const asset of allAssets) {
    totalCpu += asset.cpuCores || 0;
    totalRam += asset.ramGb || 0;
    totalStorage += asset.storageGb || 0;

    let aCpu = 0;
    let aRam = 0;
    let aStorage = 0;
    for (const vm of asset.vms) {
      const spec = getEffectiveSpec(vm as any);
      aCpu += spec.vcpu;
      aRam += spec.ramGb;
      aStorage += spec.storageGb;
    }
    usedCpu += aCpu;
    usedRam += aRam;
    usedStorage += aStorage;

    const { warrantyStatus } = computeWarrantyStatus(asset.warrantyExpiry, now);
    byWarrantyCount[warrantyStatus] = (byWarrantyCount[warrantyStatus] || 0) + 1;

    if (asset.cpuCores || asset.ramGb) {
      const cPct = asset.cpuCores ? (aCpu / asset.cpuCores) * 100 : 0;
      const rPct = asset.ramGb ? (aRam / asset.ramGb) * 100 : 0;
      const util = Math.max(cPct, rPct);

      if (util > 90) overloadedCount++;
      else if (asset.vms.length > 0 && util < 40) underutilizedCount++;

      if (util <= 25) utilBrackets["0-25%"]++;
      else if (util <= 50) utilBrackets["26-50%"]++;
      else if (util <= 75) utilBrackets["51-75%"]++;
      else if (util <= 90) utilBrackets["76-90%"]++;
      else utilBrackets[">90%"]++;
    }
  }

  // Calculate unassigned active VM capacity
  let unassignedCpu = 0;
  let unassignedRam = 0;
  let unassignedStorage = 0;
  for (const vm of unassignedVms) {
    const spec = getEffectiveSpec(vm as any);
    unassignedCpu += spec.vcpu;
    unassignedRam += spec.ramGb;
    unassignedStorage += spec.storageGb;
  }

  return {
    totalCount: allAssets.length,
    byType: byTypeRaw.map(b => ({ type: b.type, count: b._count._all })),
    byLocation: byLocationRaw
      .filter(b => b.location)
      .map(b => ({ location: b.location!, count: b._count._all })),
    byWarranty: Object.entries(byWarrantyCount).map(([status, count]) => ({ status, count })),
    utilizationDistribution: Object.entries(utilBrackets).map(([range, count]) => ({ range, count })),
    overloadedCount,
    underutilizedCount,
    totalCapacity: { cpu: totalCpu, ram: totalRam, storage: totalStorage },
    usedCapacity: { 
      cpu: usedCpu + unassignedCpu, 
      ram: usedRam + unassignedRam, 
      storage: usedStorage + unassignedStorage 
    },
    unassignedVmCount: unassignedVms.length,
    unassignedCapacity: {
      cpu: unassignedCpu,
      ram: unassignedRam,
      storage: unassignedStorage,
    },
  };
}
