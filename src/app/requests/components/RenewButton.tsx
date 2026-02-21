// src/app/requests/components/RenewButton.tsx
"use client";

import { Button } from "@/components/ui/button";
import { renewVmRequest } from "@/app/actions/vm-actions";
import { toast } from "sonner";

export function RenewButton({ vmId }: { vmId: string }) {

  const handleRenew = async () => {
    try {
      await renewVmRequest(vmId);
      toast.success("Renewal request submitted successfully.");
    } catch (err) {
      toast.error(`Failed to submit renewal request: ${err}`);
    }
  };

  return (
    <Button size="sm" variant="secondary" onClick={handleRenew} className="flex-1 text-center text-sm bg-green-50 text-green-700 py-1 rounded-lg hover:bg-green-100">
      Renew 
    </Button>
  );
}
