// src/app/actions/access-actions.ts
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { 
  RequestStatus, 
  RequestType, 
  Environment,
  VmStatus,
  AccessType,
  Prisma
} from "@prisma/client";
import { generateApprovals } from "./approval-actions";
import { revalidatePath } from "next/cache";
import { ROLES, hasRole } from "@/lib/roles";

export async function getAccessableVms() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const isAdmin = hasRole(session.user.roles, ROLES.ADMIN);
    
    // Non-admins see their own active VMs, admins see all active VMs
    const whereClause: Prisma.VmInstanceWhereInput = isAdmin
      ? { status: VmStatus.ACTIVE }
      : { ownerId: session.user.id, status: VmStatus.ACTIVE };

    const vms = await prisma.vmInstance.findMany({
      where: whereClause,
      include: {
        currentSpec: true,
        request: {
          select: {
            systemName: true
          }
        }
      },
      orderBy: { hostname: "asc" },
    });

    return vms;
  } catch (error) {
    console.error("Error fetching accessible VMs:", error);
    throw error;
  }
}

export async function createAccessRequest(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const userId = session.user.id;
    const isAdmin = hasRole(session.user.roles, ROLES.ADMIN);
    const isDeveloper = hasRole(session.user.roles, ROLES.DEVELOPER);
    const assignedRequesterId = formData.get("requesterId")?.toString();

    const accessTargetVmId = formData.get("accessTargetVmId")?.toString();
    if (!accessTargetVmId) {
      throw new Error("Target VM is required for access request");
    }

    const targetVm = await prisma.vmInstance.findUnique({
      where: { id: accessTargetVmId },
      include: { owner: true, currentSpec: true, request: true }
    });

    if (!targetVm) {
      throw new Error("Target VM not found");
    }

    // Check ownership
    const effectiveRequesterId = isDeveloper && assignedRequesterId ? assignedRequesterId : userId;
    if (!isAdmin && targetVm.ownerId !== effectiveRequesterId) {
      throw new Error("You can only request access for your own VMs");
    }

    if (targetVm.status !== VmStatus.ACTIVE) {
      throw new Error("Target VM must be ACTIVE to request access");
    }

    const rawAccessType = formData.get("accessType")?.toString();
    if (rawAccessType !== "VPN" && rawAccessType !== "HORIZON") {
      throw new Error("Invalid access type requested");
    }
    const accessType = rawAccessType as AccessType;

    const accessJustification = formData.get("accessJustification")?.toString() || formData.get("purpose")?.toString() || "";

    const requestType = accessType === AccessType.VPN 
      ? RequestType.VPN_ACCESS 
      : RequestType.HORIZON_ACCESS;

    const systemName = targetVm.request?.systemName || targetVm.hostname || "VM";

    const newCreatedRequest = await prisma.$transaction(async (tx) => {
      const created = await tx.request.create({
        data: {
          requestType,
          status: (formData.get("status") as RequestStatus) || RequestStatus.DRAFT,
          quantity: 1,
          systemName: `${accessType === AccessType.VPN ? "VPN" : "Horizon"} Access to ${systemName}`,
          projectName: targetVm.request?.projectName || "Access Request",
          purpose: accessJustification,
          environment: targetVm.environment || Environment.PRODUCTION,
          expectedEndDate: formData.get("expectedEndDate")
            ? new Date(formData.get("expectedEndDate") as string)
            : null,
          expectedDeliveryDate: formData.get("expectedDeliveryDate")
            ? new Date(formData.get("expectedDeliveryDate") as string)
            : null,
          
          requesterId: effectiveRequesterId,
          developerId: isDeveloper ? userId : null,

          // Access specific fields
          accessTargetVmId,
          accessType,
          accessJustification,

          // Copied specs for details panel compatibility
          vcpu: targetVm.currentSpec?.vcpu || 1,
          ramGb: targetVm.currentSpec?.ramGb || 2,
          storageGb: targetVm.currentSpec?.storageGb || 50,
          osName: targetVm.currentSpec?.osName || "Unknown",
          osVersion: targetVm.currentSpec?.osVersion || "Unknown",
          serverType: targetVm.request?.serverType || "OTHER",
        },
      });

      // Only generate approvals if it's being submitted (not draft)
      const isSubmitting = created.status !== RequestStatus.DRAFT;
      if (isSubmitting) {
        await generateApprovals(
          tx,
          created.id,
          "REQUEST",
          requestType
        );
      }

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: "CREATE_ACCESS_REQUEST",
          entityType: "REQUEST",
          entityId: created.id,
          details: JSON.stringify({
            systemName: created.systemName,
            status: created.status,
            accessTargetVmId,
            accessType
          }),
        },
      });

      return created;
    }, { timeout: 15000 });

    revalidatePath("/requests");
    return newCreatedRequest;
  } catch (error) {
    console.error("Error creating access request:", error);
    throw error;
  }
}
