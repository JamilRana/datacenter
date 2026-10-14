import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { resolveVmResourceSpecs } from "@/lib/reports/spec-resolver";

export interface UserReportParams {
  page?: number;
  pageSize?: number;
  getAll?: boolean;
  search?: string;
  role?: string;
  department?: string;
  userRoles?: string[];
}

export interface UserReportRow {
  id: string;
  name: string;
  email: string;
  organization: string | null;
  roles: string[];
  systems: string[];
  systemsCount: number;
  vmCount: number;
  activeVmCount: number;
  namespaceCount: number;
  requestCount: number;
  totalVcpu: number;
  totalRamGb: number;
  totalStorageGb: number;
  pendingApprovals: number;
  lastActive: Date | null;
  createdAt: Date;
}

export interface UserReportAnalytics {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  totalVmsOwned: number;
  totalActiveVms: number;
  totalSystemsMonitored: number;
  totalNamespacesManaged: number;
  totalVcpuAllocated: number;
  totalRamAllocatedGb: number;
  totalStorageAllocatedGb: number;
  totalRequestsSubmitted: number;
  topResourceOwners: { name: string; vcpu: number; ramGb: number; storageGb: number }[];
  topVmOwners: { name: string; vmCount: number; systemCount: number }[];
}

export interface UserReportResult {
  data: UserReportRow[];
  analytics: UserReportAnalytics;
  total: number;
  page: number;
  totalPages: number;
}

export interface UserResourceDetail {
  user: {
    id: string;
    name: string;
    email: string;
    organization: string | null;
    roles: string[];
    createdAt: Date;
    updatedAt: Date;
  };
  summary: {
    totalSystems: number;
    totalVms: number;
    activeVms: number;
    totalNamespaces: number;
    totalRequests: number;
    totalVcpu: number;
    totalRamGb: number;
    totalStorageGb: number;
  };
  systems: {
    systemName: string;
    vmCount: number;
    activeVmCount: number;
    vcpu: number;
    ramGb: number;
    storageGb: number;
    hostnames: string[];
  }[];
  vms: {
    id: string;
    hostname: string;
    ipAddress: string | null;
    publicIpAddress: string | null;
    status: string;
    environment: string;
    systemName: string;
    vcpu: number;
    ramGb: number;
    storageGb: number;
    os: string;
    subdomain: string | null;
    createdAt: Date;
    renewalDate: Date | null;
  }[];
  namespaces: {
    id: string;
    name: string;
    supervisorIp: string;
    clusterName: string;
    totalNodes: number;
    vcpu: number;
    ramGb: number;
    storageGb: number;
    systemName: string;
    createdAt: Date;
  }[];
  requests: {
    id: string;
    requestId: string | null;
    systemName: string;
    projectName: string | null;
    requestType: string;
    status: string;
    environment: string;
    quantity: number;
    vcpu: number;
    ramGb: number;
    storageGb: number;
    createdAt: Date;
  }[];
}

