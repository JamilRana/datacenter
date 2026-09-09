// src/app/inventory/namespaces/page.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { getK8sNamespacesInventory } from "@/app/actions/inventory-actions";
import { 
  getK8sInventorySummary, 
  K8sInventorySummary, 
  deleteK8sNamespace, 
  addK8sNode, 
  deleteK8sNode,
  deleteK8sSubdomain 
} from "@/app/actions/k8s-actions";
import { 
  ChevronLeft, 
  Box, 
  Search, 
  Loader2, 
  Globe, 
  Layers, 
  User, 
  Cpu, 
  HardDrive, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Network,
  Server,
  Database,
  Trash2,
  Plus
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/Pagination";
import { AddNamespaceModal } from "@/app/inventory/components/AddNamespaceModal";
import { EditNamespaceModal } from "@/app/inventory/components/EditNamespaceModal";
import { AddNodeGroupModal } from "@/app/inventory/components/AddNodeGroupModal";
import { EditNodeModal } from "@/app/inventory/components/EditNodeModal";
import { EditNodeGroupModal } from "@/app/inventory/components/EditNodeGroupModal";
import { AddSubdomainModal } from "@/app/inventory/components/AddSubdomainModal";
import { EditSubdomainModal } from "@/app/inventory/components/EditSubdomainModal";
import { DeleteConfirmationModal } from "@/app/inventory/components/DeleteConfirmationModal";
import { toast } from "sonner";

export default function K8sNamespacesInventoryPage() {
  const { data: session, status } = useSession();
  const [namespaces, setNamespaces] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<K8sInventorySummary | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedNamespaceId, setExpandedNamespaceId] = useState<string | null>(null);
  const [addingNodeGroupId, setAddingNodeGroupId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [res, summaryRes] = await Promise.all([
        getK8sNamespacesInventory({
          page,
          pageSize,
          searchTerm
        }),
        getK8sInventorySummary()
      ]);
      setNamespaces(res.namespaces);
      setTotal(res.total);
      setSummary(summaryRes);
    } catch (error) {
      console.error("Failed to fetch K8s namespaces inventory:", error);
      toast.error("Failed to load Kubernetes inventory data");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchTerm]);

  useEffect(() => {
    if (status === "loading" || !session) return;
    fetchData();
  }, [session, status, page, searchTerm, fetchData]);

  const toggleExpand = (id: string) => {
    setExpandedNamespaceId(prev => (prev === id ? null : id));
  };

  const handleAddNode = async (nodeGroupId: string) => {
    setAddingNodeGroupId(nodeGroupId);
    try {
      const res = await addK8sNode(nodeGroupId);
      if (res.success) {
        toast.success(res.message || "Node added successfully");
        await fetchData();
      } else {
        toast.error(res.message || "Failed to add node");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to add node");
    } finally {
      setAddingNodeGroupId(null);
    }
  };

  if (status === "loading" || (loading && namespaces.length === 0 && !summary)) {
    return (
      <div className="p-6 md:p-10 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-64"></div>
          <div className="h-4 bg-slate-200 rounded w-48"></div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 bg-slate-200 rounded-xl"></div>
            ))}
          </div>
          <div className="h-64 bg-slate-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const userRoles = session.user.roles || [];
  const canManageNamespace = userRoles.some(r => ["ADMIN", "DC_OPS"].includes(r.toUpperCase()));

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/inventory" className="hover:text-indigo-600 flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" />
          Inventory Hub
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">K8s Namespaces</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Kubernetes Namespaces</h1>
          <p className="text-slate-500 mt-1">
            Overview of provisioned namespaces, cluster groups, node provisioning, and ingress routes.
          </p>
        </div>
        {canManageNamespace && (
          <AddNamespaceModal onCreated={fetchData} />
        )}
      </div>

      {/* Resource Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Namespaces Card */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm relative overflow-hidden group hover:border-indigo-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Namespaces</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Box className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900">
              {summary ? summary.totalNamespaces : "--"}
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
              {summary?.totalSubdomains || 0} active routes
            </p>
          </div>
        </Card>

        {/* Clusters Card */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm relative overflow-hidden group hover:border-sky-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Clusters</span>
            <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900">
              {summary ? summary.totalClusters : "--"}
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
              Active clusters
            </p>
          </div>
        </Card>

        {/* Total Nodes Card */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm relative overflow-hidden group hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Nodes</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Server className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900">
              {summary ? summary.totalNodes : "--"}
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5 font-medium truncate">
              {summary ? `${summary.totalMasterNodes} M • ${summary.totalWorkerNodes} W` : "Master / Worker"}
            </p>
          </div>
        </Card>

        {/* Total vCPU Card */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm relative overflow-hidden group hover:border-violet-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Allocated vCPU</span>
            <div className="p-1.5 rounded-lg bg-violet-50 text-violet-600">
              <Cpu className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900">
              {summary ? summary.totalVcpu : "--"}
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
              Cores across nodes
            </p>
          </div>
        </Card>

        {/* Total RAM Card */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm relative overflow-hidden group hover:border-amber-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Allocated RAM</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <HardDrive className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900">
              {summary ? `${summary.totalRamGb}` : "--"} <span className="text-xs font-semibold text-slate-500">GB</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
              Memory pooled
            </p>
          </div>
        </Card>

        {/* Total Storage Card */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm relative overflow-hidden group hover:border-rose-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Storage Cap.</span>
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <Database className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900">
              {summary ? (
                summary.totalStorageGb >= 1024 
                  ? `${(summary.totalStorageGb / 1024).toFixed(1)}` 
                  : `${summary.totalStorageGb}`
              ) : "--"}{" "}
              <span className="text-xs font-semibold text-slate-500">
                {summary && summary.totalStorageGb >= 1024 ? "TB" : "GB"}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
              Disk capacity
            </p>
          </div>
        </Card>
      </div>

      {/* Search and Pagination Stats */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <Input
            placeholder="Search namespaces or supervisor IPs..."
            className="pl-9 h-10 border-slate-200 focus-visible:ring-indigo-500 shadow-sm bg-white"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {total > 0 && (
          <div className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-800">{(page - 1) * pageSize + 1}</strong> -{" "}
            <strong className="text-slate-800">{Math.min(page * pageSize, total)}</strong> of{" "}
            <strong className="text-slate-800">{total}</strong> namespaces
          </div>
        )}
      </div>

      {/* Namespaces List */}
      {loading && namespaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-20 gap-3 bg-white rounded-xl border border-slate-200">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Loading Namespaces...</p>
        </div>
      ) : namespaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-20 bg-white rounded-xl border border-slate-200 opacity-60 text-center">
          <Box size={48} className="mb-4 text-indigo-300" />
          <p className="text-xl font-semibold text-slate-800">No Kubernetes Namespaces found</p>
          <p className="text-sm text-slate-500 mt-1">Try adjusting your search criteria or create a new namespace</p>
        </div>
      ) : (
        <div className="space-y-4">
          {namespaces.map((ns) => {
            const isExpanded = expandedNamespaceId === ns.id;
            const cluster = ns.clusters?.[0]; // Primary cluster per namespace
            const request = cluster?.request;
            
            let totalNodesCount = 0;
            let totalVcpuCount = 0;
            let totalRamGbCount = 0;

            if (cluster?.nodeGroups) {
              cluster.nodeGroups.forEach((group: any) => {
                const count = group.nodes ? group.nodes.length : (group.nodeCount || 0);
                totalNodesCount += count;
                totalVcpuCount += (group.vcpu || 0) * count;
                totalRamGbCount += (group.ramGb || 0) * count;
              });
            }

            return (
              <Card key={ns.id} className="border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden bg-white">
                {/* Collapsed Preview Header */}
                <div 
                  onClick={() => toggleExpand(ns.id)}
                  className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                >
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-indigo-700 text-lg">{ns.name}</span>
                      <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-150 font-bold text-[10px] uppercase tracking-wide">
                        Supervisor: {ns.supervisorIp}
                      </Badge>
                      {cluster && (
                        <Badge className={`border font-semibold text-[10px] py-0 px-2 uppercase ${
                          cluster.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          cluster.status === "SUSPENDED" ? "bg-amber-50 text-amber-700 border-amber-200" :
                          "bg-rose-50 text-rose-700 border-rose-200"
                        }`}>
                          {cluster.status}
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <Layers size={14} className="text-slate-400" />
                        Project / System: <strong className="text-slate-800 font-bold truncate max-w-[150px]">{request?.systemName || request?.projectName || "Direct Provisioning"}</strong>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <User size={14} className="text-slate-400" />
                        Requested By: <strong className="text-slate-800 font-medium">{request?.requester?.name || "Operations Admin"}</strong>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock size={14} className="text-slate-400" />
                        Created At: <strong className="text-slate-800 font-medium">{new Date(ns.createdAt).toLocaleDateString()}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Metrics & Action Controls */}
                  <div className="flex items-center gap-4 self-start md:self-center">
                    <div className="flex gap-2 sm:gap-3 text-xs text-slate-500 font-medium">
                      <div className="text-center px-2.5 py-1 bg-slate-50 rounded-lg border">
                        <div className="text-slate-400 text-[9px] uppercase font-bold">Nodes</div>
                        <div className="text-slate-800 font-bold text-sm">{totalNodesCount}</div>
                      </div>
                      <div className="text-center px-2.5 py-1 bg-slate-50 rounded-lg border">
                        <div className="text-slate-400 text-[9px] uppercase font-bold">vCPU</div>
                        <div className="text-slate-800 font-bold text-sm">{totalVcpuCount}</div>
                      </div>
                      <div className="text-center px-2.5 py-1 bg-slate-50 rounded-lg border">
                        <div className="text-slate-400 text-[9px] uppercase font-bold">RAM</div>
                        <div className="text-slate-800 font-bold text-sm">{totalRamGbCount} GB</div>
                      </div>
                    </div>

                    {/* Action buttons (Edit & Delete) */}
                    {canManageNamespace && (
                      <div 
                        className="flex items-center gap-1 border-l pl-3 border-slate-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <EditNamespaceModal 
                          namespace={ns} 
                          onUpdated={fetchData} 
                        />

                        <DeleteConfirmationModal
                          title="Delete Kubernetes Namespace"
                          description={`Are you sure you want to delete namespace "${ns.name}"? This will permanently delete all associated clusters, node groups, nodes, and ingress routes.`}
                          onDelete={async () => {
                            const res = await deleteK8sNamespace(ns.id);
                            if (!res.success) {
                              throw new Error(res.message || "Failed to delete namespace");
                            }
                            await fetchData();
                          }}
                          trigger={
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                              title="Delete Namespace"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          }
                        />
                      </div>
                    )}

                    <div className="text-slate-400">
                      {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/30 px-6 pb-6 pt-4 space-y-6">
                    {cluster ? (
                      <div className="space-y-5">
                        {/* Cluster Specs Summary */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-white rounded-xl border border-slate-200/80 text-xs shadow-sm">
                          <div>
                            <span className="text-slate-400 block font-medium">Cluster Name</span>
                            <span className="font-bold text-slate-800 text-sm">{cluster.clusterName}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">Allocated Space Capacity</span>
                            <span className="font-bold text-slate-800 text-sm">
                              {cluster.totalSpaceGb ? `${cluster.totalSpaceGb} GB` : "Unspecified"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">Cluster Owner / Requester</span>
                            <span className="font-bold text-slate-800 text-sm">
                              {request?.requester?.email || "DC Infrastructure Pool"}
                            </span>
                          </div>
                        </div>

                        {/* Namespace Ingress & Subdomain Routes */}
                        <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                              <Globe size={14} className="text-indigo-600" />
                              Namespace Ingress & Subdomain Routes ({ns.subdomains?.length || 0})
                            </h4>
                            {canManageNamespace && (
                              <AddSubdomainModal
                                namespaceId={ns.id}
                                namespaceName={ns.name}
                                onCreated={fetchData}
                              />
                            )}
                          </div>

                          {ns.subdomains && ns.subdomains.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {ns.subdomains.map((sub: any) => {
                                const fullDomain = sub.subdomain.includes(".") ? sub.subdomain : `${sub.subdomain}.dghs.gov.bd`;
                                return (
                                  <div key={sub.id} className="p-3 bg-slate-50/70 rounded-lg border border-slate-200/80 flex items-center justify-between gap-3">
                                    <div className="space-y-1 min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <Network className="h-3.5 w-3.5 text-indigo-600 flex-shrink-0" />
                                        <span className="text-xs font-bold text-slate-800 truncate" title={fullDomain}>
                                          {sub.subdomain}
                                        </span>
                                      </div>
                                      <div className="text-[10px] text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5">
                                        <span>Ext IP: <strong>{sub.externalIp || "Auto Ingress VIP"}</strong></span>
                                        <span>Service: <strong>{sub.serviceName || "Root"}:{sub.targetPort || 443}</strong></span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <Badge className={`text-[9px] font-bold uppercase tracking-wider ${
                                        sub.status === "ACTIVE" 
                                          ? "bg-emerald-100 text-emerald-800 border-none" 
                                          : sub.status === "REJECTED"
                                          ? "bg-red-100 text-red-800 border-none"
                                          : "bg-amber-100 text-amber-800 border-none"
                                      }`}>
                                        {sub.status === "ACTIVE" && <CheckCircle2 className="h-2.5 w-2.5 mr-1" />}
                                        {sub.status === "REJECTED" && <XCircle className="h-2.5 w-2.5 mr-1" />}
                                        {sub.status === "PENDING" && <Clock className="h-2.5 w-2.5 mr-1" />}
                                        {sub.status}
                                      </Badge>

                                      {canManageNamespace && (
                                        <div className="flex items-center gap-0.5">
                                          <EditSubdomainModal
                                            subdomain={sub}
                                            onUpdated={fetchData}
                                          />

                                          <DeleteConfirmationModal
                                            title="Delete Subdomain Route"
                                            description={`Are you sure you want to delete subdomain "${sub.subdomain}"? This ingress route will be decommissioned.`}
                                            onDelete={async () => {
                                              const res = await deleteK8sSubdomain(sub.id);
                                              if (!res.success) {
                                                throw new Error(res.message || "Failed to delete subdomain");
                                              }
                                              await fetchData();
                                            }}
                                            trigger={
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0 text-slate-300 hover:text-red-600 hover:bg-red-50"
                                                title="Delete Subdomain"
                                              >
                                                <Trash2 size={12} />
                                              </Button>
                                            }
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400 text-center py-4 bg-slate-50/40 rounded-lg border border-dashed border-slate-200">
                              No ingress subdomains configured for this namespace. Click &quot;Add Subdomain&quot; to register a host and IP address.
                            </div>
                          )}
                        </div>

                        {/* Cluster Node Groups & Provisioning */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                              <Server size={14} className="text-indigo-600" />
                              Cluster Node Groups & Topology
                            </h4>
                            {canManageNamespace && (
                              <AddNodeGroupModal
                                clusterId={cluster.id}
                                namespaceName={ns.name}
                                existingRoles={cluster.nodeGroups?.map((g: any) => g.role)}
                                onCreated={fetchData}
                              />
                            )}
                          </div>
                          
                          {cluster.nodeGroups && cluster.nodeGroups.length > 0 ? (
                            <div className="space-y-3">
                              {cluster.nodeGroups.map((group: any) => (
                                <div key={group.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-4 shadow-sm">
                                  {/* Node group header */}
                                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                                    <div className="flex items-center gap-2.5">
                                      <Badge className={`font-bold text-[9px] uppercase tracking-wider px-2.5 py-0.5 ${
                                        group.role === "MASTER" 
                                          ? "bg-purple-600 text-white" 
                                          : "bg-indigo-600 text-white"
                                      }`}>
                                        {group.role} POOL
                                      </Badge>
                                      <span className="text-xs text-slate-600 font-semibold">
                                        {group.nodes?.length || group.nodeCount} node(s) configured
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-3">
                                      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                                        <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded border">
                                          <Cpu size={12} className="text-slate-400" /> {group.vcpu} vCPUs
                                        </span>
                                        <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded border">
                                          <HardDrive size={12} className="text-slate-400" /> {group.ramGb} GB RAM
                                        </span>
                                        {group.storageGb ? (
                                          <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded border">
                                            <HardDrive size={12} className="text-indigo-500" /> {group.storageGb} GB Disk
                                          </span>
                                        ) : null}
                                        {canManageNamespace && (
                                          <EditNodeGroupModal group={group} onUpdated={fetchData} />
                                        )}
                                      </div>

                                      {canManageNamespace && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          disabled={addingNodeGroupId === group.id}
                                          onClick={() => handleAddNode(group.id)}
                                          className="h-7 px-2.5 text-xs font-semibold text-indigo-600 border-indigo-200 hover:bg-indigo-50 gap-1"
                                          title="Add an additional node to this group"
                                        >
                                          {addingNodeGroupId === group.id ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <Plus className="h-3 w-3" />
                                          )}
                                          Add Node
                                        </Button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Nodes List */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {group.nodes && group.nodes.length > 0 ? (
                                      group.nodes.map((node: any) => (
                                        <div key={node.id} className="p-3 bg-slate-50/60 rounded-lg border border-slate-100 flex items-center justify-between gap-3 hover:border-slate-300 transition-colors">
                                          <div className="space-y-1 min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs font-bold text-slate-800 truncate">{node.name}</span>
                                              <Badge variant="outline" className="text-[9px] py-0 px-1.5 bg-white border-slate-200 font-mono">
                                                {node.ipAddress || "Auto IP"}
                                              </Badge>
                                            </div>
                                            <div className="text-[10px] text-slate-500 space-y-0.5">
                                              <div className="flex items-center gap-1">
                                                <Globe size={10} className="text-slate-400" />
                                                Ext IP: <strong>{node.externalIp || "Not Assigned"}</strong>
                                              </div>
                                              {node.subdomain && (
                                                <div className="flex items-center gap-1 truncate">
                                                  <Network size={10} className="text-indigo-500 flex-shrink-0" />
                                                  Route: <strong className="text-indigo-600 truncate">{node.subdomain}</strong>
                                                </div>
                                              )}
                                              <div className="flex items-center gap-1.5 pt-0.5">
                                                <Badge variant="outline" className="text-[9px] py-0 px-1.5 bg-indigo-50 border-indigo-200 text-indigo-700 font-medium flex items-center gap-1">
                                                  <Cpu size={10} className="text-indigo-600" />
                                                  {group.vcpu} vCPU
                                                </Badge>
                                                <Badge variant="outline" className="text-[9px] py-0 px-1.5 bg-emerald-50 border-emerald-200 text-emerald-700 font-medium flex items-center gap-1">
                                                  <HardDrive size={10} className="text-emerald-600" />
                                                  {group.ramGb} GB RAM
                                                </Badge>
                                              </div>
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-2">
                                            {node.subdomain && (
                                              <div className="flex items-center gap-1">
                                                {node.subdomainStatus === "ACTIVE" ? (
                                                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                                ) : node.subdomainStatus === "REJECTED" ? (
                                                  <XCircle className="h-3 w-3 text-red-500" />
                                                ) : (
                                                  <Clock className="h-3 w-3 text-amber-500" />
                                                )}
                                                <span className={`text-[9px] font-bold uppercase ${
                                                  node.subdomainStatus === "ACTIVE" ? "text-emerald-600" :
                                                  node.subdomainStatus === "REJECTED" ? "text-red-600" :
                                                  "text-amber-600"
                                                }`}>{node.subdomainStatus}</span>
                                              </div>
                                            )}

                                            {canManageNamespace && (
                                              <div className="flex items-center gap-0.5">
                                                <EditNodeModal 
                                                  node={node} 
                                                  onUpdated={fetchData} 
                                                />

                                                <DeleteConfirmationModal
                                                  title="Delete Kubernetes Node"
                                                  description={`Are you sure you want to delete node "${node.name}"? This node will be decommissioned and removed from the ${group.role} group.`}
                                                  onDelete={async () => {
                                                    const res = await deleteK8sNode(node.id);
                                                    if (!res.success) {
                                                      throw new Error(res.message || "Failed to delete node");
                                                    }
                                                    await fetchData();
                                                  }}
                                                  trigger={
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      className="h-7 w-7 p-0 text-slate-300 hover:text-red-600 hover:bg-red-50"
                                                      title="Delete Node"
                                                    >
                                                      <Trash2 size={13} />
                                                    </Button>
                                                  }
                                                />
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="text-xs text-slate-400 col-span-2 text-center py-3 bg-slate-50/40 rounded-lg border border-dashed border-slate-200">
                                        No nodes deployed in this group
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500 text-center py-6 bg-white rounded-xl border border-dashed border-slate-200">
                              No node groups configured for this cluster. Click &quot;Add Node Group&quot; above to provision nodes.
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 text-center py-6 bg-white rounded-xl border border-dashed border-slate-200">
                        No cluster provisioned for this namespace.
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Smart Pagination */}
      {total > 0 && (
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500 font-medium">
            Page <strong className="text-slate-800">{page}</strong> of <strong className="text-slate-800">{totalPages}</strong>
          </div>
          <Pagination 
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(p) => {
              setPage(p);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </div>
      )}
    </div>
  );
}
