"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { 
  Search,   
  HardDrive,
  User,
  Activity,
  Cpu,
  Database,
  Eye,
  LucideIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { VmInstance } from "@/types/inventory";

export function VmListClient({ initialVms }: { initialVms: VmInstance[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filteredVms = initialVms.filter(vm => {
    const matchesSearch = 
      vm.hostname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vm.ipAddress?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vm.owner?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "ALL" || vm.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-0">
      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row gap-4 p-5 items-center bg-slate-50/50 border-b border-slate-100">
        <div className="flex-1 relative w-full">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
           <Input 
             placeholder="Search by hostname, IP address, or owner..." 
             className="pl-9 h-11 bg-white border-slate-200"
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
           />
        </div>

        <div className="w-full md:w-56">
           <select 
             className="w-full h-11 px-3 py-2 rounded-md border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-700 shadow-sm"
             value={statusFilter}
             onChange={(e) => setStatusFilter(e.target.value)}
           >
             <option value="ALL">Status: All Lifecycle</option>
             <option value="ACTIVE">Status: Running / Active</option>
             <option value="SUSPENDED">Status: Suspended / Paused</option>
             <option value="RETIRED">Status: Retired / Decommissioned</option>
           </select>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
         <table className="w-full text-left">
            <thead className="bg-[#f8fafc] border-b border-slate-200">
               <tr>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Instance Identity</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Owner / Context</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] text-center">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Allocation Specs</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] text-right">View Detail</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
               {filteredVms.map((vm) => (
                  <tr key={vm.id} className="hover:bg-blue-50/20 transition-all group">
                     <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                           <div className={`h-11 w-11 rounded-xl flex items-center justify-center border transition-all shadow-sm ${getStatusStyles(vm.status)}`}>
                              <HardDrive className="h-5 w-5" />
                           </div>
                           <div className="space-y-0.5">
                              <p className="font-bold text-slate-900 leading-tight group-hover:text-blue-700 transition-colors uppercase tracking-tight">{vm.hostname || "UNNAMED_INSTANCE"}</p>
                              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest font-mono">{vm.ipAddress || "PENDING_ASSIGNMENT"}</p>
                           </div>
                        </div>
                     </td>
                     <td className="px-6 py-5">
                        <div className="space-y-1">
                           <div className="flex items-center gap-2">
                              <User className="h-3 w-3 text-slate-400" />
                              <p className="text-sm font-bold text-slate-700 leading-none">{vm.owner?.name}</p>
                           </div>
                           <p className="text-[10px] text-slate-400 font-bold uppercase ml-5">{vm.request?.environment || "CLUSTER_DEFAULT"}</p>
                        </div>
                     </td>
                     <td className="px-6 py-5 text-center">
                        <Badge variant="outline" className={`font-black text-[9px] uppercase tracking-tighter px-3 py-0.5 border-2 ${getStatusBadgeStyles(vm.status)}`}>
                           {vm.status}
                        </Badge>
                     </td>
                     <td className="px-6 py-5">
                         <div className="flex items-center gap-4">
                            <SpecBadge icon={Cpu} value={vm.currentSpec?.vcpu || undefined}  label="vCPU" />
                            <SpecBadge icon={Database} value={`${vm.currentSpec?.ramGb}G`} label="RAM" />
                         </div>
                     </td>
                     <td className="px-6 py-5 text-right">
                        <Link href={`/inventory/vms/${vm.id}`}>
                           <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-300 hover:text-blue-600 transition-all hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100">
                              <Eye className="h-4 w-4" />
                           </Button>
                        </Link>
                     </td>
                  </tr>
               ))}
               {filteredVms.length === 0 && (
                  <tr>
                     <td colSpan={5} className="px-6 py-24 text-center">
                        <div className="flex flex-col items-center gap-3 opacity-20 grayscale">
                           <Activity className="h-12 w-12" />
                           <div>
                              <p className="font-black uppercase tracking-[0.2em] text-lg">No Inventory Found</p>
                              <p className="text-xs font-semibold mt-1">Adjust search parameters or check request status</p>
                           </div>
                        </div>
                     </td>
                  </tr>
               )}
            </tbody>
         </table>
      </div>
    </div>
  );
}

function getStatusStyles(status: string) {
   switch(status) {
      case 'ACTIVE': return "bg-emerald-50 text-emerald-600 border-emerald-100";
      case 'SUSPENDED': return "bg-orange-50 text-orange-600 border-orange-100";
      case 'RETIRED': return "bg-slate-100 text-slate-400 border-slate-200 grayscale";
      default: return "bg-slate-50 text-slate-500 border-slate-200";
   }
}

function getStatusBadgeStyles(status: string) {
   switch(status) {
      case 'ACTIVE': return "text-emerald-700 border-emerald-400 shadow-[0_2px_10px_-3px_rgba(16,185,129,0.3)]";
      case 'SUSPENDED': return "text-orange-700 border-orange-400";
      case 'RETIRED': return "text-slate-400 border-slate-200 bg-slate-50 opacity-60";
      default: return "text-slate-700 border-slate-400";
   }
}

function SpecBadge({ icon: Icon, value, label }: { icon: LucideIcon, value: number|string|undefined, label: string }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
       <Icon className="h-3 w-3 text-slate-400" />
       <span className="text-[10px] font-black text-slate-600">{value}</span>
       <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{label}</span>
    </div>
  );
}
