// src/actions/vm-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { VmStatus,  Prisma, ApprovalEntityType, ApprovalDecision } from "@prisma/client";

// ==============
// Helper: Create Audit Log
// ==============
async function createAuditLog(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  details?: Record<string, unknown>,
  vmId?: string
) {
  await prisma.auditLog.create({
    data: {
      actorId,
      action,
      entityType,
      entityId,
      details: details ? JSON.stringify(details) : undefined,
      vmId,
    },
  });
}

// ==============
// Schemas
// ==============

const vmBaseSchema = z.object({
  requestId: z.string().uuid(),
  sequenceNumber: z.number().int().min(1),
  ownerId: z.string().uuid().optional().nullable(),
  hostname: z.string().optional().nullable(),
  subdomain: z.string().optional().nullable(),
  ipAddress: z.string().optional().nullable(),
  publicIpAddress: z.string().optional().nullable(),
  status: z.nativeEnum(VmStatus),
  renewalDate: z.string().optional().nullable(),
  decommissionedAt: z.string().optional().nullable(),
  hasRemoteAccess: z.boolean(),
  vpnRequired: z.boolean(),
});

const vmSpecSchema = z.object({
  vcpu: z.number().int().min(1),
  ramGb: z.number().int().min(1),
  storageGb: z.number().int().min(1),
  osName: z.string().optional().nullable(),
  osVersion: z.string().optional().nullable(),
  raid: z
    .enum(["RAID0", "RAID1", "RAID5", "RAID10", "NONE"])
    .optional()
    .nullable(),
});

// ==============
// Actions
// ==============

// 1. CREATE VM + INITIAL SPEC + AUDIT
export async function createVm(formData: FormData, actorId: string) {
  const vmData = vmBaseSchema.parse(Object.fromEntries(formData));
  const specData = vmSpecSchema.parse(Object.fromEntries(formData));

  const vm = await prisma.$transaction(async (tx) => {
    const vm = await tx.vmInstance.create({
      data: {
        ...vmData,
        renewalDate: vmData.renewalDate ? new Date(vmData.renewalDate) : null,
        decommissionedAt: vmData.decommissionedAt
          ? new Date(vmData.decommissionedAt)
          : null,
      },
    });

    await tx.vmSpec.create({
      data: {
        ...specData,
        vmInstanceId: vm.id,
        effectiveFrom: new Date(),
      },
    });

    return vm;
  });

  await createAuditLog(
    actorId,
    "VM_CREATED",
    "VmInstance",
    vm.id,
    vmData,
    vm.id
  );
  revalidatePath("/inventory/vms");
  return vm;
}

// 2. UPDATE VM METADATA + AUDIT
export async function updateVm(formData: FormData, actorId: string) {
  const validated = vmBaseSchema
    .extend({ id: z.string().uuid() })
    .parse(Object.fromEntries(formData));

  const { id, ...data } = validated;
  const oldVm = await prisma.vmInstance.findUnique({ where: { id } });

  await prisma.vmInstance.update({
    where: { id },
    data: {
      ...data,
      renewalDate: data.renewalDate ? new Date(data.renewalDate) : null,
      decommissionedAt: data.decommissionedAt
        ? new Date(data.decommissionedAt)
        : null,
    },
  });

  await createAuditLog(
    actorId,
    "VM_UPDATED",
    "VmInstance",
    id,
    { old: oldVm, new: data },
    id
  );
  revalidatePath("/inventory/vms");
}

// 3. UPDATE RESOURCES VIA CUSTOMIZATION REQUEST OR DIRECT
export async function updateVmResources(
  formData: FormData,
  actorId: string,
  viaCustomization: boolean = false
) {
  const vmId = formData.get("vmId") as string;
  if (!vmId) throw new Error("VM ID is required");

  const specData = vmSpecSchema.parse(Object.fromEntries(formData));
  const sourceRequestId = formData.get("sourceRequestId") as string | null;

  await prisma.$transaction(async (tx) => {
    const newSpec = await tx.vmSpec.create({
      data: {
        ...specData,
        vmInstanceId: vmId,
        sourceRequestId: sourceRequestId || undefined,
        effectiveFrom: new Date(),
      },
    });

    await tx.vmInstance.update({
      where: { id: vmId },
      data: { currentSpecId: newSpec.id },
    });
  });

  const action = viaCustomization
    ? "VM_RESOURCES_UPDATED_VIA_CUSTOMIZATION"
    : "VM_RESOURCES_UPDATED";
  await createAuditLog(actorId, action, "VmSpec", vmId, specData, vmId);
  revalidatePath("/inventory/vms");
}

