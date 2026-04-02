"use client";

import { SummaryStatCard } from "@/components/dashboard/SummaryStatCard";
import { InventoryChart } from "@/components/analytics/InventoryChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminDashboardData } from "@/lib/dashboard/adminDashboard";
import { Server, Users, Clock, Cpu } from "lucide-react";
import { format } from "date-fns";

interface AdminWidgetsProps {
  data: AdminDashboardData;
}

export function AdminStatsWidget({ data }: AdminWidgetsProps) {
  const { stats } = data;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <SummaryStatCard
        label="Total VMs"
        value={stats.totalVms}
        icon={Server}
        description="Infrastructure count"
      />
      <SummaryStatCard
        label="Total Users"
        value={stats.totalUsers}
        icon={Users}
        description="System users"
      />
      <SummaryStatCard
        label="Pending Approvals"
        value={stats.pendingApprovals}
        icon={Clock}
        description="Awaiting review"
      />
      <SummaryStatCard
        label="Total CPU Cores"
        value={stats.totalCpuCores}
        icon={Cpu}
        description={`${stats.totalRamGb} GB RAM allocated`}
      />
    </div>
  );
}

export function AdminChartsWidget({ data }: AdminWidgetsProps) {
  const { monthlyTrends, approvalDistribution } = data;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Monthly Request Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <InventoryChart
            title=""
            data={monthlyTrends.map(m => ({
              name: m.month,
              value: m.requests,
              approvals: m.approvals,
              rejections: m.rejections,
            }))}
            type="line"
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Approval Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <InventoryChart
            title=""
            data={approvalDistribution.map(a => ({ name: a.status, value: a.count }))}
            type="pie"
          />
        </CardContent>
      </Card>
    </div>
  );
}

export function AdminAuditLogsWidget({ data }: AdminWidgetsProps) {
  const { recentAuditLogs } = data;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Recent System Audit Logs</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recentAuditLogs.map((log) => (
            <div key={log.id} className="flex items-center justify-between text-sm">
              <div className="space-y-0.5">
                <p className="font-medium text-slate-900">{log.action}</p>
                <p className="text-xs text-slate-500">
                  {log.actor?.name || log.actorId} • {log.entityType || "N/A"}
                </p>
              </div>
              <span className="text-xs text-slate-400">
                {format(new Date(log.timestamp), "MMM dd, HH:mm")}
              </span>
            </div>
          ))}
          {recentAuditLogs.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">No recent activity</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminWidgets({ data }: AdminWidgetsProps) {
  return (
    <div className="space-y-6">
      <AdminStatsWidget data={data} />
      <AdminChartsWidget data={data} />
      <AdminAuditLogsWidget data={data} />
    </div>
  );
}
