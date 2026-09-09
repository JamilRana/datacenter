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
import { Settings2, Loader2, Cpu, HardDrive } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { updateK8sNodeGroup } from "@/app/actions/k8s-actions";

interface EditNodeGroupModalProps {
  group: {
    id: string;
    role: string;
    vcpu: number;
    ramGb: number;
    storageGb?: number | null;
  };
  onUpdated?: () => void;
}

export function EditNodeGroupModal({ group, onUpdated }: EditNodeGroupModalProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [vcpu, setVcpu] = useState(String(group.vcpu || 4));
  const [ramGb, setRamGb] = useState(String(group.ramGb || 8));
  const [storageGb, setStorageGb] = useState(String(group.storageGb || 50));

  const handleOpen = (val: boolean) => {
    setOpen(val);
    if (val) {
      setVcpu(String(group.vcpu || 4));
      setRamGb(String(group.ramGb || 8));
      setStorageGb(String(group.storageGb || 50));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const cpu = parseInt(vcpu, 10);
    const ram = parseInt(ramGb, 10);
    const storage = parseInt(storageGb, 10);

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
        const res = await updateK8sNodeGroup(group.id, {
          vcpu: cpu,
          ramGb: ram,
          storageGb: storage,
        });

        if (res.success) {
          toast.success(res.message);
          setOpen(false);
          onUpdated?.();
        } else {
          toast.error(res.message || "Failed to update node group");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update node group");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-[11px] text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 gap-1"
          title="Edit Group Specs"
          onClick={(e) => e.stopPropagation()}
        >
          <Settings2 className="h-3 w-3" />
          <span>Specs</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden">
        <DialogHeader className="p-6 bg-slate-50 border-b border-slate-100">
          <DialogTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Cpu className="h-4 w-4" />
            </div>
            Edit {group.role} Pool Specs
          </DialogTitle>
          <DialogDescription className="text-slate-500 text-xs mt-1">
            Update CPU and RAM allocation across nodes in this group.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-group-vcpu" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Cpu className="h-3 w-3 text-slate-400" /> vCPU
              </Label>
              <Input
                id="edit-group-vcpu"
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
              <Label htmlFor="edit-group-ram" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <HardDrive className="h-3 w-3 text-slate-400" /> RAM (GB)
              </Label>
              <Input
                id="edit-group-ram"
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
              <Label htmlFor="edit-group-storage" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <HardDrive className="h-3 w-3 text-indigo-500" /> Disk (GB)
              </Label>
              <Input
                id="edit-group-storage"
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
              Save Specs
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
