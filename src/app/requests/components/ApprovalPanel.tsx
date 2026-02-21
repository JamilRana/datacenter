// src/app/requests/components/ApprovalPanel.tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { handleApprovalDecision, forwardToDirector } from "@/app/actions/approval-actions";
import { Approval } from "@/types/approvals";

export function ApprovalPanel({
  approvals,
  currentStatus,
  currentUserId,
}: {
  approvals: Approval[];
  currentStatus: string;
  currentUserId: string;
}) {
  const [comments, setComments] = useState("");
  const [forwardComments, setForwardComments] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForwardDialog, setShowForwardDialog] = useState(false);

  // ✅ DETERMINE CURRENT APPROVAL LEVEL BASED ON STATUS
const currentLevel = 
  currentStatus === "PENDING_L1" ? 1 :
  currentStatus === "PENDING_L2" ? 2 :
  currentStatus === "PENDING_L3" ? 3 :
  currentStatus === "PENDING_L4" ? 3 : // Escalated state still looks at L3 record
  null;

  // ✅ FIND ACTIVE APPROVAL ASSIGNED TO CURRENT USER
  const activeApproval = approvals.find(
    a => 
      a.level === currentLevel && 
      a.approverId === currentUserId && 
      a.decision === "PENDING"
  );

  const canAct = !!activeApproval;

  const processAction = async (decision: "APPROVED" | "REJECTED" | "RETURNED") => {
    if (!activeApproval || !activeApproval.id) {
      toast.error("No valid approval record found. Please refresh the page.");
      return;
    }
    
    setLoading(true);
    try {
      const result = await handleApprovalDecision(
        activeApproval.id,
        decision,
        comments
      );
      
      if (result) {
        toast.success(`Request ${decision.toLowerCase()} successfully`);
        window.location.reload();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Approval failed";
      
      // ✅ GRACEFUL RACE CONDITION HANDLING
      if (
        errorMessage.includes("already processed") || 
        errorMessage.includes("disappeared") || 
        errorMessage.includes("not found") ||
        errorMessage.includes("Approval record not found")
      ) {
        toast.warning("⚠️ This request was already processed by another approver. Page will refresh...");
        setTimeout(() => window.location.reload(), 2000);
      } else if (errorMessage.includes("You can only act on approvals assigned to you")) {
        toast.warning("⚠️ This request is no longer assigned to you. Page will refresh...");
        setTimeout(() => window.location.reload(), 2000);
      } else {
        toast.error(`Approval failed: ${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForwardToDirector = async () => {
    if (!activeApproval || !forwardComments.trim()) return;
    
    setLoading(true);
    try {
      const result = await forwardToDirector(
        activeApproval.requestId!, 
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

  return (
    <div className="space-y-6 mt-8">
      <div className="border rounded-lg bg-slate-50 p-6 shadow-sm">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          Approval Workflow
        </h2>
        
        {/* Timeline of Approvals */}
        <div className="space-y-4">
          {approvals.map((app) => (
            <div
              key={app.id}
              className="flex justify-between items-center border-b border-slate-200 pb-3 last:border-0"
            >
              <div className="flex flex-col">
                <span className="font-semibold text-sm">
                  {app.approver?.name || "Unknown Approver"}
                </span>
                <span className="text-xs text-slate-500 uppercase tracking-wider">
                  Level {app.level} Approver
                </span>
              </div>
              <div className="flex items-center gap-4">
                {app.comments && (
                  <span className="text-xs italic text-slate-500 hidden md:block max-w-[200px] truncate">
                    {app.comments}
                  </span>
                )}
                <Badge
                  variant={
                    app.decision === "APPROVED"
                      ? "default"
                      : app.decision === "REJECTED"
                      ? "destructive"
                      : "secondary"
                  }
                  className="min-w-[80px] text-center"
                >
                  {app.decision.replace(/_/g, " ").toLowerCase()}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        {/* Director escalation button (L3 only) */}
        {currentStatus === "PENDING_L3" && activeApproval && (
          <div className="mt-6 pt-6 border-t-2 border-dashed border-amber-200">
            <Button
              variant="secondary"
              onClick={() => setShowForwardDialog(true)}
              disabled={loading}
              className="w-full bg-amber-50 text-amber-800 hover:bg-amber-100"
            >
              <ArrowUp className="w-4 h-4 mr-2" /> Forward to Director for Final Approval
            </Button>
          </div>
        )}

        {/* Non-actionable state message */}
        {!canAct && currentLevel && (
          <div className="mt-6 pt-6 border-t-2 border-dashed border-slate-300 bg-slate-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-slate-600">
              <AlertCircle className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <p className="text-sm">
                {currentStatus === "PENDING_L4"
                  ? "This request has been escalated to the Director for final approval. Only the Director can take action."
                  : `This request is currently with Level ${currentLevel} approval. You will be notified when it reaches your level.`}
              </p>
            </div>
          </div>
        )}

        {/* Action area for current approver */}
        {canAct && currentStatus !== "PENDING_L4" && (
          <div className="mt-6 pt-6 border-t-2 border-dashed border-blue-200">
            <h3 className="text-sm font-bold text-blue-800 mb-3 uppercase tracking-tight">
              Your Action Required (Level {currentLevel})
            </h3>
            <Textarea
              placeholder="Add comments explaining your decision..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="mb-4 min-h-[80px] bg-white border-slate-300"
            />
            <div className="flex gap-3">
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => processAction("REJECTED")}
                disabled={loading || !comments.trim()}
              >
                Reject
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-amber-600 text-amber-700 hover:bg-amber-50"
                onClick={() => processAction("RETURNED")}
                disabled={loading || !comments.trim()}
              >
                Request Changes
              </Button>
              <Button
                className="flex-1 bg-green-700 hover:bg-green-800"
                onClick={() => processAction("APPROVED")}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Approve Level {currentLevel}
              </Button>
            </div>
          </div>
        )}

        {/* Director action area */}
        {currentStatus === "PENDING_L4" && canAct && (
          <div className="mt-6 pt-6 border-t-2 border-dashed border-purple-200 bg-purple-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-3 w-3 rounded-full bg-purple-500" />
              <h3 className="text-sm font-bold text-purple-800 uppercase tracking-tight">
                Director Final Approval Required
              </h3>
            </div>
            <p className="text-sm text-purple-700 mb-4">
              This request was escalated by the L3 approver. Your decision is final and cannot be reversed.
            </p>
            <Textarea
              placeholder="Director's final decision comments (required)..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="mb-4 min-h-[80px] bg-white border-purple-300"
              required
            />
            <div className="flex gap-3">
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => processAction("REJECTED")}
                disabled={loading || !comments.trim()}
              >
                Reject (Final)
              </Button>
              <Button
                className="flex-1 bg-purple-700 hover:bg-purple-800"
                onClick={() => processAction("APPROVED")}
                disabled={loading || !comments.trim()}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Approve (Final)
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Terminal states */}
      {currentStatus === "APPROVED" && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-md text-green-800 text-center font-medium">
          ✅ The request has been fully approved and is now in the provisioning queue.
        </div>
      )}
      {currentStatus === "REJECTED" && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800 text-center font-medium">
          ❌ This request has been rejected. Contact the requester to discuss changes.
        </div>
      )}
      {/* --- ADD THIS DIALOG SECTION --- */}
{showForwardDialog && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
      <div className="flex items-center gap-3 mb-4 text-amber-700">
        <ArrowUp className="h-6 w-6" />
        <h3 className="text-xl font-bold">Escalate to Director</h3>
      </div>
      
      <p className="text-sm text-slate-600 mb-4">
        Please provide a justification for escalating this request. The Director will perform the final review.
      </p>

      <Textarea
        placeholder="Reason for escalation..."
        value={forwardComments}
        onChange={(e) => setForwardComments(e.target.value)} // Uses setForwardComments
        className="mb-6 min-h-[120px]"
        autoFocus
      />

      <div className="flex gap-3">
        <Button 
          variant="ghost" 
          className="flex-1" 
          onClick={() => setShowForwardDialog(false)} // Uses setShowForwardDialog
          disabled={loading}
        >
          Cancel
        </Button>
        <Button 
          className="flex-1 bg-amber-600 hover:bg-amber-700"
          onClick={handleForwardToDirector} // Uses handleForwardToDirector
          disabled={loading || !forwardComments.trim()}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Confirm Escalation
        </Button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}