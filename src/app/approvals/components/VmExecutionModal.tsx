"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Server, Network, Globe } from "lucide-react";
import { toast } from "sonner";

interface VmExecutionInput {
  sequenceNumber: number;
  hostname: string;
  ipAddress: string;
  publicIpAddress: string;
  subdomain: string;
}

interface VmExecutionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  systemName: string;
  quantity: number;
  requestSubdomain?: string | null;
  onExecute: (requestId: string, vmInputs: VmExecutionInput[]) => Promise<void>;
}

export function VmExecutionModal({
  open,
  onOpenChange,
  requestId,
  systemName,
  quantity,
  requestSubdomain,
  onExecute,
}: VmExecutionModalProps) {
  const [isPending, startTransition] = useTransition();
  const [vmInputs, setVmInputs] = useState<VmExecutionInput[]>(() => {
    return Array.from({ length: quantity }, (_, i) => ({
      sequenceNumber: i + 1,
      hostname: quantity > 1 ? `${systemName}-${i + 1}` : systemName,
      ipAddress: "",
      publicIpAddress: "",
      subdomain: requestSubdomain || "",
    }));
  });

  const updateVmInput = (index: number, field: keyof VmExecutionInput, value: string) => {
    setVmInputs((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleExecute = () => {
    const isValid = vmInputs.every((vm) => vm.hostname.trim() && vm.ipAddress.trim());
    if (!isValid) {
      toast.error("Hostname and IP Address are required for all VMs");
      return;
    }

    startTransition(async () => {
      try {
        await onExecute(requestId, vmInputs);
        toast.success("VMs provisioned successfully");
        onOpenChange(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to provision VMs");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-blue-600" />
            Provision VMs - {systemName}
          </DialogTitle>
          <DialogDescription>
            Enter network details for {quantity} VM{quantity > 1 ? "s" : ""} being provisioned.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {vmInputs.map((vm, index) => (
            <div
              key={index}
              className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-4"
            >
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                  {vm.sequenceNumber}
                </div>
                <span className="font-semibold text-slate-700">
                  VM {vm.sequenceNumber} of {quantity}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`hostname-${index}`} className="flex items-center gap-1">
                    <Server className="h-3 w-3" /> Hostname *
                  </Label>
                  <Input
                    id={`hostname-${index}`}
                    value={vm.hostname}
                    onChange={(e) => updateVmInput(index, "hostname", e.target.value)}
                    placeholder="vm-hostname"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`subdomain-${index}`} className="flex items-center gap-1">
                    <Globe className="h-3 w-3" /> Subdomain
                  </Label>
                  <Input
                    id={`subdomain-${index}`}
                    value={vm.subdomain}
                    onChange={(e) => updateVmInput(index, "subdomain", e.target.value)}
                    placeholder="app.example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`ip-${index}`} className="flex items-center gap-1">
                    <Network className="h-3 w-3" /> IP Address *
                  </Label>
                  <Input
                    id={`ip-${index}`}
                    value={vm.ipAddress}
                    onChange={(e) => updateVmInput(index, "ipAddress", e.target.value)}
                    placeholder="10.0.0.x"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`publicIp-${index}`} className="flex items-center gap-1">
                    <Globe className="h-3 w-3" /> Public IP
                  </Label>
                  <Input
                    id={`publicIp-${index}`}
                    value={vm.publicIpAddress}
                    onChange={(e) => updateVmInput(index, "publicIpAddress", e.target.value)}
                    placeholder="203.0.113.x (optional)"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleExecute}
            disabled={isPending}
            className="bg-blue-600 hover:bg-blue-700 min-w-[140px]"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Provisioning...
              </>
            ) : (
              <>
                <Server className="h-4 w-4 mr-2" />
                Execute & Provision
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
