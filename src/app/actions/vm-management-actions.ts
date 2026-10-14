// src/app/actions/vm-management-actions.ts
"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { encrypt, decrypt, sendEmail } from "@/lib/admin/emailService";
import { ROLES, hasRole } from "@/lib/roles";
import { isAdmin } from "@/lib/utils";
import {
  normalizeSystemName,
  formatSystemName,
  resolveVmSystemName,
  getDisplaySystemName,
  systemNameFilter
} from "@/lib/system-utils";
import type { SystemFleetOverview, SystemFleetVmItem } from "@/types/requests";

export interface UserVmStats {
  totalActive: number;
  production: number;
  development: number;
  staging: number;
  withPublicIp: number;
  totalCpu?: number;
  totalRam?: number;
  totalStorage?: number;
}

export interface SystemSummary {
  systemName: string;
  totalVms: number;
  environments: Record<string, number>;
}

export interface SubdomainSummary {
  subdomain: string;
  vmCount: number;
}

export interface UserVmData {
  id: string;
  hostname: string | null;
  ipAddress: string | null;
  publicIpAddress: string | null;
  status: string;
  environment: string | null;
  subdomain: string | null;
  provisionedAt: Date | null;
  createdAt: Date;
  vcpu: number | null;
  ramGb: number | null;
  storageGb: number | null;
  systemName: string | null;
  requestEnvironment: string | null;
}

export interface PaginatedUserVms {
  vms: UserVmData[];
  total: number;
  totalPages: number;
  currentPage: number;
}

export interface VmFilters {
  environment?: string;
  systemName?: string;
  search?: string;
  status?: string;
}

export async function getUserVmStats(): Promise<UserVmStats> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;

  const [totalActive, production, development, staging, withPublicIp, activeVms] = await Promise.all([
    prisma.vmInstance.count({
      where: { ownerId: userId, status: "ACTIVE" }
    }),
    prisma.vmInstance.count({
      where: { ownerId: userId, environment: "PRODUCTION", status: "ACTIVE" }
    }),
    prisma.vmInstance.count({
      where: { ownerId: userId, environment: "DEVELOPMENT", status: "ACTIVE" }
    }),
    prisma.vmInstance.count({
      where: { ownerId: userId, environment: "STAGING", status: "ACTIVE" }
    }),
    prisma.vmInstance.count({
      where: { ownerId: userId, status: "ACTIVE", publicIpAddress: { not: null } }
    }),
    prisma.vmInstance.findMany({
      where: { ownerId: userId, status: "ACTIVE" },
      include: {
        currentSpec: {
          select: {
            vcpu: true,
            ramGb: true,
            storageGb: true
          }
        }
      }
    })
  ]);

  let totalCpu = 0;
  let totalRam = 0;
  let totalStorage = 0;

  for (const vm of activeVms) {
    totalCpu += vm.currentSpec?.vcpu || 0;
    totalRam += vm.currentSpec?.ramGb || 0;
    totalStorage += vm.currentSpec?.storageGb || 0;
  }

  return {
    totalActive,
    production,
    development,
    staging,
    withPublicIp,
    totalCpu,
    totalRam,
    totalStorage
  };
}

export async function getSystemSummary(): Promise<SystemSummary[]> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;
  const isSuperUser = hasRole(session.user.roles, ROLES.ADMIN) || hasRole(session.user.roles, ROLES.DCOPS);

  const vms = await prisma.vmInstance.findMany({
    where: isSuperUser ? {} : { ownerId: userId },
    select: {
      id: true,
      systemName: true,
      environment: true,
      request: { select: { systemName: true, environment: true } },
    },
  });

  const systemMap = new Map<string, { displayName: string; count: number; envs: Record<string, number> }>();

  for (const vm of vms) {
    const raw = resolveVmSystemName(vm);
    const normalized = normalizeSystemName(raw) || "__unassigned__";
    const displayName = raw ? formatSystemName(raw) : "Standalone / Unassigned";

    if (!systemMap.has(normalized)) {
      systemMap.set(normalized, { displayName, count: 0, envs: {} });
    }

    const entry = systemMap.get(normalized)!;
    entry.count += 1;

    const env = vm.environment || "UNKNOWN";
    entry.envs[env] = (entry.envs[env] || 0) + 1;
  }

  return Array.from(systemMap.values()).map((data) => ({
    systemName: data.displayName,
    totalVms: data.count,
    environments: data.envs,
  }));
}

