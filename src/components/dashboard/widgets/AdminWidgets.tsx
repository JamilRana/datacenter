"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminDashboardData } from "@/types/dashboard";
import { 
  Server, 
  Clock, 
  Cpu, 
  Activity, 
  CheckCircle2, 
  Database,
  Gauge,
  Users,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  UserPlus,
  Settings,
  Mail,
  FileText,
  Workflow,
  KeyRound,
  HardDrive,
  MemoryStick,
  Radio,
  Zap,
  Timer
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AdminWidgetsProps {
  data: AdminDashboardData;
}

export function AdminWidgets({ data }: AdminWidgetsProps) {
  const { kpis, requestPipeline, resourceOverview, systemHealth, expiryAndAttention, recentActivities } = data;
  const [attentionTab, setAttentionTab] = useState<"vms" | "licenses" | "stuck">("vms");

  return (
    <div className="space-y-8">
      {/* 1. TOP KPI CARDS (8 CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total VMs */}
        <Link href="/inventory/vms" className="group">
          <Card className="h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-md border-l-4 border-l-emerald-500 bg-white dark:bg-slate-900 cursor-pointer">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total VMs</p>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 transition-colors">
                  {kpis.totalVms.total}
                </p>
                <div className="flex gap-2 text-[11px] text-slate-500 font-medium">
                  <span className="text-emerald-600 font-bold">{kpis.totalVms.active} Active</span>
                  <span>•</span>
                  <span className="text-amber-600">{kpis.totalVms.suspended} Susp</span>
                  <span>•</span>
                  <span className="text-slate-400">{kpis.totalVms.retired} Ret</span>
                </div>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600">
                <Server className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Card 2: Total Requests */}
        <Link href="/requests" className="group">
          <Card className="h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-md border-l-4 border-l-indigo-500 bg-white dark:bg-slate-900 cursor-pointer">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Requests</p>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 transition-colors">
                  {kpis.totalRequests.total}
                </p>
                <div className="flex gap-2 text-[11px] text-slate-500 font-medium">
                  <span className="text-indigo-600 font-bold">{kpis.totalRequests.thisMonth} this month</span>
                  <span>•</span>
                  <span className="text-amber-600 font-bold">{kpis.totalRequests.pending} pending</span>
                </div>
              </div>
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600">
                <FileText className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Card 3: Pending Approvals */}
        <Link href="/approvals" className="group">
          <Card className="h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-md border-l-4 border-l-amber-500 bg-white dark:bg-slate-900 cursor-pointer">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Approvals</p>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100 group-hover:text-amber-600 transition-colors">
                  {kpis.pendingApprovals.total}
                </p>
                <div className="flex gap-1.5 text-[11px] text-slate-500 font-medium">
                  <span className="text-amber-700 bg-amber-50 dark:bg-amber-950/50 px-1 rounded font-bold">L1: {kpis.pendingApprovals.l1}</span>
                  <span className="text-blue-700 bg-blue-50 dark:bg-blue-950/50 px-1 rounded font-bold">L2: {kpis.pendingApprovals.l2}</span>
                  <span className="text-purple-700 bg-purple-50 dark:bg-purple-950/50 px-1 rounded font-bold">L3: {kpis.pendingApprovals.l3}</span>
                  <span className="text-rose-700 bg-rose-50 dark:bg-rose-950/50 px-1 rounded font-bold">L4: {kpis.pendingApprovals.l4}</span>
                </div>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-amber-600">
                <Clock className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Card 4: Pending DC_OPS Execution */}
        <Link href="/approvals" className="group">
          <Card className="h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-md border-l-4 border-l-teal-500 bg-white dark:bg-slate-900 cursor-pointer">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending DC_OPS</p>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100 group-hover:text-teal-600 transition-colors">
                  {kpis.pendingDcOps}
                </p>
                <p className="text-[11px] text-slate-500 font-medium">Approved requests waiting for execution</p>
              </div>
              <div className="p-3 bg-teal-50 dark:bg-teal-950/40 rounded-xl text-teal-600">
                <Zap className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Card 5: Active Users */}
        <Link href="/admin/users" className="group">
          <Card className="h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-md border-l-4 border-l-blue-500 bg-white dark:bg-slate-900 cursor-pointer">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Users</p>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100 group-hover:text-blue-600 transition-colors">
                  {kpis.activeUsers.active} <span className="text-xs font-normal text-slate-400">/ {kpis.activeUsers.total}</span>
                </p>
                <div className="flex gap-2 text-[11px] text-slate-500 font-medium">
                  <span className="text-blue-600 font-bold">{kpis.activeUsers.active} Active</span>
                  <span>•</span>
                  <span className="text-slate-400">{kpis.activeUsers.inactive} Inactive</span>
                </div>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-blue-600">
                <Users className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Card 6: Expiring VMs */}
        <Link href="/inventory/vms" className="group">
          <Card className="h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-md border-l-4 border-l-orange-500 bg-white dark:bg-slate-900 cursor-pointer">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Expiring VMs</p>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100 group-hover:text-orange-600 transition-colors">
                  {kpis.expiringVms.next30Days}
                </p>
                <div className="flex gap-2 text-[11px] text-slate-500 font-medium">
                  <span className="text-orange-600 font-bold">30d: {kpis.expiringVms.next30Days}</span>
                  <span>•</span>
                  <span>60d: {kpis.expiringVms.next60Days}</span>
                  <span>•</span>
                  <span>90d: {kpis.expiringVms.next90Days}</span>
                </div>
              </div>
              <div className="p-3 bg-orange-50 dark:bg-orange-950/40 rounded-xl text-orange-600">
                <Timer className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Card 7: Expiring Licenses */}
        <Link href="/inventory/licenses" className="group">
          <Card className="h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-md border-l-4 border-l-purple-500 bg-white dark:bg-slate-900 cursor-pointer">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Expiring Licenses</p>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100 group-hover:text-purple-600 transition-colors">
                  {kpis.expiringLicenses.next30Days}
                </p>
                <div className="flex gap-2 text-[11px] text-slate-500 font-medium">
                  <span className="text-purple-600 font-bold">30d: {kpis.expiringLicenses.next30Days}</span>
                  <span>•</span>
                  <span>60d: {kpis.expiringLicenses.next60Days}</span>
                  <span>•</span>
                  <span>90d: {kpis.expiringLicenses.next90Days}</span>
                </div>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-950/40 rounded-xl text-purple-600">
                <KeyRound className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Card 8: System Health Alerts */}
        <a href="#system-health" className="group">
          <Card className={`h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-md border-l-4 ${kpis.systemAlertsCount > 0 ? "border-l-rose-500" : "border-l-emerald-500"} bg-white dark:bg-slate-900 cursor-pointer`}>
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">System Alerts</p>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100 group-hover:text-rose-600 transition-colors">
                  {kpis.systemAlertsCount === 0 ? "0 Alerts" : `${kpis.systemAlertsCount} Warning`}
                </p>
                <p className="text-[11px] text-slate-500 font-medium">
                  {kpis.systemAlertsCount === 0 ? "All core subsystems healthy" : "Requires admin inspection"}
                </p>
              </div>
              <div className={`p-3 ${kpis.systemAlertsCount > 0 ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600" : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600"} rounded-xl`}>
                <Radio className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </a>
      </div>

      {/* 2. SECTION A: REQUEST PIPELINE FLOW */}
      <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Workflow className="h-4 w-4 text-indigo-600" /> Request Lifecycle Pipeline
              </CardTitle>
              <CardDescription className="text-xs">End-to-end request volume across each approval and provisioning stage</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm" className="h-7 text-xs">
              <Link href="/requests">View All Requests</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {/* Stage 1: Draft */}
            <Link href="/requests?status=DRAFT" className="p-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 text-center transition-all group">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">1. Draft</span>
              <span className="text-2xl font-black text-slate-700 dark:text-slate-300 block mt-1 group-hover:scale-105 transition-transform">{requestPipeline.draft}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Authoring</span>
            </Link>

            {/* Stage 2: L1 */}
            <Link href="/approvals" className="p-3 bg-amber-50/60 dark:bg-amber-950/30 hover:bg-amber-100/60 rounded-xl border border-amber-200 dark:border-amber-900/50 text-center transition-all group">
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">2. Level 1</span>
              <span className="text-2xl font-black text-amber-700 dark:text-amber-300 block mt-1 group-hover:scale-105 transition-transform">{requestPipeline.l1}</span>
              <span className="text-[10px] text-amber-600/80 block mt-0.5">Section Officer</span>
            </Link>

            {/* Stage 3: L2 */}
            <Link href="/approvals" className="p-3 bg-blue-50/60 dark:bg-blue-950/30 hover:bg-blue-100/60 rounded-xl border border-blue-200 dark:border-blue-900/50 text-center transition-all group">
              <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider block">3. Level 2</span>
              <span className="text-2xl font-black text-blue-700 dark:text-blue-300 block mt-1 group-hover:scale-105 transition-transform">{requestPipeline.l2}</span>
              <span className="text-[10px] text-blue-600/80 block mt-0.5">Deputy Director</span>
            </Link>

            {/* Stage 4: L3 */}
            <Link href="/approvals" className="p-3 bg-purple-50/60 dark:bg-purple-950/30 hover:bg-purple-100/60 rounded-xl border border-purple-200 dark:border-purple-900/50 text-center transition-all group">
              <span className="text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider block">4. Level 3</span>
              <span className="text-2xl font-black text-purple-700 dark:text-purple-300 block mt-1 group-hover:scale-105 transition-transform">{requestPipeline.l3}</span>
              <span className="text-[10px] text-purple-600/80 block mt-0.5">Director MIS</span>
            </Link>

            {/* Stage 5: L4 */}
            <Link href="/approvals" className="p-3 bg-rose-50/60 dark:bg-rose-950/30 hover:bg-rose-100/60 rounded-xl border border-rose-200 dark:border-rose-900/50 text-center transition-all group">
              <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider block">5. Level 4</span>
              <span className="text-2xl font-black text-rose-700 dark:text-rose-300 block mt-1 group-hover:scale-105 transition-transform">{requestPipeline.l4}</span>
              <span className="text-[10px] text-rose-600/80 block mt-0.5">Line Director</span>
            </Link>

            {/* Stage 6: DC_OPS */}
            <Link href="/approvals" className="p-3 bg-teal-50/60 dark:bg-teal-950/30 hover:bg-teal-100/60 rounded-xl border border-teal-200 dark:border-teal-900/50 text-center transition-all group">
              <span className="text-[10px] font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider block">6. DC_OPS</span>
              <span className="text-2xl font-black text-teal-700 dark:text-teal-300 block mt-1 group-hover:scale-105 transition-transform">{requestPipeline.dcops}</span>
              <span className="text-[10px] text-teal-600/80 block mt-0.5">Provisioning</span>
            </Link>

            {/* Stage 7: Provisioned */}
            <Link href="/requests?status=PROVISIONED" className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 hover:bg-emerald-100/60 rounded-xl border border-emerald-200 dark:border-emerald-900/50 text-center transition-all group">
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">7. Provisioned</span>
              <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300 block mt-1 group-hover:scale-105 transition-transform">{requestPipeline.provisioned}</span>
              <span className="text-[10px] text-emerald-600/80 block mt-0.5">Operational</span>
            </Link>

            {/* Stage 8: Closed */}
            <Link href="/requests?status=CLOSED" className="p-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 text-center transition-all group">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">8. Closed</span>
              <span className="text-2xl font-black text-slate-600 dark:text-slate-400 block mt-1 group-hover:scale-105 transition-transform">{requestPipeline.closed}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Archived</span>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* 3. SECTION B & C: RESOURCE OVERVIEW + SYSTEM HEALTH */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Resource Overview Table (2 cols) */}
        <Card className="lg:col-span-2 shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Gauge className="h-4 w-4 text-indigo-600" /> Infrastructure Resource Allocation
            </CardTitle>
            <CardDescription className="text-xs">Physical and virtual capacity distribution across all compute clusters</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-400 uppercase">
                    <th className="pb-3 font-semibold">Resource Metric</th>
                    <th className="pb-3 font-semibold text-right">Allocated</th>
                    <th className="pb-3 font-semibold text-right">Available</th>
                    <th className="pb-3 font-semibold text-right">Total Capacity</th>
                    <th className="pb-3 font-semibold text-right">Utilization</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {/* CPU */}
                  <tr>
                    <td className="py-3 flex items-center gap-2">
                      <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 rounded-lg">
                        <Cpu className="h-4 w-4" />
                      </div>
                      <span className="font-bold text-slate-800 dark:text-slate-200">vCPU Cores</span>
                    </td>
                    <td className="py-3 text-right font-bold text-slate-800 dark:text-slate-200">{resourceOverview.cpu.allocated.toLocaleString()} Cores</td>
                    <td className="py-3 text-right text-emerald-600 font-bold">{resourceOverview.cpu.available.toLocaleString()} Cores</td>
                    <td className="py-3 text-right text-slate-500">{resourceOverview.cpu.total.toLocaleString()} Cores</td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{resourceOverview.cpu.utilizationPercent}%</span>
                        <div className="w-16 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${resourceOverview.cpu.utilizationPercent > 85 ? "bg-rose-500" : "bg-indigo-600"}`} 
                            style={{ width: `${Math.min(100, resourceOverview.cpu.utilizationPercent)}%` }} 
                          />
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* RAM */}
                  <tr>
                    <td className="py-3 flex items-center gap-2">
                      <div className="p-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-lg">
                        <MemoryStick className="h-4 w-4" />
                      </div>
                      <span className="font-bold text-slate-800 dark:text-slate-200">Memory (RAM)</span>
                    </td>
                    <td className="py-3 text-right font-bold text-slate-800 dark:text-slate-200">
                      {resourceOverview.ram.allocatedGb >= 1024 ? `${(resourceOverview.ram.allocatedGb / 1024).toFixed(1)} TB` : `${resourceOverview.ram.allocatedGb} GB`}
                    </td>
                    <td className="py-3 text-right text-emerald-600 font-bold">
                      {resourceOverview.ram.availableGb >= 1024 ? `${(resourceOverview.ram.availableGb / 1024).toFixed(1)} TB` : `${resourceOverview.ram.availableGb} GB`}
                    </td>
                    <td className="py-3 text-right text-slate-500">
                      {resourceOverview.ram.totalGb >= 1024 ? `${(resourceOverview.ram.totalGb / 1024).toFixed(1)} TB` : `${resourceOverview.ram.totalGb} GB`}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{resourceOverview.ram.utilizationPercent}%</span>
                        <div className="w-16 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${resourceOverview.ram.utilizationPercent > 85 ? "bg-rose-500" : "bg-blue-600"}`} 
                            style={{ width: `${Math.min(100, resourceOverview.ram.utilizationPercent)}%` }} 
                          />
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* Storage */}
                  <tr>
                    <td className="py-3 flex items-center gap-2">
                      <div className="p-1.5 bg-teal-50 dark:bg-teal-950/40 text-teal-600 rounded-lg">
                        <HardDrive className="h-4 w-4" />
                      </div>
                      <span className="font-bold text-slate-800 dark:text-slate-200">Block Storage</span>
                    </td>
                    <td className="py-3 text-right font-bold text-slate-800 dark:text-slate-200">
                      {resourceOverview.storage.allocatedGb >= 1024 ? `${(resourceOverview.storage.allocatedGb / 1024).toFixed(1)} TB` : `${resourceOverview.storage.allocatedGb} GB`}
                    </td>
                    <td className="py-3 text-right text-emerald-600 font-bold">
                      {resourceOverview.storage.availableGb >= 1024 ? `${(resourceOverview.storage.availableGb / 1024).toFixed(1)} TB` : `${resourceOverview.storage.availableGb} GB`}
                    </td>
                    <td className="py-3 text-right text-slate-500">
                      {resourceOverview.storage.totalGb >= 1024 ? `${(resourceOverview.storage.totalGb / 1024).toFixed(1)} TB` : `${resourceOverview.storage.totalGb} GB`}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{resourceOverview.storage.utilizationPercent}%</span>
                        <div className="w-16 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${resourceOverview.storage.utilizationPercent > 85 ? "bg-rose-500" : "bg-teal-600"}`} 
                            style={{ width: `${Math.min(100, resourceOverview.storage.utilizationPercent)}%` }} 
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* System Health (1 col) */}
        <Card id="system-health" className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-600" /> Live Subsystem Health
            </CardTitle>
            <CardDescription className="text-xs">Operational status of core platform backend services</CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {systemHealth.map((service) => (
              <div 
                key={service.name} 
                className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${service.status === "healthy" ? "bg-emerald-500 animate-pulse" : service.status === "warning" ? "bg-amber-500" : "bg-rose-500"}`} />
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-200">{service.name}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">{service.message}</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={service.status === "healthy" ? "outline" : "destructive"} className="text-[10px] px-1.5 py-0">
                    {service.status.toUpperCase()}
                  </Badge>
                  {service.latencyMs !== undefined && service.latencyMs > 0 && (
                    <p className="text-[9px] text-slate-400 mt-0.5">{service.latencyMs}ms</p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* 4. SECTION D & E: EXPIRY & ATTENTION + RECENT ACTIVITY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expiry & Attention Hub */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex justify-between items-center">
              <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Attention & Expiry Watch
              </CardTitle>
              <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
                <button
                  onClick={() => setAttentionTab("vms")}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${attentionTab === "vms" ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-500"}`}
                >
                  Expiring VMs ({expiryAndAttention.expiringVms.length})
                </button>
                <button
                  onClick={() => setAttentionTab("licenses")}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${attentionTab === "licenses" ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-500"}`}
                >
                  Licenses ({expiryAndAttention.expiringLicenses.length})
                </button>
                <button
                  onClick={() => setAttentionTab("stuck")}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${attentionTab === "stuck" ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-500"}`}
                >
                  Stuck Requests ({expiryAndAttention.stuckRequests.length})
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {attentionTab === "vms" && (
              <div className="space-y-2">
                {expiryAndAttention.expiringVms.length === 0 ? (
                  <p className="text-xs text-slate-400 p-6 text-center italic">No VMs expiring in the next 60 days</p>
                ) : (
                  expiryAndAttention.expiringVms.map((vm) => (
                    <div key={vm.id} className="flex justify-between items-center p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-slate-100">{vm.hostname}</p>
                        <p className="text-slate-500 text-[11px]">{vm.systemName} • Owner: {vm.ownerName}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-orange-600 block">{vm.daysRemaining} days left</span>
                        <Link href={`/inventory/vms/${vm.id}`} className="text-[10px] text-indigo-600 hover:underline">Manage VM</Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {attentionTab === "licenses" && (
              <div className="space-y-2">
                {expiryAndAttention.expiringLicenses.length === 0 ? (
                  <p className="text-xs text-slate-400 p-6 text-center italic">No software licenses expiring soon</p>
                ) : (
                  expiryAndAttention.expiringLicenses.map((lic) => (
                    <div key={lic.id} className="flex justify-between items-center p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-slate-100">{lic.name}</p>
                        <p className="text-slate-500 text-[11px]">Vendor: {lic.vendor}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-purple-600 block">{lic.daysRemaining} days left</span>
                        <Link href="/inventory/licenses" className="text-[10px] text-indigo-600 hover:underline">Renew</Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {attentionTab === "stuck" && (
              <div className="space-y-2">
                {expiryAndAttention.stuckRequests.length === 0 ? (
                  <p className="text-xs text-slate-400 p-6 text-center italic">No requests stuck over 48 hours</p>
                ) : (
                  expiryAndAttention.stuckRequests.map((req) => (
                    <div key={req.id} className="flex justify-between items-center p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-slate-100">{req.systemName}</p>
                        <p className="text-slate-500 text-[11px]">{req.requestType} • By {req.requesterName}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-rose-600 block">{req.hoursWaiting}h waiting</span>
                        <Link href={`/approvals/${req.id}?type=request`} className="text-[10px] text-indigo-600 hover:underline">Escalate</Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Platform Activity */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex justify-between items-center">
              <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Activity className="h-4 w-4 text-indigo-600" /> Recent Platform Activity
              </CardTitle>
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                <Link href="/admin/audit-logs">Full Audit Logs</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-2.5">
            {recentActivities.slice(0, 6).map((activity) => (
              <div key={activity.id} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 text-xs transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600">
                    <ShieldCheck className="h-3.5 w-3.5" />
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

      {/* 5. ADMIN QUICK ACTIONS */}
      <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            Administrative Shortcuts
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            <Link 
              href="/admin/users" 
              className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:bg-indigo-50/40 text-slate-700 dark:text-slate-300 hover:text-indigo-600 font-medium text-xs text-center transition-all group"
            >
              <UserPlus className="h-4 w-4 text-indigo-600" />
              <span>Manage Users</span>
            </Link>

            <Link 
              href="/admin/workflows" 
              className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:bg-indigo-50/40 text-slate-700 dark:text-slate-300 hover:text-indigo-600 font-medium text-xs text-center transition-all group"
            >
              <Workflow className="h-4 w-4 text-purple-600" />
              <span>Workflows</span>
            </Link>

            <Link 
              href="/admin/audit-logs" 
              className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:bg-indigo-50/40 text-slate-700 dark:text-slate-300 hover:text-indigo-600 font-medium text-xs text-center transition-all group"
            >
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>Audit Logs</span>
            </Link>

            <Link 
              href="/inventory" 
              className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:bg-indigo-50/40 text-slate-700 dark:text-slate-300 hover:text-indigo-600 font-medium text-xs text-center transition-all group"
            >
              <Database className="h-4 w-4 text-blue-600" />
              <span>Inventory</span>
            </Link>

            <Link 
              href="/reports" 
              className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:bg-indigo-50/40 text-slate-700 dark:text-slate-300 hover:text-indigo-600 font-medium text-xs text-center transition-all group"
            >
              <FileText className="h-4 w-4 text-amber-600" />
              <span>Reports</span>
            </Link>

            <Link 
              href="/admin/settings" 
              className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:bg-indigo-50/40 text-slate-700 dark:text-slate-300 hover:text-indigo-600 font-medium text-xs text-center transition-all group"
            >
              <Settings className="h-4 w-4 text-slate-600" />
              <span>Settings</span>
            </Link>

            <Link 
              href="/admin/settings" 
              className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:bg-indigo-50/40 text-slate-700 dark:text-slate-300 hover:text-indigo-600 font-medium text-xs text-center transition-all group"
            >
              <Mail className="h-4 w-4 text-rose-600" />
              <span>Email SMTP</span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
