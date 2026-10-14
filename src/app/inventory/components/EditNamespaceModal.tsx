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
import { Edit2, Loader2, Box, Network, Layers, HardDrive } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { updateK8sNamespace } from "@/app/actions/k8s-actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getUserExistingSystems } from "@/app/actions/vm-management-actions";
import { resolveK8sSystemName } from "@/lib/system-utils";

interface EditNamespaceModalProps {
  namespace: {
    id: string;
    name: string;
    supervisorIp: string;
    clusters?: {
      clusterName?: string;
      totalSpaceGb?: number | null;
      request?: {
        systemName?: string | null;
        projectName?: string | null;
      } | null;
    }[];
    requests?: {
      systemName?: string | null;
      projectName?: string | null;
    }[];
  };
  onUpdated?: () => void;
}

export function EditNamespaceModal({ namespace, onUpdated }: EditNamespaceModalProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const cluster = namespace.clusters?.[0];

  const [name, setName] = useState(namespace.name);
  const [supervisorIp, setSupervisorIp] = useState(namespace.supervisorIp);
  const [clusterName, setClusterName] = useState(cluster?.clusterName || "");
  const [totalSpaceGb, setTotalSpaceGb] = useState(cluster?.totalSpaceGb ? String(cluster.totalSpaceGb) : "");

  // System selection state
  const [systemMode, setSystemMode] = useState<"EXISTING" | "NEW" | "STANDALONE">("EXISTING");
  const [selectedExistingSystem, setSelectedExistingSystem] = useState("");
  const [customSystemName, setCustomSystemName] = useState("");
  const [existingSystems, setExistingSystems] = useState<{ systemName: string; activeVmCount: number }[]>([]);

  const handleOpen = (val: boolean) => {
    setOpen(val);
    if (val) {
      setName(namespace.name);
      setSupervisorIp(namespace.supervisorIp);
      setClusterName(cluster?.clusterName || "");
      setTotalSpaceGb(cluster?.totalSpaceGb ? String(cluster.totalSpaceGb) : "");

      const currentSys = resolveK8sSystemName(namespace);
      getUserExistingSystems()
        .then((systems) => {
          setExistingSystems(systems);
          if (currentSys) {
            const exists = systems.some((s) => s.systemName.toLowerCase() === currentSys.toLowerCase());
            if (exists) {
              setSystemMode("EXISTING");
              const exact = systems.find((s) => s.systemName.toLowerCase() === currentSys.toLowerCase());
              setSelectedExistingSystem(exact ? exact.systemName : currentSys);
            } else {
              setSystemMode("NEW");
              setCustomSystemName(currentSys);
            }
          } else {
            setSystemMode("STANDALONE");
            setSelectedExistingSystem(systems.length > 0 ? systems[0].systemName : "");
            setCustomSystemName("");
          }
        })
        .catch((err) => console.error("Failed to load existing systems:", err));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const cleanName = name.trim().toLowerCase();
    const cleanIp = supervisorIp.trim();

    if (!cleanName) {
      toast.error("Namespace name is required");
      return;
    }

    if (!cleanIp) {
      toast.error("Supervisor IP is required");
      return;
    }

    let finalSystemName = "";
    if (systemMode === "EXISTING") {
      finalSystemName = selectedExistingSystem;
    } else if (systemMode === "NEW") {
      finalSystemName = customSystemName.trim();
    } else {
      finalSystemName = "";
    }

    startTransition(async () => {
      try {
        const res = await updateK8sNamespace(namespace.id, {
          name: cleanName,
          supervisorIp: cleanIp,
          clusterName: clusterName.trim() || undefined,
          totalSpaceGb: totalSpaceGb ? parseInt(totalSpaceGb, 10) : undefined,
          systemName: finalSystemName,
        });

        if (res.success) {
          toast.success("Namespace updated successfully");
          setOpen(false);
          onUpdated?.();
        } else {
          toast.error(res.message || "Failed to update namespace");
        }
      } catch (error) {
        console.error("Failed to update namespace:", error);
        toast.error(error instanceof Error ? error.message : "Failed to update namespace");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2.5 text-xs text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 shadow-sm gap-1"
          title="Edit Namespace"
        >
          <Edit2 className="h-3.5 w-3.5" />
          <span>Edit</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-6 bg-slate-50/80 border-b border-slate-100 flex-shrink-0">
          <DialogTitle className="text-lg font-bold flex items-center gap-2 text-slate-900">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Box className="h-5 w-5" />
            </div>
            Edit Kubernetes Namespace
          </DialogTitle>
          <DialogDescription className="text-slate-500 text-xs mt-1">
            Update configuration, network supervisor IP, system assignment, and cluster parameters.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* System / Project Fleet Assignment */}
          <div className="space-y-2 bg-slate-50/70 p-3 rounded-lg border border-slate-200/80">
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-system-name" className="text-xs font-bold text-slate-700">
                System / Project Fleet
              </Label>
              <div className="flex items-center gap-1 bg-slate-200/60 p-0.5 rounded-lg text-[10px]">
                <button
                  type="button"
                  onClick={() => {
                    setSystemMode("EXISTING");
                    if (!selectedExistingSystem && existingSystems.length > 0) {
                      setSelectedExistingSystem(existingSystems[0].systemName);
                    }
                  }}
                  className={`px-2 py-0.5 rounded font-semibold transition-all ${
                    systemMode === "EXISTING"
                      ? "bg-white text-indigo-600 shadow-2xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Existing
                </button>
                <button
                  type="button"
                  onClick={() => setSystemMode("NEW")}
                  className={`px-2 py-0.5 rounded font-semibold transition-all ${
                    systemMode === "NEW"
                      ? "bg-white text-indigo-600 shadow-2xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  + New
                </button>
                <button
                  type="button"
                  onClick={() => setSystemMode("STANDALONE")}
                  className={`px-2 py-0.5 rounded font-semibold transition-all ${
                    systemMode === "STANDALONE"
                      ? "bg-white text-slate-800 shadow-2xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  None
                </button>
              </div>
            </div>

            {systemMode === "EXISTING" && (
              <Select
                value={selectedExistingSystem}
                onValueChange={(val) => {
                  if (val === "__NEW__") {
                    setSystemMode("NEW");
                  } else if (val === "__STANDALONE__") {
                    setSystemMode("STANDALONE");
                  } else {
                    setSelectedExistingSystem(val);
                  }
                }}
              >
                <SelectTrigger className="bg-white text-xs h-9">
                  <SelectValue placeholder="Choose existing fleet..." />
                </SelectTrigger>
                <SelectContent>
                  {existingSystems.map((sys) => (
                    <SelectItem key={sys.systemName} value={sys.systemName} className="text-xs">
                      {sys.systemName} ({sys.activeVmCount} active instances)
                    </SelectItem>
                  ))}
                  <SelectItem value="__NEW__" className="text-indigo-600 font-bold border-t mt-1 text-xs">
                    + Type a new system name...
                  </SelectItem>
                  <SelectItem value="__STANDALONE__" className="text-slate-500 border-t text-xs">
                    ⚪ None (Standalone / Direct Provisioning)
                  </SelectItem>
                </SelectContent>
              </Select>
            )}

            {systemMode === "NEW" && (
              <Input
                id="edit-custom-system-name"
                value={customSystemName}
                onChange={(e) => setCustomSystemName(e.target.value)}
                placeholder="Enter system name (e.g. Core Banking Platform)..."
                className="bg-white text-xs h-9"
                autoFocus
              />
            )}

            {systemMode === "STANDALONE" && (
              <div className="p-2 rounded-md bg-white border border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Standalone (Direct Provisioning - No multi-node system)</span>
                <button
                  type="button"
                  onClick={() => setSystemMode("EXISTING")}
                  className="text-indigo-600 font-semibold hover:underline"
                >
                  Assign to Fleet
                </button>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-namespace-name" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Namespace Name <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="edit-namespace-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-10 bg-white border-slate-200 focus-visible:ring-indigo-500 font-mono text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-supervisor-ip" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Network className="h-3.5 w-3.5 text-indigo-600" />
              Supervisor IP Address <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="edit-supervisor-ip"
              value={supervisorIp}
              onChange={(e) => setSupervisorIp(e.target.value)}
              required
              className="h-10 bg-white border-slate-200 focus-visible:ring-indigo-500 font-mono text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div className="space-y-1.5">
              <Label htmlFor="edit-cluster-name" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-slate-400" />
                Cluster Name
              </Label>
              <Input
                id="edit-cluster-name"
                value={clusterName}
                onChange={(e) => setClusterName(e.target.value)}
                className="h-10 bg-white border-slate-200 focus-visible:ring-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-total-space" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <HardDrive className="h-3.5 w-3.5 text-slate-400" />
                Storage Space (GB)
              </Label>
              <Input
                id="edit-total-space"
                type="number"
                min="0"
                value={totalSpaceGb}
                onChange={(e) => setTotalSpaceGb(e.target.value)}
                className="h-10 bg-white border-slate-200 focus-visible:ring-indigo-500"
              />
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
              className="h-10 border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-5 gap-2 font-semibold shadow-sm"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? "Updating..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
