// src/app/requests/components/CustomizationModal.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {  
  Edit, 
  Save, 
  Send, 
  HardDrive, 
  Cpu, 
  Database 
} from "lucide-react";
import { toast } from "sonner";
import { SerializedVmInstance } from "@/types/vm";
import { CustomizationRequest } from "@/types/customization";
import { createCustomizationRequest, updateCustomizationRequest, submitCustomizationRequest } from "@/app/actions/customization-actions";
import { StatusBadge } from "@/components/StatusBadge";

type CustomizationFormValues = {
  vcpu: string;
  ramGb: string;
  storageGb: string;
  purpose: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vms: SerializedVmInstance[];
  selectedRequest?: CustomizationRequest | null;
  mode: "create" | "view" | "edit";
}

export function CustomizationModal({
  open,
  onOpenChange,
  vms,
  selectedRequest,
  mode,
}: Props) {
  const router = useRouter();
  const [currentMode, setCurrentMode] = useState<"view" | "edit">("view");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedVmId, setSelectedVmId] = useState("");
  const [formData, setFormData] = useState<CustomizationFormValues>({
    vcpu: "",
    ramGb: "",
    storageGb: "",
    purpose: "",
  });

  // Initialize form when modal opens or request changes
  useEffect(() => {
    if (open) {
      if (mode === "create") {
        setCurrentMode("edit");
        setSelectedVmId(vms.length > 0 ? vms[0].id : "");
        setFormData({ vcpu: "", ramGb: "", storageGb: "", purpose: "" });
      } else if (mode === "view" || mode === "edit") {
        setCurrentMode(mode === "edit" ? "edit" : "view");
        if (selectedRequest) {
          setSelectedVmId(selectedRequest.targetVm?.id || "");
          setFormData({
            vcpu: selectedRequest.vcpu?.toString() || "",
            ramGb: selectedRequest.ramGb?.toString() || "",
            storageGb: selectedRequest.storageGb?.toString() || "",
            purpose: selectedRequest.purpose || "",
          });
        }
      }
    }
  }, [open, mode, selectedRequest, vms]);

  const selectedVm = vms.find((vm) => vm.id === selectedVmId);
  const isCreateMode = mode === "create";
  const isEditMode = currentMode === "edit";
  const isDraft = selectedRequest?.status === "DRAFT";
  const canEdit = isCreateMode || (isDraft && !isEditMode);

  const handleClose = () => {
    onOpenChange(false);
    setCurrentMode("view");
  };

  const handleSwitchToEdit = () => {
    setCurrentMode("edit");
  };

  const handleInputChange = (field: keyof CustomizationFormValues, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };
  const handleSubmit = async (action: "save" | "submit") => {
    if (!selectedVmId) {
      toast.error("Please select a virtual machine");
      return;
    }

    if (formData.purpose.trim().length < 10) {
      toast.error("Justification must be at least 10 characters");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = new FormData();
      
      data.append('purpose', formData.purpose.trim());
      if (formData.vcpu) data.append('vcpu', formData.vcpu);
      if (formData.ramGb) data.append('ramGb', formData.ramGb);
      if (formData.storageGb) data.append('storageGb', formData.storageGb);

      if (isCreateMode) {
        data.append('targetVmId', selectedVmId);
        
        // 1. Create the draft
        const newReq = await createCustomizationRequest(data);
        
        // 2. If action is submit, call the submission action with the new ID
        if (action === "submit" && newReq?.id) {
          await submitCustomizationRequest(newReq.id);
          toast.success("Request created and submitted for approval");
        } else {
          toast.success("Draft customization request saved");
        }
      } else if (selectedRequest) {
        // Update existing draft
        await updateCustomizationRequest(selectedRequest.id, data);
        
        if (action === "submit") {
          await submitCustomizationRequest(selectedRequest.id);
          toast.success("Request submitted for approval");
        } else {
          toast.success("Draft updated successfully");
        }
      }

      handleClose();
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred";
      toast.error(message);
      console.error("Customization error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <div>
            <DialogTitle>
              {isCreateMode
                ? "Create Customization Request"
                : isEditMode
                ? "Edit Customization Request"
                : "Customization Request Details"}
            </DialogTitle>
            <DialogDescription>
              {isCreateMode
                ? "Request changes to an existing virtual machine"
                : isEditMode
                ? "Update the customization details below"
                : "View request details"}
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* View Mode */}
        {!isCreateMode && !isEditMode && selectedRequest && (
          <ViewModeContent 
            request={selectedRequest} 
            onEdit={handleSwitchToEdit} 
            canEdit={canEdit} 
            onClose={handleClose}
          />
        )}

        {/* Edit/Create Mode */}
        {(isCreateMode || isEditMode) && (
          <EditModeContent
            vms={vms}
            selectedVmId={selectedVmId}
            selectedVm={selectedVm}
            formData={formData}
            onVmChange={setSelectedVmId}
            onInputChange={handleInputChange}
            onSave={() => handleSubmit("save")}
            onSubmit={() => handleSubmit("submit")}
            isSubmitting={isSubmitting}
            isCreateMode={isCreateMode}
            onCancel={() => isCreateMode ? handleClose() : setCurrentMode("view")}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// View Mode Component
function ViewModeContent({
  request,
  onEdit,
  canEdit,
  onClose,
}: {
  request: CustomizationRequest;
  onEdit: () => void;
  canEdit: boolean;
  onClose: () => void;
}) {
  return (
    <div className="space-y-6 py-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Request Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-slate-700">Request ID</Label>
              <p className="mt-1 text-sm font-mono">{request.id}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">Status</Label>
              <StatusBadge status={request.status} />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">Created</Label>
              <p className="mt-1 text-sm">{new Date(request.createdAt).toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Target Virtual Machine</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-slate-700">Hostname</Label>
              <p className="mt-1 text-sm font-medium">{request.targetVm.hostname || "N/A"}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">IP Address</Label>
              <p className="mt-1 text-sm font-mono">{request.targetVm.ipAddress || "N/A"}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">Environment</Label>
              <p className="mt-1 text-sm">{request.targetVm.environment || "N/A"}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">Status</Label>
              <p className="mt-1 text-sm">{request.targetVm.status || "N/A"}</p>
            </div>
          </div>

          <div className="pt-4 border-t">
            <Label className="text-sm font-medium text-slate-700 mb-2 block">
              Current Specifications
            </Label>
            <div className="flex gap-4 flex-wrap">
              <span className="flex items-center gap-1">
                <Cpu className="h-4 w-4" /> {request.targetVm.currentSpec?.vcpu || "N/A"} vCPU
              </span>
              <span className="flex items-center gap-1">
                <Database className="h-4 w-4" /> {request.targetVm.currentSpec?.ramGb || "N/A"} GB RAM
              </span>
              <span className="flex items-center gap-1">
                <HardDrive className="h-4 w-4" /> {request.targetVm.currentSpec?.storageGb || "N/A"} GB Storage
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Requested Changes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {request.vcpu && (
            <div>
              <Label className="text-sm font-medium text-slate-700">CPU Cores</Label>
              <p className="mt-1 text-sm">{request.vcpu}</p>
            </div>
          )}
          {request.ramGb && (
            <div>
              <Label className="text-sm font-medium text-slate-700">RAM (GB)</Label>
              <p className="mt-1 text-sm">{request.ramGb}</p>
            </div>
          )}
          {request.storageGb && (
            <div>
              <Label className="text-sm font-medium text-slate-700">Storage (GB)</Label>
              <p className="mt-1 text-sm">{request.storageGb}</p>
            </div>
          )}
          {request.purpose && (
            <div>
              <Label className="text-sm font-medium text-slate-700">Purpose / Justification</Label>
              <p className="mt-1 text-sm whitespace-pre-wrap">{request.purpose}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pt-4 border-t">
        {canEdit && (
          <Button variant="outline" onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        )}
        <Button onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}

interface EditModeContentProps {
  vms: SerializedVmInstance[];
  selectedVmId: string;
  selectedVm?: SerializedVmInstance | null;
  formData: CustomizationFormValues;
  onVmChange: (vmId: string) => void;
  onInputChange: (field: keyof CustomizationFormValues, value: string) => void;
  onSave: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  isCreateMode: boolean;
  onCancel: () => void;
}

function EditModeContent({
  vms,
  selectedVmId,
  selectedVm,
  formData,
  onVmChange,
  onInputChange,
  onSave,
  onSubmit,
  isSubmitting,
  isCreateMode,
  onCancel,
}: EditModeContentProps) {
  return (
    <div className="space-y-6 py-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" /> Target VM
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vm-select">Select Virtual Machine *</Label>
            <Select
              value={selectedVmId}
              onValueChange={onVmChange}
              disabled={!isCreateMode}
            >
              <SelectTrigger id="vm-select">
                <SelectValue placeholder="Choose a VM" />
              </SelectTrigger>
              <SelectContent>
                {vms.map((vm) => (
                  <SelectItem key={vm.id} value={vm.id}>
                    {vm.hostname || `VM ${vm.id}`} — {vm.currentSpec?.vcpu} vCPU / {vm.currentSpec?.ramGb} GB RAM
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedVm && (
            <div className="mt-4 p-4 rounded-lg bg-slate-50">
              <Label className="text-sm font-medium text-slate-700 mb-2 block">
                Current Specifications
              </Label>
              <div className="flex flex-wrap gap-4">
                <span className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-slate-600" />
                  <span className="text-sm">{selectedVm.currentSpec?.vcpu || "N/A"} vCPU</span>
                </span>
                <span className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-slate-600" />
                  <span className="text-sm">{selectedVm.currentSpec?.ramGb || "N/A"} GB RAM</span>
                </span>
                <span className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-slate-600" />
                  <span className="text-sm">{selectedVm.currentSpec?.storageGb || "N/A"} GB Storage</span>
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedVm && (
        <Card>
          <CardHeader>
            <CardTitle>Requested Changes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vcpu">CPU Cores (Optional)</Label>
              <Input
                id="vcpu"
                type="number"
                min="1"
                placeholder={`Current: ${selectedVm.currentSpec?.vcpu || "N/A"}`}
                value={formData.vcpu}
                onChange={(e) => onInputChange("vcpu", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ramGb">RAM (GB) (Optional)</Label>
              <Input
                id="ramGb"
                type="number"
                min="1"
                placeholder={`Current: ${selectedVm.currentSpec?.ramGb || "N/A"}`}
                value={formData.ramGb}
                onChange={(e) => onInputChange("ramGb", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="storageGb">Storage (GB) (Optional)</Label>
              <Input
                id="storageGb"
                type="number"
                min="10"
                placeholder={`Current: ${selectedVm.currentSpec?.storageGb || "N/A"}`}
                value={formData.storageGb}
                onChange={(e) => onInputChange("storageGb", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purpose">Purpose / Justification *</Label>
              <Textarea
                id="purpose"
                placeholder="Explain why this customization is needed..."
                rows={4}
                value={formData.purpose}
                onChange={(e) => onInputChange("purpose", e.target.value)}
                required
              />
              <p className="text-xs text-slate-500">
                Provide a clear explanation for this request (minimum 10 characters)
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          {isCreateMode ? "Cancel" : "Back to View"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onSave}
          disabled={isSubmitting || !selectedVmId || formData.purpose.trim().length < 10}
        >
          <Save className="h-4 w-4 mr-2" />
          {isCreateMode ? "Save Draft" : "Update Draft"}
        </Button>
        <Button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting || !selectedVmId || formData.purpose.trim().length < 10}
        >
          <Send className="h-4 w-4 mr-2" />
          {isCreateMode ? "Submit Request" : "Submit for Approval"}
        </Button>
      </div>
    </div>
  );
}