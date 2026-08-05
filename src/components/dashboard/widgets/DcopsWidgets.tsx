"use client";

import { SummaryStatCard } from "@/components/dashboard/SummaryStatCard";
import { InventoryChart } from "@/components/analytics/InventoryChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DcopsDashboardData } from "@/lib/dashboard/dcopsDashboard";
import { Cpu, HardDrive, Server, Package } from "lucide-react";
import { format } from "date-fns";

interface DcopsWidgetsProps {
  data: DcopsDashboardData;
}

export function DcopsStatsWidget({ data }: DcopsWidgetsProps) {
  const { stats } = data;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <SummaryStatCard
        label="vCPU Allocated"
        value={stats.totalVcpuAllocated}
        icon={Cpu}
        description="Total virtual CPUs"
      />
      <SummaryStatCard
        label="RAM Allocated"
        value={`${stats.totalRamAllocated} GB`}
        icon={HardDrive}
        description="Total memory"
      />
      <SummaryStatCard
        label="Hardware Assets"
        value={stats.availableHardwareAssets}
        icon={Server}
        description="Physical assets"
      />
      <SummaryStatCard
        label="Pending Provisioning"
        value={stats.pendingProvisioning}
        icon={Package}
        description="Awaiting execution"
      />
    </div>
  );
}

export function DcopsChartsWidget({ data }: DcopsWidgetsProps) {
  const { serverUtilization, environmentDistribution } = data;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Server Utilization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="#e2e8f0"
                  strokeWidth="12"
                  fill="none"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="#6366f1"
                  strokeWidth="12"
                  fill="none"
                  strokeDasharray={`${(serverUtilization.utilizationPercent / 100) * 352} 352`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold">{serverUtilization.utilizationPercent}%</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="p-3 bg-emerald-50 rounded-lg">
              <p className="text-2xl font-bold text-emerald-600">{serverUtilization.activeServers}</p>
              <p className="text-xs text-emerald-700">Active</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg">
              <p className="text-2xl font-bold text-amber-600">{serverUtilization.suspendedServers}</p>
              <p className="text-xs text-amber-700">Suspended</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Environment Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <InventoryChart
            title=""
            data={environmentDistribution.map(e => ({ name: e.environment, value: e.count }))}
            type="bar"
          />
        </CardContent>
      </Card>
    </div>
  );
}

export function DcopsProvisioningQueueWidget({ data }: DcopsWidgetsProps) {
  const { provisioningQueue } = data;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Provisioning Queue</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {provisioningQueue.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="space-y-0.5">
                <p className="font-medium text-slate-900">{item.systemName}</p>
                <p className="text-xs text-slate-500">
                  {item.requesterName} • {item.vcpu} vCPU / {item.ramGb} GB RAM
                </p>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full">
                  {item.environment}
                </span>
                <p className="text-xs text-slate-400 mt-1">
                  {format(new Date(item.createdAt), "MMM dd")}
                </p>
              </div>
            </div>
          ))}
          {provisioningQueue.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">No pending provisioning requests</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function DcopsWidgets({ data }: DcopsWidgetsProps) {
  return (
    <div className="space-y-6">
      <DcopsStatsWidget data={data} />
      <DcopsChartsWidget data={data} />
      <DcopsProvisioningQueueWidget data={data} />
    </div>
  );
}
