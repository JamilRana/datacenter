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
import { ROLES } from "@/lib/roles";
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
  requestType: RequestType,
  skipNotification: boolean = false
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

    if (!skipNotification) {
      // Notify Level 1 approvers
      const systemName = entityType === "REQUEST"
        ? (await tx.request.findUnique({ where: { id: entityId }, select: { systemName: true } }))?.systemName || "New Request"
        : "Customization Request";

      await NotificationService.notifyApprovers(entityId, systemName, 1, entityType);
    }
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
): Promise<ApiResponse<{ status: string; action: string; forwardedToLevel?: number; nextLevel?: number }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };

  const approvalRecord = await prisma.approval.findFirst({
    where: {
      OR: [
        { id: approvalId },
        {
          AND: [
            { requestId: approvalId },
            { decision: ApprovalDecision.PENDING }
          ]
        },
        {
          AND: [
            { customizationRequestId: approvalId },
            { decision: ApprovalDecision.PENDING }
          ]
        }
      ]
    },
    orderBy: { level: "asc" }
  });

  if (!approvalRecord) {
    return { success: false, error: "Approval record not found or already processed", code: "NOT_FOUND" };
  } const resolvedApprovalId = approvalRecord.id;

  const entityType = approvalRecord.entityType;
  const entityId = approvalRecord.requestId || approvalRecord.customizationRequestId;

  if (!entityId) {
    return { success: false, error: "Linked entity not found for this approval record." };
  }

  let systemName = "Request";
  let requesterId: string | null = null;
  let requestType = "NEW_VM";

  if (entityType === "REQUEST") {
    const req = await prisma.request.findUnique({
      where: { id: entityId },
      select: { systemName: true, requestType: true, requesterId: true }
    });
    if (req) {
      systemName = req.systemName;
      requestType = req.requestType;
      requesterId = req.requesterId;
    }
  } else {
    const cust = await prisma.customizationRequest.findUnique({
      where: { id: entityId },
      include: { targetVm: { select: { hostname: true } } }
    });
    if (cust) {
      systemName = cust.targetVm?.hostname || "Resource Customization";
      requestType = "CUSTOMIZED";
      requesterId = cust.requesterId;
    }
  }

  // Validation
  if ((decision === ApprovalDecision.REJECTED || decision === ApprovalDecision.RETURNED) && !comments?.trim()) {
    return { success: false, error: "Comments are mandatory for rejections or returns" };
  }

  const result = await prisma.$transaction(async (tx: any) => {
    const approval = await tx.approval.findUnique({
      where: { id: resolvedApprovalId }
    });

    if (!approval) return { success: false, error: "Approval record not found during transaction" };
    if (approval.decision !== ApprovalDecision.PENDING) {
      return { success: false, error: `This approval has already been processed: ${approval.decision}` };
    }
    
    // Check permission: assigned approver, or admin, or user having the required approver role for this level
    const userRoles = session.user.roles || [];
    const isAdmin = userRoles.includes(ROLES.ADMIN);
    const isAssigned = approval.approverId === session.user.id;
    const hasRoleForLevel = 
      (approval.level === 1 && (userRoles.includes("APPROVER_L1") || userRoles.includes(ROLES.L1_APPROVER))) ||
      (approval.level === 2 && (userRoles.includes("APPROVER_L2") || userRoles.includes(ROLES.L2_APPROVER))) ||
      (approval.level === 3 && (userRoles.includes("APPROVER_L3") || userRoles.includes(ROLES.L3_APPROVER))) ||
      (approval.level === 4 && (userRoles.includes("APPROVER_L4") || userRoles.includes(ROLES.L4_APPROVER) || userRoles.includes(ROLES.DCOPS)));

    if (!isAssigned && !isAdmin && !hasRoleForLevel) {
      return { success: false, error: "You are not authorized to act on this approval level" };
    }

    // Check if all previous levels have been approved (only for APPROVE decision)
    if (decision === ApprovalDecision.APPROVED && approval.level > 1) {
      const previousLevelApprovals = await tx.approval.findMany({
        where: {
          requestId: approval.requestId,
          customizationRequestId: approval.customizationRequestId,
          level: { lt: approval.level },
        },
      });

      const allPreviousApproved = previousLevelApprovals.every(
        (a: any) => a.decision === ApprovalDecision.APPROVED
      );

      if (!allPreviousApproved) {
        return {
          success: false,
          error: `Cannot approve: Previous level(s) have not been approved yet. Level ${approval.level} can only act after all lower levels have approved.`
        };
      }
    }

    // Update Approval Record - record actual approver
    await tx.approval.update({
      where: { id: resolvedApprovalId },
      data: { 
        approverId: session.user.id,
        decision, 
        comments: comments || null, 
        decidedAt: new Date() 
      },
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
    let nextLevelToNotify: number | undefined;

    if (decision === ApprovalDecision.REJECTED) {
      // Per USER request: After rejection, status should be DRAFT so requester can resubmit after editing
      nextStatus = RequestStatus.DRAFT;

      // Reject all pending approvals for this request
      await tx.approval.updateMany({
        where: {
          ...(entityType === "REQUEST" ? { requestId: entityId } : { customizationRequestId: entityId }),
          decision: ApprovalDecision.PENDING,
        },
        data: {
          decision: ApprovalDecision.REJECTED,
          comments: comments || "Rejected/Returned for editing by level " + approval.level,
          decidedAt: new Date(),
        },
      });
    } else if (decision === ApprovalDecision.APPROVED) {
      const workflow = await getWorkflowConfig(requestType);

      // Get current level config to check if it's final
      const currentLevelConfig = workflow.levels.find(l => l.level === approval.level);

      if (currentLevelConfig?.isFinal) {
        nextStatus = RequestStatus.APPROVED;
      } else {
        const nextLevel = await getNextLevel(approval.level, workflow);
        if (nextLevel) {
          if (nextLevel.role === "DC_OPS") {
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
            nextLevelToNotify = nextLevel.level;
          } else {
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
              nextLevelToNotify = nextLevel.level;
              nextStatus = getStatusForLevel(nextLevel.level);
            } else {
              // No approver found - finalize the request
              nextStatus = RequestStatus.APPROVED;
            }
          }
        } else {
          nextStatus = RequestStatus.APPROVED;
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

    return { success: true, data: { status: nextStatus, action: decision, nextLevel: nextLevelToNotify, forwardedToLevel: forwardToLevel } };
  }, { timeout: 30000 });

  // Post-commit notifications and invalidation (Safe post-commit background execution)
  if (result.success && result.data) {
    const data = result.data;
    const action = data.action;
    const nextStatus = data.status;

    // Dispatch all notifications and cache updates concurrently in the background
    // so that the server action returns result to the UI instantly.
    (async () => {
      try {
        const promises: Promise<any>[] = [];

        if (requesterId && decision === ApprovalDecision.REJECTED) {
          promises.push(
            NotificationService.notifyRequester(
              requesterId,
              systemName,
              "REJECTED",
              entityId,
              comments || undefined
            ).catch(err => console.error("[Post-commit Notification] Failed to notify requester:", err))
          );
        }

        if (nextStatus === "APPROVED") {
          promises.push(
            NotificationService.notifyDCOps(entityId, systemName).catch(err =>
              console.error("[Post-commit Notification] Failed to notify DC Ops:", err)
            )
          );
        }

        if (action === "FORWARDED" || action === "FORWARDED_TO_DCOPS") {
          if (data.forwardedToLevel) {
            promises.push(
              NotificationService.notifyApprovers(entityId, systemName, data.forwardedToLevel, entityType).catch(err =>
                console.error("[Post-commit Notification] Failed to notify forwarded approver:", err)
              )
            );
          }
        } else if (action === "APPROVED" && data.nextLevel) {
          promises.push(
            NotificationService.notifyApprovers(entityId, systemName, data.nextLevel, entityType).catch(err =>
              console.error("[Post-commit Notification] Failed to notify next level approver:", err)
            )
          );
        }

        promises.push(
          invalidateCache('admin_dashboard_data').catch(err =>
            console.error("[Post-commit Cache Invalidation] Failed:", err)
          )
        );

        await Promise.all(promises);
      } catch (err) {
        console.error("[Post-commit Background Operations] Failed:", err);
      }
    })();
  }

  return result;
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
        additionalDisks: true,
        firewallPorts: true,
        networkAccess: true,
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

  const result = await prisma.$transaction(async (tx: any) => {
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
          where: { id: { in: vms.map((v: any) => v.id) } },
          data: {
            status: VmStatus.RETIRED,
            decommissionedAt: new Date(),
          },
        });

        await tx.request.update({
          where: { id: requestId },
          data: { status: RequestStatus.CLOSED },
        });
      }
      // VPN_ACCESS/HORIZON_ACCESS: Confirm externally and mark as provisioned
      else if (request.requestType === RequestType.VPN_ACCESS || request.requestType === RequestType.HORIZON_ACCESS) {
        await tx.request.update({
          where: { id: requestId },
          data: {
            status: RequestStatus.PROVISIONED,
            provisionedAt: new Date(),
          },
        });
      }
      // K8S_NAMESPACE: Provision namespace
      else if (request.requestType === RequestType.K8S_NAMESPACE) {
        let namespaceId = request.existingNamespaceId;
        if (!request.underExistingNamespace) {
          const createdNs = await tx.k8sNamespace.create({
            data: {
              name: request.kubernetesNamespace || `ns-${request.id.slice(0, 8)}`,
              supervisorIp: "10.0.1.100"
            }
          });
          namespaceId = createdNs.id;
        }

        await tx.request.update({
          where: { id: requestId },
          data: {
            status: RequestStatus.PROVISIONED,
            provisionedAt: new Date(),
            existingNamespaceId: namespaceId,
          },
        });
      }
      // SYSTEM_UPGRADE: Apply upgraded spec changes to target VM
      else if (request.requestType === RequestType.SYSTEM_UPGRADE) {
        if (!request.targetVmId) {
          return { success: false, error: "Target VM not specified for upgrade" };
        }

        const latestSpec = await tx.vmSpec.findFirst({
          where: { vmInstanceId: request.targetVmId },
          orderBy: { createdAt: "desc" },
        });

        // Resolve new specifications
        const vcpu = request.upgradeCpu ?? latestSpec?.vcpu ?? 2;
        const ramGb = request.upgradeRamGb ?? latestSpec?.ramGb ?? 4;

        // Storage is additive
        const currentStorage = latestSpec?.storageGb ?? 50;
        const storageGb = currentStorage + (request.upgradeStorageGb ?? 0);

        const newSpec = await tx.vmSpec.create({
          data: {
            vmInstanceId: request.targetVmId,
            vcpu,
            ramGb,
            storageGb,
            osName: latestSpec?.osName || null,
            osVersion: latestSpec?.osVersion || null,
            effectiveFrom: new Date(),
            appliedById: userId,
            sourceRequestId: request.id,
            // Copy existing disks, firewalls, and network access entries from latestSpec
            additionalDisks: latestSpec ? {
              create: await tx.vmSpecDisk.findMany({
                where: { specId: latestSpec.id }
              }).then((disks: any[]) => disks.map(d => ({
                sizeGb: d.sizeGb,
                purpose: d.purpose,
                sequence: d.sequence
              })))
            } : undefined,
            firewallPorts: latestSpec ? {
              create: await tx.vmSpecFirewallPort.findMany({
                where: { specId: latestSpec.id }
              }).then((rules: any[]) => rules.map(r => ({
                port: r.port,
                protocol: r.protocol,
                purpose: r.purpose,
                source: r.source
              })))
            } : undefined,
            networkAccess: latestSpec ? {
              create: await tx.vmSpecNetworkAccess.findMany({
                where: { specId: latestSpec.id }
              }).then((entries: any[]) => entries.map(e => ({
                accessType: e.accessType
              })))
            } : undefined
          },
        });

        await tx.vmInstance.update({
          where: { id: request.targetVmId },
          data: {
            currentSpecId: newSpec.id,
            status: VmStatus.ACTIVE,
          },
        });

        await tx.request.update({
          where: { id: requestId },
          data: {
            status: RequestStatus.PROVISIONED,
            provisionedAt: new Date(),
          },
        });
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
          effectiveFrom: new Date(),
          appliedById: userId,
          customizationRequestId: customization.id,
          additionalDisks: {
            create: customization.additionalDisks.map((d: any) => ({
              sizeGb: d.sizeGb,
              purpose: d.purpose,
              sequence: d.sequence
            }))
          },
          firewallPorts: {
            create: customization.firewallPorts.map((p: any) => ({
              port: p.port,
              protocol: p.protocol,
              purpose: p.purpose,
              source: p.source
            }))
          },
          networkAccess: {
            create: customization.networkAccess.map((a: any) => ({
              accessType: a.accessType
            }))
          }
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

  if (result.success) {
    (async () => {
      try {
        if (request) {
          const isDecom = request.requestType === RequestType.DECOMMISSION;
          await NotificationService.notifyDeployment(requestId, isDecom ? "DECOMMISSIONED" : "PROVISIONED");
        } else if (customization) {
          const vmHostname = customization.targetVm?.hostname || "VM";
          if (customization.requesterId) {
            await NotificationService.notifyRequester(
              customization.requesterId,
              vmHostname,
              "CUSTOMIZATION_APPLIED",
              customization.id
            );
          }
        }
      } catch (err) {
        console.error("[Post-execute Background Notification] Failed:", err);
      }
    })();
  }

  return result;
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
      additionalDisks: true,
      firewallPorts: true,
      networkAccess: true,
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

  const result = await prisma.$transaction(async (tx: any) => {
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
          renewalDate: new Date(new Date().setMonth(new Date().getMonth() + 6)),
          environment: request.environment,
          systemName: request.systemName,
          cloneOfRequestId: request.requestType === RequestType.CLONE_VM ? request.id : null,
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
          effectiveFrom: new Date(),
          sourceRequestId: request.id,
          additionalDisks: {
            create: request.additionalDisks.map((d: any) => ({
              sizeGb: d.sizeGb,
              purpose: d.purpose,
              sequence: d.sequence
            }))
          },
          firewallPorts: {
            create: request.firewallPorts.map((p: any) => ({
              port: p.port,
              protocol: p.protocol,
              purpose: p.purpose,
              source: p.source
            }))
          },
          networkAccess: {
            create: request.networkAccess.map((a: any) => ({
              accessType: a.accessType
            }))
          }
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

    revalidatePath("/inventory/vms");
    return { success: true, data: { vmCount: vmInputs.length } };
  }, { timeout: 30000 });

  if (result.success) {
    await NotificationService.notifyDeployment(requestId, "PROVISIONED");
  }

  return result;
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
  vmSpecificationId?: string | null;
  hostAssetId?: string | null;
  vpnRequired?: boolean;
}

interface ProvisionResult {
  success: boolean;
  message: string;
  provisionedCount?: number;
  errors?: { index: number; field: string; message: string }[];
  newStatus?: RequestStatus;
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
    const result = await prisma.$transaction(
      async (tx: any) => {
        // Fetch the request with full VM specifications and relations
        const request = await tx.request.findUnique({
          where: { id: requestId },
          include: {
            vmInstances: true,
            vmSpecifications: {
              include: {
                connectivity: true,
                firewallRules: true,
                additionalStorage: true
              }
            },
            requester: true,
            additionalDisks: true,
            firewallPorts: true,
            networkAccess: true,
          },
        });

        if (!request) {
          return { success: false, message: "Request not found" };
        }

        if (request.status !== RequestStatus.APPROVED && request.status !== RequestStatus.PARTIALLY_PROVISIONED) {
          return { success: false, message: `Cannot provision VM for request with status: ${request.status}` };
        }

        const totalQuantity = request.quantity || (request.vmSpecifications?.length || 1);
        const existingCount = request.vmInstances.length;
        const totalAfterProvision = existingCount + vms.length;

        if (totalAfterProvision > totalQuantity) {
          return {
            success: false,
            message: `Cannot provision ${vms.length} VMs. Only ${totalQuantity - existingCount} VMs remaining.`,
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

          // Resolve specific specification for this VM if available
          let matchedSpec: any = null;
          if (vm.vmSpecificationId) {
            matchedSpec = request.vmSpecifications?.find((s: any) => s.id === vm.vmSpecificationId);
          } else if (request.vmSpecifications && request.vmSpecifications.length > 0) {
            const targetIndex = (vm.sequenceNumber - 1) % request.vmSpecifications.length;
            matchedSpec = request.vmSpecifications[targetIndex];
          }

          const vcpu = matchedSpec?.vcpu ?? request.vcpu ?? 1;
          const ramGb = matchedSpec?.ramGb ?? request.ramGb ?? 2;
          const storageGb = matchedSpec?.storageGb ?? request.storageGb ?? 50;
          const osVersion = matchedSpec?.osVersion ?? request.osVersion ?? null;
          const osName = request.osName ?? (osVersion ? osVersion.split(" ")[0] : "Linux");
          const stack = matchedSpec?.stack ?? request.systemName ?? null;
          const environment = matchedSpec?.environment ?? request.environment;

          const specDisks = matchedSpec?.additionalStorage && matchedSpec.additionalStorage.length > 0
            ? matchedSpec.additionalStorage.map((d: any) => ({
              sizeGb: d.sizeGb,
              purpose: d.purpose || null,
              sequence: d.sequence
            }))
            : request.additionalDisks.map((d: any) => ({
              sizeGb: d.sizeGb,
              purpose: d.purpose || null,
              sequence: d.sequence
            }));

          const specFirewalls = matchedSpec?.firewallRules && matchedSpec.firewallRules.length > 0
            ? matchedSpec.firewallRules.map((p: any) => ({
              port: p.port,
              protocol: p.protocol,
              purpose: p.purpose || "",
              source: p.source || null
            }))
            : request.firewallPorts.map((p: any) => ({
              port: p.port,
              protocol: p.protocol,
              purpose: p.purpose || "",
              source: p.source || null
            }));

          const specConnectivity = matchedSpec?.connectivity && matchedSpec.connectivity.length > 0
            ? matchedSpec.connectivity.map((a: any) => ({
              accessType: a.accessType
            }))
            : request.networkAccess.map((a: any) => ({
              accessType: a.accessType
            }));

          const isVpnRequiredForThisVm = vm.vpnRequired ?? (
            matchedSpec?.connectivity?.some((c: any) => c.accessType === "VPN") ||
            request.vpnRequired ||
            false
          );

          // Create VM instance
          const vmInstance = await tx.vmInstance.create({
            data: {
              requestId,
              sequenceNumber: vm.sequenceNumber,
              hostname: trimmedHostname,
              ipAddress: trimmedIpAddress,
              publicIpAddress: vm.publicIpAddress,
              subdomain: vm.subdomain || matchedSpec?.subdomain || request.subdomain || null,
              ownerId: requesterId,
              status: VmStatus.ACTIVE,
              provisionedAt: new Date(),
              renewalDate: new Date(new Date().setMonth(new Date().getMonth() + 6)),
              environment: environment,
              systemName: stack || request.systemName,
              hostAssetId: vm.hostAssetId || null,
              vpnRequired: isVpnRequiredForThisVm,
              cloneOfRequestId: request.requestType === RequestType.CLONE_VM ? requestId : null,
            },
          });

          // Create initial spec from specific spec or request
          const spec = await tx.vmSpec.create({
            data: {
              vmInstanceId: vmInstance.id,
              vcpu,
              ramGb,
              storageGb,
              osName,
              osVersion,
              effectiveFrom: new Date(),
              sourceRequestId: request.id,
              additionalDisks: {
                create: specDisks
              },
              firewallPorts: {
                create: specFirewalls
              },
              networkAccess: {
                create: specConnectivity
              }
            }
          });

          // Link current spec to VM
          await tx.vmInstance.update({
            where: { id: vmInstance.id },
            data: { currentSpecId: spec.id }
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

        // Calculate combined request status
        const isAllVmsProvisioned = totalAfterProvision >= totalQuantity;

        // Check if VPN is required and whether VPN is already provisioned
        const isVpnRequired = request.vpnRequired ||
          request.requestType === RequestType.VPN_ACCESS ||
          request.vmSpecifications?.some((s: any) => s.connectivity?.some((c: any) => c.accessType === "VPN"));

        const vpnAssignmentsCount = await tx.vpnAssignment.count({
          where: {
            OR: [
              { vm: { requestId: requestId } },
              { namespace: { requests: { some: { id: requestId } } } }
            ]
          }
        });

        // Check if K8s namespace is required and whether it is provisioned
        const isK8sRequired = request.requestType === RequestType.K8S_NAMESPACE || request.kubernetesOption;
        const k8sClusterCount = await tx.k8sCluster.count({
          where: { requestId: requestId }
        });

        let newStatus: RequestStatus;
        const isAllVpnFulfilled = !isVpnRequired || vpnAssignmentsCount > 0;
        const isAllK8sFulfilled = !isK8sRequired || k8sClusterCount > 0;

        if (isAllVmsProvisioned && isAllVpnFulfilled && isAllK8sFulfilled) {
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
              totalVms: totalQuantity,
              newStatus,
            }),
          },
        });

        return {
          success: true,
          message: `Successfully provisioned ${provisionedVms.length} VM${provisionedVms.length !== 1 ? "s" : ""}`,
          provisionedCount: provisionedVms.length,
          newStatus,
        };
      },
      { timeout: 30000 }
    );

    if (result.success && result.newStatus) {
      await NotificationService.notifyDeployment(requestId, result.newStatus);
    }

    return result;
  } catch (error) {
    console.error("Error provisioning VMs:", error);
    return { success: false, message: "Failed to provision VMs" };
  }
}

export interface InFlightModifications {
  vcpu?: number;
  ramGb?: number;
  storageGb?: number;
  quantity?: number;
  resourceIdsToRemove?: string[];
  notes?: string;
}

export interface ModifyAndApproveParams {
  approvalId: string;
  requestId: string;
  comments?: string;
  modifications: InFlightModifications;
  escalateToLevel?: number;
}

/**
 * In-flight Modification & Approval Action
 * Allows approvers (L1-L4, DC_OPS) and Admins to modify requested resources (e.g. prune VMs from Horizon/VPN, downsize RAM/vCPU)
 * and approve the request in a single atomic transaction with complete audit diff logging and requester notification.
 */
export async function modifyAndApproveRequest(params: ModifyAndApproveParams): Promise<ApiResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };

  const { approvalId, requestId, comments, modifications, escalateToLevel } = params;

  try {
    const approvalRecord = await prisma.approval.findFirst({
      where: {
        OR: [
          { id: approvalId },
          { AND: [{ requestId: requestId }, { decision: ApprovalDecision.PENDING }] }
        ]
      },
      orderBy: { level: "asc" }
    });

    if (!approvalRecord) {
      return { success: false, error: "Pending approval record not found" };
    }

    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: {
        requestResources: {
          include: {
            vm: true,
            namespace: true
          }
        },
        vmSpecifications: true
      }
    });

    if (!request) {
      return { success: false, error: "Request not found" };
    }

    // Compute change diffs
    const diffs: string[] = [];
    const originalValues: Record<string, any> = {};
    const newValues: Record<string, any> = {};

    if (modifications.vcpu !== undefined && modifications.vcpu !== request.vcpu) {
      diffs.push(`vCPU: ${request.vcpu || 0} → ${modifications.vcpu}`);
      originalValues.vcpu = request.vcpu;
      newValues.vcpu = modifications.vcpu;
    }

    if (modifications.ramGb !== undefined && modifications.ramGb !== request.ramGb) {
      diffs.push(`RAM: ${request.ramGb || 0}GB → ${modifications.ramGb}GB`);
      originalValues.ramGb = request.ramGb;
      newValues.ramGb = modifications.ramGb;
    }

    if (modifications.storageGb !== undefined && modifications.storageGb !== request.storageGb) {
      diffs.push(`Storage: ${request.storageGb || 0}GB → ${modifications.storageGb}GB`);
      originalValues.storageGb = request.storageGb;
      newValues.storageGb = modifications.storageGb;
    }

    if (modifications.quantity !== undefined && modifications.quantity !== request.quantity) {
      diffs.push(`Quantity: ${request.quantity} → ${modifications.quantity}`);
      originalValues.quantity = request.quantity;
      newValues.quantity = modifications.quantity;
    }

    let removedLabels: string[] = [];
    if (modifications.resourceIdsToRemove && modifications.resourceIdsToRemove.length > 0) {
      const removed = (request.requestResources || []).filter(r => 
        modifications.resourceIdsToRemove!.includes(r.id)
      );
      removedLabels = removed.map(r => r.vm?.hostname || r.namespace?.name || "Resource");
      if (removedLabels.length > 0) {
        diffs.push(`Removed Resources: [${removedLabels.join(", ")}]`);
      }
    }

    // Apply adjustments in transaction
    await prisma.$transaction(async (tx) => {
      // 1. Remove pruned resources from requestResources
      if (modifications.resourceIdsToRemove && modifications.resourceIdsToRemove.length > 0) {
        await tx.requestResource.deleteMany({
          where: {
            id: { in: modifications.resourceIdsToRemove },
            requestId
          }
        });
      }

      // 2. Update Request specs
      const updateData: any = {};
      if (modifications.vcpu !== undefined) updateData.vcpu = modifications.vcpu;
      if (modifications.ramGb !== undefined) updateData.ramGb = modifications.ramGb;
      if (modifications.storageGb !== undefined) updateData.storageGb = modifications.storageGb;
      if (modifications.quantity !== undefined) updateData.quantity = modifications.quantity;

      if (Object.keys(updateData).length > 0) {
        await tx.request.update({
          where: { id: requestId },
          data: updateData
        });

        // Also update any associated vmSpecifications
        await tx.vmSpecification.updateMany({
          where: { requestId },
          data: {
            vcpu: updateData.vcpu !== undefined ? updateData.vcpu : undefined,
            ramGb: updateData.ramGb !== undefined ? updateData.ramGb : undefined,
            storageGb: updateData.storageGb !== undefined ? updateData.storageGb : undefined,
          }
        });
      }

      // 3. Create AuditLog entry with full diff metadata
      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "REQUEST_MODIFIED_IN_FLIGHT",
          entityType: "REQUEST",
          entityId: requestId,
          details: {
            diffs,
            originalValues,
            newValues,
            removedResources: removedLabels,
            approverNotes: comments || "Approved with modifications",
            level: approvalRecord.level
          }
        }
      });
    });

    // 4. Process approval decision with diff summary
    const diffSummary = diffs.length > 0 ? diffs.join("; ") : "No spec changes";
    const fullComments = comments?.trim()
      ? `${comments.trim()} (Modifications: ${diffSummary})`
      : `Approved with modifications: ${diffSummary}`;

    const decisionResult = await handleApprovalDecision(
      approvalRecord.id,
      ApprovalDecision.APPROVED,
      fullComments,
      escalateToLevel
    );

    // 5. Notify requester about modifications
    if (request.requesterId && diffs.length > 0) {
      NotificationService.notifyRequester(
        request.requesterId,
        request.systemName,
        `APPROVED_WITH_MODIFICATIONS`,
        requestId,
        `Your request was approved with modifications by ${session.user.name || "Approver"}: ${diffSummary}`
      ).catch(e => console.error("Failed to notify requester of in-flight modification:", e));
    }

    revalidatePath(`/requests/${requestId}`);
    revalidatePath(`/requests/${requestId}/view`);
    revalidatePath(`/approvals/${requestId}`);
    revalidatePath("/approvals");

    return decisionResult;
  } catch (error) {
    console.error("modifyAndApproveRequest failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to modify and approve request" };
  }
}

