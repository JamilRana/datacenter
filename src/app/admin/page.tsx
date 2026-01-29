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
  LucideIcon
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface AuditActivityItem {
  id: string;
  action: string;
  actor?: { name?: string | null } | null;
  timestamp: Date; // Changed from string → Date (Prisma returns Date for DateTime fields)
}

interface StatsCardProps {
  title: string;
  value: number | string;
  label: string;
  icon: LucideIcon;
  color: "blue" | "indigo" | "emerald" | "orange";
}

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.roles.includes(ROLES.ADMIN)) redirect("/unauthorized");

  const metrics = await getAdminMetrics();

  return (
    <div className="space-y-10 p-6 md:p-10 bg-slate-50/10 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase italic">Command Center</h1>
          <p className="text-slate-500 font-medium">Enterprise oversight and system health telemetry.</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-black text-emerald-700 uppercase tracking-widest leading-none">System Status: {metrics.systemStatus}</span>
           </div>
        </div>
      </div>

      {/* Global Telemetry */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         <StatsCard title="Authorized Entities" value={metrics.summary.users} label="Managed Accounts" icon={Users} color="blue" />
         <StatsCard title="Infrastructure Load" value={metrics.summary.instances} label="Provisioned VMs" icon={Server} color="indigo" />
         <StatsCard title="Decision Pipeline" value={metrics.summary.requests} label="Lifetime Requests" icon={FileText} color="emerald" />
         <StatsCard title="Audit Pulse" value={metrics.summary.audits24h} label="Events (24h)" icon={Shield} color="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Bottleneck Warning Area */}
         <Card className="border-none shadow-xl ring-1 ring-slate-200 overflow-hidden bg-white">
            <CardHeader className="bg-red-50/50 border-b border-red-50">
               <div className="flex items-center gap-2 text-red-600">
                  <Clock className="h-4 w-4" />
                  <CardTitle className="text-sm font-black uppercase tracking-widest">SLA Compliance Bottlenecks</CardTitle>
               </div>
            </CardHeader>
            <CardContent className="pt-8 flex flex-col items-center justify-center text-center space-y-4">
               <div className={`h-24 w-24 rounded-full flex items-center justify-center border-4 ${metrics.bottlenecks.stalledRequests > 0 ? 'border-red-500 bg-red-50' : 'border-emerald-500 bg-emerald-50'}`}>
                  <span className={`text-4xl font-black ${metrics.bottlenecks.stalledRequests > 0 ? 'text-red-900' : 'text-emerald-900'}`}>
                     {metrics.bottlenecks.stalledRequests}
                  </span>
               </div>
               <div>
                  <p className="font-bold text-slate-800">Requests Pending &gt; 48 Hours</p>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed px-4">
                     {metrics.bottlenecks.stalledRequests > 0 
                      ? "High urgency: Current requests are exceeding the standard approval SLA." 
                      : "All approval cycles are currently within expected performance windows."}
                  </p>
               </div>
               {metrics.bottlenecks.stalledRequests > 0 && (
                  <Button asChild variant="outline" className="text-xs font-bold gap-2">
                     <Link href="/approvals">Escalate Lifecycle <ArrowRight className="h-3 w-3" /></Link>
                  </Button>
               )}
            </CardContent>
         </Card>

         {/* Deep Audit Pulse */}
      <Card className="lg:col-span-2 border-none shadow-xl ring-1 ring-slate-200 bg-slate-900 text-white overflow-hidden">
        <CardHeader className="border-b border-white/10 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base text-white">Security & Execution Pulse</CardTitle>
            <CardDescription className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-1">
              Real-time authoritative activity logging
            </CardDescription>
          </div>
          <Activity className="h-4 w-4 text-white/20" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-white/5">
            {/* ✅ FIXED: Removed redundant new Date() wrapper */}
            {metrics.activities.map((act: AuditActivityItem) => (
              <div key={act.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-all">
                <div className="flex items-center gap-4">
                  <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center text-white/60">
                    <Shield className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold leading-none">{act.action.replace(/_/g, " ")}</p>
                    <p className="text-[10px] text-white/40 mt-1 uppercase font-bold tracking-tighter">
                      By {act.actor?.name || "System"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {/* ✅ CRITICAL FIX: Pass Date directly to format() */}
                  <p className="text-[10px] font-black text-blue-400">
                    {format(act.timestamp, "HH:mm:ss")} {/* Removed new Date() wrapper */}
                  </p>
                  <p className="text-[9px] text-white/20 font-mono mt-0.5">{act.id.slice(0, 8)}</p>
                </div>
              </div>
            ))}
          </div>
          <Link href="/admin/audit" className="block w-full py-4 text-center text-[10px] font-black uppercase tracking-[0.3em] text-white/30 hover:bg-white/10 hover:text-white transition-all">
            Access Deep Log Vault
          </Link>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

function StatsCard({ title, value, label, icon: Icon, color }: StatsCardProps) {
  const colors: Record<StatsCardProps["color"], string> = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    orange: "bg-orange-50 text-orange-600 border-orange-100",
  };

  return (
    <Card className="border-none shadow-sm ring-1 ring-slate-200 overflow-hidden group">
      <CardContent className="p-6">
         <div className="flex items-center justify-between mb-4">
            <div className={`p-2 rounded-xl border ${colors[color]}`}>
               <Icon className="h-5 w-5" />
            </div>
            <Badge variant="outline" className="text-[10px] font-black tracking-tighter uppercase border-slate-100">{label}</Badge>
         </div>
         <div className="space-y-0.5">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{title}</p>
            <p className="text-4xl font-black text-slate-900 tracking-tighter group-hover:scale-105 transition-transform duration-500 origin-left">{value}</p>
         </div>
      </CardContent>
      <div className={`h-1.5 w-full bg-current opacity-20 ${colors[color].split(" ")[0]}`} />
    </Card>
  );
}
