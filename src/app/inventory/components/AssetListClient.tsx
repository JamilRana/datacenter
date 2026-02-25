"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Filter, 
  ChevronRight,  
  Server, 
  Box, 
  Wifi, 
  Activity,
  Anchor,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { PhysicalAsset } from "@/types/inventory";
import { AssetType } from "@/types/enums";
import { AssetModal } from "./AssetModal";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import { deleteAsset } from "@/app/actions/asset-actions";
import { Trash2 } from "lucide-react";

export function AssetListClient({ 

  initialAssets,
  canEdit 
}: { 
  initialAssets: PhysicalAsset[],
  canEdit?: boolean
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filteredAssets = initialAssets.filter(asset => {
    const matchesSearch = 
      asset.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.vendor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.serial?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === "all" || asset.type === typeFilter;

    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-0">
      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row gap-4 p-5 items-center bg-slate-50/50 border-b border-slate-100">
        <div className="flex-1 relative w-full">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
           <Input 
             placeholder="Search by name, model, vendor, or serial number..." 
             className="pl-9 h-11 bg-white border-slate-200"
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
           />
        </div>

        <div className="w-full md:w-56">
           <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select 
                className="w-full h-11 pl-9 pr-4 py-2 rounded-md border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none font-medium text-slate-700 shadow-sm"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="all">Infrastructure: All Types</option>
                <option value={AssetType.SERVER}>Hypervisor Servers</option>
                <option value={AssetType.ROUTER}>Networking: Routers</option>
                <option value={AssetType.SWITCH}>Networking: Switches</option>
                <option value={AssetType.FIREWALL}>Security: Firewalls</option>
                <option value={AssetType.STORAGE}>SAN Storage Arrays</option>
                <option value={AssetType.UPS}>Reliability: UPS Units</option>
                <option value={AssetType.CONSOLE_SERVER}>OOB Management</option>
                <option value={AssetType.OTHER}>Miscellaneous Equipment</option>
              </select>
           </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
         <table className="w-full text-left">
            <thead className="bg-[#fcfdfe] border-b border-slate-200">
               <tr>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global Asset Identity</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Type</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Metadata</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Inventory Logic</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
               {filteredAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-blue-50/20 transition-all group">
                     <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                           <div className={`h-11 w-11 rounded-xl flex items-center justify-center border transition-all shadow-sm ${getTypeStyles(asset.type)}`}>
                              {getTypeIcon(asset.type)}
                           </div>
                           <div className="space-y-0.5">
                              <p className="font-bold text-slate-800 leading-tight group-hover:text-blue-700 transition-colors">{asset.name}</p>
                              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono">{asset.serial || "NO_SERIAL_UID"}</p>
                           </div>
                        </div>
                     </td>
                     <td className="px-6 py-5 text-center">
                        <Badge variant="outline" className={`font-black text-[9px] uppercase tracking-tighter px-3 py-0.5 border-2 ${getTypeBadgeStyles(asset.type)}`}>
                           {asset.type}
                        </Badge>
                     </td>
                     <td className="px-6 py-5">
                        <div className="space-y-1">
                           <p className="text-xs font-bold text-slate-600">{asset.vendor} {asset.model}</p>
                           <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5 uppercase">
                              <Anchor className="h-3 w-3" /> {asset.location || "Floating Hub"}
                           </p>
                        </div>
                     </td>
                     <td className="px-6 py-5 text-right">
                        <div className="flex justify-end gap-2">
                           <Link href={`/inventory/assets/${asset.id}`}>
                              <Button variant="ghost" className="h-9 gap-1.5 font-bold text-xs hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100">
                                 Review <ChevronRight className="h-4 w-4" />
                              </Button>
                           </Link>
                           {canEdit && (
                             <>
                               <AssetModal asset={asset} mode="edit" />
                               <DeleteConfirmationModal
                                 title="Delete Asset"
                                 description={`Are you sure you want to delete ${asset.name}? This action cannot be undone.`}
                                 onDelete={async () => {
                                   await deleteAsset(asset.id);
                                   window.location.reload();
                                 }}
                                 trigger={
                                   <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 transition-colors">
                                     <Trash2 className="h-4 w-4" />
                                   </Button>
                                 }
                               />
                             </>
                           )}
                        </div>
                     </td>
                  </tr>
               ))}
               {filteredAssets.length === 0 && (
                  <tr>
                     <td colSpan={4} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-2 opacity-30 grayscale saturate-0">
                           <Activity className="h-10 w-10 text-slate-400" />
                           <p className="font-black uppercase tracking-widest text-lg text-slate-500">Inventory Hub Empty</p>
                           <p className="text-xs font-medium">No physical hardware matches the current filter matrix</p>
                        </div>
                     </td>
                  </tr>
               )}
            </tbody>
         </table>
      </div>
      
      {/* Legend / Info Footer */}
      <div className="bg-slate-50/50 px-6 py-4 flex items-center justify-between">
         <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest italic">Inventory Class-A Authority</p>
         <div className="flex gap-6">
            <span className="flex items-center gap-2 text-[10px] font-bold text-slate-400"><div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" /> Active Node</span>
            <span className="flex items-center gap-2 text-[10px] font-bold text-slate-400"><div className="h-2 w-2 rounded-full bg-emerald-500" /> Warrantied</span>
         </div>
      </div>
    </div>
  );
}

function getTypeIcon(type: string) {
   switch(type) {
      case 'SERVER': return <Server className="h-5 w-5" />;
      case 'STORAGE': return <Database className="h-5 w-5" />;
      case 'FIREWALL': return <Wifi className="h-5 w-5" />; // Reusing Wifi for simplicity in icons
      default: return <Box className="h-5 w-5" />;
   }
}

function getTypeStyles(type: string) {
   switch(type) {
      case 'SERVER': return "bg-blue-50 text-blue-600 border-blue-100";
      case 'STORAGE': return "bg-indigo-50 text-indigo-600 border-indigo-100";
      case 'FIREWALL': return "bg-red-50 text-red-600 border-red-100";
      default: return "bg-slate-50 text-slate-500 border-slate-100";
   }
}

function getTypeBadgeStyles(type: string) {
   switch(type) {
      case 'SERVER': return "text-blue-700 border-blue-400";
      case 'STORAGE': return "text-indigo-700 border-indigo-400";
      case 'FIREWALL': return "text-red-700 border-red-400";
      default: return "text-slate-700 border-slate-400";
   }
}
