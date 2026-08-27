// src/app/actions/notification-actions.ts

"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export interface NotificationItem {
  id: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  link?: string | null;
}

export async function getNotifications(limit = 10): Promise<NotificationItem[]> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return [];

    const notifications = await prisma.notification.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });

    return notifications;
  } catch (error) {
    console.warn("Failed to get notifications (DB may be connecting/waking up):", error);
    return [];
  }
}

export async function getUnreadCount(): Promise<number> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return 0;

    return await prisma.notification.count({
      where: {
        userId: session.user.id,
        isRead: false,
      },
    });
  } catch (error) {
    console.warn("Failed to get unread count (DB may be connecting/waking up):", error);
    return 0;
  }
}

export async function markAsRead(notificationId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  await prisma.notification.update({
    where: {
      id: notificationId,
      userId: session.user.id,
    },
    data: {
      isRead: true,
    },
  });
}

export async function markAllAsRead() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  await prisma.notification.updateMany({
    where: {
      userId: session.user.id,
      isRead: false,
    },
    data: {
      isRead: true,
    },
  });
}

export async function markNotificationAsRead(notificationId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  await prisma.notification.update({
    where: {
      id: notificationId,
      userId: session.user.id,
    },
    data: {
      isRead: true,
    },
  });
}
