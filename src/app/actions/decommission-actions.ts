// src/app/actions/decommission-actions.ts
"use server";

import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { Prisma, RequestStatus } from "@prisma/client";

// Get list of decommission requests (for dashboard)
export async function getDecommissionRequestList({
  status = "APPROVED",
  page = 1,
  itemsPerPage = 20,
}: {
  status?: string;
  page?: number;
  itemsPerPage?: number;
}) {
  const skip = (page - 1) * itemsPerPage;

  const where: Prisma.RequestWhereInput = {
    requestType: "DECOMMISSION",
  };

  if (status !== "ALL") {
    where.status = status as RequestStatus;
  }

  const [data, totalCount] = await Promise.all([
    prisma.request.findMany({
      where,
      include: {
        requester: { select: { name: true, email: true } },
        vmInstances: true,
        targetVm: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: itemsPerPage,
    }),
    prisma.request.count({ where }),
  ]);

  return {
    data,
    totalPages: Math.ceil(totalCount / itemsPerPage),
  };
}

// Get single decommission request by ID (for detail page)
export async function getDecommissionRequestById(requestId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const request = await prisma.request.findUnique({
    where: { 
      id: requestId,
      requestType: "DECOMMISSION"
    },
    include: {
      requester: { select: { name: true, email: true } },
      vmInstances: true,
      targetVm: true,
    },
  });

  if (!request) throw new Error("Decommission request not found");

  // RBAC: Only DCOPS can view decommission requests
  if (!session.user.roles.includes("DCOPS")) {
    // Check if user is the requester (for their own requests)
    if (request.requesterId !== session.user.id) {
      throw new Error("Access denied");
    }
  }

  return request;
}

// Execute decommission (DCOPS only)
export async function executeDecommission(requestId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  // Only DCOPS can execute decommissions
  if (session.user.roles.includes("DCOPS")) {
    throw new Error("Only DCOPS can execute decommissions");
  }

  return prisma.$transaction(async (tx) => {
    const req = await tx.request.findUnique({
      where: { 
        id: requestId,
        requestType: "DECOMMISSION",
        status: "APPROVED" // Only approved requests can be executed
      },
      include: { 
        vmInstances: true, 
        targetVm: true 
      },
    });

    if (!req) {
      throw new Error("Invalid or non-approved decommission request");
    }

    // Determine VMs to decommission
    const vmsToRetire = req.vmInstances.length
      ? req.vmInstances
      : req.targetVm
      ? [req.targetVm]
      : [];

    if (vmsToRetire.length === 0) {
      throw new Error("No VMs found to decommission");
    }

    // Update VM statuses to RETIRED
    await tx.vmInstance.updateMany({
      where: { id: { in: vmsToRetire.map(v => v.id) } },
      data: { 
        status: "RETIRED", 
        decommissionedAt: new Date() 
      },
    });

    // Update request status to CLOSED
    await tx.request.update({
      where: { id: requestId },
      data: { status: "CLOSED" },
    });

    // Create audit log
    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "EXECUTE_DECOMMISSION",
        entityType: "REQUEST",
        entityId: requestId,
        details: {
          vmIds: vmsToRetire.map(v => v.id),
          vmCount: vmsToRetire.length,
          executedBy: session.user.name,
        },
      },
    });

    return { success: true };
  });
}