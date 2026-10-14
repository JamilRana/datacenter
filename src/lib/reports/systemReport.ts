// src/lib/reports/systemReport.ts
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { 
  SystemReportItem, 
  SystemReportSummary,
  SystemVmDetail,
  SystemRequestDetail,
  SystemNamespaceDetail,
  SystemAccessUserDetail 
} from "@/types/reports";
import { 
  normalizeSystemName, 
  formatSystemName, 
  resolveSystemName, 
  getReportScope, 
  getEffectiveSpec 
} from "./shared-reporting";
import { resolveK8sSystemName } from "@/lib/system-utils";
import { normalizeUsername } from "./vpn-horizon-reporting";

export interface SystemWiseReportParams {
  page?: number;
  pageSize?: number;
  getAll?: boolean;
  searchTerm?: string;
  environment?: string; // "ALL" or specific environment
  resourceFilter?: "ALL" | "VMS" | "REQUESTS" | "NAMESPACES" | "USERS";
  userActor?: {
    id: string;
    roles?: string[];
  };
}

export interface SystemWiseReportResult {
  data: SystemReportItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: SystemReportSummary;
  availableEnvironments: string[];
}

/**
 * Builds the authoritative System-wise Report.
 * Groups by normalized business application/system name.
 * Expanding a system reveals its VMs, requests, namespaces, and remote access users.
 */
