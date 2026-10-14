// src/app/actions/report-tabular-actions.ts
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { canManageInventory } from "@/lib/roles";
import { 
  UserAllocationSummary, 
  UserAllocationReportResult,
  UserVmDetail,
  UserNamespaceDetail,
  UserResourceDetailsResult,
  VmInventoryItem, 
  DcCapacityItem, 
  RequestDashboardItem, 
  RenewalItem, 
  AuditTrailItem,
  K8sNamespaceReportItem,
  K8sNodeGroupDetail
} from "@/types/reports";
import { 
  Environment, 
  RequestStatus, 
  RequestType,
  VmStatus, 
  Prisma
} from "@prisma/client";
import { startOfDay, endOfDay, differenceInDays, differenceInHours } from "date-fns";
import { resolveK8sSystemName } from "@/lib/system-utils";
import { 
  getReportScope, 
  assertCanViewInfrastructure, 
  resolveSystemName, 
  getEffectiveSpec,
  normalizeSystemName,
  systemNameWhere
} from "@/lib/reports";

// ==========================================
// 1. User Allocation Summary (Point-in-Time)
// ==========================================
export async function getUserAllocationReport(params: {
  page?: number;
  pageSize?: number;
  getAll?: boolean;
  organization?: string;
  environment?: Environment;
  searchTerm?: string;
  from?: Date;
  to?: Date;
}): Promise<UserAllocationReportResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const { page = 1, pageSize = 10, getAll = false, organization, environment, searchTerm } = params;
  const skip = getAll ? undefined : (page - 1) * pageSize;
  const take = getAll ? undefined : pageSize;

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
        OR: [
          { ownedVms: { some: environment ? { environment } : {} } },
          { requests: { some: { vmInstances: { some: environment ? { environment } : {} } } } }
        ]
      }
    ]
  };

  const vmInclude = {
    currentSpec: true,
    specHistory: { orderBy: { effectiveFrom: 'desc' as const }, take: 1 },
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
    }
  };

  const [users, total, allUsersForSummary] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      include: {
        ownedVms: {
          include: vmInclude
        },
        requests: {
          include: {
            vmInstances: {
              include: vmInclude
            }
          }
        }
      },
      skip,
      take,
      orderBy: { name: 'asc' }
    }),
    prisma.user.count({ where: whereClause }),
    // Aggregate overall metrics across all matching users for consistent KPI cards
    prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        ownedVms: {
          select: {
            id: true,
            status: true,
            decommissionedAt: true,
            sequenceNumber: true,
            currentSpec: true,
            specHistory: { orderBy: { effectiveFrom: 'desc' as const }, take: 1 },
            request: {
              select: {
                vcpu: true,
                ramGb: true,
                storageGb: true,
                vmSpecifications: true
              }
            }
          }
        },
        requests: {
          select: {
            vmInstances: {
              select: {
                id: true,
                status: true,
                decommissionedAt: true,
                sequenceNumber: true,
                currentSpec: true,
                specHistory: { orderBy: { effectiveFrom: 'desc' as const }, take: 1 },
                request: {
                  select: {
                    vcpu: true,
                    ramGb: true,
                    storageGb: true,
                    vmSpecifications: true
                  }
                }
              }
            }
          }
        }
      }
    })
  ]);

  // Fetch K8s namespaces for users in current page
  const userIds = users.map((u: any) => u.id);
  const userNamespaceMap = new Map<string, number>();

  if (userIds.length > 0) {
    const namespaces = await prisma.k8sNamespace.findMany({
      where: {
        OR: [
          { requests: { some: { requesterId: { in: userIds } } } },
          { clusters: { some: { request: { requesterId: { in: userIds } } } } },
        ],
      },
      include: {
        requests: { select: { requesterId: true } },
        clusters: { include: { request: { select: { requesterId: true } } } },
      },
    });

    for (const ns of namespaces) {
      const userIdsForNs = new Set<string>();
      for (const req of ns.requests) {
        if (req.requesterId) userIdsForNs.add(req.requesterId);
      }
      for (const cl of ns.clusters) {
        if (cl.request?.requesterId) userIdsForNs.add(cl.request.requesterId);
      }
      for (const uId of userIdsForNs) {
        userNamespaceMap.set(uId, (userNamespaceMap.get(uId) || 0) + 1);
      }
    }
  }

  // Compute dataset-wide summary statistics across all matching tenants
  let totalActiveVms = 0;
  let totalVcpu = 0;
  let totalRamGb = 0;
  let totalStorageGb = 0;
  const processedVmIds = new Set<string>();

  for (const u of allUsersForSummary) {
    const userVms: any[] = [];
    for (const vm of u.ownedVms || []) {
      if (!processedVmIds.has(vm.id)) {
        processedVmIds.add(vm.id);
        userVms.push(vm);
      }
    }
    for (const req of u.requests || []) {
      for (const vm of req.vmInstances || []) {
        if (!processedVmIds.has(vm.id)) {
          processedVmIds.add(vm.id);
          userVms.push(vm);
        }
      }
    }

    for (const vm of userVms) {
      if (vm.status === 'ACTIVE' && !vm.decommissionedAt) {
        totalActiveVms += 1;
        const spec = getEffectiveSpec(vm);
        totalVcpu += spec.vcpu;
        totalRamGb += spec.ramGb;
        totalStorageGb += spec.storageGb;
      }
    }
  }

  const data: UserAllocationSummary[] = users.map((user: any) => {
    // Collect and deduplicate VMs owned or requested by this user
    const vmsMap = new Map<string, any>();
    for (const vm of user.ownedVms || []) {
      vmsMap.set(vm.id, vm);
    }
    for (const req of user.requests || []) {
      for (const vm of req.vmInstances || []) {
        vmsMap.set(vm.id, vm);
      }
    }
    const combinedVms = Array.from(vmsMap.values());

    const activeVms = combinedVms.filter((vm: any) => vm.status === 'ACTIVE' && !vm.decommissionedAt);
    const suspendedVms = combinedVms.filter((vm: any) => vm.status === 'SUSPENDED' && !vm.decommissionedAt);
    
    let userVcpu = 0;
    let userRam = 0;
    let userStorage = 0;

    // Distinct systems resolved for this user
    const userSystems = new Set<string>();

    for (const vm of combinedVms) {
      const sys = resolveSystemName(vm);
      if (sys && !sys.toLowerCase().includes("unassigned") && !sys.toLowerCase().includes("standalone")) {
        userSystems.add(normalizeSystemName(sys));
      }
    }
    for (const req of user.requests || []) {
      if (req.systemName) {
        userSystems.add(normalizeSystemName(req.systemName));
      }
    }

    for (const vm of activeVms) {
      const spec = getEffectiveSpec(vm);
      userVcpu += spec.vcpu;
      userRam += spec.ramGb;
      userStorage += spec.storageGb;
    }

    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      designation: user.designation || "N/A",
      organization: user.organization || "N/A",
      systemsCount: userSystems.size,
      totalVms: combinedVms.length,
      namespacesCount: userNamespaceMap.get(user.id) || 0,
      vcpuAllocated: userVcpu,
      ramAllocatedGb: userRam,
      storageAllocatedGb: userStorage,
      activeVms: activeVms.length,
      suspendedVms: suspendedVms.length,
      lastActivity: user.updatedAt.toISOString()
    };
  });

  return { 
    data, 
    total, 
    page, 
    pageSize,
    summary: {
      totalUsers: total,
      totalActiveVms,
      totalVcpu,
      totalRamGb,
      totalStorageGb
    }
  };
}

