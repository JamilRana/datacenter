import prisma from "@/lib/prisma";
import { NotificationType, UserRole } from "@/lib/types/enums";
import { sendApprovalNotification, sendStatusUpdateNotification } from "@/lib/email";
import { getWorkflowConfig } from "@/lib/workflow";

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

    for (const approver of approvers) {
      const typeParam = entityType === "CUSTOMIZATION" ? "customization" : "request";
      await this.createNotification(
        approver.id,
        NotificationType.APPROVAL_REQUIRED,
        `Request "${systemName}" requires your Level ${level} approval`,
        `/approvals/${requestId}?type=${typeParam}`
      );

      if (approver.email) {
        await sendApprovalNotification(
          approver.email,
          approver.name || "Approver",
          systemName,
          `PENDING_L${level}`,
          level
        );
      }
    }
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
        },
      });

      if (!request) return;

      const systemName = request.systemName;
      const requester = request.requester;
      const developer = request.developer;

      const displayStatus = status.replace(/_/g, " ");
      const message = `Your request "${systemName}" has been deployed/provisioned (Status: ${displayStatus}).`;

      // 1. Notify requester
      if (requester) {
        await this.createNotification(
          requester.id,
          NotificationType.STATUS_UPDATE,
          message,
          `/requests/${request.id}/view`
        );

        if (requester.email) {
          await sendStatusUpdateNotification(
            requester.email,
            requester.name || "Requester",
            systemName,
            status
          );
        }
      }

      // 2. Notify developer if associated
      if (developer) {
        await this.createNotification(
          developer.id,
          NotificationType.STATUS_UPDATE,
          `Request "${systemName}" you are associated with has been deployed/provisioned (Status: ${displayStatus}).`,
          `/requests/${request.id}/view`
        );

        if (developer.email) {
          await sendStatusUpdateNotification(
            developer.email,
            developer.name || "Developer",
            systemName,
            status
          );
        }
      } else if (request.developerEmail) {
        // Fallback for guest/external developer
        await sendStatusUpdateNotification(
          request.developerEmail,
          request.developerName || "Developer",
          systemName,
          status
        );
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

    const link = requestId ? `/requests/${requestId}/view` : "/requests";

    await this.createNotification(
      userId,
      NotificationType.STATUS_UPDATE,
      `Your request "${systemName}" status updated to: ${status.replace(/_/g, " ")}`,
      link
    );

    if (user?.email) {
      await sendStatusUpdateNotification(
        user.email,
        user.name || "Requester",
        systemName,
        status,
        comments
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

    for (const user of dcopsUsers) {
      await this.createNotification(
        user.id,
        NotificationType.EXECUTION_READY,
        `Request "${systemName}" has been APPROVED and is ready for execution.`,
        `/inventory/vms`
      );

      if (user.email) {
        await sendApprovalNotification(
          user.email,
          user.name || "DCOps",
          systemName,
          "APPROVED",
          0,
          "Request approved and ready for execution"
        );
      }
    }
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
