"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DcopsDashboardData } from "@/types/dashboard";
import { 
  Server, 
  Clock, 
  Cpu, 
  Zap, 
  CheckCircle2, 
  Database,
  HardDrive,
  MemoryStick,
  AlertTriangle,
  Play,
  Layers,
  ShieldCheck,
  Radio,
  FileText,
  KeyRound,
  Check,
  Timer
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface DcopsWidgetsProps {
  data: DcopsDashboardData;
}

export function DcopsWidgets({ data }: DcopsWidgetsProps) {
  const { kpis, executionQueue, multiVmProgress, resourceCapacity, operationalAlerts, recentActivities } = data;

  return (
    <div className="space-y-8">
      {/* 1. TOP KPI CARDS (8 CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Pending Provisioning */}
        <Link href="/approvals" className="group">
          <Card className="h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-md border-l-4 border-l-teal-500 bg-white dark:bg-slate-900 cursor-pointer">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Provisioning</p>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100 group-hover:text-teal-600 transition-colors">
                  {kpis.pendingProvisioning}
                </p>
                <p className="text-[11px] text-slate-500 font-medium">Approved requests waiting for execution</p>
              </div>
              <div className="p-3 bg-teal-50 dark:bg-teal-950/40 rounded-xl text-teal-600">
                <Zap className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Card 2: Provisioning Today */}
        <Link href="/inventory/vms" className="group">
          <Card className="h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-md border-l-4 border-l-emerald-500 bg-white dark:bg-slate-900 cursor-pointer">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Provisioned Today</p>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 transition-colors">
                  {kpis.provisioningToday}
                </p>
                <p className="text-[11px] text-slate-500 font-medium">New instances initialized today</p>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Card 3: Active VMs */}
        <Link href="/inventory/vms?status=ACTIVE" className="group">
          <Card className="h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-md border-l-4 border-l-indigo-500 bg-white dark:bg-slate-900 cursor-pointer">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active VMs</p>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 transition-colors">
                  {kpis.activeVms}
                </p>
                <p className="text-[11px] text-slate-500 font-medium">Currently online and healthy</p>
              </div>
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600">
                <Server className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Card 4: Available CPU */}
        <Link href="/inventory" className="group">
          <Card className="h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-md border-l-4 border-l-blue-500 bg-white dark:bg-slate-900 cursor-pointer">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Available CPU</p>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100 group-hover:text-blue-600 transition-colors">
                  {kpis.availableCpu} <span className="text-xs font-normal text-slate-400">Cores</span>
                </p>
                <p className="text-[11px] text-slate-500 font-medium">
                  {resourceCapacity.cpu.utilizationPercent}% allocated across hosts
                </p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-blue-600">
                <Cpu className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Card 5: Available RAM */}
        <Link href="/inventory" className="group">
          <Card className="h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-md border-l-4 border-l-cyan-500 bg-white dark:bg-slate-900 cursor-pointer">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Available RAM</p>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100 group-hover:text-cyan-600 transition-colors">
                  {kpis.availableRamGb >= 1024 ? `${(kpis.availableRamGb / 1024).toFixed(1)} TB` : `${kpis.availableRamGb} GB`}
                </p>
                <p className="text-[11px] text-slate-500 font-medium">
                  {resourceCapacity.ram.utilizationPercent}% memory allocated
                </p>
              </div>
              <div className="p-3 bg-cyan-50 dark:bg-cyan-950/40 rounded-xl text-cyan-600">
                <MemoryStick className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Card 6: Available Storage */}
        <Link href="/inventory" className="group">
          <Card className="h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-md border-l-4 border-l-purple-500 bg-white dark:bg-slate-900 cursor-pointer">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Available Storage</p>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100 group-hover:text-purple-600 transition-colors">
                  {kpis.availableStorageGb >= 1024 ? `${(kpis.availableStorageGb / 1024).toFixed(1)} TB` : `${kpis.availableStorageGb} GB`}
                </p>
                <p className="text-[11px] text-slate-500 font-medium">
                  {resourceCapacity.storage.utilizationPercent}% storage allocated
                </p>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-950/40 rounded-xl text-purple-600">
                <HardDrive className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Card 7: Expiring VMs */}
        <Link href="/inventory/vms" className="group">
          <Card className="h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-md border-l-4 border-l-orange-500 bg-white dark:bg-slate-900 cursor-pointer">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Expiring VMs</p>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100 group-hover:text-orange-600 transition-colors">
                  {kpis.expiringVms30Days}
                </p>
                <p className="text-[11px] text-slate-500 font-medium">Expiring within 30 days</p>
              </div>
              <div className="p-3 bg-orange-50 dark:bg-orange-950/40 rounded-xl text-orange-600">
                <Timer className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Card 8: Open Operations */}
        <Link href="/approvals" className="group">
          <Card className="h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-md border-l-4 border-l-rose-500 bg-white dark:bg-slate-900 cursor-pointer">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Open Operations</p>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100 group-hover:text-rose-600 transition-colors">
                  {kpis.openOperations}
                </p>
                <p className="text-[11px] text-slate-500 font-medium">Customizations & decommissions</p>
              </div>
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl text-rose-600">
                <Radio className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* 2. PRIMARY COMPONENT: EXECUTION QUEUE */}
      <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Zap className="h-4 w-4 text-teal-600" /> Infrastructure Execution Queue
              </CardTitle>
              <CardDescription className="text-xs">Approved requests awaiting execution and VM provisioning by DC-Ops team</CardDescription>
            </div>
            <Badge variant="secondary" className="bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300">
              {executionQueue.length} Ready for Execution
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {executionQueue.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="font-bold text-slate-700 dark:text-slate-300">Execution Queue Empty</p>
              <p className="text-xs mt-1">All approved infrastructure requests have been provisioned!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 text-xs text-slate-400 uppercase">
                    <th className="py-3 px-4 font-semibold">Request</th>
                    <th className="py-3 px-4 font-semibold">System Name</th>
                    <th className="py-3 px-4 font-semibold">Type</th>
                    <th className="py-3 px-4 font-semibold text-center">VMs</th>
                    <th className="py-3 px-4 font-semibold">Approved Date</th>
                    <th className="py-3 px-4 font-semibold">Priority</th>
                    <th className="py-3 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {executionQueue.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-xs text-indigo-600">{item.requestId}</span>
                        <span className="block text-[10px] text-slate-400 font-normal">{item.environment}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 dark:text-slate-100 block">{item.systemName}</span>
                        <span className="text-[11px] text-slate-500 block">By: {item.requesterName}</span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-[10px]">
                          {item.requestType.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${item.provisionedVms > 0 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700"}`}>
                          {item.provisionedVms} / {item.totalVms}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                        <span>{item.approvedAt ? formatDistanceToNow(new Date(item.approvedAt), { addSuffix: true }) : "Recent"}</span>
                        <span className="block text-[10px] text-slate-400">({item.hoursWaiting}h in queue)</span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge 
                          className={`text-[10px] font-bold ${
                            item.priority === "HIGH" 
                              ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200" 
                              : item.priority === "NORMAL"
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200"
                              : "bg-slate-50 text-slate-600 border-slate-200"
                          }`}
                        >
                          {item.priority}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button asChild size="sm" className="bg-teal-600 hover:bg-teal-700 text-white text-xs h-8">
                          <Link href={`/approvals/${item.id}?type=request`}>
                            <Play className="h-3.5 w-3.5 mr-1.5" /> Execute
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. MULTI-VM PROVISIONING PROGRESS + RESOURCE CAPACITY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Multi-VM Progress */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-600" /> Multi-VM Provisioning Progress
            </CardTitle>
            <CardDescription className="text-xs">Granular sub-status for multi-instance deployments</CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {multiVmProgress.length === 0 ? (
              <p className="text-xs text-slate-400 p-6 text-center italic">No active multi-VM requests in progress</p>
            ) : (
              multiVmProgress.map((req) => (
                <div key={req.requestId} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold text-sm text-slate-900 dark:text-slate-100">{req.systemName}</p>
                      <p className="text-xs text-slate-400 font-mono">Request: {req.requestId}</p>
                    </div>
                    <Badge variant="outline" className="font-bold">
                      {req.completedVms} / {req.totalVms} Completed
                    </Badge>
                  </div>

                  {/* Individual VM Badges */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    {req.vmDetails.map((vm) => (
                      <div 
                        key={vm.sequence} 
                        className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                          vm.status === "PROVISIONED" 
                            ? "bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300" 
                            : "bg-amber-50/70 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900 text-amber-800 dark:text-amber-300"
                        }`}
                      >
                        <div>
                          <span className="font-bold block">VM {vm.sequence}</span>
                          <span className="text-[10px] opacity-80">{vm.hostname || "Pending naming"}</span>
                        </div>
                        {vm.status === "PROVISIONED" ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Clock className="h-4 w-4 text-amber-600" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Resource Capacity Gauges */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex justify-between items-center">
              <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Cpu className="h-4 w-4 text-indigo-600" /> Host Capacity & Utilization
              </CardTitle>
              {resourceCapacity.isOverAllocated && (
                <Badge variant="destructive" className="text-[10px] animate-pulse">
                  High Utilization Warning
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs">Cluster host aggregate allocation levels</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* CPU Gauge */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Cpu className="h-4 w-4 text-indigo-600" /> CPU Core Capacity
                </span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {resourceCapacity.cpu.allocated} / {resourceCapacity.cpu.total} Cores ({resourceCapacity.cpu.utilizationPercent}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${resourceCapacity.cpu.utilizationPercent > 85 ? "bg-rose-500" : "bg-indigo-600"}`}
                  style={{ width: `${Math.min(100, resourceCapacity.cpu.utilizationPercent)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 text-right">{resourceCapacity.cpu.available} Cores available for deployment</p>
            </div>

            {/* RAM Gauge */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <MemoryStick className="h-4 w-4 text-blue-600" /> System Memory (RAM)
                </span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {resourceCapacity.ram.allocatedGb >= 1024 ? `${(resourceCapacity.ram.allocatedGb / 1024).toFixed(1)} TB` : `${resourceCapacity.ram.allocatedGb} GB`} / {resourceCapacity.ram.totalGb >= 1024 ? `${(resourceCapacity.ram.totalGb / 1024).toFixed(1)} TB` : `${resourceCapacity.ram.totalGb} GB`} ({resourceCapacity.ram.utilizationPercent}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${resourceCapacity.ram.utilizationPercent > 85 ? "bg-rose-500" : "bg-blue-600"}`}
                  style={{ width: `${Math.min(100, resourceCapacity.ram.utilizationPercent)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 text-right">{resourceCapacity.ram.availableGb >= 1024 ? `${(resourceCapacity.ram.availableGb / 1024).toFixed(1)} TB` : `${resourceCapacity.ram.availableGb} GB`} available for deployment</p>
            </div>

            {/* Storage Gauge */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <HardDrive className="h-4 w-4 text-purple-600" /> SAN & Block Storage
                </span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {resourceCapacity.storage.allocatedGb >= 1024 ? `${(resourceCapacity.storage.allocatedGb / 1024).toFixed(1)} TB` : `${resourceCapacity.storage.allocatedGb} GB`} / {resourceCapacity.storage.totalGb >= 1024 ? `${(resourceCapacity.storage.totalGb / 1024).toFixed(1)} TB` : `${resourceCapacity.storage.totalGb} GB`} ({resourceCapacity.storage.utilizationPercent}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${resourceCapacity.storage.utilizationPercent > 85 ? "bg-rose-500" : "bg-purple-600"}`}
                  style={{ width: `${Math.min(100, resourceCapacity.storage.utilizationPercent)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 text-right">{resourceCapacity.storage.availableGb >= 1024 ? `${(resourceCapacity.storage.availableGb / 1024).toFixed(1)} TB` : `${resourceCapacity.storage.availableGb} GB`} available storage</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. OPERATIONAL ALERTS & RECENT ACTIVITY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Operational Alerts */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" /> Operational Action Alerts
            </CardTitle>
            <CardDescription className="text-xs">Capacity thresholds and expiring milestones requiring intervention</CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {operationalAlerts.length === 0 ? (
              <p className="text-xs text-slate-400 p-6 text-center italic">No active operational alerts</p>
            ) : (
              operationalAlerts.map((alert) => (
                <div 
                  key={alert.id}
                  className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-3 ${
                    alert.level === "critical" 
                      ? "bg-rose-50/70 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900 text-rose-900 dark:text-rose-200"
                      : "bg-amber-50/70 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900 text-amber-900 dark:text-amber-200"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${alert.level === "critical" ? "text-rose-600" : "text-amber-600"}`} />
                    <div>
                      <p className="font-bold">{alert.title}</p>
                      <p className="text-[11px] opacity-80 mt-0.5">{alert.description}</p>
                    </div>
                  </div>
                  {alert.actionHref && (
                    <Button asChild size="sm" variant="outline" className="h-7 text-[10px] flex-shrink-0">
                      <Link href={alert.actionHref}>View</Link>
                    </Button>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Provisioning Activity */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-600" /> Recent Provisioning Executions
            </CardTitle>
            <CardDescription className="text-xs">Recent infrastructure deployment activities</CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-2.5">
            {recentActivities.slice(0, 5).map((activity) => (
              <div key={activity.id} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 text-xs transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-md bg-teal-50 dark:bg-teal-950/50 text-teal-600">
                    <Zap className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-200">{activity.title}</p>
                    <p className="text-[10px] text-slate-400">{activity.subtitle}</p>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400">
                  {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* 5. DC_OPS QUICK ACTIONS */}
      <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            Operational Shortcuts
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            <Link 
              href="/approvals" 
              className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-teal-500 hover:bg-teal-50/40 text-slate-700 dark:text-slate-300 hover:text-teal-600 font-medium text-xs text-center transition-all group"
            >
              <Zap className="h-4 w-4 text-teal-600" />
              <span>Provisioning</span>
            </Link>

            <Link 
              href="/inventory/vms" 
              className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:bg-indigo-50/40 text-slate-700 dark:text-slate-300 hover:text-indigo-600 font-medium text-xs text-center transition-all group"
            >
              <Server className="h-4 w-4 text-indigo-600" />
              <span>Manage VMs</span>
            </Link>

            <Link 
              href="/inventory" 
              className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:bg-blue-50/40 text-slate-700 dark:text-slate-300 hover:text-blue-600 font-medium text-xs text-center transition-all group"
            >
              <Database className="h-4 w-4 text-blue-600" />
              <span>Assets</span>
            </Link>

            <Link 
              href="/inventory/licenses" 
              className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-purple-500 hover:bg-purple-50/40 text-slate-700 dark:text-slate-300 hover:text-purple-600 font-medium text-xs text-center transition-all group"
            >
              <KeyRound className="h-4 w-4 text-purple-600" />
              <span>Licenses</span>
            </Link>

            <Link 
              href="/inventory/clusters" 
              className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-cyan-500 hover:bg-cyan-50/40 text-slate-700 dark:text-slate-300 hover:text-cyan-600 font-medium text-xs text-center transition-all group"
            >
              <Layers className="h-4 w-4 text-cyan-600" />
              <span>Clusters</span>
            </Link>

            <Link 
              href="/inventory/vpn" 
              className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 hover:bg-emerald-50/40 text-slate-700 dark:text-slate-300 hover:text-emerald-600 font-medium text-xs text-center transition-all group"
            >
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>VPN</span>
            </Link>

            <Link 
              href="/inventory/horizon" 
              className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-500 hover:bg-amber-50/40 text-slate-700 dark:text-slate-300 hover:text-amber-600 font-medium text-xs text-center transition-all group"
            >
              <Server className="h-4 w-4 text-amber-600" />
              <span>Horizon</span>
            </Link>

            <Link 
              href="/reports" 
              className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-500 hover:bg-slate-50/40 text-slate-700 dark:text-slate-300 hover:text-slate-900 font-medium text-xs text-center transition-all group"
            >
              <FileText className="h-4 w-4 text-slate-600" />
              <span>Reports</span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
