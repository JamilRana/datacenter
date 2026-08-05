"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AdminDashboardData } from "@/types";
import { 
  Server, 
  Clock, 
  Cpu, 
  Layers, 
  Activity, 
  CheckCircle2, 
  Database,
  Gauge,
  PlusCircle
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AdminWidgetsProps {
  data: AdminDashboardData;
}

export function AdminStatsWidget({ data }: AdminWidgetsProps) {
  const { infrastructureOverview, requestsSummary } = data;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Running VMs -> My VMs (Running filter) */}
      <Link href="/inventory/vms?status=ACTIVE" className="group">
        <Card className="h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-lg border-l-4 border-l-emerald-500 cursor-pointer">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Running VMs</p>
              <p className="text-3xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                {infrastructureOverview.runningVms}
              </p>
              <p className="text-[10px] text-slate-500 font-medium">Click to view active instances</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
              <Server className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Pending Requests -> Requests (Pending filter) */}
      <Link href="/requests?status=PENDING" className="group">
        <Card className="h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-lg border-l-4 border-l-amber-500 cursor-pointer">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Requests</p>
              <p className="text-3xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                {requestsSummary.pending}
              </p>
              <p className="text-[10px] text-slate-500 font-medium">Click to view pending reviews</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
              <Clock className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Approved Requests -> Requests (Approved filter) */}
      <Link href="/requests?status=APPROVED" className="group">
        <Card className="h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-lg border-l-4 border-l-blue-500 cursor-pointer">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Approved Requests</p>
              <p className="text-3xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                {requestsSummary.approved}
              </p>
              <p className="text-[10px] text-slate-500 font-medium">Ready for deployment</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Inventory Assets -> Inventory Hub */}
      <Link href="/inventory" className="group">
        <Card className="h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-lg border-l-4 border-l-indigo-500 cursor-pointer">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Inventory Assets</p>
              <p className="text-3xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                {infrastructureOverview.totalAssets}
              </p>
              <p className="text-[10px] text-slate-500 font-medium">Explore physical datacenter</p>
            </div>
            <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
              <Database className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}

