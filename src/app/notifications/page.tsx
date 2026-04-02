// src/app/notifications/page.tsx

import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from "../actions/notification-actions";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { Button } from "@/components/ui/button";
import { Check, Bell, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/auth");
  }

  const notifications = await getNotifications(50);
  const unreadCount = await getUnreadCount();

  async function markAllReadAction() {
    "use server";
    await markAllAsRead();
  }

  async function markOneReadAction(id: string) {
    "use server";
    await markAsRead(id);
  }

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "APPROVAL_REQUIRED":
        return "bg-blue-100 text-blue-600";
      case "REQUEST_APPROVED":
      case "VM_PROVISIONED":
        return "bg-green-100 text-green-600";
      case "REQUEST_REJECTED":
        return "bg-red-100 text-red-600";
      case "VM_EXPIRY_WARNING":
      case "LICENSE_EXPIRY_WARNING":
        return "bg-orange-100 text-orange-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-slate-500 mt-1">
            You have {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </p>
        </div>
        {unreadCount > 0 && (
          <form action={markAllReadAction}>
            <Button variant="outline" size="sm">
              <Check className="h-4 w-4 mr-2" />
              Mark all as read
            </Button>
          </form>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {notifications.length === 0 ? (
          <div className="py-16 text-center">
            <Bell className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900">No notifications</h3>
            <p className="text-slate-500 mt-1">You&apos;re all caught up!</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  "p-4 hover:bg-slate-50 transition-colors",
                  !notification.isRead && "bg-blue-50/30"
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "p-2 rounded-lg",
                    getNotificationIcon(notification.type)
                  )}>
                    <Bell className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className={cn(
                          "text-sm",
                          !notification.isRead ? "font-medium text-slate-900" : "text-slate-700"
                        )}>
                          {notification.message}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {formatTime(notification.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!notification.isRead && (
                          <form action={markOneReadAction.bind(null, notification.id)}>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-indigo-600"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          </form>
                        )}
                        {notification.link && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-indigo-600"
                            asChild
                          >
                            <a href={notification.link}>
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}