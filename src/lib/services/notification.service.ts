import prisma from "@/lib/prisma";
import { NotificationType, UserRole } from "@/lib/types/enums";
import { sendApprovalNotification, sendStatusUpdateNotification } from "@/lib/email";

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
  static async notifyApprovers(requestId: string, systemName: string, level: number) {
    const roleMap: Record<number, string> = {
      1: UserRole.L1_APPROVER,
      2: UserRole.L2_APPROVER,
      3: UserRole.L3_APPROVER,
      4: UserRole.L4_APPROVER,
    };

    const targetRole = roleMap[level];
    if (!targetRole) return;

    const approvers = await prisma.user.findMany({
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

    for (const approver of approvers) {
      await this.createNotification(
        approver.id,
        NotificationType.APPROVAL_REQUIRED,
        `Request "${systemName}" requires your Level ${level} approval`,
        `/approvals/${requestId}`
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
   * Notify the requester about status changes
   */
  static async notifyRequester(userId: string, systemName: string, status: string, comments?: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    await this.createNotification(
      userId,
      NotificationType.STATUS_UPDATE,
      `Your request "${systemName}" status updated to: ${status.replace(/_/g, " ")}`,
      `/requests/${systemName.toLowerCase().replace(/\s+/g, "-")}`
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
