// src/app/actions/customization-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { 
  CustomizationStatus,
  ApprovalEntityType,
  RequestType,
  Prisma
} from "@prisma/client";
import { generateApprovals } from "./approval-actions";
import { isAdmin } from "@/lib/utils";
import { Environment, VmStatus, CustomizationStatus as CustomizationStatusEnum } from "@/types/enums";

/* ------------------------------------------------------------------ */
/* Zod Validation Schemas */
/* ------------------------------------------------------------------ */

interface CustomizationRequest {
  targetVmId: string;
  id: string;
  requesterId: string | null;
  status: CustomizationStatus;  
}

interface pendingRequest  {
    id: string;
    createdAt: Date;
    status: CustomizationStatus;
} 

const customizationCreateSchema = z.object({
  targetVmId: z.string().uuid(),
  vcpu: z.string().optional(),
  ramGb: z.string().optional(),
  storageGb: z.string().optional(),
  purpose: z.string().min(10, "Purpose must be at least 10 characters"),
});

const customizationUpdateSchema = z.object({
  vcpu: z.string().optional(),
  ramGb: z.string().optional(),
  storageGb: z.string().optional(),
  purpose: z.string().min(10, "Purpose must be at least 10 characters").optional(),
});

/* ------------------------------------------------------------------ */
/* Helper Functions */
/* ------------------------------------------------------------------ */

function parseIntOrNull(value: string | null | undefined): number | null {
  if (!value) return null;
  const num = parseInt(value, 10);
  return isNaN(num) ? null : num;
}

async function validateOwnership(
  customizationId: string,
  userId: string,
  requireDraft = false
): Promise<{ customization: CustomizationRequest; isOwner: boolean }> {
  const customization = await prisma.customizationRequest.findUnique({
    where: { id: customizationId },
    select: { 
      id: true, 
      requesterId: true, 
      status: true,
      targetVmId: true 
    }
  });

  if (!customization) {
    throw new Error("Customization request not found");
  }

  const isOwner = customization.requesterId === userId;
  
  if (!isOwner && !isAdmin((await getServerSession(authOptions))?.user?.roles)) {
    throw new Error("Unauthorized: You can only modify your own requests");
  }

  if (requireDraft && customization.status !== CustomizationStatus.DRAFT) {
    throw new Error("Only DRAFT customization requests can be modified");
  }

  return { customization, isOwner };
}

async function createAuditLog(
  actorId: string,
  action: string,
  entityId: string,
  details?: Record<string, unknown>
) {
  await prisma.auditLog.create({
    data: {
      actorId,
      action,
      entityType: "CUSTOMIZATION",
      entityId,
      details: details ? JSON.stringify(details) : undefined,
    },
  });
}

export async function createCustomizationRequest(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  // Validate input
  const parsed = customizationCreateSchema.parse(Object.fromEntries(formData));
  
  // Verify target VM exists and is active
  const targetVm = await prisma.vmInstance.findUnique({
    where: { id: parsed.targetVmId },
    select: { id: true, status: true, ownerId: true }
  });

  if (!targetVm) throw new Error("Target VM not found");
  if (targetVm.status !== "ACTIVE") throw new Error("Can only customize ACTIVE VMs");

  // Check ownership
  const userRoles = session.user.roles || [];
  const isManagement = userRoles.some(r => ["ADMIN", "DC_OPS"].includes(r.toUpperCase()));
  
  if (!isManagement && targetVm.ownerId !== session.user.id) {
    throw new Error("You can only customize virtual machines that you own.");
  }

  // Create customization request
  const customization = await prisma.customizationRequest.create({
    data: {
      targetVmId: parsed.targetVmId,
      requesterId: session.user.id,
      status: CustomizationStatus.DRAFT,
      vcpu: parseIntOrNull(parsed.vcpu),
      ramGb: parseIntOrNull(parsed.ramGb),
      storageGb: parseIntOrNull(parsed.storageGb),
      purpose: parsed.purpose,
      submittedAt: null,
    },
  });

  // Create audit log
  await createAuditLog(
    session.user.id,
    "CREATE_CUSTOMIZATION",
    customization.id,
    { targetVmId: parsed.targetVmId }
  );

  revalidatePath("/requests");
  revalidatePath(`/requests/customize`);
  revalidatePath("/inventory/vms", "layout");
  
  return customization;
}

