// src/app/requests/components/SystemFleetOverviewCard.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Layers,
  Server,
  Cpu,
  HardDrive,
  Database,
  ExternalLink,
  Info,
  ArrowUpRight
} from "lucide-react";
import type { SystemFleetOverview } from "@/types/requests";
import { formatSystemName } from "@/lib/system-utils";

interface SystemFleetOverviewCardProps {
  systemFleet: SystemFleetOverview | null | undefined;
  systemName: string;
  currentRequestId: string;
  isPendingApproval?: boolean;
}

export function SystemFleetOverviewCard({
  systemFleet,
  systemName,
  currentRequestId: _currentRequestId,
  isPendingApproval = false,
}: SystemFleetOverviewCardProps) {
  const [filterTab, setFilterTab] = useState<"ALL" | "CURRENT" | "OTHER">("ALL");

  if (!systemName || !systemName.trim()) {
    return null;
  }

  const cleanSystem = formatSystemName(systemName);
  const vms = systemFleet?.vms || [];
  const currentRequestVms = vms.filter((v) => v.isCurrentRequest);
  const otherFleetVms = vms.filter((v) => !v.isCurrentRequest);

  const displayedVms =
    filterTab === "CURRENT"
      ? currentRequestVms
      : filterTab === "OTHER"
      ? otherFleetVms
      : vms;

  const totalVms = systemFleet?.totalVms || 0;
  const activeVms = systemFleet?.activeVms || 0;
  const totalVcpu = systemFleet?.totalVcpu || 0;
  const totalRamGb = systemFleet?.totalRamGb || 0;
  const totalStorageGb = systemFleet?.totalStorageGb || 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return (
          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
            ACTIVE
          </Badge>
        );
      case "SUSPENDED":
        return (
          <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
            SUSPENDED
          </Badge>
        );
      case "RETIRED":
        return (
          <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300 text-[10px] font-bold">
            RETIRED
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] font-bold">
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-200">
      {/* Header Bar */}
      <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-indigo-50/30 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shadow-indigo-200">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-base tracking-tight">
                System Fleet Infrastructure
              </h3>
              <span className="px-2.5 py-0.5 rounded-md text-xs font-black tracking-wide uppercase bg-indigo-100 text-indigo-800 border border-indigo-200">
                {cleanSystem}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Aggregated infrastructure footprint across all requests for this logical system
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-white text-slate-700 border-slate-200 text-xs px-2.5 py-1 font-semibold">
            {activeVms} Active / {totalVms} Total VMs
          </Badge>
        </div>
      </div>

      {/* Approver Context Alert */}
      {isPendingApproval && otherFleetVms.length > 0 && (
        <div className="mx-6 mt-5 p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
          <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold text-amber-950">
              Existing System Footprint Notice
            </p>
            <p className="text-amber-800 leading-relaxed">
              System <strong>&ldquo;{cleanSystem}&rdquo;</strong> already has{" "}
              <strong>{activeVms} active VM(s)</strong> running in the datacenter consuming{" "}
              <strong>{totalVcpu} vCPUs</strong>, <strong>{totalRamGb} GB RAM</strong>, and{" "}
              <strong>{totalStorageGb} GB SSD</strong> from prior tickets. Review existing nodes below before approving additional capacity.
            </p>
          </div>
        </div>
      )}

      {/* Fleet Resource Metrics Strip */}
      <div className="p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-indigo-100/80 text-indigo-700 flex items-center justify-center shrink-0">
              <Server className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fleet Nodes</p>
              <p className="text-lg font-black text-slate-900 leading-tight">
                {activeVms}{" "}
                <span className="text-xs font-semibold text-slate-500 font-normal">Active</span>
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-100/80 text-blue-700 flex items-center justify-center shrink-0">
              <Cpu className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total vCPU</p>
              <p className="text-lg font-black text-slate-900 leading-tight">
                {totalVcpu}{" "}
                <span className="text-xs font-semibold text-slate-500 font-normal">Cores</span>
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-100/80 text-emerald-700 flex items-center justify-center shrink-0">
              <Database className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Memory</p>
              <p className="text-lg font-black text-slate-900 leading-tight">
                {totalRamGb}{" "}
                <span className="text-xs font-semibold text-slate-500 font-normal">GB RAM</span>
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-purple-100/80 text-purple-700 flex items-center justify-center shrink-0">
              <HardDrive className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Storage</p>
              <p className="text-lg font-black text-slate-900 leading-tight">
                {totalStorageGb}{" "}
                <span className="text-xs font-semibold text-slate-500 font-normal">GB SSD</span>
              </p>
            </div>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center justify-between border-b border-slate-200 mb-4 pb-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterTab("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterTab === "ALL"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              All System VMs ({vms.length})
            </button>
            {currentRequestVms.length > 0 && (
              <button
                type="button"
                onClick={() => setFilterTab("CURRENT")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterTab === "CURRENT"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Provisioned by This Request ({currentRequestVms.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => setFilterTab("OTHER")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterTab === "OTHER"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Other Fleet VMs ({otherFleetVms.length})
            </button>
          </div>

          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
            Showing {displayedVms.length} of {vms.length} nodes
          </span>
        </div>

        {/* VM Instances List */}
        {displayedVms.length > 0 ? (
          <div className="space-y-3">
            {displayedVms.map((vm) => (
              <div
                key={vm.id}
                className={`p-4 rounded-xl border transition-all duration-150 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  vm.isCurrentRequest
                    ? "bg-indigo-50/30 border-indigo-200/80 hover:border-indigo-300"
                    : "bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-xs"
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      vm.status === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    }`}
                  >
                    <Server className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-slate-900 text-sm truncate">
                        {vm.hostname || "UNNAMED_INSTANCE"}
                      </p>
                      {getStatusBadge(vm.status)}
                      {vm.isCurrentRequest ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                          This Request
                        </span>
                      ) : vm.requestNumber ? (
                        <Link
                          href={`/requests/${vm.requestId}/view`}
                          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-blue-600 border border-slate-200 transition-colors inline-flex items-center gap-1"
                        >
                          {vm.requestNumber}
                          <ArrowUpRight className="h-2.5 w-2.5" />
                        </Link>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                          Manual / Legacy
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 font-mono">
                      <span>{vm.ipAddress || "Pending IP"}</span>
                      {vm.environment && (
                        <span className="font-sans font-semibold text-[10px] text-slate-400 uppercase">
                          • {vm.environment}
                        </span>
                      )}
                      {vm.ownerName && (
                        <span className="font-sans text-[11px] text-slate-500">
                          • Owner: {vm.ownerName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/80">
                    <span>{vm.vcpu || 0} vCPU</span>
                    <span className="text-slate-300">•</span>
                    <span>{vm.ramGb || 0} GB</span>
                    <span className="text-slate-300">•</span>
                    <span>{vm.storageGb || 0} GB</span>
                  </div>

                  <Link href={`/inventory/vms/${vm.id}`} target="_blank">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2.5 text-xs font-semibold gap-1 text-slate-700 hover:text-indigo-600 hover:border-indigo-200"
                    >
                      Inspect
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center rounded-xl bg-slate-50/50 border border-dashed border-slate-200 space-y-2">
            <Layers className="h-8 w-8 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">
              {filterTab === "CURRENT"
                ? "No VMs have been provisioned by this specific request yet."
                : filterTab === "OTHER"
                ? `No other active VMs exist in system "${cleanSystem}".`
                : `No virtual machines found for system "${cleanSystem}".`}
            </p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Once approved and provisioned by datacenter operations, instances will appear in this unified system inventory.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
