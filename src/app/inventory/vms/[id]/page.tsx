// src/app/inventory/vms/[id]/page.tsx

import { redirect, notFound } from "next/navigation";

import { ROLES } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { 
  ArrowLeft, 
  Cpu, 
  Database, 
  HardDrive, 
  User, 
  History,
  ShieldAlert,
  LucideIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState, type ReactNode } from "react"; // ✅ Add this
import { VmSpecHistory, VmAuditLog, VmInstance } from "@/types/inventory";
import { useSession } from "next-auth/react";
import { getVmById } from "@/app/actions/inventory-actions";

export default async function VmDetailPage({ params }: { params: { id: string } }) {
const {data:session}=useSession();
const [vm,setVm]=useState<VmInstance | null>(null);

  if (!session?.user) redirect("/auth");
  

  useEffect(()=>{
         const fetchVm = async()=>{
   try {
         const vm = await getVmById(params.id);
         if (!vm) notFound();
         setVm(vm);
   } catch (error) {
      console.error("Error fetching VM:", error);    
   }
}
fetchVm();
  },[session])

  // RBAC: Requesters can only view their own VMs
  if (session.user.roles.includes(ROLES.REQUESTER) && vm?.owner?.id !== session.user.id) {
     redirect("/unauthorized");
  }

  return (
    <div className="p-6 md:p-10 space-y-8 bg-slate-50/20 min-h-screen">
       <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="icon" className="rounded-full">
               <Link href="/inventory/vms"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div>
               <h1 className="text-2xl font-black text-slate-900 leading-tight tracking-tight uppercase">{vm?.hostname}</h1>
               <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">{vm?.ipAddress || "NO_IP_ASSIGNED"}</p>
            </div>
          </div>
          <div className="flex gap-2">
             {vm?.status === "ACTIVE" && (
                <>
                   <Button asChild variant="outline" className="text-xs font-bold gap-2">
                      <Link href={`/requests/customize?vmId=${vm.id}`}>Request Upgrade</Link>
                   </Button>
                   <Button asChild variant="outline" className="text-xs font-bold gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100">
                      <Link href={`/requests/decommission?vmId=${vm.id}`}>Decommission VM</Link>
                   </Button>
                </>
             )}
          </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
          <div className="lg:col-span-2 space-y-8">
             {/* Current Allocation */}
             <Card className="border-none shadow-sm ring-1 ring-slate-200 overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b">
                   <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500">Current Allocation</CardTitle>
                      <Badge className={
                         vm?.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" :
                         vm?.status === "RETIRED" ? "bg-slate-100 text-slate-800" : "bg-orange-100 text-orange-800"
                      }>
                         {vm?.status}
                      </Badge>
                   </div>
                </CardHeader>
                <CardContent className="pt-6">
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <ResourceStat icon={Cpu} label="vCPU" value={vm?.currentSpec?.vcpu} unit="Cores" color="text-blue-600 bg-blue-50" />
                      <ResourceStat icon={Database} label="RAM Allocation" value={vm?.currentSpec?.ramGb} unit="GB" color="text-indigo-600 bg-indigo-50" />
                      <ResourceStat icon={HardDrive} label="Disk Provisioned" value={vm?.currentSpec?.storageGb} unit="GB" color="text-emerald-600 bg-emerald-50" />
                   </div>

                   <div className="mt-8 pt-8 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-8">
                      <DetailItem 
                        label="Operating System" 
                        value={`${vm?.vmOsName || "Unknown"} ${vm?.vmOsVersion || ""}`} 
                      />
                      <DetailItem 
                        label="Provisioned At" 
                        value={vm?.provisionedAt ? format(new Date(vm?.provisionedAt || ""), "PPP p") : "Not recorded"} 
                      />
                      <DetailItem 
                        label="Original Request" 
                        value={
                          vm?.request?.requestId ? (
                            <Link href={`/requests/${vm.request.requestId}/view`} className="text-blue-600 hover:underline font-bold">
                              REQ-{vm.request.requestId.slice(0,8)}
                            </Link>
                          ) : "Not recorded"
                        } 
                      />
                      <DetailItem 
                        label="Environment" 
                        value={vm?.request?.environment || "STAGING"} 
                      />
                   </div>
                </CardContent>
             </Card>

             {/* Versioned History */}
             <Card className="border-none shadow-sm ring-1 ring-slate-200 overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b">
                   <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                      <History className="h-4 w-4" /> Specification Audit Trail
                   </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                   <div className="overflow-x-auto">
                      <table className="w-full text-left">
                         <thead className="bg-[#fcfdfe] border-b border-slate-100">
                            <tr>
                               <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Effective Date</th>
                               <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">vCPU</th>
                               <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">RAM</th>
                               <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Disk</th>
                               <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Context</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-50">
                            {vm?.specHistory?.map((spec: VmSpecHistory) => (
                               <tr key={spec.id} className="text-xs">
                                  <td className="px-6 py-4 font-bold text-slate-700">{format(new Date(spec.createdAt), "MMM dd, yyyy")}</td>
                                  <td className="px-6 py-4">{spec.vcpu}</td>
                                  <td className="px-6 py-4">{spec.ramGb} GB</td>
                                  <td className="px-6 py-4">{spec.storageGb} GB</td>
                                  <td className="px-6 py-4 font-medium text-slate-400">
                                     {spec.sourceRequestId ? `REQ-${spec.sourceRequestId.slice(0,6)}` : "Initial Build"}
                                  </td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </CardContent>
             </Card>
          </div>

          <div className="space-y-6">
             <Card className="border-none shadow-sm ring-1 ring-slate-200">
                <CardHeader className="bg-slate-50/30">
                   <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Ownership</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 flex items-center gap-4">
                   <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <User className="h-5 w-5" />
                   </div>
                   <div>
                      <p className="text-sm font-bold text-slate-800">{vm?.owner?.name}</p>
                      <p className="text-[10px] font-medium text-slate-400 uppercase">{vm?.owner?.email}</p>
                   </div>
                </CardContent>
             </Card>

             <Card className="border-none shadow-sm ring-1 ring-slate-200 overflow-hidden">
                <CardHeader className="bg-slate-50/30">
                   <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Recent Security Events</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                   {vm?.auditLogs && vm?.auditLogs?.length > 0 ? (
                      <div className="divide-y divide-slate-50">
                         {vm?.auditLogs?.map((log: VmAuditLog) => (
                            <div key={log.id} className="p-4 space-y-1 hover:bg-slate-50/50 transition-colors">
                               <p className="text-xs font-bold text-slate-800 leading-tight">{log.action.replace(/_/g, " ")}</p>
                               <div className="flex justify-between items-center text-[10px]">
                                  <span className="text-slate-400 font-medium">{format(new Date(log.timestamp), "MMM dd, HH:mm")}</span>
                                  <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">Log #{log.id.slice(0,4)}</span>
                               </div>
                            </div>
                         ))}
                      </div>
                   ) : (
                      <div className="p-8 text-center text-slate-400 italic text-xs">No recent audits recorded</div>
                   )}
                </CardContent>
             </Card>

             {vm?.status === "RETIRED" && (
                <Card className="bg-red-50 border-red-100 border shadow-none">
                   <CardContent className="p-4 flex gap-3">
                      <ShieldAlert className="h-5 w-5 text-red-600 shrink-0" />
                      <div>
                         <p className="text-xs font-bold text-red-900 uppercase tracking-tight">Terminal Instance</p>
                         <p className="text-[10px] text-red-700 leading-relaxed mt-1 font-medium italic">
                            This VM has been retired. Records are preserved for compliance, but the underlying resources have been reclaimed.
                         </p>
                      </div>
                   </CardContent>
                </Card>
             )}
          </div>
       </div>
    </div>
  );
}

function ResourceStat({ 
  icon: Icon, 
  label, 
  value, 
  unit, 
  color 
}: { 
  icon: LucideIcon; 
  label: string;   
  value: number | null | undefined; 
  unit: string; 
  color: string; 
}) {
   return (
      <div className="space-y-3">
         <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${color}`}>
               <Icon className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{label}</span>
         </div>
         <p className="text-3xl font-black text-slate-900 leading-none">
            {value ?? 0} <span className="text-xs font-bold text-slate-400">{unit}</span>
         </p>
      </div>
   );
}

// ✅ FIXED: Accept ReactNode (which includes strings, elements, fragments, etc.)
function DetailItem({ label, value }: { label: string; value: ReactNode }) {
   return (
      <div className="space-y-1">
         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
         <div className="text-sm font-bold text-slate-800">
           {value ?? "—"}
         </div>
      </div>
   );
}