export async function getCustomizationRequests({
  page = 1,
  perPage = 10,
  status,
  search,
}: {
  page?: number;
  perPage?: number;
  status?: CustomizationStatus | "all";
  search?: string;
} = {}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const skip = (page - 1) * perPage;
  const isManagement = isAdmin(session.user.roles);

  const where: Prisma.CustomizationRequestWhereInput = isManagement 
    ? {} 
    : { requesterId: session.user.id };

  if (status && status !== "all") {
    where.status = status as CustomizationStatus;
  }

  if (search) {
    where.OR = [
      { purpose: { contains: search, mode: "insensitive" } },
      { targetVm: { hostname: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [requests, total] = await Promise.all([
    prisma.customizationRequest.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { createdAt: "desc" },
      include: {
        targetVm: {
          select: {
            id: true, // ✅ Required field
            hostname: true,
            ipAddress: true,
            publicIpAddress: true,
            subdomain: true,
            renewalDate: true,
            environment: true,
            hasRemoteAccess: true,
            vpnRequired: true,
            updatedAt: true,
            status: true,
            currentSpec: {
              select: { vcpu: true, ramGb: true, storageGb: true },
            },
          },
        },
        resultingSpec: true,
        requester: {
          select: { id: true, name: true, email: true, designation: true },
        },
        additionalDisks: true,
        firewallPorts: true,
        networkAccess: true,
        approvals: {
          select: {
            id: true,
            level: true,
            decision: true,
            approverId: true, // ✅ CRITICAL: ADD THIS MISSING FIELD
            comments: true, 
            decidedAt: true,
            createdAt: true,
            approver: { select: { id: true, name: true, email: true, designation: true} },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.customizationRequest.count({ where }),
  ]);
  return {
    requests: requests.map((r) => ({
      ...r,
      status: r.status as CustomizationStatus,
      createdAt: r.createdAt.toISOString(),
      submittedAt: r.submittedAt?.toISOString() ?? null,
      
      targetVm: {
        id: r.targetVm.id,
        hostname: r.targetVm.hostname,
        ipAddress: r.targetVm.ipAddress,
        publicIpAddress: r.targetVm.publicIpAddress,
        subdomain: r.targetVm.subdomain,
        status: r.targetVm.status as VmStatus,
        renewalDate: r.targetVm.renewalDate, // ✅ Keep as Date (interface expects Date)
        environment: r.targetVm.environment as Environment,
        hasRemoteAccess: r.targetVm.hasRemoteAccess,
        vpnRequired: r.targetVm.vpnRequired,
        currentSpec: r.targetVm.currentSpec 
          ? { 
              vcpu: r.targetVm.currentSpec.vcpu,
              ramGb: r.targetVm.currentSpec.ramGb,
              storageGb: r.targetVm.currentSpec.storageGb,
            } 
          : null,
      },
      
      requester: r.requester 
        ? { 
            id: r.requester.id,
            name: r.requester.name,
            email: r.requester.email,
            designation: r.requester.designation,
          } 
        : null,
      
      approvals: (r.approvals ?? []).map(a => ({
        id: a.id,
        level: a.level,       
        approverId: a.approverId,       
        decision: a.decision as string, 
        comments: a.comments,           
        decidedAt: a.decidedAt?.toISOString() ?? null,
        createdAt: a.createdAt?.toISOString() ?? null,
        approver: { id: a.approver.id, name: a.approver.name, email: a.approver.email, designation: a.approver.designation },
      })),
      
      additionalDisks: r.additionalDisks ?? [],
      firewallPorts: r.firewallPorts ?? [],
      networkAccess: r.networkAccess ?? [],
      parentRequestId: r.parentRequestId ?? null,
      resultingSpec: r.resultingSpec ?? null,
    })),
    total,
    totalPages: Math.ceil(total / perPage),
    page,
    perPage,
  };
}

export async function getCustomizationRequest(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const isManagement = isAdmin(session.user.roles);

  const customization = await prisma.customizationRequest.findUnique({
    where: isManagement 
      ? { id }
      : { 
          id,
          OR: [
            { requesterId: session.user.id },
            { targetVm: { ownerId: session.user.id } }
          ]
        },
    include: {
      targetVm: {
        include: {
          currentSpec: true,
          owner: { select: { name: true, email: true } },
        }
      },
      additionalDisks: true,
      firewallPorts: true,
      networkAccess: true,
      requester: { select: {id: true, name: true, email: true, designation: true } },
      approvals: {
        include: { approver: { select: { id: true, name: true, email: true, designation: true } } },
        orderBy: { createdAt: "asc" }
      },
      resultingSpec: true,
    },
  });

  if (!customization) throw new Error("Customization request not found");

  return {
    ...customization,
    status: customization.status as CustomizationStatusEnum,
    targetVm:{
      ...customization.targetVm, 
      status: customization.targetVm.status as VmStatus,
      environment: customization.targetVm.environment as Environment,
    },
    createdAt: customization.createdAt.toISOString(),
    updatedAt: customization.updatedAt.toISOString(),
    submittedAt: customization.submittedAt?.toISOString() ?? null,
  };
}

/**
 * Update DRAFT customization request
 */
export async function updateCustomizationRequest(
  id: string,
  formData: FormData
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");


  // Validate input
  const parsed = customizationUpdateSchema.parse(Object.fromEntries(formData));

  // Get current values for audit log
  const current = await prisma.customizationRequest.findUnique({
    where: { id },
    select: { vcpu: true, ramGb: true, storageGb: true, purpose: true }
  });

  // Update customization
  const updated = await prisma.customizationRequest.update({
    where: { id },
    data: {
      vcpu: parseIntOrNull(parsed.vcpu) ?? current?.vcpu ?? null,
      ramGb: parseIntOrNull(parsed.ramGb) ?? current?.ramGb ?? null,
      storageGb: parseIntOrNull(parsed.storageGb) ?? current?.storageGb ?? null,
      purpose: parsed.purpose ?? current?.purpose ?? null,
    },
  });

  // Create audit log
  await createAuditLog(
    session.user.id,
    "UPDATE_CUSTOMIZATION",
    id,
    {
      old: current,
      new: {
        vcpu: updated.vcpu,
        ramGb: updated.ramGb,
        storageGb: updated.storageGb,
        purpose: updated.purpose,
      }
    }
  );

  revalidatePath("/requests");
  revalidatePath(`/requests/customize/edit/${id}`);
  
  return updated;
}

export async function deleteCustomizationRequest(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const { customization } = await validateOwnership(id, session.user.id, true);

  // Delete customization
  const deleted = await prisma.customizationRequest.delete({
    where: { id },
  });

  // Create audit log
  await createAuditLog(
    session.user.id,
    "DELETE_CUSTOMIZATION",
    id,
    { targetVmId: customization.targetVmId }
  );

  revalidatePath("/requests");
  revalidatePath(`/requests/customize`);
  
  return { success: true, id: deleted.id };
}

export async function submitCustomizationRequest(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  // Validate ownership and status
  await validateOwnership(id, session.user.id, true);

  // Submit within transaction
  const submitted = await prisma.$transaction(async (tx) => {
    // Update status to PENDING_L1
    const updated = await tx.customizationRequest.update({
      where: { id },
      data: { 
        status: CustomizationStatus.PENDING_L1,
        submittedAt: new Date(),
      },
    });

    // Generate approvals
    await generateApprovals(
      tx,
      id,
      ApprovalEntityType.CUSTOMIZATION,
      RequestType.CUSTOMIZED
    );

    // Create audit log
    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "SUBMIT_CUSTOMIZATION",
        entityType: "CUSTOMIZATION",
        entityId: id,
      },
    });

    return updated;
  }, { timeout: 15000 });

  revalidatePath("/requests");
  revalidatePath(`/requests/customize`);
  revalidatePath("/inventory/vms", "layout");
  
  return submitted;
}

//Cancel customization request (PENDING_L1 → DRAFT)
export async function cancelCustomizationRequest(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  // Validate ownership
  const { customization } = await validateOwnership(id, session.user.id);

if (!isPendingStatus(customization.status)) {
  throw new Error("Only pending customization requests can be cancelled");
}
  // Cancel within transaction
  const cancelled = await prisma.$transaction(async (tx) => {
    // Update status to DRAFT
    const updated = await tx.customizationRequest.update({
      where: { id },
      data: { 
        status: CustomizationStatus.DRAFT,
        submittedAt: null,
      },
    });

    // Delete pending approvals
    await tx.approval.deleteMany({
      where: { 
        customizationRequestId: id,
        decision: "PENDING"
      }
    });

    // Create audit log
    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "CANCEL_CUSTOMIZATION",
        entityType: "CUSTOMIZATION",
        entityId: id,
      },
    });

    return updated;
  }, { timeout: 10000 });

  revalidatePath("/requests");
  revalidatePath(`/requests/customize`);
  
  return cancelled;
}

export async function getPendingCustomizationForVm(
  vmId: string,
  userId: string
): Promise<{ hasPending: boolean; request?: pendingRequest | null }> {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  // Only check requester's own pending requests
  const pendingRequest = await prisma.customizationRequest.findFirst({
    where: {
      targetVmId: vmId,
      requesterId: userId,
      status: {
        in: [
          "DRAFT",
          "PENDING_L1",
          "PENDING_L2",
          "PENDING_L3",
          "APPROVED" // Prevent new requests while previous is being applied
        ]
      }
    },
    select: {
      id: true,
      status: true,
      createdAt: true
    }
  });

  return {
    hasPending: !!pendingRequest,
    request: pendingRequest
  };
}

function isPendingStatus(status: CustomizationStatus): boolean {
  switch (status) {
    case CustomizationStatus.PENDING_L1:
    case CustomizationStatus.PENDING_L2:
    case CustomizationStatus.PENDING_L3:
      return true;
    default:
      return false;
  }
}