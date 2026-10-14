// src/lib/reports/shared-reporting.ts
/**
 * ============================================================================
 * SHARED REPORTING DATA LAYER
 * ============================================================================
 * Centralized, authoritative reporting logic ensuring that dashboard pages,
 * tabs, modals, and export pipelines always produce consistent figures.
 *
 * METRIC DEFINITIONS:
 * 1. Active VMs: status = ACTIVE and decommissionedAt IS NULL (Point-in-time, No date range)
 * 2. Total vCPU / RAM / Storage: Sum of effective specs over Active VMs (Point-in-time, No date range)
 * 3. Total Users: Distinct VM owners (in scope) with at least one Active VM (Point-in-time, No date range)
 * 4. VMs provisioned in period: provisionedAt within range (Uses date range)
 * 5. Requests submitted in period: submittedAt within range (Uses date range)
 * 6. Requests decided: Counted by status and decision date within range (Uses date range)
 * 7. Approval turnaround: Approval.decidedAt - Approval.createdAt, per level (Uses date range)
 * 8. Lifecycle (request to provision): provisionedAt - submittedAt (Uses date range)
 */

import prisma from "@/lib/prisma";
import { Prisma, VmStatus, Environment, RequestStatus } from "@prisma/client";
import { canManageInventory, isManagementRole } from "@/lib/roles";
import { differenceInDays, differenceInHours, subDays, subYears } from "date-fns";

// ============================================================================
// 1. ACTOR & SCOPE HELPERS
// ============================================================================

export interface ReportActor {
  id: string;
  roles?: string[];
}

export interface ReportScope {
  actorId: string;
  roles: string[];
  isAdminOrDcOps: boolean;
  isApprover: boolean;
  canViewInfrastructure: boolean;
  canViewAllAllocations: boolean;
  vmWhere: Prisma.VmInstanceWhereInput;
  requestWhere: Prisma.RequestWhereInput;
  namespaceWhere: Prisma.K8sNamespaceWhereInput;
  userWhere: Prisma.UserWhereInput;
}

/**
 * Returns a Prisma where fragment for VMs, requests, and namespaces.
 * - Requester: own VMs (ownerId or request.requesterId) and own requests.
 * - Admin / DC Ops: broad access across all entities.
 * - Approvers: management access according to role rules.
 */
export function getReportScope(actor: ReportActor): ReportScope {
  const roles = actor.roles || [];
  const isAdminOrDcOps = canManageInventory(roles);
  const isApprover = !isAdminOrDcOps && isManagementRole(roles);

  if (isAdminOrDcOps) {
    return {
      actorId: actor.id,
      roles,
      isAdminOrDcOps: true,
      isApprover: false,
      canViewInfrastructure: true,
      canViewAllAllocations: true,
      vmWhere: {},
      requestWhere: {},
      namespaceWhere: {},
      userWhere: {},
    };
  }

  if (isApprover) {
    return {
      actorId: actor.id,
      roles,
      isAdminOrDcOps: false,
      isApprover: true,
      canViewInfrastructure: false,
      canViewAllAllocations: true,
      vmWhere: {
        OR: [
          { ownerId: actor.id },
          { request: { requesterId: actor.id } }
        ]
      },
      requestWhere: {}, // Approvers review all incoming requests
      namespaceWhere: {},
      userWhere: {},
    };
  }

  // Regular Requester scope
  return {
    actorId: actor.id,
    roles,
    isAdminOrDcOps: false,
    isApprover: false,
    canViewInfrastructure: false,
    canViewAllAllocations: false,
    vmWhere: {
      OR: [
        { ownerId: actor.id },
        { request: { requesterId: actor.id } }
      ]
    },
    requestWhere: {
      requesterId: actor.id
    },
    namespaceWhere: {
      OR: [
        { clusters: { some: { request: { requesterId: actor.id } } } },
        { requests: { some: { requesterId: actor.id } } }
      ]
    },
    userWhere: {
      id: actor.id
    }
  };
}

/**
 * Guard for infrastructure reports (Cluster Capacity, Hardware & Hosts).
 * Denies access server-side for unauthorized roles.
 */
export function assertCanViewInfrastructure(actor: ReportActor): {
  permitted: boolean;
  error?: string;
  message?: string;
} {
  const scope = getReportScope(actor);
  if (!scope.canViewInfrastructure) {
    return {
      permitted: false,
      error: "NOT_PERMITTED",
      message: "Infrastructure reports are restricted to Administrator and DC Operations roles."
    };
  }
  return { permitted: true };
}

