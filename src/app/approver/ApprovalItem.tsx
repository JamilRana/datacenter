// Client Component for interactivity
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { handleApproval } from "@/app/actions/approval-actions";
import Link from "next/link";
import { format } from "date-fns";

export default function ApprovalItem({
  approval,
  levelTitle,
  isPending,
}: {
  approval: any;
  levelTitle: string;
  isPending: boolean;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [comment, setComment] = useState("");

  const handleQuickApprove = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await handleApproval(approval.id, "APPROVED");
      router.refresh();
    } catch (err: any) {
      alert(err.message || "Failed to approve");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecision = async (decision: "REJECTED" | "RETURNED") => {
    if (!comment.trim()) {
      alert("Please provide a reason.");
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await handleApproval(approval.id, decision, comment);
      setShowRejectModal(false);
      setShowReturnModal(false);
      setComment("");
      router.refresh();
    } catch (err: any) {
      alert(err.message || `Failed to ${decision.toLowerCase()}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusColor = 
    approval.decision === "APPROVED" ? "bg-green-100 text-green-800" :
    approval.decision === "REJECTED" ? "bg-red-100 text-red-800" :
    approval.decision === "RETURNED" ? "bg-yellow-100 text-yellow-800" :
    "bg-blue-100 text-blue-800";

  return (
    <div className="border rounded-xl p-5 hover:shadow-md transition-shadow">
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3">
        <div>
          <h3 className="font-semibold text-lg">
            <Link
              href={`/approver/${approval.id}`}
              className="text-blue-600 hover:underline"
            >
              {approval.request.systemName}
            </Link>
          </h3>
          <p className="text-gray-600">
            {approval.request.projectName} • {approval.request.environment}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Requested by: {approval.request.requester.name} •{" "}
            <span className="inline-block px-2 py-0.5 bg-gray-100 text-xs rounded">
              {levelTitle}
            </span>
          </p>
        </div>
        <div className="flex flex-col items-end text-right">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColor}`}>
            {approval.decision}
          </span>
          <span className="text-xs text-gray-500 mt-1">
            {format(approval.createdAt,"PP")}
          </span>
          <span className="text-xs text-gray-500">
            {approval.request.status}
          </span>
        </div>
      </div>

      {/* Action Buttons - Only for Pending */}
      {isPending && approval.decision === "PENDING" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={handleQuickApprove}
            disabled={isSubmitting}
            className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
          >
            Approve
          </button>
          <button
            onClick={() => setShowRejectModal(true)}
            disabled={isSubmitting}
            className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
          >
            Reject
          </button>
          <button
            onClick={() => setShowReturnModal(true)}
            disabled={isSubmitting}
            className="text-xs bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
          >
            Return for Changes
          </button>
          <Link
            href={`/approver/${approval.id}`}
            className="text-xs bg-gray-600 hover:bg-gray-700 text-white px-3 py-1.5 rounded-md transition-colors"
          >
            Review Details
          </Link>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <ActionModal
          title="Reject Request"
          comment={comment}
          setComment={setComment}
          onConfirm={() => handleDecision("REJECTED")}
          onCancel={() => setShowRejectModal(false)}
          isSubmitting={isSubmitting}
          placeholder="Reason for rejection (required)"
        />
      )}

      {/* Return Modal */}
      {showReturnModal && (
        <ActionModal
          title="Return for Changes"
          comment={comment}
          setComment={setComment}
          onConfirm={() => handleDecision("RETURNED")}
          onCancel={() => setShowReturnModal(false)}
          isSubmitting={isSubmitting}
          placeholder="What needs to be changed? (required)"
        />
      )}
    </div>
  );
}

function ActionModal({
  title,
  comment,
  setComment,
  onConfirm,
  onCancel,
  isSubmitting,
  placeholder,
}: {
  title: string;
  comment: string;
  setComment: (c: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
  placeholder: string;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md p-6">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={placeholder}
          className="w-full border rounded p-2 mb-4 h-24"
          required
        />
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!comment.trim() || isSubmitting}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            {isSubmitting ? "Processing..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}