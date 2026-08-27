/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription 
} from "@/components/ui/dialog";
import { 
  ArrowUp, 
  Loader2, 
  SlidersHorizontal, 
  RotateCcw, 
  Check, 
  X, 
  AlertTriangle,
  Server,
  Layers,
  Cpu,
  MemoryStick,
  HardDrive
} from "lucide-react";
import { toast } from "sonner";
import { 
  handleApprovalDecision, 
  forwardToLevel,
  modifyAndApproveRequest 
} from "@/app/actions/approval-actions";
import { Approval } from "@/types/approvals";
import { useSession } from "next-auth/react";

export interface ApprovalResourceItem {
  id: string;
  vm?: { hostname: string; ipAddress?: string | null } | null;
  namespace?: { name: string } | null;
}

export interface ApprovalPanelProps {
  approvals: Approval[];
  requestType?: string;
  requestId?: string;
  initialVcpu?: number | null;
  initialRamGb?: number | null;
  initialStorageGb?: number | null;
  initialQuantity?: number | null;
  requestResources?: ApprovalResourceItem[];
}

export function ApprovalPanel({
  approvals,
  requestType,
  requestId,
  initialVcpu,
  initialRamGb,
  initialStorageGb,
  initialQuantity,
  requestResources = [],
}: ApprovalPanelProps) {
  const [comments, setComments] = useState("");
  const [forwardComments, setForwardComments] = useState("");
  const [returnComments, setReturnComments] = useState("");
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);

  // In-flight modification state
  const [modVcpu, setModVcpu] = useState<number>(initialVcpu || 2);
  const [modRamGb, setModRamGb] = useState<number>(initialRamGb || 4);
  const [modStorageGb, setModStorageGb] = useState<number>(initialStorageGb || 50);
  const [modQuantity, setModQuantity] = useState<number>(initialQuantity || 1);
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>(
    requestResources.map(r => r.id)
  );
  const [adjustComments, setAdjustComments] = useState("");

  const currentUserId = session?.user?.id;
  const userRoles = session?.user?.roles || [];
  const isAdmin = userRoles.includes("ADMIN");
  
  // Find pending approval with lowest level
  const pendingApproval = approvals
    .filter(a => a.decision === "PENDING")
    .sort((a, b) => a.level - b.level)[0] || null;

  const pendingLevel = pendingApproval?.level || null;

  // Role authorization
  const isAuthorized = Boolean(
    pendingApproval && (
      pendingApproval.approverId === currentUserId ||
      isAdmin ||
      (pendingLevel === 1 && (userRoles.includes("APPROVER_L1") || userRoles.includes("L1_APPROVER"))) ||
      (pendingLevel === 2 && (userRoles.includes("APPROVER_L2") || userRoles.includes("L2_APPROVER"))) ||
      (pendingLevel === 3 && (userRoles.includes("APPROVER_L3") || userRoles.includes("L3_APPROVER"))) ||
      (pendingLevel === 4 && (userRoles.includes("APPROVER_L4") || userRoles.includes("L4_APPROVER") || userRoles.includes("DC_OPS")))
    )
  );

  const activeApproval = isAuthorized ? pendingApproval : null;
  const currentLevel = activeApproval?.level || null;
  const isDirectorLevel = currentLevel === 4;

  const processAction = async (
    decision: "APPROVED" | "REJECTED" | "RETURNED",
    customComment?: string,
    escalateToLevel?: number
  ) => {
    if (!activeApproval || !activeApproval.id) {
      toast.error("No valid approval record found. Please refresh the page.");
      return;
    }
    
    setLoading(true);
    try {
      const decisionComments = customComment !== undefined ? customComment : comments;
      const result = await handleApprovalDecision(
        activeApproval.id,
        decision,
        decisionComments,
        escalateToLevel
      );
      
      if (result) {
        toast.success(
          escalateToLevel 
            ? `Request escalated to Level ${escalateToLevel} successfully`
            : `Request ${decision.toLowerCase()} successfully`
        );
        window.location.reload();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Approval failed";
      if (errorMessage.includes("already processed") || errorMessage.includes("not found")) {
        toast.warning("⚠️ This request was already processed. Page will refresh...");
        setTimeout(() => window.location.reload(), 2000);
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForwardToDirector = async () => {
    if (!activeApproval || !forwardComments.trim()) return;
    
    setLoading(true);
    try {
      const targetLevel = (activeApproval.level || 0) + 1;
      const result = await forwardToLevel(
        activeApproval.id, 
        targetLevel,
        forwardComments.trim()
      );
      
      if (result.success) {
        toast.success("Request forwarded to director for final approval");
        window.location.reload();
      }
    } catch (error) {
      toast.error((error as Error).message || "Failed to forward to director");
    } finally {
      setLoading(false);
      setShowForwardDialog(false);
    }
  };

  const handleReturnSubmit = async () => {
    if (!returnComments.trim()) {
      toast.error("Please provide reason for returning request");
      return;
    }
    setShowReturnDialog(false);
    await processAction("RETURNED", returnComments.trim());
  };

  const handleAdjustAndApprove = async () => {
    if (!activeApproval || !requestId) {
      toast.error("Missing approval context");
      return;
    }

    const removedIds = requestResources
      .filter(r => !selectedResourceIds.includes(r.id))
      .map(r => r.id);

    setLoading(true);
    try {
      const result = await modifyAndApproveRequest({
        approvalId: activeApproval.id,
        requestId,
        comments: adjustComments.trim(),
        modifications: {
          vcpu: modVcpu,
          ramGb: modRamGb,
          storageGb: modStorageGb,
          quantity: modQuantity,
          resourceIdsToRemove: removedIds,
        }
      });

      if (result.success) {
        toast.success("Request modified and approved successfully!");
        setShowAdjustDialog(false);
        window.location.reload();
      } else {
        toast.error(result.error || "Failed to modify and approve request");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Adjustment failed");
    } finally {
      setLoading(false);
    }
  };

  const toggleResourceSelection = (id: string) => {
    setSelectedResourceIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  if (!activeApproval) return null;

  const isAccessRequest = requestType === "VPN_ACCESS" || requestType === "HORIZON_ACCESS";
  const isVmRequest = requestType === "NEW_VM" || requestType === "CLONE_VM" || requestType === "UPGRADE";

  return (
    <div className="space-y-6 mt-8">
      <div className="border rounded-xl bg-slate-50 dark:bg-slate-900/50 p-6 shadow-sm border-indigo-100 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Review & Decision Panel
            </h2>
            <p className="text-xs text-slate-500">
              Authority Level {currentLevel} • {requestType?.replace(/_/g, " ")}
            </p>
          </div>

          {/* Quick in-flight adjust button */}
          {requestId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAdjustDialog(true)}
              className="text-xs border-indigo-200 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" /> Adjust & Approve
            </Button>
          )}
        </div>
        
        {/* FORWARD BUTTON (L3 ONLY) */}
        {currentLevel === 3 && requestType !== "DECOMMISSION" && (
          <div className="mb-4 pb-4 border-b border-dashed border-amber-200 dark:border-amber-900">
            <Button
              variant="secondary"
              onClick={() => setShowForwardDialog(true)}
              disabled={loading}
              className="w-full bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-200 text-xs"
            >
              <ArrowUp className="w-4 h-4 mr-2" /> Forward to Director (Level 4)
            </Button>
          </div>
        )}

        {/* NORMAL ACTIONS */}
        {!isDirectorLevel && (
          <div className="space-y-4">
            <Textarea
              placeholder="Add review notes or instructions for the requester/DC-Ops..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="bg-white dark:bg-slate-900 text-xs min-h-[80px]"
            />
            <div className="flex flex-wrap gap-2.5">
              <Button 
                type="button"
                variant="destructive" 
                className="flex-1 text-xs h-9" 
                onClick={() => processAction("REJECTED")} 
                disabled={loading || !comments.trim()}
              >
                <X className="w-3.5 h-3.5 mr-1" /> Reject
              </Button>

              <Button 
                type="button"
                variant="outline" 
                className="flex-1 text-xs h-9 border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-300"
                onClick={() => setShowReturnDialog(true)} 
                disabled={loading}
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Return for Revision
              </Button>

              <Button 
                type="button"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9" 
                onClick={() => processAction("APPROVED")} 
                disabled={loading}
              >
                <Check className="w-3.5 h-3.5 mr-1" /> Approve
              </Button>
            </div>
          </div>
        )}

        {/* DIRECTOR ACTIONS */}
        {isDirectorLevel && (
          <div className="bg-purple-50/70 dark:bg-purple-950/30 p-4 rounded-lg border border-purple-200 dark:border-purple-900 space-y-3">
            <Textarea
              placeholder="Director final decision comments (required)..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="bg-white dark:bg-slate-900 border-purple-200 text-xs"
            />
            <div className="flex gap-2">
              <Button 
                type="button"
                variant="outline"
                className="border-orange-300 text-orange-700 text-xs flex-1"
                onClick={() => setShowReturnDialog(true)}
                disabled={loading}
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Return for Revision
              </Button>
              <Button 
                type="button"
                className="flex-1 bg-purple-700 hover:bg-purple-800 text-white text-xs" 
                onClick={() => processAction("APPROVED")} 
                disabled={loading || !comments.trim()}
              >
                <Check className="w-3.5 h-3.5 mr-1" /> Final Approval
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 1. FORWARDING DIALOG */}
      <Dialog open={showForwardDialog} onOpenChange={setShowForwardDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Forward to Director</DialogTitle>
            <DialogDescription>
              Explain why this request requires high-level Director intervention.
            </DialogDescription>
          </DialogHeader>
          <Textarea 
            placeholder="Reason for escalation..." 
            value={forwardComments}
            onChange={(e) => setForwardComments(e.target.value)}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowForwardDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleForwardToDirector} 
              disabled={loading || !forwardComments.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-xs"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Forward
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. RETURN FOR REVISION DIALOG */}
      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <RotateCcw className="h-5 w-5" /> Return Request to Requester
            </DialogTitle>
            <DialogDescription>
              Specify what modifications or additional documents the requester must provide before resubmitting.
            </DialogDescription>
          </DialogHeader>
          <Textarea 
            placeholder="Explain required amendments (e.g. upload updated security report, specify project justification, reduce RAM)..." 
            value={returnComments}
            onChange={(e) => setReturnComments(e.target.value)}
            className="min-h-[100px] text-xs"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowReturnDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleReturnSubmit} 
              disabled={loading || !returnComments.trim()}
              className="bg-orange-600 hover:bg-orange-700 text-white text-xs"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Return to Requester
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. IN-FLIGHT ADJUST & APPROVE DIALOG */}
      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
              <SlidersHorizontal className="h-5 w-5" /> In-Flight Request Adjustment & Approval
            </DialogTitle>
            <DialogDescription>
              Adjust resource allocations or prune specific VMs before approving. Changes will be audited and logged to the requester.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-3 text-xs">
            {/* VM Spec Modifiers */}
            {(isVmRequest || requestType === "K8S_NAMESPACE" || !isAccessRequest) && (
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-4">
                <p className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                  Resource Sizing
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-[11px] text-slate-500">vCPU Cores</Label>
                    <Input 
                      type="number" 
                      min={1} 
                      max={128} 
                      value={modVcpu} 
                      onChange={(e) => setModVcpu(parseInt(e.target.value) || 1)}
                      className="h-8 mt-1 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-slate-500">RAM (GB)</Label>
                    <Input 
                      type="number" 
                      min={1} 
                      max={1024} 
                      value={modRamGb} 
                      onChange={(e) => setModRamGb(parseInt(e.target.value) || 1)}
                      className="h-8 mt-1 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-slate-500">Disk (GB)</Label>
                    <Input 
                      type="number" 
                      min={10} 
                      max={10000} 
                      value={modStorageGb} 
                      onChange={(e) => setModStorageGb(parseInt(e.target.value) || 10)}
                      className="h-8 mt-1 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-slate-500">VM Quantity</Label>
                    <Input 
                      type="number" 
                      min={1} 
                      max={20} 
                      value={modQuantity} 
                      onChange={(e) => setModQuantity(parseInt(e.target.value) || 1)}
                      className="h-8 mt-1 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Access Resources Pruning (Horizon / VPN) */}
            {requestResources.length > 0 && (
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                <div className="flex justify-between items-center">
                  <p className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                    Assigned Resource Permissions ({selectedResourceIds.length}/{requestResources.length} Approved)
                  </p>
                  <span className="text-[10px] text-slate-500">Uncheck to prune specific VMs</span>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {requestResources.map((res) => {
                    const isChecked = selectedResourceIds.includes(res.id);
                    const label = res.vm?.hostname || res.namespace?.name || "Resource";
                    const ip = res.vm?.ipAddress;

                    return (
                      <div 
                        key={res.id} 
                        className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                          isChecked 
                            ? "bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-900/60" 
                            : "bg-slate-100/70 dark:bg-slate-800/40 border-slate-200 opacity-60 line-through"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Checkbox 
                            id={`res-${res.id}`} 
                            checked={isChecked} 
                            onCheckedChange={() => toggleResourceSelection(res.id)} 
                          />
                          <Label htmlFor={`res-${res.id}`} className="cursor-pointer text-xs font-medium">
                            {label} {ip && <span className="text-slate-400 font-mono">({ip})</span>}
                          </Label>
                        </div>
                        <span className={`text-[10px] font-bold ${isChecked ? "text-emerald-600" : "text-rose-500"}`}>
                          {isChecked ? "Keep" : "Pruned"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Approver Notes */}
            <div>
              <Label className="text-[11px] text-slate-600 dark:text-slate-400">
                Approver Modification Note
              </Label>
              <Textarea 
                placeholder="Reason for adjustment (e.g. 'Reduced RAM to 32GB based on capacity assessment; removed staging VM from VPN access')"
                value={adjustComments}
                onChange={(e) => setAdjustComments(e.target.value)}
                className="mt-1 text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAdjustDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleAdjustAndApprove} 
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes & Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}