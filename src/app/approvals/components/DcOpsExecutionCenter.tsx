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
  Network
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

  // 1. VM specifications and instances calculation
  const vmSpecs: any[] = request.vmSpecifications || [];
  const vmInstances: any[] = request.vmInstances || [];
  const totalVmCount = Math.max(request.quantity || 1, vmSpecs.length);
  const provisionedVmCount = vmInstances.length;
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
  const k8sClusters = request.k8sClusters || [];
  const isK8sFulfilled = !hasK8sRequirement || k8sClusters.length > 0;

  // Total execution items and completion progress
  let totalTasks = 0;
  let completedTasks = 0;

  // VM tasks
  totalTasks += totalVmCount;
  completedTasks += provisionedVmCount;

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
    if (!confirm("Are you sure you want to mark this entire request execution as completed?")) return;
    setIsExecutingFinal(true);
    try {
      const res = await executeRequest(request.id);
      if (res.success) {
        toast.success("Request execution marked as complete!");
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
                request.status === "PROVISIONED"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : request.status === "PARTIALLY_PROVISIONED"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-blue-50 text-blue-700 border-blue-200"
              }`}
            >
              {request.status.replace(/_/g, " ")}
            </Badge>

            {isAllCompleted && request.status !== "PROVISIONED" && (
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
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-800 text-xs font-semibold">
              <Server className="w-3.5 h-3.5 text-indigo-600" />
              <span>
                {totalVmCount} VM{totalVmCount !== 1 ? "s" : ""} ({provisionedVmCount} Active, {pendingVmCount} Pending)
              </span>
            </div>

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

      {/* 2. Virtual Machines Execution Section */}
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

      {/* 3. VPN Access Execution Section (if required) */}
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
        onSuccess={onRefresh}
      />
    </div>
  );
}
