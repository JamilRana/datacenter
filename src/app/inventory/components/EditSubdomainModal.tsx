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
import { Edit2, Loader2, Globe, Network } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { updateK8sSubdomain } from "@/app/actions/k8s-actions";

interface EditSubdomainModalProps {
  subdomain: {
    id: string;
    subdomain: string;
    externalIp?: string | null;
    serviceName?: string | null;
    targetPort?: number | null;
    status?: string;
  };
  onUpdated?: () => void;
}

export function EditSubdomainModal({
  subdomain,
  onUpdated,
}: EditSubdomainModalProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [subdomainName, setSubdomainName] = useState(subdomain.subdomain);
  const [externalIp, setExternalIp] = useState(subdomain.externalIp || "");
  const [serviceName, setServiceName] = useState(subdomain.serviceName || "");
  const [targetPort, setTargetPort] = useState(String(subdomain.targetPort || 443));
  const [status, setStatus] = useState(subdomain.status || "ACTIVE");

  const handleOpen = (val: boolean) => {
    setOpen(val);
    if (val) {
      setSubdomainName(subdomain.subdomain);
      setExternalIp(subdomain.externalIp || "");
      setServiceName(subdomain.serviceName || "");
      setTargetPort(String(subdomain.targetPort || 443));
      setStatus(subdomain.status || "ACTIVE");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let cleanSub = subdomainName.trim().toLowerCase();
    if (!cleanSub) {
      toast.error("Subdomain is required");
      return;
    }

    cleanSub = cleanSub.replace(/^https?:\/\//, "").replace(/\/$/, "");

    startTransition(async () => {
      try {
        const res = await updateK8sSubdomain(subdomain.id, {
          subdomain: cleanSub,
          externalIp: externalIp.trim() || null,
          serviceName: serviceName.trim() || null,
          targetPort: targetPort ? parseInt(targetPort, 10) : null,
          status,
        });

        if (res.success) {
          toast.success(res.message);
          setOpen(false);
          onUpdated?.();
        } else {
          toast.error(res.message || "Failed to update subdomain");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update subdomain");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
          title="Edit Subdomain"
          onClick={(e) => e.stopPropagation()}
        >
          <Edit2 className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden">
        <DialogHeader className="p-6 bg-slate-50 border-b border-slate-100">
          <DialogTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Globe className="h-4 w-4" />
            </div>
            Edit Ingress Subdomain
          </DialogTitle>
          <DialogDescription className="text-slate-500 text-xs mt-1">
            Update subdomain host, ingress IP address, and target service routing.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-subdomain-name" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Subdomain / Host <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="edit-subdomain-name"
              value={subdomainName}
              onChange={(e) => setSubdomainName(e.target.value)}
              required
              className="h-9 font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-subdomain-ip" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
              <Network className="h-3.5 w-3.5 text-slate-400" /> Ingress / External IP Address
            </Label>
            <Input
              id="edit-subdomain-ip"
              value={externalIp}
              onChange={(e) => setExternalIp(e.target.value)}
              placeholder="e.g. 103.20.10.15"
              className="h-9 font-mono text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="edit-subdomain-svc" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Target Service
              </Label>
              <Input
                id="edit-subdomain-svc"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                className="h-9 font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-subdomain-port" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Target Port
              </Label>
              <Input
                id="edit-subdomain-port"
                type="number"
                value={targetPort}
                onChange={(e) => setTargetPort(e.target.value)}
                className="h-9 font-mono text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Routing Status
            </Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                <SelectItem value="PENDING">PENDING</SelectItem>
                <SelectItem value="REJECTED">REJECTED</SelectItem>
              </SelectContent>
            </Select>
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
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
