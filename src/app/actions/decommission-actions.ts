// src/app/actions/decommission-actions.ts
"use server";

import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { Prisma, RequestStatus, RequestType, ApprovalEntityType, Environment } from "@prisma/client";
import { generateApprovals } from "./request-actions";
import { revalidatePath } from "next/cache";

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
  if (!session.user.roles.includes("DCOPS") && !session.user.roles.includes("ADMIN")) {
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
  }, { timeout: 15000 });
}

export async function createDecommissionRequest(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");
  const requesterId = session.user.id;
  
  const targetVmId = formData.get("targetVmId")?.toString();
  const reason = formData.get("reason")?.toString() || formData.get("purpose")?.toString() || "";
  
  if (!targetVmId) throw new Error("Target VM ID is required");

  // Verify VM exists and belongs to user (or user is admin)
  const vm = await prisma.vmInstance.findUnique({
    where: { id: targetVmId },
    select: { id: true, status: true, ownerId: true }
  });
  
  if (!vm) throw new Error("VM not found");
  if (vm.status !== "ACTIVE") throw new Error("Only ACTIVE VMs can be decommissioned");
  
  // Create decommission request
  const request = await prisma.request.create({
    data: {
      requestType: RequestType.DECOMMISSION,
      status: (formData.get("status") as RequestStatus) || RequestStatus.PENDING_L1,
      targetVmId,
      requesterId: requesterId,
      systemName: `Decommission ${vm.id}`,
      environment: (formData.get("environment") as Environment) || Environment.PRODUCTION,
      purpose: reason,
      quantity: 1,
      serverType: "OTHER",
      vcpu: 0,
      ramGb: 0,
      storageGb: 0,
    },
  });
  
  if (request.status === RequestStatus.PENDING_L1) {
    await generateApprovals(prisma, request.id, ApprovalEntityType.REQUEST, RequestType.DECOMMISSION);
  }

  await prisma.auditLog.create({
    data: {
      actorId: session.user.id,
      action: "CREATE_DECOMMISSION",
      entityType: "REQUEST",
      entityId: request.id,
      details: JSON.stringify({
        targetVmId,
        status: request.status
      }),
    },
  });

  revalidatePath("/requests");
  revalidatePath(`/requests/${request.id}`);
  
  return request;
}

export async function editDecommissionRequest(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const requestId = formData.get("requestId")?.toString();
  if (!requestId) throw new Error("Request ID is required");

  const existing = await prisma.request.findUnique({
    where: { id: requestId },
  });

  if (!existing || existing.requesterId !== session.user.id) {
    throw new Error("Unauthorized or not found");
  }

  if (existing.status !== RequestStatus.DRAFT && existing.status !== RequestStatus.REJECTED) {
    throw new Error("Only drafts or rejected requests can be edited");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.request.update({
      where: { id: requestId },
      data: {
        status: (formData.get("status") as RequestStatus) || existing.status,
        purpose: formData.get("purpose")?.toString() || existing.purpose,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "EDIT_DECOMMISSION",
        entityType: "REQUEST",
        entityId: requestId,
        details: JSON.stringify({
          previousStatus: existing.status,
          newStatus: res.status
        }),
      },
    });

    return res;
  }, { timeout: 15000 });

  if (updated.status === RequestStatus.PENDING_L1) {
    await generateApprovals(prisma, requestId, ApprovalEntityType.REQUEST, RequestType.DECOMMISSION);
  }
  return updated;
}

export async function submitDecommissionRequest(requestId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const request = await prisma.request.findUnique({
    where: { id: requestId },
  });

  if (!request || request.requestType !== RequestType.DECOMMISSION) {
    throw new Error("Request not found");
  }

  if (request.status !== RequestStatus.DRAFT && request.status !== RequestStatus.REJECTED) {
    throw new Error("Invalid status for submission");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.request.update({
      where: { id: requestId },
      data: { status: RequestStatus.PENDING_L1, submittedAt: new Date() },
    });

    await generateApprovals(tx, requestId, ApprovalEntityType.REQUEST, RequestType.DECOMMISSION);

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "SUBMIT_DECOMMISSION",
        entityType: "REQUEST",
        entityId: requestId,
        details: JSON.stringify({
          previousStatus: request.status,
          newStatus: RequestStatus.PENDING_L1
        }),
      },
    });

    return res;
  }, { timeout: 15000 });
  return updated;
}

export async function deleteDecommissionRequest(requestId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const request = await prisma.request.findUnique({
    where: { id: requestId },
  });

  if (!request || request.requestType !== RequestType.DECOMMISSION) {
    throw new Error("Request not found");
  }

  if (request.status !== RequestStatus.DRAFT && request.status !== RequestStatus.REJECTED) {
    throw new Error("Invalid status for deletion");
  }

  const deleted = await prisma.$transaction(async (tx) => {
    const res = await tx.request.delete({
      where: { id: requestId },
    });

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "DELETE_DECOMMISSION",
        entityType: "REQUEST",
        entityId: requestId,
        details: JSON.stringify({
          previousStatus: request.status,
          deletedAt: new Date()
        }),
      },
    });

    return res;
  }, { timeout: 15000 });
  return deleted;
}