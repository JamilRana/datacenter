// src/app/reports/components/UserVmModal.tsx
"use client";

import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Loader2, 
  Download, 
  ExternalLink,
  Layers,
  Search,
  Clock,
  Server,
  Box,
  Cpu,
  HardDrive
} from "lucide-react";
import { getUserVmDetails } from "@/app/actions/report-tabular-actions";
import { UserVmDetail, UserNamespaceDetail } from "@/types/reports";
import { format, differenceInDays } from "date-fns";
import { Input } from "@/components/ui/input";
import { exportToExcel, exportToCSV } from "@/lib/export-utils";
import { getReportFilename, formatDateDhaka, autoScaleRam, autoScaleStorage } from "@/lib/format-utils";

interface UserVmModalProps {
  userId: string | null;
  userName: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function UserVmModal({ userId, userName, isOpen, onClose }: UserVmModalProps) {
  const [vms, setVms] = useState<UserVmDetail[]>([]);
  const [namespaces, setNamespaces] = useState<UserNamespaceDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"vms" | "namespaces">("vms");

  const loadDetails = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await getUserVmDetails(userId);
      setVms(data.vms || []);
      setNamespaces(data.namespaces || []);
    } catch (error) {
      console.error("Failed to load user resources", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId && isOpen) {
      loadDetails();
      setSearchTerm("");
      setActiveTab("vms");
    }
  }, [userId, isOpen, loadDetails]);

  // Filter VMs
  const filteredVms = useMemo(() => {
    if (!searchTerm.trim()) return vms;
    const term = searchTerm.toLowerCase();
    return vms.filter(vm => 
      vm.hostname.toLowerCase().includes(term) ||
      vm.ipAddress.toLowerCase().includes(term) ||
      vm.systemName.toLowerCase().includes(term) ||
      vm.requestId.toLowerCase().includes(term)
    );
  }, [searchTerm, vms]);

  // Filter Namespaces
  const filteredNamespaces = useMemo(() => {
    if (!searchTerm.trim()) return namespaces;
    const term = searchTerm.toLowerCase();
    return namespaces.filter(ns => 
      ns.name.toLowerCase().includes(term) ||
      ns.supervisorIp.toLowerCase().includes(term) ||
      ns.systemName.toLowerCase().includes(term) ||
      ns.clusterName.toLowerCase().includes(term)
    );
  }, [searchTerm, namespaces]);

  // Aggregated resource metrics across VMs + Namespaces
  const stats = useMemo(() => {
    const totalVms = vms.length;
    const activeVms = vms.filter(v => v.status === "ACTIVE").length;
    const totalNamespaces = namespaces.length;

    let totalVcpu = 0;
    let totalRamGb = 0;
    let totalStorageGb = 0;

    for (const vm of vms) {
      totalVcpu += vm.vcpu || 0;
      totalRamGb += vm.ramGb || 0;
      totalStorageGb += vm.storageGb || 0;
    }

    for (const ns of namespaces) {
      totalVcpu += ns.vcpu || 0;
      totalRamGb += ns.ramGb || 0;
      totalStorageGb += ns.storageGb || 0;
    }

    return {
      totalVms,
      activeVms,
      totalNamespaces,
      totalVcpu,
      totalRamGb,
      totalStorageGb
    };
  }, [vms, namespaces]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>;
      case "SUSPENDED":
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Suspended</Badge>;
      case "RETIRED":
        return <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">Retired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRenewalStatus = (dateStr: string) => {
    if (!dateStr) return <span className="text-slate-400">N/A</span>;
    const date = new Date(dateStr);
    const days = differenceInDays(date, new Date());
    
    if (days <= 30) return <span className="text-rose-600 font-medium flex items-center gap-1"><Clock size={12}/> {format(date, "MMM dd, yyyy")}</span>;
    if (days <= 90) return <span className="text-amber-600 font-medium flex items-center gap-1"><Clock size={12}/> {format(date, "MMM dd, yyyy")}</span>;
    return <span className="text-slate-600">{format(date, "MMM dd, yyyy")}</span>;
  };

  const handleExport = async (exportFormat: 'xlsx' | 'csv') => {
    const safeUserName = (userName || "user").toLowerCase().replace(/[^a-z0-9]/g, "_");
    const baseFilename = getReportFilename(`user_allocation_${safeUserName}`);

    const vmExportRows = filteredVms.map(vm => ({
      "Category": "Virtual Machine",
      "System": vm.systemName || "Unassigned / Standalone",
      "Name": vm.hostname,
      "IP Address": vm.ipAddress,
      "Environment": vm.environment,
      "vCPU": vm.vcpu,
      "RAM (GB)": vm.ramGb,
      "Storage (GB)": vm.storageGb,
      "OS": vm.os,
      "Cluster": vm.cluster,
      "Status": vm.status,
      "Renewal Date": vm.renewalDate ? format(new Date(vm.renewalDate), "yyyy-MM-dd") : "N/A",
      "Request ID": vm.requestId
    }));

    const nsExportRows = filteredNamespaces.map(ns => ({
      "Category": "K8s Namespace",
      "System": ns.systemName || "Kubernetes",
      "Name": ns.name,
      "Supervisor IP": ns.supervisorIp,
      "Cluster": ns.clusterName,
      "Total Nodes": ns.totalNodes,
      "vCPU": ns.vcpu,
      "RAM (GB)": ns.ramGb,
      "Storage (GB)": ns.storageGb,
      "Created Date": ns.createdAt ? format(new Date(ns.createdAt), "yyyy-MM-dd") : "N/A"
    }));

    if (exportFormat === 'xlsx') {
      await exportToExcel(baseFilename, vmExportRows, {
        sheetName: "Allocated VMs",
        sheets: [
          { name: "Allocated Namespaces", data: nsExportRows },
        ],
        metadata: {
          reportTitle: `${userName || "User"} — Allocated Resources`,
          scope: "Individual Tenant Resources",
          generatedAt: formatDateDhaka(new Date()),
          filters: { "Search": searchTerm || "None" },
          definitions: {
            "Virtual Machines": "Dedicated VM instances allocated to this user",
            "K8s Namespaces": "Kubernetes namespaces and worker node resources allocated to this user",
            "Effective Spec": "Active resource footprint (vCPU, RAM, Storage) allocated"
          }
        }
      });
    } else {
      // Consolidated CSV
      const combined = [
        ...vmExportRows,
        ...nsExportRows.map(ns => ({
          "Category": ns.Category,
          "System": ns.System,
          "Name": ns.Name,
          "IP Address": ns["Supervisor IP"],
          "Environment": "N/A",
          "vCPU": ns.vCPU,
          "RAM (GB)": ns["RAM (GB)"],
          "Storage (GB)": ns["Storage (GB)"],
          "OS": "Kubernetes Container Platform",
          "Cluster": ns.Cluster,
          "Status": "ACTIVE",
          "Renewal Date": "N/A",
          "Request ID": "N/A"
        }))
      ];
      exportToCSV(baseFilename, combined);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-hidden flex flex-col p-6">
        <DialogHeader className="mb-2">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pr-8">
            <div>
              <DialogTitle className="text-2xl font-bold text-slate-900 leading-none mb-1.5">
                {userName} — Allocated Resources
              </DialogTitle>
              <DialogDescription className="text-slate-500 text-xs">
                A detailed view of virtual machines and Kubernetes namespaces allocated to this user.
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-8 gap-2 text-xs" onClick={() => handleExport('xlsx')}>
                <Download size={13} /> Excel
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-2 text-xs" onClick={() => handleExport('csv')}>
                <Download size={13} /> CSV
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Aggregated KPI Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200/80 mb-3">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider flex items-center gap-1">
              <Server size={11} className="text-indigo-600" /> Total VMs
            </span>
            <span className="text-base font-extrabold text-slate-900">{stats.totalVms}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider flex items-center gap-1">
              <Server size={11} className="text-emerald-600" /> Active VMs
            </span>
            <span className="text-base font-extrabold text-emerald-600">{stats.activeVms}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider flex items-center gap-1">
              <Box size={11} className="text-cyan-600" /> Namespaces
            </span>
            <span className="text-base font-extrabold text-cyan-700">{stats.totalNamespaces}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider flex items-center gap-1">
              <Cpu size={11} className="text-indigo-600" /> Total vCPU
            </span>
            <span className="text-base font-extrabold text-slate-900">{stats.totalVcpu} Cores</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider flex items-center gap-1">
              <HardDrive size={11} className="text-indigo-600" /> Total RAM
            </span>
            <span className="text-base font-extrabold text-slate-900">{autoScaleRam(stats.totalRamGb)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider flex items-center gap-1">
              <HardDrive size={11} className="text-indigo-600" /> Total Storage
            </span>
            <span className="text-base font-extrabold text-slate-900">{autoScaleStorage(stats.totalStorageGb)}</span>
          </div>
        </div>

        {/* Search & Tabs Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-3">
          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as "vms" | "namespaces")}>
            <TabsList className="bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <TabsTrigger 
                value="vms" 
                className="gap-1.5 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-xs"
              >
                <Server size={13} />
                <span>Virtual Machines</span>
                <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0 h-4 bg-indigo-50 text-indigo-700 font-bold">
                  {filteredVms.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger 
                value="namespaces" 
                className="gap-1.5 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-cyan-700 data-[state=active]:shadow-xs"
              >
                <Box size={13} />
                <span>K8s Namespaces</span>
                <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0 h-4 bg-cyan-50 text-cyan-700 font-bold">
                  {filteredNamespaces.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <Input 
              placeholder={activeTab === "vms" ? "Search VMs by name, IP, system..." : "Search namespaces by name, IP, cluster..."}
              className="pl-8 h-8 text-xs border-slate-200 focus-visible:ring-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-inner">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
          ) : activeTab === "vms" ? (
            filteredVms.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 bg-slate-50/50">
                <Layers className="h-10 w-10 text-slate-300 mb-2" />
                <p className="text-slate-500 text-sm font-medium">No virtual machines found matching your criteria.</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                  <TableRow>
                    <TableHead className="font-bold text-xs whitespace-nowrap">VM Name / Hostname</TableHead>
                    <TableHead className="font-bold text-xs whitespace-nowrap">IP Address</TableHead>
                    <TableHead className="font-bold text-xs whitespace-nowrap">Environment</TableHead>
                    <TableHead className="font-bold text-xs whitespace-nowrap">Resources</TableHead>
                    <TableHead className="font-bold text-xs whitespace-nowrap">OS / Image</TableHead>
                    <TableHead className="font-bold text-xs whitespace-nowrap">Cluster</TableHead>
                    <TableHead className="font-bold text-xs whitespace-nowrap">Status</TableHead>
                    <TableHead className="font-bold text-xs whitespace-nowrap">Renewal Date</TableHead>
                    <TableHead className="font-bold text-xs whitespace-nowrap">Request ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(
                    filteredVms.reduce((acc, vm) => {
                      const sys = vm.systemName || "Unassigned / Standalone";
                      if (!acc[sys]) acc[sys] = [];
                      acc[sys].push(vm);
                      return acc;
                    }, {} as Record<string, UserVmDetail[]>)
                  ).map(([sysName, sysVms]) => {
                    const sysTotalVcpu = sysVms.reduce((acc, v) => acc + (v.vcpu || 0), 0);
                    const sysTotalRam = sysVms.reduce((acc, v) => acc + (v.ramGb || 0), 0);
                    const isStandalone = sysName.toLowerCase().includes("unassigned") || sysName.toLowerCase().includes("standalone");
                    return (
                      <Fragment key={sysName}>
                        <TableRow className="bg-slate-100/70 border-y border-slate-200">
                          <TableCell colSpan={9} className="py-2 px-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold ${isStandalone ? 'text-slate-500' : 'text-indigo-900'}`}>
                                  System: {sysName}
                                </span>
                                <Badge variant="outline" className="text-[10px] bg-white border-slate-200 text-slate-600 font-semibold">
                                  {sysVms.length} {sysVms.length === 1 ? 'VM' : 'VMs'}
                                </Badge>
                              </div>
                              <div className="text-[11px] text-slate-500 font-medium">
                                Subtotal: <span className="font-bold text-slate-700">{sysTotalVcpu} vCPU</span>, <span className="font-bold text-slate-700">{autoScaleRam(sysTotalRam)} RAM</span>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                        {sysVms.map((vm) => (
                          <TableRow key={vm.id} className="hover:bg-slate-50/50 text-xs">
                            <TableCell className="font-semibold text-slate-900 group">
                              <div className="flex items-center gap-1.5">
                                <span>{vm.hostname}</span>
                                <ExternalLink size={11} className="text-slate-300 hidden group-hover:block transition-all" />
                              </div>
                            </TableCell>
                            <TableCell className="text-slate-600 font-mono text-[12px]">{vm.ipAddress}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-semibold text-[10px]">
                                {vm.environment}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-0.5 whitespace-nowrap">
                                <div className="text-[11px] text-slate-500 flex items-center justify-between gap-2">
                                  <span>vCPU:</span>
                                  <span className="font-bold text-slate-700">{vm.vcpu} core</span>
                                </div>
                                <div className="text-[11px] text-slate-500 flex items-center justify-between gap-2">
                                  <span>RAM:</span>
                                  <span className="font-bold text-slate-700">{autoScaleRam(vm.ramGb)}</span>
                                </div>
                                <div className="text-[11px] text-slate-500 flex items-center justify-between gap-2">
                                  <span>Storage:</span>
                                  <span className="font-bold text-slate-700">{autoScaleStorage(vm.storageGb)}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-slate-600">{vm.os}</TableCell>
                            <TableCell className="text-xs font-medium text-indigo-600/80">{vm.cluster}</TableCell>
                            <TableCell>{getStatusBadge(vm.status)}</TableCell>
                            <TableCell className="text-xs">{getRenewalStatus(vm.renewalDate)}</TableCell>
                            <TableCell className="text-xs font-mono text-slate-400">{vm.requestId}</TableCell>
                          </TableRow>
                        ))}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            )
          ) : (
            filteredNamespaces.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 bg-slate-50/50">
                <Box className="h-10 w-10 text-slate-300 mb-2" />
                <p className="text-slate-500 text-sm font-medium">No Kubernetes namespaces found matching your criteria.</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                  <TableRow>
                    <TableHead className="font-bold text-xs whitespace-nowrap">Namespace Name</TableHead>
                    <TableHead className="font-bold text-xs whitespace-nowrap">Supervisor IP</TableHead>
                    <TableHead className="font-bold text-xs whitespace-nowrap">System</TableHead>
                    <TableHead className="font-bold text-xs whitespace-nowrap">Cluster</TableHead>
                    <TableHead className="font-bold text-xs whitespace-nowrap">Node Groups & Nodes</TableHead>
                    <TableHead className="font-bold text-xs whitespace-nowrap">Allocated Resources</TableHead>
                    <TableHead className="font-bold text-xs whitespace-nowrap">Created Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNamespaces.map((ns) => (
                    <TableRow key={ns.id} className="hover:bg-slate-50/50 text-xs">
                      <TableCell className="font-bold text-cyan-800">
                        <div className="flex items-center gap-1.5">
                          <Box size={13} className="text-cyan-600 flex-shrink-0" />
                          <span>{ns.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-slate-600 text-[12px]">{ns.supervisorIp}</TableCell>
                      <TableCell className="font-medium text-slate-700">{ns.systemName}</TableCell>
                      <TableCell className="font-medium text-indigo-600/80">{ns.clusterName}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 font-semibold text-slate-700">
                            <span>{ns.totalNodes} Nodes total</span>
                          </div>
                          {ns.nodeGroups && ns.nodeGroups.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {ns.nodeGroups.map((g, idx) => (
                                <Badge key={idx} variant="outline" className="text-[10px] px-1 py-0 bg-slate-50 border-slate-200">
                                  {g.name}: {g.nodeCount} nodes ({g.vcpu}c/{g.ramGb}G)
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5 whitespace-nowrap">
                          <div className="text-[11px] text-slate-500 flex items-center justify-between gap-2">
                            <span>vCPU:</span>
                            <span className="font-bold text-slate-700">{ns.vcpu} core</span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center justify-between gap-2">
                            <span>RAM:</span>
                            <span className="font-bold text-slate-700">{autoScaleRam(ns.ramGb)}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center justify-between gap-2">
                            <span>Storage:</span>
                            <span className="font-bold text-slate-700">{autoScaleStorage(ns.storageGb)}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-500 whitespace-nowrap">
                        {ns.createdAt ? format(new Date(ns.createdAt), "MMM dd, yyyy") : "N/A"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
