"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, AlertCircle, Code } from "lucide-react";
import { toast } from "sonner";
import { provisionK8sNamespace } from "@/app/actions/k8s-actions";

interface ProvisionK8sModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  onSuccess: () => void;
}

export function ProvisionK8sModal({
  open,
  onOpenChange,
  requestId,
  onSuccess,
}: ProvisionK8sModalProps) {
  const [namespaceName, setNamespaceName] = useState("");
  const [supervisorIp, setSupervisorIp] = useState("10.0.1.100");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNamespaceName("");
      setSupervisorIp("10.0.1.100");
      setError(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    // Validate Namespace Name: only letters, numbers, dashes allowed in K8s namespaces
    const k8sNamespaceRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
    if (!namespaceName.trim()) {
      setError("Namespace name is required");
      return;
    }
    if (!k8sNamespaceRegex.test(namespaceName)) {
      setError("Invalid K8s namespace name. Use lowercase alphanumeric characters or '-', and must start and end with alphanumeric.");
      return;
    }

    // Validate IP Address
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!supervisorIp.trim()) {
      setError("Supervisor IP address is required");
      return;
    }
    if (!ipRegex.test(supervisorIp)) {
      setError("Invalid IP address format.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await provisionK8sNamespace(requestId, namespaceName.trim(), supervisorIp.trim());
      if (result.success) {
        toast.success(result.message);
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(result.message);
        setError(result.message);
      }
    } catch (err) {
      toast.error("Failed to provision K8s Namespace");
      console.error(err);
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
          <div className="relative z-10 w-full max-w-lg bg-white rounded-lg shadow-xl m-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b bg-indigo-50/20">
              <div className="flex items-center gap-2 text-indigo-700">
                <Code className="h-5 w-5" />
                <h2 className="text-xl font-bold">Fulfill K8s Namespace Request</h2>
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
              {error && (
                <div className="bg-red-50 p-3 rounded-lg border border-red-200 text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="namespaceName" className="font-bold text-slate-700">
                    Namespace Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="namespaceName"
                    value={namespaceName}
                    onChange={(e) => setNamespaceName(e.target.value.toLowerCase())}
                    placeholder="e.g., dghs-portal-dev"
                  />
                  <p className="text-[10px] text-slate-400 italic">
                    Lowercase alphanumeric characters or &#39;-&#39;. e.g., portal-staging
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supervisorIp" className="font-bold text-slate-700">
                    Supervisor IP Address <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="supervisorIp"
                    value={supervisorIp}
                    onChange={(e) => setSupervisorIp(e.target.value)}
                    placeholder="e.g., 10.0.1.100"
                  />
                </div>
              </div>
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
                disabled={isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              >
                {isSubmitting ? "Provisioning..." : "Fulfill & Provision"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
