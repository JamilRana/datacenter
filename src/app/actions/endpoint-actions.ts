// src/app/actions/endpoint-actions.ts
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { revalidatePath } from "next/cache";

// -------------------------------------------------------------
// Horizon assignments CRUD (operates on HorizonUser)
// -------------------------------------------------------------

export async function fetchHorizonAssignments(page: number = 1, pageSize: number = 10, search: string = "") {
  const skip = (page - 1) * pageSize;
  const where: any = {};
  if (search) {
    where.OR = [
      { username: { contains: search, mode: "insensitive" } },
      { fullName: { contains: search, mode: "insensitive" } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.horizonUser.findMany({
      where,
      include: {
        assignments: {
          include: {
            vm: {
              select: {
                id: true,
                hostname: true,
                ipAddress: true,
              }
            },
            namespace: {
              select: {
                id: true,
                name: true,
                supervisorIp: true,
              }
            },
            assignedBy: {
              select: {
                name: true,
                designation: true,
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.horizonUser.count({ where }),
  ]);

  return { data, total, page, pageSize };
}

export async function createHorizonAssignment(payload: {
  username: string;
  fullName: string;
  email?: string;
  status: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  // Check unique username
  const existing = await prisma.horizonUser.findUnique({
    where: { username: payload.username }
  });
  if (existing) {
    throw new Error(`The Horizon username "${payload.username}" already exists.`);
  }

  const res = await prisma.horizonUser.create({
    data: {
      username: payload.username,
      fullName: payload.fullName,
      email: payload.email || null,
      status: payload.status,
    },
  });

  revalidatePath("/inventory/horizon");
  return res;
}

export async function updateHorizonAssignment(id: string, payload: {
  username: string;
  fullName: string;
  email?: string;
  status: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const existing = await prisma.horizonUser.findFirst({
    where: {
      username: payload.username,
      id: { not: id }
    }
  });
  if (existing) {
    throw new Error(`The Horizon username "${payload.username}" already exists.`);
  }

  const res = await prisma.horizonUser.update({
    where: { id },
    data: {
      username: payload.username,
      fullName: payload.fullName,
      email: payload.email || null,
      status: payload.status,
    },
  });

  revalidatePath("/inventory/horizon");
  return res;
}

export async function deleteHorizonAssignment(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  // Deleting user will cascade delete assignments due to db referential actions
  await prisma.horizonUser.delete({
    where: { id },
  });

  revalidatePath("/inventory/horizon");
  return { success: true };
}

export async function addHorizonAssignment(payload: {
  horizonUserId: string;
  vmId?: string;
  namespaceId?: string;
  assignedIp?: string;
  notes?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  if (!payload.vmId && !payload.namespaceId) {
    throw new Error("Please select a Virtual Machine or a K8s Namespace to assign.");
  }

  // Duplicate check
  const duplicate = await prisma.horizonAssignment.findFirst({
    where: {
      horizonUserId: payload.horizonUserId,
      vmId: payload.vmId || null,
      namespaceId: payload.namespaceId || null,
    }
  });
  if (duplicate) {
    throw new Error("This resource is already assigned to this user.");
  }

  // Duplicate IP check
  if (payload.assignedIp) {
    const duplicateIp = await prisma.horizonAssignment.findFirst({
      where: { assignedIp: payload.assignedIp }
    });
    if (duplicateIp) {
      throw new Error(`The IP address ${payload.assignedIp} is already assigned.`);
    }
  }

  const res = await prisma.horizonAssignment.create({
    data: {
      horizonUserId: payload.horizonUserId,
      vmId: payload.vmId || null,
      namespaceId: payload.namespaceId || null,
      assignedIp: payload.assignedIp || null,
      assignedById: session.user.id,
      notes: payload.notes || null,
      status: "ACTIVE",
    }
  });

  revalidatePath("/inventory/horizon");
  return res;
}

export async function removeHorizonAssignment(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  await prisma.horizonAssignment.delete({
    where: { id }
  });

  revalidatePath("/inventory/horizon");
  return { success: true };
}

// -------------------------------------------------------------
// VPN assignments CRUD (operates on VpnUser)
// -------------------------------------------------------------

export async function fetchVpnAssignments(page: number = 1, pageSize: number = 10, search: string = "") {
  const skip = (page - 1) * pageSize;
  const where: any = {};
  if (search) {
    where.OR = [
      { username: { contains: search, mode: "insensitive" } },
      { fullName: { contains: search, mode: "insensitive" } },
      { vpnIp: { contains: search, mode: "insensitive" } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.vpnUser.findMany({
      where,
      include: {
        assignments: {
          include: {
            vm: {
              select: {
                id: true,
                hostname: true,
                ipAddress: true,
              }
            },
            namespace: {
              select: {
                id: true,
                name: true,
                supervisorIp: true,
              }
            },
            assignedBy: {
              select: {
                name: true,
                designation: true,
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.vpnUser.count({ where }),
  ]);

  return { data, total, page, pageSize };
}

export async function createVpnAssignment(payload: {
  username: string;
  fullName: string;
  vpnProfile: string;
  vpnIp: string;
  status: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  // Duplicate username check
  const existingName = await prisma.vpnUser.findUnique({
    where: { username: payload.username }
  });
  if (existingName) {
    throw new Error(`The VPN username "${payload.username}" already exists.`);
  }

  // Duplicate IP check
  const duplicate = await prisma.vpnUser.findUnique({
    where: { vpnIp: payload.vpnIp },
  });
  if (duplicate) {
    throw new Error(`The VPN IP address ${payload.vpnIp} is already assigned.`);
  }

  const res = await prisma.vpnUser.create({
    data: {
      username: payload.username,
      fullName: payload.fullName,
      vpnProfile: payload.vpnProfile,
      vpnIp: payload.vpnIp,
      status: payload.status,
    },
  });

  revalidatePath("/inventory/vpn");
  return res;
}

export async function updateVpnAssignment(id: string, payload: {
  username: string;
  fullName: string;
  vpnProfile: string;
  vpnIp: string;
  status: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const existingName = await prisma.vpnUser.findFirst({
    where: {
      username: payload.username,
      id: { not: id }
    }
  });
  if (existingName) {
    throw new Error(`The VPN username "${payload.username}" already exists.`);
  }

  // Duplicate IP check
  const duplicate = await prisma.vpnUser.findFirst({
    where: {
      vpnIp: payload.vpnIp,
      id: { not: id },
    },
  });
  if (duplicate) {
    throw new Error(`The VPN IP address ${payload.vpnIp} is already assigned.`);
  }

  const res = await prisma.vpnUser.update({
    where: { id },
    data: {
      username: payload.username,
      fullName: payload.fullName,
      vpnProfile: payload.vpnProfile,
      vpnIp: payload.vpnIp,
      status: payload.status,
    },
  });

  revalidatePath("/inventory/vpn");
  return res;
}

export async function deleteVpnAssignment(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  // Deleting user will cascade delete assignments due to db referential actions
  await prisma.vpnUser.delete({
    where: { id },
  });

  revalidatePath("/inventory/vpn");
  return { success: true };
}

export async function addVpnAssignment(payload: {
  vpnUserId: string;
  vmId?: string;
  namespaceId?: string;
  expiresAt?: string | Date;
  notes?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  if (!payload.vmId && !payload.namespaceId) {
    throw new Error("Please select a Virtual Machine or a K8s Namespace to assign.");
  }

  // Duplicate check
  const duplicate = await prisma.vpnAssignment.findFirst({
    where: {
      vpnUserId: payload.vpnUserId,
      vmId: payload.vmId || null,
      namespaceId: payload.namespaceId || null,
    }
  });
  if (duplicate) {
    throw new Error("This resource is already assigned to this user.");
  }

  const res = await prisma.vpnAssignment.create({
    data: {
      vpnUserId: payload.vpnUserId,
      vmId: payload.vmId || null,
      namespaceId: payload.namespaceId || null,
      assignedById: session.user.id,
      expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
      notes: payload.notes || null,
    }
  });

  revalidatePath("/inventory/vpn");
  return res;
}

export async function removeVpnAssignment(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  await prisma.vpnAssignment.delete({
    where: { id }
  });

  revalidatePath("/inventory/vpn");
  return { success: true };
}

// -------------------------------------------------------------
// Shared helper queries
// -------------------------------------------------------------

export async function fetchActiveVmsList() {
  return prisma.vmInstance.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      hostname: true,
      ipAddress: true,
    },
    orderBy: { hostname: "asc" },
  });
}

export async function fetchActiveNamespacesList() {
  return prisma.k8sNamespace.findMany({
    select: {
      id: true,
      name: true,
      supervisorIp: true,
    },
    orderBy: { name: "asc" },
  });
}
