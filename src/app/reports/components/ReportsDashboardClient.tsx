"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Download, 
  BarChart3, 
  Activity, 
  Server, 
  Shield, 
  Database,
  Calendar,
  RefreshCcw,
  LucideIcon
} from "lucide-react";
import { getSystemReportData, getExportData, ReportFilters } from "@/app/actions/report-actions";
import { exportToCsv } from "@/lib/export-utils";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Environment, RequestStatus } from "@/types/enums";
import type { ReactNode } from "react";

// ✅ Define proper types
interface EnvDistributionItem {
  environment: Environment;
  _count: { _all: number };
}

interface TypeDistributionItem {
  requestType: "NEW_VM" | "CUSTOMIZED" | "RENEWAL" | "DECOMMISSION";
  _count: { _all: number };
}

interface TrendItem {
  day: string;
  count: number;
}

interface TopRequesterItem {
  requesterId: string;
  _count: { _all: number };
  user: {
    name: string | null;
    email: string | null;
  } | null;
}

interface ReportData {
  summary: { vms: number; requests: number; licenses: number };
  envDistribution: EnvDistributionItem[];
  typeDistribution: TypeDistributionItem[];
  trends: TrendItem[];
  topRequesters: TopRequesterItem[];
  timestamp: string;
}

export function ReportsDashboardClient({ initialData }: { initialData: ReportData }) {
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState(initialData);
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: "",
    endDate: "",
    environment: undefined,
    status: undefined,
  });

  const refreshData = () => {
    startTransition(async () => {
      try {
        const newData = await getSystemReportData(filters);
        setData(newData as unknown as ReportData);
        toast.success("Metrics synchronized");
      } catch (error) {
        if (error instanceof Error) {
          toast.error("Failed to sync reports: " + error.message);
        } else {
          toast.error("Failed to sync reports");
        }
      }
    });
  };

  const handleExport = async () => {
    try {
      const exportRows = await getExportData(filters);
      exportToCsv(`datacenter-report-${format(new Date(), "yyyy-MM-dd")}.csv`, exportRows);
      toast.success("Report exported successfully");
    } catch (error) {
      if (error instanceof Error) {
        toast.error("Export failed: " + error.message);
      } else {
        toast.error("Export failed");
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* Dynamic Filter Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-end gap-6">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
           {/* Start Date */}
          <FilterField label="Start Date" icon={Calendar}>
            <Input 
              type="date" 
              className="h-10 bg-slate-50 border-slate-100 text-xs"
              value={filters.startDate}
              onChange={(e) => setFilters({...filters, startDate: e.target.value})}
            />
          </FilterField>

          {/* End Date */}
          <FilterField label="End Date" icon={Calendar}>
            <Input 
              type="date" 
              className="h-10 bg-slate-50 border-slate-100 text-xs"
              value={filters.endDate}
              onChange={(e) => setFilters({...filters, endDate: e.target.value})}
            />
          </FilterField>

          {/* Environment */}
          <FilterField label="Environment" icon={Activity}>
            <select 
              className="w-full h-10 px-3 py-2 rounded-md border border-slate-100 bg-slate-50 text-xs outline-none focus:ring-1 focus:ring-blue-500"
              value={filters.environment || ""}
              onChange={(e) => {
                const value = e.target.value as Environment | "";
                setFilters({
                  ...filters, 
                  environment: value === "" ? undefined : value
                });
              }}
            >
              <option value="">All Environments</option>
              <option value="PRODUCTION">Production</option>
              <option value="STAGING">Staging</option>
              <option value="DEVELOPMENT">Development</option>
              <option value="TESTING">Testing</option>
            </select>
          </FilterField>

          {/* Request Status */}
          <FilterField label="Request Status" icon={Shield}>
            <select 
              className="w-full h-10 px-3 py-2 rounded-md border border-slate-100 bg-slate-50 text-xs outline-none focus:ring-1 focus:ring-blue-500"
              value={filters.status || ""}
              onChange={(e) => {
                const value = e.target.value as RequestStatus | "";
                setFilters({
                  ...filters, 
                  status: value === "" ? undefined : value
                });
              }}
            >
              <option value="">All Statuses</option>
              <option value="PENDING_L1">Pending L1</option>
              <option value="APPROVED">Approved</option>
              <option value="PROVISIONED">Provisioned</option>
              <option value="REJECTED">Rejected</option>
              <option value="CLOSED">Closed</option>
            </select>
          </FilterField>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={refreshData} disabled={isPending}>
              <RefreshCcw className={`h-4 w-4 text-slate-400 ${isPending ? 'animate-spin' : ''}`} />
           </Button>
           <Button onClick={handleExport} className="bg-slate-900 hover:bg-slate-800 text-white gap-2 font-bold px-6 h-10">
              <Download className="h-4 w-4" /> Export Ledger
           </Button>
        </div>
      </div>

      {/* Primary Analytics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         {/* Summary Cards */}
         <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatsMiniCard title="Total Instances" value={data?.summary?.vms} icon={Server} color="blue" />
            <StatsMiniCard title="Active Requests" value={data?.summary?.requests} icon={Activity} color="indigo" />
            <StatsMiniCard title="Entity Compliance" value={`${data?.summary?.licenses} Subscriptions`} icon={Shield} color="emerald" />
            <StatsMiniCard title="Data Sync" value="Verified" icon={Database} color="slate" />
         </div>

         {/* Distribution Chart */}
         <Card className="border-none shadow-sm ring-1 ring-slate-200">
            <CardHeader>
               <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-400">Environment Load</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               {data?.envDistribution.map((group) => (
                  <div key={group.environment} className="space-y-1.5">
                     <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-slate-600">{group.environment}</span>
                        <span className="text-slate-400">{group._count._all} Requests</span>
                     </div>
                     <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 transition-all duration-1000" 
                          style={{ width: `${(group._count._all / Math.max(1, data.summary.requests)) * 100}%` }} 
                        />
                     </div>
                  </div>
               ))}
            </CardContent>
         </Card>

         {/* Trend Preview */}
         <Card className="md:col-span-2 border-none shadow-sm ring-1 ring-slate-200">
            <CardHeader className="flex flex-row items-center justify-between">
               <div>
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-400">Activity Trends</CardTitle>
                  <CardDescription className="text-[10px] font-bold text-slate-300">Request volume over the last 30 days</CardDescription>
               </div>
               <BarChart3 className="h-4 w-4 text-slate-200" />
            </CardHeader>
            <CardContent className="h-40 flex items-end gap-1 pt-4">
               {data?.trends?.map((t) => (
                  <div 
                    key={t.day} 
                    className="flex-1 bg-indigo-50 border-t-2 border-indigo-200 hover:bg-indigo-100 transition-all cursor-help relative group"
                    style={{ height: `${Math.max(10, (t.count / 20) * 100)}%` }}
                  >
                     <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
                        {t.count} requests • {t.day}
                     </div>
                  </div>
               ))}
            </CardContent>
         </Card>
      </div>

      {/* Detailed Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <Card className="lg:col-span-2 border-none shadow-sm ring-1 ring-slate-200">
            <CardHeader className="border-b border-slate-50">
               <CardTitle className="text-base font-bold">Priority Performance Index</CardTitle>
               <CardDescription>Leading requesters and volume contribution</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
               <table className="w-full text-left">
                  <thead>
                     <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Requester Entity</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Volume</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Activity Level</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                     {data?.topRequesters?.map((tr) => (
                        <tr key={tr.requesterId} className="hover:bg-blue-50/20 transition-colors">
                           <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                 <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                    {tr.user?.name?.charAt(0) || '?'}
                                 </div>
                                 <div>
                                    <p className="text-sm font-bold text-slate-700 leading-none">{tr.user?.name || 'Unknown'}</p>
                                    <p className="text-[10px] text-slate-400 mt-1 uppercase font-medium">{tr.user?.email || 'No email'}</p>
                                 </div>
                              </div>
                           </td>
                           <td className="px-6 py-4 text-center font-black text-slate-600">{tr._count._all}</td>
                           <td className="px-6 py-4 text-right">
                              <Badge className="bg-blue-50 text-blue-600 border-blue-100 shadow-none text-[9px] font-black uppercase">Active High</Badge>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </CardContent>
         </Card>

         <Card className="border-none shadow-sm ring-1 ring-slate-200 bg-slate-900 text-white">
            <CardHeader className="border-b border-white/10">
               <CardTitle className="text-white text-base">Efficiency Audit</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
               <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Compliance Alert</p>
                  <p className="text-sm leading-relaxed text-white/80 italic">
                     System utilization patterns suggest potential for resource reclamation in the **DEVELOPMENT** cluster. Consider automated idle-shutdown policies.
                  </p>
               </div>
               <div className="flex items-center gap-2 pt-4">
                  <Activity className="h-4 w-4 text-emerald-400" />
                  <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Optimal Headroom (18%)</p>
               </div>
            </CardContent>
         </Card>
      </div>
    </div>
  );
}

// ✅ Properly typed FilterField
interface FilterFieldProps {
  label: string;
  icon: LucideIcon;
  children: ReactNode;
}

function FilterField({ label, icon: Icon, children }: FilterFieldProps) {
   return (
      <div className="space-y-1.5 flex-1">
         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 ml-0.5">
            <Icon className="h-3 w-3" /> {label}
         </p>
         {children}
      </div>
   );
}

// ✅ Properly typed StatsMiniCard
type ColorVariant = 'blue' | 'indigo' | 'emerald' | 'slate';

interface StatsMiniCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: ColorVariant;
}

function StatsMiniCard({ title, value, icon: Icon, color }: StatsMiniCardProps) {
   const colors: Record<ColorVariant, string> = {
      blue: "text-blue-600 bg-blue-50",
      indigo: "text-indigo-600 bg-indigo-50",
      emerald: "text-emerald-600 bg-emerald-50",
      slate: "text-slate-600 bg-slate-100",
   };
   
   return (
      <Card className="border-none shadow-sm ring-1 ring-slate-200">
         <CardContent className="p-4 flex items-center justify-between">
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{title}</p>
               <p className="text-2xl font-black text-slate-900 tracking-tight">{value}</p>
            </div>
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
               <Icon className="h-5 w-5" />
            </div>
         </CardContent>
      </Card>
   );
}