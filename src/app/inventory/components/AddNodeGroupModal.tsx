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
import { Plus, Loader2, Cpu, HardDrive, Server } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { addNodeGroupToCluster } from "@/app/actions/k8s-actions";

interface AddNodeGroupModalProps {
  clusterId: string;
  namespaceName: string;
  existingRoles?: string[];
  onCreated?: () => void;
}

export function AddNodeGroupModal({
  clusterId,
  namespaceName,
  existingRoles = [],
  onCreated,
}: AddNodeGroupModalProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const defaultRole = existingRoles.includes("WORKER") && !existingRoles.includes("MASTER") 
    ? "MASTER" 
    : "WORKER";

  const [role, setRole] = useState<"MASTER" | "WORKER">(defaultRole);
  const [nodeCount, setNodeCount] = useState("1");
  const [vcpu, setVcpu] = useState("4");
  const [ramGb, setRamGb] = useState("8");
  const [storageGb, setStorageGb] = useState("50");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const count = parseInt(nodeCount, 10);
    const cpu = parseInt(vcpu, 10);
    const ram = parseInt(ramGb, 10);
    const storage = parseInt(storageGb, 10);

    if (isNaN(count) || count < 1) {
      toast.error("Node count must be at least 1");
      return;
    }
    if (isNaN(cpu) || cpu < 1) {
      toast.error("vCPU must be at least 1");
      return;
    }
    if (isNaN(ram) || ram < 1) {
      toast.error("RAM must be at least 1 GB");
      return;
    }
    if (isNaN(storage) || storage < 10) {
      toast.error("Storage must be at least 10 GB");
      return;
    }

    startTransition(async () => {
      try {
        const res = await addNodeGroupToCluster({
          clusterId,
          role,
          nodeCount: count,
          vcpu: cpu,
          ramGb: ram,
          storageGb: storage,
        });

        if (res.success) {
          toast.success(res.message);
          setOpen(false);
          onCreated?.();
        } else {
          toast.error(res.message || "Failed to add node group");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to add node group");
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
          Add Node Group
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[460px] p-0 overflow-hidden">
        <DialogHeader className="p-6 bg-slate-50 border-b border-slate-100">
          <DialogTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Server className="h-4 w-4" />
            </div>
            Add Node Group to {namespaceName}
          </DialogTitle>
          <DialogDescription className="text-slate-500 text-xs mt-1">
            Provision a new Master or Worker node pool in this cluster.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Node Group Role
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole("WORKER")}
                className={`p-3 rounded-lg border text-left transition-all ${
                  role === "WORKER"
                    ? "border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="text-xs font-bold text-slate-800">Worker Group</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Executes user workloads and pods</div>
              </button>
              <button
                type="button"
                onClick={() => setRole("MASTER")}
                className={`p-3 rounded-lg border text-left transition-all ${
                  role === "MASTER"
                    ? "border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="text-xs font-bold text-slate-800">Master / Control</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Control plane components & API</div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Nodes
              </Label>
              <Input
                type="number"
                min="1"
                max="50"
                value={nodeCount}
                onChange={(e) => setNodeCount(e.target.value)}
                required
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Cpu className="h-3 w-3 text-slate-400" /> vCPU
              </Label>
              <Input
                type="number"
                min="1"
                max="128"
                value={vcpu}
                onChange={(e) => setVcpu(e.target.value)}
                required
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <HardDrive className="h-3 w-3 text-slate-400" /> RAM (GB)
              </Label>
              <Input
                type="number"
                min="1"
                max="512"
                value={ramGb}
                onChange={(e) => setRamGb(e.target.value)}
                required
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <HardDrive className="h-3 w-3 text-indigo-500" /> Disk (GB)
              </Label>
              <Input
                type="number"
                min="10"
                max="10000"
                value={storageGb}
                onChange={(e) => setStorageGb(e.target.value)}
                required
                className="h-9"
              />
            </div>
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
              Provision Nodes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
