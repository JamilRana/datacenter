"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon, Server, Shield, HardDrive, Trash2, Edit, Activity as ActivityIcon } from "lucide-react";

interface ActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  actorName?: string;
  details?: string;
  createdAt: Date | string;
}

interface RecentActivityProps {
  title?: string;
  activities: ActivityItem[];
  className?: string;
}

const actionIcons: Record<string, LucideIcon> = {
  VM_CREATED: Server,
  VM_PROVISIONED: Server,
  VM_UPDATED: Edit,
  VM_DECOMMISSIONED: Trash2,
  LICENSE_ASSIGNED: Shield,
  LICENSE_CREATED: Shield,
  LICENSE_EXPIRED: Shield,
  ASSET_CREATED: HardDrive,
  ASSET_ALLOCATED: HardDrive,
  ASSET_UPDATED: Edit,
  DEFAULT: ActivityIcon,
};

const actionColors: Record<string, string> = {
  VM_CREATED: "bg-blue-100 text-blue-600",
  VM_PROVISIONED: "bg-emerald-100 text-emerald-600",
  VM_UPDATED: "bg-amber-100 text-amber-600",
  VM_DECOMMISSIONED: "bg-red-100 text-red-600",
  LICENSE_ASSIGNED: "bg-purple-100 text-purple-600",
  LICENSE_CREATED: "bg-purple-100 text-purple-600",
  LICENSE_EXPIRED: "bg-red-100 text-red-600",
  ASSET_CREATED: "bg-blue-100 text-blue-600",
  ASSET_ALLOCATED: "bg-emerald-100 text-emerald-600",
  ASSET_UPDATED: "bg-amber-100 text-amber-600",
};

function ActivityRow({ 
  icon: Icon, 
  colorClass, 
  title, 
  description, 
  time 
}: { 
  icon: LucideIcon; 
  colorClass: string; 
  title: string; 
  description?: string; 
  time: string; 
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={cn("p-2 rounded-lg", colorClass)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">{title}</p>
        {description && (
          <p className="text-xs text-slate-500 truncate">{description}</p>
        )}
      </div>
      <span className="text-xs text-slate-400 whitespace-nowrap">{time}</span>
    </div>
  );
}

export function RecentActivity({
  title = "Recent Activity",
  activities,
  className,
}: RecentActivityProps) {
  const formatTime = (date: Date | string) => {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return past.toLocaleDateString();
  };

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium text-slate-700">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">
              No recent activity
            </p>
          ) : (
            activities.slice(0, 10).map((activity) => {
              const Icon = actionIcons[activity.action] || actionIcons.DEFAULT;
              const colorClass = actionColors[activity.action] || "bg-slate-100 text-slate-600";
              
              return (
                <ActivityRow
                  key={activity.id}
                  icon={Icon}
                  colorClass={colorClass}
                  title={activity.action.replace(/_/g, " ")}
                  description={activity.details || `${activity.entityType} - ${activity.actorName || "System"}`}
                  time={formatTime(activity.createdAt)}
                />
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
