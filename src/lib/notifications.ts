// src/lib/notifications.ts
import prisma from "./prisma";
import { ROLES } from "./roles";

export async function createNotification(userId: string, type: string, message: string) {
  try {
    await prisma.notification.create({
      data: {
        userId,
        type,
        message,
        isRead: false,
      },
    });

    // Optional: Email/SMS integration stub
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
      `New request "${systemName}" requires your approval (ID: ${requestId})`
    );
  }
}

export async function notifyRequester(userId: string, systemName: string, status: string) {
  await createNotification(
    userId,
    "STATUS_UPDATE",
    `Your request "${systemName}" status updated to: ${status.replace(/_/g, " ")}`
  );
}

// ✅ NEW: Notify Director for escalated requests
export async function notifyDirector(userId: string, systemName: string, requestId: string) {
  await createNotification(
    userId,
    "DIRECTOR_ESCALATION",
    `Request "${systemName}" (ID: ${requestId}) escalated to you for final approval`
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