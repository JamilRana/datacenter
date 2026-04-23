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
import { RoleService } from "@/lib/services/role.service";
import { NotificationService } from "@/lib/services/notification.service";
import { UserRole } from "@/lib/types/enums";
import { ApiResponse } from "@/types";
import { 
  getWorkflowConfig, 
  getStatusForLevel, 
  getNextLevel,
  WorkflowConfig
} from "@/lib/workflow";
import { redirect } from "next/navigation";
import { fetchDashboardData } from "../approvals/lib";
import { revalidatePath } from "next/cache";
import { invalidateCache } from "@/lib/redis";

export async function generateApprovals(
  tx: Prisma.TransactionClient,
  entityId: string,
  entityType: "REQUEST" | "CUSTOMIZATION",
  requestType: RequestType
) {
  const workflow = await getWorkflowConfig(requestType);
  
  // Rule: Only create Level 1 approval initially
  const firstLevel = workflow.levels.find(l => l.level === 1);
  if (!firstLevel) return;

  const firstLevelApprover = await tx.user.findFirst({
    where: {
      isActive: true,
      roles: {
        some: {
          role: {
            name: firstLevel.role
          }
        }
      }
    }
  });

  if (firstLevelApprover) {
    await tx.approval.create({
      data: {
        entityType,
        level: 1,
        approverId: firstLevelApprover.id,
        decision: ApprovalDecision.PENDING,
        ...(entityType === "REQUEST" ? { requestId: entityId } : { customizationRequestId: entityId }),
      },
    });

    // Notify Level 1 approvers (actually just the one assigned, or all of that role?)
    // The current implementation assigns to ONE.
    // Let's stick to the current logic of choosing one but notifying all if needed.
    // The NotificationService handles notifying ALL of that role.
    const systemName = entityType === "REQUEST" 
      ? (await tx.request.findUnique({ where: { id: entityId }, select: { systemName: true } }))?.systemName || "New Request"
      : "Customization Request";
      
    await NotificationService.notifyApprovers(entityId, systemName, 1);
  }
}

export async function getWorkflowForRequest(requestType: string): Promise<WorkflowConfig> {
  return getWorkflowConfig(requestType);
}


// ✅ DYNAMIC STATUS DERIVATION
async function getNextStatusFromApprovals(
  tx: Prisma.TransactionClient | typeof prisma,
  entityId: string,
  entityType: "REQUEST" | "CUSTOMIZATION",
): Promise<string> {
  const pendingApprovals = await tx.approval.findMany({
    where: {
      ...(entityType === "REQUEST" 
        ? { requestId: entityId } 
        : { customizationRequestId: entityId }),
      decision: ApprovalDecision.PENDING,
    },
    orderBy: { level: "asc" },
    take: 1
  });

  if (pendingApprovals.length === 0) {
    return entityType === "REQUEST" ? RequestStatus.APPROVED : CustomizationStatus.APPROVED;
  }

  const nextLevel = pendingApprovals[0].level;
  return getStatusForLevel(nextLevel);
}