// 4. REQUEST DECOMMISSION (Creates a formal request)
export async function createDecommissionRequest(vmId: string, actorId: string, reason: string) {
  const vm = await prisma.vmInstance.findUnique({
    where: { id: vmId },
    include: { request: true, currentSpec: true }
  });

  if (!vm) throw new Error("VM not found");
  if (vm.ownerId !== actorId) throw new Error("Unauthorized");

  const decommissionRequest = await prisma.request.create({
    data: {
      requestType: "DECOMMISSION",
      status: "PENDING_L1",
      systemName: vm.request?.systemName || "Decommission Request",
      purpose: `Decommission for VM ${vm.hostname || vmId}. Reason: ${reason}`,
      environment: vm.request?.environment || "PRODUCTION",
      serverType: vm.request?.serverType || "APPLICATION",
      requesterId: actorId,
      vcpu: vm.currentSpec?.vcpu || 0,
      ramGb: vm.currentSpec?.ramGb || 0,
      storageGb: vm.currentSpec?.storageGb || 0,
      osName: vm.currentSpec?.osName || "",
      osVersion: vm.currentSpec?.osVersion || "",
      submittedAt: new Date(),
    },
  });

  // Create initial approvals
  const approvers = await prisma.user.findMany({
    where: {
      roles: {
        some: {
          role: { name: { in: ["APPROVER_L1", "APPROVER_L2", "APPROVER_L3"] } },
        },
      },
    },
    select: {
      id: true,
      roles: { select: { role: { select: { name: true } } } },
    },
  });

  // ✅ Fixed approval creation
  const approvalData: Prisma.ApprovalCreateManyInput[] = [];
  for (const user of approvers) {
    for (const ur of user.roles) {
      const levelMap: Record<string, "L1" | "L2" | "L3"> = {
        APPROVER_L1: "L1",
        APPROVER_L2: "L2",
        APPROVER_L3: "L3",
      };
      const level = levelMap[ur.role.name];
      if (level) {
        approvalData.push({
          entityId: decommissionRequest.id,
          entityType: ApprovalEntityType.REQUEST,
          approverId: user.id,
          level,
          decision: ApprovalDecision.PENDING,
        });
      }
    }
  }

  await prisma.approval.createMany({ data: approvalData });

  await createAuditLog(actorId, "DECOMMISSION_REQUESTED", "Request", decommissionRequest.id, { vmId, reason }, vmId);
  revalidatePath("/requests");
  revalidatePath("/inventory/vms");
  return decommissionRequest;
}

// 4. DECOMMISSION VM (DC Ops / Admin only - final action)
export async function decommissionVm(
  vmId: string,
  actorId: string,
  reason?: string
) {
  await prisma.$transaction(async (tx) => {
    // Update VM status and timestamp
    await tx.vmInstance.update({
      where: { id: vmId },
      data: {
        status: "RETIRED",
        decommissionedAt: new Date(),
      },
    });

    // Optionally close related customization requests
    await tx.customizationRequest.updateMany({
      where: {
        targetVmId: vmId,
        status: { in: ["PENDING_L1", "PENDING_L2", "PENDING_L3"] },
      },
      data: { status: "CLOSED" },
    });
  });

  await createAuditLog(
    actorId,
    "VM_DECOMMISSIONED",
    "VmInstance",
    vmId,
    { reason },
    vmId
  );
  revalidatePath("/inventory/vms");
}

// 5. CREATE CUSTOMIZATION REQUEST (linked to VM)
export async function createCustomizationRequest(
  formData: FormData,
  requesterId: string
) {
  const schema = z.object({
    targetVmId: z.string().uuid(),
    vcpu: z.number().int().optional(),
    ramGb: z.number().int().optional(),
    storageGb: z.number().int().optional(),
    // Optional structured inputs can be added later
  });

  const data = schema.parse(Object.fromEntries(formData));

  // Ensure at least one resource is requested
  if (!data.vcpu && !data.ramGb && !data.storageGb) {
    throw new Error("At least one resource change must be specified");
  }

  const customization = await prisma.customizationRequest.create({
    data: {
      ...data,
      requesterId,
      status: "PENDING_L1",
    },
  });

  await createAuditLog(
    requesterId,
    "CUSTOMIZATION_REQUESTED",
    "CustomizationRequest",
    customization.id,
    data,
    data.targetVmId
  );

  revalidatePath(`/vms/${data.targetVmId}`);
  revalidatePath("/requests/customizations");
}

