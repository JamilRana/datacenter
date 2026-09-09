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
import { Edit2, Loader2, Server, Globe, Network } from "lucide-react";
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
import { updateK8sNode } from "@/app/actions/k8s-actions";

interface EditNodeModalProps {
  node: {
    id: string;
    name: string;
    ipAddress?: string | null;
    externalIp?: string | null;
    subdomain?: string | null;
    subdomainStatus?: string;
  };
  onUpdated?: () => void;
}

export function EditNodeModal({ node, onUpdated }: EditNodeModalProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(node.name);
  const [ipAddress, setIpAddress] = useState(node.ipAddress || "");
  const [externalIp, setExternalIp] = useState(node.externalIp || "");
  const [subdomain, setSubdomain] = useState(node.subdomain || "");
  const [subdomainStatus, setSubdomainStatus] = useState(node.subdomainStatus || "PENDING");

  const handleOpen = (val: boolean) => {
    setOpen(val);
    if (val) {
      setName(node.name);
      setIpAddress(node.ipAddress || "");
      setExternalIp(node.externalIp || "");
      setSubdomain(node.subdomain || "");
      setSubdomainStatus(node.subdomainStatus || "PENDING");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanName = name.trim();
    if (!cleanName) {
      toast.error("Node name is required");
      return;
    }

    startTransition(async () => {
      try {
        const res = await updateK8sNode(node.id, {
          name: cleanName,
          ipAddress: ipAddress.trim() || null,
          externalIp: externalIp.trim() || null,
          subdomain: subdomain.trim() || null,
          subdomainStatus,
        });

        if (res.success) {
          toast.success(res.message);
          setOpen(false);
          onUpdated?.();
        } else {
          toast.error(res.message || "Failed to update node");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update node");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
          title="Edit Node"
          onClick={(e) => e.stopPropagation()}
        >
          <Edit2 className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden">
        <DialogHeader className="p-6 bg-slate-50 border-b border-slate-100">
          <DialogTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Server className="h-4 w-4" />
            </div>
            Edit Kubernetes Node
          </DialogTitle>
          <DialogDescription className="text-slate-500 text-xs mt-1">
            Update node identifiers, internal/external network configuration, and routing.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-node-name" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Node Name <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="edit-node-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-9 font-mono text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-node-ip" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Network className="h-3 w-3 text-slate-400" /> Internal IP
              </Label>
              <Input
                id="edit-node-ip"
                placeholder="e.g. 10.0.1.51"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                className="h-9 font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-node-extip" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Globe className="h-3 w-3 text-slate-400" /> External IP
              </Label>
              <Input
                id="edit-node-extip"
                placeholder="e.g. 192.168.1.100"
                value={externalIp}
                onChange={(e) => setExternalIp(e.target.value)}
                className="h-9 font-mono text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <Label htmlFor="edit-node-subdomain" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Subdomain / Ingress Route
            </Label>
            <Input
              id="edit-node-subdomain"
              placeholder="e.g. service.dghs.gov.bd"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value)}
              className="h-9 font-mono text-xs"
            />
          </div>

          {subdomain && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Route Status
              </Label>
              <Select value={subdomainStatus} onValueChange={setSubdomainStatus}>
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
          )}

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