export function InfrastructureAndResourceWidget({ data }: AdminWidgetsProps) {
  const { infrastructureOverview, resourceSummary } = data;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Infrastructure Overview */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
          <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-600" /> Infrastructure Overview
          </CardTitle>
          <CardDescription>Logical and physical asset totals</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 gap-4">
            <Link href="/inventory/clusters" className="p-4 bg-slate-50 hover:bg-indigo-50/30 border border-slate-100 rounded-xl transition-all group">
              <span className="text-xs font-bold text-slate-400 block uppercase">Total Clusters</span>
              <span className="text-2xl font-black text-slate-800 block mt-1 group-hover:text-indigo-600 transition-colors">{infrastructureOverview.totalClusters}</span>
            </Link>
            <Link href="/inventory/namespaces" className="p-4 bg-slate-50 hover:bg-indigo-50/30 border border-slate-100 rounded-xl transition-all group">
              <span className="text-xs font-bold text-slate-400 block uppercase">Kubernetes Clusters</span>
              <span className="text-2xl font-black text-slate-800 block mt-1 group-hover:text-indigo-600 transition-colors">{infrastructureOverview.totalK8sClusters}</span>
            </Link>
            <Link href="/inventory/vms?status=ACTIVE" className="p-4 bg-slate-50 hover:bg-indigo-50/30 border border-slate-100 rounded-xl transition-all group">
              <span className="text-xs font-bold text-slate-400 block uppercase">Running VMs</span>
              <span className="text-2xl font-black text-emerald-600 block mt-1">{infrastructureOverview.runningVms}</span>
            </Link>
            <Link href="/inventory/vms?status=STOPPED" className="p-4 bg-slate-50 hover:bg-indigo-50/30 border border-slate-100 rounded-xl transition-all group">
              <span className="text-xs font-bold text-slate-400 block uppercase">Stopped VMs</span>
              <span className="text-2xl font-black text-amber-600 block mt-1">{infrastructureOverview.stoppedVms}</span>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Resource Summary */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
          <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Gauge className="h-4 w-4 text-indigo-600" /> Resource Allocation Status
          </CardTitle>
          <CardDescription>Physical resource utilization levels</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* CPU Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-bold text-slate-700 flex items-center gap-1"><Cpu className="h-3.5 w-3.5 text-slate-500" /> CPU Cores</span>
              <span className="font-semibold text-slate-650">{resourceSummary.cpuPercent}% Used</span>
            </div>
            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${resourceSummary.cpuPercent > 85 ? 'bg-red-500' : (resourceSummary.cpuPercent > 70 ? 'bg-amber-500' : 'bg-indigo-600')}`}
                style={{ width: `${Math.min(100, resourceSummary.cpuPercent)}%` }}
              />
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-[10px] mt-1.5 p-2 bg-slate-50 rounded-lg border border-slate-100">
              <div>
                <span className="text-slate-400 block font-bold uppercase text-[9px]">Total</span>
                <span className="text-slate-800 font-extrabold">{resourceSummary.cpuTotal} Cores</span>
              </div>
              <div>
                <span className="text-slate-400 block font-bold uppercase text-[9px]">Allocated</span>
                <span className="text-slate-800 font-extrabold">{resourceSummary.cpuUsed} Cores</span>
              </div>
              <div>
                <span className="text-slate-400 block font-bold uppercase text-[9px]">Available</span>
                <span className="text-slate-800 font-extrabold">{Math.max(0, resourceSummary.cpuTotal - resourceSummary.cpuUsed)} Cores</span>
              </div>
              <div>
                <span className="text-slate-400 block font-bold uppercase text-[9px]">Utilized</span>
                <span className="text-indigo-600 font-black">{resourceSummary.cpuPercent}%</span>
              </div>
            </div>
          </div>

          {/* Memory Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-bold text-slate-700 flex items-center gap-1"><Database className="h-3.5 w-3.5 text-slate-500" /> Memory (RAM)</span>
              <span className="font-semibold text-slate-650">{resourceSummary.ramPercent}% Used</span>
            </div>
            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${resourceSummary.ramPercent > 85 ? 'bg-red-500' : (resourceSummary.ramPercent > 70 ? 'bg-amber-500' : 'bg-indigo-600')}`}
                style={{ width: `${Math.min(100, resourceSummary.ramPercent)}%` }}
              />
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-[10px] mt-1.5 p-2 bg-slate-50 rounded-lg border border-slate-100">
              <div>
                <span className="text-slate-400 block font-bold uppercase text-[9px]">Total</span>
                <span className="text-slate-800 font-extrabold">{resourceSummary.ramTotalGb} GB</span>
              </div>
              <div>
                <span className="text-slate-400 block font-bold uppercase text-[9px]">Allocated</span>
                <span className="text-slate-800 font-extrabold">{resourceSummary.ramUsedGb} GB</span>
              </div>
              <div>
                <span className="text-slate-400 block font-bold uppercase text-[9px]">Available</span>
                <span className="text-slate-800 font-extrabold">{Math.max(0, resourceSummary.ramTotalGb - resourceSummary.ramUsedGb)} GB</span>
              </div>
              <div>
                <span className="text-slate-400 block font-bold uppercase text-[9px]">Utilized</span>
                <span className="text-indigo-600 font-black">{resourceSummary.ramPercent}%</span>
              </div>
            </div>
          </div>

          {/* Storage Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-bold text-slate-700 flex items-center gap-1"><Server className="h-3.5 w-3.5 text-slate-500" /> SAN Storage</span>
              <span className="font-semibold text-slate-650">{resourceSummary.storagePercent}% Used</span>
            </div>
            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${resourceSummary.storagePercent > 85 ? 'bg-red-500' : (resourceSummary.storagePercent > 70 ? 'bg-amber-500' : 'bg-indigo-600')}`}
                style={{ width: `${Math.min(100, resourceSummary.storagePercent)}%` }}
              />
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-[10px] mt-1.5 p-2 bg-slate-50 rounded-lg border border-slate-100">
              <div>
                <span className="text-slate-400 block font-bold uppercase text-[9px]">Total</span>
                <span className="text-slate-800 font-extrabold">{resourceSummary.storageTotalGb} GB</span>
              </div>
              <div>
                <span className="text-slate-400 block font-bold uppercase text-[9px]">Allocated</span>
                <span className="text-slate-800 font-extrabold">{resourceSummary.storageUsedGb} GB</span>
              </div>
              <div>
                <span className="text-slate-400 block font-bold uppercase text-[9px]">Available</span>
                <span className="text-slate-800 font-extrabold">{Math.max(0, resourceSummary.storageTotalGb - resourceSummary.storageUsedGb)} GB</span>
              </div>
              <div>
                <span className="text-slate-400 block font-bold uppercase text-[9px]">Utilized</span>
                <span className="text-indigo-600 font-black">{resourceSummary.storagePercent}%</span>
              </div>
            </div>
          </div>

          {/* Optional GPU Progress */}
          {resourceSummary.gpuTotal !== undefined && resourceSummary.gpuTotal > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1"><Activity className="h-3.5 w-3.5 text-slate-500" /> GPUs</span>
                <span className="font-semibold text-slate-650">{resourceSummary.gpuPercent}% Used</span>
              </div>
              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 bg-emerald-500`}
                  style={{ width: `${Math.min(100, resourceSummary.gpuPercent || 0)}%` }}
                />
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-[10px] mt-1.5 p-2 bg-slate-50 rounded-lg border border-slate-100">
                <div>
                  <span className="text-slate-400 block font-bold uppercase text-[9px]">Total</span>
                  <span className="text-slate-800 font-extrabold">{(resourceSummary.gpuTotal || 0)} Units</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold uppercase text-[9px]">Allocated</span>
                  <span className="text-slate-800 font-extrabold">{(resourceSummary.gpuUsed || 0)} Units</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold uppercase text-[9px]">Available</span>
                  <span className="text-slate-800 font-extrabold">{Math.max(0, (resourceSummary.gpuTotal || 0) - (resourceSummary.gpuUsed || 0))} Units</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold uppercase text-[9px]">Utilized</span>
                  <span className="text-emerald-600 font-black">{resourceSummary.gpuPercent}%</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function RequestsAndHealthWidget({ data }: AdminWidgetsProps) {
  const { requestsSummary, healthStatus } = data;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Requests Summary */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
          <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <PlusCircle className="h-4 w-4 text-indigo-600" /> Requests Summary
          </CardTitle>
          <CardDescription>Operational approvals queue totals</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 gap-4">
            <Link href="/requests?status=PENDING" className="p-4 bg-slate-50 hover:bg-amber-50/40 border border-slate-100 rounded-xl transition-all group flex flex-col">
              <span className="text-xs font-bold text-slate-400 uppercase">Pending</span>
              <span className="text-2xl font-black text-amber-500 mt-1">{requestsSummary.pending}</span>
            </Link>
            <Link href="/requests?status=APPROVED" className="p-4 bg-slate-50 hover:bg-emerald-50/40 border border-slate-100 rounded-xl transition-all group flex flex-col">
              <span className="text-xs font-bold text-slate-400 uppercase">Approved</span>
              <span className="text-2xl font-black text-emerald-600 mt-1">{requestsSummary.approved}</span>
            </Link>
            <Link href="/requests?status=REJECTED" className="p-4 bg-slate-50 hover:bg-red-50/40 border border-slate-100 rounded-xl transition-all group flex flex-col">
              <span className="text-xs font-bold text-slate-400 uppercase">Rejected</span>
              <span className="text-2xl font-black text-red-500 mt-1">{requestsSummary.rejected}</span>
            </Link>
            <Link href="/requests?status=PROVISIONED" className="p-4 bg-slate-50 hover:bg-blue-50/40 border border-slate-100 rounded-xl transition-all group flex flex-col">
              <span className="text-xs font-bold text-slate-400 uppercase">In Progress</span>
              <span className="text-2xl font-black text-blue-500 mt-1">{requestsSummary.inProgress}</span>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Health Status Cards */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
          <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Activity className="h-4 w-4 text-indigo-600" /> Operational Health Status
          </CardTitle>
          <CardDescription>Datacenter status and component telemetry</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {healthStatus.map((item) => (
              <div key={item.title} className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
                <div className="space-y-0.5">
                  <p className="font-bold text-xs text-slate-700 uppercase tracking-wide">{item.title}</p>
                  <p className="text-[11px] text-slate-400 font-medium">{item.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">{item.value}</span>
                  <div className={`h-2.5 w-2.5 rounded-full ${
                    item.status === 'healthy' ? 'bg-emerald-500 animate-pulse' : (item.status === 'warning' ? 'bg-amber-500' : 'bg-red-500')
                  }`} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function AdminRecentActivityWidget({ data }: AdminWidgetsProps) {
  const { recentActivities } = data;

  const getActivityBadgeColor = (type: string) => {
    switch (type) {
      case "request": return "bg-indigo-50 text-indigo-700 border-indigo-100";
      case "vm": return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "approval": return "bg-amber-50 text-amber-700 border-amber-100";
      default: return "bg-slate-50 text-slate-700 border-slate-100";
    }
  };

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
        <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <Activity className="h-4 w-4 text-indigo-600" /> Recent Activity Timeline
        </CardTitle>
        <CardDescription>Live telemetry stream from system updates</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          {recentActivities.map((act) => (
            <div key={act.id} className="flex items-start justify-between text-sm pb-4 border-b border-slate-100 last:border-b-0 last:pb-0">
              <div className="flex gap-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${getActivityBadgeColor(act.type)}`}>
                  {act.type}
                </span>
                <div className="space-y-0.5">
                  <p className="font-bold text-slate-800 leading-tight">{act.title}</p>
                  <p className="text-[11px] text-slate-500 font-medium">{act.subtitle}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  {formatDistanceToNow(new Date(act.timestamp), { addSuffix: true })}
                </span>
                {act.status && (
                  <span className="inline-block text-[9px] font-black uppercase text-slate-400 mt-1">
                    Status: {act.status}
                  </span>
                )}
              </div>
            </div>
          ))}
          {recentActivities.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">No recent operational logs available.</p>
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
      <InfrastructureAndResourceWidget data={data} />
      <RequestsAndHealthWidget data={data} />
      <AdminRecentActivityWidget data={data} />
    </div>
  );
}
