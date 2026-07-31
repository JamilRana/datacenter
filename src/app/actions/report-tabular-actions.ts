// src/app/actions/report-tabular-actions.ts
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { canManageInventory } from "@/lib/roles";
import { 
  UserAllocationSummary, 
  UserVmDetail, 
  VmInventoryItem, 
  DcCapacityItem, 
  RequestDashboardItem, 
  RenewalItem, 
  AuditTrailItem,
  K8sNamespaceReportItem
} from "@/types/reports";
import { 
  Environment, 
  RequestStatus, 
  VmStatus, 
  Prisma
} from "@prisma/client";
import { startOfDay, endOfDay, differenceInDays } from "date-fns";

// ==========================================
// 1. User Allocation Summary
// ==========================================
export async function getUserAllocationReport(params: {
  page?: number;
  pageSize?: number;
  searchTerm?: string;
  organization?: string;
  environment?: Environment;
  from?: Date;
  to?: Date;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");
  if (!canManageInventory(session.user.roles)) throw new Error("Forbidden");

  const { page = 1, pageSize = 10, searchTerm, organization, environment, from, to } = params;
  console.log("getUserAllocationReport called with:", { from, to, environment });
  const skip = (page - 1) * pageSize;

  const whereClause: Prisma.UserWhereInput = {
    AND: [
      searchTerm ? {
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { email: { contains: searchTerm, mode: 'insensitive' } },
          { organization: { contains: searchTerm, mode: 'insensitive' } },
        ]
      } : {},
      organization ? { organization } : {},
      {
        ownedVms: {
          some: {
            ...(environment ? { environment } : {}),
            ...(from || to ? {
              createdAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              }
            } : {})
          }
        }
      }
    ]
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      include: {
        ownedVms: {
          include: {
            currentSpec: true
          }
        }
      },
      skip,
      take: pageSize,
    }),
    prisma.user.count({ where: whereClause })
  ]);

  const data: UserAllocationSummary[] = users.map((user: any) => {
    const activeVms = user.ownedVms.filter((vm: any) => vm.status === 'ACTIVE');
    const suspendedVms = user.ownedVms.filter((vm: any) => vm.status === 'SUSPENDED');
    
    const vcpu = user.ownedVms.reduce((sum: number, vm: any) => sum + (vm.currentSpec?.vcpu || 0), 0);
    const ram = user.ownedVms.reduce((sum: number, vm: any) => sum + (vm.currentSpec?.ramGb || 0), 0);
    const storage = user.ownedVms.reduce((sum: number, vm: any) => sum + (vm.currentSpec?.storageGb || 0), 0);

    return {
      userId: user.id,
      name: user.name,
      designation: user.designation || "N/A",
      organization: user.organization || "N/A",
      totalVms: user.ownedVms.length,
      vcpuAllocated: vcpu,
      ramAllocatedGb: ram,
      storageAllocatedGb: storage,
      activeVms: activeVms.length,
      suspendedVms: suspendedVms.length,
      lastActivity: user.updatedAt.toISOString()
    };
  });

  return { data, total, page, pageSize };
}

