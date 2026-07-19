// src/actions/vm-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import {
  Prisma,
  RequestType,
  RequestStatus,
  ApprovalEntityType,
  CustomizationStatus
} from "@prisma/client";

import { VmStatus as FrontendVmStatus,   Raid as FrontendRaid,
  Environment as FrontendEnvironment } from "@/types/enums";
import { generateApprovals } from "./approval-actions";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { SerializedVmInstance, SerializedVmInstanceDetail } from "@/types/vm";
import { isAdmin } from "@/lib/utils";

const vmBaseSchema = z.object({
  requestId: z.preprocess(
    (val) => (val === "" || val == null ? null : val),
    z.string().uuid().nullable()
  ),

  sequenceNumber: z.preprocess(
    (val) => {
      if (val === undefined || val === null || val === "") {
        return 1; // default for manual VM
      }
      const num = Number(val);
      return isNaN(num) ? undefined : num;
    },
    z.number().int().min(1)
  ),

  ownerId: z.preprocess(
    (val) => (val === "" || val == null ? null : val),
    z.string().uuid().nullable()
  ),

  hostname: z.string().optional().nullable(),
  subdomain: z.string().optional().nullable(),
  ipAddress: z.string().optional().nullable(),
  publicIpAddress: z.string().optional().nullable(),

  status: z.nativeEnum(FrontendVmStatus),

  renewalDate: z.string().optional().nullable(),
  decommissionedAt: z.string().optional().nullable(),

  hasRemoteAccess: z.preprocess(
    (val) => val === "true" || val === true,
    z.boolean()
  ),

  vpnRequired: z.preprocess(
    (val) => val === "true" || val === true,
    z.boolean()
  ),
});

const vmSpecSchema = z.object({
  vcpu: z.preprocess((val) => Number(val), z.number().int().min(1)),
  ramGb: z.preprocess((val) => Number(val), z.number().int().min(1)),
  storageGb: z.preprocess((val) => Number(val), z.number().int().min(1)),

  osName: z.string().optional().nullable(),
  osVersion: z.string().optional().nullable(),

  raid: z
    .enum(["RAID0", "RAID1", "RAID5", "RAID10", "NONE"])
    .optional()
    .nullable(),
});

const VM_LIGHT_INCLUDE = {
  owner: { select: { name: true, email: true } },
  request: { select: {requestId: true, systemName: true, environment: true } },
} satisfies Prisma.VmInstanceInclude;

const VM_FULL_INCLUDE = {
  owner: true,
  currentSpec: true,
  specHistory: { orderBy: { createdAt: "desc" } },
  request: true,
  customizationHistory: { orderBy: { createdAt: "desc" } },
  auditLogs: { orderBy: { timestamp: "desc" }, take: 10 },
} satisfies Prisma.VmInstanceInclude;

const SERIALIZED_VM_FULL_INCLUDE = {
  owner: true,
  currentSpec: true,
  specHistory: { orderBy: { createdAt: "desc" } },
  request: true,
  customizationHistory: { orderBy: { createdAt: "desc" } },
  auditLogs: { 
    include: { 
      actor: { 
        select: { 
          name: true, 
          email: true 
        } 
      } 
    }, 
    orderBy: { timestamp: "desc" }, 
    take: 10 
  },
  tags: {
    include: { tag: true }
  },
} satisfies Prisma.VmInstanceInclude;


