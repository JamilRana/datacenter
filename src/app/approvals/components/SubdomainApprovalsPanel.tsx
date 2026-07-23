"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Globe, User, XCircle, CheckCircle2, Loader2, Inbox } from "lucide-react";
import { toast } from "sonner";
import { getPendingSubdomains, approveSubdomain } from "@/app/actions/k8s-actions";

export function SubdomainApprovalsPanel() {
  const [pendingNodes, setPendingNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const fetchPending = async () => {
    try {
      const res = await getPendingSubdomains();
      if (res.success && res.pendingNodes) {
        setPendingNodes(res.pendingNodes);
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

  const handleAction = async (nodeId: string, decision: "ACTIVE" | "REJECTED") => {
    setSubmittingId(nodeId);
    try {
      const res = await approveSubdomain(nodeId, decision);
      if (res.success) {
        toast.success(res.message);
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
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (pendingNodes.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
        <Inbox className="h-10 w-10 mx-auto mb-3 text-slate-300" />
        <h3 className="text-sm font-bold text-slate-800">All Subdomain Requests Processed</h3>
        <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
          There are no pending subdomain activations awaiting your review.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pendingNodes.map((node) => {
        const cluster = node.nodeGroup?.cluster;
        const namespace = cluster?.namespace;
        const request = cluster?.request;
        const requester = request?.requester;

        return (
          <Card key={node.id} className="border-slate-200 bg-white hover:border-indigo-100 transition-all shadow-sm">
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
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Project: <strong className="text-slate-600">{request?.projectName || "N/A"}</strong>
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
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 rounded-lg shadow-md shadow-indigo-100 flex items-center gap-1.5"
                  >
                    {submittingId === node.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Approve & Activate
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
