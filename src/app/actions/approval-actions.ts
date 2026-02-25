// src/app/actions/approval-actions.ts

"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { 
  Prisma,
  ApprovalDecision, 
  RequestStatus,
  RequestType,
  VmStatus,
  CustomizationStatus
} from "@prisma/client";
import { ROLES, hasRole } from "@/lib/roles";
import { notifyRequester, notifyDirector, notifyDCOps } from "@/lib/notifications";
import { sendStatusUpdateNotification } from "@/lib/email";
import { redirect } from "next/navigation";
import { fetchDashboardData } from "../approvals/lib";


// ✅ DERIVE NEXT STATUS FROM PENDING APPROVALS (NOT JUST CURRENT STATUS)
async function getNextStatusFromApprovals(
  tx: Prisma.TransactionClient | typeof prisma,
  entityId: string,
  entityType: "REQUEST" | "CUSTOMIZATION",
): Promise<string> {
  // Get all pending approvals for this entity
  const pendingApprovals = await tx.approval.findMany({
    where: {
      ...(entityType === "REQUEST" 
        ? { requestId: entityId } 
        : { customizationRequestId: entityId }),
      decision: ApprovalDecision.PENDING,
    },
    orderBy: { level: "asc" },
    take: 1 // Only need the next pending level
  });

  // If no pending approvals left → APPROVED
  if (pendingApprovals.length === 0) {
    return entityType === "REQUEST" ? RequestStatus.APPROVED : CustomizationStatus.APPROVED;
  }

  // Map next pending level to status
  const nextLevel = pendingApprovals[0].level;
  switch (nextLevel) {
    case 1: return RequestStatus.PENDING_L1;
    case 2: return RequestStatus.PENDING_L2;
    case 3: return RequestStatus.PENDING_L3;
    case 4: return RequestStatus.PENDING_L4;
    default: return RequestStatus.PENDING_L3; 
  }
}

