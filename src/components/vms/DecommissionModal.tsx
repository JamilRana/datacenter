// src/components/vms/DecommissionModal.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createDecommissionRequest } from "@/app/actions/decommission-actions";

interface DecommissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  vmId: string;
  hostname?: string;
  onSuccess?: () => void;
}

export default function DecommissionModal({
  isOpen,
  onClose,
  vmId,
  hostname,
  onSuccess,
}: DecommissionModalProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error("Reason is required");
      return;
    }
    if (reason.trim().length < 20) {
      toast.error("Reason must be at least 20 characters");
      return;
    }

    setIsSubmitting(true);
    try {
      const decommissionFormData = new FormData();
      decommissionFormData.append("targetVmId", vmId);
      decommissionFormData.append("reason", reason.trim());
      decommissionFormData.append("status", "PENDING_L1");
      
      await createDecommissionRequest(decommissionFormData);
      
      toast.success("Decommission request submitted successfully");
      onClose();
      onSuccess?.();
      router.push("/requests");
    } catch (error) {
      toast.error("Failed to submit decommission request");
      console.error("Decommission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Decommission Virtual Machine</DialogTitle>
          <DialogDescription>
            This will initiate the decommissioning process for{" "}
            <span className="font-bold">{hostname || "this VM"}</span>.
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <p className="text-sm font-medium text-red-800 flex items-start gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Warning: All data on this VM will be permanently deleted after approval.
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-sm font-medium">
              Reason for Decommission <span className="text-red-500">*</span>
            </Label>
            <Textarea 
              id="reason" 
              placeholder="Required: Explain why this VM is being decommissioned (minimum 20 characters)..." 
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="resize-none"
              minLength={20}
            />
            <p className="text-xs text-slate-500">
              Provide a clear business justification (min 20 characters).
            </p>
          </div>
        </div>
        
        <div className="flex justify-end gap-3 pt-2">
          <Button 
            variant="outline" 
            onClick={() => {
              setReason("");
              onClose();
            }}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button 
            variant="destructive"
            onClick={handleSubmit}
            disabled={isSubmitting || reason.trim().length < 20}
            className="bg-red-600 hover:bg-red-700"
          >
            {isSubmitting ? "Submitting..." : "Submit Decommission Request"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