async function createAuditLog(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  details?: unknown,
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

export async function getVmList({
  isAdmin,
  userId,
}: {
  isAdmin: boolean;
  userId: string;
}) {
  return await prisma.vmInstance.findMany({
    where: isAdmin ? {} : { ownerId: userId },
    include: {
      ...VM_LIGHT_INCLUDE,
      currentSpec: true,
    },
    orderBy: { provisionedAt: "desc" },
  });
}

export async function getVmListWithRequests({
  isAdmin,
  userId,
}: {
  isAdmin: boolean;
  userId: string;
}) {
  const vms = await prisma.vmInstance.findMany({
    where: isAdmin ? {} : { ownerId: userId },
    include: {
      ...VM_LIGHT_INCLUDE,
      currentSpec: true,
    },
    orderBy: { provisionedAt: "desc" },
  });

  const vmIds = vms.map(vm => vm.id);
  
  const [customizations, decommissions] = await Promise.all([
    prisma.customizationRequest.findMany({
      where: { 
        targetVmId: { in: vmIds },
        status: { in: [RequestStatus.DRAFT, RequestStatus.PENDING_L1, RequestStatus.APPROVED] } 
      },
      select: { targetVmId: true },
    }),
    prisma.request.findMany({
      where: {
        targetVmId: { in: vmIds },
        requestType: RequestType.DECOMMISSION,
        status: { in: [RequestStatus.DRAFT, RequestStatus.PENDING_L1, RequestStatus.APPROVED] },
      },
      select: { targetVmId: true },
    }),
  ]);

  const customizationVmSet = new Set(customizations.map(c => c.targetVmId));
  const decommissionVmSet = new Set(decommissions.map(d => d.targetVmId));

  return vms.map(vm => ({
    ...vm,
    hasCustomizationRequest: customizationVmSet.has(vm.id),
    hasDecommissionRequest: decommissionVmSet.has(vm.id),
  }));
}


export async function createVm(formData: FormData, actorId: string) {
  const vmData = vmBaseSchema.parse(Object.fromEntries(formData));
  const specData = vmSpecSchema.parse(Object.fromEntries(formData));

  const vm = await prisma.$transaction(async (tx) => {
    const createdVm = await tx.vmInstance.create({
      data: {
        ...vmData,
        requestId: vmData.requestId ?? null,
        renewalDate: vmData.renewalDate ? new Date(vmData.renewalDate) : null,
        decommissionedAt: vmData.decommissionedAt
          ? new Date(vmData.decommissionedAt)
          : null,
      },
    });

    const spec = await tx.vmSpec.create({
      data: {
        ...specData,
        vmInstanceId: createdVm.id,
        effectiveFrom: new Date(),
      },
    });

    await tx.vmInstance.update({
      where: { id: createdVm.id },
      data: { currentSpecId: spec.id },
    });

    return createdVm;
  }, { timeout: 15000 });

  await createAuditLog(actorId, "VM_CREATED", "VmInstance", vm.id, vmData, vm.id);
  revalidatePath("/inventory/vms");
  return vm;
}

export async function createManualVm(formData: FormData, actorId: string) {
  // Ensure requestId is null for manual entry
  formData.delete("requestId"); 
  formData.set("sequenceNumber", "1");
  formData.set("environment", "PRODUCTION");
  return createVm(formData, actorId);
}

export async function updateVm(formData: FormData) {
  const data = vmBaseSchema
    .extend({ id: z.string().uuid() })
    .parse(Object.fromEntries(formData));

  const specData = vmSpecSchema.parse(Object.fromEntries(formData));
  const { id, ...payload } = data;

  const oldVm = await prisma.vmInstance.findUnique({ 
    where: { id },
    include: { currentSpec: true }
  });
  if (!oldVm) throw new Error("VM not found");

  const session = await getServerSession(authOptions);
  if (!session?.user || (!isAdmin(session.user.roles) && oldVm.ownerId !== session.user.id)) {
    throw new Error("Unauthorized");
  }

  const actorId = session.user.id;

  await prisma.$transaction(async (tx) => {
    // 1. Update VM Instance base fields
    await tx.vmInstance.update({
      where: { id },
      data: {
        ...payload,
        renewalDate: payload.renewalDate ? new Date(payload.renewalDate) : null,
        decommissionedAt: payload.decommissionedAt
          ? new Date(payload.decommissionedAt)
          : null,
      },
    });

    // 2. Check if spec changed
    const specChanged = 
      !oldVm.currentSpec ||
      oldVm.currentSpec.vcpu !== specData.vcpu ||
      oldVm.currentSpec.ramGb !== specData.ramGb ||
      oldVm.currentSpec.storageGb !== specData.storageGb ||
      oldVm.currentSpec.osName !== specData.osName ||
      oldVm.currentSpec.osVersion !== specData.osVersion ||
      oldVm.currentSpec.raid !== specData.raid;

    if (specChanged) {
      const newSpec = await tx.vmSpec.create({
        data: {
          ...specData,
          vmInstanceId: id,
          effectiveFrom: new Date(),
        },
      });

      await tx.vmInstance.update({
        where: { id },
        data: { currentSpecId: newSpec.id },
      });
    }

    // 3. Audit Log
    await tx.auditLog.create({
      data: {
        actorId,
        action: "VM_UPDATED",
        entityType: "VmInstance",
        entityId: id,
        details: JSON.stringify({ 
          old: { ...oldVm, currentSpec: oldVm.currentSpec }, 
          new: { ...payload, spec: specData } 
        }),
        vmId: id,
      },
    });
  });

  revalidatePath("/inventory/vms");
  revalidatePath(`/inventory/vms/${id}`);
}

export async function updateVmResources(
  formData: FormData,
  viaCustomization = false
) {
  const vmId = formData.get("vmId") as string;
  if (!vmId) throw new Error("VM ID is required");
  const customizationRequestId = formData.get("customizationRequestId") as string | null;

  const specData = vmSpecSchema.parse(Object.fromEntries(formData));
  const sourceRequestId = formData.get("sourceRequestId") as string | null;

  const session = await getServerSession(authOptions);
  if (!session?.user || (!isAdmin(session.user.roles))) {
    throw new Error("Unauthorized");
  }
  const actorId = session.user.id;

  await prisma.$transaction(async (tx) => {
    const spec = await tx.vmSpec.create({
       data:{
        ...specData,
        vmInstanceId: vmId,
        sourceRequestId: viaCustomization ? null : (sourceRequestId || undefined),
        customizationRequestId: viaCustomization ? customizationRequestId || undefined : null,
        effectiveFrom: new Date(),
      },
    });

    await tx.vmInstance.update({
      where: { id: vmId },
       data:{ currentSpecId: spec.id },
    });
    
    if (viaCustomization && customizationRequestId) {
      await tx.customizationRequest.update({
        where: { id: customizationRequestId },
        data: { 
          status: CustomizationStatus.APPLIED
        },
      });
    }
  }, { timeout: 15000 });

  await createAuditLog(
    actorId,
    viaCustomization
      ? "VM_RESOURCES_UPDATED_VIA_CUSTOMIZATION"
      : "VM_RESOURCES_UPDATED",
    "VmSpec",
    vmId,
    specData,
    vmId
  );

  revalidatePath("/inventory/vms");
}


export async function fetchVmDetails(id: string) {
    const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const vm = await prisma.vmInstance.findFirst({
  where: isAdmin(session.user.roles)
    ? { id }
    : { id, ownerId: session.user.id },
  include: VM_FULL_INCLUDE,
});

  return vm;
}

export async function fetchAllVms(page: number = 1, pageSize: number = 20): Promise<{ vms: SerializedVmInstance[], total: number }> {
  const skip = (page - 1) * pageSize;
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const where = isAdmin(session.user.roles) 
    ? {} 
    : { ownerId: session.user.id };

  const [vms, total] = await Promise.all([
    prisma.vmInstance.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        hostname: true,
        ipAddress: true,
        publicIpAddress: true,
        status: true,
        renewalDate: true,
        hasRemoteAccess: true,
        vpnRequired: true,
        subdomain: true,
        updatedAt: true,
        provisionedAt: true,
        currentSpec: {
          select: {
            vcpu: true,
            ramGb: true,
            storageGb: true,
            osName: true,
            osVersion: true,
            raid: true,
          },
        },
        owner: { select: {id: true, name: true, email: true } },  
        request: { select: { requestId: true, systemName: true, environment: true } }, 
      },
    }),
    prisma.vmInstance.count({ where })
  ]);
  return {
    vms: vms.map(vm => {
      const currentSpec = vm.currentSpec ? {
        vcpu: vm.currentSpec.vcpu,
        ramGb: vm.currentSpec.ramGb,
        storageGb: vm.currentSpec.storageGb,
        osName: vm.currentSpec.osName,
        osVersion: vm.currentSpec.osVersion,
        raid: (vm.currentSpec.raid as unknown) as FrontendRaid | null,
      } : null;

      const request = vm.request ? {
        requestId: vm.request.requestId,
        systemName: vm.request.systemName,
        environment: (vm.request.environment as unknown) as FrontendEnvironment | null,
      } : null;

      return {
        id: vm.id,
        hostname: vm.hostname,
        ipAddress: vm.ipAddress,
        publicIpAddress: vm.publicIpAddress,
        status: (vm.status as unknown) as FrontendVmStatus,
        renewalDate: vm.renewalDate?.toISOString() ?? null,
        hasRemoteAccess: vm.hasRemoteAccess,
        vpnRequired: vm.vpnRequired,
        subdomain: vm.subdomain,
        updatedAt: vm.updatedAt.toISOString(),
        provisionedAt: vm.provisionedAt?.toISOString() ?? null,
        currentSpec,
        owner: vm.owner,
        request,
      };
    }),
    total
  };
}