// ✅ HANDLE APPROVAL DECISION WITH DYNAMIC ESCALATION
export async function handleApprovalDecision(
  approvalId: string,
  decision: ApprovalDecision,
  comments?: string,
  forwardToLevel?: number
): Promise<ApiResponse<{ status: string; action: string; forwardedToLevel?: number }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };

  const approvalRecord = await prisma.approval.findFirst({
    where: {
      OR: [
        { id: approvalId },
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
    return { success: false, error: "Approval record not found or already processed", code: "NOT_FOUND" };
  }

  const resolvedApprovalId = approvalRecord.id;

  return await prisma.$transaction(async (tx) => {
    const approval = await tx.approval.findUnique({
      where: { id: resolvedApprovalId },
      include: { 
        request: { include: { requester: true, vmInstances: true, targetVm: true } },
        customizationRequest: { include: { requester: true, targetVm: true } }
      }
    });

    if (!approval) return { success: false, error: "Approval record not found during transaction" };
    if (approval.decision !== ApprovalDecision.PENDING) {
      return { success: false, error: `This approval has already been processed: ${approval.decision}` };
    }
    if (approval.approverId !== session.user.id) {
      return { success: false, error: "You can only act on approvals assigned to you" };
    }

    const entityType = approval.entityType;
    
    let entityId: string;
    let systemName: string;
    let requesterId: string | null;
    let requestType: string = "NEW_VM";

    if (entityType === "REQUEST" && approval.request) {
      entityId = approval.request.id;
      systemName = approval.request.systemName;
      requestType = approval.request.requestType;
      requesterId = approval.request.requesterId;
    } else if (entityType === "CUSTOMIZATION" && approval.customizationRequest) {
      entityId = approval.customizationRequest.id;
      systemName = approval.customizationRequest.targetVm?.hostname || "Resource Customization";
      requestType = "CUSTOMIZED";
      requesterId = approval.customizationRequest.requesterId;
    } else {
      return { success: false, error: "Linked entity not found for this approval record." };
    }

    // Validation
    if ((decision === ApprovalDecision.REJECTED || decision === ApprovalDecision.RETURNED) && !comments?.trim()) {
      return { success: false, error: "Comments are mandatory for rejections or returns" };
    }

    // Update Approval Record
    await tx.approval.update({
      where: { id: resolvedApprovalId },
      data: { decision, comments: comments || null, decidedAt: new Date() },
    });

    // Handle RETURN - return to draft
    if (decision === ApprovalDecision.RETURNED) {
      // Create audit log
      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: `APPROVAL_RETURNED_L${approval.level}`,
          entityType,
          entityId: entityId,
          details: JSON.stringify({ comments, nextStatus: "DRAFT" }),
        },
      });

      if (entityType === "REQUEST") {
        await tx.request.update({
          where: { id: entityId },
          data: { status: RequestStatus.DRAFT },
        });
      } else {
        await tx.customizationRequest.update({
          where: { id: entityId },
          data: { status: CustomizationStatus.DRAFT },
        });
      }

      return { success: true, data: { status: "DRAFT", action: "RETURNED" } };
    }

    // Handle FORWARD - forward to higher level using dynamic workflow
    if (forwardToLevel && decision === ApprovalDecision.APPROVED) {
      const workflow = await getWorkflowConfig(requestType);
      const nextLevel = workflow.levels.find(l => l.level === forwardToLevel);
      
      if (!nextLevel) {
        return { success: false, error: `No workflow level found for level ${forwardToLevel}` };
      }

      // Check if forward target is DC_OPS
      if (nextLevel.role === "DC_OPS") {
        // Forwarding to DC_OPS - set status to APPROVED for provisioning
        await tx.auditLog.create({
          data: {
            actorId: session.user.id,
            action: `APPROVAL_FORWARDED_TO_DC_OPS`,
            entityType,
            entityId: entityId,
            details: JSON.stringify({ comments, forwardFromLevel: approval.level }),
          },
        });
        
        // Create pending approval for DC_OPS
        const dcOpsUsers = await tx.user.findMany({
          where: { 
            isActive: true,
            roles: { some: { role: { name: "DC_OPS" } } }
          }
        });
        
        for (const dcOpsUser of dcOpsUsers) {
          await tx.approval.create({
            data: {
              entityType,
              level: nextLevel.level,
              approverId: dcOpsUser.id,
              decision: ApprovalDecision.PENDING,
              comments: `Forwarded to DC_OPS for provisioning from level ${approval.level}: ${comments || ""}`,
              ...(entityType === "REQUEST" ? { requestId: entityId } : { customizationRequestId: entityId }),
            },
          });
        }
        
        return { success: true, data: { status: RequestStatus.APPROVED, action: "FORWARDED_TO_DCOPS", forwardedToLevel: forwardToLevel } };
      }

      const nextApprover = await tx.user.findFirst({
        where: { 
          isActive: true,
          roles: { some: { role: { name: nextLevel.role } } }
        }
      });
      
      if (!nextApprover) {
        return { success: false, error: `No approver found for role: ${nextLevel.role}` };
      }

      await tx.approval.create({
        data: {
          entityType,
          level: forwardToLevel,
          approverId: nextApprover.id,
          decision: ApprovalDecision.PENDING,
          comments: `Forwarded from level ${approval.level}: ${comments || "No comments"}`,
          ...(entityType === "REQUEST" ? { requestId: entityId } : { customizationRequestId: entityId }),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: `APPROVAL_FORWARDED_L${approval.level}_TO_L${forwardToLevel}`,
          entityType,
          entityId: entityId,
          details: JSON.stringify({ comments, nextStatus: getStatusForLevel(forwardToLevel) }),
        },
      });

      return { success: true, data: { status: getStatusForLevel(forwardToLevel), action: "FORWARDED", forwardedToLevel: forwardToLevel } };
    }

    // 6. Handle APPROVED - check if there's a next level in workflow
    let nextStatus: string;
    
    if (decision === ApprovalDecision.REJECTED) {
      nextStatus = RequestStatus.REJECTED;
    } else if (decision === ApprovalDecision.APPROVED) {
      const workflow = await getWorkflowConfig(requestType);
      
      // Get current level config to check if it's final
      const currentLevelConfig = workflow.levels.find(l => l.level === approval.level);
      const isCurrentLevelFinal = currentLevelConfig?.isFinal || false;
      
      // Get next level in workflow
      const nextLevel = await getNextLevel(approval.level, workflow);
      
      if (!nextLevel) {
        // No more levels - this is the final approval
        // If current level is marked as final, set to APPROVED (or APPROVED for DCOPS to provision)
        if (isCurrentLevelFinal && currentLevelConfig?.role === "DC_OPS") {
          nextStatus = RequestStatus.APPROVED;
        } else if (isCurrentLevelFinal) {
          nextStatus = RequestStatus.APPROVED;
        } else {
          // Fallback - should not happen if workflow is configured correctly
          nextStatus = RequestStatus.APPROVED;
        }
      } else {
        // There's a next level - check if it's DC_OPS
        if (nextLevel.role === "DC_OPS") {
          // Final approval before DC_OPS - set to APPROVED so DCOPS can provision
          nextStatus = RequestStatus.APPROVED;
          
          // Create a pending approval for DC_OPS so it appears in DCOPS dashboard
          const dcOpsUsers = await tx.user.findMany({
            where: { 
              isActive: true,
              roles: { some: { role: { name: "DC_OPS" } } }
            }
          });
          
          for (const dcOpsUser of dcOpsUsers) {
            await tx.approval.create({
              data: {
                entityType,
                level: nextLevel.level,
                approverId: dcOpsUser.id,
                decision: ApprovalDecision.PENDING,
                comments: `Ready for provisioning after final approval at level ${approval.level}`,
                ...(entityType === "REQUEST" ? { requestId: entityId } : { customizationRequestId: entityId }),
              },
            });
          }
        } else {
          // Next is another approver level - create pending approval for them
          const nextApprover = await tx.user.findFirst({
            where: { 
              isActive: true,
              roles: { some: { role: { name: nextLevel.role } } }
            }
          });
          
          if (nextApprover) {
            await tx.approval.create({
              data: {
                entityType,
                level: nextLevel.level,
                approverId: nextApprover.id,
                decision: ApprovalDecision.PENDING,
                comments: `Auto-escalated from level ${approval.level}: ${comments || "Approved"}`,
                ...(entityType === "REQUEST" ? { requestId: entityId } : { customizationRequestId: entityId }),
              },
            });
            await NotificationService.notifyApprovers(entityId, systemName, nextLevel.level);
            nextStatus = getStatusForLevel(nextLevel.level);
          } else {
            // No approver found - finalize the request
            nextStatus = RequestStatus.APPROVED;
          }
        }
      }
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
        action: `APPROVAL_${decision}_L${approval.level}`,
        entityType,
        entityId: entityId,
        details: JSON.stringify({ comments, nextStatus }),
      },
    });

    // 8. Notifications
    if (requesterId && (decision === ApprovalDecision.REJECTED || nextStatus === "APPROVED")) {
      await NotificationService.notifyRequester(
        requesterId, 
        systemName, 
        decision === ApprovalDecision.REJECTED ? "REJECTED" : "APPROVED",
        comments || undefined
      );
    }

    if (nextStatus === "APPROVED") {
      await NotificationService.notifyDCOps(entityId, systemName);
    }

    await invalidateCache('admin_dashboard_data');
    return { success: true, data: { status: nextStatus, action: decision } };
  }, { timeout: 30000 });
}