// ============================================================================
// 2. SYSTEM NAME RESOLUTION & NORMALIZATION
// ============================================================================

/**
 * Normalizes a system name for identity comparison, map keys, and deduplication.
 * Collapses multiple spaces, trims, and converts to lower-case.
 */
export function normalizeSystemName(name?: string | null): string {
  if (!name) return "";
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Formats a system name for clean display, preserving original casing.
 */
export function formatSystemName(name?: string | null): string {
  if (!name) return "";
  return name.trim().replace(/\s+/g, " ");
}

/**
 * Resolves the system name from a VM or its originating request.
 * Falls back to "Unassigned / Standalone". Does NOT write "Standalone" to the DB.
 */
export function resolveSystemName(vm?: {
  systemName?: string | null;
  request?: { systemName?: string | null; projectName?: string | null } | null;
} | null): string {
  if (!vm) return "Unassigned / Standalone";
  const name = vm.systemName?.trim() || vm.request?.systemName?.trim() || vm.request?.projectName?.trim();
  return name ? formatSystemName(name) : "Unassigned / Standalone";
}

/**
 * Builds a Prisma where-clause matching vm.systemName OR request.systemName (case-insensitive).
 */
export function systemNameWhere(name: string): Prisma.VmInstanceWhereInput {
  const clean = formatSystemName(name);
  if (!clean || clean.toUpperCase() === "ALL") {
    return {};
  }
  return {
    OR: [
      { systemName: { equals: clean, mode: "insensitive" } },
      { request: { systemName: { equals: clean, mode: "insensitive" } } },
    ],
  };
}

// ============================================================================
// 3. RESOURCE SPEC RESOLUTION (FALLBACK CHAIN)
// ============================================================================

export interface EffectiveSpec {
  vcpu: number;
  ramGb: number;
  storageGb: number;
  os: string;
  source: "currentSpec" | "specHistory" | "vmSpecification" | "request" | "missing";
  isMissing: boolean;
}

/**
 * Implements the resource fallback chain:
 * currentSpec -> latest VmSpec by effectiveFrom -> request/VmSpecification -> 0 (flagged "missing")
 */
export function getEffectiveSpec(vm: {
  currentSpec?: {
    vcpu?: number | null;
    ramGb?: number | null;
    storageGb?: number | null;
    osName?: string | null;
    osVersion?: string | null;
  } | null;
  specHistory?: {
    vcpu: number;
    ramGb: number;
    storageGb: number;
    osName?: string | null;
    osVersion?: string | null;
  }[] | null;
  sequenceNumber?: number | null;
  request?: {
    vcpu?: number | null;
    ramGb?: number | null;
    storageGb?: number | null;
    osName?: string | null;
    osVersion?: string | null;
    vmSpecifications?: {
      vcpu: number;
      ramGb: number;
      storageGb: number;
    }[] | null;
  } | null;
}): EffectiveSpec {
  // 1. currentSpec
  if (vm.currentSpec && (vm.currentSpec.vcpu || vm.currentSpec.ramGb || vm.currentSpec.storageGb)) {
    const os = `${vm.currentSpec.osName || ""} ${vm.currentSpec.osVersion || ""}`.trim() || "N/A";
    return {
      vcpu: vm.currentSpec.vcpu || 0,
      ramGb: vm.currentSpec.ramGb || 0,
      storageGb: vm.currentSpec.storageGb || 0,
      os,
      source: "currentSpec",
      isMissing: false,
    };
  }

  // 2. Latest VmSpec from specHistory
  if (vm.specHistory && vm.specHistory.length > 0) {
    const latest = vm.specHistory[0];
    if (latest && (latest.vcpu || latest.ramGb || latest.storageGb)) {
      const os = `${latest.osName || ""} ${latest.osVersion || ""}`.trim() || "N/A";
      return {
        vcpu: latest.vcpu || 0,
        ramGb: latest.ramGb || 0,
        storageGb: latest.storageGb || 0,
        os,
        source: "specHistory",
        isMissing: false,
      };
    }
  }

  // 3. VmSpecification on Request
  if (vm.request?.vmSpecifications && vm.request.vmSpecifications.length > 0) {
    const matchedSpec = vm.request.vmSpecifications[0];
    if (matchedSpec && (matchedSpec.vcpu || matchedSpec.ramGb || matchedSpec.storageGb)) {
      const os = `${vm.request.osName || ""} ${vm.request.osVersion || ""}`.trim() || "N/A";
      return {
        vcpu: matchedSpec.vcpu || 0,
        ramGb: matchedSpec.ramGb || 0,
        storageGb: matchedSpec.storageGb || 0,
        os,
        source: "vmSpecification",
        isMissing: false,
      };
    }
  }

  // 4. Request-level specs
  if (vm.request && (vm.request.vcpu || vm.request.ramGb || vm.request.storageGb)) {
    const os = `${vm.request.osName || ""} ${vm.request.osVersion || ""}`.trim() || "N/A";
    return {
      vcpu: vm.request.vcpu || 0,
      ramGb: vm.request.ramGb || 0,
      storageGb: vm.request.storageGb || 0,
      os,
      source: "request",
      isMissing: false,
    };
  }

  // 5. Fallthrough: Missing spec
  return {
    vcpu: 0,
    ramGb: 0,
    storageGb: 0,
    os: "N/A",
    source: "missing",
    isMissing: true,
  };
}

/**
 * Pure aggregation helper over VM rows using the authoritative getEffectiveSpec chain.
 */
export function aggregateVmResources(vms: Parameters<typeof getEffectiveSpec>[0][]): {
  totalVcpu: number;
  totalRamGb: number;
  totalStorageGb: number;
  specMissingCount: number;
} {
  let totalVcpu = 0;
  let totalRamGb = 0;
  let totalStorageGb = 0;
  let specMissingCount = 0;

  for (const vm of vms) {
    const spec = getEffectiveSpec(vm);
    totalVcpu += spec.vcpu;
    totalRamGb += spec.ramGb;
    totalStorageGb += spec.storageGb;
    if (spec.isMissing) {
      specMissingCount++;
    }
  }

  return { totalVcpu, totalRamGb, totalStorageGb, specMissingCount };
}

// ============================================================================
// 4. DATE VALIDATION & RANGE CAPPING
// ============================================================================

export interface ValidatedDateRange {
  from: Date;
  to: Date;
}

/**
 * Validates and sanitizes date ranges.
 * - Caps maximum range to 2 years (730 days)
 * - Guarantees from <= to
 */
export function validateDateRange(
  rawFrom?: Date | string | null,
  rawTo?: Date | string | null,
  maxYears = 2
): ValidatedDateRange {
  const now = new Date();
  let to = rawTo ? new Date(rawTo) : now;
  let from = rawFrom ? new Date(rawFrom) : subDays(now, 30);

  if (isNaN(to.getTime())) to = now;
  if (isNaN(from.getTime())) from = subDays(to, 30);

  // Validate from <= to
  if (from > to) {
    const temp = from;
    from = to;
    to = temp;
  }

  // Cap maximum range to maxYears (e.g. 2 years)
  const maxEarliest = subYears(to, maxYears);
  if (from < maxEarliest) {
    from = maxEarliest;
  }

  return { from, to };
}

// ============================================================================
// 5. METRIC DEFINITIONS METADATA
// ============================================================================

export * from "./metric-definitions";

// ============================================================================
// 6. DATABASE-AGGREGATED KPIS
// ============================================================================

export interface ReportingKPIs {
  pointInTime: {
    activeVms: number;
    totalVcpu: number;
    totalRamGb: number;
    totalStorageGb: number;
    totalUsers: number;
  };
  inPeriod: {
    vmsProvisioned: number;
    requestsSubmitted: number;
    requestsApproved: number;
    requestsRejected: number;
    avgApprovalTurnaroundHours: number;
    avgProvisionLeadTimeHours: number;
  };
  dateRange: ValidatedDateRange;
}

/**
 * Computes authoritative, database-aggregated KPI metrics respecting scope.
 * Aggregates in the database rather than loading bulk rows into memory.
 */
export async function calculateReportingKPIs(
  actor: ReportActor,
  rawDateRange?: { from?: Date | string | null; to?: Date | string | null }
): Promise<ReportingKPIs> {
  const scope = getReportScope(actor);
  const dateRange = validateDateRange(rawDateRange?.from, rawDateRange?.to);
  const { from, to } = dateRange;

  // 1. Point-in-time Active VMs count
  const activeVmWhere: Prisma.VmInstanceWhereInput = {
    ...scope.vmWhere,
    status: VmStatus.ACTIVE,
    decommissionedAt: null,
  };

  // 2. Point-in-time Distinct Tenants with Active VMs
  const [activeVmsCount, activeVmRows, distinctOwners] = await Promise.all([
    prisma.vmInstance.count({ where: activeVmWhere }),
    // Optimized select of only spec relations for point-in-time active resources
    prisma.vmInstance.findMany({
      where: activeVmWhere,
      select: {
        sequenceNumber: true,
        currentSpec: { select: { vcpu: true, ramGb: true, storageGb: true } },
        specHistory: {
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
          select: { vcpu: true, ramGb: true, storageGb: true }
        },
        request: {
          select: {
            vcpu: true,
            ramGb: true,
            storageGb: true,
            vmSpecifications: { select: { vcpu: true, ramGb: true, storageGb: true } }
          }
        }
      }
    }),
    prisma.vmInstance.findMany({
      where: {
        ...activeVmWhere,
        ownerId: { not: null }
      },
      select: { ownerId: true },
      distinct: ['ownerId']
    })
  ]);

  const { totalVcpu, totalRamGb, totalStorageGb } = aggregateVmResources(activeVmRows);

  // 3. Period-based metrics (Aggregated in DB)
  const [
    vmsProvisioned,
    requestsSubmitted,
    requestsByStatus,
    decidedApprovals,
    provisionedRequests
  ] = await Promise.all([
    // VMs provisioned in period
    prisma.vmInstance.count({
      where: {
        ...scope.vmWhere,
        provisionedAt: { gte: from, lte: to }
      }
    }),
    // Requests submitted in period
    prisma.request.count({
      where: {
        ...scope.requestWhere,
        submittedAt: { gte: from, lte: to }
      }
    }),
    // Requests by status in period
    prisma.request.groupBy({
      by: ['status'],
      _count: true,
      where: {
        ...scope.requestWhere,
        updatedAt: { gte: from, lte: to }
      }
    }),
    // Approval turnaround per level
    prisma.approval.findMany({
      where: {
        decision: { in: ['APPROVED', 'REJECTED'] },
        decidedAt: { gte: from, lte: to, not: null }
      },
      select: {
        createdAt: true,
        decidedAt: true
      }
    }),
    // Lifecycle from submittedAt to provisionedAt
    prisma.request.findMany({
      where: {
        ...scope.requestWhere,
        status: RequestStatus.PROVISIONED,
        submittedAt: { not: null, gte: from, lte: to },
        provisionedAt: { not: null }
      },
      select: {
        submittedAt: true,
        provisionedAt: true
      }
    })
  ]);

  const approvedCount = requestsByStatus.find(s => s.status === RequestStatus.APPROVED)?._count || 0;
  const rejectedCount = requestsByStatus.find(s => s.status === RequestStatus.REJECTED)?._count || 0;

  // Calculate avg approval turnaround
  let totalApprovalHours = 0;
  for (const app of decidedApprovals) {
    if (app.decidedAt) {
      totalApprovalHours += differenceInHours(app.decidedAt, app.createdAt);
    }
  }
  const avgApprovalTurnaroundHours = decidedApprovals.length > 0
    ? Math.round((totalApprovalHours / decidedApprovals.length) * 10) / 10
    : 0;

  // Calculate avg lifecycle lead time
  let totalLifecycleHours = 0;
  for (const req of provisionedRequests) {
    if (req.provisionedAt && req.submittedAt) {
      totalLifecycleHours += differenceInHours(req.provisionedAt, req.submittedAt);
    }
  }
  const avgProvisionLeadTimeHours = provisionedRequests.length > 0
    ? Math.round((totalLifecycleHours / provisionedRequests.length) * 10) / 10
    : 0;

  return {
    pointInTime: {
      activeVms: activeVmsCount,
      totalVcpu,
      totalRamGb,
      totalStorageGb,
      totalUsers: distinctOwners.length,
    },
    inPeriod: {
      vmsProvisioned,
      requestsSubmitted,
      requestsApproved: approvedCount,
      requestsRejected: rejectedCount,
      avgApprovalTurnaroundHours,
      avgProvisionLeadTimeHours,
    },
    dateRange,
  };
}
