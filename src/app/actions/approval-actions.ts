// src/app/actions/approval-actions.ts

"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { 
  ApprovalDecision, 
  RequestStatus,
  RequestType,
  VmStatus,
  CustomizationStatus,
  ApprovalEntityType
} from "@prisma/client";
import { ROLES, hasRole } from "@/lib/roles";
import { notifyRequester, notifyDirector } from "@/lib/notifications";
import { redirect } from "next/navigation";
import { fetchDashboardData } from "../approvals/lib";

// ✅ VALIDATE UUID FORMAT
function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// ✅ DERIVE NEXT STATUS FROM PENDING APPROVALS (NOT JUST CURRENT STATUS)
async function getNextStatusFromApprovals(
  entityId: string,
  entityType: "REQUEST" | "CUSTOMIZATION",
): Promise<string> {
  // Get all pending approvals for this entity
  const pendingApprovals = await prisma.approval.findMany({
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
    case 4: return RequestStatus.PENDING_L4; // Director escalation
    default: return RequestStatus.PENDING_L3; // Fallback for higher levels
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
  let requestApprovalId;
  if (!session?.user) throw new Error("Unauthorized");
  if (!isValidUUID(approvalId)) throw new Error("Invalid approval ID");

  const request = await prisma.approval.findFirst({
    where: { requestId: approvalId, approverId: session.user.id,  decision: ApprovalDecision.PENDING }
  });

  if(!request){
    const customizationRequest = await prisma.approval.findFirst({
      where: { customizationRequestId: approvalId, approverId: session.user.id, decision: ApprovalDecision.PENDING }
    });
    if(!customizationRequest){
      throw new Error("Approval record not found or already processed");
    }
    requestApprovalId = customizationRequest.id;
    
  }
  else{
    requestApprovalId = request.id;
  }
    return await prisma.$transaction(async (tx) => {
      // 1. Fetch approval with all possible relations
      const approval = await tx.approval.findUnique({
        where: { id: requestApprovalId },
      include: { 
        request: { include: { requester: true, vmInstances: true, targetVm: true } },
        customizationRequest: { include: { requester: true, targetVm: true } }
      }
    });

    if (!approval) throw new Error("Approval record not found or already processed");
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

    if (entityType === "REQUEST" && approval.request) {
      entityId = approval.request.id;
      systemName = approval.request.systemName;
      requesterId = approval.request.requesterId;
    } else if (entityType === "CUSTOMIZATION" && approval.customizationRequest) {
      entityId = approval.customizationRequest.id;
      systemName = approval.customizationRequest.targetVm?.hostname || "Resource Customization";
      requesterId = approval.customizationRequest.requesterId;
    } else {
      throw new Error("Linked entity not found for this approval record.");
    }

    // 3. Validation
    if ((decision === ApprovalDecision.REJECTED || decision === ApprovalDecision.RETURNED) && !comments?.trim()) {
      throw new Error("Comments are mandatory for rejections or returns");
    }

    // 4. Update Approval Record
    await tx.approval.update({
      where: { id: approvalId },
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
    const nextStatus = await getNextStatusFromApprovals(entityId, entityType as "REQUEST" | "CUSTOMIZATION");

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
    }

    if (escalateToLevel === 4 && directorId) {
      await notifyDirector(directorId, systemName, entityId);
    }

    return { success: true, status: nextStatus, escalated: !!escalateToLevel };
  }, { timeout: 30000 });
}

// ✅ FORWARD TO DIRECTOR (L3 → L4 ESCALATION)
export async function forwardToDirector(
  requestId: string,
  comments: string
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");
  if (!isValidUUID(requestId)) throw new Error("Invalid request ID");

  return await prisma.$transaction(async (tx) => {
    // Verify request exists and is at L3 stage
    const request = await tx.request.findUnique({
      where: { id: requestId },
      include: { 
        approvals: { 
          where: { 
            level: 3, // ✅ NUMERIC LEVEL (was L3 enum)
            decision: ApprovalDecision.PENDING 
          },
          orderBy: { createdAt: "asc" }
        },
        requester: true,
      }
    });

    if (!request) throw new Error("Request not found");
    if (request.status !== RequestStatus.PENDING_L3) {
      throw new Error(`Request must be in PENDING_L3 status to forward to director (current: ${request.status})`);
    }

    // Verify current user is the L3 approver
    const l3Approval = request.approvals.find(a => a.approverId === session.user.id);
    if (!l3Approval) {
      throw new Error("Only the L3 approver can forward this request to the director");
    }

    // Get director user
    const director = await tx.user.findFirst({
      where: { 
        isActive: true,
        roles: { some: { role: { name: ROLES.L4_APPROVER } } }
      }
    });
    if (!director) throw new Error("Director approver not found");

    // ✅ CREATE L4 APPROVAL (DYNAMIC LEVEL 4)
    await tx.approval.create({
      data: {
        entityType: ApprovalEntityType.REQUEST,
        level: 4, // ✅ DYNAMIC LEVEL 4 (was impossible with enum)
        approverId: director.id,
        requestId,
        decision: ApprovalDecision.PENDING,
        comments: `Escalated by L3 approver (${session.user.name}): ${comments}`,
      },
    });

    // ✅ UPDATE REQUEST STATUS TO PENDING_L4
    await tx.request.update({
      where: { id: requestId },
      data: { status: RequestStatus.PENDING_L4 },
    });

    // ✅ AUDIT LOG
    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "FORWARD_TO_DIRECTOR",
        entityType: "REQUEST",
        entityId: requestId,
        details: JSON.stringify({
          comments,
          previousStatus: RequestStatus.PENDING_L3,
          newStatus: RequestStatus.PENDING_L4,
        }),
      },
    });

    // ✅ NOTIFY DIRECTOR
    await notifyDirector(director.id, request.systemName, requestId);

    return { success: true, status: RequestStatus.PENDING_L4 };
  }, { timeout: 15000 });
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

        // ✅ FIX 4: Safe nullable check before notification
        if (request.requesterId) {
          await notifyRequester(
            request.requesterId,
            request.systemName || "Decommissioned VM",
            "DECOMMISSIONED"
          );
        }
      } 
      // NEW_VM/RENEWAL: Mark as provisioned
      else {
        await tx.request.update({
          where: { id: requestId },
          data: {
            status: RequestStatus.PROVISIONED,
            provisionedAt: new Date(),
          },
        });

        // Optional: Create VM instances if not already created
        if (request.vmInstances.length === 0 && request.targetVmId) {
          await tx.vmInstance.update({
            where: { id: request.targetVmId },
            data: { status: VmStatus.ACTIVE },
          });
        }

        // ✅ FIX 4: Safe nullable check before notification
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
        where: { vmInstanceId: customization.targetVmId! }, // ✅ Non-null assertion (validated earlier)
        orderBy: { createdAt: "desc" },
      });

      const vcpu = customization.vcpu ?? latestSpec?.vcpu ?? 2;
      const ramGb = customization.ramGb ?? latestSpec?.ramGb ?? 4;
      const storageGb = customization.storageGb ?? latestSpec?.storageGb ?? 50;

      // Create new spec version
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

      // Update VM to use new spec
      await tx.vmInstance.update({
        where: { id: customization.targetVmId! },
        data: { 
          currentSpecId: newSpec.id,
          status: VmStatus.ACTIVE,
        },
      });

      // Mark customization as applied
      await tx.customizationRequest.update({
        where: { id: requestId },
        data: { status: CustomizationStatus.APPLIED },
      });

      // ✅ FIX 4: Safe nullable checks before notification
      const vmHostname = customization.targetVm?.hostname || "VM";
      if (customization.requesterId) {
        await notifyRequester(
          customization.requesterId,
          vmHostname,
          "CUSTOMIZATION_APPLIED"
        );
      }
    }

    // Audit log for execution
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: request ? "EXECUTE_REQUEST" : "APPLY_CUSTOMIZATION",
        entityType: request ? "REQUEST" : "CUSTOMIZATION",
        entityId: requestId,
        details: JSON.stringify({ notes: notes || "No notes provided" }), // ✅ Handle nullable notes
      },
    });

    return { success: true };
  }, { timeout: 15000 });
}

export async function getDashboardData() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth");

  const userRoles = session.user.roles;
  const isAdmin = userRoles.includes(ROLES.ADMIN);

  return fetchDashboardData(userRoles, isAdmin);
}