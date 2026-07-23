// lib/analytics/vmAnalytics.ts
import prisma from "@/lib/prisma";

export interface VmSummary {
  total: number;
  active: number;
  suspended: number;
  retired: number;
}

export interface VmByOwner {
  ownerName: string;
  count: number;
}

export interface VmByDomain {
  subdomain: string;
  count: number;
}

export interface VmByStatus {
  status: string;
  count: number;
}

export interface VmResourceAllocation {
  ownerName: string;
  totalCpu: number;
  totalRam: number;
  totalStorage: number;
}

export interface VmActivity {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorName: string;
  details: string;
  createdAt: Date;
}

export interface VmAnalytics {
  summary: VmSummary;
  byOwner: VmByOwner[];
  byDomain: VmByDomain[];
  byStatus: VmByStatus[];
  resourceAllocation: VmResourceAllocation[];
  recentActivity: VmActivity[];
}

export async function getVmAnalytics(): Promise<VmAnalytics> {
  const [
    summary,
    byOwner,
    byDomain,
    byStatus,
    resourceAllocation,
    recentActivity,
  ] = await Promise.all([
    getVmSummary(),
    getVmByOwner(),
    getVmByDomain(),
    getVmStatus(),
    getVmResourceAllocation(),
    getRecentVmActivity(),
  ]);

  return {
    summary,
    byOwner,
    byDomain,
    byStatus,
    resourceAllocation,
    recentActivity,
  };
}

async function getVmSummary(): Promise<VmSummary> {
  const [total, active, suspended, retired] = await Promise.all([
    prisma.vmInstance.count(),
    prisma.vmInstance.count({
      where: { status: { not: "RETIRED" } },
    }),
    prisma.vmInstance.count({
      where: { status: "SUSPENDED" },
    }),
    prisma.vmInstance.count({
      where: { status: "RETIRED" },
    }),
  ]);

  return {
    total,
    active: active - suspended,
    suspended,
    retired,
  };
}

async function getVmByOwner(): Promise<VmByOwner[]> {
  const result = await prisma.vmInstance.groupBy({
    by: ["ownerId"],
    _count: true,
    where: { ownerId: { not: null } },
    orderBy: { _count: { ownerId: "desc" } },
    take: 10,
  });

  const ownerIds = result.map((r: any) => r.ownerId).filter(Boolean) as string[];

  const owners = await prisma.user.findMany({
    where: { id: { in: ownerIds } },
    select: { id: true, name: true },
  });

  const ownerMap = new Map(owners.map((u: any) => [u.id, u.name]));

  return result.map((r: any) => ({
    ownerName: ownerMap.get(r.ownerId!) || "Unknown",
    count: r._count,
  }));
}

async function getVmByDomain(): Promise<VmByDomain[]> {
  const result = await prisma.vmInstance.groupBy({
    by: ["subdomain"],
    _count: true,
    where: { subdomain: { not: null } },
    orderBy: { _count: { subdomain: "desc" } },
    take: 10,
  });

  return result.map((r: any) => ({
    subdomain: r.subdomain || "No Domain",
    count: r._count,
  }));
}

async function getVmStatus(): Promise<VmByStatus[]> {
  const result = await prisma.vmInstance.groupBy({
    by: ["status"],
    _count: true,
  });

  return result.map((r: any) => ({
    status: r.status,
    count: r._count,
  }));
}

async function getRecentVmActivity(): Promise<VmActivity[]> {
  const logs = await prisma.auditLog.findMany({
    where: {
      action: {
        in: ["VM_CREATED", "VM_PROVISIONED", "VM_UPDATED", "VM_DECOMMISSIONED", "EXECUTE_REQUEST"],
      },
    },
    take: 10,
    orderBy: { timestamp: "desc" },
    include: {
      actor: { select: { name: true } },
    },
  });

  return logs.map((log: any) => ({
    id: log.id,
    action: log.action,
    entityType: log.entityType || "VM",
    entityId: log.entityId || "",
    actorName: log.actor?.name || "System",
    details: log.details ? JSON.stringify(log.details) : "",
    createdAt: log.timestamp,
  }));
}

async function getVmResourceAllocation(): Promise<VmResourceAllocation[]> {
  const vms = await prisma.vmInstance.findMany({
    where: { 
      ownerId: { not: null },
    },
    include: {
      owner: { select: { name: true } },
      currentSpec: { select: { vcpu: true, ramGb: true, storageGb: true } },
    },
  });

  const allocationMap = new Map<string, VmResourceAllocation>();

  for (const vm of vms) {
    const ownerName = vm.owner?.name || "Unknown";
    if (!allocationMap.has(ownerName)) {
      allocationMap.set(ownerName, {
        ownerName,
        totalCpu: 0,
        totalRam: 0,
        totalStorage: 0,
      });
    }

    const allocation = allocationMap.get(ownerName)!;
    allocation.totalCpu += vm.currentSpec?.vcpu || 0;
    allocation.totalRam += vm.currentSpec?.ramGb || 0;
    allocation.totalStorage += vm.currentSpec?.storageGb || 0;
  }

  return Array.from(allocationMap.values()).sort(
    (a: VmResourceAllocation, b: VmResourceAllocation) => b.totalCpu - a.totalCpu
  );
}
