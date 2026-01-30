// src/app/actions/inventory-actions.ts
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { ROLES } from "@/lib/roles";
import { AssetType, VmStatus } from "@prisma/client";
import { PhysicalAsset, EnrollmentLicense, VmInstance } from "@/types/inventory";
import { NextResponse } from "next/server";

/**
 * Aggregates physical capacity vs logical VM allocations.
 * Authoritative source for the Inventory Dashboard.
 */
export interface InventoryMetrics {
  physical: { cpu: number; ram: number; storage: number; serverCount: number };
  allocated: { cpu: number; ram: number; storage: number; vmCount: number };
  available: { cpu: number; ram: number; storage: number };
  timestamp: string;
}

export async function getInventoryMetrics(): Promise<InventoryMetrics | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const userRoles = session.user.roles;
  const isAdminOrOps = userRoles.includes(ROLES.ADMIN) || userRoles.includes(ROLES.DCOPS);

  // Requesters are not allowed to see overall physical infrastructure capacity
  if (!isAdminOrOps && !userRoles.includes("APPROVER_L1") && !userRoles.includes("APPROVER_L2") && !userRoles.includes("APPROVER_L3")) {
     // For reuqesters, we might just return their own VM stats instead of the whole datacenter
     // But for now, we'll return null or empty to enforce security boundaries
     return null; 
  }

  // 1. Aggregrate Physical Capacity (from Assets of type SERVER)
  const physicalServers = await prisma.asset.findMany({
    where: { type: AssetType.SERVER },
    select: {
      cpuCores: true,
      ramGb: true,
      storageGb: true
    }
  });

  const physical = {
    cpu: physicalServers.reduce((sum, s) => sum + (s.cpuCores || 0), 0),
    ram: physicalServers.reduce((sum, s) => sum + (s.ramGb || 0), 0),
    storage: physicalServers.reduce((sum, s) => sum + (s.storageGb || 0), 0),
    serverCount: physicalServers.length
  };

  // 2. Aggregate Allocated Capacity (from active VmInstances + current specs)
  const activeVmsWithSpecs = await prisma.vmInstance.findMany({
    where: { status: VmStatus.ACTIVE },
    include: {
      currentSpec: {
        select: {
          vcpu: true,
          ramGb: true,
          storageGb: true
        }
      }
    }
  });

  const allocated = {
    cpu: activeVmsWithSpecs.reduce((sum, v) => sum + (v.currentSpec?.vcpu || 0), 0),
    ram: activeVmsWithSpecs.reduce((sum, v) => sum + (v.currentSpec?.ramGb || 0), 0),
    storage: activeVmsWithSpecs.reduce((sum, v) => sum + (v.currentSpec?.storageGb || 0), 0),
    vmCount: activeVmsWithSpecs.length
  };

  // 3. Derive Available Capacity
  const available = {
    cpu: Math.max(0, physical.cpu - allocated.cpu),
    ram: Math.max(0, physical.ram - allocated.ram),
    storage: Math.max(0, physical.storage - allocated.storage)
  };

  return {
    physical,
    allocated,
    available,
    timestamp: new Date().toISOString()
  };
}

/**
 * Fetches all physical assets with RBAC.
 */
export async function getAssets(filters?: { type?: AssetType }): Promise<PhysicalAsset[]> {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const userRoles = session.user.roles;
  const canView = userRoles.includes(ROLES.ADMIN) || userRoles.includes(ROLES.DCOPS) || userRoles.some(r => r.startsWith("APPROVER"));

  if (!canView) {
     throw new Error("Forbidden: Assets are restricted to infrastructure roles.");
  }

  const assets = await prisma.asset.findMany({
    where: filters?.type ? { type: filters.type } : {},
    include: {
      licenses: true
    },
    orderBy: { createdAt: "desc" }
  });

  return assets;
}

export async function getVmById(id: string): Promise<VmInstance | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const userRoles = session.user.roles;
  const canView = userRoles.includes(ROLES.ADMIN) || userRoles.includes(ROLES.DCOPS) || userRoles.some(r => r.startsWith("APPROVER"));

  if (!canView) {
     throw new Error("Forbidden: Assets are restricted to infrastructure roles.");
  }

  const vm = await prisma.vmInstance.findUnique({
    where: { id: id },
    include: {
      owner: true,
      currentSpec: true,
      specHistory: { orderBy: { createdAt: "desc" } },
      request: true,
      customizationHistory: { orderBy: { createdAt: "desc" } },
      auditLogs: { orderBy: { timestamp: "desc" }, take: 10 }
    }
  });

  return vm;
}

/**
 * Fetches software licenses with expiration status.
 */
export async function getLicenses(): Promise<EnrollmentLicense[]> {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const userRoles = session.user.roles;
  const canView = userRoles.includes(ROLES.ADMIN) || userRoles.includes(ROLES.DCOPS) || userRoles.some(r => r.startsWith("APPROVER"));

  if (!canView) {
     throw new Error("Forbidden: Licenses are restricted to infrastructure roles.");
  }

  const licenses = await prisma.softwareLicense.findMany({
    include: {
      assets: { select: { id: true, name: true, type: true, serial: true } }
    },
    orderBy: { expiryDate: "asc" }
  });

  return licenses;
}


export async function getLicenseById(id: string): Promise<EnrollmentLicense | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const userRoles = session.user.roles;
  const canView = userRoles.includes(ROLES.ADMIN) || userRoles.includes(ROLES.DCOPS) || userRoles.some(r => r.startsWith("APPROVER"));

  if (!canView) {
     throw new Error("Forbidden: Licenses are restricted to infrastructure roles.");
  }
try{
  const license = await prisma.softwareLicense.findUnique({
    where: { id: id },
    include: {
      assets: { select: { id: true, name: true, type: true, serial: true } }
    }
  });

  return license;
} catch (error) {
  console.error("GET /api/inventory", error);
  return null;
}
}