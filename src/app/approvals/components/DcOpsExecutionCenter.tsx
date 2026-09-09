"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Server, 
  Shield, 
  Layers, 
  Globe, 
  CheckCircle2, 
  Clock, 
  Cpu, 
  HardDrive, 
  ArrowRight,
  ExternalLink,
  PlusCircle,
  Sparkles,
  Info,
  CheckCircle,
  Network,
  Trash2,
  AlertOctagon,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProvisionVMModal } from "./ProvisionVMModal";
import { ProvisionVpnModal } from "./ProvisionVpnModal";
import { ProvisionAccessModal } from "./ProvisionAccessModal";
import { ProvisionK8sModal } from "./ProvisionK8sModal";
import { executeRequest } from "@/app/actions/approval-actions";
import { toast } from "sonner";

interface DcOpsExecutionCenterProps {
  request: any;
  onRefresh: () => void;
}

export function DcOpsExecutionCenter({ request, onRefresh }: DcOpsExecutionCenterProps) {
  // Modal states
  const [vmModalOpen, setVmModalOpen] = useState(false);
  const [targetSpecId, setTargetSpecId] = useState<string | null>(null);
  const [targetSequenceNumber, setTargetSequenceNumber] = useState<number | null>(null);

  const [vpnModalOpen, setVpnModalOpen] = useState(false);
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [k8sModalOpen, setK8sModalOpen] = useState(false);
  const [isExecutingFinal, setIsExecutingFinal] = useState(false);

  // Request type differentiation
  const isVmProvisioningRequest = request.requestType === "NEW_VM" || request.requestType === "CLONE_VM";
  const isDecommissionRequest = request.requestType === "DECOMMISSION";
  const isUpgradeRequest = request.requestType === "SYSTEM_UPGRADE";
  const isRenewalRequest = request.requestType === "RENEWAL";
  const isK8sRequest = request.requestType === "K8S_NAMESPACE";

  const targetVm = request.targetVm || (request.vmInstances && request.vmInstances[0]) || null;
  const isDecommissionFulfilled = request.status === "CLOSED" || targetVm?.status === "RETIRED";
  const isUpgradeFulfilled = request.status === "PROVISIONED" || request.status === "CLOSED";
  const isRenewalFulfilled = request.status === "PROVISIONED" || request.status === "CLOSED";

  // 1. VM specifications and instances calculation (ONLY for NEW_VM and CLONE_VM)
  const vmSpecs: any[] = isVmProvisioningRequest ? (request.vmSpecifications || []) : [];
  const vmInstances: any[] = isVmProvisioningRequest ? (request.vmInstances || []) : [];
  const totalVmCount = isVmProvisioningRequest ? Math.max(request.quantity || 1, vmSpecs.length) : 0;
  const provisionedVmCount = isVmProvisioningRequest ? vmInstances.length : 0;
  const pendingVmCount = Math.max(0, totalVmCount - provisionedVmCount);

  // 2. VPN requirement calculation
  const hasVpnRequirement = Boolean(
    request.vpnRequired ||
    request.requestType === "VPN_ACCESS" ||
    vmSpecs.some((s: any) => s.connectivity?.some((c: any) => c.accessType === "VPN"))
  );

  // Find all active VPN assignments across VMs or request resources
  const vpnAssignments = [
    ...vmInstances.flatMap((v: any) => v.vpnAssignmentsNew || []),
    ...(request.requestResources?.flatMap((r: any) => r.vm?.vpnAssignmentsNew || r.namespace?.vpnAssignments || []) || []),
  ];
  // Deduplicate by id
  const uniqueVpnAssignments = Array.from(
    new Map(vpnAssignments.map((a: any) => [a.id, a])).values()
  );
  const isVpnFulfilled = !hasVpnRequirement || uniqueVpnAssignments.length > 0;

  // 3. Horizon requirement calculation
  const hasHorizonRequirement = request.requestType === "HORIZON_ACCESS";
  const horizonAssignments = [
    ...vmInstances.flatMap((v: any) => v.horizonAssignmentsNew || []),
    ...(request.requestResources?.flatMap((r: any) => r.vm?.horizonAssignmentsNew || r.namespace?.horizonAssignments || []) || []),
  ];
  const uniqueHorizonAssignments = Array.from(
    new Map(horizonAssignments.map((a: any) => [a.id, a])).values()
  );
  const isHorizonFulfilled = !hasHorizonRequirement || uniqueHorizonAssignments.length > 0;

  // 4. K8s namespace requirement calculation
  const hasK8sRequirement = Boolean(
    request.requestType === "K8S_NAMESPACE" ||
    request.kubernetesOption ||
    (request.k8sRequestNodeGroups && request.k8sRequestNodeGroups.length > 0)
  );
  const k8sClusters = (request.k8sClusters && request.k8sClusters.length > 0)
    ? request.k8sClusters
    : (request.existingNamespace?.clusters || []);
  const isK8sFulfilled = !hasK8sRequirement || k8sClusters.length > 0;

  // Total execution items and completion progress
  let totalTasks = 0;
  let completedTasks = 0;

  // VM Provisioning tasks (only for NEW_VM / CLONE_VM)
  if (isVmProvisioningRequest) {
    totalTasks += totalVmCount;
    completedTasks += provisionedVmCount;
  }

  // Decommission task
  if (isDecommissionRequest) {
    totalTasks += 1;
    if (isDecommissionFulfilled) completedTasks += 1;
  }

  // Upgrade task
  if (isUpgradeRequest) {
    totalTasks += 1;
    if (isUpgradeFulfilled) completedTasks += 1;
  }

  // Renewal task
  if (isRenewalRequest) {
    totalTasks += 1;
    if (isRenewalFulfilled) completedTasks += 1;
  }

  // VPN task
  if (hasVpnRequirement) {
    totalTasks += 1;
    if (uniqueVpnAssignments.length > 0) completedTasks += 1;
  }

  // Horizon task
  if (hasHorizonRequirement) {
    totalTasks += 1;
    if (uniqueHorizonAssignments.length > 0) completedTasks += 1;
  }

  // K8s task
  if (hasK8sRequirement) {
    totalTasks += 1;
    if (k8sClusters.length > 0) completedTasks += 1;
  }

  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;
  const isAllCompleted = completedTasks >= totalTasks && totalTasks > 0;

  const handleOpenSingleVmModal = (specId: string, seq: number) => {
    setTargetSpecId(specId);
    setTargetSequenceNumber(seq);
    setVmModalOpen(true);
  };

  const handleOpenBatchVmModal = () => {
    setTargetSpecId(null);
    setTargetSequenceNumber(null);
    setVmModalOpen(true);
  };

  const handleFinalExecute = async () => {
    const actionDesc = isDecommissionRequest
      ? "decommission and permanently retire this virtual machine"
      : isUpgradeRequest
      ? "apply this compute upgrade to the virtual machine"
      : isRenewalRequest
      ? "renew this virtual machine"
      : "mark this entire request execution as completed";

    if (!confirm(`Are you sure you want to ${actionDesc}?`)) return;
    setIsExecutingFinal(true);
    try {
      const res = await executeRequest(request.id);
      if (res.success) {
        toast.success(
          isDecommissionRequest
            ? "Virtual machine decommissioned successfully!"
            : isUpgradeRequest
            ? "Compute upgrade applied successfully!"
            : isRenewalRequest
            ? "VM validity renewed successfully!"
            : "Request execution marked as complete!"
        );
        onRefresh();
      } else {
        toast.error(res.error || "Failed to execute request");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to execute request");
    } finally {
      setIsExecutingFinal(false);
    }
  };

  return (
    <div className="space-y-8 bg-gradient-to-b from-slate-50 to-slate-100/50 p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm">
      {/* 1. Header & Summary Bar */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-200">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                  DC Ops Execution Center
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Process, fulfill, and monitor all multi-resource provisioning components
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg ${
                request.status === "PROVISIONED" || request.status === "CLOSED"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : request.status === "PARTIALLY_PROVISIONED"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-blue-50 text-blue-700 border-blue-200"
              }`}
            >
              {isDecommissionRequest && request.status === "CLOSED"
                ? "DECOMMISSIONED"
                : request.status.replace(/_/g, " ")}
            </Badge>

            {!isDecommissionFulfilled && !isUpgradeFulfilled && !isRenewalFulfilled && (isDecommissionRequest || isUpgradeRequest || isRenewalRequest) && (
              <Button
                onClick={handleFinalExecute}
                disabled={isExecutingFinal}
                className={`${
                  isDecommissionRequest
                    ? "bg-rose-600 hover:bg-rose-700 shadow-rose-200"
                    : isUpgradeRequest
                    ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"
                    : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
                } text-white font-bold shadow-md`}
              >
                {isDecommissionRequest ? <Trash2 className="w-4 h-4 mr-2" /> : isUpgradeRequest ? <Zap className="w-4 h-4 mr-2" /> : <Clock className="w-4 h-4 mr-2" />}
                {isExecutingFinal
                  ? "Processing..."
                  : isDecommissionRequest
                  ? "Execute Decommission"
                  : isUpgradeRequest
                  ? "Apply Upgrade"
                  : "Apply Renewal"}
              </Button>
            )}

            {isVmProvisioningRequest && isAllCompleted && request.status !== "PROVISIONED" && (
              <Button
                onClick={handleFinalExecute}
                disabled={isExecutingFinal}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-200"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {isExecutingFinal ? "Finalizing..." : "Complete Execution"}
              </Button>
            )}

            {isK8sRequest && isAllCompleted && request.status !== "PROVISIONED" && (
              <Button
                onClick={handleFinalExecute}
                disabled={isExecutingFinal}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-200"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {isExecutingFinal ? "Finalizing..." : "Complete Execution"}
              </Button>
            )}
          </div>
        </div>

        {/* Progress Bar & Resource Count Badges */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-700">
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-500" />
              Overall Execution Progress: {completedTasks} / {totalTasks} items completed
            </span>
            <span className="text-indigo-600 font-bold">{progressPercentage}%</span>
          </div>

          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                progressPercentage === 100 ? "bg-emerald-500" : "bg-indigo-600"
              }`}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {isVmProvisioningRequest && totalVmCount > 0 && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-800 text-xs font-semibold">
                <Server className="w-3.5 h-3.5 text-indigo-600" />
                <span>
                  {totalVmCount} VM{totalVmCount !== 1 ? "s" : ""} ({provisionedVmCount} Active, {pendingVmCount} Pending)
                </span>
              </div>
            )}

            {isDecommissionRequest && (
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-semibold ${
                isDecommissionFulfilled
                  ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                  : "bg-rose-50 border-rose-100 text-rose-800"
              }`}>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Decommission: {isDecommissionFulfilled ? "Retired & Closed" : "Pending Execution"}</span>
              </div>
            )}

            {isUpgradeRequest && (
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-semibold ${
                isUpgradeFulfilled
                  ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                  : "bg-indigo-50 border-indigo-100 text-indigo-800"
              }`}>
                <Cpu className="w-3.5 h-3.5" />
                <span>Compute Upgrade: {isUpgradeFulfilled ? "Applied" : "Pending Execution"}</span>
              </div>
            )}

            {isRenewalRequest && (
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-semibold ${
                isRenewalFulfilled
                  ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                  : "bg-amber-50 border-amber-100 text-amber-800"
              }`}>
                <Clock className="w-3.5 h-3.5" />
                <span>Validity Renewal: {isRenewalFulfilled ? "Renewed" : "Pending Execution"}</span>
              </div>
            )}

            {hasVpnRequirement && (
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-semibold ${
                isVpnFulfilled
                  ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                  : "bg-amber-50 border-amber-100 text-amber-800"
              }`}>
                <Shield className="w-3.5 h-3.5" />
                <span>VPN Access: {isVpnFulfilled ? "Assigned" : "Pending Assignment"}</span>
              </div>
            )}

            {hasHorizonRequirement && (
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-semibold ${
                isHorizonFulfilled
                  ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                  : "bg-blue-50 border-blue-100 text-blue-800"
              }`}>
                <Layers className="w-3.5 h-3.5" />
                <span>Horizon Access: {isHorizonFulfilled ? "Assigned" : "Pending Assignment"}</span>
              </div>
            )}

            {hasK8sRequirement && (
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-semibold ${
                isK8sFulfilled
                  ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                  : "bg-indigo-50 border-indigo-100 text-indigo-800"
              }`}>
                <Network className="w-3.5 h-3.5" />
                <span>K8s Namespace: {isK8sFulfilled ? "Provisioned" : "Pending Fulfillment"}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Virtual Machines Execution Section (Only for NEW_VM and CLONE_VM) */}
      {isVmProvisioningRequest && totalVmCount > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-bold text-slate-900">
                Virtual Machine Execution ({provisionedVmCount}/{totalVmCount})
              </h3>
            </div>

            {pendingVmCount > 0 && (
              <Button
                onClick={handleOpenBatchVmModal}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
              >
                <PlusCircle className="w-4 h-4 mr-1.5" />
                Provision All Pending ({pendingVmCount})
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: totalVmCount }).map((_, index) => {
              const seq = index + 1;
              const existingVm = vmInstances.find((v) => v.sequenceNumber === seq) || vmInstances[index];
              const spec = vmSpecs[index] || vmSpecs[0] || null;
              const isProvisioned = Boolean(existingVm);

              return (
                <Card
                  key={index}
                  className={`transition-all border ${
                    isProvisioned
                      ? "bg-white border-emerald-200 shadow-sm"
                      : "bg-white border-amber-200/80 shadow-sm hover:border-indigo-300"
                  }`}
                >
                  <CardHeader className="pb-3 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          isProvisioned ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}>
                          {seq}
                        </span>
                        <CardTitle className="text-sm font-bold text-slate-800">
                          VM #{seq} {spec?.stack ? `(${spec.stack})` : ""}
                        </CardTitle>
                      </div>

                      <Badge
                        className={`text-[10px] font-bold ${
                          isProvisioned
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {isProvisioned ? "PROVISIONED" : "PENDING"}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4 space-y-4">
                    {/* Requested Specs Summary */}
                    <div className="space-y-2 text-xs">
                      <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                        Requested Specifications
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5 text-slate-400" />
                          <span>{spec?.vcpu || request.vcpu || 1} vCPU</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-slate-400" />
                          <span>{spec?.ramGb || request.ramGb || 2} GB RAM</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                          <span>{spec?.storageGb || request.storageGb || 50} GB Disk</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-slate-400" />
                          <span>{spec?.osVersion || request.osName || "Linux"}</span>
                        </div>
                      </div>

                      {spec?.additionalStorage && spec.additionalStorage.length > 0 && (
                        <div className="pt-1 text-[11px] text-slate-500">
                          + {spec.additionalStorage.length} Addl Disks ({spec.additionalStorage.map((d: any) => `${d.sizeGb}GB`).join(", ")})
                        </div>
                      )}
                    </div>

                    {/* Provisioned Details or Action */}
                    <div className="pt-3 border-t border-slate-100">
                      {isProvisioned ? (
                        <div className="space-y-2">
                          <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-100 text-xs space-y-1">
                            <p className="font-bold text-slate-900 flex items-center justify-between">
                              <span>{existingVm.hostname}</span>
                              <span className="text-[10px] font-normal text-emerald-700">Active</span>
                            </p>
                            <p className="font-mono text-slate-600">IP: {existingVm.ipAddress}</p>
                            {existingVm.publicIpAddress && (
                              <p className="font-mono text-slate-600">Public: {existingVm.publicIpAddress}</p>
                            )}
                            {existingVm.subdomain && (
                              <p className="text-slate-600 truncate">Domain: {existingVm.subdomain}</p>
                            )}
                          </div>

                          <Link
                            href={`/inventory/vms/${existingVm.id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline pt-1"
                          >
                            View VM Inventory Details
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      ) : (
                        <Button
                          onClick={() => handleOpenSingleVmModal(spec?.id || "", seq)}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
                        >
                          Provision VM #{seq}
                          <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Virtual Machine Decommission Execution Section */}
      {isDecommissionRequest && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-600" />
              <h3 className="text-lg font-bold text-slate-900">
                Virtual Machine Decommission Execution
              </h3>
            </div>

            <Badge
              className={`text-xs font-bold px-3 py-1 ${
                isDecommissionFulfilled
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}
            >
              {isDecommissionFulfilled ? "DECOMMISSIONED / RETIRED" : "PENDING RETIREMENT"}
            </Badge>
          </div>

          <Card className={`border ${isDecommissionFulfilled ? "border-emerald-200 bg-white" : "border-rose-200 bg-white shadow-xs"}`}>
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isDecommissionFulfilled ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                  }`}>
                    <Server className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900">
                      Target VM: {targetVm?.hostname || request.systemName || "Virtual Machine"}
                    </CardTitle>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      IP: {targetVm?.ipAddress || "—"} {targetVm?.publicIpAddress ? `• Public: ${targetVm.publicIpAddress}` : ""}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold ${
                    targetVm?.status === "RETIRED" || isDecommissionFulfilled
                      ? "bg-slate-100 text-slate-600 border border-slate-200"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  }`}>
                    Current VM State: {targetVm?.status || (isDecommissionFulfilled ? "RETIRED" : "ACTIVE")}
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {/* Target Specs Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Compute</span>
                  <p className="font-semibold text-slate-800 mt-0.5">{targetVm?.currentSpec?.vcpu || request.vcpu || "—"} vCPU</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Memory</span>
                  <p className="font-semibold text-slate-800 mt-0.5">{targetVm?.currentSpec?.ramGb || request.ramGb || "—"} GB RAM</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Storage</span>
                  <p className="font-semibold text-slate-800 mt-0.5">{targetVm?.currentSpec?.storageGb || request.storageGb || "—"} GB Disk</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Environment</span>
                  <p className="font-semibold text-slate-800 mt-0.5">{request.environment || targetVm?.environment || "PRODUCTION"}</p>
                </div>
              </div>

              {/* Justification & Reason */}
              {(request.purpose || request.reason) && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-xs space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Decommission Justification</span>
                  <p className="text-slate-700">{request.purpose || request.reason}</p>
                </div>
              )}

              {/* Warning or Completed Notice */}
              {isDecommissionFulfilled ? (
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Decommission Fully Executed</p>
                    <p className="mt-0.5 text-emerald-700">
                      The virtual machine has been marked as RETIRED and decommissioned. Allocated resources and network configurations have been archived.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-rose-50/80 rounded-xl border border-rose-200 text-xs text-rose-800 flex items-start gap-3">
                  <AlertOctagon className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <p className="font-bold">Caution: Permanent Infrastructure Retirement</p>
                    <p className="text-rose-700">
                      Executing this action will shut down and retire virtual machine <strong>{targetVm?.hostname || request.systemName}</strong>, free its IP allocation (<strong>{targetVm?.ipAddress || "assigned IP"}</strong>), and mark this decommission request as CLOSED.
                    </p>
                  </div>
                </div>
              )}

              {/* Execution Action Button */}
              {!isDecommissionFulfilled && (
                <div className="pt-2 flex justify-end">
                  <Button
                    onClick={handleFinalExecute}
                    disabled={isExecutingFinal}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-200 px-5"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {isExecutingFinal ? "Decommissioning..." : "Execute & Retire Virtual Machine"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 4. Virtual Machine Compute Upgrade Execution Section */}
      {isUpgradeRequest && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-bold text-slate-900">
                Virtual Machine Compute Upgrade Execution
              </h3>
            </div>

            <Badge
              className={`text-xs font-bold px-3 py-1 ${
                isUpgradeFulfilled
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-indigo-50 text-indigo-700 border-indigo-200"
              }`}
            >
              {isUpgradeFulfilled ? "UPGRADE APPLIED" : "PENDING UPGRADE"}
            </Badge>
          </div>

          <Card className="border border-indigo-200 bg-white">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <Server className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900">
                      Target VM: {targetVm?.hostname || request.systemName}
                    </CardTitle>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      IP: {targetVm?.ipAddress || "—"}
                    </p>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase">
                      <th className="py-2">Resource</th>
                      <th className="py-2 text-center">Current Allocation</th>
                      <th className="py-2 text-center">Requested Upgrade</th>
                      <th className="py-2 text-right">Resulting Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-2.5 font-semibold text-slate-700">vCPU Cores</td>
                      <td className="py-2.5 text-center text-slate-600">{targetVm?.currentSpec?.vcpu || "—"} Cores</td>
                      <td className="py-2.5 text-center font-bold text-indigo-700">{request.upgradeCpu ? `${request.upgradeCpu} Cores` : "No Change"}</td>
                      <td className="py-2.5 text-right font-bold text-slate-900">{request.upgradeCpu || targetVm?.currentSpec?.vcpu || "—"} Cores</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-semibold text-slate-700">RAM (Memory)</td>
                      <td className="py-2.5 text-center text-slate-600">{targetVm?.currentSpec?.ramGb || "—"} GB</td>
                      <td className="py-2.5 text-center font-bold text-indigo-700">{request.upgradeRamGb ? `${request.upgradeRamGb} GB` : "No Change"}</td>
                      <td className="py-2.5 text-right font-bold text-slate-900">{request.upgradeRamGb || targetVm?.currentSpec?.ramGb || "—"} GB</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-semibold text-slate-700">Disk Storage</td>
                      <td className="py-2.5 text-center text-slate-600">{targetVm?.currentSpec?.storageGb || "—"} GB</td>
                      <td className="py-2.5 text-center font-bold text-indigo-700">{request.storageGb ? `+${request.storageGb} GB` : "No Change"}</td>
                      <td className="py-2.5 text-right font-bold text-slate-900">{(targetVm?.currentSpec?.storageGb || 0) + (request.storageGb || 0)} GB</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {!isUpgradeFulfilled ? (
                <div className="pt-2 flex justify-end">
                  <Button
                    onClick={handleFinalExecute}
                    disabled={isExecutingFinal}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-200 px-5"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    {isExecutingFinal ? "Applying..." : "Apply Compute Upgrade"}
                  </Button>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Compute upgrade has been successfully applied to this virtual machine.</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 5. VM Lifecycle Validity Renewal Execution Section */}
      {isRenewalRequest && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg font-bold text-slate-900">
                VM Lifecycle Validity Renewal Execution
              </h3>
            </div>

            <Badge
              className={`text-xs font-bold px-3 py-1 ${
                isRenewalFulfilled
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}
            >
              {isRenewalFulfilled ? "RENEWED" : "PENDING RENEWAL"}
            </Badge>
          </div>

          <Card className="border border-emerald-200 bg-white">
            <CardContent className="p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-bold text-slate-900 text-sm">{targetVm?.hostname || request.systemName}</p>
                  <p className="text-slate-500 font-mono">IP: {targetVm?.ipAddress || "—"}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500">Requested Extension</p>
                  <p className="font-bold text-emerald-700 text-sm">+{request.renewalPeriodMonths || 12} Months</p>
                </div>
              </div>

              {!isRenewalFulfilled ? (
                <div className="pt-2 flex justify-end">
                  <Button
                    onClick={handleFinalExecute}
                    disabled={isExecutingFinal}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-200 px-5"
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    {isExecutingFinal ? "Renewing..." : "Apply Validity Extension"}
                  </Button>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Validity extension has been applied to this virtual machine.</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 6. VPN Access Execution Section (if required) */}
      {hasVpnRequirement && (
        <div className="space-y-4 pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-600" />
              <h3 className="text-lg font-bold text-slate-900">
                VPN Access Execution
              </h3>
            </div>

            <Button
              onClick={() => setVpnModalOpen(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
            >
              <PlusCircle className="w-4 h-4 mr-1.5" />
              {uniqueVpnAssignments.length > 0 ? "Add Another VPN User" : "Provision VPN Access"}
            </Button>
          </div>

          {uniqueVpnAssignments.length === 0 ? (
            <Card className="border-amber-200 bg-amber-50/30">
              <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">VPN Access Required</h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      This request has requested VPN access. Assign a VPN user and associate them with the provisioned VMs.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setVpnModalOpen(true)}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs whitespace-nowrap"
                >
                  Configure & Assign VPN
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {uniqueVpnAssignments.map((assign: any) => (
                <Card key={assign.id} className="border-emerald-200 bg-white shadow-sm">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            {assign.vpnUser?.username || "VPN User"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {assign.vpnUser?.fullName || "Full Name"}
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                        ACTIVE
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                      <div>
                        <span className="text-slate-400">VPN IP: </span>
                        <span className="font-mono font-semibold">{assign.vpnUser?.vpnIp || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Profile: </span>
                        <span className="font-semibold">{assign.vpnUser?.vpnProfile || "Full Tunnel"}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. Horizon Access Execution Section (if required) */}
      {hasHorizonRequirement && (
        <div className="space-y-4 pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-bold text-slate-900">
                Horizon Access Execution
              </h3>
            </div>

            <Button
              onClick={() => setAccessModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
            >
              <PlusCircle className="w-4 h-4 mr-1.5" />
              {uniqueHorizonAssignments.length > 0 ? "Add Another Horizon User" : "Provision Horizon Access"}
            </Button>
          </div>

          {uniqueHorizonAssignments.length === 0 ? (
            <Card className="border-blue-200 bg-blue-50/30">
              <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Horizon Access Required</h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Fulfill Horizon VDI credentials and connect to target resources.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setAccessModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs whitespace-nowrap"
                >
                  Configure Horizon
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {uniqueHorizonAssignments.map((assign: any) => (
                <Card key={assign.id} className="border-emerald-200 bg-white shadow-sm">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            {assign.horizonUser?.username || "Horizon User"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {assign.horizonUser?.fullName || "Full Name"}
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                        ACTIVE
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. Kubernetes Namespace Execution Section (if required) */}
      {hasK8sRequirement && (
        <div className="space-y-4 pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-bold text-slate-900">
                Kubernetes Namespace Fulfillment
              </h3>
            </div>

            {k8sClusters.length === 0 && (
              <Button
                onClick={() => setK8sModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
              >
                <PlusCircle className="w-4 h-4 mr-1.5" />
                Fulfill K8s Namespace
              </Button>
            )}
          </div>

          {k8sClusters.length === 0 ? (
            <Card className="border-indigo-200 bg-indigo-50/30">
              <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Kubernetes Namespace Required</h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Assign namespace identifier and supervisor IP address to fulfill K8s container deployment.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setK8sModalOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs whitespace-nowrap"
                >
                  Fulfill Namespace
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {k8sClusters.map((cluster: any) => (
                <Card key={cluster.id} className="border-emerald-200 bg-white shadow-sm">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            Namespace: {cluster.namespace?.name || cluster.clusterName}
                          </p>
                          <p className="text-xs text-slate-500">
                            Supervisor IP: {cluster.namespace?.supervisorIp || "Configured"}
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                        ACTIVE
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <ProvisionVMModal
        open={vmModalOpen}
        onOpenChange={setVmModalOpen}
        requestId={request.id}
        requestQuantity={totalVmCount}
        existingVmsCount={provisionedVmCount}
        defaultSubdomain={request.subdomain || ""}
        requesterId={request.requesterId}
        vmSpecifications={vmSpecs}
        targetSpecId={targetSpecId}
        targetSequenceNumber={targetSequenceNumber}
        onSuccess={onRefresh}
      />

      <ProvisionVpnModal
        open={vpnModalOpen}
        onOpenChange={setVpnModalOpen}
        requestId={request.id}
        provisionedVms={vmInstances}
        namespaces={k8sClusters.map((c: any) => c.namespace).filter(Boolean)}
        onSuccess={onRefresh}
      />

      <ProvisionAccessModal
        open={accessModalOpen}
        onOpenChange={setAccessModalOpen}
        request={request}
        onSuccess={onRefresh}
      />

      <ProvisionK8sModal
        open={k8sModalOpen}
        onOpenChange={setK8sModalOpen}
        requestId={request.id}
        defaultNamespaceName={request.kubernetesNamespace || request.existingNamespace?.name || ""}
        defaultSupervisorIp={request.existingNamespace?.supervisorIp || "10.0.1.100"}
        onSuccess={onRefresh}
      />
    </div>
  );
}