export async function deleteVm(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.roles)) {
    throw new Error("Unauthorized");
  }

  await prisma.vmInstance.delete({ where: { id } });
  revalidatePath("/inventory/vms");
}

export async function renewVmRequest(vmId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");
const requesterId = session.user.id;
  const vm = await prisma.vmInstance.findUnique({
    where: { id: vmId },
    include: { request: true },
  });

  if (!vm) throw new Error("VM not found");

  const renewalRequest = await prisma.$transaction(async (tx) => {
    const created = await tx.request.create({
      data: {
        requestType: RequestType.RENEWAL,
        status: RequestStatus.PENDING_L1,
        targetVmId: vmId,
        requesterId: requesterId,
        systemName: vm.request?.systemName || "VM Renewal",
        environment: vm.request?.environment || "PRODUCTION",
        purpose: `Renewal request for VM ${vm.hostname}`,
        quantity: 1,
        serverType: vm.request?.serverType || "OTHER",
        vcpu: vm.request?.vcpu || 0,
        ramGb: vm.request?.ramGb || 0,
        storageGb: vm.request?.storageGb || 0,
      },
    });

    await generateApprovals(tx, created.id, ApprovalEntityType.REQUEST, RequestType.RENEWAL);

    await tx.auditLog.create({
      data: {
        actorId: requesterId,
        action: "CREATE_RENEWAL",
        entityType: "REQUEST",
        entityId: created.id,
        details: JSON.stringify({ vmId, hostname: vm.hostname }),
      },
    });

    return created;
  }, { timeout: 15000 });

  revalidatePath("/requests");
  return renewalRequest;
}

