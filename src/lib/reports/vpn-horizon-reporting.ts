// src/lib/reports/vpn-horizon-reporting.ts
import { 
  VpnHorizonUserReportItem, 
  VpnHorizonTargetVm, 
  VpnHorizonTargetNamespace 
} from "@/types/reports";
import { resolveSystemName } from "./shared-reporting";

export function normalizeUsername(name?: string | null): string {
  if (!name) return "";
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export interface TransformVpnHorizonParams {
  horizonAssignments: any[];
  vpnAssignments: any[];
  vpnUsers?: any[];
  horizonUsers?: any[];
  requesterScopedVmIds?: Set<string>;
  requesterScopedNamespaceIds?: Set<string>;
  isRequester?: boolean;
}

/**
 * Authoritative data transform for VPN & Horizon reporting.
 * - Groups by individual Person (one parent row per person)
 * - Merges VpnUser and HorizonUser accounts by linked portal userId or normalised username
 * - New fields (vmId, namespaceId) are authoritative
 * - Legacy fields (vmInstanceId/oldVm, assignedVms) are fallback only, marked "Legacy", never double counted
 * - Requesters only see assignments pointing to their own VMs and namespaces
 */
export function transformVpnHorizonAssignmentsToUsers(
  params: TransformVpnHorizonParams
): VpnHorizonUserReportItem[] {
  const {
    horizonAssignments = [],
    vpnAssignments = [],
    vpnUsers = [],
    horizonUsers = [],
    requesterScopedVmIds,
    requesterScopedNamespaceIds,
    isRequester = false,
  } = params;

  // 1. Build username -> portalUserId mapping
  const usernameToPortalId = new Map<string, string>();
  const portalUserProfiles = new Map<string, { id: string; name?: string; email?: string }>();

  for (const vu of vpnUsers) {
    const norm = normalizeUsername(vu.username);
    if (vu.userId) {
      usernameToPortalId.set(norm, vu.userId);
      if (vu.user) {
        portalUserProfiles.set(vu.userId, {
          id: vu.userId,
          name: vu.user.name,
          email: vu.user.email,
        });
      }
    }
  }

  for (const hu of horizonUsers) {
    const norm = normalizeUsername(hu.username);
    if (hu.userId) {
      usernameToPortalId.set(norm, hu.userId);
      if (hu.user) {
        portalUserProfiles.set(hu.userId, {
          id: hu.userId,
          name: hu.user.name,
          email: hu.user.email,
        });
      }
    }
  }

  interface PersonAcc {
    id: string;
    personName: string;
    email: string | null;
    portalUserId: string | null;
    vpnAccount: {
      username: string;
      fullName: string;
      vpnProfile: string;
      vpnIp: string;
      status: string;
    } | null;
    horizonAccount: {
      username: string;
      fullName: string;
      email: string | null;
      status: string;
    } | null;
    vmsMap: Map<string, VpnHorizonTargetVm>;
    namespacesMap: Map<string, VpnHorizonTargetNamespace>;
    hasLegacy: boolean;
    lastAssignedAt: string | null;
  }

  const peopleMap = new Map<string, PersonAcc>();

  function getOrCreatePerson(userRef: {
    portalUserId?: string | null;
    username?: string | null;
    fullName?: string | null;
    email?: string | null;
  }): PersonAcc {
    const normUser = normalizeUsername(userRef.username);
    const resolvedPortalId = userRef.portalUserId || (normUser ? usernameToPortalId.get(normUser) : null);

    const personKey = resolvedPortalId 
      ? `portal:${resolvedPortalId}` 
      : `norm:${normUser || normalizeUsername(userRef.fullName) || "unassigned"}`;

    if (!peopleMap.has(personKey)) {
      const portalProfile = resolvedPortalId ? portalUserProfiles.get(resolvedPortalId) : null;
      const initialName = portalProfile?.name || userRef.fullName || userRef.username || "Unassigned Person";
      const initialEmail = portalProfile?.email || userRef.email || (userRef.username?.includes("@") ? userRef.username : null);

      peopleMap.set(personKey, {
        id: personKey,
        personName: initialName,
        email: initialEmail || null,
        portalUserId: resolvedPortalId || null,
        vpnAccount: null,
        horizonAccount: null,
        vmsMap: new Map(),
        namespacesMap: new Map(),
        hasLegacy: false,
        lastAssignedAt: null,
      });
    }

    const person = peopleMap.get(personKey)!;
    if ((!person.personName || person.personName === "Unassigned Person") && (userRef.fullName || userRef.username)) {
      person.personName = userRef.fullName || userRef.username || "Unassigned Person";
    }
    if (!person.email && userRef.email) {
      person.email = userRef.email;
    }
    return person;
  }

  // Pre-seed provisioned accounts if available
  for (const vu of vpnUsers) {
    const person = getOrCreatePerson({
      portalUserId: vu.userId,
      username: vu.username,
      fullName: vu.fullName,
      email: vu.user?.email,
    });
    if (!person.vpnAccount) {
      person.vpnAccount = {
        username: vu.username,
        fullName: vu.fullName,
        vpnProfile: vu.vpnProfile || "Full Tunnel",
        vpnIp: vu.vpnIp || "N/A",
        status: vu.status || "ACTIVE",
      };
    }
  }

  for (const hu of horizonUsers) {
    const person = getOrCreatePerson({
      portalUserId: hu.userId,
      username: hu.username,
      fullName: hu.fullName,
      email: hu.email || hu.user?.email,
    });
    if (!person.horizonAccount) {
      person.horizonAccount = {
        username: hu.username,
        fullName: hu.fullName,
        email: hu.email || (hu.username?.includes("@") ? hu.username : null),
        status: hu.status || "ACTIVE",
      };
    }
  }

  // 2. Process Horizon Assignments
  for (const h of horizonAssignments) {
    const person = getOrCreatePerson({
      portalUserId: h.horizonUser?.userId || h.horizonUser?.user?.id,
      username: h.horizonUser?.username || h.username,
      fullName: h.horizonUser?.fullName,
      email: h.horizonUser?.email || h.horizonUser?.user?.email,
    });

    if (h.horizonUser && !person.horizonAccount) {
      person.horizonAccount = {
        username: h.horizonUser.username,
        fullName: h.horizonUser.fullName,
        email: h.horizonUser.email || (h.horizonUser.username?.includes("@") ? h.horizonUser.username : null),
        status: h.horizonUser.status || "ACTIVE",
      };
    }

    const assignedAtStr = h.assignedAt instanceof Date ? h.assignedAt.toISOString() : (h.assignedAt || new Date().toISOString());
    if (!person.lastAssignedAt || assignedAtStr > person.lastAssignedAt) {
      person.lastAssignedAt = assignedAtStr;
    }

    // Precedence: New VM relation -> New Namespace relation -> Legacy fallback
    if (h.vmId || h.vm) {
      const vmObj = h.vm || { id: h.vmId, hostname: h.vmId, ipAddress: "N/A", systemName: "Unassigned" };
      const vmId = vmObj.id || h.vmId;

      if (isRequester && requesterScopedVmIds && !requesterScopedVmIds.has(vmId)) {
        continue;
      }

      const vmKey = `vm:${vmId}`;
      // Check if there is already a legacy entry with matching hostname or ID
      const legacyEntryKey = Array.from(person.vmsMap.keys()).find(k => {
        const v = person.vmsMap.get(k)!;
        return v.isLegacy && (v.id === vmId || (vmObj.hostname && v.hostname.toLowerCase() === vmObj.hostname.toLowerCase()));
      });

      if (person.vmsMap.has(vmKey)) {
        const existing = person.vmsMap.get(vmKey)!;
        if (!existing.accessTypes.includes("Horizon")) {
          existing.accessTypes.push("Horizon");
        }
        existing.isLegacy = false; // New field authoritative
        if (vmObj.hostname) existing.hostname = vmObj.hostname;
        if (vmObj.ipAddress && existing.ipAddress === "PENDING") existing.ipAddress = vmObj.ipAddress;
      } else if (legacyEntryKey) {
        // Upgrade legacy entry to authoritative new VM
        const existing = person.vmsMap.get(legacyEntryKey)!;
        person.vmsMap.delete(legacyEntryKey);
        if (!existing.accessTypes.includes("Horizon")) {
          existing.accessTypes.push("Horizon");
        }
        existing.id = vmId;
        existing.hostname = vmObj.hostname || existing.hostname;
        existing.ipAddress = vmObj.ipAddress || existing.ipAddress;
        existing.systemName = resolveSystemName(vmObj);
        existing.environment = vmObj.environment || existing.environment;
        existing.status = vmObj.status || existing.status;
        existing.isLegacy = false;
        person.vmsMap.set(vmKey, existing);
      } else {
        person.vmsMap.set(vmKey, {
          id: vmId,
          hostname: vmObj.hostname || "UNNAMED",
          ipAddress: vmObj.ipAddress || h.assignedIp || "PENDING",
          systemName: resolveSystemName(vmObj),
          environment: vmObj.environment || "PRODUCTION",
          status: vmObj.status || h.status || "ACTIVE",
          accessTypes: ["Horizon"],
          assignedAt: assignedAtStr,
          expiresAt: null,
          isLegacy: false,
          assignedBy: h.assignedBy?.name || "Administrator",
          notes: h.notes || null,
        });
      }
    } else if (h.namespaceId || h.namespace) {
      const nsObj = h.namespace || { id: h.namespaceId, name: h.namespaceId, supervisorIp: "N/A" };
      const nsId = nsObj.id || h.namespaceId;

      if (isRequester && requesterScopedNamespaceIds && !requesterScopedNamespaceIds.has(nsId)) {
        continue;
      }

      const nsKey = `ns:${nsId}`;
      const clusterName = nsObj.clusters?.[0]?.clusterName || "Cluster";
      const sysName = nsObj.requests?.[0]?.systemName || "Kubernetes";

      if (person.namespacesMap.has(nsKey)) {
        const existing = person.namespacesMap.get(nsKey)!;
        if (!existing.accessTypes.includes("Horizon")) {
          existing.accessTypes.push("Horizon");
        }
      } else {
        person.namespacesMap.set(nsKey, {
          id: nsId,
          name: nsObj.name || nsId,
          supervisorIp: nsObj.supervisorIp || "N/A",
          systemName: sysName,
          clusterName,
          accessTypes: ["Horizon"],
          assignedAt: assignedAtStr,
          expiresAt: null,
          assignedBy: h.assignedBy?.name || "Administrator",
          notes: h.notes || null,
        });
      }
    } else if (h.oldVm || h.vmInstanceId) {
      // Legacy fallback: only used when vmId / vm is absent
      const oldVmObj = h.oldVm || { id: h.vmInstanceId, hostname: h.vmInstanceId, ipAddress: h.ipAddress || "N/A" };
      const oldVmId = oldVmObj.id || h.vmInstanceId;

      if (isRequester && requesterScopedVmIds && !requesterScopedVmIds.has(oldVmId)) {
        continue;
      }

      const vmKey = `vm:${oldVmId}`;
      // Check if authoritative or already-registered VM exists
      const existingMatch = person.vmsMap.get(vmKey) || Array.from(person.vmsMap.values()).find(v => 
        (oldVmObj.hostname && v.hostname.toLowerCase() === oldVmObj.hostname.toLowerCase()) || v.id === oldVmId
      );

      if (existingMatch) {
        if (!existingMatch.accessTypes.includes("Horizon")) {
          existingMatch.accessTypes.push("Horizon");
        }
        // Do NOT change isLegacy to true if it is already authoritative (false)
      } else {
        person.vmsMap.set(vmKey, {
          id: oldVmId,
          hostname: oldVmObj.hostname || "UNNAMED",
          ipAddress: oldVmObj.ipAddress || h.ipAddress || "N/A",
          systemName: resolveSystemName(oldVmObj),
          environment: oldVmObj.environment || "PRODUCTION",
          status: oldVmObj.status || h.status || "ACTIVE",
          accessTypes: ["Horizon"],
          assignedAt: assignedAtStr,
          expiresAt: null,
          isLegacy: true,
          assignedBy: h.assignedBy?.name || "System Admin (Legacy)",
          notes: h.notes || null,
        });
      }
    }
  }

  // 3. Process VPN Assignments
  for (const v of vpnAssignments) {
    const person = getOrCreatePerson({
      portalUserId: v.vpnUser?.userId || v.vpnUser?.user?.id,
      username: v.vpnUser?.username || v.username,
      fullName: v.vpnUser?.fullName,
      email: v.vpnUser?.user?.email,
    });

    if (v.vpnUser && !person.vpnAccount) {
      person.vpnAccount = {
        username: v.vpnUser.username,
        fullName: v.vpnUser.fullName,
        vpnProfile: v.vpnUser.vpnProfile || "Full Tunnel",
        vpnIp: v.vpnUser.vpnIp || "N/A",
        status: v.vpnUser.status || "ACTIVE",
      };
    }

    const assignedAtStr = v.assignedAt instanceof Date ? v.assignedAt.toISOString() : (v.assignedAt || new Date().toISOString());
    const expiresAtStr = v.expiresAt instanceof Date ? v.expiresAt.toISOString() : (v.expiresAt || null);

    if (!person.lastAssignedAt || assignedAtStr > person.lastAssignedAt) {
      person.lastAssignedAt = assignedAtStr;
    }

    if (v.vmId || v.vm) {
      const vmObj = v.vm || { id: v.vmId, hostname: v.vmId, ipAddress: "N/A", systemName: "Unassigned" };
      const vmId = vmObj.id || v.vmId;

      if (isRequester && requesterScopedVmIds && !requesterScopedVmIds.has(vmId)) {
        continue;
      }

      const vmKey = `vm:${vmId}`;
      const legacyEntryKey = Array.from(person.vmsMap.keys()).find(k => {
        const item = person.vmsMap.get(k)!;
        return item.isLegacy && (item.id === vmId || (vmObj.hostname && item.hostname.toLowerCase() === vmObj.hostname.toLowerCase()));
      });

      if (person.vmsMap.has(vmKey)) {
        const existing = person.vmsMap.get(vmKey)!;
        if (!existing.accessTypes.includes("VPN")) {
          existing.accessTypes.push("VPN");
        }
        existing.isLegacy = false;
        if (vmObj.hostname) existing.hostname = vmObj.hostname;
        if (vmObj.ipAddress && existing.ipAddress === "PENDING") existing.ipAddress = vmObj.ipAddress;
      } else if (legacyEntryKey) {
        const existing = person.vmsMap.get(legacyEntryKey)!;
        person.vmsMap.delete(legacyEntryKey);
        if (!existing.accessTypes.includes("VPN")) {
          existing.accessTypes.push("VPN");
        }
        existing.id = vmId;
        existing.hostname = vmObj.hostname || existing.hostname;
        existing.ipAddress = vmObj.ipAddress || existing.ipAddress;
        existing.systemName = resolveSystemName(vmObj);
        existing.environment = vmObj.environment || existing.environment;
        existing.status = vmObj.status || existing.status;
        existing.isLegacy = false;
        person.vmsMap.set(vmKey, existing);
      } else {
        person.vmsMap.set(vmKey, {
          id: vmId,
          hostname: vmObj.hostname || "UNNAMED",
          ipAddress: vmObj.ipAddress || "PENDING",
          systemName: resolveSystemName(vmObj),
          environment: vmObj.environment || "PRODUCTION",
          status: vmObj.status || "ACTIVE",
          accessTypes: ["VPN"],
          assignedAt: assignedAtStr,
          expiresAt: expiresAtStr,
          isLegacy: false,
          assignedBy: v.assignedBy?.name || "Network Admin",
          notes: v.notes || null,
        });
      }
    } else if (v.namespaceId || v.namespace) {
      const nsObj = v.namespace || { id: v.namespaceId, name: v.namespaceId, supervisorIp: "N/A" };
      const nsId = nsObj.id || v.namespaceId;

      if (isRequester && requesterScopedNamespaceIds && !requesterScopedNamespaceIds.has(nsId)) {
        continue;
      }

      const nsKey = `ns:${nsId}`;
      const clusterName = nsObj.clusters?.[0]?.clusterName || "Cluster";
      const sysName = nsObj.requests?.[0]?.systemName || "Kubernetes";

      if (person.namespacesMap.has(nsKey)) {
        const existing = person.namespacesMap.get(nsKey)!;
        if (!existing.accessTypes.includes("VPN")) {
          existing.accessTypes.push("VPN");
        }
      } else {
        person.namespacesMap.set(nsKey, {
          id: nsId,
          name: nsObj.name || nsId,
          supervisorIp: nsObj.supervisorIp || "N/A",
          systemName: sysName,
          clusterName,
          accessTypes: ["VPN"],
          assignedAt: assignedAtStr,
          expiresAt: expiresAtStr,
          assignedBy: v.assignedBy?.name || "Network Admin",
          notes: v.notes || null,
        });
      }
    } else if (v.assignedVms) {
      // Legacy fallback
      const legacyTarget = String(v.assignedVms).trim();
      const existingMatch = Array.from(person.vmsMap.values()).find(item => 
        item.hostname.toLowerCase() === legacyTarget.toLowerCase() || item.id.toLowerCase() === legacyTarget.toLowerCase()
      );

      if (existingMatch) {
        if (!existingMatch.accessTypes.includes("VPN")) {
          existingMatch.accessTypes.push("VPN");
        }
      } else {
        // If requester scope is active, do not invent unverified legacy targets
        if (!isRequester) {
          const legacyKey = `vm:legacy:${legacyTarget}`;
          person.vmsMap.set(legacyKey, {
            id: legacyKey,
            hostname: legacyTarget,
            ipAddress: v.vpnIp || "N/A",
            systemName: "Legacy VPN Mapping",
            environment: "PRODUCTION",
            status: "ACTIVE",
            accessTypes: ["VPN"],
            assignedAt: assignedAtStr,
            expiresAt: expiresAtStr,
            isLegacy: true,
            assignedBy: v.assignedBy?.name || "Network Admin (Legacy)",
            notes: v.notes || null,
          });
        }
      }
    }
  }

  // 4. Assemble output
  const result: VpnHorizonUserReportItem[] = [];

  for (const person of peopleMap.values()) {
    const assignedVms = Array.from(person.vmsMap.values());
    const assignedNamespaces = Array.from(person.namespacesMap.values());

    if (isRequester && assignedVms.length === 0 && assignedNamespaces.length === 0) {
      continue;
    }

    const hasVpn = !!person.vpnAccount || assignedVms.some(v => v.accessTypes.includes("VPN")) || assignedNamespaces.some(n => n.accessTypes.includes("VPN"));
    const hasHorizon = !!person.horizonAccount || assignedVms.some(v => v.accessTypes.includes("Horizon")) || assignedNamespaces.some(n => n.accessTypes.includes("Horizon"));

    const isVpnActive = person.vpnAccount?.status === "ACTIVE";
    const isHorizonActive = person.horizonAccount?.status === "ACTIVE";
    const hasActiveAssignments = assignedVms.some(v => v.status === "ACTIVE") || assignedNamespaces.length > 0;

    const status = (isVpnActive || isHorizonActive || hasActiveAssignments) ? "ACTIVE" : "EXPIRED";
    const hasLegacy = assignedVms.some(v => v.isLegacy);

    result.push({
      id: person.id,
      personName: person.personName,
      email: person.email,
      portalUserId: person.portalUserId,
      vpnAccount: person.vpnAccount,
      horizonAccount: person.horizonAccount,
      assignedVms,
      assignedNamespaces,
      totalVmsCount: assignedVms.length,
      totalNamespacesCount: assignedNamespaces.length,
      hasVpn,
      hasHorizon,
      hasLegacy,
      status,
      lastAssignedAt: person.lastAssignedAt,
    });
  }

  return result.sort((a, b) => a.personName.localeCompare(b.personName));
}
