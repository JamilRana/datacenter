import prisma from "@/lib/prisma";
import { NotificationType, UserRole } from "@/lib/types/enums";
import {
  sendApprovalNotification,
  sendStatusUpdateNotification,
  sendDeploymentSuccessNotification,
  sendK8sNamespaceDeploymentNotification,
  sendVpnAccessDeploymentNotification,
  sendHorizonAccessDeploymentNotification,
  VMNotificationDetails,
  K8sNamespaceNotificationDetails,
  VpnNotificationDetails,
  HorizonNotificationDetails
} from "@/lib/email";
import { getWorkflowConfig } from "@/lib/workflow";
import { getAppUrl } from "@/lib/utils";

export class NotificationService {
  /**
   * Create a basic in-app notification
   */
  static async createNotification(userId: string, type: NotificationType | string, message: string, link?: string) {
    try {
      return await prisma.notification.create({
        data: {
          userId,
          type,
          message,
          link,
          isRead: false,
        },
      });
    } catch (error) {
      console.error(`[NotificationService] Failed to create notification for user ${userId}:`, error);
      // We don't throw here to avoid breaking the main workflow if notification fails
    }
  }

  /**
   * Notify all approvers for a new request or step change
   */
  static async notifyApprovers(requestId: string, systemName: string, level: number, entityType: "REQUEST" | "CUSTOMIZATION" = "REQUEST") {
    let requestType = "NEW_VM";
    if (entityType === "REQUEST") {
      const req = await prisma.request.findUnique({
        where: { id: requestId },
        select: { requestType: true }
      });
      if (req?.requestType) requestType = req.requestType;
    } else {
      requestType = "CUSTOMIZED";
    }

    let targetRole: string | undefined;
    try {
      const workflow = await getWorkflowConfig(requestType);
      targetRole = workflow.levels.find(l => l.level === level)?.role;
    } catch (e) {
      console.error("[NotificationService] Failed to get workflow config:", e);
    }
    
    if (!targetRole) {
      const roleMap: Record<number, string> = {
        1: UserRole.L1_APPROVER,
        2: UserRole.L2_APPROVER,
        3: UserRole.L3_APPROVER,
        4: UserRole.L4_APPROVER,
      };
      targetRole = roleMap[level];
    }

    // Find the specific approval record that is pending for this request/customization and level
    const approvals = await prisma.approval.findMany({
      where: {
        OR: [
          { requestId },
          { customizationRequestId: requestId }
        ],
        level,
        decision: "PENDING",
      },
      include: {
        approver: {
          select: { id: true, email: true, name: true }
        }
      }
    });

    let approvers = approvals.map((a: any) => a.approver).filter(Boolean);

    // Fallback to role-based if no approvals found (should not normally happen)
    if (approvers.length === 0) {
      if (targetRole) {
        approvers = await prisma.user.findMany({
          where: {
            isActive: true,
            roles: {
              some: {
                role: {
                  name: targetRole,
                },
              },
            },
          },
          select: { id: true, email: true, name: true },
        });
      }
    }

    const typeParam = entityType === "CUSTOMIZATION" ? "customization" : "request";
    const relativeLink = `/approvals/${requestId}?type=${typeParam}`;
    const fullActionUrl = `${getAppUrl()}${relativeLink}`;

    const promises = approvers.map(async (approver: any) => {
      await this.createNotification(
        approver.id,
        NotificationType.APPROVAL_REQUIRED,
        `Request "${systemName}" requires your Level ${level} approval`,
        relativeLink
      );

      if (approver.email) {
        await sendApprovalNotification(
          approver.email,
          approver.name || "Approver",
          systemName,
          `PENDING_L${level}`,
          level,
          undefined,
          fullActionUrl,
          requestId
        );
      }
    });

    await Promise.all(promises);
  }

