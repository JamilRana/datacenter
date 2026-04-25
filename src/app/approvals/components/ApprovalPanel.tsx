/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  forwardToLevel 
} from "@/app/actions/approval-actions";
import { Approval } from "@/types/approvals";
import { useSession } from "next-auth/react";

export function ApprovalPanel({
  approvals,
  requestType,
}: {
  approvals: Approval[];
  requestType?: string;
}) {
  const [comments, setComments] = useState("");
  const [forwardComments, setForwardComments] = useState("");
  const {data:session} = useSession();
  const [loading, setLoading] = useState(false);
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const currentUserId = session?.user?.id;
  
  const currentLevel = approvals.find(a => 
    a.decision === "PENDING" && a.approverId === currentUserId
  )?.level || null;

  const activeApproval = approvals.find(
    a => a.level === currentLevel && a.approverId === currentUserId && a.decision === "PENDING"
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  if (!activeApproval) return null;

  return (
    <div className="space-y-6 mt-8">
      <div className="border rounded-lg bg-slate-50 p-6 shadow-sm border-blue-100">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
          Approval Actions
        </h2>
        
        {/* FORWARD BUTTON (L3 ONLY) - Disabled for Decommissions */}
        {currentLevel === 3 && requestType !== "DECOMMISSION" && (
          <div className="mb-6 pb-6 border-b-2 border-dashed border-amber-200">
            <Button
              variant="secondary"
              onClick={() => setShowForwardDialog(true)}
              disabled={loading}
              className="w-full bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-200"
            >
              <ArrowUp className="w-4 h-4 mr-2" /> Forward to Director (Level 4)
            </Button>
          </div>
        )}

        {/* NORMAL ACTIONS */}
        {!isDirectorLevel && (
          <div className="space-y-4">
            <Textarea
              placeholder="Add comments..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="bg-white"
            />
            <div className="flex gap-3">
              <Button variant="destructive" className="flex-1" onClick={() => processAction("REJECTED")} disabled={loading || !comments.trim()}>Reject</Button>
              <Button className="flex-1 bg-green-700 hover:bg-green-800" onClick={() => processAction("APPROVED")} disabled={loading}>Approve</Button>
            </div>
          </div>
        )}

        {/* DIRECTOR ACTIONS */}
        {isDirectorLevel && (
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
             <Textarea
              placeholder="Director comments (required)..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="mb-4 bg-white border-purple-200"
            />
            <Button className="w-full bg-purple-700 hover:bg-purple-800 text-white" onClick={() => processAction("APPROVED")} disabled={loading || !comments.trim()}>Final Approval</Button>
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