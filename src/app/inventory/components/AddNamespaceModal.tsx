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
import { Plus, Loader2, Box, Network, Layers, HardDrive, Server, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createK8sNamespace, CreateK8sNamespaceNodeGroupInput } from "@/app/actions/k8s-actions";

interface AddNamespaceModalProps {
  onCreated?: () => void;
}

export function AddNamespaceModal({ onCreated }: AddNamespaceModalProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Namespace identity
  const [name, setName] = useState("");
  const [supervisorIp, setSupervisorIp] = useState("");
  const [clusterName, setClusterName] = useState("");
  const [totalSpaceGb, setTotalSpaceGb] = useState("");

  // Subdomain & Ingress IP
  const [subdomain, setSubdomain] = useState("");
  const [subdomainIp, setSubdomainIp] = useState("");

  // Node inputs
  const [includeMaster, setIncludeMaster] = useState(true);
  const [masterCount, setMasterCount] = useState("1");
  const [masterVcpu, setMasterVcpu] = useState("4");
  const [masterRam, setMasterRam] = useState("8");

  const [includeWorker, setIncludeWorker] = useState(true);
  const [workerCount, setWorkerCount] = useState("2");
  const [workerVcpu, setWorkerVcpu] = useState("8");
  const [workerRam, setWorkerRam] = useState("16");

  const resetForm = () => {
    setName("");
    setSupervisorIp("");
    setClusterName("");
    setTotalSpaceGb("");
    setSubdomain("");
    setSubdomainIp("");
    setIncludeMaster(true);
    setMasterCount("1");
    setMasterVcpu("4");
    setMasterRam("8");
    setIncludeWorker(true);
    setWorkerCount("2");
    setWorkerVcpu("8");
    setWorkerRam("16");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const cleanName = name.trim().toLowerCase();
    const cleanIp = supervisorIp.trim();

    if (!cleanName) {
      toast.error("Namespace name is required");
      return;
    }

    const k8sRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
    if (!k8sRegex.test(cleanName)) {
      toast.error("Namespace name must be lowercase alphanumeric and can include hyphens (RFC 1123 format)");
      return;
    }

    if (!cleanIp) {
      toast.error("Supervisor IP is required");
      return;
    }

    const nodeGroups: CreateK8sNamespaceNodeGroupInput[] = [];

    if (includeMaster) {
      const count = parseInt(masterCount, 10);
      if (count > 0) {
        nodeGroups.push({
          role: "MASTER",
          nodeCount: count,
          vcpu: parseInt(masterVcpu, 10) || 4,
          ramGb: parseInt(masterRam, 10) || 8,
        });
      }
    }

    if (includeWorker) {
      const count = parseInt(workerCount, 10);
      if (count > 0) {
        nodeGroups.push({
          role: "WORKER",
          nodeCount: count,
          vcpu: parseInt(workerVcpu, 10) || 8,
          ramGb: parseInt(workerRam, 10) || 16,
        });
      }
    }

    startTransition(async () => {
      try {
        const res = await createK8sNamespace({
          name: cleanName,
          supervisorIp: cleanIp,
          clusterName: clusterName.trim() || undefined,
          totalSpaceGb: totalSpaceGb ? parseInt(totalSpaceGb, 10) : undefined,
          subdomain: subdomain.trim() || undefined,
          subdomainIp: subdomainIp.trim() || undefined,
          nodeGroups,
        });

        if (res.success) {
          toast.success(`Namespace "${cleanName}" created successfully`);
          setOpen(false);
          resetForm();
          onCreated?.();
        } else {
          toast.error(res.message || "Failed to create namespace");
        }
      } catch (error) {
        console.error("Failed to create namespace:", error);
        toast.error(error instanceof Error ? error.message : "Failed to create namespace");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetForm(); }}>
      <DialogTrigger asChild>
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-100 gap-2 h-10 px-5 font-semibold">
          <Plus className="h-4 w-4" /> Add Namespace
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-6 bg-slate-50/80 border-b border-slate-100 flex-shrink-0">
          <DialogTitle className="text-lg font-bold flex items-center gap-2 text-slate-900">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Box className="h-5 w-5" />
            </div>
            Add Kubernetes Namespace
          </DialogTitle>
          <DialogDescription className="text-slate-500 text-xs mt-1">
            Provision a new Kubernetes namespace, cluster parameters, and initial node groups.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Namespace Identity */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
              <Box className="h-3.5 w-3.5 text-indigo-600" />
              Namespace & Network Parameters
            </h4>

            <div className="space-y-1.5">
              <Label htmlFor="namespace-name" className="text-xs font-bold text-slate-700">
                Namespace Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="namespace-name"
                placeholder="e.g. dghs-apps-prod"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-10 bg-white border-slate-200 focus-visible:ring-indigo-500 font-mono text-sm"
              />
              <p className="text-[11px] text-slate-400">
                Lowercase letters, numbers, and hyphens (RFC 1123, e.g. <code className="text-indigo-600">health-analytics-prod</code>)
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="supervisor-ip" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Network className="h-3.5 w-3.5 text-indigo-600" />
                Supervisor IP Address <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="supervisor-ip"
                placeholder="e.g. 172.16.18.50"
                value={supervisorIp}
                onChange={(e) => setSupervisorIp(e.target.value)}
                required
                className="h-10 bg-white border-slate-200 focus-visible:ring-indigo-500 font-mono text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="cluster-name" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-slate-400" />
                  Cluster Name <span className="text-slate-400 font-normal text-[10px]">(Optional)</span>
                </Label>
                <Input
                  id="cluster-name"
                  placeholder="e.g. dghs-apps-cluster"
                  value={clusterName}
                  onChange={(e) => setClusterName(e.target.value)}
                  className="h-10 bg-white border-slate-200 focus-visible:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="space-capacity" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <HardDrive className="h-3.5 w-3.5 text-slate-400" />
                  Cluster Storage (GB) <span className="text-slate-400 font-normal text-[10px]">(Optional)</span>
                </Label>
                <Input
                  id="space-capacity"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 500"
                  value={totalSpaceGb}
                  onChange={(e) => setTotalSpaceGb(e.target.value)}
                  className="h-10 bg-white border-slate-200 focus-visible:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Subdomain & Ingress Route Section */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
              <Globe className="h-3.5 w-3.5 text-indigo-600" />
              Ingress Subdomain & IP Address <span className="text-slate-400 font-normal text-[10px] normal-case">(Optional)</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="namespace-subdomain" className="text-xs font-bold text-slate-700">
                  Subdomain / Host
                </Label>
                <Input
                  id="namespace-subdomain"
                  placeholder="e.g. portal.dghs.gov.bd or portal"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value)}
                  className="h-10 bg-white border-slate-200 focus-visible:ring-indigo-500 font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="namespace-subdomain-ip" className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Network className="h-3.5 w-3.5 text-slate-400" />
                  Ingress / External IP Address
                </Label>
                <Input
                  id="namespace-subdomain-ip"
                  placeholder="e.g. 103.20.10.15"
                  value={subdomainIp}
                  onChange={(e) => setSubdomainIp(e.target.value)}
                  className="h-10 bg-white border-slate-200 focus-visible:ring-indigo-500 font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* Node Inputs Section */}
          <div className="space-y-4 pt-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
              <Server className="h-3.5 w-3.5 text-indigo-600" />
              Node Group Topology & Provisioning
            </h4>

            {/* Master Node Group Card */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="include-master"
                    checked={includeMaster}
                    onChange={(e) => setIncludeMaster(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <Label htmlFor="include-master" className="text-xs font-bold text-slate-800 uppercase tracking-wide cursor-pointer">
                    Master Node Group
                  </Label>
                </div>
                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold border border-indigo-150">
                  Control Plane
                </span>
              </div>

              {includeMaster && (
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div>
                    <Label className="text-[10px] font-bold uppercase text-slate-500">Node Count</Label>
                    <Input
                      type="number"
                      min="1"
                      value={masterCount}
                      onChange={(e) => setMasterCount(e.target.value)}
                      className="h-9 bg-white border-slate-200 mt-1"
                      required={includeMaster}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold uppercase text-slate-500">vCPUs / Node</Label>
                    <Input
                      type="number"
                      min="1"
                      value={masterVcpu}
                      onChange={(e) => setMasterVcpu(e.target.value)}
                      className="h-9 bg-white border-slate-200 mt-1"
                      required={includeMaster}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold uppercase text-slate-500">RAM (GB) / Node</Label>
                    <Input
                      type="number"
                      min="1"
                      value={masterRam}
                      onChange={(e) => setMasterRam(e.target.value)}
                      className="h-9 bg-white border-slate-200 mt-1"
                      required={includeMaster}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Worker Node Group Card */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="include-worker"
                    checked={includeWorker}
                    onChange={(e) => setIncludeWorker(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <Label htmlFor="include-worker" className="text-xs font-bold text-slate-800 uppercase tracking-wide cursor-pointer">
                    Worker Node Group
                  </Label>
                </div>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold border border-emerald-150">
                  Application Workload
                </span>
              </div>

              {includeWorker && (
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div>
                    <Label className="text-[10px] font-bold uppercase text-slate-500">Node Count</Label>
                    <Input
                      type="number"
                      min="1"
                      value={workerCount}
                      onChange={(e) => setWorkerCount(e.target.value)}
                      className="h-9 bg-white border-slate-200 mt-1"
                      required={includeWorker}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold uppercase text-slate-500">vCPUs / Node</Label>
                    <Input
                      type="number"
                      min="1"
                      value={workerVcpu}
                      onChange={(e) => setWorkerVcpu(e.target.value)}
                      className="h-9 bg-white border-slate-200 mt-1"
                      required={includeWorker}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold uppercase text-slate-500">RAM (GB) / Node</Label>
                    <Input
                      type="number"
                      min="1"
                      value={workerRam}
                      onChange={(e) => setWorkerRam(e.target.value)}
                      className="h-9 bg-white border-slate-200 mt-1"
                      required={includeWorker}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2 flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setOpen(false); resetForm(); }}
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
              {isPending ? "Provisioning Namespace & Nodes..." : "Create Namespace"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