// ✅ HANDLE APPROVAL DECISION WITH DYNAMIC ESCALATION
export async function handleApprovalDecision(
  approvalId: string,
  decision: ApprovalDecision,
  comments?: string,
  escalateToLevel?: number
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const approvalRecord = await prisma.approval.findFirst({
    where: {
      OR: [
        { id: approvalId }, // Try primary key first
        { 
          AND: [
            { requestId: approvalId },
            { approverId: session.user.id },
            { decision: ApprovalDecision.PENDING }
          ]
        },
        {
          AND: [
            { customizationRequestId: approvalId },
            { approverId: session.user.id },
            { decision: ApprovalDecision.PENDING }
          ]
        }
      ]
    }
  });

  if (!approvalRecord) {
    throw new Error("Approval record not found or already processed");
  }

  const resolvedApprovalId = approvalRecord.id;

  return await prisma.$transaction(async (tx) => {
    // 1. Fetch approval with all possible relations using the RESOLVED ID
    const approval = await tx.approval.findUnique({
      where: { id: resolvedApprovalId },
      include: { 
        request: { include: { requester: true, vmInstances: true, targetVm: true } },
        customizationRequest: { include: { requester: true, targetVm: true } }
      }
    });

    if (!approval) throw new Error("Approval record not found during transaction");
    if (approval.decision !== ApprovalDecision.PENDING) {
      throw new Error(`This approval has already been processed: ${approval.decision}`);
    }
    if (approval.approverId !== session.user.id) {
      throw new Error("You can only act on approvals assigned to you");
    }

    const entityType = approval.entityType;
    
    // 2. Narrow the type and handle specifics
    let entityId: string;
    let systemName: string;
    let requesterId: string | null;
    let requesterEmail: string | null = null;
    let requesterName: string | null = null;

    if (entityType === "REQUEST" && approval.request) {
      entityId = approval.request.id;
      systemName = approval.request.systemName;
      requesterId = approval.request.requesterId;
      requesterEmail = approval.request.requester?.email || null;
      requesterName = approval.request.requester?.name || null;
    } else if (entityType === "CUSTOMIZATION" && approval.customizationRequest) {
      entityId = approval.customizationRequest.id;
      systemName = approval.customizationRequest.targetVm?.hostname || "Resource Customization";
      requesterId = approval.customizationRequest.requesterId;
      requesterEmail = approval.customizationRequest.requester?.email || null;
      requesterName = approval.customizationRequest.requester?.name || null;
    } else {
      throw new Error("Linked entity not found for this approval record.");
    }

    // 3. Validation
    if ((decision === ApprovalDecision.REJECTED || decision === ApprovalDecision.RETURNED) && !comments?.trim()) {
      throw new Error("Comments are mandatory for rejections or returns");
    }

    // 4. Update Approval Record using the RESOLVED ID
    await tx.approval.update({
      where: { id: resolvedApprovalId },
      data: { decision, comments: comments || null, decidedAt: new Date() },
    });

    // 5. Handle Escalation logic (L3 -> L4)
    let directorId: string | undefined;
    if (escalateToLevel && decision === ApprovalDecision.APPROVED) {
      const director = await tx.user.findFirst({
        where: { 
          isActive: true,
          roles: { some: { role: { name: ROLES.L4_APPROVER } } }
        }
      });
      if (!director) throw new Error("Director approver not found");
      directorId = director.id;

      await tx.approval.create({
        data: {
          entityType,
          level: escalateToLevel,
          approverId: director.id,
          decision: ApprovalDecision.PENDING,
          comments: `Escalated from level ${approval.level}: ${comments || "No comments"}`,
          ...(entityType === "REQUEST" ? { requestId: entityId } : { customizationRequestId: entityId }),
        },
      });
    }

    // 6. Calculate and Update Entity Status
    let nextStatus: string;
    if (decision === ApprovalDecision.REJECTED) {
      nextStatus = RequestStatus.REJECTED;
    } else if (decision === ApprovalDecision.RETURNED) {
      nextStatus = RequestStatus.DRAFT;
    } else {
      nextStatus = await getNextStatusFromApprovals(tx, entityId, entityType as "REQUEST" | "CUSTOMIZATION");
    }

    if (entityType === "REQUEST") {
      await tx.request.update({
        where: { id: entityId },
        data: { status: nextStatus as RequestStatus },
      });
    } else {
      await tx.customizationRequest.update({
        where: { id: entityId },
        data: { status: nextStatus as CustomizationStatus },
      });
    }

    // 7. Audit Log
    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        action: escalateToLevel ? `ESCALATE_TO_L${escalateToLevel}` : `APPROVAL_${decision}_L${approval.level}`,
        entityType,
        entityId: entityId,
        details: JSON.stringify({ comments, nextStatus }),
      },
    });

    // 8. Notifications
    if (requesterId && (decision === ApprovalDecision.REJECTED || nextStatus === "APPROVED")) {
      await notifyRequester(requesterId, systemName, decision === ApprovalDecision.REJECTED ? "REJECTED" : "APPROVED");
      
      // Send email notification to requester
      if (requesterEmail && requesterName) {
        await sendStatusUpdateNotification(
          requesterEmail,
          requesterName,
          systemName,
          decision === ApprovalDecision.REJECTED ? "REJECTED" : "APPROVED",
          comments || undefined
        );
      }
    }

    if (nextStatus === "APPROVED") {
      await notifyDCOps(entityId, systemName);
    }

    if (escalateToLevel === 4 && directorId) {
      await notifyDirector(directorId, systemName, entityId);
    }

    return { success: true, status: nextStatus, escalated: !!escalateToLevel };
  }, { timeout: 30000 });
}

// ✅ FORWARD TO DIRECTOR (L3 → L4 ESCALATION)
// Updating signature to take approvalId for consistency with handleApprovalDecision
export async function forwardToDirector(
  approvalId: string,
  comments: string
) {
  // Re-use handleApprovalDecision logic for escalation
  // This automatically handles Request vs Customization, ID resolution, and L4 creation
  return await handleApprovalDecision(
    approvalId,
    ApprovalDecision.APPROVED,
    `FORWARDED: ${comments}`,
    4 // Level 4 (Director)
  );
}


