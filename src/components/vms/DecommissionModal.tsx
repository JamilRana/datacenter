// src/app/components/vms/DecommissionModal.tsx
"use client";

// import { decommissionVm } from "@/app/actions/vm-actions";
import { useSession } from "next-auth/react"; // or your auth method
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

interface DecommissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  vmId: string;
}

export default function DecommissionModal({
  isOpen,
  onClose,
  vmId,
}: DecommissionModalProps) {
  const { data: session } = useSession(); // Adjust based on your auth
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [isDecommissioning, setIsDecommissioning] = useState(false);

  const handleDecommission = async () => {
    if (!session?.user?.id) {
      alert("You must be logged in to decommission a VM.");
      return;
    }

    setIsDecommissioning(true);
    try {
      // Import this from vm-actions
      const { createDecommissionRequest } = await import("@/app/actions/vm-actions");
      await createDecommissionRequest(vmId, session.user.id, reason);
      onClose();
      toast.success("Decommission request submitted for approval");
      router.push("/requests");
    } catch (error) {
      console.error("Failed to submit decommission request:", error);
      toast.error("Failed to submit decommission request.");
    } finally {
      setIsDecommissioning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
        <h3 className="font-semibold text-lg">Decommission VM?</h3>
        <p className="text-gray-600 mt-2">
          This will retire the VM and close any pending customization requests.
        </p>

        <textarea
          placeholder="Optional reason..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full border rounded px-3 py-2 mt-3"
          rows={2}
        />

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleDecommission}
            disabled={isDecommissioning}
            className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {isDecommissioning ? "Decommissioning..." : "Confirm Decommission"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