// ✅ FORWARD TO HIGHER LEVEL - Uses dynamic workflow
export async function forwardToLevel(
  approvalId: string,
  targetLevel: number,
  comments: string
) {
  return await handleApprovalDecision(
    approvalId,
    ApprovalDecision.APPROVED,
    comments,
    targetLevel
  );
}


export async function executeRequest(requestId: string, notes?: string): Promise<ApiResponse> {
  const session = await getServerSession(authOptions);

  if (
    !session?.user ||
    (!RoleService.hasRole(session.user.roles, UserRole.DCOPS) &&
      !RoleService.hasRole(session.user.roles, UserRole.ADMIN))
  ) {
    return { success: false, error: "Only DCOPS or ADMIN can execute requests", code: "FORBIDDEN" };
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
    return { success: false, error: "Entity not found", code: "NOT_FOUND" };
  }

  // Status validation
  if (request && request.status !== RequestStatus.APPROVED) {
    return { success: false, error: `Request must be APPROVED to execute (current: ${request.status})` };
  }
  if (customization && customization.status !== CustomizationStatus.APPROVED) {
    return { success: false, error: `Customization must be APPROVED to execute (current: ${customization.status})` };
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
          return { success: false, error: "No VMs found to decommission" };
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
          await NotificationService.notifyRequester(
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
          await NotificationService.notifyRequester(
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
        await NotificationService.notifyRequester(
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

    revalidatePath("/inventory/vms");
    await invalidateCache('admin_dashboard_data');
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
): Promise<ApiResponse<{ vmCount: number }>> {
  const session = await getServerSession(authOptions);

  if (
    !session?.user ||
    (!RoleService.hasRole(session.user.roles, UserRole.DCOPS) &&
      !RoleService.hasRole(session.user.roles, UserRole.ADMIN))
  ) {
    return { success: false, error: "Only DCOPS or ADMIN can execute requests", code: "FORBIDDEN" };
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
    return { success: false, error: "Request not found", code: "NOT_FOUND" };
  }

  if (request.status !== RequestStatus.APPROVED) {
    return { success: false, error: `Request must be APPROVED to execute (current: ${request.status})` };
  }

  if (request.requestType !== RequestType.NEW_VM) {
    return { success: false, error: "This function is only for NEW_VM requests" };
  }

  // Validate VM inputs
  if (vmInputs.length !== request.quantity) {
    return { success: false, error: `Expected ${request.quantity} VM inputs, got ${vmInputs.length}` };
  }

  for (const vm of vmInputs) {
    if (!vm.hostname?.trim()) {
      return { success: false, error: `Hostname is required for VM ${vm.sequenceNumber}` };
    }
    if (!vm.ipAddress?.trim()) {
      return { success: false, error: `IP Address is required for VM ${vm.sequenceNumber}` };
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
      await NotificationService.notifyRequester(
        request.requesterId,
        request.systemName || "Provisioned VM",
        "PROVISIONED"
      );
    }

    revalidatePath("/inventory/vms");
    return { success: true, data: { vmCount: vmInputs.length } };
  }, { timeout: 30000 });
}

export async function getDashboardData(): Promise<ApiResponse<unknown>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth");

  const userRoles = session.user.roles;
  const isAdmin = RoleService.hasRole(userRoles, UserRole.ADMIN);

  const data = await fetchDashboardData(session.user.id, userRoles, isAdmin);
  return { success: true, data };
}

export interface VmProvisioningInput {
  hostname: string;
  ipAddress: string;
  publicIpAddress: string | null;
  subdomain: string | null;
  sequenceNumber: number;
}

interface ProvisionResult {
  success: boolean;
  message: string;
  provisionedCount?: number;
  errors?: { index: number; field: string; message: string }[];
}

export async function provisionVMs(
  requestId: string,
  requesterId: string,
  vms: VmProvisioningInput[]
): Promise<ProvisionResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, message: "Unauthorized" };
  }

  const userRoles = session.user.roles;
  const isDCOps = RoleService.hasRole(userRoles, UserRole.DCOPS);
  const isAdmin = RoleService.hasRole(userRoles, UserRole.ADMIN);

  if (!isDCOps && !isAdmin) {
    return { success: false, message: "Only DCOPS or Admin can provision VMs" };
  }

  try {
    // Increase timeout for VM provisioning (30 seconds)
    return await prisma.$transaction(
      async (tx) => {
      // Fetch the request
      const request = await tx.request.findUnique({
        where: { id: requestId },
        include: {
          vmInstances: true,
          requester: true,
        },
      });

      if (!request) {
        return { success: false, message: "Request not found" };
      }

      if (request.status !== RequestStatus.APPROVED && request.status !== RequestStatus.PARTIALLY_PROVISIONED) {
        return { success: false, message: `Cannot provision VM for request with status: ${request.status}` };
      }

      const existingCount = request.vmInstances.length;
      const totalAfterProvision = existingCount + vms.length;

      if (totalAfterProvision > request.quantity) {
        return {
          success: false,
          message: `Cannot provision ${vms.length} VMs. Only ${request.quantity - existingCount} VMs remaining.`,
        };
      }

      const provisionedVms = [];
      const validationErrors: { index: number; field: string; message: string }[] = [];

      // Validate and create VMs
      for (let i = 0; i < vms.length; i++) {
        const vm = vms[i];
        
        const trimmedHostname = vm.hostname.trim();
        const trimmedIpAddress = vm.ipAddress.trim();

        // Check hostname is not empty
        if (!trimmedHostname) {
          validationErrors.push({
            index: i,
            field: "hostname",
            message: "Hostname is required",
          });
          continue;
        }

        // Check IP is not empty
        if (!trimmedIpAddress) {
          validationErrors.push({
            index: i,
            field: "ipAddress",
            message: "Private IP is required",
          });
          continue;
        }

        // Check hostname uniqueness
        const existingHostname = await tx.vmInstance.findUnique({
          where: { hostname: trimmedHostname },
        });
        if (existingHostname) {
          validationErrors.push({
            index: i,
            field: "hostname",
            message: `Hostname '${trimmedHostname}' is already in use`,
          });
          continue;
        }

        // Check IP uniqueness
        const existingIp = await tx.vmInstance.findUnique({
          where: { ipAddress: trimmedIpAddress },
        });
        if (existingIp) {
          validationErrors.push({
            index: i,
            field: "ipAddress",
            message: `IP address '${trimmedIpAddress}' is already in use`,
          });
          continue;
        }

        // Check sequence number uniqueness within request
        const existingSeq = await tx.vmInstance.findUnique({
          where: {
            requestId_sequenceNumber: {
              requestId,
              sequenceNumber: vm.sequenceNumber,
            },
          },
        });
        if (existingSeq) {
          validationErrors.push({
            index: i,
            field: "sequenceNumber",
            message: `Sequence number ${vm.sequenceNumber} already exists`,
          });
          continue;
        }

        // Create VM instance
        const vmInstance = await tx.vmInstance.create({
          data: {
            requestId,
            sequenceNumber: vm.sequenceNumber,
            hostname: trimmedHostname,
            ipAddress: trimmedIpAddress,
            publicIpAddress: vm.publicIpAddress,
            subdomain: vm.subdomain,
            ownerId: requesterId,
            status: VmStatus.ACTIVE,
            provisionedAt: new Date(),
            environment: request.environment,
          },
        });

        provisionedVms.push(vmInstance);

        // Create audit log for each VM
        await tx.auditLog.create({
          data: {
            actorId: session.user.id,
            action: "VM_PROVISIONED",
            entityType: "REQUEST",
            entityId: requestId,
            details: JSON.stringify({
              vmId: vmInstance.id,
              hostname: vm.hostname,
              ipAddress: vm.ipAddress,
              sequenceNumber: vm.sequenceNumber,
            }),
          },
        });
      }

      if (validationErrors.length > 0) {
        return {
          success: false,
          message: "Validation failed for some VMs",
          errors: validationErrors,
        };
      }

      // Update request status
      let newStatus: RequestStatus;
      if (totalAfterProvision === request.quantity) {
        newStatus = RequestStatus.PROVISIONED;
      } else {
        newStatus = RequestStatus.PARTIALLY_PROVISIONED;
      }

      await tx.request.update({
        where: { id: requestId },
        data: {
          status: newStatus,
          provisionedAt: new Date(),
        },
      });

      // Create audit log for status change
      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "REQUEST_PROVISIONED",
          entityType: "REQUEST",
          entityId: requestId,
          details: JSON.stringify({
            provisionedCount: provisionedVms.length,
            totalVms: request.quantity,
            newStatus,
          }),
        },
      });

      return {
        success: true,
        message: `Successfully provisioned ${provisionedVms.length} VM${provisionedVms.length !== 1 ? "s" : ""}`,
        provisionedCount: provisionedVms.length,
      };
    },
    { timeout: 30000 }
  );
  } catch (error) {
    console.error("Error provisioning VMs:", error);
    return { success: false, message: "Failed to provision VMs" };
  }
}