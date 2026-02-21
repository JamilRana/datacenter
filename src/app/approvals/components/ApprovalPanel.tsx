"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription 
} from "@/components/ui/dialog"; // Added Dialog components
import { ArrowUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { 
  handleApprovalDecision, 
  forwardToDirector 
} from "@/app/actions/approval-actions";
import { Approval } from "@/types/approvals";

export function ApprovalPanel({
  approvals,
  currentUserId,
}: {
  approvals: Approval[];
  currentUserId: string;
}) {
  const [comments, setComments] = useState("");
  const [forwardComments, setForwardComments] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForwardDialog, setShowForwardDialog] = useState(false);

  const currentLevel = approvals.find(a => 
    a.decision === "PENDING" && a.approverId === currentUserId
  )?.level || null;

  const activeApproval = approvals.find(
    a => a.level === currentLevel && a.approverId === currentUserId && a.decision === "PENDING"
  );

  const canAct = !!activeApproval;
  const isDirectorLevel = currentLevel === 4;

  const processAction = async (
    decision: "APPROVED" | "REJECTED" | "RETURNED",
    escalateToLevel?: number
  ) => {
    if (!activeApproval || !activeApproval.id) {
      toast.error("No valid approval record found. Please refresh the page.");
      return;
    }
    
    setLoading(true);
    try {
      const result = await handleApprovalDecision(
        activeApproval.id,
        decision,
        comments,
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
        
        <div className="space-y-4">
          {approvals.map((app) => (
            <div key={app.id} className="flex justify-between items-center border-b border-slate-200 pb-3 last:border-0">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    app.level === 4 ? "bg-purple-600 text-white" : "bg-blue-500 text-white"
                  }`}>
                    L{app.level}
                  </div>
                  <span className="font-semibold text-sm">{app.approver?.name || "Unknown"}</span>
                </div>
              </div>
              <Badge variant={app.decision === "APPROVED" ? "default" : "secondary"}>
                {app.decision.toLowerCase()}
              </Badge>
            </div>
          ))}
        </div>

        {/* FORWARD BUTTON (L3 ONLY) */}
        {currentLevel === 3 && activeApproval && (
          <div className="mt-6 pt-6 border-t-2 border-dashed border-amber-200">
            <Button
              variant="secondary"
              onClick={() => setShowForwardDialog(true)}
              disabled={loading}
              className="w-full bg-amber-50 text-amber-800 hover:bg-amber-100"
            >
              <ArrowUp className="w-4 h-4 mr-2" /> Forward to Director (Level 4)
            </Button>
          </div>
        )}

        {/* NORMAL ACTIONS */}
        {canAct && !isDirectorLevel && (
          <div className="mt-6 pt-6 border-t-2 border-dashed border-blue-200">
            <Textarea
              placeholder="Add comments..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="mb-4 bg-white"
            />
            <div className="flex gap-3">
              <Button variant="destructive" className="flex-1" onClick={() => processAction("REJECTED")} disabled={loading || !comments.trim()}>Reject</Button>
              <Button className="flex-1 bg-green-700" onClick={() => processAction("APPROVED")} disabled={loading}>Approve</Button>
            </div>
          </div>
        )}

        {/* DIRECTOR ACTIONS */}
        {isDirectorLevel && canAct && (
          <div className="mt-6 pt-6 border-t-2 border-dashed border-purple-200 bg-purple-50 p-4 rounded-lg">
             <Textarea
              placeholder="Director comments (required)..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="mb-4 bg-white border-purple-300"
            />
            <Button className="w-full bg-purple-700" onClick={() => processAction("APPROVED")} disabled={loading || !comments.trim()}>Final Approval</Button>
          </div>
        )}
      </div>

      {/* ✅ FORWARDING DIALOG - This resolves the remaining linter errors */}
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
              className="bg-amber-600 hover:bg-amber-700"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Forward
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}