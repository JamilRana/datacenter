// src/app/actions/inventory-actions.ts
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { 
  AssetType as PrismaAssetType, 
  VmStatus as PrismaVmStatus,
} from "@prisma/client";

import { isAdmin } from "@/lib/utils"; // ✅ Critical helpers

/**
 * Aggregates physical capacity vs logical VM allocations.
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

  // ✅ FIXED: Use proper role helper instead of broken ROLES enum
  if (!isAdmin(session.user.roles)) {
    // Requesters cannot see infrastructure metrics
    return null;
  }

  // 1. Aggregate Physical Capacity (SERVER assets only)
  const physicalServers = await prisma.asset.findMany({
    where: { type: PrismaAssetType.SERVER },
    select: {
      cpuCores: true,
      ramGb: true,
      storageGb: true
    }
  });

  const physical = {
    cpu: physicalServers.reduce((sum: number, s: any) => sum + (s.cpuCores || 0), 0),
    ram: physicalServers.reduce((sum: number, s: any) => sum + (s.ramGb || 0), 0),
    storage: physicalServers.reduce((sum: number, s: any) => sum + (s.storageGb || 0), 0),
    serverCount: physicalServers.length
  };

  // 2. Aggregate Allocated Capacity (ACTIVE VMs only)
  const activeVms = await prisma.vmInstance.findMany({
    where: { status: PrismaVmStatus.ACTIVE },
    include: {
      currentSpec: {
        select: { vcpu: true, ramGb: true, storageGb: true }
      }
    }
  });

  const allocated = {
    cpu: activeVms.reduce((sum: number, v: any) => sum + (v.currentSpec?.vcpu || 0), 0),
    ram: activeVms.reduce((sum: number, v: any) => sum + (v.currentSpec?.ramGb || 0), 0),
    storage: activeVms.reduce((sum: number, v: any) => sum + (v.currentSpec?.storageGb || 0), 0),
    vmCount: activeVms.length
  };

  return {
    physical,
    allocated,
    available: {
      cpu: Math.max(0, physical.cpu - allocated.cpu),
      ram: Math.max(0, physical.ram - allocated.ram),
      storage: Math.max(0, physical.storage - allocated.storage)
    },
    timestamp: new Date().toISOString()
  };
}

export async function getK8sNamespacesInventory(params: {
  page?: number;
  pageSize?: number;
  searchTerm?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const { page = 1, pageSize = 10, searchTerm = "" } = params;
  const skip = (page - 1) * pageSize;

  const userRoles = session.user.roles || [];
  const isAdminOrDCOps = userRoles.includes("ADMIN") || userRoles.includes("DC_OPS");

  const whereClause: any = {
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
      searchTerm ? {
        OR: [
          { name: { contains: searchTerm, mode: "insensitive" } },
          { supervisorIp: { contains: searchTerm, mode: "insensitive" } }
        ]
      } : {}
    ]
  };

  const [namespaces, total] = await Promise.all([
    prisma.k8sNamespace.findMany({
      where: whereClause,
      include: {
        subdomains: {
          include: {
            requestedBy: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            approvedBy: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: { createdAt: "desc" }
        },
        clusters: {
          include: {
            request: {
              select: {
                projectName: true,
                systemName: true,
                requester: {
                  select: {
                    name: true,
                    email: true
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
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize
    }),
    prisma.k8sNamespace.count({ where: whereClause })
  ]);

  return { namespaces, total, page, pageSize };
}

