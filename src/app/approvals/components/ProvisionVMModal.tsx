"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Server, X, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { provisionVMs } from "@/app/actions/approval-actions";

interface VmInstanceInput {
  hostname: string;
  ipAddress: string;
  publicIpAddress: string;
  subdomain: string;
}

interface ProvisionVMModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  requestQuantity: number;
  existingVmsCount: number;
  defaultSubdomain?: string;
  requesterId: string;
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
  onSuccess,
}: ProvisionVMModalProps) {
  const [vms, setVms] = useState<VmInstanceInput[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<number, Record<string, string>>>({});

  const remainingVms = requestQuantity - existingVmsCount;
  const canAddMore = vms.length < remainingVms;

  useEffect(() => {
    if (open) {
      setVms([]);
      setErrors({});
    }
  }, [open]);

  const addVm = () => {
    if (vms.length < remainingVms) {
      setVms([
        ...vms,
        {
          hostname: "",
          ipAddress: "",
          publicIpAddress: "",
          subdomain: defaultSubdomain,
        },
      ]);
    }
  };

  const removeVm = (index: number) => {
    const newVms = [...vms];
    newVms.splice(index, 1);
    setVms(newVms);
    const newErrors = { ...errors };
    delete newErrors[index];
    setErrors(newErrors);
  };

  const updateVm = (index: number, field: keyof VmInstanceInput, value: string) => {
    const newVms = [...vms];
    newVms[index] = { ...newVms[index], [field]: value };
    setVms(newVms);
    
    // Clear error when user types
    if (errors[index]?.[field]) {
      const newErrors = { ...errors };
      delete newErrors[index][field];
      setErrors(newErrors);
    }
  };

  const validateVms = async (): Promise<boolean> => {
    const newErrors: Record<number, Record<string, string>> = {};
    let isValid = true;

    // Collect all IPs and hostnames to check for duplicates within the form
    const ipAddresses = vms.map((v) => v.ipAddress).filter(Boolean);
    const hostnames = vms.map((v) => v.hostname).filter(Boolean);

    for (let i = 0; i < vms.length; i++) {
      const vm = vms[i];
      const vmErrors: Record<string, string> = {};

      if (!vm.hostname.trim()) {
        vmErrors.hostname = "Hostname is required";
        isValid = false;
      } else if (hostnames.filter((h) => h === vm.hostname).length > 1) {
        vmErrors.hostname = "Duplicate hostname within this request";
        isValid = false;
      }

      if (!vm.ipAddress.trim()) {
        vmErrors.ipAddress = "Private IP is required";
        isValid = false;
      } else if (ipAddresses.filter((ip) => ip === vm.ipAddress).length > 1) {
        vmErrors.ipAddress = "Duplicate IP within this request";
        isValid = false;
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
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await provisionVMs(
        requestId,
        requesterId,
        vms.map((vm, index) => ({
          hostname: vm.hostname.trim(),
          ipAddress: vm.ipAddress.trim(),
          publicIpAddress: vm.publicIpAddress.trim() || null,
          subdomain: vm.subdomain.trim() || null,
          sequenceNumber: existingVmsCount + index + 1,
        }))
      );

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

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => onOpenChange(false)}
          />

          {/* Modal */}
          <div className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-xl m-4">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-xl font-semibold">Provision VMs</h2>
                <p className="text-sm text-slate-500 mt-1">
                  {remainingVms} VM{remainingVms !== 1 ? "s" : ""} remaining to be provisioned
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* VM Cards */}
              {vms.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Server className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                  <p>No VMs added yet</p>
                  <p className="text-sm">Click &quot;Add VM&quot; to start provisioning</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {vms.map((vm, index) => (
                    <Card key={index} className="relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 text-slate-400 hover:text-red-500"
                        onClick={() => removeVm(index)}
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">
                          VM #{existingVmsCount + index + 1}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor={`hostname-${index}`}>
                              Hostname <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id={`hostname-${index}`}
                              value={vm.hostname}
                              onChange={(e) =>
                                updateVm(index, "hostname", e.target.value)
                              }
                              placeholder="e.g., web-server-01"
                              className={errors[index]?.hostname ? "border-red-500" : ""}
                            />
                            {errors[index]?.hostname && (
                              <p className="text-xs text-red-500 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {errors[index].hostname}
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`ip-${index}`}>
                              Private IP Address <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id={`ip-${index}`}
                              value={vm.ipAddress}
                              onChange={(e) =>
                                updateVm(index, "ipAddress", e.target.value)
                              }
                              placeholder="e.g., 192.168.1.100"
                              className={errors[index]?.ipAddress ? "border-red-500" : ""}
                            />
                            {errors[index]?.ipAddress && (
                              <p className="text-xs text-red-500 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {errors[index].ipAddress}
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`public-ip-${index}`}>
                              Public IP Address <span className="text-slate-400">(optional)</span>
                            </Label>
                            <Input
                              id={`public-ip-${index}`}
                              value={vm.publicIpAddress}
                              onChange={(e) =>
                                updateVm(index, "publicIpAddress", e.target.value)
                              }
                              placeholder="e.g., 203.0.113.50"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`subdomain-${index}`}>
                              Subdomain <span className="text-slate-400">(optional)</span>
                            </Label>
                            <Input
                              id={`subdomain-${index}`}
                              value={vm.subdomain}
                              onChange={(e) =>
                                updateVm(index, "subdomain", e.target.value)
                              }
                              placeholder={defaultSubdomain || "e.g., myapp"}
                              readOnly={!!defaultSubdomain}
                              className={defaultSubdomain ? "bg-slate-50" : ""}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Add VM Button */}
              {canAddMore && (
                <Button
                  variant="outline"
                  className="w-full border-dashed"
                  onClick={addVm}
                  type="button"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add VM ({vms.length}/{remainingVms})
                </Button>
              )}

              {/* Summary */}
              {vms.length > 0 && (
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-medium">
                      {vms.length} VM{vms.length !== 1 ? "s" : ""} ready to provision
                    </span>
                  </div>
                  <div className="text-sm text-slate-500">
                    {remainingVms - vms.length} remaining after this batch
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 p-6 border-t bg-slate-50">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || vms.length === 0}
              >
                {isSubmitting ? "Provisioning..." : `Provision ${vms.length} VM${vms.length !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