// ==========================================
// 2. User Detail Modal Data (VMs & Namespaces)
// ==========================================
export async function getUserVmDetails(userId: string): Promise<UserResourceDetailsResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");
  const isAdmin = canManageInventory(session.user.roles);
  if (!isAdmin && session.user.id !== userId) throw new Error("Forbidden");

  const [vms, namespaces] = await Promise.all([
    // Include VMs where user is ownerId OR requester
    prisma.vmInstance.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { request: { requesterId: userId } }
        ]
      },
      include: {
        currentSpec: true,
        specHistory: { orderBy: { effectiveFrom: 'desc' }, take: 1 },
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
        hostAsset: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    }),
    // Include K8s namespaces for this user
    prisma.k8sNamespace.findMany({
      where: {
        OR: [
          { requests: { some: { requesterId: userId } } },
          { clusters: { some: { request: { requesterId: userId } } } }
        ]
      },
      include: {
        subdomains: true,
        clusters: {
          include: {
            request: {
              select: {
                systemName: true,
                projectName: true,
                environment: true
              }
            },
            nodeGroups: {
              include: {
                nodes: true
              }
            }
          }
        },
        requests: {
          select: {
            systemName: true,
            projectName: true,
            environment: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
  ]);

  const vmData: UserVmDetail[] = vms.map((vm: any) => {
    const spec = getEffectiveSpec(vm);
    return {
      id: vm.id,
      hostname: vm.hostname || "UNNAMED",
      ipAddress: vm.ipAddress || "PENDING",
      systemName: resolveSystemName(vm),
      environment: vm.environment || Environment.PRODUCTION,
      vcpu: spec.vcpu,
      ramGb: spec.ramGb,
      storageGb: spec.storageGb,
      os: spec.os,
      cluster: vm.hostAsset?.name || "Unassigned",
      status: vm.status,
      renewalDate: vm.renewalDate?.toISOString() || "",
      requestId: vm.requestId || "N/A",
      specMissing: spec.isMissing
    };
  });

  const namespaceData: UserNamespaceDetail[] = namespaces.map((ns: any) => {
    const firstCluster = ns.clusters[0];
    let totalNodes = 0;
    let totalVcpu = 0;
    let totalRamGb = 0;
    let totalStorageGb = 0;

    const nodeGroups: { name: string; nodeCount: number; vcpu: number; ramGb: number; storageGb: number }[] = [];

    for (const cluster of ns.clusters) {
      for (const group of cluster.nodeGroups || []) {
        const count = group.nodes?.length || group.nodeCount || 0;
        totalNodes += count;
        totalVcpu += (group.vcpu || 0) * count;
        totalRamGb += (group.ramGb || 0) * count;
        totalStorageGb += (group.storageGb || 0) * count;
        nodeGroups.push({
          name: group.name || "Default",
          nodeCount: count,
          vcpu: group.vcpu || 0,
          ramGb: group.ramGb || 0,
          storageGb: group.storageGb || 0
        });
      }
    }

    const sysName = firstCluster?.request?.systemName || 
                    firstCluster?.request?.projectName || 
                    ns.requests?.[0]?.systemName || 
                    ns.requests?.[0]?.projectName || 
                    "Kubernetes";

    return {
      id: ns.id,
      name: ns.name,
      supervisorIp: ns.supervisorIp || "N/A",
      clusterName: firstCluster?.clusterName || "Cluster",
      totalNodes,
      vcpu: totalVcpu,
      ramGb: totalRamGb,
      storageGb: totalStorageGb,
      systemName: sysName,
      nodeGroups,
      createdAt: ns.createdAt?.toISOString() || new Date().toISOString()
    };
  });

  return {
    vms: vmData,
    namespaces: namespaceData
  };
}

// ==========================================
// 3. VM Inventory Report (Point-in-Time Fleet)
// ==========================================
export async function getVmInventoryReport(params: {
  page?: number;
  pageSize?: number;
  getAll?: boolean;
  environment?: Environment;
  status?: VmStatus;
  searchTerm?: string;
  system?: string;
  owner?: string;
  cluster?: string;
  from?: Date;
  to?: Date;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const scope = getReportScope({ id: session.user.id, roles: session.user.roles });
  const { page = 1, pageSize = 10, getAll = false, environment, status, searchTerm, system, owner, cluster } = params;
  const skip = getAll ? undefined : (page - 1) * pageSize;
  const take = getAll ? undefined : pageSize;

  const whereClause: Prisma.VmInstanceWhereInput = {
    AND: [
      scope.vmWhere,
      environment ? { environment } : {},
      status ? { status } : {},
      system && system !== "ALL" ? systemNameWhere(system) : {},
      owner && owner !== "ALL" ? { owner: { name: { contains: owner, mode: 'insensitive' } } } : {},
      cluster && cluster !== "ALL" ? { hostAsset: { name: { contains: cluster, mode: 'insensitive' } } } : {},
      searchTerm ? {
        OR: [
          { hostname: { contains: searchTerm, mode: 'insensitive' } },
          { ipAddress: { contains: searchTerm, mode: 'insensitive' } },
          { systemName: { contains: searchTerm, mode: 'insensitive' } },
          { request: { systemName: { contains: searchTerm, mode: 'insensitive' } } },
          { owner: { name: { contains: searchTerm, mode: 'insensitive' } } }
        ]
      } : {}
    ]
  };

  const [vms, total] = await Promise.all([
    prisma.vmInstance.findMany({
      where: whereClause,
      include: {
        owner: { select: { name: true, email: true } },
        request: {
          select: {
            systemName: true,
            projectName: true,
            vcpu: true,
            ramGb: true,
            storageGb: true,
            osName: true,
            osVersion: true,
            vmSpecifications: true
          }
        },
        hostAsset: { select: { name: true } },
        currentSpec: true,
        specHistory: { orderBy: { effectiveFrom: 'desc' }, take: 1 }
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.vmInstance.count({ where: whereClause })
  ]);

  const data: VmInventoryItem[] = vms.map((vm: any) => {
    const spec = getEffectiveSpec(vm);
    const resolvedSys = resolveSystemName(vm);
    return {
      id: vm.id,
      hostname: vm.hostname || "UNNAMED",
      ipAddress: vm.ipAddress || "PENDING",
      system: resolvedSys,
      project: resolvedSys,
      environment: vm.environment || Environment.PRODUCTION,
      status: vm.status,
      owner: vm.owner?.name || "Unknown",
      ownerEmail: vm.owner?.email || "N/A",
      vcpu: spec.vcpu,
      ramGb: spec.ramGb,
      storageGb: spec.storageGb,
      hostAsset: vm.hostAsset?.name || "Unassigned",
      cluster: vm.hostAsset?.name || "Unassigned",
      provisionedDate: vm.provisionedAt?.toISOString() || vm.createdAt.toISOString(),
      renewalDate: vm.renewalDate?.toISOString() || "",
      requestId: vm.requestId || "N/A",
      specMissing: spec.isMissing
    };
  });

  return { data, total, page, pageSize };
}

// ==========================================
// 4. DC Capacity Report (Per Physical Cluster)
// ==========================================
export async function getDcCapacityReport(): Promise<{
  permitted: boolean;
  message?: string;
  data: DcCapacityItem[];
  total: number;
}> {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const guard = assertCanViewInfrastructure({ id: session.user.id, roles: session.user.roles });
  if (!guard.permitted) {
    return {
      permitted: false,
      message: guard.message || "Infrastructure reports (Cluster Capacity) require Administrator or DC Operations access.",
      data: [],
      total: 0
    };
  }

  // 1. Fetch physical clusters and their host servers + active VMs
  const [clusters, unassignedVms] = await Promise.all([
    prisma.physicalCluster.findMany({
      include: {
        hosts: {
          where: { type: 'SERVER' },
          include: {
            vms: {
              where: {
                status: 'ACTIVE',
                decommissionedAt: null
              },
              include: {
                currentSpec: true,
                specHistory: { orderBy: { effectiveFrom: 'desc' }, take: 1 },
                request: { select: { vcpu: true, ramGb: true, storageGb: true, vmSpecifications: true } }
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    }),
    prisma.vmInstance.findMany({
      where: {
        hostAssetId: null,
        status: 'ACTIVE',
        decommissionedAt: null
      },
      include: {
        currentSpec: true,
        specHistory: { orderBy: { effectiveFrom: 'desc' }, take: 1 },
        request: { select: { vcpu: true, ramGb: true, storageGb: true, vmSpecifications: true } }
      }
    })
  ]);

  const data: DcCapacityItem[] = [];

  for (const cluster of clusters) {
    let totalVcpu = 0;
    let totalRamGb = 0;
    let totalStorageGb = 0;
    let usedVcpu = 0;
    let usedRamGb = 0;
    let usedStorageGb = 0;

    for (const host of cluster.hosts) {
      totalVcpu += host.cpuCores || 0;
      totalRamGb += host.ramGb || 0;
      totalStorageGb += host.storageGb || 0;

      for (const vm of host.vms) {
        const spec = getEffectiveSpec(vm);
        usedVcpu += spec.vcpu;
        usedRamGb += spec.ramGb;
        usedStorageGb += spec.storageGb;
      }
    }

    const freeVcpu = totalVcpu - usedVcpu;
    const freeRamGb = totalRamGb - usedRamGb;
    const freeStorageGb = totalStorageGb - usedStorageGb;

    const cpuUtilPercent = totalVcpu > 0 ? Math.round((usedVcpu / totalVcpu) * 100) : 0;
    const ramUtilPercent = totalRamGb > 0 ? Math.round((usedRamGb / totalRamGb) * 100) : 0;
    const storageUtilPercent = totalStorageGb > 0 ? Math.round((usedStorageGb / totalStorageGb) * 100) : 0;

    const isOverAllocated = usedVcpu > totalVcpu || usedRamGb > totalRamGb || usedStorageGb > totalStorageGb;
    const overWarnings: string[] = [];
    if (usedVcpu > totalVcpu) overWarnings.push(`vCPU over by ${usedVcpu - totalVcpu} cores`);
    if (usedRamGb > totalRamGb) overWarnings.push(`RAM over by ${usedRamGb - totalRamGb} GB`);
    if (usedStorageGb > totalStorageGb) overWarnings.push(`Storage over by ${usedStorageGb - totalStorageGb} GB`);

    data.push({
      clusterId: cluster.id,
      clusterName: cluster.name,
      hostCount: cluster.hosts.length,
      totalVcpu,
      usedVcpu,
      freeVcpu,
      cpuUtilPercent,
      totalRamGb,
      usedRamGb,
      freeRamGb,
      ramUtilPercent,
      totalStorageGb,
      usedStorageGb,
      freeStorageGb,
      storageUtilPercent,
      isOverAllocated,
      overAllocationWarning: isOverAllocated ? overWarnings.join(", ") : undefined,
      lastSynced: new Date().toISOString()
    });
  }

  // 2. Add unassigned VMs (hostAssetId: null) as a separate line
  if (unassignedVms.length > 0) {
    let unassignedVcpu = 0;
    let unassignedRam = 0;
    let unassignedStorage = 0;

    for (const vm of unassignedVms) {
      const spec = getEffectiveSpec(vm);
      unassignedVcpu += spec.vcpu;
      unassignedRam += spec.ramGb;
      unassignedStorage += spec.storageGb;
    }

    data.push({
      clusterId: "unassigned-hosts-vms",
      clusterName: "Unassigned VMs (No Host Placement)",
      hostCount: 0,
      totalVcpu: 0,
      usedVcpu: unassignedVcpu,
      freeVcpu: -unassignedVcpu,
      cpuUtilPercent: 100,
      totalRamGb: 0,
      usedRamGb: unassignedRam,
      freeRamGb: -unassignedRam,
      ramUtilPercent: 100,
      totalStorageGb: 0,
      usedStorageGb: unassignedStorage,
      freeStorageGb: -unassignedStorage,
      storageUtilPercent: 100,
      isOverAllocated: true,
      overAllocationWarning: `${unassignedVms.length} active VMs pending physical host placement`,
      isUnassignedLine: true,
      unassignedVmCount: unassignedVms.length,
      lastSynced: new Date().toISOString()
    });
  }

  return { permitted: true, data, total: data.length };
}

// ==========================================
// 5. Request Dashboard Report
// ==========================================
export async function getRequestsReport(params: {
  page?: number;
  pageSize?: number;
  getAll?: boolean;
  type?: RequestType;
  status?: RequestStatus;
  environment?: Environment;
  requester?: string;
  searchTerm?: string;
  startDate?: string;
  endDate?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const scope = getReportScope({ id: session.user.id, roles: session.user.roles });
  const { page = 1, pageSize = 10, getAll = false, type, status, environment, requester, searchTerm, startDate, endDate } = params;
  const skip = getAll ? undefined : (page - 1) * pageSize;
  const take = getAll ? undefined : pageSize;

  const whereClause: Prisma.RequestWhereInput = {
    AND: [
      scope.requestWhere,
      type && (type as string) !== "ALL" ? { requestType: type } : {},
      status && (status as string) !== "ALL" ? { status } : {},
      environment && (environment as string) !== "ALL" ? { environment } : {},
      requester ? { requester: { name: { contains: requester, mode: 'insensitive' } } } : {},
      searchTerm ? {
        OR: [
          { systemName: { contains: searchTerm, mode: 'insensitive' } },
          { projectName: { contains: searchTerm, mode: 'insensitive' } },
          { requester: { name: { contains: searchTerm, mode: 'insensitive' } } },
          { requestId: { contains: searchTerm, mode: 'insensitive' } }
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
        requester: { select: { name: true, email: true } },
        approvals: {
          orderBy: { level: 'asc' },
          include: { approver: { select: { name: true } } }
        }
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.request.count({ where: whereClause })
  ]);

  const data: RequestDashboardItem[] = requests.map((req: any) => {
    const sys = resolveSystemName({ request: req } as any);
    
    // Determine current level
    let currentLevel = "N/A";
    if (req.status === "PENDING_L1") currentLevel = "Level 1 (Asstt. Maintenance Engineer)";
    else if (req.status === "PENDING_L2") currentLevel = "Level 2 (Maintenance Engineer)";
    else if (req.status === "PENDING_L3") currentLevel = "Level 3 (System Analyst)";
    else if (req.status === "PENDING_L4") currentLevel = "Level 4 (DC Ops)";
    else if (req.status.startsWith("PENDING_L")) currentLevel = `Level ${req.status.replace("PENDING_L", "")}`;
    else if (req.status === "APPROVED") currentLevel = "Approved";
    else if (req.status === "PROVISIONED") currentLevel = "Provisioned";
    else if (req.status === "REJECTED") currentLevel = "Rejected";
    else if (req.status === "DRAFT") currentLevel = "Draft";
    else currentLevel = req.status;

    // Find pending approver
    const pendingApproval = req.approvals.find((a: any) => a.decision === "PENDING");
    const currentApprover = pendingApproval?.approver?.name || (req.status === "APPROVED" ? "Approved" : req.status === "PROVISIONED" ? "Completed" : "TBD");

    // Turnaround calculation: provisionedAt - submittedAt, or approvedAt - submittedAt, or age if pending
    let turnaround = "N/A";
    const start = req.submittedAt || req.createdAt;
    if (req.provisionedAt && start) {
      const diffHours = differenceInHours(new Date(req.provisionedAt), new Date(start));
      const days = Math.floor(diffHours / 24);
      const hrs = diffHours % 24;
      turnaround = days > 0 ? `${days}d ${hrs}h` : `${hrs}h`;
    } else {
      const approvedDec = req.approvals.filter((a: any) => a.decision === "APPROVED" && a.decidedAt).pop();
      if (approvedDec?.decidedAt && start) {
        const diffHours = differenceInHours(new Date(approvedDec.decidedAt), new Date(start));
        const days = Math.floor(diffHours / 24);
        const hrs = diffHours % 24;
        turnaround = days > 0 ? `${days}d ${hrs}h (Approved)` : `${hrs}h (Approved)`;
      } else if (start && ["PENDING_L1", "PENDING_L2", "PENDING_L3", "PENDING_L4"].includes(req.status)) {
        const ageDays = differenceInDays(new Date(), new Date(start));
        turnaround = `Age: ${ageDays}d (Pending)`;
      }
    }

    return {
      id: req.id,
      requestId: req.requestId || req.id.slice(0, 8).toUpperCase(),
      type: req.requestType,
      system: sys,
      project: sys,
      requester: req.requester?.name || "Unknown",
      requesterEmail: req.requester?.email || "N/A",
      environment: req.environment,
      status: req.status,
      currentLevel,
      currentApprover,
      submittedAt: req.submittedAt?.toISOString() || req.createdAt.toISOString(),
      provisionedAt: req.provisionedAt?.toISOString() || null,
      turnaround,
      updatedAt: req.updatedAt.toISOString(),
      agingDays: start ? differenceInDays(new Date(), new Date(start)) : 0
    };
  });

  return { data, total, page, pageSize };
}

// ==========================================
// 6. Renewal / End-of-Life Report
// ==========================================
export async function getRenewalsReport(params: {
  page?: number;
  pageSize?: number;
  getAll?: boolean;
  environment?: Environment;
  searchTerm?: string;
  from?: Date;
  to?: Date;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const scope = getReportScope({ id: session.user.id, roles: session.user.roles });
  const { page = 1, pageSize = 10, getAll = false, environment, searchTerm, from, to } = params;
  const skip = getAll ? undefined : (page - 1) * pageSize;
  const take = getAll ? undefined : pageSize;

  const whereClause: Prisma.VmInstanceWhereInput = {
    AND: [
      scope.vmWhere,
      environment ? { environment } : {},
      { renewalDate: { not: null } },
      { decommissionedAt: null },
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
      take,
      orderBy: { renewalDate: 'asc' }
    }),
    prisma.vmInstance.count({ where: whereClause })
  ]);

  const data: RenewalItem[] = vms.map((vm: any) => ({
    id: vm.id,
    vmName: vm.hostname || "UNNAMED",
    ownerName: vm.owner?.name || "Unknown",
    project: resolveSystemName(vm),
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
  getAll?: boolean;
  startDate?: string;
  endDate?: string;
  userId?: string;
  actionType?: string[];
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");
  if (!canManageInventory(session.user.roles)) throw new Error("Forbidden");

  const { page = 1, pageSize = 10, getAll = false, startDate, endDate, userId, actionType } = params;
  const skip = getAll ? undefined : (page - 1) * pageSize;
  const take = getAll ? undefined : pageSize;

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
      take,
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
    ipAddress: "N/A",
    details: log.details as unknown as AuditTrailItem['details']
  }));

  return { data, total, page, pageSize };
}

// ==========================================
// 8. K8s Namespace Report (Point-in-Time Fleet)
// ==========================================
export async function getK8sNamespaceReport(params: {
  page?: number;
  pageSize?: number;
  getAll?: boolean;
  searchTerm?: string;
  environment?: Environment;
  from?: Date;
  to?: Date;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const scope = getReportScope({ id: session.user.id, roles: session.user.roles });
  const { page = 1, pageSize = 10, getAll = false, searchTerm = "", environment } = params;
  const skip = getAll ? undefined : (page - 1) * pageSize;
  const take = getAll ? undefined : pageSize;

  const whereClause: Prisma.K8sNamespaceWhereInput = {
    AND: [
      scope.namespaceWhere,
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
                OR: [
                  { clusterName: { contains: searchTerm, mode: "insensitive" } },
                  { request: { systemName: { contains: searchTerm, mode: "insensitive" } } },
                  { request: { projectName: { contains: searchTerm, mode: "insensitive" } } },
                  { request: { requester: { name: { contains: searchTerm, mode: "insensitive" } } } }
                ]
              }
            }
          },
          {
            requests: {
              some: {
                OR: [
                  { systemName: { contains: searchTerm, mode: "insensitive" } },
                  { projectName: { contains: searchTerm, mode: "insensitive" } },
                  { requester: { name: { contains: searchTerm, mode: "insensitive" } } }
                ]
              }
            }
          }
        ]
      } : {}
    ]
  };

  const [namespaces, total] = await Promise.all([
    prisma.k8sNamespace.findMany({
      where: whereClause,
      include: {
        subdomains: true,
        requests: {
          select: {
            systemName: true,
            projectName: true,
            requester: {
              select: {
                name: true
              }
            }
          }
        },
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
      take,
      orderBy: { createdAt: "desc" }
    }),
    prisma.k8sNamespace.count({ where: whereClause })
  ]);

  const data: K8sNamespaceReportItem[] = namespaces.map((ns: any) => {
    const clusterNames = ns.clusters.map((c: any) => c.clusterName);
    const activeCluster = ns.clusters[0];
    const request = activeCluster?.request || ns.requests?.[0];
    const requesterName = request?.requester?.name || "Operations Admin";

    // Collect all node groups across clusters
    const nodeGroups: K8sNodeGroupDetail[] = [];
    let totalNodes = 0;
    let totalVcpu = 0;
    let totalRamGb = 0;
    let totalStorageGb = 0;

    for (const cluster of ns.clusters) {
      if (cluster.nodeGroups) {
        for (const group of cluster.nodeGroups) {
          const count = group.nodeCount || group.nodes?.length || 0;
          totalNodes += count;
          totalVcpu += (group.vcpu || 0) * count;
          totalRamGb += (group.ramGb || 0) * count;
          totalStorageGb += (group.storageGb || 0) * count;
          nodeGroups.push({
            role: group.role,
            nodeCount: count,
            vcpu: group.vcpu || 0,
            ramGb: group.ramGb || 0,
            storageGb: group.storageGb || 0
          });
        }
      }
    }

    // Subdomains by status
    const subdomainStatusMap: Record<string, number> = {};
    for (const sub of ns.subdomains || []) {
      const st = sub.status || "PENDING";
      subdomainStatusMap[st] = (subdomainStatusMap[st] || 0) + 1;
    }
    const subdomainsByStatus = Object.entries(subdomainStatusMap).map(([status, count]) => ({ status, count }));
    const subdomainsSummary = subdomainsByStatus.length > 0
      ? subdomainsByStatus.map(s => `${s.count} ${s.status}`).join(", ")
      : "None";

    const resolvedSystem = resolveK8sSystemName(ns) || request?.systemName || request?.projectName || "Standalone / Unassigned";

    return {
      id: ns.id,
      name: ns.name,
      supervisorIp: ns.supervisorIp || "N/A",
      clusterName: clusterNames[0] || "N/A",
      clusters: clusterNames,
      systemName: resolvedSystem,
      project: resolvedSystem,
      owner: requesterName,
      requester: requesterName,
      environment: request?.environment || "N/A",
      nodeGroups,
      subdomainsByStatus,
      subdomainsSummary,
      totalNodes,
      totalVcpu,
      totalRamGb,
      totalStorageGb,
      status: activeCluster?.status || "ACTIVE",
      createdAt: ns.createdAt.toISOString()
    };
  });

  return { data, total, page, pageSize };
}

// ==========================================
// 9. Software Licenses Report (by Expiry, Vendor, Type)
// ==========================================
import { getLicenseReport, type LicenseReportParams, type LicenseReportResult } from "@/lib/reports/licenseReport";
export type { LicenseReportParams, LicenseReportResult };

export async function getLicenseReportAction(params: LicenseReportParams): Promise<LicenseReportResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  return getLicenseReport(params);
}

// ==========================================
// 10. System-Name-Wise Report (Expandable by System)
// ==========================================
import { getSystemWiseReport, type SystemWiseReportParams, type SystemWiseReportResult } from "@/lib/reports/systemReport";
export type { SystemWiseReportParams, SystemWiseReportResult };

export async function getSystemWiseReportAction(params: Omit<SystemWiseReportParams, "userActor">): Promise<SystemWiseReportResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  return getSystemWiseReport({
    ...params,
    userActor: {
      id: session.user.id,
      roles: session.user.roles || []
    }
  });
}

