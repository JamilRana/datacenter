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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { HardDrive, Cpu, Database, Save, Send } from "lucide-react";
import { VmInstance } from "@/types/inventory";

interface CustomizationFormProps {
  vms: VmInstance[];
  preselectedVmId?: string;
  userId: string;
}

export function CustomizationForm({ vms, preselectedVmId, userId }: CustomizationFormProps) {
  const router = useRouter();
  const [selectedVmId, setSelectedVmId] = useState(preselectedVmId || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedVm = vms.find(v => v.id === selectedVmId);

  async function handleSubmit(type: "draft" | "submit") {
    if (!selectedVmId) {
      toast.error("Please select a virtual machine");
      return;
    }

    setIsSubmitting(true);
    const form = document.getElementById("customize-form") as HTMLFormElement;
    const formData = new FormData(form);
    
    formData.append("targetVmId", selectedVmId);
    formData.append("userId", userId);
    formData.append("requestType", "CUSTOMIZED");
    formData.append("status", type === "submit" ? "PENDING_L1" : "DRAFT");

    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        toast.success(`Customization request ${type === "submit" ? "submitted" : "saved"}!`);
        router.push("/requests");
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to create request");
      }
    } catch (error) {
      toast.error(`Network error: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form id="customize-form" className="space-y-6">
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="bg-slate-50/50 border-b">
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-blue-600" />
            <CardTitle>Target Virtual Machine</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select VM to Modify *</Label>
              <Select value={selectedVmId} onValueChange={setSelectedVmId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose one of your VMs..." />
                </SelectTrigger>
                <SelectContent>
                  {vms.map(vm => (
                    <SelectItem key={vm.id} value={vm.id}>
                      {vm.hostname} ({vm.ipAddress || "No IP"}) - {vm.currentSpec?.vcpu} vCPU, {vm.currentSpec?.ramGb}GB RAM
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedVm && (
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg space-y-2">
                <p className="text-sm font-semibold text-blue-900">Current Specification:</p>
                <div className="grid grid-cols-3 gap-4 text-xs text-blue-800">
                  <div className="flex items-center gap-1"><Cpu className="h-3 w-3" /> {selectedVm.currentSpec?.vcpu} vCPU</div>
                  <div className="flex items-center gap-1"><Database className="h-3 w-3" /> {selectedVm.currentSpec?.ramGb} GB RAM</div>
                  <div className="flex items-center gap-1"><HardDrive className="h-3 w-3" /> {selectedVm.currentSpec?.storageGb} GB Disk</div>
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
        <Cpu className="h-5 w-5 text-indigo-600" />
        <CardTitle>Requested Changes</CardTitle>
      </div>
    </CardHeader>
    <CardContent className="pt-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>Required vCPU Cores</Label>
          <Input 
            name="vcpu" 
            type="number" 
            defaultValue={selectedVm.currentSpec?.vcpu ?? ""} 
            min="1" 
            max="128" 
          />
        </div>
        <div className="space-y-2">
          <Label>Required RAM (GB)</Label>
          <Input 
            name="ramGb" 
            type="number" 
            defaultValue={selectedVm.currentSpec?.ramGb ?? ""} 
            min="1" 
            max="1024" 
          />
        </div>
        <div className="space-y-2">
          <Label>Required OS Disk (GB)</Label>
          <Input 
            name="storageGb" 
            type="number" 
            defaultValue={selectedVm.currentSpec?.storageGb ?? ""} 
            min="10" 
            max="10000" 
          />
        </div>
        <div className="space-y-2">
          <Label>System/Service Name (Reference)</Label>
          <Input 
            name="systemName" 
            defaultValue={selectedVm.hostname || ""} 
            readOnly 
            className="bg-slate-100" 
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Justification for Changes *</Label>
        <Textarea 
          name="purpose" 
          placeholder="Explain why these updates are needed..."
          className="min-h-[100px]"
          required
        />
      </div>
      
      <input 
        type="hidden" 
        name="environment" 
        value={selectedVm.request?.environment || "PRODUCTION"} 
      />
    </CardContent>
  </Card>
)}

      {selectedVm && (
        <div className="flex justify-end gap-4 pb-10">
          <Button 
            type="button" 
            variant="outline" 
            disabled={isSubmitting}
            onClick={() => handleSubmit("draft")}
          >
            <Save className="h-4 w-4 mr-2" /> Save as Draft
          </Button>
          <Button 
            type="button" 
            className="bg-blue-600 hover:bg-blue-700" 
            disabled={isSubmitting}
            onClick={() => handleSubmit("submit")}
          >
            <Send className="h-4 w-4 mr-2" /> Submit for Approval
          </Button>
        </div>
      )}
    </form>
  );
}