export async function executeRequest(requestId: string, notes?: string) {
  const session = await getServerSession(authOptions);

  if (
    !session?.user ||
    (!hasRole(session.user.roles, ROLES.DCOPS) &&
      !hasRole(session.user.roles, ROLES.ADMIN))
  ) {
    throw new Error("Only DCOPS or ADMIN can execute requests");
  }

  const userId = session.user.id;

  // Try request first, then customization
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      vmInstances: true,
      targetVm: true,
      requester: true,
    },
  });

  const customization = !request
    ? await prisma.customizationRequest.findUnique({
        where: { id: requestId },
        include: {
          targetVm: { include: { currentSpec: true } },
          requester: true,
        },
      })
    : null;

  if (!request && !customization) {
    throw new Error("Entity not found");
  }

  // Status validation
  if (request && request.status !== RequestStatus.APPROVED) {
    throw new Error(`Request must be APPROVED to execute (current: ${request.status})`);
  }
  if (customization && customization.status !== CustomizationStatus.APPROVED) {
    throw new Error(`Customization must be APPROVED to execute (current: ${customization.status})`);
  }

  return await prisma.$transaction(async (tx) => {
    if (request) {
      // DECOMMISSION: Retire VMs immediately
      if (request.requestType === RequestType.DECOMMISSION) {
        const vms = request.vmInstances.length > 0
          ? request.vmInstances
          : request.targetVm
          ? [request.targetVm]
          : [];

        if (vms.length === 0) {
          throw new Error("No VMs found to decommission");
        }

        await tx.vmInstance.updateMany({
          where: { id: { in: vms.map(v => v.id) } },
          data: {
            status: VmStatus.RETIRED,
            decommissionedAt: new Date(),
          },
        });

        await tx.request.update({
          where: { id: requestId },
          data: { status: RequestStatus.CLOSED },
        });

        if (request.requesterId) {
          await notifyRequester(
            request.requesterId,
            request.systemName || "Decommissioned VM",
            "DECOMMISSIONED"
          );
        }
      } 
      // NEW_VM/RENEWAL: Mark as provisioned (VMs created via executeRequestWithVmInputs)
      else {
        await tx.request.update({
          where: { id: requestId },
          data: {
            status: RequestStatus.PROVISIONED,
            provisionedAt: new Date(),
          },
        });

        if (request.requesterId) {
          await notifyRequester(
            request.requesterId,
            request.systemName || "Provisioned VM",
            "PROVISIONED"
          );
        }
      }
    }

    // CUSTOMIZATION: Apply spec changes
    if (customization) {
      const latestSpec = await tx.vmSpec.findFirst({
        where: { vmInstanceId: customization.targetVmId! },
        orderBy: { createdAt: "desc" },
      });

      const vcpu = customization.vcpu ?? latestSpec?.vcpu ?? 2;
      const ramGb = customization.ramGb ?? latestSpec?.ramGb ?? 4;
      const storageGb = customization.storageGb ?? latestSpec?.storageGb ?? 50;

      const newSpec = await tx.vmSpec.create({
        data: {
          vmInstanceId: customization.targetVmId!,
          vcpu,
          ramGb,
          storageGb,
          osName: latestSpec?.osName || null,
          osVersion: latestSpec?.osVersion || null,
          raid: latestSpec?.raid || null,
          effectiveFrom: new Date(),
          appliedById: userId,
          customizationRequestId: customization.id,
        },
      });

      await tx.vmInstance.update({
        where: { id: customization.targetVmId! },
        data: { 
          currentSpecId: newSpec.id,
          status: VmStatus.ACTIVE,
        },
      });

      await tx.customizationRequest.update({
        where: { id: requestId },
        data: { status: CustomizationStatus.APPLIED },
      });

      const vmHostname = customization.targetVm?.hostname || "VM";
      if (customization.requesterId) {
        await notifyRequester(
          customization.requesterId,
          vmHostname,
          "CUSTOMIZATION_APPLIED"
        );
      }
    }

    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: request ? "EXECUTE_REQUEST" : "APPLY_CUSTOMIZATION",
        entityType: request ? "REQUEST" : "CUSTOMIZATION",
        entityId: requestId,
        details: JSON.stringify({ notes: notes || "No notes provided" }),
      },
    });

    return { success: true };
  }, { timeout: 15000 });
}