export async function getUserReport(params: UserReportParams): Promise<UserReportResult> {
  const { 
    page = 1, 
    pageSize = 10, 
    getAll = false,
    search,
    role,
    department,
    userRoles 
  } = params;

  const skip = getAll ? undefined : (page - 1) * pageSize;
  const take = getAll ? undefined : pageSize;
  const isAdmin = userRoles?.some((r: any) => ["ADMIN", "DC_OPS"].includes(r.toUpperCase()));

  if (!isAdmin) {
    return { 
      data: [], 
      analytics: { 
        totalUsers: 0, 
        activeUsers: 0, 
        inactiveUsers: 0,
        totalVmsOwned: 0,
        totalActiveVms: 0,
        totalSystemsMonitored: 0,
        totalNamespacesManaged: 0,
        totalVcpuAllocated: 0,
        totalRamAllocatedGb: 0,
        totalStorageAllocatedGb: 0,
        totalRequestsSubmitted: 0,
        topResourceOwners: [],
        topVmOwners: [],
      }, 
      total: 0, 
      page: 1, 
      totalPages: 0 
    };
  }

  const where: Prisma.UserWhereInput = {};

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { organization: { contains: q, mode: "insensitive" } },
      { ownedVms: { some: { systemName: { contains: q, mode: "insensitive" } } } },
      { ownedVms: { some: { hostname: { contains: q, mode: "insensitive" } } } },
      { requests: { some: { systemName: { contains: q, mode: "insensitive" } } } },
    ];
  }

  if (role && role !== "all") {
    const usersWithRole = await prisma.userRole.findMany({
      where: {
        role: { name: role },
      },
      select: { userId: true },
    });
    where.id = { in: usersWithRole.map((u: any) => u.userId) };
  }

  if (department && department !== "all") {
    where.organization = { contains: department, mode: "insensitive" };
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        roles: {
          include: {
            role: { select: { name: true } },
          },
        },
        ownedVms: {
          include: {
            currentSpec: true,
            specHistory: { orderBy: { effectiveFrom: 'desc' as const }, take: 1 },
            request: {
              select: {
                systemName: true,
                vcpu: true,
                ramGb: true,
                storageGb: true,
                vmSpecifications: true
              }
            },
          },
        },
        requests: {
          select: {
            id: true,
            systemName: true,
            status: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const userIds = users.map((u: any) => u.id);

  // Fetch K8s namespaces for these users
  const [namespaces, pendingApprovals] = await Promise.all([
    prisma.k8sNamespace.findMany({
      where: {
        OR: [
          { requests: { some: { requesterId: { in: userIds } } } },
          { clusters: { some: { request: { requesterId: { in: userIds } } } } },
        ],
      },
      include: {
        clusters: {
          include: {
            request: { select: { requesterId: true } },
          },
        },
        requests: { select: { requesterId: true } },
      },
    }),
    prisma.approval.groupBy({
      by: ["approverId"],
      _count: true,
      where: { 
        approverId: { in: userIds },
        decision: "PENDING",
      },
    }),
  ]);

  // Map namespaces to users
  const userNamespaceMap = new Map<string, number>();
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

  const pendingApprovalMap = new Map(pendingApprovals.map((p: any) => [p.approverId!, p._count]));

  const data: UserReportRow[] = users.map((user: any) => {
    const systemsSet = new Set<string>();
    let totalVcpu = 0;
    let totalRamGb = 0;
    let totalStorageGb = 0;
    let activeVmCount = 0;

    for (const vm of user.ownedVms) {
      const sys = vm.systemName || vm.request?.systemName || "Standalone / Unassigned";
      systemsSet.add(sys);
      const isActive = vm.status === "ACTIVE" && !vm.decommissionedAt;
      if (isActive) activeVmCount++;
      const spec = resolveVmResourceSpecs(vm);
      totalVcpu += spec.vcpu;
      totalRamGb += spec.ramGb;
      totalStorageGb += spec.storageGb;
    }

    for (const req of user.requests) {
      if (req.systemName) systemsSet.add(req.systemName);
    }

    const systems = Array.from(systemsSet);

    return {
      id: user.id,
      name: user.name || "Unknown",
      email: user.email,
      organization: user.organization,
      roles: user.roles.map((r: any) => r.role.name),
      systems,
      systemsCount: systems.length,
      vmCount: user.ownedVms.length,
      activeVmCount,
      namespaceCount: userNamespaceMap.get(user.id) || 0,
      requestCount: user.requests.length,
      totalVcpu,
      totalRamGb,
      totalStorageGb,
      pendingApprovals: pendingApprovalMap.get(user.id) || 0,
      lastActive: user.updatedAt,
      createdAt: user.createdAt,
    };
  });

  const analytics = await getUserReportAnalytics();

  return {
    data,
    analytics,
    total,
    page,
    totalPages: Math.ceil(total / pageSize),
  };
}

async function getUserReportAnalytics(): Promise<UserReportAnalytics> {
  const [allUsers, allVms, totalNamespaces, totalRequests] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        updatedAt: true,
      },
    }),
    prisma.vmInstance.findMany({
      select: {
        ownerId: true,
        status: true,
        systemName: true,
        currentSpec: {
          select: {
            vcpu: true,
            ramGb: true,
            storageGb: true,
          },
        },
        request: { select: { systemName: true } },
      },
    }),
    prisma.k8sNamespace.count(),
    prisma.request.count(),
  ]);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  let activeUsers = 0;
  for (const u of allUsers) {
    if (u.updatedAt >= thirtyDaysAgo) activeUsers++;
  }

  // Aggregate resources by owner
  const userResourceMap = new Map<string, { vcpu: number; ramGb: number; storageGb: number; vms: number; systems: Set<string> }>();
  const totalSystemsSet = new Set<string>();
  let totalVcpuAllocated = 0;
  let totalRamAllocatedGb = 0;
  let totalStorageAllocatedGb = 0;
  let totalActiveVms = 0;

  for (const vm of allVms) {
    if (vm.status === "ACTIVE") totalActiveVms++;
    const vcpu = vm.currentSpec?.vcpu || 0;
    const ram = vm.currentSpec?.ramGb || 0;
    const storage = vm.currentSpec?.storageGb || 0;

    totalVcpuAllocated += vcpu;
    totalRamAllocatedGb += ram;
    totalStorageAllocatedGb += storage;

    const sys = vm.systemName || vm.request?.systemName || "Standalone / Unassigned";
    totalSystemsSet.add(sys);

    if (vm.ownerId) {
      if (!userResourceMap.has(vm.ownerId)) {
        userResourceMap.set(vm.ownerId, { vcpu: 0, ramGb: 0, storageGb: 0, vms: 0, systems: new Set() });
      }
      const entry = userResourceMap.get(vm.ownerId)!;
      entry.vcpu += vcpu;
      entry.ramGb += ram;
      entry.storageGb += storage;
      entry.vms += 1;
      entry.systems.add(sys);
    }
  }

  const userNameMap = new Map(allUsers.map((u) => [u.id, u.name || "Unknown"]));

  const topResourceOwners = Array.from(userResourceMap.entries())
    .map(([userId, stats]) => ({
      name: userNameMap.get(userId) || "Unknown",
      vcpu: stats.vcpu,
      ramGb: stats.ramGb,
      storageGb: stats.storageGb,
    }))
    .sort((a, b) => b.vcpu - a.vcpu)
    .slice(0, 10);

  const topVmOwners = Array.from(userResourceMap.entries())
    .map(([userId, stats]) => ({
      name: userNameMap.get(userId) || "Unknown",
      vmCount: stats.vms,
      systemCount: stats.systems.size,
    }))
    .sort((a, b) => b.vmCount - a.vmCount)
    .slice(0, 10);

  return {
    totalUsers: allUsers.length,
    activeUsers,
    inactiveUsers: allUsers.length - activeUsers,
    totalVmsOwned: allVms.length,
    totalActiveVms,
    totalSystemsMonitored: totalSystemsSet.size,
    totalNamespacesManaged: totalNamespaces,
    totalVcpuAllocated,
    totalRamAllocatedGb,
    totalStorageAllocatedGb,
    totalRequestsSubmitted: totalRequests,
    topResourceOwners,
    topVmOwners,
  };
}

