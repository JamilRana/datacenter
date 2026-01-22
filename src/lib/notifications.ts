// src/lib/notifications.ts
import prisma from "./prisma";

export async function createNotification(userId: string, type: string, message: string) {
  try {
    await (prisma as any).notification.create({
      data: {
        userId,
        type,
        message,
      },
    });

    // Stub for email notification [cite: 17, 42, 67]
    console.log(`[EMAIL STUB] Sending email to User ${userId}: ${message}`);
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
}

export async function notifyApprovers(requestId: string, systemName: string) {
  // Find all approvers for the next level (e.g. L1 if just submitted)
  // For simplicity, we'll notify all users with any APPROVER role
  const approvers = await prisma.user.findMany({
    where: {
      roles: {
        some: {
          role: { name: { startsWith: "APPROVER_" } },
        },
      },
    },
  });

  for (const approver of approvers) {
    await createNotification(
      approver.id,
      "APPROVAL_REQUIRED",
      `New request for ${systemName} requires your approval.`
    );
  }
}

export async function notifyRequester(userId: string, systemName: string, status: string) {
  await createNotification(
    userId,
    "STATUS_UPDATE",
    `Your request for ${systemName} is now ${status}.`
  );
}