// 6. FETCH SINGLE VM WITH FULL CONTEXT
export async function fetchVmDetails(id: string) {
  return await prisma.vmInstance.findUnique({
    where: { id },
    include: {
      currentSpec: true,
      owner: { select: { name: true, email: true } },
      request: {
        select: {
          systemName: true,
          environment: true,
          requestId: true,
          purpose: true,
          requester: { select: { name: true, email: true } },
        },
      },
      customizationRequests: {
        where: { status: { not: "CLOSED" } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

// 7. FETCH VM LIST FOR DASHBOARD
export async function fetchAllVms({
  page = 1,
  perPage = 10,
  search,
  statusFilter,
  userId,
  role,
}: {
  page?: number;
  perPage?: number;
  search?: string;
  statusFilter?: VmStatus | "all";
  userId?: string;
  role?: string;
}) {
  const skip = (page - 1) * perPage;

  const where: Prisma.VmInstanceWhereInput = {};

  // Data Isolation: Requesters only see their own VMs
  if (role === "REQUESTER" && userId) {
    where.ownerId = userId;
  }

  // Status filter
  if (statusFilter && statusFilter !== "all") {
    where.status = statusFilter;
  }

  // Search
  if (search) {
    where.OR = [
      { hostname: { contains: search, mode: Prisma.QueryMode.insensitive } },
      { ipAddress: { contains: search, mode: Prisma.QueryMode.insensitive } },
      {
        request: {
          systemName: { contains: search, mode: Prisma.QueryMode.insensitive },
        },
      },
    ];
  }

  const [vms, total] = await Promise.all([
    prisma.vmInstance.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { createdAt: "desc" },
      include: {
        currentSpec: true,
        owner: { select: { name: true } },
        request: { select: { systemName: true, environment: true } },
      },
    }),
    prisma.vmInstance.count({ where }),
  ]);

  return { vms, total, totalPages: Math.ceil(total / perPage) };
}

export async function fetchVmAuditLogs(vmId: string) {
  return prisma.auditLog.findMany({
    where: { vmId },
    orderBy: { timestamp: "desc" },
    take: 20,
  });
}

// 8. RENEW VM (Creates a Renewal Request)
export async function renewVmRequest(vmId: string, actorId: string, durationMonths: number = 12) {
  const vm = await prisma.vmInstance.findUnique({
    where: { id: vmId },
    include: { 
      request: true,
      currentSpec: true
    },
  });

  if (!vm) throw new Error("VM not found");

  const newRequest = await prisma.request.create({
    data: {
      requestType: "RENEWAL",
      status: "PENDING_L1",
      systemName: vm.request?.systemName || "VM Renewal",
      purpose: `Renewal for VM ${vm.hostname || vmId}`,
      environment: vm.request?.environment || "DEVELOPMENT",
      serverType: vm.request?.serverType || "APPLICATION",
      requesterId: actorId,
      vcpu: vm.currentSpec?.vcpu ?? 0,
      ramGb: vm.currentSpec?.ramGb ?? 0,
      storageGb: vm.currentSpec?.storageGb ?? 0,
      osName: vm.currentSpec?.osName ?? "",
      osVersion: vm.currentSpec?.osVersion ?? "",
      renewalRequired: true,
      renewalPeriodMonths: durationMonths,
      submittedAt: new Date(),
    },
  });

  // Create initial approvals for renewal
  const approvers = await prisma.user.findMany({
    where: {
      roles: {
        some: {
          role: { name: { in: ["APPROVER_L1", "APPROVER_L2", "APPROVER_L3"] } },
        },
      },
    },
    select: {
      id: true,
      roles: { select: { role: { select: { name: true } } } },
    },
  });

  // ✅ Fixed approval creation
  const approvalData: Prisma.ApprovalCreateManyInput[] = [];
  for (const user of approvers) {
    for (const ur of user.roles) {
      const levelMap: Record<string, "L1" | "L2" | "L3"> = {
        APPROVER_L1: "L1",
        APPROVER_L2: "L2",
        APPROVER_L3: "L3",
      };
      const level = levelMap[ur.role.name];
      if (level) {
        approvalData.push({
          entityId: newRequest.id,
          entityType: ApprovalEntityType.REQUEST,
          approverId: user.id,
          level,
          decision: ApprovalDecision.PENDING,
        });
      }
    }
  }

  await prisma.approval.createMany({ data: approvalData });

  await createAuditLog(actorId, "VM_RENEWAL_REQUESTED", "Request", newRequest.id, { vmId }, vmId);
  
  revalidatePath("/requests");
  return newRequest;
}
