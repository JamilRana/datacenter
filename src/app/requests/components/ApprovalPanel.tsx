// src/app/requests/components/ApprovalPanel.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { handleApproval } from "@/app/actions/approval-actions";

export function ApprovalPanel({
  requestId,
  approvals,
  currentStatus,
  currentUserId,
}: {
  requestId: string;
  approvals: any[];
  currentStatus: string;
  currentUserId: string;
}) {
  const [comments, setComments] = useState("");
  const [loading, setLoading] = useState(false);

  // Identify which level is currently active based on the Request status
  const currentLevelNeeded =
    currentStatus === "PENDING_L1"
      ? "L1"
      : currentStatus === "PENDING_L2"
      ? "L2"
      : currentStatus === "PENDING_L3"
      ? "L3"
      : null;

  // Find if the logged-in user is the one assigned to the current active level
  const activeApprovalRecord = approvals.find(
    (a) =>
      a.level === currentLevelNeeded &&
      a.approverId === currentUserId &&
      a.decision === "PENDING"
  );

  const processAction = async (decision: "APPROVED" | "REJECTED" | "RETURNED") => {
    if (!activeApprovalRecord) return;
    setLoading(true);
    try {
      const result = await handleApproval(
        activeApprovalRecord.id,
        decision,
        comments
      );
      if (result.success) {
        toast.success(`Request ${decision.toLowerCase().replace('_', ' ')} successfully`);
        // Force a refresh to update the timeline and status badges
        window.location.reload();
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
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
                  {app.approver.name}
                </span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">
                  Level {app.level} Approver
                </span>
              </div>
              <div className="flex items-center gap-4">
                {app.comments && (
                  <span className="text-xs italic text-slate-500 hidden md:block">
                    "{app.comments}"
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
                >
                  {app.decision}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        {/* Interaction Area for the Approver */}
        {activeApprovalRecord && (
          <div className="mt-6 pt-6 border-t-2 border-dashed border-blue-200">
            <h3 className="text-sm font-bold text-blue-800 mb-3 uppercase tracking-tight">
              Your Action Required
            </h3>
            <Textarea
              placeholder="Add internal comments or reasons for decision..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="mb-4 bg-white"
            />
            <div className="flex gap-3">
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => processAction("REJECTED")}
                disabled={loading}
              >
                Reject
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-amber-600 text-amber-700 hover:bg-amber-50"
                onClick={() => processAction("RETURNED")}
                disabled={loading}
              >
                Request Changes
              </Button>
              <Button
                className="flex-1 bg-green-700 hover:bg-green-800"
                onClick={() => processAction("APPROVED")}
                disabled={loading}
              >
                Approve
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Terminal States */}
      {currentStatus === "APPROVED" && (
        <div className="p-4 bg-green-100 border border-green-200 rounded-md text-green-800 text-center font-medium">
          The request has been fully approved and is now in the provisioning
          queue.
        </div>
      )}
    </div>
  );
}
