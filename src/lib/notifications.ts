// src/lib/notifications.ts
import prisma from "./prisma";
import { ROLES } from "./roles";
import { sendApprovalNotification } from "./email";

export async function createNotification(userId: string, type: string, message: string, link?: string) {
  try {
    await prisma.notification.create({
      data: {
        userId,
        type,
        message,
        link,
        isRead: false,
      },
    });

    console.log(`[NOTIFICATION] User ${userId}: ${message}`);
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
}

export async function notifyApprovers(requestId: string, systemName: string) {
  const approvers = await prisma.user.findMany({
    where: {
      isActive: true,
      roles: {
        some: {
          role: { 
            name: { 
              in: ["APPROVER_L1", "APPROVER_L2", "APPROVER_L3"] 
            } 
          },
        },
      },
    },
  });

  for (const approver of approvers) {
    await createNotification(
      approver.id,
      "APPROVAL_REQUIRED",
      `New request "${systemName}" requires your approval`,
      `/approvals/${requestId}`
    );

    if (approver.email) {
      await sendApprovalNotification(
        approver.email,
        approver.name || "Approver",
        systemName,
        "PENDING_L1",
        1,
        undefined
      );
    }
  }
}

export async function notifyRequester(userId: string, systemName: string, status: string) {
  await createNotification(
    userId,
    "STATUS_UPDATE",
    `Your request "${systemName}" status updated to: ${status.replace(/_/g, " ")}`,
    `/requests/${systemName.toLowerCase().replace(/\s+/g, '-')}`
  );
}

// ✅ NEW: Notify Director for escalated requests
export async function notifyDirector(userId: string, systemName: string, requestId: string) {
  await createNotification(
    userId,
    "DIRECTOR_ESCALATION",
    `Request "${systemName}" escalated to you for final approval`,
    `/approvals/${requestId}`
  );
}

// ✅ NEW: Get director user (for escalation workflow)
export async function getDirector(): Promise<{ id: string; name: string; email: string } | null> {
  const director = await prisma.user.findFirst({
    where: { 
      isActive: true,
      roles: { 
        some: { 
          role: { name: ROLES.L4_APPROVER } 
        } 
      } 
    },
    select: { id: true, name: true, email: true }
  });
  return director;
}

// ✅ NEW: Notify DCOps for approved requests
export async function notifyDCOps(requestId: string, systemName: string) {
  const dcopsUsers = await prisma.user.findMany({
    where: { 
      isActive: true,
      roles: { 
        some: { 
          role: { name: ROLES.DCOPS } 
        } 
      } 
    }
  });

  for (const user of dcopsUsers) {
    await createNotification(
      user.id,
      "EXECUTION_READY",
      `Request "${systemName}" has been APPROVED and is ready for execution.`,
      `/inventory/vms`
    );

    // Send email notification to DCOps
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