export async function getSystemWiseReport(
  params: SystemWiseReportParams = {}
): Promise<SystemWiseReportResult> {
  const {
    page = 1,
    pageSize = 10,
    getAll = false,
    searchTerm,
    environment = "ALL",
    resourceFilter = "ALL",
    userActor = { id: "", roles: [] }
  } = params;

  const scope = getReportScope(userActor);
  const isRequester = !scope.isAdminOrDcOps && !scope.isApprover;

  // Remote access scoping
  let horizonWhere: Prisma.HorizonAssignmentWhereInput = {};
  let vpnWhere: Prisma.VpnAssignmentWhereInput = {};

  if (isRequester) {
    horizonWhere = {
      OR: [
        { vm: scope.vmWhere },
        { namespace: scope.namespaceWhere },
        { oldVm: scope.vmWhere },
      ]
    };
    vpnWhere = {
      OR: [
        { vm: scope.vmWhere },
        { namespace: scope.namespaceWhere },
      ]
    };
  }

  // Parallel database queries
  const [vms, requests, namespaces, horizonAssignments, vpnAssignments] = await Promise.all([
    // 1. Virtual Machines
    prisma.vmInstance.findMany({
      where: scope.vmWhere,
      include: {
        owner: { select: { name: true, email: true } },
        request: { 
          select: { 
            systemName: true, 
            projectName: true, 
            requesterId: true,
            vcpu: true,
            ramGb: true,
            storageGb: true,
          } 
        },
        currentSpec: true,
        specHistory: { orderBy: { createdAt: "desc" }, take: 1 },
        hostAsset: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" }
    }),

    // 2. Provisioning & Change Requests
    prisma.request.findMany({
      where: scope.requestWhere,
      include: {
        requester: { select: { name: true, email: true } },
        vmInstances: { select: { id: true } }
      },
      orderBy: { createdAt: "desc" }
    }),

    // 3. Kubernetes Namespaces
    prisma.k8sNamespace.findMany({
      where: scope.namespaceWhere,
      include: {
        clusters: {
          include: {
            request: { select: { systemName: true, projectName: true, requesterId: true } },
            nodeGroups: true,
          }
        },
        requests: { select: { systemName: true, projectName: true, requesterId: true } },
        subdomains: true,
      },
      orderBy: { createdAt: "desc" }
    }),

    // 4. Horizon Remote Access Assignments
    prisma.horizonAssignment.findMany({
      where: horizonWhere,
      include: {
        horizonUser: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        },
        vm: {
          select: {
            id: true,
            hostname: true,
            systemName: true,
            request: { select: { systemName: true, projectName: true } }
          }
        },
        oldVm: {
          select: {
            id: true,
            hostname: true,
            systemName: true,
            request: { select: { systemName: true, projectName: true } }
          }
        },
        namespace: {
          select: {
            id: true,
            name: true,
            clusters: {
              include: {
                request: { select: { systemName: true, projectName: true } }
              }
            },
            requests: { select: { systemName: true, projectName: true } }
          }
        }
      },
      orderBy: { assignedAt: "desc" }
    }),

    // 5. VPN Remote Access Assignments
    prisma.vpnAssignment.findMany({
      where: vpnWhere,
      include: {
        vpnUser: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        },
        vm: {
          select: {
            id: true,
            hostname: true,
            systemName: true,
            request: { select: { systemName: true, projectName: true } }
          }
        },
        namespace: {
          select: {
            id: true,
            name: true,
            clusters: {
              include: {
                request: { select: { systemName: true, projectName: true } }
              }
            },
            requests: { select: { systemName: true, projectName: true } }
          }
        }
      },
      orderBy: { assignedAt: "desc" }
    })
  ]);

  interface SystemAccumulator {
    id: string;
    systemName: string;
    environmentsSet: Set<string>;
    vms: SystemVmDetail[];
    requests: SystemRequestDetail[];
    namespaces: SystemNamespaceDetail[];
    accessUsersMap: Map<string, {
      id: string;
      personName: string;
      email: string | null;
      accessTypes: Set<"VPN" | "Horizon">;
      targetType: Set<"VM" | "NAMESPACE">;
      targetNames: Set<string>;
      status: string;
      lastAssignedAt: string | null;
    }>;
    totalVcpu: number;
    totalRamGb: number;
    totalStorageGb: number;
  }

  const systemsMap = new Map<string, SystemAccumulator>();

  function getOrCreateSystem(resolvedName: string): SystemAccumulator {
    const norm = normalizeSystemName(resolvedName);
    const key = norm || "unassigned";
    const displayName = norm ? formatSystemName(resolvedName) : "Unassigned / Standalone";

    if (!systemsMap.has(key)) {
      systemsMap.set(key, {
        id: key,
        systemName: displayName,
        environmentsSet: new Set(),
        vms: [],
        requests: [],
        namespaces: [],
        accessUsersMap: new Map(),
        totalVcpu: 0,
        totalRamGb: 0,
        totalStorageGb: 0,
      });
    }

    const sys = systemsMap.get(key)!;
    if (displayName !== "Unassigned / Standalone" && sys.systemName === "Unassigned / Standalone") {
      sys.systemName = displayName;
    }
    return sys;
  }

  // A. Process Virtual Machines
  for (const vm of vms) {
    const rawSysName = resolveSystemName(vm);
    const sys = getOrCreateSystem(rawSysName);
    const spec = getEffectiveSpec(vm as any);

    sys.totalVcpu += spec.vcpu;
    sys.totalRamGb += spec.ramGb;
    sys.totalStorageGb += spec.storageGb;

    const env = vm.environment || "PRODUCTION";
    sys.environmentsSet.add(env);

    sys.vms.push({
      id: vm.id,
      hostname: vm.hostname || "UNNAMED",
      ipAddress: vm.ipAddress || "PENDING",
      environment: env,
      status: vm.status || "ACTIVE",
      vcpu: spec.vcpu,
      ramGb: spec.ramGb,
      storageGb: spec.storageGb,
      ownerName: vm.owner?.name || "Unknown Owner",
      hostAsset: vm.hostAsset?.name || null,
      renewalDate: vm.renewalDate ? vm.renewalDate.toISOString() : null,
    });
  }

  // B. Process Requests
  for (const req of requests) {
    const rawSysName = req.systemName?.trim() || req.projectName?.trim() || "Unassigned / Standalone";
    const sys = getOrCreateSystem(rawSysName);

    const env = req.environment || "PRODUCTION";
    sys.environmentsSet.add(env);

    sys.requests.push({
      id: req.id,
      displayId: req.id.slice(-8).toUpperCase(),
      type: req.requestType || "VM_PROVISIONING",
      status: req.status || "PENDING",
      environment: env,
      requesterName: req.requester?.name || "Unknown Requester",
      requesterEmail: req.requester?.email || null,
      submittedAt: req.createdAt ? req.createdAt.toISOString() : new Date().toISOString(),
      vmsCount: req.vmInstances?.length || 0,
    });
  }

  // C. Process Kubernetes Namespaces
  for (const ns of namespaces) {
    const rawSysName = resolveK8sSystemName(ns as any) || "Unassigned / Standalone";
    const sys = getOrCreateSystem(rawSysName);

    const clusterNames = ns.clusters?.map(c => c.clusterName).filter(Boolean) || [];
    const primaryCluster = clusterNames[0] || "Default Cluster";

    let totalNodes = 0;
    let totalVcpu = 0;
    let totalRamGb = 0;
    let totalStorageGb = 0;

    for (const cluster of ns.clusters || []) {
      for (const ng of cluster.nodeGroups || []) {
        totalNodes += ng.nodeCount || 0;
        totalVcpu += (ng.nodeCount || 0) * (ng.vcpu || 0);
        totalRamGb += (ng.nodeCount || 0) * (ng.ramGb || 0);
        totalStorageGb += (ng.nodeCount || 0) * (ng.storageGb || 0);
      }
    }

    sys.namespaces.push({
      id: ns.id,
      name: ns.name,
      supervisorIp: ns.supervisorIp || "N/A",
      clusterName: primaryCluster,
      clusters: clusterNames,
      totalNodes,
      totalVcpu,
      totalRamGb,
      totalStorageGb,
      requester: ns.requests?.[0]?.requesterId || "Kubernetes Admin",
      status: "ACTIVE",
      createdAt: ns.createdAt ? ns.createdAt.toISOString() : new Date().toISOString(),
    });
  }

  // D. Process Remote Access Users (Horizon)
  for (const h of horizonAssignments) {
    const targetVm = h.vm || h.oldVm;
    const targetNs = h.namespace;

    let targetSysName = "";
    let targetEntityName = "";
    let targetType: "VM" | "NAMESPACE" = "VM";

    if (targetVm) {
      targetSysName = resolveSystemName(targetVm);
      targetEntityName = targetVm.hostname || targetVm.id;
      targetType = "VM";
    } else if (targetNs) {
      targetSysName = resolveK8sSystemName(targetNs as any) || "Unassigned / Standalone";
      targetEntityName = targetNs.name || targetNs.id;
      targetType = "NAMESPACE";
    }

    if (!targetSysName) continue;
    const sys = getOrCreateSystem(targetSysName);

    const personName = h.horizonUser?.user?.name || h.horizonUser?.fullName || h.horizonUser?.username || h.username || "Authorized User";
    const email = h.horizonUser?.user?.email || h.horizonUser?.email || null;
    const userKey = h.horizonUser?.userId || normalizeUsername(personName);

    const assignedAtStr = h.assignedAt instanceof Date ? h.assignedAt.toISOString() : (h.assignedAt || null);

    if (!sys.accessUsersMap.has(userKey)) {
      sys.accessUsersMap.set(userKey, {
        id: userKey,
        personName,
        email,
        accessTypes: new Set(["Horizon"]),
        targetType: new Set([targetType]),
        targetNames: new Set([targetEntityName]),
        status: h.status || "ACTIVE",
        lastAssignedAt: assignedAtStr,
      });
    } else {
      const existing = sys.accessUsersMap.get(userKey)!;
      existing.accessTypes.add("Horizon");
      existing.targetType.add(targetType);
      existing.targetNames.add(targetEntityName);
      if (assignedAtStr && (!existing.lastAssignedAt || assignedAtStr > existing.lastAssignedAt)) {
        existing.lastAssignedAt = assignedAtStr;
      }
    }
  }

  // E. Process Remote Access Users (VPN)
  for (const v of vpnAssignments) {
    const targetVm = v.vm;
    const targetNs = v.namespace;

    let targetSysName = "";
    let targetEntityName = "";
    let targetType: "VM" | "NAMESPACE" = "VM";

    if (targetVm) {
      targetSysName = resolveSystemName(targetVm);
      targetEntityName = targetVm.hostname || targetVm.id;
      targetType = "VM";
    } else if (targetNs) {
      targetSysName = resolveK8sSystemName(targetNs as any) || "Unassigned / Standalone";
      targetEntityName = targetNs.name || targetNs.id;
      targetType = "NAMESPACE";
    }

    if (!targetSysName) continue;
    const sys = getOrCreateSystem(targetSysName);

    const personName = v.vpnUser?.user?.name || v.vpnUser?.fullName || v.vpnUser?.username || v.username || "Authorized User";
    const email = v.vpnUser?.user?.email || null;
    const userKey = v.vpnUser?.userId || normalizeUsername(personName);

    const assignedAtStr = v.assignedAt instanceof Date ? v.assignedAt.toISOString() : (v.assignedAt || null);

    if (!sys.accessUsersMap.has(userKey)) {
      sys.accessUsersMap.set(userKey, {
        id: userKey,
        personName,
        email,
        accessTypes: new Set(["VPN"]),
        targetType: new Set([targetType]),
        targetNames: new Set([targetEntityName]),
        status: "ACTIVE",
        lastAssignedAt: assignedAtStr,
      });
    } else {
      const existing = sys.accessUsersMap.get(userKey)!;
      existing.accessTypes.add("VPN");
      existing.targetType.add(targetType);
      existing.targetNames.add(targetEntityName);
      if (assignedAtStr && (!existing.lastAssignedAt || assignedAtStr > existing.lastAssignedAt)) {
        existing.lastAssignedAt = assignedAtStr;
      }
    }
  }

  // Collect and finalize all system items
  const allSystems: SystemReportItem[] = [];
  const envCollect = new Set<string>();

  for (const acc of systemsMap.values()) {
    // If a system has absolutely zero resources for this requester, omit it
    if (acc.vms.length === 0 && acc.requests.length === 0 && acc.namespaces.length === 0 && acc.accessUsersMap.size === 0) {
      continue;
    }

    const accessUsers: SystemAccessUserDetail[] = Array.from(acc.accessUsersMap.values()).map(u => ({
      id: u.id,
      personName: u.personName,
      email: u.email,
      accessTypes: Array.from(u.accessTypes),
      targetType: u.targetType.has("VM") && u.targetType.has("NAMESPACE") ? "BOTH" : u.targetType.has("VM") ? "VM" : "NAMESPACE",
      targetNames: Array.from(u.targetNames),
      status: u.status,
      lastAssignedAt: u.lastAssignedAt,
    }));

    const envs = Array.from(acc.environmentsSet).sort();
    for (const e of envs) envCollect.add(e);

    allSystems.push({
      id: acc.id,
      systemName: acc.systemName,
      environments: envs,
      totalVmsCount: acc.vms.length,
      totalRequestsCount: acc.requests.length,
      totalNamespacesCount: acc.namespaces.length,
      totalAccessUsersCount: accessUsers.length,
      totalVcpu: acc.totalVcpu,
      totalRamGb: acc.totalRamGb,
      totalStorageGb: acc.totalStorageGb,
      vms: acc.vms,
      requests: acc.requests,
      namespaces: acc.namespaces,
      accessUsers,
    });
  }

  // Sort systems alphabetically by systemName, keeping Unassigned at the end
  allSystems.sort((a, b) => {
    if (a.id === "unassigned") return 1;
    if (b.id === "unassigned") return -1;
    return a.systemName.localeCompare(b.systemName);
  });

  // Filter pipeline
  const filteredSystems = allSystems.filter(sys => {
    // 1. Environment filter
    if (environment !== "ALL") {
      if (!sys.environments.includes(environment)) return false;
    }

    // 2. Resource presence filter
    if (resourceFilter !== "ALL") {
      if (resourceFilter === "VMS" && sys.totalVmsCount === 0) return false;
      if (resourceFilter === "REQUESTS" && sys.totalRequestsCount === 0) return false;
      if (resourceFilter === "NAMESPACES" && sys.totalNamespacesCount === 0) return false;
      if (resourceFilter === "USERS" && sys.totalAccessUsersCount === 0) return false;
    }

    // 3. Search query
    if (searchTerm && searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      const matchSys = sys.systemName.toLowerCase().includes(q);
      const matchVms = sys.vms.some(v => v.hostname.toLowerCase().includes(q) || v.ipAddress.toLowerCase().includes(q));
      const matchReqs = sys.requests.some(r => r.displayId.toLowerCase().includes(q) || r.requesterName.toLowerCase().includes(q));
      const matchNs = sys.namespaces.some(n => n.name.toLowerCase().includes(q) || n.supervisorIp.toLowerCase().includes(q));
      const matchUsers = sys.accessUsers.some(u => u.personName.toLowerCase().includes(q) || (u.email && u.email.toLowerCase().includes(q)));

      if (!matchSys && !matchVms && !matchReqs && !matchNs && !matchUsers) {
        return false;
      }
    }

    return true;
  });

  // Calculate system-wide summary metrics
  const summary: SystemReportSummary = {
    totalSystems: filteredSystems.length,
    totalVms: filteredSystems.reduce((sum, s) => sum + s.totalVmsCount, 0),
    totalRequests: filteredSystems.reduce((sum, s) => sum + s.totalRequestsCount, 0),
    totalNamespaces: filteredSystems.reduce((sum, s) => sum + s.totalNamespacesCount, 0),
    totalAccessUsers: filteredSystems.reduce((sum, s) => sum + s.totalAccessUsersCount, 0),
    totalVcpu: filteredSystems.reduce((sum, s) => sum + s.totalVcpu, 0),
    totalRamGb: filteredSystems.reduce((sum, s) => sum + s.totalRamGb, 0),
    totalStorageGb: filteredSystems.reduce((sum, s) => sum + s.totalStorageGb, 0),
  };

  const skip = getAll ? undefined : (page - 1) * pageSize;
  const take = getAll ? undefined : pageSize;
  const paginatedData = skip !== undefined && take !== undefined 
    ? filteredSystems.slice(skip, skip + take) 
    : filteredSystems;

  return {
    data: paginatedData,
    total: filteredSystems.length,
    page,
    pageSize,
    summary,
    availableEnvironments: Array.from(envCollect).sort(),
  };
}