  /**
   * Notify requester and developer(s) about deployment/provisioning
   */
  static async notifyDeployment(requestId: string, status: string) {
    try {
      const request = await prisma.request.findUnique({
        where: { id: requestId },
        include: {
          requester: { select: { id: true, email: true, name: true } },
          developer: { select: { id: true, email: true, name: true } },
          targetVm: {
            include: {
              currentSpec: true
            }
          },
          vmInstances: {
            include: {
              currentSpec: true
            }
          },
          requestResources: {
            include: {
              vm: { include: { currentSpec: true } },
              namespace: true
            }
          },
          k8sClusters: {
            include: {
              namespace: true,
              nodeGroups: true
            }
          }
        },
      });

      if (!request) return;

      const systemName = request.systemName;
      const requester = request.requester;
      const developer = request.developer;

      const displayStatus = status.replace(/_/g, " ");
      const message = `Your request "${systemName}" has been deployed/provisioned (Status: ${displayStatus}).`;
      const relativeLink = `/requests/${request.id}/view`;
      const fullActionUrl = `${getAppUrl()}${relativeLink}`;

      let vmsDetails: VMNotificationDetails[] = (request.vmInstances || []).map((vm: any) => ({
        hostname: vm.hostname || "—",
        ipAddress: vm.ipAddress || undefined,
        publicIpAddress: vm.publicIpAddress || undefined,
        subdomain: vm.subdomain || undefined,
        vcpu: vm.currentSpec?.vcpu || 0,
        ramGb: vm.currentSpec?.ramGb || 0,
        storageGb: vm.currentSpec?.storageGb || 0,
        osName: vm.currentSpec?.osName || undefined,
        osVersion: vm.currentSpec?.osVersion || undefined,
      }));

      if (vmsDetails.length === 0 && request.targetVm) {
        vmsDetails = [{
          hostname: request.targetVm.hostname || "—",
          ipAddress: request.targetVm.ipAddress || undefined,
          publicIpAddress: request.targetVm.publicIpAddress || undefined,
          subdomain: request.targetVm.subdomain || undefined,
          vcpu: request.upgradeCpu || request.targetVm.currentSpec?.vcpu || 0,
          ramGb: request.upgradeRamGb || request.targetVm.currentSpec?.ramGb || 0,
          storageGb: request.upgradeStorageGb || request.targetVm.currentSpec?.storageGb || 0,
          osName: request.targetVm.currentSpec?.osName || undefined,
          osVersion: request.targetVm.currentSpec?.osVersion || undefined,
        }];
      }

      let vpnDetails: VpnNotificationDetails | undefined;
      let horizonDetails: HorizonNotificationDetails | undefined;
      let k8sNamespaceDetails: K8sNamespaceNotificationDetails | undefined;

      if (request.requestType === "VPN_ACCESS") {
        const vpnAssignments = await prisma.vpnAssignment.findMany({
          where: {
            OR: [
              { vm: { requestId: requestId } },
              { namespace: { requestResources: { some: { requestId: requestId } } } }
            ]
          },
          include: {
            vpnUser: true,
            vm: true,
            namespace: true
          }
        });

        if (vpnAssignments.length > 0) {
          const first = vpnAssignments[0];
          const user = first.vpnUser;
          if (user) {
            const assignedResources: string[] = [];
            for (const ass of vpnAssignments) {
              if (ass.vm?.hostname) assignedResources.push(`VM: ${ass.vm.hostname}`);
              if (ass.namespace?.name) assignedResources.push(`Namespace: ${ass.namespace.name}`);
            }
            vpnDetails = {
              username: user.username,
              fullName: user.fullName,
              vpnProfile: user.vpnProfile,
              vpnIp: user.vpnIp,
              assignedResources,
              expiresAt: first.expiresAt ? first.expiresAt.toLocaleDateString() : undefined,
              notes: first.notes || undefined
            };
          }
        }
      }

      if (request.requestType === "HORIZON_ACCESS") {
        const horizonAssignments = await prisma.horizonAssignment.findMany({
          where: {
            OR: [
              { vm: { requestId: requestId } },
              { namespace: { requestResources: { some: { requestId: requestId } } } }
            ]
          },
          include: {
            horizonUser: true,
            vm: true,
            namespace: true
          }
        });

        if (horizonAssignments.length > 0) {
          const first = horizonAssignments[0];
          const user = first.horizonUser;
          if (user) {
            const assignedResources: string[] = [];
            for (const ass of horizonAssignments) {
              if (ass.vm?.hostname) assignedResources.push(`VM: ${ass.vm.hostname}`);
              if (ass.namespace?.name) assignedResources.push(`Namespace: ${ass.namespace.name}`);
            }
            horizonDetails = {
              username: user.username,
              fullName: user.fullName,
              assignedIp: first.assignedIp || undefined,
              assignedResources,
              notes: first.notes || undefined
            };
          }
        }
      }

      if (request.requestType === "K8S_NAMESPACE" && request.k8sClusters.length > 0) {
        const cluster = request.k8sClusters[0];
        const namespace = cluster.namespace;
        if (namespace) {
          k8sNamespaceDetails = {
            namespaceName: namespace.name,
            supervisorIp: namespace.supervisorIp,
            clusterName: cluster.clusterName,
            nodeGroups: cluster.nodeGroups.map((g: any) => ({
              role: g.role,
              nodeCount: g.nodeCount,
              vcpu: g.vcpu,
              ramGb: g.ramGb
            }))
          };
        }
      }

      // Helper function to dispatch the correct email
      const sendDetailedEmail = async (email: string, name: string) => {
        if (k8sNamespaceDetails) {
          await sendK8sNamespaceDeploymentNotification(
            email,
            name,
            systemName,
            status,
            k8sNamespaceDetails,
            fullActionUrl,
            request.id
          );
        } else if (vpnDetails) {
          await sendVpnAccessDeploymentNotification(
            email,
            name,
            systemName,
            status,
            vpnDetails,
            fullActionUrl,
            request.id
          );
        } else if (horizonDetails) {
          await sendHorizonAccessDeploymentNotification(
            email,
            name,
            systemName,
            status,
            horizonDetails,
            fullActionUrl,
            request.id
          );
        } else if (vmsDetails.length > 0) {
          await sendDeploymentSuccessNotification(
            email,
            name,
            systemName,
            status,
            vmsDetails,
            fullActionUrl,
            request.id
          );
        } else {
          await sendStatusUpdateNotification(
            email,
            name,
            systemName,
            status,
            undefined,
            fullActionUrl,
            request.id
          );
        }
      };

      // 1. Notify requester
      if (requester) {
        await this.createNotification(
          requester.id,
          NotificationType.STATUS_UPDATE,
          message,
          relativeLink
        );

        if (requester.email) {
          await sendDetailedEmail(requester.email, requester.name || "Requester");
        }
      }

      // 2. Notify developer if associated
      if (developer) {
        await this.createNotification(
          developer.id,
          NotificationType.STATUS_UPDATE,
          `Request "${systemName}" you are associated with has been deployed/provisioned (Status: ${displayStatus}).`,
          relativeLink
        );

        if (developer.email) {
          await sendDetailedEmail(developer.email, developer.name || "Developer");
        }
      } else if (request.developerEmail) {
        // Fallback for guest/external developer
        await sendDetailedEmail(request.developerEmail, request.developerName || "Developer");
      }
    } catch (error) {
      console.error("[NotificationService] Failed to send deployment notifications:", error);
    }
  }

