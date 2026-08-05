"use client";

import React, { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
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
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { PhysicalAsset } from "@/types/inventory";
import { AssetType } from "@/types/enums";
import { AssetModal } from "./AssetModal";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import { deleteAsset } from "@/app/actions/asset-actions";

export function AssetListClient({ 
  initialAssets,
  canEdit,
  total = 0,
  currentPage = 1,
  pageSize = 20,
  isLoading = false
}: { 
  initialAssets: PhysicalAsset[],
  canEdit?: boolean,
  total?: number,
  currentPage?: number,
  pageSize?: number,
  isLoading?: boolean
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [clusterFilter, setClusterFilter] = useState<string>("all");
  const [clusters, setClusters] = useState<any[]>([]);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    const loadClusters = async () => {
      const { fetchClusters } = await import("@/app/actions/cluster-actions");
      const data = await fetchClusters();
      setClusters(data);
    };
    loadClusters();
  }, []);

  const totalPages = Math.ceil(total / pageSize);

  const handlePageChange = (newPage: number) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", newPage.toString());
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const filteredAssets = initialAssets.filter(asset => {
    const matchesSearch = 
      asset.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.vendor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.serial?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === "all" || asset.type === typeFilter;
    const matchesCluster = clusterFilter === "all" || 
      (clusterFilter === "none" ? !asset.clusterId : asset.clusterId === clusterFilter);

    return matchesSearch && matchesType && matchesCluster;
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

        <div className="w-full md:w-56">
           <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select 
                className="w-full h-11 pl-9 pr-4 py-2 rounded-md border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none font-medium text-slate-700 shadow-sm"
                value={clusterFilter}
                onChange={(e) => setClusterFilter(e.target.value)}
              >
                <option value="all">Filter: All Clusters</option>
                <option value="none">Standalone (No Cluster)</option>
                {clusters.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
           </div>
        </div>

        <div className="text-sm text-slate-500 font-medium bg-white px-3 py-1 rounded-full border border-slate-100 shadow-sm flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
          Showing {filteredAssets.length} of {total} total assets
        </div>
      </div>

      <div className="relative">
        {(isPending || isLoading) && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-20 flex items-center justify-center transition-all duration-300">
             <div className="flex flex-col items-center gap-3">
               <div className="h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin shadow-lg shadow-blue-100" />
               <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest animate-pulse">Updating Inventory...</p>
             </div>
          </div>
        )}

        {/* Table Content */}
        <div className="overflow-x-auto">
           <table className="w-full text-left">
              <thead className="bg-[#fcfdfe] border-b border-slate-200">
                 <tr>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global Asset Identity</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Type</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Cluster</th>
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
                       <td className="px-6 py-5 text-center">
                          {asset.cluster ? (
                            <Badge variant="outline" className="font-bold text-[9px] px-2.5 py-0.5 border border-amber-300 text-amber-700 bg-amber-50">
                               {asset.cluster.name}
                            </Badge>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium">-</span>
                          )}
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
                       <td colSpan={5} className="px-6 py-20 text-center">
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
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-100">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Page <span className="text-blue-600 font-black">{currentPage}</span> of <span className="text-slate-600">{totalPages}</span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1 || isPending}
              className="h-9 w-9 p-0 border-slate-200 hover:bg-white hover:text-blue-600 hover:border-blue-200 transition-all active:scale-95 disabled:opacity-30 shadow-sm"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = 1;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else {
                  if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                }
                
                if (pageNum <= 0 || pageNum > totalPages) return null;

                const isActive = pageNum === currentPage;
                
                return (
                  <Button
                    key={pageNum}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(pageNum)}
                    disabled={isPending}
                    className={`h-9 w-9 p-0 font-bold text-xs transition-all active:scale-95 shadow-sm ${
                      isActive 
                        ? "bg-blue-600 hover:bg-blue-700 text-white border-transparent" 
                        : "border-slate-200 hover:border-blue-200 hover:text-blue-600 bg-white"
                    }`}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || isPending}
              className="h-9 w-9 p-0 border-slate-200 hover:bg-white hover:text-blue-600 hover:border-blue-200 transition-all active:scale-95 disabled:opacity-30 shadow-sm"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      
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
      case 'FIREWALL': return <Wifi className="h-5 w-5" />; 
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