// VM input interface
interface VmExecutionInput {
  sequenceNumber: number;
  hostname: string;
  ipAddress: string;
  publicIpAddress: string;
  subdomain: string;
}

export async function executeRequestWithVmInputs(
  requestId: string,
  vmInputs: VmExecutionInput[],
  notes?: string
) {
  const session = await getServerSession(authOptions);

  if (
    !session?.user ||
    (!hasRole(session.user.roles, ROLES.DCOPS) &&
      !hasRole(session.user.roles, ROLES.ADMIN))
  ) {
    throw new Error("Only DCOPS or ADMIN can execute requests");
  }

  const userId = session.user.id;

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      vmInstances: true,
      requester: true,
    },
  });

  if (!request) {
    throw new Error("Request not found");
  }

  if (request.status !== RequestStatus.APPROVED) {
    throw new Error(`Request must be APPROVED to execute (current: ${request.status})`);
  }

  if (request.requestType !== RequestType.NEW_VM) {
    throw new Error("This function is only for NEW_VM requests");
  }

  // Validate VM inputs
  if (vmInputs.length !== request.quantity) {
    throw new Error(`Expected ${request.quantity} VM inputs, got ${vmInputs.length}`);
  }

  for (const vm of vmInputs) {
    if (!vm.hostname?.trim()) {
      throw new Error(`Hostname is required for VM ${vm.sequenceNumber}`);
    }
    if (!vm.ipAddress?.trim()) {
      throw new Error(`IP Address is required for VM ${vm.sequenceNumber}`);
    }
  }

  return await prisma.$transaction(async (tx) => {
    // Create VM instances with provided details
    for (const vmInput of vmInputs) {
      const createdVm = await tx.vmInstance.create({
        data: {
          requestId: request.id,
          sequenceNumber: vmInput.sequenceNumber,
          ownerId: request.requesterId,
          hostname: vmInput.hostname,
          ipAddress: vmInput.ipAddress,
          publicIpAddress: vmInput.publicIpAddress || null,
          subdomain: vmInput.subdomain || request.subdomain || null,
          status: VmStatus.ACTIVE,
          provisionedAt: new Date(),
          environment: request.environment,
        },
      });

      const spec = await tx.vmSpec.create({
        data: {
          vmInstanceId: createdVm.id,
          vcpu: request.vcpu || 1,
          ramGb: request.ramGb || 2,
          storageGb: request.storageGb || 50,
          osName: request.osName,
          osVersion: request.osVersion,
          raid: request.raid,
          effectiveFrom: new Date(),
          sourceRequestId: request.id,
        },
      });

      await tx.vmInstance.update({
        where: { id: createdVm.id },
        data: { currentSpecId: spec.id },
      });
    }

    // Update request status
    await tx.request.update({
      where: { id: requestId },
      data: {
        status: RequestStatus.PROVISIONED,
        provisionedAt: new Date(),
      },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: "EXECUTE_REQUEST_WITH_VM_DETAILS",
        entityType: "REQUEST",
        entityId: requestId,
        details: JSON.stringify({
          notes: notes || "No notes provided",
          vmCount: vmInputs.length,
          vmDetails: vmInputs.map(v => ({
            hostname: v.hostname,
            ipAddress: v.ipAddress,
            subdomain: v.subdomain
          }))
        }),
      },
    });

    // Notify requester
    if (request.requesterId) {
      await notifyRequester(
        request.requesterId,
        request.systemName || "Provisioned VM",
        "PROVISIONED"
      );
    }

    return { success: true, vmCount: vmInputs.length };
  }, { timeout: 30000 });
}

export async function getDashboardData() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth");

  const userRoles = session.user.roles;
  const isAdmin = userRoles.includes(ROLES.ADMIN);

  return fetchDashboardData(session.user.id, userRoles, isAdmin);
}