  /**
   * Notify the requester about status changes
   */
  static async notifyRequester(userId: string, systemName: string, status: string, requestId?: string, comments?: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    const relativeLink = requestId ? `/requests/${requestId}/view` : "/requests";
    const fullActionUrl = `${getAppUrl()}${relativeLink}`;

    await this.createNotification(
      userId,
      NotificationType.STATUS_UPDATE,
      `Your request "${systemName}" status updated to: ${status.replace(/_/g, " ")}`,
      relativeLink
    );

    if (user?.email) {
      await sendStatusUpdateNotification(
        user.email,
        user.name || "Requester",
        systemName,
        status,
        comments,
        fullActionUrl,
        requestId
      );
    }
  }

  /**
   * Notify DCOps that a request is ready for execution
   */
  static async notifyDCOps(requestId: string, systemName: string) {
    const dcopsUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        roles: {
          some: {
            role: { name: UserRole.DCOPS },
          },
        },
      },
    });

    const relativeLink = `/approvals/${requestId}?type=request`;
    const fullActionUrl = `${getAppUrl()}${relativeLink}`;

    const promises = dcopsUsers.map(async (user: any) => {
      await this.createNotification(
        user.id,
        NotificationType.EXECUTION_READY,
        `Request "${systemName}" has been APPROVED and is ready for execution.`,
        relativeLink
      );

      if (user.email) {
        await sendApprovalNotification(
          user.email,
          user.name || "DCOps",
          systemName,
          "APPROVED",
          0,
          "Request approved and ready for execution",
          fullActionUrl,
          requestId
        );
      }
    });

    await Promise.all(promises);
  }

  /**
   * General purpose notification dispatcher
   */
  static async send(params: {
    userId: string;
    type: NotificationType;
    message: string;
    link?: string;
    email?: {
      to: string;
      subject: string;
      html: string;
    };
  }) {
    await this.createNotification(params.userId, params.type, params.message, params.link);
    
    // Implementation for custom emails if needed via a more generic email service
  }
}