export async function getSubdomainSummary(): Promise<SubdomainSummary[]> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;

  const vms = await prisma.vmInstance.findMany({
    where: { ownerId: userId, subdomain: { not: null } },
    select: { subdomain: true }
  });

  const subdomainMap = new Map<string, number>();

  for (const vm of vms) {
    const subdomain = vm.subdomain || "";
    subdomainMap.set(subdomain, (subdomainMap.get(subdomain) || 0) + 1);
  }

  return Array.from(subdomainMap.entries())
    .map(([subdomain, vmCount]: any) => ({ subdomain, vmCount }))
    .sort((a, b) => b.vmCount - a.vmCount);
}

export async function getUserVms(
  filters: VmFilters = {},
  page: number = 1,
  pageSize: number = 10
): Promise<PaginatedUserVms> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;
  const skip = (page - 1) * pageSize;

  const where: Prisma.VmInstanceWhereInput = { ownerId: userId };

  if (filters.environment && filters.environment !== "ALL") {
    where.environment = filters.environment as any;
  }

  if (filters.status && filters.status !== "ALL") {
    where.status = filters.status.toUpperCase() as any;
  }

  if (filters.search) {
    where.OR = [
      { hostname: { contains: filters.search, mode: "insensitive" } },
      { ipAddress: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  if (filters.systemName && filters.systemName !== "ALL") {
    if (filters.systemName === "Standalone / Unassigned") {
      where.AND = [
        { systemName: null },
        { request: { is: null } },
      ];
    } else {
      Object.assign(where, systemNameFilter(filters.systemName));
    }
  }

  const [vms, total] = await Promise.all([
    prisma.vmInstance.findMany({
      where,
      include: {
        currentSpec: true,
        request: { select: { systemName: true, environment: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.vmInstance.count({ where }),
  ]);

  const mappedVms: UserVmData[] = vms.map((vm: any) => ({
    id: vm.id,
    hostname: vm.hostname,
    ipAddress: vm.ipAddress,
    publicIpAddress: vm.publicIpAddress,
    status: vm.status,
    environment: vm.environment,
    subdomain: vm.subdomain,
    provisionedAt: vm.provisionedAt,
    createdAt: vm.createdAt,
    vcpu: vm.currentSpec?.vcpu ?? null,
    ramGb: vm.currentSpec?.ramGb ?? null,
    storageGb: vm.currentSpec?.storageGb ?? null,
    systemName: getDisplaySystemName(vm),
    requestEnvironment: vm.request?.environment ?? null,
  }));

  return {
    vms: mappedVms,
    total,
    totalPages: Math.ceil(total / pageSize),
    currentPage: page,
  };
}

export interface VmDetailsData {
  id: string;
  hostname: string | null;
  ipAddress: string | null;
  publicIpAddress: string | null;
  subdomain: string | null;
  status: string;
  environment: string | null;
  provisionedAt: Date | null;
  vpnRequired: boolean;
  createdAt: Date;
  owner: { id: string; name: string | null; email: string } | null;
  currentSpec: {
    vcpu: number | null;
    ramGb: number | null;
    storageGb: number | null;
    osName: string | null;
    osVersion: string | null;
    additionalDisks: { id: string; sizeGb: number; purpose: string | null; sequence: number }[];
    firewallPorts: { id: string; port: number; protocol: string; purpose: string; source: string | null }[];
    networkAccess: { id: string; accessType: string }[];
  } | null;
  request: {
    id: string;
    systemName: string;
    environment: string;
    requester: { id: string; name: string | null };
    provisionedAt: Date | null;
  } | null;
  customizationHistory: {
    id: string;
    createdAt: Date;
    reason: string | null;
    appliedBy: { id: string; name: string | null } | null;
    beforeSpec: { vcpu: number; ramGb: number; storageGb: number } | null;
    afterSpec: { vcpu: number; ramGb: number; storageGb: number } | null;
  }[];
}

export async function getVmDetails(vmId: string): Promise<VmDetailsData | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const vm = await prisma.vmInstance.findUnique({
    where: { id: vmId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      request: {
        select: {
          id: true,
          systemName: true,
          environment: true,
          requester: { select: { id: true, name: true } },
          provisionedAt: true,
        },
      },
      currentSpec: {
        include: {
          additionalDisks: { orderBy: { sequence: "asc" } },
          firewallPorts: true,
          networkAccess: true,
        },
      },
      customizationHistory: {
        orderBy: { createdAt: "desc" },
        include: {
          appliedBy: { select: { id: true, name: true } },
          beforeSpec: true,
          afterSpec: true,
        },
      },
    },
  });

  if (!vm) return null;

  return {
    id: vm.id,
    hostname: vm.hostname,
    ipAddress: vm.ipAddress,
    publicIpAddress: vm.publicIpAddress,
    subdomain: vm.subdomain,
    status: vm.status,
    environment: vm.environment,
    provisionedAt: vm.provisionedAt,
    vpnRequired: vm.vpnRequired,
    createdAt: vm.createdAt,
    owner: vm.owner,
    currentSpec: vm.currentSpec
      ? {
          vcpu: vm.currentSpec.vcpu,
          ramGb: vm.currentSpec.ramGb,
          storageGb: vm.currentSpec.storageGb,
          osName: vm.currentSpec.osName,
          osVersion: vm.currentSpec.osVersion,
          additionalDisks: vm.currentSpec.additionalDisks.map((d: any) => ({
            id: d.id,
            sizeGb: d.sizeGb,
            purpose: d.purpose,
            sequence: d.sequence,
          })),
          firewallPorts: vm.currentSpec.firewallPorts.map((f: any) => ({
            id: f.id,
            port: f.port,
            protocol: f.protocol,
            purpose: f.purpose,
            source: f.source,
          })),
          networkAccess: vm.currentSpec.networkAccess.map((n: any) => ({
            id: n.id,
            accessType: n.accessType,
          })),
        }
      : null,
    request: vm.request,
    customizationHistory: vm.customizationHistory.map((h: any) => ({
      id: h.id,
      createdAt: h.createdAt,
      reason: h.reason,
      appliedBy: h.appliedBy,
      beforeSpec: h.beforeSpec
        ? { vcpu: h.beforeSpec.vcpu, ramGb: h.beforeSpec.ramGb, storageGb: h.beforeSpec.storageGb }
        : null,
      afterSpec: h.afterSpec
        ? { vcpu: h.afterSpec.vcpu, ramGb: h.afterSpec.ramGb, storageGb: h.afterSpec.storageGb }
        : null,
    })),
  };
}

export async function reassignVmSystem(vmId: string, targetSystemName: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");

    const userId = session.user.id;
    const isAdminUser = hasRole(session.user.roles, ROLES.ADMIN);

    const vm = await prisma.vmInstance.findUnique({
      where: { id: vmId },
    });

    if (!vm) throw new Error("VM not found");

    if (!isAdminUser && vm.ownerId !== userId) {
      throw new Error("You do not have permission to reassign this VM");
    }

    const cleanName = formatSystemName(targetSystemName);

    // If user is not admin, verify they already own VMs in this system OR it's a new system
    if (!isAdminUser && cleanName) {
      const existingSystemVms = await prisma.vmInstance.findMany({
        where: systemNameFilter(cleanName),
        select: { ownerId: true },
        take: 5,
      });
      const belongsToOthers = existingSystemVms.length > 0 && existingSystemVms.every((v) => v.ownerId !== userId);
      if (belongsToOthers) {
        throw new Error("Cannot reassign VM to a system owned by another user or team");
      }
    }

    const updated = await prisma.$transaction(async (tx: any) => {
      const res = await tx.vmInstance.update({
        where: { id: vmId },
        data: { systemName: cleanName || null },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: "REASSIGN_VM_SYSTEM",
          entityType: "VM",
          entityId: vmId,
          details: JSON.stringify({
            oldName: vm.systemName,
            newName: cleanName,
          }),
        },
      });

      return res;
    });

    revalidatePath(`/inventory/vms`);
    revalidatePath(`/inventory/vms/${vmId}`);
    revalidatePath(`/my-vms`);
    return { success: true, data: updated };
  } catch (error) {
    console.error("Error reassigning VM system:", error);
    throw error;
  }
}

export async function renameEntireSystem(oldSystemName: string, newSystemName: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");

    const userId = session.user.id;
    const isAdminUser = hasRole(session.user.roles, ROLES.ADMIN);

    const cleanOld = formatSystemName(oldSystemName);
    const cleanNew = formatSystemName(newSystemName);
    if (!cleanOld || !cleanNew) throw new Error("Both old and new system names are required");

    const vmsInSystem = await prisma.vmInstance.findMany({
      where: systemNameFilter(cleanOld),
      select: { id: true, ownerId: true },
    });

    if (vmsInSystem.length === 0) throw new Error("No VMs found in this system");

    if (!isAdminUser) {
      const hasOtherOwners = vmsInSystem.some((v) => v.ownerId !== userId);
      if (hasOtherOwners) {
        throw new Error("Only an administrator can rename a shared or multi-owner system");
      }
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.vmInstance.updateMany({
        where: systemNameFilter(cleanOld),
        data: { systemName: cleanNew },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: "RENAME_ENTIRE_SYSTEM",
          entityType: "SYSTEM",
          entityId: cleanOld,
          details: JSON.stringify({
            oldName: cleanOld,
            newName: cleanNew,
            affectedVmCount: vmsInSystem.length,
          }),
        },
      });
    });

    revalidatePath(`/inventory/vms`);
    revalidatePath(`/my-vms`);
    return { success: true, affectedCount: vmsInSystem.length };
  } catch (error) {
    console.error("Error renaming system:", error);
    throw error;
  }
}

export async function getUserExistingSystems(options?: {
  userId?: string;
  userOnly?: boolean;
}): Promise<{
  systemName: string;
  activeVmCount: number;
  vcpu: number;
  ramGb: number;
  storageGb: number;
  hostnames: string[];
}[]> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const targetUserId = options?.userId?.trim() || session.user.id;
  // If userOnly is requested, strictly filter by that specific user, regardless of roles
  const isSuperUser = (hasRole(session.user.roles, ROLES.ADMIN) || hasRole(session.user.roles, ROLES.DCOPS)) && !options?.userOnly;

  const vms = await prisma.vmInstance.findMany({
    where: {
      ...(isSuperUser ? {} : { ownerId: targetUserId }),
      status: "ACTIVE",
    },
    include: {
      currentSpec: true,
      request: { select: { systemName: true } },
    },
  });

  const systemsMap = new Map<string, {
    systemName: string;
    activeVmCount: number;
    vcpu: number;
    ramGb: number;
    storageGb: number;
    hostnames: string[];
  }>();

  for (const vm of vms) {
    const raw = resolveVmSystemName(vm);
    if (!raw) continue;
    const normalized = normalizeSystemName(raw);
    const displayName = formatSystemName(raw);

    if (!systemsMap.has(normalized)) {
      systemsMap.set(normalized, {
        systemName: displayName,
        activeVmCount: 0,
        vcpu: 0,
        ramGb: 0,
        storageGb: 0,
        hostnames: [],
      });
    }

    const entry = systemsMap.get(normalized)!;
    entry.activeVmCount += 1;
    entry.vcpu += vm.currentSpec?.vcpu || 0;
    entry.ramGb += vm.currentSpec?.ramGb || 0;
    entry.storageGb += vm.currentSpec?.storageGb || 0;
    if (vm.hostname && entry.hostnames.length < 5) {
      entry.hostnames.push(vm.hostname);
    }
  }

  // Also include systems previously requested by this user
  if (!isSuperUser || options?.userOnly) {
    const userRequests = await prisma.request.findMany({
      where: {
        requesterId: targetUserId,
        status: { not: "REJECTED" },
      },
      select: {
        systemName: true,
      },
    });

    for (const req of userRequests) {
      if (!req.systemName || !req.systemName.trim()) continue;
      const normalized = normalizeSystemName(req.systemName);
      const displayName = formatSystemName(req.systemName);

      if (!systemsMap.has(normalized)) {
        systemsMap.set(normalized, {
          systemName: displayName,
          activeVmCount: 0,
          vcpu: 0,
          ramGb: 0,
          storageGb: 0,
          hostnames: [],
        });
      }
    }
  }

  return Array.from(systemsMap.values()).sort((a, b) => b.activeVmCount - a.activeVmCount || a.systemName.localeCompare(b.systemName));
}

