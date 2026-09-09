"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Cpu, HardDrive, Layers, Server, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { updateApprovalK8sNodeGroup } from "@/app/actions/approval-actions";
import { K8sRequestNodeGroup } from "@/types/requests";

interface EditK8sRequestNodeGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: K8sRequestNodeGroup | null;
  onSuccess: () => void;
}

export function EditK8sRequestNodeGroupModal({
  open,
  onOpenChange,
  group,
  onSuccess,
}: EditK8sRequestNodeGroupModalProps) {
  const [role, setRole] = useState<"MASTER" | "WORKER">("WORKER");
  const [nodeCount, setNodeCount] = useState<number>(1);
  const [vcpu, setVcpu] = useState<number>(2);
  const [ramGb, setRamGb] = useState<number>(4);
  const [storageGb, setStorageGb] = useState<number>(50);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (group) {
      setRole((group.role as "MASTER" | "WORKER") || "WORKER");
      setNodeCount(group.nodeCount || 1);
      setVcpu(group.vcpu || 2);
      setRamGb(group.ramGb || 4);
      setStorageGb(group.storageGb || 50);
    }
  }, [group, open]);

  if (!group) return null;

  const totalVcpu = (nodeCount || 1) * (vcpu || 1);
  const totalRam = (nodeCount || 1) * (ramGb || 1);
  const totalStorage = (nodeCount || 1) * (storageGb || 10);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (nodeCount < 1) {
      toast.error("Node count must be at least 1");
      return;
    }
    if (vcpu < 1) {
      toast.error("vCPU must be at least 1");
      return;
    }
    if (ramGb < 1) {
      toast.error("RAM must be at least 1 GB");
      return;
    }
    if (storageGb < 10) {
      toast.error("Storage must be at least 10 GB");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await updateApprovalK8sNodeGroup({
        groupId: group.id,
        role,
        nodeCount,
        vcpu,
        ramGb,
        storageGb,
      });

      if (res.success) {
        toast.success(res.message || "Node group specs updated successfully");
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(res.error || "Failed to update node group specs");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden">
        <DialogHeader className="p-6 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center gap-2 text-indigo-700">
            <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                Customize Node Group Specifications
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Adjust allocated compute, memory, disk, and node count for this namespace group.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-4">
            {/* Role & Node Count */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="node-role" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Node Role
                </Label>
                <Select value={role} onValueChange={(val: "MASTER" | "WORKER") => setRole(val)}>
                  <SelectTrigger id="node-role" className="h-9">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MASTER">MASTER / CONTROL</SelectItem>
                    <SelectItem value="WORKER">WORKER</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="node-count" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <Layers className="h-3 w-3 text-slate-400" /> Node Count
                </Label>
                <Input
                  id="node-count"
                  type="number"
                  min={1}
                  max={50}
                  value={nodeCount}
                  onChange={(e) => setNodeCount(Math.max(1, parseInt(e.target.value) || 1))}
                  required
                  className="h-9 font-semibold"
                />
              </div>
            </div>

            {/* Per-Node Specs: vCPU, RAM, Disk */}
            <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-3">
              <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Per-Node Resource Sizing
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="node-vcpu" className="text-[11px] font-medium text-slate-600 flex items-center gap-1">
                    <Cpu className="h-3 w-3 text-slate-400" /> vCPU Cores
                  </Label>
                  <Input
                    id="node-vcpu"
                    type="number"
                    min={1}
                    max={128}
                    value={vcpu}
                    onChange={(e) => setVcpu(Math.max(1, parseInt(e.target.value) || 1))}
                    required
                    className="h-8 text-xs font-semibold bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="node-ram" className="text-[11px] font-medium text-slate-600 flex items-center gap-1">
                    <HardDrive className="h-3 w-3 text-slate-400" /> RAM (GB)
                  </Label>
                  <Input
                    id="node-ram"
                    type="number"
                    min={1}
                    max={1024}
                    value={ramGb}
                    onChange={(e) => setRamGb(Math.max(1, parseInt(e.target.value) || 1))}
                    required
                    className="h-8 text-xs font-semibold bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="node-storage" className="text-[11px] font-medium text-slate-600 flex items-center gap-1">
                    <HardDrive className="h-3 w-3 text-indigo-500" /> Disk (GB)
                  </Label>
                  <Input
                    id="node-storage"
                    type="number"
                    min={10}
                    max={10000}
                    value={storageGb}
                    onChange={(e) => setStorageGb(Math.max(10, parseInt(e.target.value) || 10))}
                    required
                    className="h-8 text-xs font-semibold bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Calculated Total Summary for this group */}
            <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-1 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-indigo-900 text-[11px]">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600" /> Group Total Allocation ({nodeCount} {nodeCount === 1 ? "Node" : "Nodes"}):
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 text-indigo-800 font-semibold text-xs">
                <span>{totalVcpu} vCPU Total</span>
                <span>{totalRam} GB RAM Total</span>
                <span>{totalStorage} GB Disk Total</span>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Saving...
                </>
              ) : (
                "Save Spec Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
