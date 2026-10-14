// src/app/inventory/components/AssignSystemModal.tsx
"use client";

import { useEffect, useState, useTransition } from "react";
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
import { Loader2, Layers, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  getUserExistingSystems,
  reassignVmSystem,
  renameEntireSystem,
} from "@/app/actions/vm-management-actions";
import { formatSystemName, normalizeSystemName } from "@/lib/system-utils";

interface AssignSystemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vmId: string;
  currentSystemName?: string | null;
  isAdmin: boolean;
  onSuccess: (newSystemName: string) => void;
}

interface SystemOption {
  systemName: string;
  activeVmCount: number;
  vcpu: number;
  ramGb: number;
  storageGb: number;
  hostnames: string[];
}

export function AssignSystemModal({
  open,
  onOpenChange,
  vmId,
  currentSystemName,
  isAdmin: _isAdmin,
  onSuccess,
}: AssignSystemModalProps) {
  const [mode, setMode] = useState<"REASSIGN" | "RENAME">("REASSIGN");
  const [existingSystems, setExistingSystems] = useState<SystemOption[]>([]);
  const [isLoadingSystems, setIsLoadingSystems] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Reassign state
  const [reassignType, setReassignType] = useState<"EXISTING" | "NEW" | "STANDALONE">("EXISTING");
  const [selectedSystem, setSelectedSystem] = useState<string>("");
  const [customNewSystem, setCustomNewSystem] = useState<string>("");

  // Rename state
  const [renameTargetName, setRenameTargetName] = useState<string>("");

  const hasCurrentSystem = !!currentSystemName && currentSystemName.trim().length > 0;

  useEffect(() => {
    if (open) {
      setMode("REASSIGN");
      setCustomNewSystem("");
      setRenameTargetName(currentSystemName ? formatSystemName(currentSystemName) : "");
      
      setIsLoadingSystems(true);
      getUserExistingSystems()
        .then((systems) => {
          setExistingSystems(systems);
          if (systems.length > 0) {
            // Find if current system exists in list
            const found = systems.find(
              (s) => normalizeSystemName(s.systemName) === normalizeSystemName(currentSystemName)
            );
            setSelectedSystem(found ? found.systemName : systems[0].systemName);
            setReassignType("EXISTING");
          } else {
            setReassignType("NEW");
          }
        })
        .catch((err) => {
          console.error("Failed to load existing systems", err);
        })
        .finally(() => {
          setIsLoadingSystems(false);
        });
    }
  }, [open, currentSystemName]);

  const handleReassignSubmit = () => {
    let targetName = "";
    if (reassignType === "EXISTING") {
      targetName = selectedSystem.trim();
      if (!targetName) {
        toast.error("Please select a system");
        return;
      }
    } else if (reassignType === "NEW") {
      targetName = customNewSystem.trim();
      if (!targetName) {
        toast.error("Please enter a new system name");
        return;
      }
      // Check if matches an existing system
      const match = existingSystems.find(
        (s) => normalizeSystemName(s.systemName) === normalizeSystemName(targetName)
      );
      if (match) {
        targetName = match.systemName;
      }
    } else {
      // Standalone / unassigned
      targetName = "";
    }

    startTransition(async () => {
      try {
        const res = await reassignVmSystem(vmId, targetName);
        if (res.success) {
          toast.success(
            targetName
              ? `VM assigned to ${formatSystemName(targetName)}`
              : "VM set as Standalone (Unassigned)"
          );
          onSuccess(targetName ? formatSystemName(targetName) : "");
          onOpenChange(false);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to reassign VM");
      }
    });
  };

  const handleRenameSubmit = () => {
    if (!hasCurrentSystem) return;
    const cleanOld = formatSystemName(currentSystemName);
    const cleanNew = formatSystemName(renameTargetName);

    if (!cleanNew) {
      toast.error("New system name cannot be empty");
      return;
    }

    if (normalizeSystemName(cleanOld) === normalizeSystemName(cleanNew)) {
      toast.error("New system name must be different from current name");
      return;
    }

    startTransition(async () => {
      try {
        const res = await renameEntireSystem(cleanOld, cleanNew);
        if (res.success) {
          toast.success(`Renamed system "${cleanOld}" to "${cleanNew}" (${res.affectedCount} VMs updated)`);
          onSuccess(cleanNew);
          onOpenChange(false);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to rename system");
      }
    });
  };

  const selectedSysInfo = existingSystems.find(
    (s) => normalizeSystemName(s.systemName) === normalizeSystemName(selectedSystem)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Layers className="h-5 w-5 text-indigo-600" />
            Manage System Assignment
          </DialogTitle>
          <DialogDescription>
            {hasCurrentSystem ? (
              <span>
                Currently assigned to: <strong className="text-slate-800">{formatSystemName(currentSystemName)}</strong>
              </span>
            ) : (
              <span className="text-amber-600 font-medium">Currently Standalone / Unassigned</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Tab switch between Reassign and Rename */}
        <div className="flex border-b border-slate-200 mt-2 mb-4">
          <button
            type="button"
            onClick={() => setMode("REASSIGN")}
            className={`flex-1 pb-2 text-xs font-bold border-b-2 transition-all ${
              mode === "REASSIGN"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Assign This VM
          </button>
          {hasCurrentSystem && (
            <button
              type="button"
              onClick={() => setMode("RENAME")}
              className={`flex-1 pb-2 text-xs font-bold border-b-2 transition-all ${
                mode === "RENAME"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Rename Entire System
            </button>
          )}
        </div>

        {mode === "REASSIGN" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700">Choose Assignment Option</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={reassignType === "EXISTING" ? "default" : "outline"}
                  size="sm"
                  disabled={existingSystems.length === 0}
                  onClick={() => setReassignType("EXISTING")}
                  className={`text-xs h-9 ${reassignType === "EXISTING" ? "bg-indigo-600 text-white" : ""}`}
                >
                  Existing System
                </Button>
                <Button
                  type="button"
                  variant={reassignType === "NEW" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setReassignType("NEW")}
                  className={`text-xs h-9 ${reassignType === "NEW" ? "bg-indigo-600 text-white" : ""}`}
                >
                  New System
                </Button>
                <Button
                  type="button"
                  variant={reassignType === "STANDALONE" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setReassignType("STANDALONE")}
                  className={`text-xs h-9 ${reassignType === "STANDALONE" ? "bg-slate-800 text-white" : ""}`}
                >
                  Standalone
                </Button>
              </div>
            </div>

            {reassignType === "EXISTING" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-600">Select System</Label>
                  {isLoadingSystems ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400 p-2 border rounded-md">
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                      Loading systems...
                    </div>
                  ) : (
                    <Select value={selectedSystem} onValueChange={setSelectedSystem}>
                      <SelectTrigger className="text-xs h-9">
                        <SelectValue placeholder="Choose a system..." />
                      </SelectTrigger>
                      <SelectContent>
                        {existingSystems.map((sys) => (
                          <SelectItem key={sys.systemName} value={sys.systemName} className="text-xs">
                            {sys.systemName} ({sys.activeVmCount} active VMs)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {selectedSysInfo && (
                  <div className="p-3 rounded-lg bg-indigo-50/70 border border-indigo-100 text-xs space-y-1">
                    <p className="font-bold text-indigo-950 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600" />
                      {selectedSysInfo.systemName} Fleet:
                    </p>
                    <p className="text-slate-600">
                      Currently has <strong>{selectedSysInfo.activeVmCount} active VMs</strong> ({selectedSysInfo.vcpu} vCPU, {selectedSysInfo.ramGb} GB RAM, {selectedSysInfo.storageGb} GB Storage).
                    </p>
                    {selectedSysInfo.hostnames.length > 0 && (
                      <p className="text-[11px] text-slate-500 truncate">
                        Nodes: {selectedSysInfo.hostnames.join(", ")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {reassignType === "NEW" && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-600">New System Name</Label>
                <Input
                  placeholder="e.g. Core Banking Platform"
                  value={customNewSystem}
                  onChange={(e) => setCustomNewSystem(e.target.value)}
                  className="h-9 text-xs"
                />
                <p className="text-[11px] text-slate-400">
                  This will establish a new logical system group and assign this VM as its first node.
                </p>
              </div>
            )}

            {reassignType === "STANDALONE" && (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800">Remove from System Grouping</p>
                <p>
                  This VM will not belong to any logical system and will be classified as Standalone in reports and filters.
                </p>
              </div>
            )}

            <DialogFooter className="mt-4 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleReassignSubmit}
                disabled={isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                Confirm Assignment
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                Atomic System Rename
              </p>
              <p>
                This will rename system <strong>&ldquo;{formatSystemName(currentSystemName)}&rdquo;</strong> across all VMs and active tickets associated with it.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">New System Name</Label>
              <Input
                value={renameTargetName}
                onChange={(e) => setRenameTargetName(e.target.value)}
                placeholder="Enter new system name..."
                className="h-9 text-xs"
              />
            </div>

            <DialogFooter className="mt-4 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleRenameSubmit}
                disabled={isPending || !renameTargetName.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                Rename All VMs in System
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