// ==========================================
// 2. User Detail Modal Data
// ==========================================
export async function getUserVmDetails(userId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");
  // Security check: Only Admins/DCOps OR the user themselves
  const isAdmin = canManageInventory(session.user.roles);
  if (!isAdmin && session.user.id !== userId) throw new Error("Forbidden");

  const vms = await prisma.vmInstance.findMany({
    where: { ownerId: userId },
    include: {
      currentSpec: true,
      request: { select: { systemName: true } },
      hostAsset: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  const data: UserVmDetail[] = vms.map((vm: any) => ({
    id: vm.id,
    hostname: vm.hostname || "UNNAMED",
    ipAddress: vm.ipAddress || "PENDING",
    environment: vm.environment || Environment.PRODUCTION,
    vcpu: vm.currentSpec?.vcpu || 0,
    ramGb: vm.currentSpec?.ramGb || 0,
    storageGb: vm.currentSpec?.storageGb || 0,
    os: `${vm.currentSpec?.osName || ""} ${vm.currentSpec?.osVersion || ""}`.trim() || "N/A",
    cluster: vm.hostAsset?.name || "Unassigned",
    status: vm.status,
    renewalDate: vm.renewalDate?.toISOString() || "",
    requestId: vm.requestId || "N/A"
  }));

  return data;
}

// ==========================================
// 3. VM Inventory Report
// ==========================================
export async function getVmInventoryReport(params: {
  page?: number;
  pageSize?: number;
  environment?: Environment;
  status?: VmStatus;
  searchTerm?: string;
  cluster?: string;
  from?: Date;
  to?: Date;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const isAdmin = canManageInventory(session.user.roles);
  const { page = 1, pageSize = 10, environment, status, searchTerm, cluster, from, to } = params;
  const skip = (page - 1) * pageSize;

  const whereClause: Prisma.VmInstanceWhereInput = {
    AND: [
      !isAdmin ? { ownerId: session.user.id } : {},
      environment ? { environment } : {},
      status ? { status } : {},
      searchTerm ? {
        OR: [
          { hostname: { contains: searchTerm, mode: 'insensitive' } },
          { ipAddress: { contains: searchTerm, mode: 'insensitive' } },
          { owner: { name: { contains: searchTerm, mode: 'insensitive' } } }
        ]
      } : {},
      cluster ? { hostAsset: { name: { contains: cluster, mode: 'insensitive' } } } : {},
      from || to ? {
        createdAt: {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        }
      } : {}
    ]
  };

  const [vms, total] = await Promise.all([
    prisma.vmInstance.findMany({
      where: whereClause,
      include: {
        owner: { select: { name: true } },
        request: { select: { systemName: true } },
        hostAsset: { select: { name: true } },
        currentSpec: true,
      },
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.vmInstance.count({ where: whereClause })
  ]);

  const data: VmInventoryItem[] = vms.map((vm: any) => ({
    id: vm.id,
    hostname: vm.hostname || "UNNAMED",
    owner: vm.owner?.name || "Unknown",
    project: vm.request?.systemName || "N/A",
    environment: vm.environment || Environment.PRODUCTION,
    vcpu: vm.currentSpec?.vcpu || 0,
    ramGb: vm.currentSpec?.ramGb || 0,
    storageGb: vm.currentSpec?.storageGb || 0,
    cluster: vm.hostAsset?.name || "Unassigned",
    status: vm.status,
    provisionedDate: vm.provisionedAt?.toISOString() || vm.createdAt.toISOString(),
    renewalDate: vm.renewalDate?.toISOString() || "",
    requestId: vm.requestId || "N/A"
  }));

  return { data, total, page, pageSize };
}

// ==========================================
// 4. DC Capacity Report
// ==========================================
export async function getDcCapacityReport() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");
  if (!canManageInventory(session.user.roles)) throw new Error("Forbidden");

  const assets = await prisma.asset.findMany({
    where: { type: 'SERVER' },
    include: {
      vms: {
        where: { status: 'ACTIVE' },
        include: { currentSpec: true }
      }
    }
  });

  const data: DcCapacityItem[] = assets.map((asset: any) => {
    const usedVcpu = asset.vms.reduce((sum: number, vm: any) => sum + (vm.currentSpec?.vcpu || 0), 0);
    const usedRam = asset.vms.reduce((sum: number, vm: any) => sum + (vm.currentSpec?.ramGb || 0), 0);
    const usedStorage = asset.vms.reduce((sum: number, vm: any) => sum + (vm.currentSpec?.storageGb || 0), 0);

    return {
      assetId: asset.id,
      clusterName: asset.name,
      totalVcpu: asset.cpuCores || 0,
      usedVcpu,
      freeVcpu: Math.max(0, (asset.cpuCores || 0) - usedVcpu),
      totalRamGb: asset.ramGb || 0,
      usedRamGb: usedRam,
      freeRamGb: Math.max(0, (asset.ramGb || 0) - usedRam),
      totalStorageGb: asset.storageGb || 0,
      usedStorageGb: usedStorage,
      freeStorageGb: Math.max(0, (asset.storageGb || 0) - usedStorage),
      lastSynced: new Date().toISOString()
    };
  });

  return { data, total: data.length };
}

// ==========================================
// 5. Request Dashboard Report
// ==========================================
export async function getRequestsReport(params: {
  page?: number;
  pageSize?: number;
  status?: RequestStatus;
  environment?: Environment;
  searchTerm?: string;
  startDate?: string;
  endDate?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const isAdmin = canManageInventory(session.user.roles);
  const { page = 1, pageSize = 10, status, environment, searchTerm, startDate, endDate } = params;
  const skip = (page - 1) * pageSize;

  const whereClause: Prisma.RequestWhereInput = {
    AND: [
      !isAdmin ? { requesterId: session.user.id } : {},
      status ? { status } : {},
      environment ? { environment } : {},
      searchTerm ? {
        OR: [
          { systemName: { contains: searchTerm, mode: 'insensitive' } },
          { projectName: { contains: searchTerm, mode: 'insensitive' } },
          { requester: { name: { contains: searchTerm, mode: 'insensitive' } } }
        ]
      } : {},
      startDate ? { createdAt: { gte: startOfDay(new Date(startDate)) } } : {},
      endDate ? { createdAt: { lte: endOfDay(new Date(endDate)) } } : {},
    ]
  };

  const [requests, total] = await Promise.all([
    prisma.request.findMany({
      where: whereClause,
      include: {
        requester: { select: { name: true } },
        approvals: {
          where: { decision: 'PENDING' },
          include: { approver: { select: { name: true } } },
          orderBy: { level: 'asc' },
          take: 1
        }
      },
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.request.count({ where: whereClause })
  ]);

  const data: RequestDashboardItem[] = requests.map((req: any) => ({
    id: req.id,
    requestId: req.requestId || req.id.slice(0, 8).toUpperCase(),
    type: req.requestType,
    requester: req.requester?.name || "Unknown",
    project: req.systemName || "N/A",
    environment: req.environment,
    status: req.status,
    currentApprover: req.approvals[0]?.approver?.name || "TBD",
    submittedAt: req.submittedAt?.toISOString() || req.createdAt.toISOString(),
    updatedAt: req.updatedAt.toISOString(),
    agingDays: req.submittedAt ? differenceInDays(new Date(), req.submittedAt) : differenceInDays(new Date(), req.createdAt)
  }));

  return { data, total, page, pageSize };
}

// ==========================================
// 6. Renewal / End-of-Life Report
// ==========================================
export async function getRenewalsReport(params: {
  page?: number;
  pageSize?: number;
  environment?: Environment;
  searchTerm?: string;
  from?: Date;
  to?: Date;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const isAdmin = canManageInventory(session.user.roles);
  const { page = 1, pageSize = 10, environment, searchTerm, from, to } = params;
  const skip = (page - 1) * pageSize;

  const whereClause: Prisma.VmInstanceWhereInput = {
    AND: [
      !isAdmin ? { ownerId: session.user.id } : {},
      environment ? { environment } : {},
      { renewalDate: { not: null } },
      searchTerm ? {
        OR: [
          { hostname: { contains: searchTerm, mode: 'insensitive' } },
          { owner: { name: { contains: searchTerm, mode: 'insensitive' } } }
        ]
      } : {},
      from || to ? {
        renewalDate: {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        }
      } : {}
    ]
  };

  const [vms, total] = await Promise.all([
    prisma.vmInstance.findMany({
      where: whereClause,
      include: {
        owner: { select: { name: true } },
        request: { select: { systemName: true } }
      },
      skip,
      take: pageSize,
      orderBy: { renewalDate: 'asc' }
    }),
    prisma.vmInstance.count({ where: whereClause })
  ]);

  const data: RenewalItem[] = vms.map((vm: any) => ({
    id: vm.id,
    vmName: vm.hostname || "UNNAMED",
    ownerName: vm.owner?.name || "Unknown",
    project: vm.request?.systemName || "N/A",
    environment: vm.environment || Environment.PRODUCTION,
    renewalDate: vm.renewalDate?.toISOString() || "",
    daysRemaining: vm.renewalDate ? differenceInDays(vm.renewalDate, new Date()) : 999,
    status: vm.status,
    lastRenewed: vm.updatedAt.toISOString()
  }));

  return { data, total, page, pageSize };
}

// ==========================================
// 7. Audit Trail Report
// ==========================================
export async function getAuditTrailReport(params: {
  page?: number;
  pageSize?: number;
  startDate?: string;
  endDate?: string;
  userId?: string;
  actionType?: string[];
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");
  if (!canManageInventory(session.user.roles)) throw new Error("Forbidden");

  const { page = 1, pageSize = 10, startDate, endDate, userId, actionType } = params;
  const skip = (page - 1) * pageSize;

  const whereClause: Prisma.AuditLogWhereInput = {
    AND: [
      userId ? { actorId: userId } : {},
      actionType && actionType.length > 0 ? { action: { in: actionType } } : {},
      startDate ? { timestamp: { gte: startOfDay(new Date(startDate)) } } : {},
      endDate ? { timestamp: { lte: endOfDay(new Date(endDate)) } } : {},
    ]
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: whereClause,
      include: {
        actor: { select: { name: true, roles: { include: { role: true } } } }
      },
      skip,
      take: pageSize,
      orderBy: { timestamp: 'desc' }
    }),
    prisma.auditLog.count({ where: whereClause })
  ]);

  const data: AuditTrailItem[] = logs.map((log: any) => ({
    id: log.id,
    timestamp: log.timestamp.toISOString(),
    actor: log.actor?.name || "System",
    role: log.actor?.roles.map((r: any) => r.role.name) || [],
    action: log.action,
    entityType: log.entityType || "N/A",
    entityId: log.entityId || "N/A",
    ipAddress: "N/A", // Hidden or not tracked in schema yet
    details: log.details as unknown as AuditTrailItem['details']
  }));

  return { data, total, page, pageSize };
}

// ==========================================
// 8. K8s Namespace Report
// ==========================================
export async function getK8sNamespaceReport(params: {
  page?: number;
  pageSize?: number;
  searchTerm?: string;
  environment?: Environment;
  from?: Date;
  to?: Date;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const isAdminOrDCOps = canManageInventory(session.user.roles);
  const { page = 1, pageSize = 10, searchTerm = "", environment, from, to } = params;
  const skip = (page - 1) * pageSize;

  const whereClause: Prisma.K8sNamespaceWhereInput = {
    AND: [
      !isAdminOrDCOps ? {
        clusters: {
          some: {
            request: {
              requesterId: session.user.id
            }
          }
        }
      } : {},
      environment ? {
        clusters: {
          some: {
            request: {
              environment: environment
            }
          }
        }
      } : {},
      searchTerm ? {
        OR: [
          { name: { contains: searchTerm, mode: "insensitive" } },
          { supervisorIp: { contains: searchTerm, mode: "insensitive" } },
          {
            clusters: {
              some: {
                request: {
                  OR: [
                    { systemName: { contains: searchTerm, mode: "insensitive" } },
                    { projectName: { contains: searchTerm, mode: "insensitive" } },
                    { requester: { name: { contains: searchTerm, mode: "insensitive" } } }
                  ]
                }
              }
            }
          }
        ]
      } : {},
      from || to ? {
        createdAt: {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {})
        }
      } : {}
    ]
  };

  const [namespaces, total] = await Promise.all([
    prisma.k8sNamespace.findMany({
      where: whereClause,
      include: {
        clusters: {
          include: {
            request: {
              include: {
                requester: {
                  select: {
                    name: true
                  }
                }
              }
            },
            nodeGroups: {
              include: {
                nodes: true
              }
            }
          }
        }
      },
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" }
    }),
    prisma.k8sNamespace.count({ where: whereClause })
  ]);

  const data: K8sNamespaceReportItem[] = namespaces.map((ns: any) => {
    // Collect clusters details
    const activeCluster = ns.clusters[0]; // Usually one cluster per namespace
    const request = activeCluster?.request;
    
    let totalNodes = 0;
    let totalVcpu = 0;
    let totalRamGb = 0;

    if (activeCluster?.nodeGroups) {
      for (const group of activeCluster.nodeGroups) {
        totalNodes += group.nodes.length;
        totalVcpu += (group.vcpu || 0) * group.nodes.length;
        totalRamGb += (group.ramGb || 0) * group.nodes.length;
      }
    }

    return {
      id: ns.id,
      name: ns.name,
      supervisorIp: ns.supervisorIp || "N/A",
      clusterName: activeCluster?.clusterName || "N/A",
      project: request?.systemName || request?.projectName || "N/A",
      owner: request?.requester?.name || "System",
      environment: request?.environment || "N/A",
      totalNodes,
      totalVcpu,
      totalRamGb,
      status: activeCluster?.status || "ACTIVE",
      createdAt: ns.createdAt.toISOString()
    };
  });

  return { data, total, page, pageSize };
}