export async function fetchVmAuditLogs(vmId: string) {
  return prisma.auditLog.findMany({
    where: { vmId },
    orderBy: { timestamp: "desc" },
    take: 20,
  });
}


export async function fetchVmDetailsSerialized(id: string): Promise<SerializedVmInstanceDetail | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const where = isAdmin(session.user.roles) 
    ? { id } 
    : { id, ownerId: session.user.id };

  const vm = await prisma.vmInstance.findUnique({
    where,
    include: SERIALIZED_VM_FULL_INCLUDE,
  });

  if (!vm) return null;

  const currentSpec = vm.currentSpec ? {
    vcpu: vm.currentSpec.vcpu,
    ramGb: vm.currentSpec.ramGb,
    storageGb: vm.currentSpec.storageGb,
    osName: vm.currentSpec.osName,
    osVersion: vm.currentSpec.osVersion,
    raid: (vm.currentSpec.raid as unknown) as FrontendRaid | null,
  } : null;

  const request = vm.request ? {
    requestId: vm.request.requestId,
    systemName: vm.request.systemName,
    environment: (vm.request.environment as unknown) as FrontendEnvironment | null,
  } : null;

  const specHistory = vm.specHistory.map(spec => ({
    id: spec.id,
    vcpu: spec.vcpu,
    ramGb: spec.ramGb,
    storageGb: spec.storageGb,
    osName: spec.osName,
    osVersion: spec.osVersion,
    raid: (spec.raid as unknown) as FrontendRaid | null,
    effectiveFrom: spec.effectiveFrom.toISOString(),
    sourceRequestId: spec.sourceRequestId,
    customizationRequestId: spec.customizationRequestId,
  }));

  const auditLogs = vm.auditLogs.map(log => ({
    id: log.id,
    timestamp: log.timestamp.toISOString(),
    action: log.action,
    actorId: log.actorId,
    actor: log.actor ? { name: log.actor.name, email: log.actor.email } : null,
    details: log.details as Record<string, unknown> | null,
  }));

  return {
    id: vm.id,
    systemName: vm.systemName,
    hostname: vm.hostname,
    ipAddress: vm.ipAddress,
    publicIpAddress: vm.publicIpAddress,
    status: (vm.status as unknown) as FrontendVmStatus,
    renewalDate: vm.renewalDate?.toISOString() ?? null,
    hasRemoteAccess: vm.hasRemoteAccess,
    vpnRequired: vm.vpnRequired,
    subdomain: vm.subdomain,
    updatedAt: vm.updatedAt.toISOString(),
    provisionedAt: vm.provisionedAt?.toISOString() ?? null,
    decommissionedAt: vm.decommissionedAt?.toISOString() ?? null,
    currentSpec,
    owner: vm.owner ? { id: vm.owner.id, name: vm.owner.name, email: vm.owner.email } : null,
    request,
    specHistory,
    auditLogs,
    tags: (vm.tags || []).map((t) => ({
      tag: {
        id: t.tag.id,
        name: t.tag.name,
        description: t.tag.description,
      }
    })),
  };
}