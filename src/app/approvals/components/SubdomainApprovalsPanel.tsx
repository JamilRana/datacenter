"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Globe, 
  User, 
  XCircle, 
  CheckCircle2, 
  Loader2, 
  Inbox, 
  Network,
  Info
} from "lucide-react";
import { toast } from "sonner";
import { getPendingSubdomains, approveSubdomain } from "@/app/actions/k8s-actions";

export function SubdomainApprovalsPanel() {
  const [pendingSubdomains, setPendingSubdomains] = useState<any[]>([]);
  const [pendingNodes, setPendingNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  
  // Rejection modal
  const [rejectingItem, setRejectingItem] = useState<{ id: string; subdomain: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const fetchPending = async () => {
    try {
      const res = await getPendingSubdomains();
      if (res.success) {
        setPendingSubdomains(res.pendingSubdomains || []);
        setPendingNodes(res.pendingNodes || []);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load pending subdomain requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleAction = async (id: string, decision: "ACTIVE" | "REJECTED", reason?: string) => {
    setSubmittingId(id);
    try {
      const res = await approveSubdomain(id, decision, reason);
      if (res.success) {
        toast.success(res.message);
        setRejectingItem(null);
        setRejectionReason("");
        await fetchPending();
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to process subdomain request");
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Subdomain Requests...</p>
      </div>
    );
  }

  const totalPending = pendingSubdomains.length + pendingNodes.length;

  if (totalPending === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-slate-200 shadow-sm p-8">
        <Inbox className="h-10 w-10 mx-auto mb-3 text-slate-300" />
        <h3 className="text-base font-bold text-slate-900">All Subdomain Requests Processed</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
          There are no pending Kubernetes namespace ingress subdomain requests awaiting Approver 1 action.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notice */}
      <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100 flex items-start gap-3">
        <Info className="h-5 w-5 text-indigo-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-900 space-y-0.5">
          <p className="font-bold">Approver 1 Direct Execution Authority</p>
          <p className="text-indigo-700">
            Subdomain and network routing requests for Kubernetes namespaces are directly executed by Approver 1 without multi-stage escalations. Approved routes are activated immediately.
          </p>
        </div>
      </div>

      {/* New K8sSubdomain Requests */}
      {pendingSubdomains.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Globe className="h-4 w-4 text-indigo-600" />
            Pending Namespace Subdomain Requests ({pendingSubdomains.length})
          </h3>

          {pendingSubdomains.map((item) => {
            const namespace = item.namespace;
            const requester = item.requestedBy;
            const fullDomain = item.subdomain.includes(".") ? item.subdomain : `${item.subdomain}.dghs.gov.bd`;

            return (
              <Card key={item.id} className="border-slate-200/90 bg-white hover:border-indigo-200 transition-all shadow-xs overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="space-y-3 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
                          <Network className="h-4 w-4" />
                        </div>
                        <span className="font-extrabold text-slate-900 text-base" title={fullDomain}>{item.subdomain}</span>
                        <Badge className="bg-indigo-50 text-indigo-700 border-indigo-150 font-bold text-[10px] uppercase tracking-wide">
                          Namespace: {namespace?.name || "N/A"}
                        </Badge>
                        <Badge className="bg-amber-50 text-amber-700 border-amber-200 font-bold text-[10px] uppercase tracking-wide">
                          Pending Approver 1
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 text-xs text-slate-600 bg-slate-50/50 p-3.5 rounded-xl border border-slate-100">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Ingress / External IP</span>
                          <span className="font-semibold text-slate-800">
                            {item.externalIp || "Auto Ingress VIP"}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Target Service</span>
                          <span className="font-semibold text-slate-800">
                            {item.serviceName || "Namespace Root"}:{item.targetPort || 443}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Requested By</span>
                          <span className="flex items-center gap-1 font-semibold text-slate-800">
                            <User className="h-3.5 w-3.5 text-slate-400" />
                            {requester?.name || "Requester"}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate">{requester?.email}</span>
                        </div>
                      </div>

                      {item.purpose && (
                        <p className="text-xs text-slate-600">
                          <strong className="text-slate-700">Justification:</strong> {item.purpose}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5 self-end lg:self-center flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRejectingItem({ id: item.id, subdomain: item.subdomain });
                          setRejectionReason("");
                        }}
                        disabled={submittingId === item.id}
                        className="text-red-700 hover:text-red-800 hover:bg-red-50 border-red-200 font-bold text-xs h-9 px-3.5 rounded-xl"
                      >
                        <XCircle className="h-4 w-4 mr-1.5" />
                        Reject
                      </Button>
                      <Button
                        onClick={() => handleAction(item.id, "ACTIVE")}
                        disabled={submittingId === item.id}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-xs shadow-indigo-100 flex items-center gap-1.5"
                      >
                        {submittingId === item.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Direct Approve & Activate
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Legacy Node Subdomain Requests */}
      {pendingNodes.length > 0 && (
        <div className="space-y-4 pt-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Legacy Node Subdomain Requests ({pendingNodes.length})
          </h3>

          {pendingNodes.map((node) => {
            const cluster = node.nodeGroup?.cluster;
            const namespace = cluster?.namespace;
            const request = cluster?.request;
            const requester = request?.requester;

            return (
              <Card key={node.id} className="border-slate-200 bg-white shadow-xs">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{node.name}</span>
                        <Badge className="bg-indigo-50 text-indigo-700 border-indigo-150 font-bold text-[9px] uppercase tracking-wide">
                          Namespace: {namespace?.name || "N/A"}
                        </Badge>
                        <Badge className="bg-slate-100 text-slate-700 font-medium text-[9px] uppercase tracking-wide">
                          IP: {node.ipAddress}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs text-slate-600">
                        <div className="space-y-1">
                          <span className="text-slate-400 font-medium block">Route Configurations</span>
                          <span className="flex items-center gap-1.5 font-bold text-slate-800">
                            <Globe className="h-4 w-4 text-indigo-500" />
                            {node.subdomain}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Targeting Public IP: <strong className="text-slate-600">{node.externalIp || "None"}</strong>
                          </span>
                        </div>

                        <div className="space-y-1">
                          <span className="text-slate-400 font-medium block">Requested By</span>
                          <span className="flex items-center gap-1.5 font-bold text-slate-800">
                            <User className="h-4 w-4 text-slate-400" />
                            {requester?.name || "System Request"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAction(node.id, "REJECTED")}
                        disabled={submittingId === node.id}
                        className="text-red-700 hover:text-red-800 hover:bg-red-50 font-bold text-xs h-9 rounded-lg"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                      <Button
                        onClick={() => handleAction(node.id, "ACTIVE")}
                        disabled={submittingId === node.id}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 rounded-lg"
                      >
                        {submittingId === node.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Direct Approve & Activate
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Rejection Modal */}
      {rejectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base text-red-900">Reject Subdomain Request</h3>
                <p className="text-xs text-red-700 mt-0.5">{rejectingItem.subdomain}</p>
              </div>
              <button 
                onClick={() => setRejectingItem(null)} 
                className="text-red-400 hover:text-red-600 font-bold text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="rejection-reason" className="text-xs font-bold text-slate-700 uppercase">
                  Reason for Rejection (Optional)
                </Label>
                <Input
                  id="rejection-reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Subdomain already reserved or invalid external IP"
                />
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100">
              <Button 
                variant="ghost" 
                onClick={() => setRejectingItem(null)} 
                disabled={submittingId === rejectingItem.id}
                className="text-slate-600 font-bold text-xs"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => handleAction(rejectingItem.id, "REJECTED", rejectionReason)} 
                disabled={submittingId === rejectingItem.id}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4"
              >
                {submittingId === rejectingItem.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 mr-1.5" />
                )}
                Confirm Rejection
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
