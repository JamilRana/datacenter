"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { HardDrive, AlertTriangle, Send, History } from "lucide-react";
import { VmInstance } from "@/types/inventory";

interface DecommissionFormProps {
  vms: VmInstance[];
  preselectedVmId?: string;
  userId: string;
}

export function DecommissionForm({ vms, preselectedVmId, userId }: DecommissionFormProps) {
  const router = useRouter();
  const [selectedVmId, setSelectedVmId] = useState(preselectedVmId || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedVm = vms.find(v => v.id === selectedVmId);

  async function handleSubmit() {
    if (!selectedVmId) {
      toast.error("Please select a virtual machine");
      return;
    }

    setIsSubmitting(true);
    const form = document.getElementById("decommission-form") as HTMLFormElement;
    const formData = new FormData(form);
    
    formData.append("targetVmId", selectedVmId);
    formData.append("userId", userId);
    formData.append("requestType", "DECOMMISSION");
    formData.append("status", "PENDING_L1"); 

    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        toast.success("Decommission request submitted for L1 approval!");
        router.push("/requests");
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to submit request");
      }
    } catch (error) {
      toast.error(`Network error: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form id="decommission-form" className="space-y-6">
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="bg-slate-50/50 border-b">
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-red-600" />
            <CardTitle>Target Virtual Machine</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select VM to Terminate *</Label>
              <Select value={selectedVmId} onValueChange={setSelectedVmId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose one of your VMs..." />
                </SelectTrigger>
                <SelectContent>
                  {vms.map(vm => (
                    <SelectItem key={vm.id} value={vm.id}>
                      {vm.hostname} ({vm.ipAddress || "No IP"}) - {vm.request?.systemName || "Unknown System"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedVm && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-red-900">Warning: Irreversible Action</p>
                  <p className="text-xs text-red-800">
                    Decommissioning will permanently terminate the virtual machine. Data will be lost if not backed up.
                    This request requires Level 1 management approval before execution.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedVm && (
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="bg-slate-50/50 border-b">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-slate-600" />
              <CardTitle>Justification</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-2">
              <Label>Reason for Decommissioning *</Label>
              <Textarea 
                name="purpose" 
                placeholder="Explain why this service is no longer needed..."
                className="min-h-[100px]"
                required
              />
            </div>
            
            <input type="hidden" name="systemName" value={selectedVm.hostname || "DECOMMISSION"} />
            <input type="hidden" name="environment" value={selectedVm.request?.environment || "PRODUCTION"} />
          </CardContent>
        </Card>
      )}

      {selectedVm && (
        <div className="flex justify-end gap-4 pb-10">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => router.push("/requests")}
          >
            Cancel
          </Button>
          <Button 
            type="button" 
            className="bg-red-600 hover:bg-red-700" 
            disabled={isSubmitting}
            onClick={handleSubmit}
          >
            <Send className="h-4 w-4 mr-2" /> Submit Decommission Request
          </Button>
        </div>
      )}
    </form>
  );
}