export async function getSystemFleetForRequest(
  systemName: string,
  currentRequestId?: string
): Promise<SystemFleetOverview | null> {
  if (!systemName || !systemName.trim()) return null;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const cleanSystem = formatSystemName(systemName);

  const vms = await prisma.vmInstance.findMany({
    where: systemNameFilter(cleanSystem),
    include: {
      currentSpec: true,
      owner: { select: { id: true, name: true, email: true } },
      request: { select: { id: true, requestId: true, environment: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  let totalVcpu = 0;
  let totalRamGb = 0;
  let totalStorageGb = 0;
  let activeVms = 0;

  const fleetVms: SystemFleetVmItem[] = vms.map((vm: any) => {
    const isActive = vm.status === "ACTIVE";
    if (isActive) {
      activeVms += 1;
      totalVcpu += vm.currentSpec?.vcpu || 0;
      totalRamGb += vm.currentSpec?.ramGb || 0;
      totalStorageGb += vm.currentSpec?.storageGb || 0;
    }

    const reqNum = vm.request?.requestId
      ? `REQ-${vm.request.requestId.slice(0, 8)}`
      : vm.requestId
      ? `REQ-${vm.requestId.slice(0, 8)}`
      : null;

    return {
      id: vm.id,
      hostname: vm.hostname,
      ipAddress: vm.ipAddress,
      status: vm.status,
      environment: vm.environment || vm.request?.environment || "PRODUCTION",
      vcpu: vm.currentSpec?.vcpu ?? null,
      ramGb: vm.currentSpec?.ramGb ?? null,
      storageGb: vm.currentSpec?.storageGb ?? null,
      isCurrentRequest: !!currentRequestId && vm.requestId === currentRequestId,
      requestId: vm.requestId,
      requestNumber: reqNum,
      ownerName: vm.owner?.name ?? null,
    };
  });

  return {
    systemName: cleanSystem,
    totalVms: vms.length,
    activeVms,
    totalVcpu,
    totalRamGb,
    totalStorageGb,
    vms: fleetVms,
  };
}

// Backward compatibility alias
export async function updateVmSystemName(vmId: string, newName: string) {
  return reassignVmSystem(vmId, newName);
}

export async function getVmCredentials(vmId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");

    const userId = session.user.id;
    const isAdmin = hasRole(session.user.roles, ROLES.ADMIN);

    const vm = await prisma.vmInstance.findUnique({
      where: { id: vmId },
      include: { credential: true },
    });

    if (!vm) throw new Error("VM not found");

    if (!isAdmin && vm.ownerId !== userId) {
      throw new Error("You do not have permission to view credentials for this VM");
    }

    if (!vm.credential) {
      return null;
    }

    await prisma.credentialAccessLog.create({
      data: {
        actorId: userId,
        vmInstanceId: vmId,
        action: "VIEW",
      },
    });

    return {
      username: vm.credential.username,
      password: decrypt(vm.credential.password),
    };
  } catch (error) {
    console.error("Error fetching credentials:", error);
    throw error;
  }
}

export async function saveVmCredentials(vmId: string, username: string, plainTextPass: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");

    const userId = session.user.id;
    const isAdmin = hasRole(session.user.roles, ROLES.ADMIN);
    const isDcops = hasRole(session.user.roles, ROLES.DCOPS);

    if (!isAdmin && !isDcops) {
      throw new Error("Only DCOPS or Admins can save VM credentials");
    }

    const encryptedPassword = encrypt(plainTextPass);

    const credential = await prisma.vmCredential.upsert({
      where: { vmInstanceId: vmId },
      update: {
        username,
        password: encryptedPassword,
      },
      create: {
        vmInstanceId: vmId,
        username,
        password: encryptedPassword,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "SAVE_VM_CREDENTIALS",
        entityType: "VM",
        entityId: vmId,
      },
    });

    revalidatePath(`/inventory/vms/${vmId}`);
    return { success: true, credential };
  } catch (error) {
    console.error("Error saving credentials:", error);
    throw error;
  }
}

export async function sendCredentialsEmail(vmId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");

    const userId = session.user.id;
    const isAdmin = hasRole(session.user.roles, ROLES.ADMIN);

    const vm = await prisma.vmInstance.findUnique({
      where: { id: vmId },
      include: { credential: true, owner: true },
    });

    if (!vm) throw new Error("VM not found");

    if (!isAdmin && vm.ownerId !== userId) {
      throw new Error("You do not have permission to send credentials for this VM");
    }

    if (!vm.credential) {
      throw new Error("No credentials saved for this VM");
    }

    const ownerEmail = vm.owner?.email;
    if (!ownerEmail) {
      throw new Error("VM owner has no registered email");
    }

    const plainPassword = decrypt(vm.credential.password);
    const subject = `VM Login Credentials: ${vm.hostname || vm.systemName || "Virtual Machine"}`;
    const html = `
      <h2>VM Management System - VM Login Credentials</h2>
      <p>Hello ${vm.owner?.name || "User"},</p>
      <p>Here are the login credentials requested for your VM:</p>
      <ul>
        <li>Hostname: <strong>${vm.hostname || "N/A"}</strong></li>
        <li>IP Address: <strong>${vm.ipAddress || "N/A"}</strong></li>
        <li>Username: <strong>${vm.credential.username}</strong></li>
        <li>Password: <strong>${plainPassword}</strong></li>
      </ul>
      <p>Please login and change your password immediately.</p>
    `;

    const success = await sendEmail(ownerEmail, subject, html);

    if (success) {
      await prisma.credentialAccessLog.create({
        data: {
          actorId: userId,
          vmInstanceId: vmId,
          action: "EMAIL",
        },
      });
    }

    return { success };
  } catch (error) {
    console.error("Error sending credentials email:", error);
    throw error;
  }
}

/**
 * Transfer ownership of a VM to another user or unassign.
 * Accessible to Administrators/DC_OPS or current VM owner.
 */
export async function transferOwnership(vmId: string, newOwnerId: string | null) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const userRoles = session.user.roles || [];
  const isManagement = isAdmin(userRoles);

  const vm = await prisma.vmInstance.findUnique({
    where: { id: vmId },
    include: { owner: true }
  });

  if (!vm) {
    throw new Error("VM not found");
  }

  if (!isManagement && vm.ownerId !== session.user.id) {
    throw new Error("Unauthorized to transfer ownership of this VM");
  }

  const effectiveOwnerId = (!newOwnerId || newOwnerId === "unassigned" || newOwnerId.trim() === "") ? null : newOwnerId;

  if (effectiveOwnerId) {
    const targetUser = await prisma.user.findUnique({
      where: { id: effectiveOwnerId }
    });
    if (!targetUser) {
      throw new Error("Target owner user not found");
    }
  }

  const updatedVm = await prisma.$transaction(async (tx: any) => {
    const updated = await tx.vmInstance.update({
      where: { id: vmId },
      data: { ownerId: effectiveOwnerId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        currentSpec: true,
      }
    });

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "VM_UPDATED",
        entityType: "VmInstance",
        entityId: vmId,
        details: JSON.stringify({
          action: "TRANSFER_OWNERSHIP",
          oldOwnerId: vm.ownerId,
          newOwnerId: effectiveOwnerId,
        }),
        vmId: vmId,
      }
    });

    return updated;
  });

  revalidatePath("/inventory/vms");
  revalidatePath(`/inventory/vms/${vmId}`);
  revalidatePath("/inventory");
  revalidatePath("/requests");

  return { success: true, vm: updatedVm };
}

