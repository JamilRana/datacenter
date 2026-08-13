"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Server, X, CheckCircle2, AlertCircle, Cpu, HardDrive, Shield, Globe } from "lucide-react";
import { toast } from "sonner";
import { provisionVMs, VmProvisioningInput } from "@/app/actions/approval-actions";

interface VmCardState {
  hostname: string;
  ipAddress: string;
  publicIpAddress: string;
  subdomain: string;
  sequenceNumber: number;
  vmSpecificationId?: string | null;
  spec?: any;
}

interface ProvisionVMModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  requestQuantity: number;
  existingVmsCount: number;
  defaultSubdomain?: string;
  requesterId: string;
  vmSpecifications?: any[];
  targetSpecId?: string | null; // Optional: when provisioning a specific VM
  targetSequenceNumber?: number | null;
  onSuccess: () => void;
}

export function ProvisionVMModal({
  open,
  onOpenChange,
  requestId,
  requestQuantity,
  existingVmsCount,
  defaultSubdomain = "",
  requesterId,
  vmSpecifications = [],
  targetSpecId = null,
  targetSequenceNumber = null,
  onSuccess,
}: ProvisionVMModalProps) {
  const [vms, setVms] = useState<VmCardState[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<number, Record<string, string>>>({});

  const totalRequested = requestQuantity || vmSpecifications.length || 1;
  const remainingVms = Math.max(0, totalRequested - existingVmsCount);

  useEffect(() => {
    if (open) {
      setErrors({});

      if (targetSpecId && targetSequenceNumber) {
        // Targeted single VM provisioning
        const matchedSpec = vmSpecifications.find((s) => s.id === targetSpecId);
        setVms([
          {
            hostname: "",
            ipAddress: "",
            publicIpAddress: "",
            subdomain: matchedSpec?.subdomain || defaultSubdomain || "",
            sequenceNumber: targetSequenceNumber,
            vmSpecificationId: targetSpecId,
            spec: matchedSpec,
          },
        ]);
      } else {
        // Batch provisioning: auto-populate all remaining pending VMs
        const pendingCount = remainingVms;
        const initialCards: VmCardState[] = [];

        for (let i = 0; i < pendingCount; i++) {
          const seq = existingVmsCount + i + 1;
          const matchedSpec = vmSpecifications[i] || vmSpecifications[0];
          initialCards.push({
            hostname: "",
            ipAddress: "",
            publicIpAddress: "",
            subdomain: matchedSpec?.subdomain || defaultSubdomain || "",
            sequenceNumber: seq,
            vmSpecificationId: matchedSpec?.id || null,
            spec: matchedSpec,
          });
        }

        setVms(initialCards);
      }
    }
  }, [open, targetSpecId, targetSequenceNumber, existingVmsCount, remainingVms, vmSpecifications, defaultSubdomain]);

  const addVm = () => {
    if (vms.length < remainingVms) {
      const nextSeq = existingVmsCount + vms.length + 1;
      const specIdx = vms.length % (vmSpecifications.length || 1);
      const matchedSpec = vmSpecifications[specIdx] || null;

      setVms([
        ...vms,
        {
          hostname: "",
          ipAddress: "",
          publicIpAddress: "",
          subdomain: matchedSpec?.subdomain || defaultSubdomain || "",
          sequenceNumber: nextSeq,
          vmSpecificationId: matchedSpec?.id || null,
          spec: matchedSpec,
        },
      ]);
    }
  };

  const removeVm = (index: number) => {
    const newVms = [...vms];
    newVms.splice(index, 1);
    // Re-adjust sequence numbers
    const adjusted = newVms.map((v, idx) => ({
      ...v,
      sequenceNumber: existingVmsCount + idx + 1,
    }));
    setVms(adjusted);
    const newErrors = { ...errors };
    delete newErrors[index];
    setErrors(newErrors);
  };

  const updateVm = (index: number, field: keyof VmCardState, value: any) => {
    const newVms = [...vms];
    newVms[index] = { ...newVms[index], [field]: value };
    setVms(newVms);

    if (errors[index]?.[field]) {
      const newErrors = { ...errors };
      delete newErrors[index][field];
      setErrors(newErrors);
    }
  };

  const validateVms = async (): Promise<boolean> => {
    const newErrors: Record<number, Record<string, string>> = {};
    let isValid = true;

    const ipAddresses = vms.map((v) => v.ipAddress.trim()).filter(Boolean);
    const hostnames = vms.map((v) => v.hostname.trim().toLowerCase()).filter(Boolean);

    for (let i = 0; i < vms.length; i++) {
      const vm = vms[i];
      const vmErrors: Record<string, string> = {};

      if (!vm.hostname.trim()) {
        vmErrors.hostname = "Hostname is required";
        isValid = false;
      } else if (hostnames.filter((h) => h === vm.hostname.trim().toLowerCase()).length > 1) {
        vmErrors.hostname = "Duplicate hostname in this batch";
        isValid = false;
      }

      if (!vm.ipAddress.trim()) {
        vmErrors.ipAddress = "Private IP is required";
        isValid = false;
      } else {
        const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
        if (!ipRegex.test(vm.ipAddress.trim())) {
          vmErrors.ipAddress = "Invalid IP address format";
          isValid = false;
        } else if (ipAddresses.filter((ip) => ip === vm.ipAddress.trim()).length > 1) {
          vmErrors.ipAddress = "Duplicate IP in this batch";
          isValid = false;
        }
      }

      if (Object.keys(vmErrors).length > 0) {
        newErrors[i] = vmErrors;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async () => {
    if (vms.length === 0) {
      toast.error("Please add at least one VM to provision");
      return;
    }

    const isValid = await validateVms();
    if (!isValid) {
      toast.error("Please fix the validation errors before provisioning");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: VmProvisioningInput[] = vms.map((vm) => ({
        hostname: vm.hostname.trim(),
        ipAddress: vm.ipAddress.trim(),
        publicIpAddress: vm.publicIpAddress.trim() || null,
        subdomain: vm.subdomain.trim() || null,
        sequenceNumber: vm.sequenceNumber,
        vmSpecificationId: vm.vmSpecificationId || null,
      }));

      const result = await provisionVMs(requestId, requesterId, payload);

      if (result.success) {
        toast.success(result.message);
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(result.message);
        if (result.errors) {
          const formattedErrors: Record<number, Record<string, string>> = {};
          result.errors.forEach((err) => {
            const index = err.index || 0;
            if (!formattedErrors[index]) {
              formattedErrors[index] = {};
            }
            formattedErrors[index][err.field] = err.message;
          });
          setErrors(formattedErrors);
        }
      }
    } catch (error) {
      toast.error("Failed to provision VMs");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-slate-50/80">
          <div>
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-indigo-600" />
              <h2 className="text-xl font-bold text-slate-900">
                {targetSpecId ? `Provision VM #${targetSequenceNumber}` : "Provision Virtual Machines"}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {targetSpecId
                ? "Assign IP and Hostname for this specific requested VM"
                : `${remainingVms} VM${remainingVms !== 1 ? "s" : ""} pending execution out of ${totalRequested} requested`}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="text-slate-400 hover:text-slate-700 rounded-full"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {vms.length === 0 ? (
            <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-xl border border-dashed">
              <Server className="h-10 w-10 mx-auto mb-3 text-slate-300" />
              <p className="font-semibold text-slate-700">No VMs configured</p>
              <p className="text-xs text-slate-400 mt-1">Click &quot;Add VM&quot; below to prepare a VM instance</p>
            </div>
          ) : (
            <div className="space-y-6">
              {vms.map((vm, index) => {
                const spec = vm.spec;
                return (
                  <Card key={index} className="relative border-slate-200 shadow-sm overflow-hidden">
                    {!targetSpecId && vms.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-3 right-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full"
                        onClick={() => removeVm(index)}
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}

                    <CardHeader className="pb-3 bg-slate-50/60 border-b border-slate-100">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs">
                            {vm.sequenceNumber}
                          </span>
                          <span>VM #{vm.sequenceNumber}</span>
                          {spec?.stack && (
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold">
                              {spec.stack}
                            </span>
                          )}
                        </CardTitle>
                      </div>

                      {/* Requested Specifications Summary Badge */}
                      {spec && (
                        <div className="flex flex-wrap items-center gap-2 pt-2 text-[11px] text-slate-600">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium border border-blue-100">
                            <Cpu className="w-3 h-3" /> {spec.vcpu} vCPU / {spec.ramGb} GB RAM
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium border border-emerald-100">
                            <HardDrive className="w-3 h-3" /> {spec.storageGb} GB OS Disk
                          </span>
                          {spec.additionalStorage && spec.additionalStorage.length > 0 && (
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium border border-slate-200">
                              +{spec.additionalStorage.length} Addl Disks ({spec.additionalStorage.map((d: any) => `${d.sizeGb}GB`).join(", ")})
                            </span>
                          )}
                          {spec.osVersion && (
                            <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-medium border border-purple-100">
                              {spec.osVersion}
                            </span>
                          )}
                          {spec.connectivity && spec.connectivity.some((c: any) => c.accessType === "VPN") && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-medium border border-amber-100">
                              <Shield className="w-3 h-3" /> VPN Required
                            </span>
                          )}
                        </div>
                      )}
                    </CardHeader>

                    <CardContent className="pt-5 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor={`hostname-${index}`} className="text-xs font-bold text-slate-700">
                            Hostname <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id={`hostname-${index}`}
                            value={vm.hostname}
                            onChange={(e) => updateVm(index, "hostname", e.target.value)}
                            placeholder="e.g., dghs-app-srv-01"
                            className={`bg-white ${errors[index]?.hostname ? "border-red-500" : "border-slate-200"}`}
                          />
                          {errors[index]?.hostname && (
                            <p className="text-[11px] text-red-500 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" /> {errors[index].hostname}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor={`ip-${index}`} className="text-xs font-bold text-slate-700">
                            Private IP Address <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id={`ip-${index}`}
                            value={vm.ipAddress}
                            onChange={(e) => updateVm(index, "ipAddress", e.target.value)}
                            placeholder="e.g., 192.168.10.101"
                            className={`bg-white ${errors[index]?.ipAddress ? "border-red-500" : "border-slate-200"}`}
                          />
                          {errors[index]?.ipAddress && (
                            <p className="text-[11px] text-red-500 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" /> {errors[index].ipAddress}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor={`public-ip-${index}`} className="text-xs font-medium text-slate-700">
                            Public IP Address <span className="text-slate-400 font-normal">(optional)</span>
                          </Label>
                          <Input
                            id={`public-ip-${index}`}
                            value={vm.publicIpAddress}
                            onChange={(e) => updateVm(index, "publicIpAddress", e.target.value)}
                            placeholder="e.g., 103.245.204.50"
                            className="bg-white border-slate-200"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor={`subdomain-${index}`} className="text-xs font-medium text-slate-700">
                            Subdomain <span className="text-slate-400 font-normal">(optional)</span>
                          </Label>
                          <div className="relative">
                            <Input
                              id={`subdomain-${index}`}
                              value={vm.subdomain}
                              onChange={(e) => updateVm(index, "subdomain", e.target.value)}
                              placeholder="e.g., portal.dghs.gov.bd"
                              className="bg-white border-slate-200"
                            />
                            {vm.subdomain && (
                              <Globe className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Add VM Button for batch */}
          {!targetSpecId && vms.length < remainingVms && (
            <Button
              variant="outline"
              className="w-full border-dashed border-slate-300 py-6 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/30"
              onClick={addVm}
              type="button"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Another VM ({vms.length}/{remainingVms} Pending)
            </Button>
          )}

          {/* Batch Summary */}
          {vms.length > 0 && (
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-semibold text-slate-800">
                  {vms.length} VM{vms.length !== 1 ? "s" : ""} ready for execution
                </span>
              </div>
              <div className="text-xs text-slate-500">
                {targetSpecId ? "Single VM Execution" : `${remainingVms - vms.length} pending remaining after this batch`}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t bg-slate-50 border-slate-100">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="border-slate-200"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || vms.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
          >
            {isSubmitting
              ? "Provisioning VMs..."
              : `Fulfill & Provision ${vms.length} VM${vms.length !== 1 ? "s" : ""}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
