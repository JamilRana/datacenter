// lib/dashboard/requesterDashboard.ts
import prisma from "@/lib/prisma";
import { VmStatus } from "@prisma/client";

export interface RequesterDashboardStats {
  myActiveVms: number;
  myPendingRequests: number;
  myCpuUsed: number;
  myRamUsedGb: number;
  myStorageUsedGb: number;
}

export interface MyResourceAllocation {
  vcpu: number;
  ramGb: number;
  storageGb: number;
  vmCount: number;
}

export interface MyRecentActivity {
  id: string;
  type: "VM" | "REQUEST" | "CUSTOMIZATION";
  action: string;
  targetName: string;
  timestamp: Date;
  status: string;
}

export interface RequesterDashboardData {
  stats: RequesterDashboardStats;
  resourceAllocation: MyResourceAllocation;
  recentActivity: MyRecentActivity[];
}

export async function getRequesterDashboardData(userId: string): Promise<RequesterDashboardData> {
  const [
    stats,
    resourceAllocation,
    recentActivity,
  ] = await Promise.all([
    getRequesterStats(userId),
    getResourceAllocation(userId),
    getRecentActivity(userId),
  ]);

  return {
    stats,
    resourceAllocation,
    recentActivity,
  };
}

async function getRequesterStats(userId: string): Promise<RequesterDashboardStats> {
  const [
    myActiveVms,
    myPendingRequests,
    vmSpecs,
  ] = await Promise.all([
    prisma.vmInstance.count({
      where: { ownerId: userId, status: VmStatus.ACTIVE },
    }),
    prisma.request.count({
      where: {
        requesterId: userId,
        status: {
          in: ["PENDING_L1", "PENDING_L2", "PENDING_L3", "PENDING_L4", "REQUESTER_APPROVED"],
        },
      },
    }),
    prisma.vmSpec.findMany({
      where: {
        vmInstance: { ownerId: userId },
      },
      select: { vcpu: true, ramGb: true, storageGb: true },
    }),
  ]);

  const myCpuUsed = vmSpecs.reduce((sum: number, spec: any) => sum + spec.vcpu, 0);
  const myRamUsedGb = vmSpecs.reduce((sum: number, spec: any) => sum + spec.ramGb, 0);
  const myStorageUsedGb = vmSpecs.reduce((sum: number, spec: any) => sum + spec.storageGb, 0);

  return {
    myActiveVms,
    myPendingRequests,
    myCpuUsed,
    myRamUsedGb,
    myStorageUsedGb,
  };
}

async function getResourceAllocation(userId: string): Promise<MyResourceAllocation> {
  const vmSpecs = await prisma.vmSpec.findMany({
    where: {
      vmInstance: { ownerId: userId },
    },
    select: { vcpu: true, ramGb: true, storageGb: true },
  });

  if (vmSpecs.length === 0) {
    return { vcpu: 0, ramGb: 0, storageGb: 0, vmCount: 0 };
  }

  return {
    vcpu: vmSpecs.reduce((sum: number, spec: any) => sum + spec.vcpu, 0),
    ramGb: vmSpecs.reduce((sum: number, spec: any) => sum + spec.ramGb, 0),
    storageGb: vmSpecs.reduce((sum: number, spec: any) => sum + spec.storageGb, 0),
    vmCount: vmSpecs.length,
  };
}

async function getRecentActivity(userId: string): Promise<MyRecentActivity[]> {
  const [vms, requests] = await Promise.all([
    prisma.vmInstance.findMany({
      where: { ownerId: userId },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, hostname: true, createdAt: true, status: true },
    }),
    prisma.request.findMany({
      where: { requesterId: userId },
      take: 10,
      orderBy: { createdAt: "desc" },
      select: { id: true, systemName: true, createdAt: true, status: true },
    }),
  ]);

  const activities: MyRecentActivity[] = [
    ...vms.map((vm: any) => ({
      id: vm.id,
      type: "VM" as const,
      action: "Created VM",
      targetName: vm.hostname || vm.id,
      timestamp: vm.createdAt,
      status: vm.status,
    })),
    ...requests.map((req: any) => ({
      id: req.id,
      type: "REQUEST" as const,
      action: "Submitted Request",
      targetName: req.systemName,
      timestamp: req.createdAt,
      status: req.status,
    })),
  ];

  return activities
    .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);
}
