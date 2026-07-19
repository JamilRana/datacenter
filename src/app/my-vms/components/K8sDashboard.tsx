"use client";

import { useState, useEffect, startTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Activity, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  Info,
  Server
} from "lucide-react";
import { toast } from "sonner";
import { getUserK8sNamespaces, addK8sNode, updateK8sNodeIpAndSubdomain } from "@/app/actions/k8s-actions";

export function K8sDashboard() {
  const [namespaces, setNamespaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedNamespace, setExpandedNamespace] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<{
    id: string;
    name: string;
    externalIp: string;
    subdomain: string;
  } | null>(null);
  const [isSavingNode, setIsSavingNode] = useState(false);
  const [isAddingNode, setIsAddingNode] = useState<string | null>(null); // NodeGroupId

  const fetchNamespaces = async () => {
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
  };

  useEffect(() => {
    fetchNamespaces();
  }, []);

  const handleAddNode = async (nodeGroupId: string) => {
    setIsAddingNode(nodeGroupId);
    try {
      const res = await addK8sNode(nodeGroupId);
      if (res.success) {
        toast.success(res.message);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (namespaces.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
        <Code className="h-12 w-12 mx-auto mb-4 text-slate-300" />
        <h3 className="text-lg font-medium text-slate-900">No Kubernetes Namespaces</h3>
        <p className="text-slate-500 max-w-sm mx-auto mt-1">
          You don&apos;t have any active Kubernetes namespace allocations. Requests can be submitted via the Requests tab.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {namespaces.map((ns) => {
        const isExpanded = expandedNamespace === ns.id;
        const totalVcpu = ns.clusters.reduce((sum: number, c: any) => 
          sum + c.nodeGroups.reduce((s: number, g: any) => s + (g.vcpu * g.nodeCount), 0), 0
        );
        const totalRam = ns.clusters.reduce((sum: number, c: any) => 
          sum + c.nodeGroups.reduce((s: number, g: any) => s + (g.ramGb * g.nodeCount), 0), 0
        );
        const totalNodes = ns.clusters.reduce((sum: number, c: any) => 
          sum + c.nodeGroups.reduce((s: number, g: any) => s + g.nodes.length, 0), 0
        );

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
                {ns.clusters.map((cluster: any) => (
                  <div key={cluster.id} className="space-y-6">
                    {cluster.nodeGroups.map((group: any) => (
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
                              Node Group — {group.vcpu} vCPU, {group.ramGb}GB RAM ({group.nodes.length} Nodes)
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
                          {group.nodes.map((node: any) => (
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
                                    Subdomain: <strong className="text-slate-700">{node.subdomain || "Not Configured"}</strong>
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
                                Configure IP & Subdomain
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

      {/* Node Editing Modal */}
      {editingNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditingNode(null)} />
          <div className="relative z-10 w-full max-w-md bg-white rounded-xl shadow-xl m-4 overflow-hidden border border-slate-100">
            <div className="bg-indigo-50/20 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Configure Network Routing</h3>
                <p className="text-xs text-slate-500 mt-0.5">{editingNode.name}</p>
              </div>
              <button onClick={() => setEditingNode(null)} className="text-slate-400 hover:text-slate-655 font-semibold text-lg">×</button>
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
                <Label htmlFor="subdomain" className="text-xs font-bold text-slate-600 uppercase">Subdomain Routing</Label>
                <Input
                  id="subdomain"
                  value={editingNode.subdomain}
                  onChange={(e) => setEditingNode({ ...editingNode, subdomain: e.target.value.toLowerCase() })}
                  placeholder="e.g., portal-dev.dghs.gov.bd"
                />
                <p className="text-[10px] text-amber-600 flex items-center gap-1 mt-1 font-semibold">
                  <Info className="h-3 w-3 flex-shrink-0" />
                  Newly assigned subdomains will start in PENDING state requiring approver approval.
                </p>
              </div>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100">
              <Button variant="ghost" onClick={() => setEditingNode(null)} disabled={isSavingNode} className="text-slate-500 font-bold text-xs h-9">
                Cancel
              </Button>
              <Button onClick={handleSaveNodeConfig} disabled={isSavingNode} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-5">
                {isSavingNode ? "Saving..." : "Save Route Configuration"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
