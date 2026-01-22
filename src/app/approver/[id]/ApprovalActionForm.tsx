// src/app/approver/[id]/ApprovalActionForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { handleApproval } from "@/app/actions/approval-actions";

export function ApprovalActionForm({
  approvalId,
  currentLevel,
  requestId,
}: {
  approvalId: string;
  currentLevel: "L1" | "L2" | "L3";
  requestId: string;
}) {
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED" | "RETURNED">("APPROVED");
  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await handleApproval(approvalId, decision, comments);
      router.push("/approver"); // or redirect to level-specific inbox
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to process approval");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="text-red-600">{error}</div>}

      <div>
        <label className="block font-medium mb-2">Action</label>
        <div className="flex space-x-4">
          <label className="inline-flex items-center">
            <input
              type="radio"
              name="decision"
              value="APPROVED"
              checked={decision === "APPROVED"}
              onChange={() => setDecision("APPROVED")}
              className="mr-2"
            />
            Approve → Forward to {currentLevel === "L1" ? "L2" : currentLevel === "L2" ? "L3" : "Deployer"}
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              name="decision"
              value="REJECTED"
              checked={decision === "REJECTED"}
              onChange={() => setDecision("REJECTED")}
              className="mr-2"
            />
            Reject (Closes request)
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              name="decision"
              value="RETURNED"
              checked={decision === "RETURNED"}
              onChange={() => setDecision("RETURNED")}
              className="mr-2"
            />
            Return for Changes (Back to Draft)
          </label>
        </div>
      </div>

      <div>
        <label className="block font-medium mb-2">
          Comments / Reason (Required for Reject/Return)
        </label>
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={3}
          className="w-full border rounded p-2"
          required={decision !== "APPROVED"}
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className={`px-4 py-2 rounded ${
            decision === "APPROVED"
              ? "bg-green-600 hover:bg-green-700 text-white"
              : decision === "REJECTED"
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-yellow-600 hover:bg-yellow-700 text-white"
          }`}
        >
          {isSubmitting ? "Processing..." : decision}
        </button>
        <a
          href={`/requests/${requestId}`}
          className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100"
        >
          View Full Request
        </a>
      </div>
    </form>
  );
}