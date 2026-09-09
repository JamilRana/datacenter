"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  Network,
  Search
} from "lucide-react";
import { toast } from "sonner";
import {
  getUserK8sNamespaces,
  submitK8sResourceCustomization,
  requestK8sSubdomain,
  deleteK8sSubdomain
} from "@/app/actions/k8s-actions";
import { Pagination } from "@/components/Pagination";

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

  // Robust expand/collapse state
  const [expandedNamespaceIds, setExpandedNamespaceIds] = useState<string[]>([]);
  const hasInitializedExpansion = useRef(false);

  // Pagination & Search state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(5);
  const [searchTerm, setSearchTerm] = useState("");

  // Resource Customization Modal State
  const [customizationTarget, setCustomizationTarget] = useState<{
    namespace: any;
    nodeGroup?: any;
    targetNode?: any;
  } | null>(null);
  const [customizationForm, setCustomizationForm] = useState<{
    targetNodeGroupId: string | null;
    targetNodeId: string | null;
    targetNodeName: string | null;
    role: "WORKER" | "MASTER";
    nodeCount: number | "";
    vcpu: number | "";
    ramGb: number | "";
    storageGb: number | "";
    purpose: string;
  }>({
    targetNodeGroupId: null,
    targetNodeId: null,
    targetNodeName: null,
    role: "WORKER",
    nodeCount: 1,
    vcpu: 2,
    ramGb: 4,
    storageGb: 50,
    purpose: ""
  });
  const [isSubmittingCustomization, setIsSubmittingCustomization] = useState(false);

  // New Subdomain Request Modal
  const [requestSubdomainNamespace, setRequestSubdomainNamespace] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [subdomainForm, setSubdomainForm] = useState<{
    subdomain: string;
    externalIp: string;
    serviceName: string;
    targetPort: number | "";
    purpose: string;
  }>({
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
        if (res.namespaces.length > 0 && !hasInitializedExpansion.current) {
          setExpandedNamespaceIds([res.namespaces[0].id]);
          hasInitializedExpansion.current = true;
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load namespaces");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialNamespaces) {
      setNamespaces(initialNamespaces);
      if (initialNamespaces.length > 0 && !hasInitializedExpansion.current) {
        setExpandedNamespaceIds([initialNamespaces[0].id]);
        hasInitializedExpansion.current = true;
      }
    } else {
      fetchNamespaces();
    }
  }, [initialNamespaces, fetchNamespaces]);

  useEffect(() => {
    if (initialLoading !== undefined) {
      setLoading(initialLoading);
    }
  }, [initialLoading]);

  const toggleExpand = (id: string) => {
    setExpandedNamespaceIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleNumberInputChange = (
    field: "nodeCount" | "vcpu" | "ramGb" | "storageGb",
    val: string
  ) => {
    if (val === "") {
      setCustomizationForm((prev) => ({ ...prev, [field]: "" }));
      return;
    }
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed)) {
      setCustomizationForm((prev) => ({ ...prev, [field]: parsed }));
    }
  };

  const handleNumberInputBlur = (
    field: "nodeCount" | "vcpu" | "ramGb" | "storageGb",
    minVal: number,
    maxVal?: number
  ) => {
    setCustomizationForm((prev) => {
      const current = prev[field];
      let val = typeof current === "number" ? current : minVal;
      if (val < minVal) val = minVal;
      if (maxVal !== undefined && val > maxVal) val = maxVal;
      return { ...prev, [field]: val };
    });
  };

  const handleOpenCustomizationModal = (namespace: any, nodeGroup?: any, targetNode?: any) => {
    const availableGroups = namespace.clusters?.flatMap((c: any) => c.nodeGroups || []) || [];
    const targetGroup = nodeGroup || (availableGroups.length > 0 ? availableGroups[0] : null);

    setCustomizationTarget({ namespace, nodeGroup: targetGroup, targetNode });
    if (targetNode) {
      setCustomizationForm({
        targetNodeGroupId: targetGroup?.id || null,
        targetNodeId: targetNode.id,
        targetNodeName: targetNode.name,
        role: targetGroup?.role === "MASTER" ? "MASTER" : "WORKER",
        nodeCount: targetGroup?.nodes?.length || targetGroup?.nodeCount || 1,
        vcpu: targetGroup?.vcpu || 2,
        ramGb: targetGroup?.ramGb || 4,
        storageGb: 50,
        purpose: `Resource customization request for existing node ${targetNode.name}`
      });
    } else if (targetGroup) {
      setCustomizationForm({
        targetNodeGroupId: targetGroup.id,
        targetNodeId: null,
        targetNodeName: null,
        role: targetGroup.role === "MASTER" ? "MASTER" : "WORKER",
        nodeCount: targetGroup.nodes?.length || targetGroup.nodeCount || 1,
        vcpu: targetGroup.vcpu || 2,
        ramGb: targetGroup.ramGb || 4,
        storageGb: 50,
        purpose: ""
      });
    } else {
      setCustomizationForm({
        targetNodeGroupId: null,
        targetNodeId: null,
        targetNodeName: null,
        role: "WORKER",
        nodeCount: 1,
        vcpu: 2,
        ramGb: 4,
        storageGb: 50,
        purpose: ""
      });
    }
  };

  const handleSelectCustomizationTargetGroup = (targetId: string) => {
    if (!customizationTarget) return;
    if (targetId === "NEW") {
      setCustomizationTarget((prev) => prev ? { ...prev, nodeGroup: null, targetNode: null } : null);
      setCustomizationForm((prev) => ({
        ...prev,
        targetNodeGroupId: null,
        targetNodeId: null,
        targetNodeName: null,
        role: "WORKER",
        nodeCount: 1,
        vcpu: 2,
        ramGb: 4,
        storageGb: 50,
      }));
    } else {
      const availableGroups = customizationTarget.namespace.clusters?.flatMap((c: any) => c.nodeGroups || []) || [];
      const found = availableGroups.find((g: any) => g.id === targetId);
      if (found) {
        setCustomizationTarget((prev) => prev ? { ...prev, nodeGroup: found, targetNode: null } : null);
        setCustomizationForm((prev) => ({
          ...prev,
          targetNodeGroupId: found.id,
          targetNodeId: null,
          targetNodeName: null,
          role: found.role === "MASTER" ? "MASTER" : "WORKER",
          nodeCount: found.nodes?.length || found.nodeCount || 1,
          vcpu: found.vcpu || 2,
          ramGb: found.ramGb || 4,
          storageGb: 50,
        }));
      }
    }
  };

  const handleSubmitCustomization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customizationTarget) return;

    if (!customizationForm.purpose.trim()) {
      toast.error("Please provide a justification / purpose for this resource customization request.");
      return;
    }

    const nodeCount = Math.max(1, typeof customizationForm.nodeCount === "number" ? customizationForm.nodeCount : 1);
    const vcpu = Math.max(1, typeof customizationForm.vcpu === "number" ? customizationForm.vcpu : 1);
    const ramGb = Math.max(1, typeof customizationForm.ramGb === "number" ? customizationForm.ramGb : 1);
    const storageGb = Math.max(10, typeof customizationForm.storageGb === "number" ? customizationForm.storageGb : 10);

    setIsSubmittingCustomization(true);
    try {
      const res = await submitK8sResourceCustomization({
        namespaceId: customizationTarget.namespace.id,
        role: customizationForm.role,
        nodeCount,
        vcpu,
        ramGb,
        storageGb,
        purpose: customizationForm.purpose.trim(),
        targetNodeGroupId: customizationForm.targetNodeGroupId || null,
        targetNodeId: customizationForm.targetNodeId || null,
        targetNodeName: customizationForm.targetNodeName || null,
      });

      if (res.success) {
        toast.success(res.message);
        setCustomizationTarget(null);
        if (onRefresh) onRefresh();
        await fetchNamespaces();
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit resource customization request");
    } finally {
      setIsSubmittingCustomization(false);
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

  // Pagination & Search filtering
  const filteredNamespaces = namespaces.filter((ns) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      ns.name?.toLowerCase().includes(term) ||
      ns.supervisorIp?.toLowerCase().includes(term) ||
      ns.clusters?.some((c: any) => c.clusterName?.toLowerCase().includes(term))
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredNamespaces.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * pageSize;
  const paginatedNamespaces = filteredNamespaces.slice(startIndex, startIndex + pageSize);

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

      {/* Search & Pagination Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-1">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <Input
            placeholder="Search namespaces or supervisor IPs..."
            className="pl-9 h-9 border-slate-200 focus-visible:ring-indigo-500 shadow-xs bg-white text-xs"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 font-medium self-end sm:self-center">
          {filteredNamespaces.length > 0 ? (
            <span>
              Showing <strong className="text-slate-800">{startIndex + 1}</strong> -{" "}
              <strong className="text-slate-800">{Math.min(startIndex + pageSize, filteredNamespaces.length)}</strong> of{" "}
              <strong className="text-slate-800">{filteredNamespaces.length}</strong> Namespaces
            </span>
          ) : (
            <span>No matching namespaces</span>
          )}
          {filteredNamespaces.length > 0 && (
            <div className="flex items-center gap-1 ml-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px] text-slate-500 hover:text-slate-800"
                onClick={() => setExpandedNamespaceIds(filteredNamespaces.map((n: any) => n.id))}
              >
                Expand All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px] text-slate-500 hover:text-slate-800"
                onClick={() => setExpandedNamespaceIds([])}
              >
                Collapse All
              </Button>
            </div>
          )}
        </div>
      </div>

      {filteredNamespaces.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200 shadow-xs p-6">
          <Code className="h-10 w-10 mx-auto mb-3 text-slate-300" />
          <h4 className="text-sm font-bold text-slate-800">No Namespaces Match Your Search</h4>
          <p className="text-xs text-slate-500 mt-1">
            Try adjusting your search keywords to find your namespace.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSearchTerm("")}
            className="mt-3 text-xs"
          >
            Clear Search Filter
          </Button>
        </div>
      ) : (
        paginatedNamespaces.map((ns) => {
          const isExpanded = expandedNamespaceIds.includes(ns.id);
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
                onClick={() => toggleExpand(ns.id)}
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

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenCustomizationModal(ns);
                          }}
                          className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold text-xs h-8 gap-1.5 rounded-lg flex items-center shadow-2xs"
                        >
                          <Settings2 className="h-3.5 w-3.5 text-indigo-600" />
                          Request Resource Customization
                        </Button>
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
                                  <Badge className={`font-bold text-[9px] uppercase tracking-wider ${sub.status === "ACTIVE"
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
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenCustomizationModal(ns, group);
                              }}
                              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-semibold text-xs flex items-center gap-1.5 h-8 rounded-lg shadow-2xs"
                            >
                              <Settings2 className="h-3.5 w-3.5 text-indigo-600" />
                              Customize Resources
                            </Button>
                          </div>

                          {/* Nodes List */}
                          <div className="divide-y divide-slate-100">
                            {group.nodes?.map((node: any) => (
                              <div key={node.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                                <div className="space-y-1.5">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-bold text-slate-900 text-sm">
                                      {node.name}
                                    </p>
                                    <Badge className="bg-slate-100 text-slate-700 font-medium text-[10px] font-mono py-0 px-2">
                                      {node.ipAddress || "Auto IP"}
                                    </Badge>

                                    {/* Existing Node Resources */}
                                    <div className="flex items-center gap-1.5 ml-1">
                                      <Badge variant="outline" className="bg-indigo-50 border-indigo-200 text-indigo-700 text-[11px] font-semibold px-2 py-0.5 flex items-center gap-1">
                                        <Cpu className="h-3 w-3 text-indigo-600" />
                                        {group.vcpu} vCPU
                                      </Badge>
                                      <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700 text-[11px] font-semibold px-2 py-0.5 flex items-center gap-1">
                                        <HardDrive className="h-3 w-3 text-emerald-600" />
                                        {group.ramGb} GB RAM
                                      </Badge>
                                      {cluster.totalSpaceGb && (
                                        <Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-600 text-[11px] font-semibold px-2 py-0.5 flex items-center gap-1">
                                          <Server className="h-3 w-3 text-slate-500" />
                                          {cluster.totalSpaceGb} GB Storage
                                        </Badge>
                                      )}
                                    </div>
                                  </div>

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
                                        <div className={`h-1.5 w-1.5 rounded-full ${node.subdomainStatus === "ACTIVE" ? "bg-green-500" :
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
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenCustomizationModal(ns, group, node);
                                  }}
                                  className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-semibold text-xs flex items-center gap-1.5 h-8 rounded-lg shadow-2xs shrink-0 self-start md:self-center"
                                >
                                  <Settings2 className="h-3.5 w-3.5 text-indigo-600" />
                                  Customize Resources
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
        })
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200">
          <div className="text-xs text-slate-500 font-medium">
            Page <strong className="text-slate-800">{activePage}</strong> of{" "}
            <strong className="text-slate-800">{totalPages}</strong>
          </div>
          <Pagination
            currentPage={activePage}
            totalPages={totalPages}
            onPageChange={(p) => {
              setCurrentPage(p);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </div>
      )}

      {/* K8s Resource Customization Modal */}
      {customizationTarget && (() => {
        const availableGroups = customizationTarget.namespace.clusters?.flatMap((c: any) => c.nodeGroups || []) || [];
        const isModifyingExisting = Boolean(customizationForm.targetNodeGroupId && customizationTarget.nodeGroup);
        const currentGroup = customizationTarget.nodeGroup;
        const targetNode = customizationTarget.targetNode;
        const currentNodes = currentGroup?.nodes?.length || currentGroup?.nodeCount || 0;
        const currentVcpu = currentGroup?.vcpu || 0;
        const currentRam = currentGroup?.ramGb || 0;

        const reqNodes = typeof customizationForm.nodeCount === "number" ? customizationForm.nodeCount : 0;
        const reqVcpu = typeof customizationForm.vcpu === "number" ? customizationForm.vcpu : 0;
        const reqRam = typeof customizationForm.ramGb === "number" ? customizationForm.ramGb : 0;

        const nodeDelta = isModifyingExisting ? reqNodes - currentNodes : reqNodes;
        const vcpuDelta = isModifyingExisting ? reqVcpu - currentVcpu : reqVcpu;
        const ramDelta = isModifyingExisting ? reqRam - currentRam : reqRam;

        const currentTotalCpu = currentNodes * currentVcpu;
        const reqTotalCpu = reqNodes * reqVcpu;
        const totalCpuDelta = isModifyingExisting ? reqTotalCpu - currentTotalCpu : reqTotalCpu;

        const currentTotalRam = currentNodes * currentRam;
        const reqTotalRam = reqNodes * reqRam;
        const totalRamDelta = isModifyingExisting ? reqTotalRam - currentTotalRam : reqTotalRam;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="relative z-10 w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="bg-indigo-600 px-6 py-4 text-white flex justify-between items-center shrink-0">
                <div>
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <Settings2 className="h-5 w-5 text-indigo-200" />
                    {targetNode ? "Kubernetes Node Resource Customization" : "Kubernetes Resource Customization & Scaling"}
                  </h3>
                  <p className="text-xs text-indigo-100 mt-0.5">
                    Namespace: <strong className="text-white font-mono">{customizationTarget.namespace.name}</strong>
                    {targetNode ? (
                      <> • Target Node: <strong className="text-white font-mono">{targetNode.name}</strong> ({currentGroup?.role || "WORKER"} Group)</>
                    ) : (
                      isModifyingExisting && ` • Modifying ${currentGroup?.role} Group (${currentNodes} Nodes)`
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setCustomizationTarget(null)}
                  className="text-white/80 hover:text-white font-bold text-xl leading-none"
                >
                  ×
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSubmitCustomization} className="p-6 space-y-4 overflow-y-auto">
                {/* Target Node Banner or Group Selector */}
                {targetNode ? (
                  <div className="p-3.5 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4 text-indigo-600 shrink-0" />
                        <span className="text-xs font-bold text-slate-900 font-mono">{targetNode.name}</span>
                        <Badge variant="outline" className="text-[10px] bg-white text-slate-700 font-mono">
                          {targetNode.ipAddress || "Auto IP"}
                        </Badge>
                        <Badge className={
                          currentGroup?.role === "MASTER"
                            ? "bg-amber-100 text-amber-800 text-[10px]"
                            : "bg-blue-100 text-blue-800 text-[10px]"
                        }>
                          {currentGroup?.role || "WORKER"} Node
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Current Node Allocation: <strong className="text-indigo-700">{currentVcpu} vCPU</strong>, <strong className="text-emerald-700">{currentRam} GB RAM</strong>
                      </p>
                    </div>
                    <Badge className="bg-indigo-600 text-white text-[10px] uppercase tracking-wider">
                      Single Node
                    </Badge>
                  </div>
                ) : (
                  availableGroups.length > 0 && (
                    <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <Label htmlFor="custom-target-group" className="text-xs font-bold text-slate-700 uppercase flex items-center justify-between">
                        <span>Customization Target</span>
                        <Badge className={isModifyingExisting ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-indigo-100 text-indigo-800 border-indigo-200"}>
                          {isModifyingExisting ? "Scaling Existing Group" : "Adding New Node Group"}
                        </Badge>
                      </Label>
                      <select
                        id="custom-target-group"
                        value={customizationForm.targetNodeGroupId || "NEW"}
                        onChange={(e) => handleSelectCustomizationTargetGroup(e.target.value)}
                        className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {availableGroups.map((g: any) => {
                          const count = g.nodes?.length || g.nodeCount || 1;
                          return (
                            <option key={g.id} value={g.id}>
                              Scale Existing: {g.role} Node Group ({count} {count === 1 ? "Node" : "Nodes"} • {g.vcpu} vCPU • {g.ramGb} GB RAM)
                            </option>
                          );
                        })}
                        <option value="NEW">+ Add New Node Group to Namespace</option>
                      </select>
                      <p className="text-[11px] text-slate-500">
                        {isModifyingExisting
                          ? "Select more or fewer nodes and configure CPU/RAM. Workloads on this group will be adjusted in-place."
                          : "Creates an additional node group in this namespace's cluster."}
                      </p>
                    </div>
                  )
                )}

                {/* Role and Node Count */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="custom-role" className="text-xs font-bold text-slate-700 uppercase">
                      Node Role
                    </Label>
                    <select
                      id="custom-role"
                      value={customizationForm.role}
                      onChange={(e) => setCustomizationForm({ ...customizationForm, role: e.target.value as "WORKER" | "MASTER" })}
                      className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      disabled={isModifyingExisting || Boolean(targetNode)}
                    >
                      <option value="WORKER">WORKER (Application Workloads)</option>
                      <option value="MASTER">MASTER (Control Plane Nodes)</option>
                    </select>
                  </div>

                  {targetNode ? (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 uppercase">
                        Target Node
                      </Label>
                      <div className="h-10 px-3 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-between text-xs font-semibold text-slate-800">
                        <span className="font-mono truncate">{targetNode.name}</span>
                        <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded">1 Node</span>
                      </div>
                      <p className="text-[10px] text-slate-400">Customizing resources for this specific node</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="custom-count" className="text-xs font-bold text-slate-700 uppercase">
                          Node Count
                        </Label>
                        {isModifyingExisting && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${nodeDelta > 0
                              ? "bg-emerald-100 text-emerald-800"
                              : nodeDelta < 0
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-slate-600"
                            }`}>
                            {nodeDelta > 0 ? `+${nodeDelta} Scale Up` : nodeDelta < 0 ? `${nodeDelta} Scale Down` : "Unchanged"}
                          </span>
                        )}
                      </div>
                      <Input
                        id="custom-count"
                        type="number"
                        min={1}
                        max={20}
                        value={customizationForm.nodeCount}
                        onChange={(e) => handleNumberInputChange("nodeCount", e.target.value)}
                        onBlur={() => handleNumberInputBlur("nodeCount", 1, 20)}
                        className="h-10 text-xs"
                        required
                      />
                      {isModifyingExisting && (
                        <p className="text-[10px] text-slate-500">
                          Current: <strong>{currentNodes} Nodes</strong> → Requested: <strong>{reqNodes} Nodes</strong>
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Specs: vCPU, RAM, Storage */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="custom-vcpu" className="text-xs font-bold text-slate-700 uppercase">
                        vCPU / Node
                      </Label>
                      {isModifyingExisting && vcpuDelta !== 0 && (
                        <span className={`text-[9px] font-bold ${vcpuDelta > 0 ? "text-emerald-700" : "text-amber-700"}`}>
                          {vcpuDelta > 0 ? `+${vcpuDelta}` : vcpuDelta}
                        </span>
                      )}
                    </div>
                    <Input
                      id="custom-vcpu"
                      type="number"
                      min={1}
                      max={64}
                      value={customizationForm.vcpu}
                      onChange={(e) => handleNumberInputChange("vcpu", e.target.value)}
                      onBlur={() => handleNumberInputBlur("vcpu", 1, 64)}
                      className="h-10 text-xs"
                      required
                    />
                    {isModifyingExisting && (
                      <p className="text-[10px] text-slate-400">Current: {currentVcpu} vCPU</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="custom-ram" className="text-xs font-bold text-slate-700 uppercase">
                        RAM (GB) / Node
                      </Label>
                      {isModifyingExisting && ramDelta !== 0 && (
                        <span className={`text-[9px] font-bold ${ramDelta > 0 ? "text-emerald-700" : "text-amber-700"}`}>
                          {ramDelta > 0 ? `+${ramDelta} GB` : `${ramDelta} GB`}
                        </span>
                      )}
                    </div>
                    <Input
                      id="custom-ram"
                      type="number"
                      min={1}
                      max={256}
                      value={customizationForm.ramGb}
                      onChange={(e) => handleNumberInputChange("ramGb", e.target.value)}
                      onBlur={() => handleNumberInputBlur("ramGb", 1, 256)}
                      className="h-10 text-xs"
                      required
                    />
                    {isModifyingExisting && (
                      <p className="text-[10px] text-slate-400">Current: {currentRam} GB</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="custom-storage" className="text-xs font-bold text-slate-700 uppercase">
                      Storage / Node
                    </Label>
                    <Input
                      id="custom-storage"
                      type="number"
                      min={10}
                      max={2000}
                      value={customizationForm.storageGb}
                      onChange={(e) => handleNumberInputChange("storageGb", e.target.value)}
                      onBlur={() => handleNumberInputBlur("storageGb", 10, 2000)}
                      className="h-10 text-xs"
                      required
                    />
                    <p className="text-[10px] text-slate-400">Min 10 GB</p>
                  </div>
                </div>

                {/* Resource Impact & Comparison Box */}
                <div className="p-3.5 bg-indigo-50/70 rounded-xl border border-indigo-100 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                      {targetNode
                        ? "Node Customization Impact"
                        : isModifyingExisting
                          ? "Customization & Scaling Comparison"
                          : "Requested Node Group Footprint"}
                    </span>
                    {(targetNode || isModifyingExisting) && (
                      <span className="text-[10px] font-bold text-indigo-600">
                        {targetNode ? "Target Node Specs" : "In-Place Node Group Scaling"}
                      </span>
                    )}
                  </div>

                  {targetNode ? (
                    <div className="space-y-1.5 pt-1 text-slate-700">
                      <div className="grid grid-cols-3 gap-2 bg-white/70 p-2 rounded-lg border border-indigo-50 text-[11px]">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Target Node</span>
                          <span className="font-bold text-slate-800 font-mono truncate block">{targetNode.name}</span>
                          <span className="text-[10px] text-slate-500">{currentGroup?.role}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Node vCPU</span>
                          <span className="font-bold text-slate-800">{currentVcpu}</span>
                          <span className="mx-1 text-slate-400">→</span>
                          <span className="font-bold text-indigo-700">{reqVcpu} Cores</span>
                          {vcpuDelta !== 0 && (
                            <span className={`block text-[10px] font-bold ${vcpuDelta > 0 ? "text-emerald-600" : "text-amber-600"}`}>
                              {vcpuDelta > 0 ? `(+${vcpuDelta} Cores)` : `(${vcpuDelta} Cores)`}
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Node RAM</span>
                          <span className="font-bold text-slate-800">{currentRam}</span>
                          <span className="mx-1 text-slate-400">→</span>
                          <span className="font-bold text-indigo-700">{reqRam} GB</span>
                          {ramDelta !== 0 && (
                            <span className={`block text-[10px] font-bold ${ramDelta > 0 ? "text-emerald-600" : "text-amber-600"}`}>
                              {ramDelta > 0 ? `(+${ramDelta} GB)` : `(${ramDelta} GB)`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : isModifyingExisting ? (
                    <div className="space-y-1.5 pt-1 text-slate-700">
                      <div className="grid grid-cols-3 gap-2 bg-white/70 p-2 rounded-lg border border-indigo-50 text-[11px]">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Node Count</span>
                          <span className="font-bold text-slate-800">{currentNodes}</span>
                          <span className="mx-1 text-slate-400">→</span>
                          <span className="font-bold text-indigo-700">{reqNodes}</span>
                          {nodeDelta !== 0 && (
                            <span className={`block text-[10px] font-bold ${nodeDelta > 0 ? "text-emerald-600" : "text-amber-600"}`}>
                              {nodeDelta > 0 ? `(+${nodeDelta} Nodes)` : `(${nodeDelta} Nodes)`}
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Total vCPU</span>
                          <span className="font-bold text-slate-800">{currentTotalCpu}</span>
                          <span className="mx-1 text-slate-400">→</span>
                          <span className="font-bold text-indigo-700">{reqTotalCpu} Cores</span>
                          {totalCpuDelta !== 0 && (
                            <span className={`block text-[10px] font-bold ${totalCpuDelta > 0 ? "text-emerald-600" : "text-amber-600"}`}>
                              {totalCpuDelta > 0 ? `(+${totalCpuDelta} Cores)` : `(${totalCpuDelta} Cores)`}
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Total RAM</span>
                          <span className="font-bold text-slate-800">{currentTotalRam}</span>
                          <span className="mx-1 text-slate-400">→</span>
                          <span className="font-bold text-indigo-700">{reqTotalRam} GB</span>
                          {totalRamDelta !== 0 && (
                            <span className={`block text-[10px] font-bold ${totalRamDelta > 0 ? "text-emerald-600" : "text-amber-600"}`}>
                              {totalRamDelta > 0 ? `(+${totalRamDelta} GB)` : `(${totalRamDelta} GB)`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 text-slate-700 pt-1">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Total Nodes</span>
                        <strong className="text-indigo-900 font-bold">{reqNodes} Nodes</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Total vCPU</span>
                        <strong className="text-indigo-900 font-bold">{reqNodes * reqVcpu} Cores</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Total RAM</span>
                        <strong className="text-indigo-900 font-bold">{reqNodes * reqRam} GB</strong>
                      </div>
                    </div>
                  )}
                </div>

                {/* Justification / Purpose */}
                <div className="space-y-1.5">
                  <Label htmlFor="custom-purpose" className="text-xs font-bold text-slate-700 uppercase">
                    Justification / Purpose <span className="text-red-500">*</span>
                  </Label>
                  <textarea
                    id="custom-purpose"
                    rows={3}
                    value={customizationForm.purpose}
                    onChange={(e) => setCustomizationForm({ ...customizationForm, purpose: e.target.value })}
                    placeholder="Explain why this resource customization or scaling is required for this namespace..."
                    className="w-full p-2.5 rounded-lg border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                {/* Approvals Routing Info */}
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                  <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <span>
                    This resource customization request will be formally routed through the approval workflow (<strong>Assistant Maintenance Engineer → Maintenance Engineer → System Analyst → DC-Ops</strong>) before being provisioned to your cluster.
                  </span>
                </div>

                {/* Modal Actions */}
                <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setCustomizationTarget(null)}
                    disabled={isSubmittingCustomization}
                    className="text-slate-600 font-bold text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmittingCustomization || !customizationForm.purpose.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 shadow-sm shadow-indigo-100 flex items-center gap-1.5"
                  >
                    {isSubmittingCustomization ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Submitting Request...
                      </>
                    ) : (
                      isModifyingExisting ? "Submit Scaling Request" : "Submit Customization Request"
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

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
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") {
                        setSubdomainForm({ ...subdomainForm, targetPort: "" });
                      } else {
                        const p = parseInt(val, 10);
                        if (!isNaN(p)) setSubdomainForm({ ...subdomainForm, targetPort: p });
                      }
                    }}
                    onBlur={() => {
                      if (!subdomainForm.targetPort || Number(subdomainForm.targetPort) < 1) {
                        setSubdomainForm((prev) => ({ ...prev, targetPort: 443 }));
                      }
                    }}
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
    </div>
  );
}
