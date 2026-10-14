// src/lib/system-utils.ts
import { Prisma } from "@prisma/client";

/**
 * Normalizes a system name for identity comparison, map keys, and deduplication.
 * Collapses multiple spaces, trims, and converts to lower-case.
 * E.g., "  Core   Banking " -> "core banking"
 */
export function normalizeSystemName(name?: string | null): string {
  if (!name) return "";
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Formats a system name for clean display.
 * Trims leading/trailing whitespace and collapses multiple spaces, preserving casing.
 */
export function formatSystemName(name?: string | null): string {
  if (!name) return "";
  return name.trim().replace(/\s+/g, " ");
}

/**
 * Resolves the system name from a VM instance or its originating request.
 * Follows resolution order: vm.systemName -> vm.request.systemName -> "".
 */
export function resolveVmSystemName(vm?: {
  systemName?: string | null;
  request?: { systemName?: string | null } | null;
} | null): string {
  if (!vm) return "";
  return vm.systemName?.trim() || vm.request?.systemName?.trim() || "";
}

/**
 * Returns a user-friendly display name for a VM's system.
 * Falls back to "Standalone / Unassigned" if no system name is associated.
 */
export function getDisplaySystemName(vm?: {
  systemName?: string | null;
  request?: { systemName?: string | null } | null;
} | null): string {
  const resolved = resolveVmSystemName(vm);
  return resolved ? formatSystemName(resolved) : "Standalone / Unassigned";
}

/**
 * Builds a Prisma where-clause for exact system filtering (e.g. from dropdown selection).
 * Matches either vm.systemName OR request.systemName (case-insensitive).
 */
export function systemNameFilter(rawSystemName: string): Prisma.VmInstanceWhereInput {
  const clean = formatSystemName(rawSystemName);
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

/**
 * Builds a Prisma where-clause for free-text substring search on system name.
 * Searches across both vm.systemName and request.systemName.
 */
export function systemNameSearch(term: string): Prisma.VmInstanceWhereInput {
  const clean = term.trim();
  if (!clean) return {};
  return {
    OR: [
      { systemName: { contains: clean, mode: "insensitive" } },
      { request: { systemName: { contains: clean, mode: "insensitive" } } },
    ],
  };
}

/**
 * Resolves the system name from a Kubernetes namespace, its clusters, or associated requests.
 */
export function resolveK8sSystemName(namespace?: {
  clusters?: Array<{ request?: { systemName?: string | null; projectName?: string | null } | null }>;
  requests?: Array<{ systemName?: string | null; projectName?: string | null }>;
} | null): string {
  if (!namespace) return "";

  // 1. Check primary or any cluster's request systemName
  if (namespace.clusters && namespace.clusters.length > 0) {
    for (const cluster of namespace.clusters) {
      if (cluster?.request?.systemName?.trim()) {
        return formatSystemName(cluster.request.systemName);
      }
    }
    for (const cluster of namespace.clusters) {
      if (cluster?.request?.projectName?.trim()) {
        return formatSystemName(cluster.request.projectName);
      }
    }
  }

  // 2. Check namespace requests relation
  if (namespace.requests && namespace.requests.length > 0) {
    for (const req of namespace.requests) {
      if (req?.systemName?.trim()) {
        return formatSystemName(req.systemName);
      }
    }
    for (const req of namespace.requests) {
      if (req?.projectName?.trim()) {
        return formatSystemName(req.projectName);
      }
    }
  }

  return "";
}

/**
 * Returns a user-friendly display name for a Kubernetes namespace's system.
 */
export function getDisplayK8sSystemName(namespace?: {
  clusters?: Array<{ request?: { systemName?: string | null; projectName?: string | null } | null }>;
  requests?: Array<{ systemName?: string | null; projectName?: string | null }>;
} | null): string {
  const resolved = resolveK8sSystemName(namespace);
  return resolved ? formatSystemName(resolved) : "Standalone / Direct Provisioning";
}

