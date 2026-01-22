// src/app/actions/deploy-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { RequestStatus, VmStatus } from "@prisma/client";
import { notifyRequester } from "@/lib/notifications";

async function requireDeployerRole() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const hasRole = await prisma.userRole.findFirst({
    where: {
      userId: session.user.id,
      role: { name: { in: ["DEPLOYER", "DC_OPS"] } },
    },
  });
  if (!hasRole) throw new Error("Access denied: Deployer role required");
  return session.user;
}

// Add to src/app/actions/deploy-actions.ts
export async function getDeployRequests({
  filter,
  searchTerm,
  page,
  itemsPerPage,
}: {
  filter: "PENDING" | "PROVISIONED" | "ALL";
  searchTerm: string;
  page: number;
  itemsPerPage: number;
}) {
  await requireDeployerRole();

  const skip = (page - 1) * itemsPerPage;

  // Build status filter
  let statusFilter: RequestStatus[] = [];
  if (filter === "PENDING") {
    statusFilter = ["APPROVED"];
  } else if (filter === "PROVISIONED") {
    statusFilter = ["PROVISIONED"];
  } else {
    statusFilter = ["APPROVED", "PROVISIONED"];
  }

  // Build search condition
  const searchCondition = searchTerm
    ? {
        OR: [
          { systemName: { contains: searchTerm } },
          { projectName: { contains: searchTerm } },
          { requester: { name: { contains: searchTerm } } },
        ],
      }
    : {};

  const totalCount = await prisma.request.count({
    where: {
      status: { in: statusFilter },
      ...searchCondition,
    },
  });

  const pendingCount = await prisma.request.count({
    where: { status: "APPROVED" },
  });

  const data = await prisma.request.findMany({
    where: {
      status: { in: statusFilter },
      ...searchCondition,
    },
    select: {
      id: true,
      systemName: true,
      projectName: true,
      environment: true,
      quantity: true,
      status: true,
      submittedAt: true,
      requester: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
    skip,
    take: itemsPerPage,
  });

  return {
    data,
    totalPages: Math.ceil(totalCount / itemsPerPage),
    pendingCount,
  };
}

export async function getPendingRequests() {
  await requireDeployerRole();
  return prisma.request.findMany({
    where: { status: "APPROVED" },
    select: {
      id: true,
      systemName: true,
      quantity: true,
      environment: true,
      submittedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getRequestForProvisioning(requestId: string) {
  await requireDeployerRole();
  return prisma.request.findUnique({
    where: { id: requestId },
    include: {
      additionalDisks: true,
      firewallPorts: true,
      networkAccess: true,
    },
  });
}

export async function provisionRequest(
  requestId: string,
  vms: {
    hostname: string;
    ipAddress: string;
    publicIpAddress?: string | null;
    vCenterVmId?: string;
    cluster?: string;
    datastore?: string;
  }[]
) {
  const user = await requireDeployerRole();

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      additionalDisks: true,
      firewallPorts: true,
      networkAccess: true,
    },
  });

  if (!request) throw new Error("Request not found");
  if (request.status !== "APPROVED") throw new Error("Request must be approved");
  if (vms.length !== request.quantity) {
    throw new Error(`Expected ${request.quantity} VM(s), got ${vms.length}`);
  }

  // Validate required fields
  for (const vm of vms) {
    if (!vm.hostname.trim() || !vm.ipAddress.trim()) {
      throw new Error("Hostname and IP Address are required for all VMs");
    }
  }

  return await prisma.$transaction(async (tx) => {
    for (let i = 0; i < vms.length; i++) {
      const vmData = vms[i];

      // Determine renewal date: default 6 months, max 24 months
      const requestedMonths = request.renewalPeriodMonths || 6;
      const months = Math.min(requestedMonths, 24);
      const renewalDate = request.renewalRequired 
        ? new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000) 
        : null;

      const vmInstance = await tx.vmInstance.create({
        data: {
          requestId: request.id,
          ownerId: request.requesterId,
          sequenceNumber: i + 1,
          hostname: vmData.hostname.trim(),
          ipAddress: vmData.ipAddress.trim(),
          publicIpAddress: vmData.publicIpAddress?.trim() || null,
          status: VmStatus.ACTIVE,
          provisionedAt: new Date(),
          renewalDate,
        },
      });

      // Create initial VmSpec
      const spec = await tx.vmSpec.create({
        data: {
          vmInstanceId: vmInstance.id,
          vcpu: request.vcpu || 2,
          ramGb: request.ramGb || 4,
          storageGb: request.storageGb || 50,
          osName: request.osName,
          osVersion: request.osVersion,
          raid: request.raid,
          appliedById: user.id,
          sourceRequestId: request.id,
          additionalDisks: {
            create: request.additionalDisks.map((d) => ({
              sizeGb: d.sizeGb,
              purpose: d.purpose,
              sequence: d.sequence,
            })),
          },
          firewallPorts: {
            create: request.firewallPorts.map((p) => ({
              port: p.port,
              protocol: p.protocol,
              purpose: p.purpose,
              source: p.source,
            })),
          },
          networkAccess: {
            create: request.networkAccess.map((n) => ({
              accessType: n.accessType,
            })),
          },
        },
      });

      await tx.vmInstance.update({
        where: { id: vmInstance.id },
        data: { currentSpecId: spec.id },
      });
    }

    await tx.request.update({
      where: { id: requestId },
      data: {
        status: RequestStatus.PROVISIONED,
        provisionedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "PROVISIONED",
        entityType: "REQUEST",
        entityId: requestId,
        details: {
          vmCount: vms.length,
          environment: request.environment,
          provisionedBy: user.email,
          vms: vms.map(v => ({
            hostname: v.hostname,
            ip: v.ipAddress,
            cluster: v.cluster,
            datastore: v.datastore,
          })),
        },
      },
    });

    await notifyRequester(request.requesterId, request.systemName, "PROVISIONED");

    revalidatePath(`/requests/${requestId}`);
    revalidatePath("/inventory/vms");
    revalidatePath("/deploy");
  });
}