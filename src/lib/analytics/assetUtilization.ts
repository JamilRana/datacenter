// src/lib/analytics/assetUtilization.ts
import prisma from "@/lib/prisma";

export interface VmOnAsset {
  id: string;
  hostname: string;
  ownerName: string;
  vcpu: number;
  ramGb: number;
  storageGb: number;
  status: string;
}

export interface AssetUtilization {
  assetId: string;
  assetName: string;
  capacity: {
    cpuCores: number;
    ramGb: number;
    storageGb: number;
  };
  allocated: {
    cpuCores: number;
    ramGb: number;
    storageGb: number;
  };
  available: {
    cpuCores: number;
    ramGb: number;
    storageGb: number;
  };
  usagePercent: {
    cpu: number;
    ram: number;
    storage: number;
  };
  vms: VmOnAsset[];
  isOverallocated: boolean;
}

interface AssetWithVms {
  id: string;
  name: string;
  cpuCores: number | null;
  ramGb: number | null;
  storageGb: number | null;
  vms: Array<{
    id: string;
    hostname: string | null;
    status: string;
    currentSpec: { vcpu: number; ramGb: number; storageGb: number } | null;
    owner: { name: string | null } | null;
  }>;
}

export async function getAssetUtilization(assetId: string): Promise<AssetUtilization | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const asset = await (prisma.asset.findUnique as any)({
    where: { id: assetId },
    include: {
      vms: {
        where: { status: { not: "RETIRED" } },
        include: {
          owner: { select: { name: true } },
          currentSpec: { select: { vcpu: true, ramGb: true, storageGb: true } },
        },
      },
    },
  }) as AssetWithVms | null;

  if (!asset) return null;

  const capacity = {
    cpuCores: asset.cpuCores || 0,
    ramGb: asset.ramGb || 0,
    storageGb: asset.storageGb || 0,
  };

  const allocated = {
    cpuCores: asset.vms.reduce((sum, vm) => sum + (vm.currentSpec?.vcpu || 0), 0),
    ramGb: asset.vms.reduce((sum, vm) => sum + (vm.currentSpec?.ramGb || 0), 0),
    storageGb: asset.vms.reduce((sum, vm) => sum + (vm.currentSpec?.storageGb || 0), 0),
  };

  const available = {
    cpuCores: Math.max(0, capacity.cpuCores - allocated.cpuCores),
    ramGb: Math.max(0, capacity.ramGb - allocated.ramGb),
    storageGb: Math.max(0, capacity.storageGb - allocated.storageGb),
  };

  const usagePercent = {
    cpu: capacity.cpuCores > 0 ? (allocated.cpuCores / capacity.cpuCores) * 100 : 0,
    ram: capacity.ramGb > 0 ? (allocated.ramGb / capacity.ramGb) * 100 : 0,
    storage: capacity.storageGb > 0 ? (allocated.storageGb / capacity.storageGb) * 100 : 0,
  };

  const isOverallocated = 
    allocated.cpuCores > capacity.cpuCores ||
    allocated.ramGb > capacity.ramGb ||
    allocated.storageGb > capacity.storageGb;

  return {
    assetId: asset.id,
    assetName: asset.name,
    capacity,
    allocated,
    available,
    usagePercent,
    isOverallocated,
    vms: asset.vms.map(vm => ({
      id: vm.id,
      hostname: vm.hostname || "Unnamed",
      ownerName: vm.owner?.name || "Unknown",
      vcpu: vm.currentSpec?.vcpu || 0,
      ramGb: vm.currentSpec?.ramGb || 0,
      storageGb: vm.currentSpec?.storageGb || 0,
      status: vm.status,
    })),
  };
}
