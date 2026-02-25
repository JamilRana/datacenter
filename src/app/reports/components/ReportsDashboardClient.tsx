// src/app/reports/components/ReportsDashboardClient.tsx
"use client";

import { useState, useTransition, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Download, BarChart3, Activity, Server, Shield, Database, 
  RefreshCcw, TrendingUp, Users, Clock, AlertTriangle, CheckCircle, 
  ArrowUpRight, ArrowDownRight, PieChart, LineChart as LineChartIcon
} from "lucide-react";
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Cell, Area, AreaChart
} from "recharts";
import { getSystemReportData, getExportData, ReportFilters, SystemReportData } from "@/app/actions/report-actions";
import { exportToCsv, exportToExcel } from "@/lib/export-utils";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Environment, RequestStatus } from "@/types/enums";

// Color palettes for charts
const COLORS = {
  primary: "#4f46e5",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#3b82f6",
  slate: "#64748b",
  env: { PRODUCTION: "#ef4444", STAGING: "#f59e0b", DEVELOPMENT: "#3b82f6", TESTING: "#8b5cf6" },
  type: { NEW_VM: "#3b82f6", CUSTOMIZED: "#10b981", RENEWAL: "#f59e0b", DECOMMISSION: "#ef4444" }
};

export function ReportsDashboardClient({ initialData }: { initialData: SystemReportData }) {
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState(initialData);
  const [filters, setFilters] = useState<ReportFilters>({});
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'xlsx'>('csv');
  const [activeChart, setActiveChart] = useState<'trends' | 'distribution' | 'funnel'>('trends');

  type ExportFormat = 'csv' | 'json' | 'xlsx';
  type ChartType = 'trends' | 'distribution' | 'funnel';

  // Date range presets
  const datePresets = [
    { label: "Last 7 Days", value: { start: subDays(new Date(), 7), end: new Date() } },
    { label: "Last 30 Days", value: { start: subDays(new Date(), 30), end: new Date() } },
    { label: "This Month", value: { 
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1), 
        end: new Date() 
      } 
    },
    { label: "Last Quarter", value: { 
        start: subDays(new Date(), 90), 
        end: new Date() 
      } 
    },
  ];

  const applyPreset = (preset: typeof datePresets[0]) => {
    setFilters({
      ...filters,
      startDate: format(preset.value.start, "yyyy-MM-dd"),
      endDate: format(preset.value.end, "yyyy-MM-dd")
    });
  };

  const refreshData = () => {
    startTransition(async () => {
      try {
        const newData = await getSystemReportData(filters);
        setData(newData);
        toast.success("Analytics refreshed");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to refresh");
      }
    });
  };

  const handleExport = async () => {
    try {
      const exportRows = await getExportData(filters, exportFormat);
      const rows = exportRows as unknown as Record<string, unknown>[];
      if (exportFormat === 'xlsx') {
        await exportToExcel(`datacenter-report-${format(new Date(), "yyyy-MM-dd")}.xlsx`, rows);
      } else {
        exportToCsv(`datacenter-report-${format(new Date(), "yyyy-MM-dd")}.${exportFormat}`, rows);
      }
      toast.success(`Report exported as ${exportFormat.toUpperCase()}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    }
  };

  // Chart data transformations
  const trendChartData = useMemo(() => 
    data?.trends?.map(t => ({
      date: format(parseISO(t.day), "MMM d"),
      New: t.new,
      Approved: t.approved,
      Provisioned: t.provisioned
    })) || [], 
  [data?.trends]);

  const envChartData = useMemo(() => 
    data?.envDistribution?.map(d => ({
      name: d.environment,
      value: d.count,
      percentage: d.percentage
    })) || [],
  [data?.envDistribution]);

  const funnelChartData = useMemo(() => 
    data?.approvalFunnel?.map(f => ({
      stage: f.stage,
      count: f.count,
      rate: f.conversionRate
    })) || [],
  [data?.approvalFunnel]);

  return (
    <div className="space-y-8">
      {/* Breadcrumbs */}
      <div className="flex items-center text-sm text-slate-500">
        <a href="/" className="hover:text-slate-900 transition-colors">Home</a>
        <span className="mx-2">/</span>
        <span className="text-slate-900 font-medium">Analytics</span>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">System Analytics</h1>
          <p className="text-slate-500 mt-1">
            Monitor infrastructure performance, request patterns, and resource utilization
          </p>
        </div>
        <div className="flex gap-2">
          <select 
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
            className="h-10 px-3 rounded-md border border-slate-200 bg-white text-sm"
          >
            <option value="csv">CSV</option>
            <option value="xlsx">Excel</option>
            <option value="json">JSON</option>
          </select>
          <Button onClick={handleExport} disabled={isPending} className="bg-indigo-600 hover:bg-indigo-700">
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
          <Button variant="outline" size="icon" onClick={refreshData} disabled={isPending}>
            <RefreshCcw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Filters & Date Presets */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Date Presets */}
            <div className="flex flex-wrap gap-2">
              {datePresets.map(preset => (
                <Button 
                  key={preset.label}
                  variant="outline" 
                  size="sm"
                  onClick={() => applyPreset(preset)}
                  className="text-xs"
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            
            {/* Custom Date Range */}
            <div className="flex gap-2 items-center">
              <Input 
                type="date" 
                className="h-9 w-40"
                value={filters.startDate || ""}
                onChange={(e) => setFilters({...filters, startDate: e.target.value})}
              />
              <span className="text-slate-400">to</span>
              <Input 
                type="date" 
                className="h-9 w-40"
                value={filters.endDate || ""}
                onChange={(e) => setFilters({...filters, endDate: e.target.value})}
              />
            </div>

            {/* Quick Filters */}
            <div className="flex gap-2">
              <select 
                className="h-9 px-3 rounded-md border border-slate-200 text-sm"
                value={filters.environment || ""}
                onChange={(e) => setFilters({...filters, environment: e.target.value as Environment || undefined})}
              >
                <option value="">All Environments</option>
                <option value="PRODUCTION">Production</option>
                <option value="STAGING">Staging</option>
                <option value="DEVELOPMENT">Development</option>
              </select>
              <select 
                className="h-9 px-3 rounded-md border border-slate-200 text-sm"
                value={filters.status || ""}
                onChange={(e) => setFilters({...filters, status: e.target.value as RequestStatus || undefined})}
              >
                <option value="">All Statuses</option>
                <option value="PENDING_L1">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="PROVISIONED">Provisioned</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard 
          title="Total VMs" 
          value={data?.summary?.totalVMs || 0} 
          icon={Server} 
          trend={+12} 
          color="blue" 
        />
        <KPICard 
          title="Active Requests" 
          value={data?.summary?.activeRequests || 0} 
          icon={Activity} 
          trend={+8} 
          color="indigo" 
        />
        <KPICard 
          title="Pending Approval" 
          value={data?.summary?.pendingApprovals || 0} 
          icon={Clock} 
          trend={-3} 
          color="amber" 
        />
        <KPICard 
          title="Avg Approval Time" 
          value={`${data?.summary?.avgApprovalTimeHours || 0}h`} 
          icon={TrendingUp} 
          trend={-15} 
          color="emerald" 
        />
        <KPICard 
          title="Licenses" 
          value={data?.summary?.totalLicenses || 0} 
          icon={Shield} 
          color="purple" 
        />
        <KPICard 
          title="Resource Util." 
          value={`${data?.summary?.resourceUtilization || 0}%`} 
          icon={Database} 
          trend={+5} 
          color="slate" 
        />
      </div>

      {/* Chart Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-1">
        {[
          { id: 'trends', label: 'Request Trends', icon: LineChartIcon },
          { id: 'distribution', label: 'Distribution', icon: PieChart },
          { id: 'funnel', label: 'Approval Funnel', icon: BarChart3 }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveChart(tab.id as ChartType)}
            className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
              activeChart === tab.id
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Main Chart */}
        <Card className="lg:col-span-2 border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {activeChart === 'trends' && <LineChartIcon className="h-5 w-5 text-indigo-600" />}
              {activeChart === 'distribution' && <PieChart className="h-5 w-5 text-indigo-600" />}
              {activeChart === 'funnel' && <BarChart3 className="h-5 w-5 text-indigo-600" />}
              {activeChart === 'trends' && 'Request Activity Trends'}
              {activeChart === 'distribution' && 'Environment & Type Distribution'}
              {activeChart === 'funnel' && 'Approval Process Funnel'}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              {activeChart === 'trends' && (
                <AreaChart data={trendChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="New" stroke={COLORS.primary} fillOpacity={1} fill="url(#colorNew)" />
                  <Area type="monotone" dataKey="Approved" stroke={COLORS.success} fill="none" strokeWidth={2} />
                  <Area type="monotone" dataKey="Provisioned" stroke={COLORS.info} fill="none" strokeWidth={2} />
                </AreaChart>
              )}
              {activeChart === 'distribution' && (
                <BarChart data={envChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {envChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS.env[entry.name as keyof typeof COLORS.env] || COLORS.slate} />
                    ))}
                  </Bar>
                </BarChart>
              )}
              {activeChart === 'funnel' && (
                <BarChart 
                  layout="vertical" 
                  data={funnelChartData} 
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="stage" type="category" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip />
                  <Bar dataKey="count" fill={COLORS.primary} radius={[0, 4, 4, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Requesters */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-600" />
              Top Requesters
            </CardTitle>
            <CardDescription>By request volume and approval efficiency</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data?.topRequesters?.slice(0, 5).map((user) => (
                <div key={user.userId} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-medium text-indigo-700">
                      {user.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{user.name || 'Unknown'}</p>
                      <p className="text-xs text-slate-500">{user.department || 'No department'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">{user.requestCount} requests</p>
                    <p className="text-xs text-slate-500">{user.avgApprovalTimeHours}h avg approval</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Resource Metrics */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-indigo-600" />
              Resource Allocation
            </CardTitle>
            <CardDescription>Average specs by environment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data?.resourceMetrics?.map((metric) => (
                <div key={metric.environment} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-700">{metric.environment}</span>
                    <Badge variant="secondary" className="text-xs">
                      +{metric.growthRate}% growth
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-slate-50 rounded p-2 text-center">
                      <p className="text-slate-400">CPU</p>
                      <p className="font-bold text-slate-900">{metric.avgCpu} vCPU</p>
                    </div>
                    <div className="bg-slate-50 rounded p-2 text-center">
                      <p className="text-slate-400">RAM</p>
                      <p className="font-bold text-slate-900">{metric.avgRam} GB</p>
                    </div>
                    <div className="bg-slate-50 rounded p-2 text-center">
                      <p className="text-slate-400">Storage</p>
                      <p className="font-bold text-slate-900">{metric.avgStorage} TB</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights & Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Actionable Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InsightItem 
              type="warning"
              title="Development Environment Over-Provisioned"
              description="3 VMs in DEV have been idle for >30 days. Consider automated shutdown policies."
              action="Review Idle Resources"
            />
            <InsightItem 
              type="success"
              title="Approval Efficiency Improved"
              description="Average approval time decreased by 15% this month."
              action="View Report"
            />
            <InsightItem 
              type="info"
              title="License Renewal Due"
              description="5 software licenses expire in the next 14 days."
              action="Manage Licenses"
            />
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <HealthItem label="Database Connectivity" status="healthy" />
            <HealthItem label="API Response Time" status="healthy" value="<200ms" />
            <HealthItem label="Storage Capacity" status="warning" value="78% used" />
            <HealthItem label="Backup Status" status="healthy" value="Last: 2h ago" />
            
            <div className="pt-4 border-t border-slate-100">
              <Button variant="outline" size="sm" className="w-full">
                View Full System Report
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Reusable Components
function KPICard({ title, value, icon: Icon, trend, color = 'slate' }: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: number;
  color?: 'blue' | 'indigo' | 'emerald' | 'amber' | 'purple' | 'slate';
}) {
  const colors: Record<string, string> = {
    blue: "text-blue-600 bg-blue-50",
    indigo: "text-indigo-600 bg-indigo-50",
    emerald: "text-emerald-600 bg-emerald-50",
    amber: "text-amber-600 bg-amber-50",
    purple: "text-purple-600 bg-purple-50",
    slate: "text-slate-600 bg-slate-100",
  };

  return (
    <Card className="border-slate-200 hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
            {trend !== undefined && (
              <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${
                trend >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}>
                {trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(trend)}% vs last period
              </div>
            )}
          </div>
          <div className={`p-2 rounded-lg ${colors[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InsightItem({ type, title, description, action }: {
  type: 'warning' | 'success' | 'info';
  title: string;
  description: string;
  action: string;
}) {
  const icons = {
    warning: <AlertTriangle className="h-4 w-4 text-amber-600" />,
    success: <CheckCircle className="h-4 w-4 text-emerald-600" />,
    info: <Activity className="h-4 w-4 text-blue-600" />
  };
  
  const bgColors = {
    warning: "bg-amber-50 border-amber-200",
    success: "bg-emerald-50 border-emerald-200",
    info: "bg-blue-50 border-blue-200"
  };

  return (
    <div className={`p-3 rounded-lg border ${bgColors[type]} flex gap-3`}>
      <div className="mt-0.5">{icons[type]}</div>
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <p className="text-xs text-slate-600 mt-0.5">{description}</p>
        <button className="text-xs font-medium text-indigo-600 hover:text-indigo-700 mt-2">
          {action} →
        </button>
      </div>
    </div>
  );
}

function HealthItem({ label, status, value }: {
  label: string;
  status: 'healthy' | 'warning' | 'critical';
  value?: string;
}) {
  const indicators = {
    healthy: "bg-emerald-500",
    warning: "bg-amber-500",
    critical: "bg-red-500"
  };

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <div className={`h-2.5 w-2.5 rounded-full ${indicators[status]}`} />
        <span className="text-sm text-slate-700">{label}</span>
      </div>
      {value && <span className="text-xs text-slate-500">{value}</span>}
    </div>
  );
}

// Helper for date presets
function subDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}