// src/app/inventory/namespaces/page.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { getK8sNamespacesInventory } from "@/app/actions/inventory-actions";
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
  Network
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/Pagination";

export default function K8sNamespacesInventoryPage() {
  const { data: session, status } = useSession();
  const [namespaces, setNamespaces] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedNamespaceId, setExpandedNamespaceId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getK8sNamespacesInventory({
        page,
        pageSize,
        searchTerm
      });
      setNamespaces(res.namespaces);
      setTotal(res.total);
    } catch (error) {
      console.error("Failed to fetch K8s namespaces inventory:", error);
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

  if (status === "loading" || (loading && namespaces.length === 0)) {
    return (
      <div className="p-6 md:p-10 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-64"></div>
          <div className="h-4 bg-slate-200 rounded w-48"></div>
          <div className="h-64 bg-slate-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (!session) return null;

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
            Overview of provisioned namespaces, cluster groups, and node configurations.
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
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
          <p className="text-sm text-slate-500 mt-1">Try adjusting your search criteria</p>
        </div>
      ) : (
        <div className="space-y-4">
          {namespaces.map((ns) => {
            const isExpanded = expandedNamespaceId === ns.id;
            const cluster = ns.clusters[0]; // Usually one cluster per namespace
            const request = cluster?.request;
            
            let totalNodesCount = 0;
            let totalVcpuCount = 0;
            let totalRamGbCount = 0;

            if (cluster?.nodeGroups) {
              cluster.nodeGroups.forEach((group: any) => {
                totalNodesCount += group.nodes.length;
                totalVcpuCount += (group.vcpu || 0) * group.nodes.length;
                totalRamGbCount += (group.ramGb || 0) * group.nodes.length;
              });
            }

            return (
              <Card key={ns.id} className="border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden bg-white">
                {/* collapsed preview header */}
                <div 
                  onClick={() => toggleExpand(ns.id)}
                  className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                >
                  <div className="space-y-2 flex-1">
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
                        Project / System: <strong className="text-slate-800 font-bold truncate max-w-[150px]">{request?.systemName || request?.projectName || "N/A"}</strong>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <User size={14} className="text-slate-400" />
                        Requested By: <strong className="text-slate-800 font-medium">{request?.requester?.name || "System"}</strong>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock size={14} className="text-slate-400" />
                        Created At: <strong className="text-slate-800 font-medium">{new Date(ns.createdAt).toLocaleDateString()}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 self-start md:self-center">
                    <div className="flex gap-4 text-xs text-slate-500 font-medium">
                      <div className="text-center px-3 py-1 bg-slate-50 rounded-lg border">
                        <div className="text-slate-400 text-[10px] uppercase font-bold">Nodes</div>
                        <div className="text-slate-800 font-bold text-sm">{totalNodesCount}</div>
                      </div>
                      <div className="text-center px-3 py-1 bg-slate-50 rounded-lg border">
                        <div className="text-slate-400 text-[10px] uppercase font-bold">vCPU</div>
                        <div className="text-slate-800 font-bold text-sm">{totalVcpuCount}</div>
                      </div>
                      <div className="text-center px-3 py-1 bg-slate-50 rounded-lg border">
                        <div className="text-slate-400 text-[10px] uppercase font-bold">RAM</div>
                        <div className="text-slate-800 font-bold text-sm">{totalRamGbCount} GB</div>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                  </div>
                </div>

                {/* expanded nodes details */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/20 px-6 pb-6 pt-4 space-y-6">
                    {cluster ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50/60 rounded-xl border border-slate-200/50 text-xs">
                          <div>
                            <span className="text-slate-400 block font-medium">Cluster Name</span>
                            <span className="font-bold text-slate-800">{cluster.clusterName}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">Space Capacity</span>
                            <span className="font-bold text-slate-800">{cluster.totalSpaceGb ? `${cluster.totalSpaceGb} GB` : "Unspecified"}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">Cluster Owner Email</span>
                            <span className="font-bold text-slate-800">{request?.requester?.email || "N/A"}</span>
                          </div>
                        </div>

                        {/* Namespace Ingress & Subdomain Routes */}
                        {ns.subdomains && ns.subdomains.length > 0 && (
                          <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                              <Globe size={14} className="text-indigo-600" />
                              Namespace Ingress & Subdomain Routes ({ns.subdomains.length})
                            </h4>

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
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Node Groups */}
                        {cluster.nodeGroups && cluster.nodeGroups.length > 0 ? (
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cluster Node Groups</h4>
                            
                            {cluster.nodeGroups.map((group: any) => (
                              <div key={group.id} className="bg-white rounded-xl border p-4 space-y-4">
                                <div className="flex items-center justify-between border-b pb-2">
                                  <div className="flex items-center gap-2">
                                    <Badge className="bg-indigo-600 text-white font-bold text-[9px] uppercase tracking-wider px-2 py-0.5">
                                      {group.role} GROUP
                                    </Badge>
                                    <span className="text-xs text-slate-500 font-medium">
                                      {group.nodeCount} node(s) configured
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-slate-500">
                                    <span className="flex items-center gap-1"><Cpu size={12} /> {group.vcpu} vCPUs</span>
                                    <span className="flex items-center gap-1"><HardDrive size={12} /> {group.ramGb} GB RAM</span>
                                  </div>
                                </div>

                                {/* Nodes List */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {group.nodes && group.nodes.length > 0 ? (
                                    group.nodes.map((node: any) => (
                                      <div key={node.id} className="p-3 bg-slate-50/50 rounded-lg border border-slate-100 flex items-center justify-between">
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-800">{node.name}</span>
                                            <Badge variant="outline" className="text-[9px] py-0 px-1 bg-white">
                                              IP: {node.ipAddress || "TBD"}
                                            </Badge>
                                          </div>
                                          <div className="text-[10px] text-slate-500 space-y-0.5">
                                            <div className="flex items-center gap-1">
                                              <Globe size={10} className="text-slate-400" />
                                              Ext IP: <strong>{node.externalIp || "Not Configured"}</strong>
                                            </div>
                                            {node.subdomain && (
                                              <div className="flex items-center gap-1">
                                                <Globe size={10} className="text-indigo-400" />
                                                Route: <strong className="text-indigo-600">{node.subdomain}</strong>
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        {node.subdomain && (
                                          <div className="flex flex-col items-end gap-1">
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
                                          </div>
                                        )}
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-xs text-slate-400 col-span-2 text-center py-2">
                                      No nodes deployed in this group
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500 text-center py-4">
                            No node groups configured for this cluster.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 text-center py-4">
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

      {/* Pagination */}
      {namespaces.length > 0 && (
        <Pagination 
          currentPage={page}
          totalPages={Math.ceil(total / pageSize)}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
