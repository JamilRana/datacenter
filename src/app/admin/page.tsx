// src/app/admin/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { ROLES } from "@/lib/roles";
import { getAdminMetrics } from "@/app/actions/admin-actions";
import {
  Users,
  FileText,
  Server,
  Shield,
  Clock,
  ArrowRight,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Database,
  Mail,
  Workflow,
  Tag,
  Settings,
  ScrollText,
  Plus,
  BarChart4,
  HardDrive,
  Cpu,
  Layers,
  ChevronRight,
  UserCheck,
  UserX
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from "date-fns";
import type { SystemHealthItem } from "@/types/dashboard";

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.roles.includes(ROLES.ADMIN)) redirect("/unauthorized");

  const metrics = await getAdminMetrics();

  // Color mapping for role badges
  const roleColors: Record<string, string> = {
    ADMIN: "bg-rose-50 text-rose-700 border-rose-200",
    DC_OPS: "bg-purple-50 text-purple-700 border-purple-200",
    APPROVER_L1: "bg-amber-50 text-amber-700 border-amber-200",
    APPROVER_L2: "bg-amber-50 text-amber-700 border-amber-200",
    APPROVER_L3: "bg-amber-50 text-amber-700 border-amber-200",
    APPROVER_L4: "bg-amber-50 text-amber-700 border-amber-200",
    REQUESTER: "bg-blue-50 text-blue-700 border-blue-200",
    DEVELOPER: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };

  const getHealthBadge = (status: "OPTIMAL" | "DEGRADED" | "CRITICAL") => {
    switch (status) {
      case "OPTIMAL":
        return {
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
          dot: "bg-emerald-500",
          label: "All Systems Operational",
        };
      case "DEGRADED":
        return {
          bg: "bg-amber-50 text-amber-700 border-amber-200",
          dot: "bg-amber-500",
          label: "Telemetry Warnings Detected",
        };
      case "CRITICAL":
      default:
        return {
          bg: "bg-rose-50 text-rose-700 border-rose-200",
          dot: "bg-rose-500",
          label: "Critical Service Outage",
        };
    }
  };

  const healthMeta = getHealthBadge(metrics.systemStatus as "OPTIMAL" | "DEGRADED" | "CRITICAL");

  return (
    <div className="space-y-8">
      {/* 1. Executive Header & Quick Actions */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-100 flex-shrink-0">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900">
                  Admin Command Center
                </h1>
                <Badge variant="outline" className={`gap-1.5 px-2.5 py-0.5 text-xs font-bold ${healthMeta.bg}`}>
                  <span className={`h-2 w-2 rounded-full ${healthMeta.dot} animate-pulse`} />
                  {healthMeta.label}
                </Badge>
              </div>
              <p className="text-xs lg:text-sm text-slate-500 font-medium mt-0.5">
                Centralized platform governance, identity access, approval bottlenecks, and services telemetry.
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <Button asChild size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 text-xs font-bold shadow-xs">
            <Link href="/admin/users">
              <Plus className="h-3.5 w-3.5" />
              Manage Users
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="text-slate-700 border-slate-200 hover:bg-slate-50 gap-1.5 text-xs font-bold">
            <Link href="/admin/workflows">
              <Workflow className="h-3.5 w-3.5 text-slate-500" />
              Workflows
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="text-slate-700 border-slate-200 hover:bg-slate-50 gap-1.5 text-xs font-bold">
            <Link href="/admin/settings">
              <Settings className="h-3.5 w-3.5 text-slate-500" />
              Settings
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="text-slate-700 border-slate-200 hover:bg-slate-50 gap-1.5 text-xs font-bold">
            <Link href="/admin/audit-logs">
              <ScrollText className="h-3.5 w-3.5 text-slate-500" />
              Audit Vault
            </Link>
          </Button>
        </div>
      </div>

      {/* 2. Top 4 Core Pillar KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {/* Card 1: User Identity & Access */}
        <Link href="/admin/users" className="group">
          <Card className="h-full border-slate-200/80 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all duration-200 bg-white">
            <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">User Directory</p>
                  <p className="text-3xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors mt-1">
                    {metrics.summary.users}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <Users className="h-5 w-5" />
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-medium">
                <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
                  <UserCheck className="h-3.5 w-3.5" />
                  {metrics.summary.activeUsers} Active
                </span>
                <span className="text-slate-400">•</span>
                <span className="flex items-center gap-1 text-slate-500">
                  <UserX className="h-3.5 w-3.5 text-slate-400" />
                  {metrics.summary.inactiveUsers} Inactive
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Card 2: Approval Workflow Pipeline */}
        <Link href="/approvals" className="group">
          <Card className="h-full border-slate-200/80 shadow-xs hover:shadow-md hover:border-amber-300 transition-all duration-200 bg-white">
            <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Approvals</p>
                  <p className="text-3xl font-black text-slate-900 group-hover:text-amber-600 transition-colors mt-1">
                    {metrics.approvals.total}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                  <Clock className="h-5 w-5" />
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-medium">
                {metrics.bottlenecks.stalledRequests > 0 ? (
                  <span className="flex items-center gap-1 text-rose-600 font-bold">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {metrics.bottlenecks.stalledRequests} Stalled (&gt;48h)
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-emerald-600 font-bold">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    All in SLA
                  </span>
                )}
                <span className="text-slate-400">L1–L4 Active</span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Card 3: Virtualization & Compute Fleet */}
        <Link href="/inventory" className="group">
          <Card className="h-full border-slate-200/80 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all duration-200 bg-white">
            <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Virtual Machines</p>
                  <p className="text-3xl font-black text-slate-900 group-hover:text-emerald-600 transition-colors mt-1">
                    {metrics.summary.instances}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                  <Server className="h-5 w-5" />
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-medium">
                <span className="text-emerald-600 font-bold">
                  {metrics.summary.activeInstances} Running
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-500">
                  {metrics.summary.serverAssets} Server Hosts
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Card 4: Security & Audit Health */}
        <Link href="/admin/audit-logs" className="group">
          <Card className="h-full border-slate-200/80 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all duration-200 bg-white">
            <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">24h Audit Events</p>
                  <p className="text-3xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors mt-1">
                    {metrics.summary.audits24h}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                  <Activity className="h-5 w-5" />
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-medium">
                <span className="text-indigo-600 font-bold">
                  Live Audit Trail
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-500">
                  Immutable Vault
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* 3. Operational Grid (2 Columns: Main 8 cols / Side 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column (8 cols): Approval Bottlenecks + Quick Launch Hub */}
        <div className="lg:col-span-8 space-y-8">
          {/* Panel A: SLA Compliance & Approval Pipeline */}
          <Card className="border-slate-200/80 shadow-xs overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/70 border-b border-slate-100 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">
                      Workflow Pipeline & SLA Monitor
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Multi-level decision queues and requests nearing or exceeding SLA thresholds
                    </CardDescription>
                  </div>
                </div>

                <Button asChild variant="outline" size="sm" className="text-xs font-bold gap-1 text-slate-700">
                  <Link href="/approvals">
                    View Task Queue <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Approval Level Queue Counters (Dynamic Workflow Pipeline) */}
              <div className={`grid grid-cols-2 ${metrics.approvals.levels && metrics.approvals.levels.length > 3 ? "sm:grid-cols-4" : "sm:grid-cols-3"} gap-3`}>
                {(metrics.approvals.levels && metrics.approvals.levels.length > 0
                  ? metrics.approvals.levels
                  : [
                      { level: 1, label: "Asstt. Maintenance Engineer", count: metrics.approvals.level1, statusCode: "PENDING_L1" },
                      { level: 2, label: "Maintenance Engineer", count: metrics.approvals.level2, statusCode: "PENDING_L2" },
                      { level: 3, label: "System Analyst", count: metrics.approvals.level3, statusCode: "PENDING_L3" },
                      { level: 4, label: "DC Ops", count: metrics.approvals.level4, statusCode: "PENDING_L4" },
                    ]
                ).map((lvl: { level: number; label: string; count: number; statusCode: string }) => (
                  <Link
                    key={lvl.level}
                    href={`/approvals?status=${lvl.statusCode}`}
                    className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100/90 border border-slate-200/70 text-center transition-all group block shadow-xs hover:border-slate-300"
                    title={`View ${lvl.label} pending queue`}
                  >
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-blue-600 transition-colors">
                      Level {lvl.level}
                    </p>
                    <p className="text-xl font-extrabold text-slate-800 mt-0.5 group-hover:scale-105 transition-transform">
                      {lvl.count}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate px-1" title={lvl.label}>
                      {lvl.label}
                    </p>
                  </Link>
                ))}
              </div>

              {/* Stalled Requests Warning Alert / Table */}
              {metrics.bottlenecks.stalledRequests > 0 ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-rose-800 font-bold text-xs uppercase tracking-wider">
                      <AlertTriangle className="h-4 w-4 text-rose-600" />
                      <span>SLA Breached: {metrics.bottlenecks.stalledRequests} Requests Pending &gt; 48 Hours</span>
                    </div>
                    <Badge variant="outline" className="bg-rose-100 text-rose-800 border-rose-300 font-bold text-[10px]">
                      Urgent Action Required
                    </Badge>
                  </div>

                  <div className="divide-y divide-rose-100 bg-white rounded-lg border border-rose-100 overflow-hidden text-xs">
                    {metrics.bottlenecks.items.map((item: { id: string; displayId: string; systemName: string; status: string; levelLabel?: string; requesterName: string; hoursStalled: number }) => (
                      <div key={item.id} className="p-3 flex items-center justify-between hover:bg-rose-50/30 transition-colors">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">{item.displayId}</span>
                            <span className="font-semibold text-slate-700">{item.systemName}</span>
                            <Badge variant="outline" className="text-[9px] font-semibold bg-amber-50 text-amber-700 border-amber-200" title={item.status}>
                              {item.levelLabel || item.status}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Requested by <strong className="text-slate-700">{item.requesterName}</strong>
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-rose-700 font-bold text-xs">
                            {item.hoursStalled}h pending
                          </span>
                          <Button asChild size="sm" variant="ghost" className="h-7 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                            <Link href={`/approvals?status=${item.status}`}>
                              Review <ArrowRight className="h-3 w-3 ml-1" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-emerald-900">All Approval Workflows Meeting SLA</p>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      No active requests have exceeded the standard 48-hour approval threshold.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Panel B: Administrative Quick Launch Hub */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Administrative Modules
              </h3>
              <span className="text-xs text-slate-400">Direct shortcuts to management functions</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
              {/* Tool 1: Users */}
              <Link
                href="/admin/users"
                className="group p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <Users className="h-4 w-4" />
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600 font-bold">
                    {metrics.summary.users} Users
                  </Badge>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    User & Role Directory
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                    Manage accounts, role assignments, passwords, and activations.
                  </p>
                </div>
              </Link>

              {/* Tool 2: Workflows */}
              <Link
                href="/admin/workflows"
                className="group p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="h-9 w-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
                    <Workflow className="h-4 w-4" />
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600 font-bold">
                    4 Levels
                  </Badge>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                    Approval Workflows
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                    Multi-level approval chains, routing policies, and step rules.
                  </p>
                </div>
              </Link>

              {/* Tool 3: Settings */}
              <Link
                href="/admin/settings"
                className="group p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="h-9 w-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-colors">
                    <Settings className="h-4 w-4" />
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600 font-bold">
                    System
                  </Badge>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    System Settings
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                    Platform thresholds, database maintenance, and global configurations.
                  </p>
                </div>
              </Link>

              {/* Tool 4: Email Settings */}
              <Link
                href="/admin/email-settings"
                className="group p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <Mail className="h-4 w-4" />
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600 font-bold">
                    SMTP
                  </Badge>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    Email Notifications
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                    Configure SMTP host, email templates, and automated alerts.
                  </p>
                </div>
              </Link>

              {/* Tool 5: Resource Tags */}
              <Link
                href="/admin/tags"
                className="group p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <Tag className="h-4 w-4" />
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600 font-bold">
                    Metadata
                  </Badge>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                    Resource Tags
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                    Taxonomy tags, environment metadata, and billing categories.
                  </p>
                </div>
              </Link>

              {/* Tool 6: Audit Vault */}
              <Link
                href="/admin/audit-logs"
                className="group p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="h-9 w-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
                    <ScrollText className="h-4 w-4" />
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600 font-bold">
                    Vault
                  </Badge>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
                    Audit Log Vault
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                    Immutable security log records, actor tracking, and export.
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): System Health Telemetry + User Role Breakdown */}
        <div className="lg:col-span-4 space-y-8">
          {/* Panel C: Core Services Health Telemetry */}
          <Card className="border-slate-200/80 shadow-xs overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/70 border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-indigo-600" />
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Services Health Telemetry
                  </CardTitle>
                </div>
                <Badge variant="outline" className={`text-[10px] font-bold ${healthMeta.bg}`}>
                  {metrics.systemStatus}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {metrics.systemHealth.map((item: SystemHealthItem) => {
                const isHealthy = item.status === "healthy";
                const isWarning = item.status === "warning";
                return (
                  <div key={item.name} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${isHealthy ? 'bg-emerald-500' : isWarning ? 'bg-amber-500' : 'bg-rose-500'}`} />
                        <span className="text-xs font-bold text-slate-800">{item.name}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 pl-4">{item.message}</p>
                    </div>
                    {item.latencyMs !== undefined && item.latencyMs > 0 && (
                      <span className="font-mono text-[10px] font-semibold text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                        {item.latencyMs}ms
                      </span>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Panel D: Role Distribution Breakdown */}
          <Card className="border-slate-200/80 shadow-xs overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/70 border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Role Distribution
                  </CardTitle>
                </div>
                <span className="text-xs text-slate-500 font-semibold">
                  {metrics.summary.users} Total
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {metrics.roles.map((role: { name: string; count: number }) => {
                const percentage = metrics.summary.users > 0
                  ? Math.round((role.count / metrics.summary.users) * 100)
                  : 0;
                return (
                  <div key={role.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{role.name.replace(/_/g, " ")}</span>
                      <span className="font-bold text-slate-900">
                        {role.count} <span className="text-[10px] text-slate-400 font-normal">({percentage}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all"
                        style={{ width: `${Math.max(percentage, 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              <div className="pt-2 border-t border-slate-100">
                <Button asChild variant="ghost" size="sm" className="w-full text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-bold">
                  <Link href="/admin/users">
                    Manage Accounts in User Directory <ArrowRight className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 4. Bottom Section: Security & Execution Pulse */}
      <Card className="border-slate-200/80 shadow-xs overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-100 bg-slate-50/70 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Activity className="h-4 w-4 text-purple-600" />
                Live Security & Audit Pulse
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Real-time stream of authoritative administrative operations and security audit events
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm" className="text-xs font-bold gap-1 text-slate-700">
              <Link href="/admin/audit-logs">
                Open Deep Log Vault <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {metrics.activities.map((act: { id: string; action: string; timestamp: Date; actor?: { name?: string | null; email?: string | null } | null }) => (
              <div key={act.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-slate-100 border border-slate-200/70 flex items-center justify-center text-slate-600 flex-shrink-0">
                    <Shield className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      {act.action.replace(/_/g, " ")}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Performed by <strong className="text-slate-700">{act.actor?.name || "System Service"}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-700">
                      {format(new Date(act.timestamp), "MMM dd, HH:mm:ss")}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {formatDistanceToNow(new Date(act.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px] bg-slate-50 text-slate-500 border-slate-200">
                    {act.id.slice(0, 8)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-slate-50/50 border-t border-slate-100 text-center">
            <Link
              href="/admin/audit-logs"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
            >
              Access Complete Immutable Audit Vault <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