export interface SystemFleetSummaryRow {
  systemName: string;
  isStandalone: boolean;
  owners: { id?: string; name: string; email: string }[];
  activeVmCount: number;
  suspendedVmCount: number;
  retiredVmCount: number;
  totalVmCount: number;
  totalVcpu: number;
  totalRamGb: number;
  totalStorageGb: number;
  environments: string[];
  hostnames: string[];
}

/**
 * Aggregates all VMs into System Fleets with owners, statuses, and resource footprints.
 */
export async function getSystemFleetSummaries(): Promise<SystemFleetSummaryRow[]> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const isMgmt = isAdmin(session.user.roles);

  const vms = await prisma.vmInstance.findMany({
    where: isMgmt ? {} : { ownerId: session.user.id },
    include: {
      currentSpec: true,
      owner: { select: { id: true, name: true, email: true } },
      request: { select: { systemName: true, environment: true } },
    },
  });

  const map = new Map<string, SystemFleetSummaryRow>();

  for (const vm of vms) {
    const raw = resolveVmSystemName(vm);
    const isStandalone = !raw || !raw.trim();
    const key = isStandalone ? "__STANDALONE__" : normalizeSystemName(raw);
    const displayName = isStandalone ? "Standalone / Unassigned" : formatSystemName(raw);

    if (!map.has(key)) {
      map.set(key, {
        systemName: displayName,
        isStandalone,
        owners: [],
        activeVmCount: 0,
        suspendedVmCount: 0,
        retiredVmCount: 0,
        totalVmCount: 0,
        totalVcpu: 0,
        totalRamGb: 0,
        totalStorageGb: 0,
        environments: [],
        hostnames: [],
      });
    }

    const entry = map.get(key)!;
    entry.totalVmCount += 1;

    if (vm.status === "ACTIVE") {
      entry.activeVmCount += 1;
      entry.totalVcpu += vm.currentSpec?.vcpu || 0;
      entry.totalRamGb += vm.currentSpec?.ramGb || 0;
      entry.totalStorageGb += vm.currentSpec?.storageGb || 0;
    } else if (vm.status === "SUSPENDED") {
      entry.suspendedVmCount += 1;
    } else if (vm.status === "RETIRED") {
      entry.retiredVmCount += 1;
    }

    if (vm.hostname && !entry.hostnames.includes(vm.hostname)) {
      entry.hostnames.push(vm.hostname);
    }

    const env = vm.environment || vm.request?.environment;
    if (env && !entry.environments.includes(String(env))) {
      entry.environments.push(String(env));
    }

    if (vm.owner && !entry.owners.some(o => o.email === vm.owner!.email)) {
      entry.owners.push({
        id: vm.owner.id,
        name: vm.owner.name || vm.owner.email,
        email: vm.owner.email,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.isStandalone && !b.isStandalone) return 1;
    if (!a.isStandalone && b.isStandalone) return -1;
    if (b.activeVmCount !== a.activeVmCount) return b.activeVmCount - a.activeVmCount;
    return a.systemName.localeCompare(b.systemName);
  });
}

