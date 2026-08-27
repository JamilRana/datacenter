"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Code, 
  Layers, 
  Cpu, 
  HardDrive, 
  Plus, 
  Globe, 
  Settings2, 
  Loader2, 
  ChevronDown, 
  ChevronUp, 
  Info,
  Server,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Network
} from "lucide-react";
import { toast } from "sonner";
import { 
  getUserK8sNamespaces, 
  addK8sNode, 
  updateK8sNodeIpAndSubdomain,
  requestK8sSubdomain,
  deleteK8sSubdomain
} from "@/app/actions/k8s-actions";

export function K8sDashboard({
  namespaces: initialNamespaces,
  loading: initialLoading,
  onRefresh
}: {
  namespaces?: any[],
  loading?: boolean,
  onRefresh?: () => void
} = {}) {
  const [namespaces, setNamespaces] = useState<any[]>(initialNamespaces || []);
  const [loading, setLoading] = useState(initialLoading !== undefined ? initialLoading : true);
  const [expandedNamespace, setExpandedNamespace] = useState<string | null>(null);
  
  // Legacy node configuration modal
  const [editingNode, setEditingNode] = useState<{
    id: string;
    name: string;
    externalIp: string;
    subdomain: string;
  } | null>(null);
  const [isSavingNode, setIsSavingNode] = useState(false);
  const [isAddingNode, setIsAddingNode] = useState<string | null>(null); // NodeGroupId

  // New Subdomain Request Modal
  const [requestSubdomainNamespace, setRequestSubdomainNamespace] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [subdomainForm, setSubdomainForm] = useState({
    subdomain: "",
    externalIp: "",
    serviceName: "",
    targetPort: 443,
    purpose: ""
  });
  const [isSubmittingSubdomain, setIsSubmittingSubdomain] = useState(false);
  const [deletingSubdomainId, setDeletingSubdomainId] = useState<string | null>(null);

  const fetchNamespaces = useCallback(async () => {
    try {
      const res = await getUserK8sNamespaces();
      if (res.success && res.namespaces) {
        setNamespaces(res.namespaces);
        if (res.namespaces.length > 0 && !expandedNamespace) {
          setExpandedNamespace(res.namespaces[0].id);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load namespaces");
    } finally {
      setLoading(false);
    }
  }, [expandedNamespace]);

  useEffect(() => {
    if (initialNamespaces) {
      setNamespaces(initialNamespaces);
      if (initialNamespaces.length > 0 && !expandedNamespace) {
        setExpandedNamespace(initialNamespaces[0].id);
      }
    } else {
      fetchNamespaces();
    }
  }, [initialNamespaces, fetchNamespaces, expandedNamespace]);

  useEffect(() => {
    if (initialLoading !== undefined) {
      setLoading(initialLoading);
    }
  }, [initialLoading]);

  const handleAddNode = async (nodeGroupId: string) => {
    setIsAddingNode(nodeGroupId);
    try {
      const res = await addK8sNode(nodeGroupId);
      if (res.success) {
        toast.success(res.message);
        if (onRefresh) onRefresh();
        await fetchNamespaces();
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to add node");
    } finally {
      setIsAddingNode(null);
    }
  };

  const handleSaveNodeConfig = async () => {
    if (!editingNode) return;
    setIsSavingNode(true);
    try {
      const res = await updateK8sNodeIpAndSubdomain(
        editingNode.id,
        editingNode.externalIp,
        editingNode.subdomain
      );
      if (res.success) {
        toast.success(res.message);
        setEditingNode(null);
        if (onRefresh) onRefresh();
        await fetchNamespaces();
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update node configuration");
    } finally {
      setIsSavingNode(false);
    }
  };

  const handleOpenSubdomainModal = (ns: { id: string; name: string }) => {
    setRequestSubdomainNamespace(ns);
    setSubdomainForm({
      subdomain: "",
      externalIp: "",
      serviceName: "",
      targetPort: 443,
      purpose: ""
    });
  };

  const handleSubmitSubdomainRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestSubdomainNamespace) return;
    if (!subdomainForm.subdomain.trim()) {
      toast.error("Please enter a subdomain");
      return;
    }

    setIsSubmittingSubdomain(true);
    try {
      const res = await requestK8sSubdomain({
        namespaceId: requestSubdomainNamespace.id,
        subdomain: subdomainForm.subdomain,
        externalIp: subdomainForm.externalIp,
        serviceName: subdomainForm.serviceName,
        targetPort: Number(subdomainForm.targetPort) || 443,
        purpose: subdomainForm.purpose
      });

      if (res.success) {
        toast.success(res.message);
        setRequestSubdomainNamespace(null);
        if (onRefresh) onRefresh();
        await fetchNamespaces();
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit subdomain request");
    } finally {
      setIsSubmittingSubdomain(false);
    }
  };

  const handleDeleteSubdomain = async (subdomainId: string) => {
    if (!confirm("Are you sure you want to remove this subdomain route?")) return;
    setDeletingSubdomainId(subdomainId);
    try {
      const res = await deleteK8sSubdomain(subdomainId);
      if (res.success) {
        toast.success(res.message);
        if (onRefresh) onRefresh();
        await fetchNamespaces();
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove subdomain route");
    } finally {
      setDeletingSubdomainId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="text-sm font-semibold text-slate-500">Loading Kubernetes Namespaces...</p>
      </div>
    );
  }

  if (namespaces.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-slate-200 shadow-sm p-8">
        <Code className="h-12 w-12 mx-auto mb-4 text-indigo-500/40" />
        <h3 className="text-lg font-bold text-slate-900">No Kubernetes Namespaces Found</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mt-2">
          You currently don&apos;t have any provisioned Kubernetes namespaces. Once your K8s namespace requests are approved and deployed by DC-Ops, they will appear here.
        </p>
      </div>
    );
  }

  const totalNamespaces = namespaces.length;
  const totalK8sNodes = namespaces.reduce((sum, ns) => 
    sum + (ns.clusters?.reduce((cSum: number, c: any) => 
      cSum + (c.nodeGroups?.reduce((gSum: number, g: any) => gSum + (g.nodes?.length || g.nodeCount || 0), 0) || 0), 0
    ) || 0), 0
  );
  const totalK8sCpu = namespaces.reduce((sum, ns) => 
    sum + (ns.clusters?.reduce((cSum: number, c: any) => 
      cSum + (c.nodeGroups?.reduce((gSum: number, g: any) => gSum + ((g.vcpu || 0) * (g.nodes?.length || g.nodeCount || 0)), 0) || 0), 0
    ) || 0), 0
  );
  const totalK8sRam = namespaces.reduce((sum, ns) => 
    sum + (ns.clusters?.reduce((cSum: number, c: any) => 
      cSum + (c.nodeGroups?.reduce((gSum: number, g: any) => gSum + ((g.ramGb || 0) * (g.nodes?.length || g.nodeCount || 0)), 0) || 0), 0
    ) || 0), 0
  );

  return (
    <div className="space-y-6">
      {/* Kubernetes Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Card className="border-none shadow-sm bg-white overflow-hidden p-5 flex flex-col justify-between border border-slate-100">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Namespaces</span>
            <div className="p-2 bg-indigo-50 text-indigo-650 rounded-lg"><Code className="h-4 w-4 text-indigo-600" /></div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-slate-900">{totalNamespaces}</span>
            <span className="text-xs font-semibold text-slate-400 block mt-0.5">Active Namespace Allocations</span>
          </div>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden p-5 flex flex-col justify-between border border-slate-100">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Nodes</span>
            <div className="p-2 bg-violet-50 text-violet-650 rounded-lg"><Server className="h-4 w-4 text-violet-600" /></div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-slate-900">{totalK8sNodes}</span>
            <span className="text-xs font-semibold text-slate-400 block mt-0.5">Active VM Pod Nodes</span>
          </div>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden p-5 flex flex-col justify-between border border-slate-100">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">CPU Cores</span>
            <div className="p-2 bg-emerald-50 text-emerald-650 rounded-lg"><Cpu className="h-4 w-4 text-emerald-600" /></div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-slate-900">{totalK8sCpu} Cores</span>
            <span className="text-xs font-semibold text-slate-400 block mt-0.5">Scale Allocations</span>
          </div>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden p-5 flex flex-col justify-between border border-slate-100">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">RAM Capacity</span>
            <div className="p-2 bg-cyan-50 text-cyan-650 rounded-lg"><HardDrive className="h-4 w-4 text-cyan-600" /></div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-slate-900">{totalK8sRam} GB</span>
            <span className="text-xs font-semibold text-slate-400 block mt-0.5">Aggregated Namespace RAM</span>
          </div>
        </Card>
      </div>

      {namespaces.map((ns) => {
        const isExpanded = expandedNamespace === ns.id;
        const totalVcpu = ns.clusters?.reduce((sum: number, c: any) => 
          sum + c.nodeGroups?.reduce((s: number, g: any) => s + (g.vcpu * g.nodeCount), 0), 0
        ) || 0;
        const totalRam = ns.clusters?.reduce((sum: number, c: any) => 
          sum + c.nodeGroups?.reduce((s: number, g: any) => s + (g.ramGb * g.nodeCount), 0), 0
        ) || 0;
        const totalNodes = ns.clusters?.reduce((sum: number, c: any) => 
          sum + c.nodeGroups?.reduce((s: number, g: any) => s + (g.nodes?.length || g.nodeCount || 0), 0), 0
        ) || 0;

        return (
          <Card key={ns.id} className="border border-slate-200 shadow-sm overflow-hidden bg-white">
            {/* Namespace Summary Bar */}
            <div 
              className="flex flex-col md:flex-row items-start md:items-center justify-between p-6 cursor-pointer hover:bg-slate-50/50 transition-colors"
              onClick={() => setExpandedNamespace(isExpanded ? null : ns.id)}
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 rounded-lg text-indigo-600">
                  <Code className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                    {ns.name}
                    <Badge className="bg-indigo-100 text-indigo-700 border-none font-bold text-[10px]">
                      K8S Namespace
                    </Badge>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5 text-slate-400" />
                    Supervisor IP: <span className="font-semibold text-slate-700">{ns.supervisorIp}</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6 mt-4 md:mt-0">
                <div className="flex items-center gap-4 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                    <Server className="h-4 w-4 text-slate-400" />
                    <span><strong className="text-slate-900">{totalNodes}</strong> Nodes</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                    <Cpu className="h-4 w-4 text-slate-400" />
                    <span><strong className="text-slate-900">{totalVcpu}</strong> Cores</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                    <HardDrive className="h-4 w-4 text-slate-400" />
                    <span><strong className="text-slate-900">{totalRam}</strong> GB RAM</span>
                  </div>
                </div>
                <div>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                  )}
                </div>
              </div>
            </div>

            {/* Expanded Cluster & Nodes Details */}
            {isExpanded && (
              <div className="border-t border-slate-100 bg-slate-50/30 p-6 space-y-6">

                {/* 1. Namespace Services & Ingress Subdomains Section */}
                <div className="bg-white rounded-xl border border-indigo-100/80 shadow-xs p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Globe className="h-4 w-4 text-indigo-600" />
                        Namespace Services & Ingress Subdomains
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Route public or internal traffic to your Kubernetes services via Ingress controller.
                      </p>
                    </div>

                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenSubdomainModal(ns);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-8 gap-1.5 rounded-lg shadow-xs shadow-indigo-100 flex items-center"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Request Subdomain Route
                    </Button>
                  </div>

                  {/* Subdomain List */}
                  {ns.subdomains && ns.subdomains.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {ns.subdomains.map((sub: any) => {
                        const fullDomain = sub.subdomain.includes(".") ? sub.subdomain : `${sub.subdomain}.dghs.gov.bd`;
                        return (
                          <div 
                            key={sub.id} 
                            className="p-4 bg-slate-50/70 hover:bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col justify-between gap-3 transition-colors"
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="p-1.5 bg-white rounded-md border border-slate-200 text-indigo-600 flex-shrink-0">
                                    <Network className="h-3.5 w-3.5" />
                                  </div>
                                  <span className="text-sm font-bold text-indigo-900 truncate" title={fullDomain}>
                                    {sub.subdomain}
                                  </span>
                                </div>
                                <Badge className={`font-bold text-[9px] uppercase tracking-wider ${
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

                              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
                                <div className="space-y-0.5">
                                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Ingress / External IP</span>
                                  <span className="font-medium text-slate-800">{sub.externalIp || "Auto Ingress VIP"}</span>
                                </div>
                                <div className="space-y-0.5">
                                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Target Service</span>
                                  <span className="font-medium text-slate-800">
                                    {sub.serviceName || "Namespace Root"}:{sub.targetPort || 443}
                                  </span>
                                </div>
                              </div>

                              {sub.purpose && (
                                <p className="text-xs text-slate-500 bg-white p-2 rounded-lg border border-slate-100">
                                  <strong className="text-slate-700">Purpose:</strong> {sub.purpose}
                                </p>
                              )}

                              {sub.status === "REJECTED" && sub.rejectionReason && (
                                <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-100 font-medium">
                                  <strong>Reason:</strong> {sub.rejectionReason}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-[11px] text-slate-400">
                              <span>Requested by {sub.requestedBy?.name || "You"}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteSubdomain(sub.id)}
                                disabled={deletingSubdomainId === sub.id}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-2 text-xs font-semibold"
                              >
                                {deletingSubdomainId === sub.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3 w-3 mr-1" />
                                )}
                                Remove
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                      <Globe className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-xs font-semibold text-slate-600">No Subdomain Routes Configured</p>
                      <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5">
                        Add subdomain routes targeting your Ingress IP and namespace backend services. Requests are reviewed directly by Approver 1.
                      </p>
                    </div>
                  )}
                </div>

                {/* 2. Clusters & Node Groups */}
                {ns.clusters?.map((cluster: any) => (
                  <div key={cluster.id} className="space-y-6">
                    {cluster.nodeGroups?.map((group: any) => (
                      <div key={group.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="bg-slate-50 px-6 py-4 flex items-center justify-between border-b border-slate-150">
                          <div className="flex items-center gap-2">
                            <Badge className={
                              group.role === "MASTER" 
                                ? "bg-amber-100 text-amber-700 border-none font-black text-[10px]"
                                : "bg-blue-100 text-blue-700 border-none font-black text-[10px]"
                            }>
                              {group.role}
                            </Badge>
                            <span className="text-sm font-bold text-slate-700">
                              Node Group — {group.vcpu} vCPU, {group.ramGb}GB RAM ({group.nodes?.length || group.nodeCount || 0} Nodes)
                            </span>
                          </div>

                          <Button 
                            size="sm"
                            onClick={() => handleAddNode(group.id)}
                            disabled={isAddingNode === group.id}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 h-8 rounded-lg"
                          >
                            {isAddingNode === group.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Plus className="h-3.5 w-3.5" />
                            )}
                            Scale Node
                          </Button>
                        </div>

                        {/* Nodes List */}
                        <div className="divide-y divide-slate-100">
                          {group.nodes?.map((node: any) => (
                            <div key={node.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div className="space-y-1">
                                <p className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                                  {node.name}
                                  <Badge className="bg-slate-100 text-slate-700 font-medium text-[9px] uppercase tracking-wider py-0 px-1.5">
                                    {node.ipAddress}
                                  </Badge>
                                </p>
                                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
                                  <span className="flex items-center gap-1">
                                    <Globe className="h-3.5 w-3.5 text-slate-400" />
                                    External IP: <strong className="text-slate-700">{node.externalIp || "Not Configured"}</strong>
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Globe className="h-3.5 w-3.5 text-slate-400" />
                                    Subdomain: <strong className="text-slate-700">
                                      {node.subdomain 
                                        ? (node.subdomain.endsWith(".dghs.gov.bd") ? node.subdomain : `${node.subdomain}.dghs.gov.bd`) 
                                        : "Not Configured"}
                                    </strong>
                                  </span>
                                  {node.subdomain && (
                                    <span className="flex items-center gap-1.5">
                                      <div className={`h-1.5 w-1.5 rounded-full ${
                                        node.subdomainStatus === "ACTIVE" ? "bg-green-500" :
                                        node.subdomainStatus === "REJECTED" ? "bg-red-500" : "bg-amber-500"
                                      }`} />
                                      Status: <strong className={
                                        node.subdomainStatus === "ACTIVE" ? "text-green-600" :
                                        node.subdomainStatus === "REJECTED" ? "text-red-600" : "text-amber-600"
                                      }>{node.subdomainStatus}</strong>
                                    </span>
                                  )}
                                </div>
                              </div>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingNode({
                                  id: node.id,
                                  name: node.name,
                                  externalIp: node.externalIp || "",
                                  subdomain: node.subdomain || ""
                                })}
                                className="border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 h-8 gap-1.5 rounded-lg flex items-center"
                              >
                                <Settings2 className="h-3.5 w-3.5" />
                                Configure Node IP
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}

      {/* New Ingress Subdomain Request Modal */}
      {requestSubdomainNamespace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-indigo-600 px-6 py-4 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Request Subdomain Route
                </h3>
                <p className="text-xs text-indigo-100 mt-0.5">
                  Namespace: <strong>{requestSubdomainNamespace.name}</strong>
                </p>
              </div>
              <button 
                onClick={() => setRequestSubdomainNamespace(null)} 
                className="text-indigo-200 hover:text-white font-bold text-xl leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmitSubdomainRequest} className="p-6 space-y-4">
              {/* Subdomain Input */}
              <div className="space-y-1.5">
                <Label htmlFor="req-subdomain" className="text-xs font-bold text-slate-700 uppercase">
                  Subdomain Route <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="req-subdomain"
                  value={subdomainForm.subdomain}
                  onChange={(e) => setSubdomainForm({ ...subdomainForm, subdomain: e.target.value })}
                  placeholder="e.g. portal-api or dev.app.dghs.gov.bd"
                  required
                />
                <p className="text-[11px] text-slate-500 flex items-center gap-1">
                  Preview: <strong className="text-indigo-600 font-mono">
                    {subdomainForm.subdomain 
                      ? (subdomainForm.subdomain.includes(".") ? subdomainForm.subdomain : `${subdomainForm.subdomain}.dghs.gov.bd`) 
                      : "your-subdomain.dghs.gov.bd"}
                  </strong>
                </p>
              </div>

              {/* Ingress / External IP */}
              <div className="space-y-1.5">
                <Label htmlFor="req-ingress-ip" className="text-xs font-bold text-slate-700 uppercase">
                  Ingress / External Public IP Address
                </Label>
                <Input
                  id="req-ingress-ip"
                  value={subdomainForm.externalIp}
                  onChange={(e) => setSubdomainForm({ ...subdomainForm, externalIp: e.target.value })}
                  placeholder="e.g., 203.0.113.123 (Leave blank for auto Ingress VIP)"
                />
              </div>

              {/* Target Namespace Service & Port */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="req-service-name" className="text-xs font-bold text-slate-700 uppercase">
                    Backend Service Name
                  </Label>
                  <Input
                    id="req-service-name"
                    value={subdomainForm.serviceName}
                    onChange={(e) => setSubdomainForm({ ...subdomainForm, serviceName: e.target.value })}
                    placeholder="e.g., api-service or web-frontend"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="req-target-port" className="text-xs font-bold text-slate-700 uppercase">
                    Service Port
                  </Label>
                  <Input
                    id="req-target-port"
                    type="number"
                    value={subdomainForm.targetPort}
                    onChange={(e) => setSubdomainForm({ ...subdomainForm, targetPort: parseInt(e.target.value) || 443 })}
                    placeholder="443"
                  />
                </div>
              </div>

              {/* Purpose / Justification */}
              <div className="space-y-1.5">
                <Label htmlFor="req-purpose" className="text-xs font-bold text-slate-700 uppercase">
                  Routing Purpose / Justification
                </Label>
                <Input
                  id="req-purpose"
                  value={subdomainForm.purpose}
                  onChange={(e) => setSubdomainForm({ ...subdomainForm, purpose: e.target.value })}
                  placeholder="e.g., Public API gateway for health surveillance module"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>
                  This subdomain routing request will be sent directly to <strong>Approver 1</strong> for validation and immediate activation.
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setRequestSubdomainNamespace(null)} 
                  disabled={isSubmittingSubdomain}
                  className="text-slate-600 font-bold text-xs"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmittingSubdomain} 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 shadow-sm shadow-indigo-100"
                >
                  {isSubmittingSubdomain ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Subdomain Request"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Legacy Node Editing Modal */}
      {editingNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="relative z-10 w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden border border-slate-100">
            <div className="bg-indigo-50/20 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Configure Network Routing</h3>
                <p className="text-xs text-slate-500 mt-0.5">{editingNode.name}</p>
              </div>
              <button onClick={() => setEditingNode(null)} className="text-slate-400 hover:text-slate-600 font-semibold text-lg">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="externalIp" className="text-xs font-bold text-slate-600 uppercase">External Public IP Address</Label>
                <Input
                  id="externalIp"
                  value={editingNode.externalIp}
                  onChange={(e) => setEditingNode({ ...editingNode, externalIp: e.target.value })}
                  placeholder="e.g., 203.0.113.123"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="subdomain" className="text-xs font-bold text-slate-600 uppercase">Legacy Node Subdomain</Label>
                <Input
                  id="subdomain"
                  value={editingNode.subdomain}
                  onChange={(e) => setEditingNode({ ...editingNode, subdomain: e.target.value.toLowerCase() })}
                  placeholder="e.g., portal-dev.dghs.gov.bd"
                />
              </div>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100">
              <Button variant="ghost" onClick={() => setEditingNode(null)} disabled={isSavingNode} className="text-slate-500 font-bold text-xs h-9">
                Cancel
              </Button>
              <Button onClick={handleSaveNodeConfig} disabled={isSavingNode} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-5">
                {isSavingNode ? "Saving..." : "Save Configuration"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
