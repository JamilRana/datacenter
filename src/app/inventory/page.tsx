// src/app/inventory/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { getInventoryMetrics } from "@/app/actions/inventory-actions";
import { ROLES } from "@/lib/roles";
import { CapacityDashboardClient } from "./components/CapacityDashboardClient";
import { 
  Server, 
  Cpu, 
  Database, 
  HardDrive, 
  BarChart3,
  Box,
  History,
  LucideIcon
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function InventoryOverviewPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth");

  const metrics = await getInventoryMetrics();
  const userRole = session.user.roles;

  // Requesters don't get the infra overview, redirect them to their VM list
  if (userRole.includes(ROLES.REQUESTER)) {
    redirect("/inventory/vms");
  }

  if (!metrics) {
     return <div className="p-10 text-center text-slate-500 font-medium">No inventory data available for your role.</div>;
  }

  return (
    <div className="p-6 md:p-10 space-y-8 bg-slate-50/20 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Infrastructure Inventory</h1>
          <p className="text-slate-500 mt-1">Real-time resource utilization and capacity planning across the primary datacenter.</p>
        </div>
        <div className="flex items-center gap-3">
           <Button asChild variant="outline" className="gap-2">
              <Link href="/inventory/assets"><Box className="h-4 w-4" /> View Hardware</Link>
           </Button>
           <Button asChild variant="outline" className="gap-2">
              <Link href="/inventory/vms"><Server className="h-4 w-4" /> View All VMs</Link>
           </Button>
        </div>
      </div>

      {/* High Level Metrics Table (Brief) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         <StatsCard 
            title="Physical Nodes" 
            value={metrics.physical.serverCount} 
            subtitle="Hypervisor Hosts" 
            icon={Server} 
            color="blue" 
         />
         <StatsCard 
            title="Total CPU Cores" 
            value={metrics.physical.cpu} 
            subtitle={`${metrics.allocated.cpu} Allocated`} 
            icon={Cpu} 
            color="indigo" 
         />
         <StatsCard 
            title="Total RAM (GB)" 
            value={metrics.physical.ram} 
            subtitle={`${metrics.allocated.ram}GB Allocated`} 
            icon={Database} 
            color="emerald" 
         />
         <StatsCard 
            title="Total Flash Storage" 
            value={`${(metrics.physical.storage / 1024).toFixed(1)} TB`} 
            subtitle={`${(metrics.allocated.storage / 1024).toFixed(1)} TB Allocated`} 
            icon={HardDrive} 
            color="slate" 
         />
      </div>

      {/* Main Utilization Logic (Client Side for Interactivity) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 space-y-8">
            <Card className="border-none shadow-sm ring-1 ring-slate-200 overflow-hidden">
               <CardHeader className="bg-white border-b border-slate-50 pb-4">
                  <div className="flex items-center gap-2">
                     <BarChart3 className="h-5 w-5 text-blue-600" />
                     <div>
                        <CardTitle className="text-base">Resource Allocation Efficiency</CardTitle>
                        <CardDescription>Comparison of physical hardware vs provisioned workload overhead.</CardDescription>
                     </div>
                  </div>
               </CardHeader>
               <CardContent className="pt-8">
                  <CapacityDashboardClient metrics={metrics} />
               </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <Card className="border-none shadow-sm ring-1 ring-slate-200">
                  <CardHeader>
                     <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                     <Button variant="ghost" asChild className="justify-start text-xs font-bold gap-3 h-11 border border-slate-100 hover:bg-slate-50">
                        <Link href="/inventory/assets/new"><Box className="h-4 w-4 text-blue-500" /> Register Physical Asset</Link>
                     </Button>
                     <Button variant="ghost" asChild className="justify-start text-xs font-bold gap-3 h-11 border border-slate-100 hover:bg-slate-50">
                        <Link href="/inventory/licenses"><Box className="h-4 w-4 text-emerald-500" /> Manage Software Licenses</Link>
                     </Button>
                  </CardContent>
               </Card>

               <Card className="border-none shadow-sm ring-1 ring-slate-200">
                  <CardHeader>
                     <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Infrastructure Alerts</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center justify-center p-6 text-center opacity-40 grayscale">
                     <History className="h-8 w-8 mb-2" />
                     <p className="text-xs font-medium uppercase tracking-widest">No active hardware alerts</p>
                  </CardContent>
               </Card>
            </div>
         </div>

         {/* Sidebar: Details/Summary */}
         <div className="space-y-6">
            <Card className="bg-slate-900 text-white border-none shadow-xl">
               <CardHeader className="border-b border-white/10">
                  <CardTitle className="text-white text-base">Virtual Load Summary</CardTitle>
               </CardHeader>
               <CardContent className="pt-6 space-y-4">
                  <div className="flex justify-between items-center text-sm">
                     <span className="text-white/60">Active Instances</span>
                     <span className="font-bold text-white text-xl">{metrics.allocated.vmCount}</span>
                  </div>
                  <div className="h-0.5 w-full bg-white/10" />
                  <div className="space-y-3">
                     <LoadBar label="Average vCPU/VM" value={(metrics.allocated.cpu / metrics.allocated.vmCount).toFixed(1)} />
                     <LoadBar label="Average RAM/VM" value={`${(metrics.allocated.ram / metrics.allocated.vmCount).toFixed(1)} GB`} />
                     <LoadBar label="Average Disk/VM" value={`${(metrics.allocated.storage / metrics.allocated.vmCount).toFixed(1)} GB`} />
                  </div>
               </CardContent>
            </Card>

            <Card className="border-none shadow-sm ring-1 ring-slate-200">
               <CardContent className="p-6">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">System Authority</p>
                  <p className="text-xs text-slate-500 leading-relaxed italic">
                     Inventory data is strictly read-only for security purposes. Any infrastructure changes must be initiated via the Request module for full auditable lifecycle tracking.
                  </p>
               </CardContent>
            </Card>
         </div>
      </div>
    </div>
  );
}

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: LucideIcon;
  color: "blue" | "indigo" | "emerald" | "slate";
}

function StatsCard({ title, value, subtitle, icon: Icon, color }: StatsCardProps) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    slate: "bg-slate-100 text-slate-600",
  };

  return (
    <Card className="border-none shadow-sm ring-1 ring-slate-200">
      <CardContent className="p-6 flex items-center gap-4">
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${colors[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight mb-1">{title}</p>
          <p className="text-2xl font-black text-slate-900 leading-tight">{value}</p>
          <p className="text-[11px] font-medium text-slate-500 mt-1">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadBar({ label, value }: { label: string, value: string }) {
   return (
      <div className="flex justify-between items-center text-xs font-semibold">
         <span className="text-white/40 uppercase tracking-tighter">{label}</span>
         <span className="text-white">{value}</span>
      </div>
   );
}
