"use client";

import { useState, useTransition } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Globe, Network } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { addSubdomainToNamespace } from "@/app/actions/k8s-actions";

interface AddSubdomainModalProps {
  namespaceId: string;
  namespaceName: string;
  onCreated?: () => void;
}

export function AddSubdomainModal({
  namespaceId,
  namespaceName,
  onCreated,
}: AddSubdomainModalProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [subdomain, setSubdomain] = useState("");
  const [externalIp, setExternalIp] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [targetPort, setTargetPort] = useState("443");
  const [purpose, setPurpose] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let cleanSub = subdomain.trim().toLowerCase();
    if (!cleanSub) {
      toast.error("Subdomain is required");
      return;
    }

    cleanSub = cleanSub.replace(/^https?:\/\//, "").replace(/\/$/, "");

    startTransition(async () => {
      try {
        const res = await addSubdomainToNamespace({
          namespaceId,
          subdomain: cleanSub,
          externalIp: externalIp.trim() || undefined,
          serviceName: serviceName.trim() || undefined,
          targetPort: targetPort ? parseInt(targetPort, 10) : 443,
          purpose: purpose.trim() || undefined,
        });

        if (res.success) {
          toast.success(res.message);
          setOpen(false);
          setSubdomain("");
          setExternalIp("");
          setServiceName("");
          setPurpose("");
          onCreated?.();
        } else {
          toast.error(res.message || "Failed to add subdomain");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to add subdomain");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs font-semibold text-indigo-600 border-indigo-200 hover:bg-indigo-50 gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Subdomain
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden">
        <DialogHeader className="p-6 bg-slate-50 border-b border-slate-100">
          <DialogTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Globe className="h-4 w-4" />
            </div>
            Add Subdomain Route to {namespaceName}
          </DialogTitle>
          <DialogDescription className="text-slate-500 text-xs mt-1">
            Configure an ingress route, external IP, and service routing for this namespace.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="add-subdomain-name" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Subdomain / Host <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="add-subdomain-name"
              placeholder="e.g. portal.dghs.gov.bd or portal"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value)}
              required
              className="h-9 font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-subdomain-ip" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
              <Network className="h-3.5 w-3.5 text-slate-400" /> Ingress / External IP Address
            </Label>
            <Input
              id="add-subdomain-ip"
              placeholder="e.g. 103.20.10.15 or 10.0.1.50"
              value={externalIp}
              onChange={(e) => setExternalIp(e.target.value)}
              className="h-9 font-mono text-xs"
            />
            <p className="text-[10px] text-slate-400">
              Public or ingress VIP routing traffic to this namespace.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="add-subdomain-svc" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Target Service
              </Label>
              <Input
                id="add-subdomain-svc"
                placeholder="e.g. web-svc"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                className="h-9 font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-subdomain-port" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Target Port
              </Label>
              <Input
                id="add-subdomain-port"
                type="number"
                placeholder="443"
                value={targetPort}
                onChange={(e) => setTargetPort(e.target.value)}
                className="h-9 font-mono text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <Label htmlFor="add-subdomain-purpose" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Routing Purpose / Description
            </Label>
            <Input
              id="add-subdomain-purpose"
              placeholder="e.g. Main production API endpoint"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <DialogFooter className="pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Add Subdomain
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
