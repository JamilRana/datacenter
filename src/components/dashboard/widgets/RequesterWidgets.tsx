"use client";

import Link from "next/link";
import { SummaryStatCard } from "@/components/dashboard/SummaryStatCard";
import { InventoryChart } from "@/components/analytics/InventoryChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RequesterDashboardData } from "@/lib/dashboard/requesterDashboard";
import { Server, Clock, Cpu, HardDrive } from "lucide-react";
import { format } from "date-fns";

interface RequesterWidgetsProps {
  data: RequesterDashboardData;
}

export function RequesterStatsWidget({ data }: RequesterWidgetsProps) {
  const { stats } = data;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Link href="/my-vms?status=ACTIVE" className="block hover:no-underline">
        <SummaryStatCard
          label="My Active VMs"
          value={stats.myActiveVms}
          icon={Server}
          description="Running instances"
        />
      </Link>
      <Link href="/requests?status=PENDING" className="block hover:no-underline">
        <SummaryStatCard
          label="Pending Requests"
          value={stats.myPendingRequests}
          icon={Clock}
          description="Awaiting approval"
        />
      </Link>
      <Link href="/my-vms" className="block hover:no-underline">
        <SummaryStatCard
          label="My CPU Usage"
          value={stats.myCpuUsed}
          icon={Cpu}
          description="vCPU cores"
        />
      </Link>
      <Link href="/my-vms" className="block hover:no-underline">
        <SummaryStatCard
          label="My RAM Usage"
          value={`${stats.myRamUsedGb} GB`}
          icon={HardDrive}
          description="Memory allocated"
        />
      </Link>
    </div>
  );
}

export function RequesterChartsWidget({ data }: RequesterWidgetsProps) {
  const { resourceAllocation } = data;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">My Resource Allocation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-4 bg-indigo-50 rounded-lg">
            <Cpu className="h-6 w-6 mx-auto text-indigo-600 mb-2" />
            <p className="text-2xl font-bold text-indigo-900">{resourceAllocation.vcpu}</p>
            <p className="text-xs text-indigo-700">vCPUs</p>
          </div>
          <div className="text-center p-4 bg-emerald-50 rounded-lg">
            <HardDrive className="h-6 w-6 mx-auto text-emerald-600 mb-2" />
            <p className="text-2xl font-bold text-emerald-900">{resourceAllocation.ramGb}</p>
            <p className="text-xs text-emerald-700">RAM (GB)</p>
          </div>
          <div className="text-center p-4 bg-amber-50 rounded-lg">
            <Server className="h-6 w-6 mx-auto text-amber-600 mb-2" />
            <p className="text-2xl font-bold text-amber-900">{resourceAllocation.storageGb}</p>
            <p className="text-xs text-amber-700">Storage (GB)</p>
          </div>
        </div>
        <InventoryChart
          title=""
          data={[
            { name: "vCPUs", value: resourceAllocation.vcpu },
            { name: "RAM (GB)", value: resourceAllocation.ramGb },
            { name: "Storage (GB)", value: resourceAllocation.storageGb },
          ]}
          type="bar"
        />
      </CardContent>
    </Card>
  );
}

export function RequesterActivityWidget({ data }: RequesterWidgetsProps) {
  const { recentActivity } = data;

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "VM":
        return <Server className="h-4 w-4" />;
      case "REQUEST":
        return <Clock className="h-4 w-4" />;
      default:
        return <Server className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    if (status.includes("APPROVED") || status.includes("PROVISIONED")) return "bg-emerald-100 text-emerald-700";
    if (status.includes("PENDING")) return "bg-amber-100 text-amber-700";
    if (status.includes("REJECTED")) return "bg-red-100 text-red-700";
    return "bg-slate-100 text-slate-700";
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">My Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recentActivity.map((activity) => (
            <div key={`${activity.type}-${activity.id}`} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="space-y-0.5">
                  <p className="font-medium text-slate-900">{activity.action}</p>
                  <p className="text-xs text-slate-500">{activity.targetName}</p>
                </div>
              </div>
              <div className="text-right">
                <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(activity.status)}`}>
                  {activity.status}
                </span>
                <p className="text-xs text-slate-400 mt-1">
                  {format(new Date(activity.timestamp), "MMM dd, HH:mm")}
                </p>
              </div>
            </div>
          ))}
          {recentActivity.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">No recent activity</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function RequesterWidgets({ data }: RequesterWidgetsProps) {
  return (
    <div className="space-y-6">
      <RequesterStatsWidget data={data} />
      <RequesterChartsWidget data={data} />
      <RequesterActivityWidget data={data} />
    </div>
  );
}
