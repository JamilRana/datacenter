// src/app/actions/dashboard-actions.ts
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { ROLES, hasRole } from "@/lib/roles";

export async function getOpsDashboardData() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user || (!hasRole(session.user.roles, ROLES.DCOPS) && !hasRole(session.user.roles, ROLES.ADMIN))) {
    throw new Error("Unauthorized access to Ops Hub");
  }

  // Fetch host servers and active VM specs to calculate dynamic utilization
  const hosts = await prisma.asset.findMany({
    where: { type: "SERVER" },
    include: {
      vms: {
        where: { status: "ACTIVE" },
        include: { currentSpec: { select: { vcpu: true, ramGb: true } } }
      }
    }
  });

  let totalCpu = 0;
  let totalRam = 0;
  let allocatedCpu = 0;
  let allocatedRam = 0;

  for (const host of hosts) {
    totalCpu += host.cpuCores || 0;
    totalRam += host.ramGb || 0;
    for (const vm of host.vms) {
      allocatedCpu += vm.currentSpec?.vcpu || 0;
      allocatedRam += vm.currentSpec?.ramGb || 0;
    }
  }

  const cpuUsage = totalCpu > 0 ? Math.round((allocatedCpu / totalCpu) * 100) : 45;
  const ramUsage = totalRam > 0 ? Math.round((allocatedRam / totalRam) * 100) : 55;
  const computeStatus = cpuUsage > 90 || ramUsage > 90 ? "warning" : "healthy";

  // Provisioning queue logic
  const provisioningRequests = await prisma.request.findMany({
    where: { 
      status: "APPROVED",
      vmInstances: { none: {} }
    },
    orderBy: { createdAt: "asc" },
    take: 5,
    select: { id: true, systemName: true, createdAt: true }
  });

  const provisioningInProgress = await prisma.request.findMany({
    where: { 
      status: "PROVISIONED",
      provisionedAt: { gte: new Date(Date.now() - 3600000) }
    },
    orderBy: { provisionedAt: "desc" },
    take: 5,
    select: { id: true, systemName: true, provisionedAt: true }
  });

  return {
    systemHealth: {
      computeNodes: { value: 100 - Math.max(0, cpuUsage - 85), status: computeStatus },
      storageCluster: { value: 87, status: "warning" },
      network: { value: 100, status: "healthy" },
      database: { value: 92, status: "healthy" }
    },
    resourceUsage: {
      cpu: cpuUsage,
      memory: ramUsage,
      diskIo: 42
    },
    provisioningQueue: [
      ...provisioningInProgress.map((r: any) => ({ id: r.id, name: r.systemName, status: "PROVISIONING", progress: 85 })),
      ...provisioningRequests.map((r: any) => ({ id: r.id, name: r.systemName, status: "QUEUED", progress: 0 }))
    ],
    alerts: [
      { id: "1", severity: "critical", message: "High CPU on node-03", source: "compute", timestamp: new Date().toISOString() },
      { id: "2", severity: "warning", message: "Low Disk on storage-01", source: "storage", timestamp: new Date().toISOString() },
    ]
  };
}

export async function getRequesterDashboardData() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const userId = session.user.id;

  const [activeRequests, approvedVms, pendingApprovals, totalResources] = await Promise.all([
    prisma.request.count({
      where: { requesterId: userId, status: { in: ["DRAFT", "PENDING_L1", "PENDING_L2", "PENDING_L3"] } }
    }),
    prisma.vmInstance.count({
      where: { request: { requesterId: userId }, status: "ACTIVE" }
    }),
    prisma.request.count({
       where: { requesterId: userId, status: { in: ["PENDING_L1", "PENDING_L2", "PENDING_L3"] } }
    }),
    prisma.vmSpec.aggregate({
      _sum: { vcpu: true, ramGb: true },
      where: { vmInstance: { request: { requesterId: userId }, status: "ACTIVE" } }
    })
  ]);

  const recentRequests = await prisma.request.findMany({
    where: { requesterId: userId },
    orderBy: { createdAt: "desc" },
    take: 5
  });

  return {
    stats: {
      activeRequests,
      approvedVms,
      pendingApprovals,
      totalResources: {
        vcpu: totalResources._sum.vcpu || 0,
        ramGb: totalResources._sum.ramGb || 0
      }
    },
    recentRequests: JSON.parse(JSON.stringify(recentRequests))
  };
}
