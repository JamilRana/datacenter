// src/app/actions/vm-management-actions.ts
"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { encrypt, decrypt, sendEmail } from "@/lib/admin/emailService";
import { ROLES, hasRole } from "@/lib/roles";

export interface UserVmStats {
  totalActive: number;
  production: number;
  development: number;
  staging: number;
  withPublicIp: number;
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
}

export async function getUserVmStats(): Promise<UserVmStats> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;

  const [totalActive, production, development, staging, withPublicIp] = await Promise.all([
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
  ]);

  return {
    totalActive,
    production,
    development,
    staging,
    withPublicIp,
  };
}

export async function getSystemSummary(): Promise<SystemSummary[]> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;

  const vms = await prisma.vmInstance.findMany({
    where: { ownerId: userId },
    include: {
      request: { select: { systemName: true, environment: true } },
      currentSpec: false
    }
  });

  const systemMap = new Map<string, { count: number; envs: Record<string, number> }>();

  for (const vm of vms) {
    const systemName = vm.request?.systemName || "Unknown System";
    
    if (!systemMap.has(systemName)) {
      systemMap.set(systemName, { count: 0, envs: {} });
    }
    
    const entry = systemMap.get(systemName)!;
    entry.count += 1;
    
    const env = vm.environment || "UNKNOWN";
    entry.envs[env] = (entry.envs[env] || 0) + 1;
  }

  return Array.from(systemMap.entries()).map(([systemName, data]: any) => ({
    systemName,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where.environment = filters.environment as any;
  }

  if (filters.search) {
    where.OR = [
      { hostname: { contains: filters.search, mode: "insensitive" } },
      { ipAddress: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  if (filters.systemName && filters.systemName !== "ALL") {
    where.request = { systemName: { contains: filters.systemName, mode: "insensitive" } };
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
    systemName: vm.request?.systemName ?? null,
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

export async function updateVmSystemName(vmId: string, newName: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");

    const userId = session.user.id;
    const isAdmin = hasRole(session.user.roles, ROLES.ADMIN);

    const vm = await prisma.vmInstance.findUnique({
      where: { id: vmId },
    });

    if (!vm) throw new Error("VM not found");

    if (!isAdmin && vm.ownerId !== userId) {
      throw new Error("You do not have permission to rename this VM");
    }

    const updated = await prisma.$transaction(async (tx: any) => {
      const res = await tx.vmInstance.update({
        where: { id: vmId },
        data: { systemName: newName },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: "RENAME_VM",
          entityType: "VM",
          entityId: vmId,
          details: JSON.stringify({
            oldName: vm.systemName,
            newName,
          }),
        },
      });

      return res;
    });

    revalidatePath(`/inventory/vms`);
    revalidatePath(`/inventory/vms/${vmId}`);
    return { success: true, data: updated };
  } catch (error) {
    console.error("Error renaming VM:", error);
    throw error;
  }
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
