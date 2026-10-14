// src/app/reports/components/UserResourceDetailModal.tsx
"use client";

import { useEffect, useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  Download, 
  FileSpreadsheet, 
  Server, 
  Box, 
  ListChecks, 
  FolderKanban
} from "lucide-react";
import { fetchUserResourceDetail } from "@/app/actions/report-actions";
import type { UserResourceDetail } from "@/lib/reports/userReport";
import { exportToCsv, exportToExcel } from "@/lib/export-utils";
import { toast } from "sonner";

interface UserResourceDetailModalProps {
  userId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function UserResourceDetailModal({
  userId,
  isOpen,
  onClose,
}: UserResourceDetailModalProps) {
  const [detail, setDetail] = useState<UserResourceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("systems");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!isOpen || !userId) {
      setDetail(null);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        const data = await fetchUserResourceDetail(userId);
        setDetail(data);
      } catch (err: any) {
        console.error("Failed to load user resource detail:", err);
        toast.error(err.message || "Failed to load user resource detail");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, userId]);

  const handleExportUserCsv = () => {
    if (!detail) return;
    try {
      setIsExporting(true);
      const safeUserName = detail.user.name.toLowerCase().replace(/[^a-z0-9]/g, "-");

      // Consolidated multi-entity export
      const rows = [
        ...detail.systems.map((s) => ({
          Category: "SYSTEM",
          Name: s.systemName,
          Identifier: s.systemName,
          Status: `${s.activeVmCount} Active / ${s.vmCount} Total VMs`,
          vCPU: s.vcpu,
          RAM_GB: s.ramGb,
          Storage_GB: s.storageGb,
          Additional_Details: s.hostnames.join(", "),
        })),
        ...detail.vms.map((v) => ({
          Category: "VIRTUAL_MACHINE",
          Name: v.hostname,
          Identifier: v.ipAddress || "No IP",
          Status: v.status,
          vCPU: v.vcpu,
          RAM_GB: v.ramGb,
          Storage_GB: v.storageGb,
          Additional_Details: `System: ${v.systemName} | OS: ${v.os} | Env: ${v.environment}`,
        })),
        ...detail.namespaces.map((ns) => ({
          Category: "K8S_NAMESPACE",
          Name: ns.name,
          Identifier: ns.supervisorIp,
          Status: `${ns.totalNodes} Nodes (${ns.clusterName})`,
          vCPU: ns.vcpu,
          RAM_GB: ns.ramGb,
          Storage_GB: ns.storageGb,
          Additional_Details: `Originating System: ${ns.systemName}`,
        })),
        ...detail.requests.map((r) => ({
          Category: "REQUEST",
          Name: r.systemName,
          Identifier: r.requestId || r.id,
          Status: r.status,
          vCPU: r.vcpu,
          RAM_GB: r.ramGb,
          Storage_GB: r.storageGb,
          Additional_Details: `Type: ${r.requestType} | Env: ${r.environment} | Qty: ${r.quantity}`,
        })),
      ];

      exportToCsv(`${safeUserName}-resource-report-${new Date().toISOString().split("T")[0]}.csv`, rows);
      toast.success(`Exported complete resource footprint for ${detail.user.name}`);
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to export user resources");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportUserExcel = () => {
    if (!detail) return;
    try {
      setIsExporting(true);
      const safeUserName = detail.user.name.toLowerCase().replace(/[^a-z0-9]/g, "-");

      const rows = [
        ...detail.systems.map((s) => ({
          Resource_Type: "System",
          Resource_Name: s.systemName,
          IP_Or_ID: s.systemName,
          Status: `${s.activeVmCount} Active Nodes`,
          vCPU_Cores: s.vcpu,
          RAM_GB: s.ramGb,
          Storage_GB: s.storageGb,
          Extra_Context: s.hostnames.join(", "),
        })),
        ...detail.vms.map((v) => ({
          Resource_Type: "Virtual Machine",
          Resource_Name: v.hostname,
          IP_Or_ID: v.ipAddress || "No IP",
          Status: v.status,
          vCPU_Cores: v.vcpu,
          RAM_GB: v.ramGb,
          Storage_GB: v.storageGb,
          Extra_Context: `System: ${v.systemName} | Env: ${v.environment}`,
        })),
        ...detail.namespaces.map((ns) => ({
          Resource_Type: "K8s Namespace",
          Resource_Name: ns.name,
          IP_Or_ID: ns.supervisorIp,
          Status: `${ns.totalNodes} Nodes`,
          vCPU_Cores: ns.vcpu,
          RAM_GB: ns.ramGb,
          Storage_GB: ns.storageGb,
          Extra_Context: `Cluster: ${ns.clusterName} | System: ${ns.systemName}`,
        })),
        ...detail.requests.map((r) => ({
          Resource_Type: "Provision Request",
          Resource_Name: r.systemName,
          IP_Or_ID: r.requestId || r.id,
          Status: r.status,
          vCPU_Cores: r.vcpu,
          RAM_GB: r.ramGb,
          Storage_GB: r.storageGb,
          Extra_Context: `Type: ${r.requestType} | Env: ${r.environment}`,
        })),
      ];

      exportToExcel(`${safeUserName}-resource-report-${new Date().toISOString().split("T")[0]}.xls`, rows);
      toast.success(`Exported complete resource footprint for ${detail.user.name}`);
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to export user resources");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl border-slate-200">
        <DialogHeader className="sr-only">
          <DialogTitle>{detail?.user.name || "User"} Resource Footprint</DialogTitle>
          <DialogDescription>Detailed audit of systems, virtual machines, namespaces, and requests</DialogDescription>
        </DialogHeader>

        {loading || !detail ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Loading User Resource Footprint...
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header banner */}
            <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-t-2xl">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-black tracking-tight">{detail.user.name}</h2>
                    <Badge variant="outline" className="border-indigo-400/40 text-indigo-200 bg-indigo-950/50 text-[10px]">
                      {detail.user.organization || "Unassigned Dept"}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-300 font-mono">{detail.user.email}</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {detail.user.roles.map((r) => (
                      <span key={r} className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/10 text-slate-200">
                        {r.replace("_", " ")}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isExporting}
                    onClick={handleExportUserCsv}
                    className="h-8 text-xs gap-1.5 bg-white/10 hover:bg-white/20 text-white border-white/20"
                  >
                    {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    Export CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isExporting}
                    onClick={handleExportUserExcel}
                    className="h-8 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white border-transparent font-semibold shadow-sm"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    Export Excel
                  </Button>
                </div>
              </div>

              {/* Resource Summary Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 mt-6 pt-4 border-t border-white/10 text-center">
                <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Systems</p>
                  <p className="text-xl font-black text-white mt-0.5">{detail.summary.totalSystems}</p>
                </div>
                <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total VMs</p>
                  <p className="text-xl font-black text-indigo-300 mt-0.5">
                    {detail.summary.activeVms} <span className="text-xs text-slate-400">/ {detail.summary.totalVms}</span>
                  </p>
                </div>
                <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Namespaces</p>
                  <p className="text-xl font-black text-sky-300 mt-0.5">{detail.summary.totalNamespaces}</p>
                </div>
                <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Requests</p>
                  <p className="text-xl font-black text-purple-300 mt-0.5">{detail.summary.totalRequests}</p>
                </div>
                <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">vCPU</p>
                  <p className="text-xl font-black text-amber-300 mt-0.5">{detail.summary.totalVcpu}</p>
                </div>
                <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">RAM (GB)</p>
                  <p className="text-xl font-black text-emerald-300 mt-0.5">{detail.summary.totalRamGb}</p>
                </div>
                <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Storage (GB)</p>
                  <p className="text-xl font-black text-rose-300 mt-0.5">{detail.summary.totalStorageGb}</p>
                </div>
              </div>
            </div>

            {/* Content Tabs */}
            <div className="px-6 pb-6">
              <Tabs defaultValue="systems" value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-slate-100 p-1 rounded-xl h-10 w-full flex justify-start gap-1">
                  <TabsTrigger value="systems" className="text-xs font-bold gap-1.5 rounded-lg data-[state=active]:bg-white">
                    <FolderKanban className="h-3.5 w-3.5 text-indigo-600" />
                    Systems ({detail.systems.length})
                  </TabsTrigger>
                  <TabsTrigger value="vms" className="text-xs font-bold gap-1.5 rounded-lg data-[state=active]:bg-white">
                    <Server className="h-3.5 w-3.5 text-blue-600" />
                    Virtual Machines ({detail.vms.length})
                  </TabsTrigger>
                  <TabsTrigger value="namespaces" className="text-xs font-bold gap-1.5 rounded-lg data-[state=active]:bg-white">
                    <Box className="h-3.5 w-3.5 text-sky-600" />
                    Namespaces ({detail.namespaces.length})
                  </TabsTrigger>
                  <TabsTrigger value="requests" className="text-xs font-bold gap-1.5 rounded-lg data-[state=active]:bg-white">
                    <ListChecks className="h-3.5 w-3.5 text-purple-600" />
                    Requests ({detail.requests.length})
                  </TabsTrigger>
                </TabsList>

                {/* 1. Systems Tab */}
                <TabsContent value="systems" className="mt-4 focus-visible:outline-none">
                  {detail.systems.length === 0 ? (
                    <div className="p-10 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed">
                      No systems owned by this user
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b">
                          <tr>
                            <th className="py-2.5 px-3">System / Project Name</th>
                            <th className="py-2.5 px-3 text-center">Active / Total VMs</th>
                            <th className="py-2.5 px-3 text-center">vCPU</th>
                            <th className="py-2.5 px-3 text-center">RAM (GB)</th>
                            <th className="py-2.5 px-3 text-center">Storage (GB)</th>
                            <th className="py-2.5 px-3">Hostnames Sample</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {detail.systems.map((sys) => (
                            <tr key={sys.systemName} className="hover:bg-slate-50/80">
                              <td className="py-2.5 px-3 font-bold text-slate-900 flex items-center gap-1.5">
                                <FolderKanban className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                                {sys.systemName}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className="font-bold text-emerald-600">{sys.activeVmCount}</span> / {sys.vmCount}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-slate-700">{sys.vcpu}</td>
                              <td className="py-2.5 px-3 text-center font-bold text-slate-700">{sys.ramGb}</td>
                              <td className="py-2.5 px-3 text-center font-bold text-slate-700">{sys.storageGb}</td>
                              <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate font-mono text-[11px]">
                                {sys.hostnames.length > 0 ? sys.hostnames.join(", ") : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>

                {/* 2. VMs Tab */}
                <TabsContent value="vms" className="mt-4 focus-visible:outline-none">
                  {detail.vms.length === 0 ? (
                    <div className="p-10 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed">
                      No virtual machines owned by this user
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b">
                          <tr>
                            <th className="py-2.5 px-3">Instance / Hostname</th>
                            <th className="py-2.5 px-3">System</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">IP Address</th>
                            <th className="py-2.5 px-3">Specs (Cores/RAM/SSD)</th>
                            <th className="py-2.5 px-3">Environment</th>
                            <th className="py-2.5 px-3">Renewal Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {detail.vms.map((vm) => (
                            <tr key={vm.id} className="hover:bg-slate-50/80">
                              <td className="py-2.5 px-3 font-semibold text-slate-900 font-mono text-[11px]">
                                {vm.hostname}
                              </td>
                              <td className="py-2.5 px-3 font-medium text-slate-700">{vm.systemName}</td>
                              <td className="py-2.5 px-3">
                                <Badge
                                  variant="outline"
                                  className={`text-[9px] font-bold ${
                                    vm.status === "ACTIVE"
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : vm.status === "SUSPENDED"
                                      ? "bg-amber-50 text-amber-700 border-amber-200"
                                      : "bg-slate-100 text-slate-600 border-slate-200"
                                  }`}
                                >
                                  {vm.status}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                                {vm.ipAddress || "—"}
                              </td>
                              <td className="py-2.5 px-3 text-slate-700 font-semibold">
                                {vm.vcpu}C • {vm.ramGb}GB • {vm.storageGb}GB
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 font-medium">{vm.environment}</td>
                              <td className="py-2.5 px-3 text-slate-500">
                                {vm.renewalDate ? new Date(vm.renewalDate).toLocaleDateString() : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>

                {/* 3. Namespaces Tab */}
                <TabsContent value="namespaces" className="mt-4 focus-visible:outline-none">
                  {detail.namespaces.length === 0 ? (
                    <div className="p-10 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed">
                      No Kubernetes namespaces requested or owned by this user
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b">
                          <tr>
                            <th className="py-2.5 px-3">Namespace</th>
                            <th className="py-2.5 px-3">Supervisor IP</th>
                            <th className="py-2.5 px-3">Cluster</th>
                            <th className="py-2.5 px-3 text-center">Nodes</th>
                            <th className="py-2.5 px-3 text-center">Allocated Cores</th>
                            <th className="py-2.5 px-3 text-center">RAM (GB)</th>
                            <th className="py-2.5 px-3 text-center">Storage (GB)</th>
                            <th className="py-2.5 px-3">Associated System</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {detail.namespaces.map((ns) => (
                            <tr key={ns.id} className="hover:bg-slate-50/80">
                              <td className="py-2.5 px-3 font-bold text-indigo-700 flex items-center gap-1.5">
                                <Box className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                                {ns.name}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">{ns.supervisorIp}</td>
                              <td className="py-2.5 px-3 text-slate-700 font-medium">{ns.clusterName}</td>
                              <td className="py-2.5 px-3 text-center font-bold text-slate-800">{ns.totalNodes}</td>
                              <td className="py-2.5 px-3 text-center font-semibold text-slate-700">{ns.vcpu}</td>
                              <td className="py-2.5 px-3 text-center font-semibold text-slate-700">{ns.ramGb}</td>
                              <td className="py-2.5 px-3 text-center font-semibold text-slate-700">{ns.storageGb}</td>
                              <td className="py-2.5 px-3 text-slate-600 font-medium">{ns.systemName}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>

                {/* 4. Requests Tab */}
                <TabsContent value="requests" className="mt-4 focus-visible:outline-none">
                  {detail.requests.length === 0 ? (
                    <div className="p-10 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed">
                      No requests submitted by this user
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b">
                          <tr>
                            <th className="py-2.5 px-3">Request ID</th>
                            <th className="py-2.5 px-3">System / Project</th>
                            <th className="py-2.5 px-3">Type</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">Quantity</th>
                            <th className="py-2.5 px-3">Requested Specs</th>
                            <th className="py-2.5 px-3">Submitted At</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {detail.requests.map((r) => (
                            <tr key={r.id} className="hover:bg-slate-50/80">
                              <td className="py-2.5 px-3 font-mono text-[11px] font-bold text-indigo-600">
                                {r.requestId || r.id.slice(0, 8)}
                              </td>
                              <td className="py-2.5 px-3 font-medium text-slate-900">{r.systemName}</td>
                              <td className="py-2.5 px-3 text-slate-600">{r.requestType}</td>
                              <td className="py-2.5 px-3">
                                <Badge variant="outline" className="text-[9px] font-bold">
                                  {r.status}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-700">{r.quantity} VM(s)</td>
                              <td className="py-2.5 px-3 text-slate-700">
                                {r.vcpu ? `${r.vcpu}C • ${r.ramGb}GB • ${r.storageGb}GB` : "Custom"}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500">
                                {new Date(r.createdAt).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
