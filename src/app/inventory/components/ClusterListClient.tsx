// src/app/inventory/components/ClusterListClient.tsx
"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Layers,
  Trash2,
  Cpu,
  Database,
  Server,
  Activity,
  Terminal,
  Code,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClusterModal } from "./ClusterModal";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import { deleteCluster, assignDeviceToCluster, removeDeviceFromCluster, fetchAvailableDevices } from "@/app/actions/cluster-actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";

export function ClusterListClient({ 
  clusters,
  canEdit,
  onRefresh
}: { 
  clusters: any[],
  canEdit?: boolean,
  onRefresh: () => void
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedClusterIds, setExpandedClusterIds] = useState<string[]>([]);
  const [availableDevices, setAvailableDevices] = useState<any[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [assigningClusterId, setAssigningClusterId] = useState<string | null>(null);

  const toggleClusterExpand = (clusterId: string) => {
    setExpandedClusterIds(prev => 
      prev.includes(clusterId) 
        ? prev.filter(id => id !== clusterId) 
        : [...prev, clusterId]
    );
  };

  const openAssignModal = async (clusterId: string) => {
    setAssigningClusterId(clusterId);
    setLoadingDevices(true);
    try {
      const devices = await fetchAvailableDevices();
      setAvailableDevices(devices);
    } catch {
      toast.error("Failed to load available devices");
    } finally {
      setLoadingDevices(false);
    }
  };

  const handleAssignDevice = async (assetId: string) => {
    if (!assigningClusterId) return;
    try {
      const res = await assignDeviceToCluster(assigningClusterId, assetId);
      if (res.success) {
        toast.success("Device successfully assigned to cluster!");
        setAvailableDevices(prev => prev.filter(d => d.id !== assetId));
        onRefresh();
      } else {
        toast.error(res.error || "Failed to assign device");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to assign device");
    }
  };

  const handleRemoveDevice = async (assetId: string) => {
    if (!confirm("Are you sure you want to remove this device from the cluster?")) return;
    try {
      const res = await removeDeviceFromCluster(assetId);
      if (res.success) {
        toast.success("Device removed from cluster successfully");
        onRefresh();
      } else {
        toast.error(res.error || "Failed to remove device");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to remove device");
    }
  };

  const filteredClusters = clusters.filter(cluster => {
    return (
      cluster.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cluster.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const getCapacityStatusBadge = (status: "healthy" | "warning" | "critical") => {
    switch (status) {
      case "critical":
        return <Badge className="bg-red-150 border-none text-red-700 font-bold gap-1 px-3 py-1">Critical Capacity</Badge>;
      case "warning":
        return <Badge className="bg-amber-150 border-none text-amber-700 font-bold gap-1 px-3 py-1">High Allocation</Badge>;
      default:
        return <Badge className="bg-emerald-100 border-none text-emerald-700 font-bold gap-1 px-3 py-1">Capacity Nominal</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row gap-4 p-5 items-center bg-slate-50/50 border-b border-slate-100">
        <div className="flex-1 relative w-full">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
           <Input 
             placeholder="Search clusters by name or description..." 
             className="pl-9 h-11 bg-white border-slate-200"
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
           />
        </div>

        <div className="text-sm text-slate-500 font-medium bg-white px-3 py-1 rounded-full border border-slate-100 shadow-sm flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
          Showing {filteredClusters.length} of {clusters.length} clusters
        </div>
      </div>

      {/* Grid of Cluster Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
        {filteredClusters.map((cluster) => (
          <Card key={cluster.id} className="shadow-sm border-slate-200 overflow-hidden hover:shadow-md transition-all duration-300">
            {/* Header */}
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5 flex flex-row items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600 border border-amber-100">
                    <Layers className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-lg font-bold text-slate-900">{cluster.name}</CardTitle>
                </div>
                <CardDescription className="text-slate-500 mt-1.5 text-xs font-medium">
                  {cluster.description || "No description provided"}
                </CardDescription>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">Health: Nominal</span>
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                </div>
                {getCapacityStatusBadge(cluster.capacityStatus)}
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Telemetry Matrix Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-center gap-2.5">
                  <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><Server className="h-4 w-4" /></div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Nodes</span>
                    <span className="text-sm font-black text-slate-700">{cluster.hostsCount} Hosts</span>
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-center gap-2.5">
                  <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><Activity className="h-4 w-4" /></div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Active VMs</span>
                    <span className="text-sm font-black text-slate-700">{cluster.runningVmsCount} VMs</span>
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-center gap-2.5">
                  <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg"><Code className="h-4 w-4" /></div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">K8s Clusters</span>
                    <span className="text-sm font-black text-slate-700">{cluster.k8sClustersCount} Active</span>
                  </div>
                </div>
              </div>

              {/* Extra context nodes */}
              {(cluster.workerNodesCount > 0 || cluster.gpuCount > 0) && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {cluster.workerNodesCount > 0 && (
                    <Badge variant="outline" className="bg-slate-50/50 text-[10px] font-semibold text-slate-500 py-1 px-2.5">
                      {cluster.workerNodesCount} K8s Worker Nodes
                    </Badge>
                  )}
                  {cluster.gpuCount > 0 && (
                    <Badge variant="outline" className="bg-emerald-50/30 text-[10px] font-bold text-emerald-700 border-emerald-200 py-1 px-2.5 flex items-center gap-1">
                      <Terminal className="h-3 w-3" /> {cluster.gpuCount} GPU ({cluster.gpuModel})
                    </Badge>
                  )}
                </div>
              )}

              {/* Visual Resource Allocation Sliders */}
              <div className="space-y-4 pt-2 border-t border-slate-100">
                {/* CPU Progress */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-slate-700 flex items-center gap-1"><Cpu className="h-3.5 w-3.5" /> CPU Allocation</span>
                    <span className="font-semibold text-slate-500">
                      {cluster.allocatedCpu} / {cluster.totalCpu} Cores (Avail: {cluster.availableCpu})
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex items-center">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${cluster.cpuPercent > 80 ? 'bg-red-500' : (cluster.cpuPercent > 65 ? 'bg-amber-500' : 'bg-indigo-600')}`}
                      style={{ width: `${Math.min(100, cluster.cpuPercent)}%` }}
                    />
                  </div>
                </div>

                {/* Memory Progress */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-slate-700 flex items-center gap-1"><Database className="h-3.5 w-3.5" /> Memory (RAM)</span>
                    <span className="font-semibold text-slate-500">
                      {cluster.allocatedRam} GB / {cluster.totalRam} GB (Avail: {cluster.availableRam} GB)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex items-center">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${cluster.ramPercent > 80 ? 'bg-red-500' : (cluster.ramPercent > 65 ? 'bg-amber-500' : 'bg-indigo-600')}`}
                      style={{ width: `${Math.min(100, cluster.ramPercent)}%` }}
                    />
                  </div>
                </div>

                {/* Storage Progress */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-slate-700 flex items-center gap-1"><Server className="h-3.5 w-3.5" /> SAN Storage</span>
                    <span className="font-semibold text-slate-500">
                      {cluster.allocatedStorage} GB / {cluster.totalStorage} GB (Avail: {cluster.availableStorage} GB)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex items-center">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${cluster.storagePercent > 80 ? 'bg-red-500' : (cluster.storagePercent > 65 ? 'bg-amber-500' : 'bg-indigo-600')}`}
                      style={{ width: `${Math.min(100, cluster.storagePercent)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* CRUD Controls */}
              <div className="flex justify-between items-center border-t border-slate-100 pt-4 mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleClusterExpand(cluster.id)}
                  className="text-xs font-bold text-slate-500 hover:text-indigo-650 flex items-center gap-1.5 p-0 hover:bg-transparent"
                >
                  {expandedClusterIds.includes(cluster.id) ? (
                    <>
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                      Hide Devices ({cluster.hosts?.length || 0})
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                      Show Devices ({cluster.hosts?.length || 0})
                    </>
                  )}
                </Button>

                <div className="flex gap-2">
                  {canEdit && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAssignModal(cluster.id)}
                        className="h-8 text-xs font-bold text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                      >
                        <Plus className="h-3 w-3 mr-1" /> Assign Device
                      </Button>
                      <ClusterModal cluster={cluster} mode="edit" onSave={onRefresh} />
                      <DeleteConfirmationModal
                        title="Delete Cluster"
                        description={`Are you sure you want to delete ${cluster.name}? This will remove the cluster but keep all host servers in your inventory.`}
                        onDelete={async () => {
                          await deleteCluster(cluster.id);
                          onRefresh();
                        }}
                        trigger={
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-450 hover:text-red-650 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        }
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Expandable Device List */}
              {expandedClusterIds.includes(cluster.id) && (
                <div className="pt-4 border-t border-slate-100 space-y-2 mt-4 animate-in fade-in duration-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Cluster Hardware List</span>
                  {(!cluster.hosts || cluster.hosts.length === 0) ? (
                    <p className="text-xs text-slate-450 italic py-2">No physical devices assigned to this cluster.</p>
                  ) : (
                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50/50">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-slate-100 border-b border-slate-200">
                            <tr>
                              <th className="px-3 py-2 font-bold text-slate-500">Device Name</th>
                              <th className="px-3 py-2 font-bold text-slate-500">Type</th>
                              <th className="px-3 py-2 font-bold text-slate-500 font-mono">Specs</th>
                              <th className="px-3 py-2 font-bold text-slate-500">Serial</th>
                              {canEdit && <th className="px-3 py-2 text-right font-bold text-slate-500">Action</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {cluster.hosts.map((host: any) => (
                              <tr key={host.id} className="hover:bg-slate-100/50 transition-colors">
                                <td className="px-3 py-2 font-semibold text-slate-800">{host.name}</td>
                                <td className="px-3 py-2 text-slate-500 uppercase text-[10px] font-bold">{host.type}</td>
                                <td className="px-3 py-2 font-mono text-[10px] text-slate-505">
                                  {host.cpuCores ? `${host.cpuCores}c` : ''}
                                  {host.ramGb ? `/${host.ramGb}G` : ''}
                                  {host.storageGb ? `/${host.storageGb}G` : ''}
                                </td>
                                <td className="px-3 py-2 text-slate-500 font-mono text-[10px]">{host.serial || '—'}</td>
                                {canEdit && (
                                  <td className="px-3 py-2 text-right">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleRemoveDevice(host.id)}
                                      className="h-6 w-6 text-slate-400 hover:text-red-650 rounded-md"
                                      title="Remove device from cluster"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </Button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {filteredClusters.length === 0 && (
          <div className="col-span-2 py-20 text-center">
            <div className="flex flex-col items-center gap-2 opacity-30 grayscale saturate-0">
               <Layers className="h-10 w-10 text-slate-400" />
               <p className="font-black uppercase tracking-widest text-lg text-slate-500">No Clusters Found</p>
               <p className="text-xs font-medium">Add a physical cluster to group your hypervisor hosts.</p>
            </div>
          </div>
        )}
      </div>

      {/* Assign Device Modal */}
      <Dialog open={assigningClusterId !== null} onOpenChange={(open) => !open && setAssigningClusterId(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-indigo-600">
              <Plus className="h-5 w-5" /> Assign Device to Cluster
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-xs text-slate-500">
              Select a physical asset from the unassigned inventory to add to this cluster.
            </p>
            {loadingDevices ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : availableDevices.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-8">No unassigned devices available.</p>
            ) : (
              <div className="border border-slate-200 rounded-lg max-h-60 overflow-y-auto p-2 space-y-1.5 bg-white">
                {availableDevices.map((device) => (
                  <div 
                    key={device.id}
                    className="flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-lg border border-slate-100 transition-colors"
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        {device.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {device.type} • {device.vendor || "No vendor"} {device.model || ""} • S/N: {device.serial || "N/A"}
                      </span>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => handleAssignDevice(device.id)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] h-7 px-3 rounded-md"
                    >
                      Assign
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssigningClusterId(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