/**
 * Update request in-flight without approving immediately
 */
export async function updateRequestInFlight(
  requestId: string,
  modifications: InFlightModifications,
  notes?: string
): Promise<ApiResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };

  try {
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: {
        requestResources: {
          include: {
            vm: true,
            namespace: true
          }
        }
      }
    });

    if (!request) return { success: false, error: "Request not found" };

    const diffs: string[] = [];

    if (modifications.vcpu !== undefined && modifications.vcpu !== request.vcpu) {
      diffs.push(`vCPU: ${request.vcpu || 0} → ${modifications.vcpu}`);
    }
    if (modifications.ramGb !== undefined && modifications.ramGb !== request.ramGb) {
      diffs.push(`RAM: ${request.ramGb || 0}GB → ${modifications.ramGb}GB`);
    }
    if (modifications.storageGb !== undefined && modifications.storageGb !== request.storageGb) {
      diffs.push(`Storage: ${request.storageGb || 0}GB → ${modifications.storageGb}GB`);
    }
    if (modifications.quantity !== undefined && modifications.quantity !== request.quantity) {
      diffs.push(`Quantity: ${request.quantity} → ${modifications.quantity}`);
    }

    let removedLabels: string[] = [];
    if (modifications.resourceIdsToRemove && modifications.resourceIdsToRemove.length > 0) {
      const removed = (request.requestResources || []).filter(r => 
        modifications.resourceIdsToRemove!.includes(r.id)
      );
      removedLabels = removed.map(r => r.vm?.hostname || r.namespace?.name || "Resource");
      if (removedLabels.length > 0) {
        diffs.push(`Removed Resources: [${removedLabels.join(", ")}]`);
      }
    }

    await prisma.$transaction(async (tx) => {
      if (modifications.resourceIdsToRemove && modifications.resourceIdsToRemove.length > 0) {
        await tx.requestResource.deleteMany({
          where: {
            id: { in: modifications.resourceIdsToRemove },
            requestId
          }
        });
      }

      const updateData: any = {};
      if (modifications.vcpu !== undefined) updateData.vcpu = modifications.vcpu;
      if (modifications.ramGb !== undefined) updateData.ramGb = modifications.ramGb;
      if (modifications.storageGb !== undefined) updateData.storageGb = modifications.storageGb;
      if (modifications.quantity !== undefined) updateData.quantity = modifications.quantity;

      if (Object.keys(updateData).length > 0) {
        await tx.request.update({
          where: { id: requestId },
          data: updateData
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "REQUEST_MODIFIED_IN_FLIGHT",
          entityType: "REQUEST",
          entityId: requestId,
          details: {
            diffs,
            removedResources: removedLabels,
            notes: notes || "Manual adjustment",
          }
        }
      });
    });

    revalidatePath(`/requests/${requestId}`);
    revalidatePath(`/requests/${requestId}/view`);
    revalidatePath(`/approvals/${requestId}`);

    return { success: true, message: `Updated request: ${diffs.join(", ")}` };
  } catch (error) {
    console.error("updateRequestInFlight failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to update request" };
  }
}