// src/app/requests/components/RenewButton.tsx
"use client";

import { Button } from "@/components/ui/button";
import { renewVmRequest } from "@/app/actions/vm-actions";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

export function RenewButton({ vmId }: { vmId: string }) {
  const { data: session } = useSession();

  const handleRenew = async () => {
    if (!session?.user?.id) return;
    try {
      await renewVmRequest(vmId, session.user.id);
      toast.success("Renewal request submitted successfully.");
    } catch (err) {
      toast.error("Failed to submit renewal request.");
    }
  };

  return (
    <Button size="sm" variant="secondary" onClick={handleRenew}>
      Renew
    </Button>
  );
}