export async function getUserResourceDetail(userId: string): Promise<UserResourceDetail> {
  const [user, vms, requests, namespaces] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: { select: { name: true } },
          },
        },
      },
    }),
    prisma.vmInstance.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { request: { requesterId: userId } }
        ]
      },
      include: {
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
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.request.findMany({
      where: { requesterId: userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        requestId: true,
        systemName: true,
        projectName: true,
        requestType: true,
        status: true,
        environment: true,
        quantity: true,
        vcpu: true,
        ramGb: true,
        storageGb: true,
        createdAt: true,
      },
    }),
    prisma.k8sNamespace.findMany({
      where: {
        OR: [
          { requests: { some: { requesterId: userId } } },
          { clusters: { some: { request: { requesterId: userId } } } },
        ],
      },
      include: {
        clusters: {
          include: {
            nodeGroups: {
              include: {
                nodes: true,
              },
            },
            request: { select: { systemName: true, projectName: true } },
          },
        },
        requests: { select: { systemName: true, projectName: true } },
      },
    }),
  ]);

  if (!user) {
    throw new Error("User not found");
  }

  // Aggregate systems
  const systemsMap = new Map<string, {
    systemName: string;
    vmCount: number;
    activeVmCount: number;
    vcpu: number;
    ramGb: number;
    storageGb: number;
    hostnames: string[];
  }>();

  let totalVcpu = 0;
  let totalRamGb = 0;
  let totalStorageGb = 0;
  let activeVms = 0;

  const mappedVms = vms.map((vm: any) => {
    const sysName = vm.systemName || vm.request?.systemName || "Standalone / Unassigned";
    const spec = resolveVmResourceSpecs(vm);
    const vcpu = spec.vcpu;
    const ramGb = spec.ramGb;
    const storageGb = spec.storageGb;

    totalVcpu += vcpu;
    totalRamGb += ramGb;
    totalStorageGb += storageGb;
    const isActive = vm.status === "ACTIVE" && !vm.decommissionedAt;
    if (isActive) activeVms++;

    if (!systemsMap.has(sysName)) {
      systemsMap.set(sysName, {
        systemName: sysName,
        vmCount: 0,
        activeVmCount: 0,
        vcpu: 0,
        ramGb: 0,
        storageGb: 0,
        hostnames: [],
      });
    }

    const entry = systemsMap.get(sysName)!;
    entry.vmCount += 1;
    if (vm.status === "ACTIVE") entry.activeVmCount += 1;
    entry.vcpu += vcpu;
    entry.ramGb += ramGb;
    entry.storageGb += storageGb;
    if (vm.hostname && !entry.hostnames.includes(vm.hostname)) {
      entry.hostnames.push(vm.hostname);
    }

    return {
      id: vm.id,
      hostname: vm.hostname || "UNNAMED",
      ipAddress: vm.ipAddress,
      publicIpAddress: vm.publicIpAddress,
      status: vm.status,
      environment: vm.environment,
      systemName: sysName,
      vcpu,
      ramGb,
      storageGb,
      os: `${vm.currentSpec?.osName || ""} ${vm.currentSpec?.osVersion || ""}`.trim() || "N/A",
      subdomain: vm.subdomain,
      createdAt: vm.createdAt,
      renewalDate: vm.renewalDate,
    };
  });

  const mappedNamespaces = namespaces.map((ns: any) => {
    const firstCluster = ns.clusters[0];
    let nsNodes = 0;
    let nsVcpu = 0;
    let nsRamGb = 0;
    let nsStorageGb = 0;

    for (const cluster of ns.clusters) {
      for (const group of cluster.nodeGroups) {
        const count = group.nodes.length || group.nodeCount;
        nsNodes += count;
        nsVcpu += group.vcpu * count;
        nsRamGb += group.ramGb * count;
        nsStorageGb += (group.storageGb || 0) * count;
      }
    }

    const sysName = firstCluster?.request?.systemName || ns.requests[0]?.systemName || "Kubernetes";

    return {
      id: ns.id,
      name: ns.name,
      supervisorIp: ns.supervisorIp,
      clusterName: firstCluster?.clusterName || "Cluster",
      totalNodes: nsNodes,
      vcpu: nsVcpu,
      ramGb: nsRamGb,
      storageGb: nsStorageGb,
      systemName: sysName,
      createdAt: ns.createdAt,
    };
  });

  const mappedRequests = requests.map((r: any) => ({
    id: r.id,
    requestId: r.requestId,
    systemName: r.systemName,
    projectName: r.projectName,
    requestType: r.requestType,
    status: r.status,
    environment: r.environment,
    quantity: r.quantity,
    vcpu: r.vcpu || 0,
    ramGb: r.ramGb || 0,
    storageGb: r.storageGb || 0,
    createdAt: r.createdAt,
  }));

  return {
    user: {
      id: user.id,
      name: user.name || "Unknown",
      email: user.email,
      organization: user.organization,
      roles: user.roles.map((r: any) => r.role.name),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    summary: {
      totalSystems: systemsMap.size,
      totalVms: vms.length,
      activeVms,
      totalNamespaces: namespaces.length,
      totalRequests: requests.length,
      totalVcpu,
      totalRamGb,
      totalStorageGb,
    },
    systems: Array.from(systemsMap.values()),
    vms: mappedVms,
    namespaces: mappedNamespaces,
    requests: mappedRequests,
  };
}
