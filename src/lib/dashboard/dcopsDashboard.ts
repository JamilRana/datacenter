// lib/dashboard/dcopsDashboard.ts
import prisma from "@/lib/prisma";
import { VmStatus } from "@prisma/client";

export interface DcopsDashboardStats {
  totalVcpuAllocated: number;
  totalRamAllocated: number;
  availableHardwareAssets: number;
  pendingProvisioning: number;
}

export interface ServerUtilization {
  totalServers: number;
  activeServers: number;
  suspendedServers: number;
  utilizationPercent: number;
}

export interface EnvironmentDistribution {
  environment: string;
  count: number;
}

export interface ProvisioningQueueItem {
  id: string;
  requestId: string | null;
  systemName: string;
  requesterName: string;
  vcpu: number;
  ramGb: number;
  storageGb: number;
  environment: string;
  createdAt: Date;
  expectedDeliveryDate?: Date;
}

export interface DcopsDashboardData {
  stats: DcopsDashboardStats;
  serverUtilization: ServerUtilization;
  environmentDistribution: EnvironmentDistribution[];
  provisioningQueue: ProvisioningQueueItem[];
}

export async function getDcopsDashboardData(): Promise<DcopsDashboardData> {
  const [
    stats,
    serverUtilization,
    environmentDistribution,
    provisioningQueue,
  ] = await Promise.all([
    getDcopsStats(),
    getServerUtilization(),
    getEnvironmentDistribution(),
    getProvisioningQueue(),
  ]);

  return {
    stats,
    serverUtilization,
    environmentDistribution,
    provisioningQueue,
  };
}

async function getDcopsStats(): Promise<DcopsDashboardStats> {
  const [
    vmSpecs,
    availableHardwareAssets,
    pendingProvisioning,
  ] = await Promise.all([
    prisma.vmSpec.findMany({
      select: { vcpu: true, ramGb: true },
    }),
    prisma.asset.count({
      where: {
        serial: { not: null },
      },
    }),
    prisma.request.count({
      where: {
        status: { in: ["APPROVED", "REQUESTER_APPROVED"] },
      },
    }),
  ]);

  const totalVcpuAllocated = vmSpecs.reduce((sum: number, spec: any) => sum + spec.vcpu, 0);
  const totalRamAllocated = vmSpecs.reduce((sum: number, spec: any) => sum + spec.ramGb, 0);

  return {
    totalVcpuAllocated,
    totalRamAllocated,
    availableHardwareAssets,
    pendingProvisioning,
  };
}

async function getServerUtilization(): Promise<ServerUtilization> {
  const [totalServers, activeCount, suspendedCount] = await Promise.all([
    prisma.vmInstance.count(),
    prisma.vmInstance.count({ where: { status: VmStatus.ACTIVE } }),
    prisma.vmInstance.count({ where: { status: VmStatus.SUSPENDED } }),
  ]);

  const utilizationPercent = totalServers > 0 ? Math.round((activeCount / totalServers) * 100) : 0;

  return {
    totalServers,
    activeServers: activeCount,
    suspendedServers: suspendedCount,
    utilizationPercent,
  };
}

async function getEnvironmentDistribution(): Promise<EnvironmentDistribution[]> {
  const vms = await prisma.vmInstance.findMany({
    where: { environment: { not: null } },
    select: { environment: true },
  });

  const envCount: Record<string, number> = {};
  for (const vm of vms) {
    if (vm.environment) {
      envCount[vm.environment] = (envCount[vm.environment] || 0) + 1;
    }
  }

  return Object.entries(envCount)
    .map(([environment, count]: any) => ({ environment, count }))
    .sort((a: any, b: any) => b.count - a.count);
}

async function getProvisioningQueue(): Promise<ProvisioningQueueItem[]> {
  const requests = await prisma.request.findMany({
    where: {
      status: { in: ["APPROVED", "REQUESTER_APPROVED"] },
    },
    take: 10,
    orderBy: { createdAt: "desc" },
    include: {
      requester: {
        select: { name: true },
      },
    },
  });

  return requests.map((req: any) => ({
    id: req.id,
    requestId: req.requestId,
    systemName: req.systemName,
    requesterName: req.requester.name,
    vcpu: req.vcpu || 0,
    ramGb: req.ramGb || 0,
    storageGb: req.storageGb || 0,
    environment: req.environment,
    createdAt: req.createdAt,
    expectedDeliveryDate: req.expectedDeliveryDate ?? undefined,
  }));
}
