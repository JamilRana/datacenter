// src/app/reports/components/tables/SystemWiseReportTable.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  Loader2, 
  Download, 
  Filter, 
  RefreshCw,
  FolderKanban,
  Server,
  ListChecks,
  Box,
  ShieldCheck,
  Laptop,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Cpu,
  HardDrive,
  Calendar,
  Layers,
  User,
  Clock
} from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  getSystemWiseReportAction, 
  type SystemWiseReportResult 
} from "@/app/actions/report-tabular-actions";
import { SystemReportItem, SystemReportSummary } from "@/types/reports";
import { exportToExcel, exportToCSV } from "@/lib/export-utils";
import { format } from "date-fns";
import { Pagination } from "@/components/Pagination";
import { toast } from "sonner";
import { StatCard } from "@/components/analytics/StatCard";
import { 
  ReportKpiSkeleton, 
  ReportTableSkeleton, 
  ReportEmptyState, 
  ReportErrorState 
} from "../ReportSkeletons";
import { 
  autoScaleRam, 
  autoScaleStorage, 
  getReportFilename, 
  formatDateRangeUnambiguous, 
  formatDateDhaka 
} from "@/lib/format-utils";

export function SystemWiseReportTable({ 
  dateRange,
  refreshKey 
}: { 
  dateRange?: { from: Date; to: Date };
  refreshKey?: number;
}) {
  const [data, setData] = useState<SystemReportItem[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<SystemReportSummary>({
    totalSystems: 0,
    totalVms: 0,
    totalRequests: 0,
    totalNamespaces: 0,
    totalAccessUsers: 0,
    totalVcpu: 0,
    totalRamGb: 0,
    totalStorageGb: 0,
  });
  const [availableEnvironments, setAvailableEnvironments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [environmentFilter, setEnvironmentFilter] = useState<string>("ALL");
  const [resourceFilter, setResourceFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [isExporting, setIsExporting] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Sub-tabs active per system
  const [activeSubTabs, setActiveSubTabs] = useState<Record<string, "vms" | "requests" | "namespaces" | "users">>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSystemWiseReportAction({
        page,
        pageSize,
        searchTerm: search,
        environment: environmentFilter,
        resourceFilter: resourceFilter as any,
      });

      setData(res.data);
      setTotal(res.total);
      setSummary(res.summary);
      setAvailableEnvironments(res.availableEnvironments);
    } catch (err: unknown) {
      console.error("[REPORT_SYSTEMS_ERROR]", err);
      const msg = err instanceof Error ? err.message : "Unable to load system-wise report.";
      setError(msg);
      toast.error("Failed to load system-wise report");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, environmentFilter, resourceFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleClearFilters = () => {
    setSearch("");
    setEnvironmentFilter("ALL");
    setResourceFilter("ALL");
    setPage(1);
  };

  // Expand / collapse all currently visible systems
  const isAllExpanded = useMemo(() => {
    if (data.length === 0) return false;
    return data.every(item => expandedRows.has(item.id));
  }, [data, expandedRows]);

  const toggleExpandAll = () => {
    if (isAllExpanded) {
      setExpandedRows(new Set());
    } else {
      const allIds = new Set(data.map(item => item.id));
      setExpandedRows(allIds);
    }
  };

  const setSystemSubTab = (sysId: string, tab: "vms" | "requests" | "namespaces" | "users") => {
    setActiveSubTabs(prev => ({
      ...prev,
      [sysId]: tab
    }));
  };

  const handleExport = async (formatType: "xlsx" | "csv") => {
    try {
      setIsExporting(true);
      toast.info("Preparing complete system-wise export...");

      const fullRes = await getSystemWiseReportAction({
        getAll: true,
        searchTerm: search,
        environment: environmentFilter,
        resourceFilter: resourceFilter as any,
      });

      const filename = getReportFilename("system_wise_allocations", dateRange?.from, dateRange?.to, formatType);

      if (formatType === "xlsx") {
        // Sheet 1: Systems Summary
        const systemsSheet = fullRes.data.map(s => ({
          "System Name": s.systemName,
          "Environments": s.environments.join(", ") || "N/A",
          "Total VMs": s.totalVmsCount,
          "Total Requests": s.totalRequestsCount,
          "Total Namespaces": s.totalNamespacesCount,
          "Total Access Users": s.totalAccessUsersCount,
          "Total vCPU (Cores)": s.totalVcpu,
          "Total RAM (GB)": s.totalRamGb,
          "Total Storage (GB)": s.totalStorageGb,
        }));

        // Sheet 2: System VMs
        const vmsSheet: Array<Record<string, unknown>> = [];
        for (const s of fullRes.data) {
          for (const vm of s.vms) {
            vmsSheet.push({
              "System Name": s.systemName,
              "VM Hostname": vm.hostname,
              "IP Address": vm.ipAddress,
              "Environment": vm.environment,
              "Status": vm.status,
              "vCPU": vm.vcpu,
              "RAM (GB)": vm.ramGb,
              "Storage (GB)": vm.storageGb,
              "Owner": vm.ownerName,
              "Host Asset": vm.hostAsset || "Unassigned",
              "Renewal Date": vm.renewalDate ? format(new Date(vm.renewalDate), "yyyy-MM-dd") : "N/A"
            });
          }
        }

        // Sheet 3: System Requests
        const reqsSheet: Array<Record<string, unknown>> = [];
        for (const s of fullRes.data) {
          for (const req of s.requests) {
            reqsSheet.push({
              "System Name": s.systemName,
              "Request ID": req.displayId,
              "Type": req.type,
              "Status": req.status,
              "Environment": req.environment,
              "Requester": req.requesterName,
              "Requester Email": req.requesterEmail || "N/A",
              "Submitted Date": format(new Date(req.submittedAt), "yyyy-MM-dd HH:mm"),
              "VMs In Request": req.vmsCount
            });
          }
        }

        // Sheet 4: System Namespaces
        const nsSheet: Array<Record<string, unknown>> = [];
        for (const s of fullRes.data) {
          for (const ns of s.namespaces) {
            nsSheet.push({
              "System Name": s.systemName,
              "Namespace": ns.name,
              "Supervisor IP": ns.supervisorIp,
              "Cluster": ns.clusterName,
              "Total Nodes": ns.totalNodes,
              "vCPU (Cores)": ns.totalVcpu,
              "RAM (GB)": ns.totalRamGb,
              "Storage (GB)": ns.totalStorageGb,
              "Requester": ns.requester,
              "Status": ns.status,
              "Created Date": format(new Date(ns.createdAt), "yyyy-MM-dd")
            });
          }
        }

        // Sheet 5: System Access Users
        const usersSheet: Array<Record<string, unknown>> = [];
        for (const s of fullRes.data) {
          for (const u of s.accessUsers) {
            usersSheet.push({
              "System Name": s.systemName,
              "User Name": u.personName,
              "User Email": u.email || "N/A",
              "Access Method": u.accessTypes.join(" + "),
              "Target Type": u.targetType,
              "Assigned Targets": u.targetNames.join(", "),
              "Status": u.status,
              "Last Assigned": u.lastAssignedAt ? format(new Date(u.lastAssignedAt), "yyyy-MM-dd HH:mm") : "N/A"
            });
          }
        }

        await exportToExcel(filename, systemsSheet, {
          sheetName: "Systems Directory",
          sheets: [
            { name: "Virtual Machines", data: vmsSheet },
            { name: "Requests Pipeline", data: reqsSheet },
            { name: "K8s Namespaces", data: nsSheet },
            { name: "Access Users", data: usersSheet },
          ],
          metadata: {
            reportTitle: "System-Name-Wise Application & Infrastructure Report",
            dateRange: dateRange ? formatDateRangeUnambiguous(dateRange.from, dateRange.to) : undefined,
            scope: "Hierarchical system allocations across VMs, requests, namespaces, and access users",
            generatedAt: formatDateDhaka(new Date()),
            filters: {
              "Search": search || "None",
              "Environment": environmentFilter,
              "Resource Filter": resourceFilter,
            },
            definitions: {
              "System Name": "Primary business application or service identifier",
              "Access Users": "Unified remote access credentials mapped to resources in this system"
            }
          }
        });
      } else {
        // Consolidated CSV
        const csvRows: Array<Record<string, unknown>> = fullRes.data.map(s => ({
          "System Name": s.systemName,
          "Environments": s.environments.join(", "),
          "VM Count": s.totalVmsCount,
          "Requests Count": s.totalRequestsCount,
          "Namespaces Count": s.totalNamespacesCount,
          "Access Users Count": s.totalAccessUsersCount,
          "Total vCPU": s.totalVcpu,
          "Total RAM (GB)": s.totalRamGb,
          "Total Storage (GB)": s.totalStorageGb,
        }));
        exportToCSV(filename, csvRows);
      }

      toast.success(`Exported ${fullRes.data.length} systems successfully.`);
    } catch (e) {
      console.error(e);
      toast.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && <ReportErrorState error={error} onRetry={fetchData} />}

      {/* KPI Stat Cards */}
      {loading ? (
        <ReportKpiSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard 
            title="Total Systems" 
            value={summary.totalSystems} 
            icon={<FolderKanban className="text-indigo-600" size={18}/>}
            subtitle={`${summary.totalVms} VMs across systems`}
            periodType="Current"
            tooltip="Total distinct business applications and systems in scope"
          />
          <StatCard 
            title="Total Allocated Specs" 
            value={`${summary.totalVcpu} Cores`} 
            icon={<Cpu className="text-blue-600" size={18}/>}
            subtitle={`${autoScaleRam(summary.totalRamGb)} • ${autoScaleStorage(summary.totalStorageGb)}`}
            periodType="Current"
            tooltip="Total effective capacity footprint allocated to virtual machines under these systems"
          />
          <StatCard 
            title="Associated Requests" 
            value={summary.totalRequests} 
            icon={<ListChecks className="text-purple-600" size={18}/>}
            subtitle={`${summary.totalNamespaces} K8s namespaces`}
            periodType="Current"
            tooltip="Total provisioning requests and container namespaces mapped to systems"
          />
          <StatCard 
            title="Remote Access Users" 
            value={summary.totalAccessUsers} 
            icon={<ShieldCheck className="text-emerald-600" size={18}/>}
            subtitle="VPN & Horizon credential holders"
            periodType="Current"
            tooltip="Total distinct people granted remote access to VMs or namespaces in these systems"
          />
        </div>
      )}

      {/* Main Table Card */}
      <div className="space-y-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        {/* Search and Action Bar */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by system name, VM hostname/IP, request ID, namespace, user..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10 h-10 bg-slate-50 border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500 text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleExpandAll}
                disabled={data.length === 0}
                className="h-9 gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500"
                title={isAllExpanded ? "Collapse all systems" : "Expand all systems"}
              >
                <ChevronsUpDown className="h-3.5 w-3.5 text-slate-500" />
                {isAllExpanded ? "Collapse All" : "Expand All"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("xlsx")}
                disabled={isExporting || data.length === 0}
                className="h-9 gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200 focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                {isExporting ? <Loader2 size={13} className="animate-spin text-emerald-600" /> : <Download className="h-3.5 w-3.5" />}
                Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("csv")}
                disabled={isExporting || data.length === 0}
                className="h-9 gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                {isExporting ? <Loader2 size={13} className="animate-spin text-slate-600" /> : <Download className="h-3.5 w-3.5" />}
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchData}
                className="h-9 gap-1 text-xs text-slate-600 hover:text-slate-900 border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500"
                title="Refresh system-wise report"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <Filter className="h-3.5 w-3.5" />
              Filters:
            </div>

            {/* Environment Filter */}
            <div className="w-44">
              <Select 
                value={environmentFilter} 
                onValueChange={(val) => {
                  setEnvironmentFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500">
                  <SelectValue placeholder="Environment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Environments</SelectItem>
                  {availableEnvironments.map(e => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Resource Presence Filter */}
            <div className="w-48">
              <Select 
                value={resourceFilter} 
                onValueChange={(val) => {
                  setResourceFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500">
                  <SelectValue placeholder="Resource Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Systems</SelectItem>
                  <SelectItem value="VMS">Has Virtual Machines</SelectItem>
                  <SelectItem value="REQUESTS">Has Requests</SelectItem>
                  <SelectItem value="NAMESPACES">Has Namespaces</SelectItem>
                  <SelectItem value="USERS">Has Access Users</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(environmentFilter !== "ALL" || resourceFilter !== "ALL" || search) && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-8 text-xs text-slate-500 hover:text-slate-900">
                Clear filters
              </Button>
            )}

            <div className="text-xs text-slate-500 font-medium ml-auto flex items-center gap-3">
              <span>Showing <strong className="font-bold text-slate-800">{total}</strong> systems</span>
              <span className="text-slate-300">|</span>
              <span><strong className="font-semibold text-indigo-700">{summary.totalVms}</strong> VMs</span>
              <span className="text-slate-300">|</span>
              <span><strong className="font-semibold text-cyan-700">{summary.totalNamespaces}</strong> Namespaces</span>
              <span className="text-slate-300">|</span>
              <span><strong className="font-semibold text-emerald-700">{summary.totalAccessUsers}</strong> Users</span>
            </div>
          </div>
        </div>

        {/* Expandable Table */}
        <div className="overflow-x-auto border border-slate-100 rounded-xl min-h-[380px]">
          {loading ? (
            <ReportTableSkeleton rows={pageSize} columns={7} />
          ) : data.length === 0 ? (
            <div className="p-8">
              <ReportEmptyState 
                message="No systems match the selected criteria and filters" 
                onClearFilters={handleClearFilters} 
              />
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="w-10 px-3 py-3.5 text-center text-xs font-bold text-slate-400"></th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">System / Application</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Environments</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Associated Resources</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Allocated Capacity</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((system) => {
                  const isExpanded = expandedRows.has(system.id);
                  const activeSubTab = activeSubTabs[system.id] || "vms";

                  return (
                    <tr key={system.id} className="group">
                      <td colSpan={6} className="p-0">
                        {/* Parent Row */}
                        <div 
                          onClick={() => toggleRow(system.id)}
                          role="button"
                          tabIndex={0}
                          aria-expanded={isExpanded}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleRow(system.id);
                            }
                          }}
                          className={`flex items-center px-3 py-4 cursor-pointer transition-colors focus-visible:outline-none focus-visible:bg-indigo-50/50 ${
                            isExpanded ? "bg-indigo-50/30" : "hover:bg-slate-50/80"
                          }`}
                        >
                          {/* Chevron Toggle */}
                          <div className="w-8 flex items-center justify-center flex-shrink-0 text-slate-400 group-hover:text-slate-600">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-indigo-600 transition-transform" />
                            ) : (
                              <ChevronRight className="h-4 w-4 transition-transform" />
                            )}
                          </div>

                          {/* System Name */}
                          <div className="w-[30%] min-w-[220px] px-2 flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-50 to-slate-100 border border-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-600 shadow-xs">
                              <FolderKanban className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-slate-900 text-sm truncate" title={system.systemName}>
                                {system.systemName}
                              </span>
                              {system.id === "unassigned" ? (
                                <span className="text-[10px] text-amber-600 font-medium">Standalone resources without system tags</span>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-mono">system:{system.id}</span>
                              )}
                            </div>
                          </div>

                          {/* Environments */}
                          <div className="w-[18%] min-w-[130px] px-2 flex items-center gap-1.5 flex-wrap">
                            {system.environments.length > 0 ? (
                              system.environments.map(e => (
                                <Badge 
                                  key={e} 
                                  variant="outline" 
                                  className={`text-[9px] font-bold px-1.5 py-0 ${
                                    e === "PRODUCTION" 
                                      ? "bg-purple-50 text-purple-700 border-purple-200"
                                      : e === "STAGING"
                                      ? "bg-blue-50 text-blue-700 border-blue-200"
                                      : "bg-slate-50 text-slate-600 border-slate-200"
                                  }`}
                                >
                                  {e}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-slate-400 italic">None</span>
                            )}
                          </div>

                          {/* Resource Counts */}
                          <div className="w-[28%] min-w-[210px] px-2 flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="bg-indigo-50/80 text-indigo-700 border-indigo-200 font-bold text-[10px] gap-1 px-2 py-0.5" title="Virtual Machines">
                              <Server className="h-3 w-3" />
                              {system.totalVmsCount} VMs
                            </Badge>

                            <Badge variant="outline" className="bg-purple-50/80 text-purple-700 border-purple-200 font-bold text-[10px] gap-1 px-2 py-0.5" title="Requests">
                              <ListChecks className="h-3 w-3" />
                              {system.totalRequestsCount} Reqs
                            </Badge>

                            <Badge variant="outline" className="bg-cyan-50/80 text-cyan-700 border-cyan-200 font-bold text-[10px] gap-1 px-2 py-0.5" title="Kubernetes Namespaces">
                              <Box className="h-3 w-3" />
                              {system.totalNamespacesCount} Namespaces
                            </Badge>

                            <Badge variant="outline" className="bg-emerald-50/80 text-emerald-700 border-emerald-200 font-bold text-[10px] gap-1 px-2 py-0.5" title="Remote Access Users">
                              <ShieldCheck className="h-3 w-3" />
                              {system.totalAccessUsersCount} Users
                            </Badge>
                          </div>

                          {/* Allocated Capacity */}
                          <div className="w-[18%] min-w-[130px] px-2 flex flex-col justify-center">
                            <div className="text-xs font-bold text-slate-800">
                              {system.totalVcpu} Cores
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium">
                              {autoScaleRam(system.totalRamGb)} • {autoScaleStorage(system.totalStorageGb)}
                            </div>
                          </div>

                          {/* Action toggle label */}
                          <div className="w-[6%] min-w-[60px] px-2 text-right">
                            <span className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800">
                              {isExpanded ? "Hide" : "Details"}
                            </span>
                          </div>
                        </div>

                        {/* Expanded Child View */}
                        {isExpanded && (
                          <div className="px-6 py-5 bg-slate-50/70 border-t border-b border-indigo-100/70 space-y-4">
                            {/* Inner Sub-Navigation Tabs */}
                            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                              <Button
                                size="sm"
                                variant={activeSubTab === "vms" ? "default" : "outline"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSystemSubTab(system.id, "vms");
                                }}
                                className={`h-8 gap-1.5 text-xs font-semibold ${
                                  activeSubTab === "vms" 
                                    ? "bg-indigo-600 text-white hover:bg-indigo-700" 
                                    : "text-slate-600 hover:text-slate-900 border-slate-200 bg-white"
                                }`}
                              >
                                <Server className="h-3.5 w-3.5" />
                                Virtual Machines ({system.vms.length})
                              </Button>

                              <Button
                                size="sm"
                                variant={activeSubTab === "requests" ? "default" : "outline"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSystemSubTab(system.id, "requests");
                                }}
                                className={`h-8 gap-1.5 text-xs font-semibold ${
                                  activeSubTab === "requests" 
                                    ? "bg-purple-600 text-white hover:bg-purple-700" 
                                    : "text-slate-600 hover:text-slate-900 border-slate-200 bg-white"
                                }`}
                              >
                                <ListChecks className="h-3.5 w-3.5" />
                                Requests ({system.requests.length})
                              </Button>

                              <Button
                                size="sm"
                                variant={activeSubTab === "namespaces" ? "default" : "outline"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSystemSubTab(system.id, "namespaces");
                                }}
                                className={`h-8 gap-1.5 text-xs font-semibold ${
                                  activeSubTab === "namespaces" 
                                    ? "bg-cyan-600 text-white hover:bg-cyan-700" 
                                    : "text-slate-600 hover:text-slate-900 border-slate-200 bg-white"
                                }`}
                              >
                                <Box className="h-3.5 w-3.5" />
                                Namespaces ({system.namespaces.length})
                              </Button>

                              <Button
                                size="sm"
                                variant={activeSubTab === "users" ? "default" : "outline"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSystemSubTab(system.id, "users");
                                }}
                                className={`h-8 gap-1.5 text-xs font-semibold ${
                                  activeSubTab === "users" 
                                    ? "bg-emerald-600 text-white hover:bg-emerald-700" 
                                    : "text-slate-600 hover:text-slate-900 border-slate-200 bg-white"
                                }`}
                              >
                                <ShieldCheck className="h-3.5 w-3.5" />
                                Access Users ({system.accessUsers.length})
                              </Button>
                            </div>

                            {/* Sub-tab 1: Virtual Machines */}
                            {activeSubTab === "vms" && (
                              <div className="space-y-2">
                                {system.vms.length === 0 ? (
                                  <div className="py-4 px-5 bg-white rounded-xl border border-slate-200 text-xs text-slate-400 italic">
                                    No virtual machines currently provisioned for this system.
                                  </div>
                                ) : (
                                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                                    <table className="w-full text-left border-collapse text-xs">
                                      <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                        <tr>
                                          <th className="px-4 py-2.5">Hostname</th>
                                          <th className="px-4 py-2.5">IP Address</th>
                                          <th className="px-4 py-2.5">Environment</th>
                                          <th className="px-4 py-2.5">Status</th>
                                          <th className="px-4 py-2.5">Effective Spec</th>
                                          <th className="px-4 py-2.5">Host Asset</th>
                                          <th className="px-4 py-2.5">Owner</th>
                                          <th className="px-4 py-2.5">Renewal Date</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {system.vms.map(vm => (
                                          <tr key={vm.id} className="hover:bg-slate-50/60">
                                            <td className="px-4 py-2.5 font-bold text-slate-800">
                                              {vm.hostname}
                                            </td>
                                            <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600">
                                              {vm.ipAddress}
                                            </td>
                                            <td className="px-4 py-2.5">
                                              <Badge variant="outline" className="text-[9px] bg-slate-50 text-slate-600 border-slate-200 font-semibold">
                                                {vm.environment}
                                              </Badge>
                                            </td>
                                            <td className="px-4 py-2.5">
                                              <Badge 
                                                variant="outline" 
                                                className={
                                                  vm.status === "ACTIVE" 
                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] font-bold"
                                                    : "bg-slate-50 text-slate-600 border-slate-200 text-[9px]"
                                                }
                                              >
                                                {vm.status}
                                              </Badge>
                                            </td>
                                            <td className="px-4 py-2.5 font-medium text-slate-700">
                                              {vm.vcpu} vCPU • {vm.ramGb} GB • {vm.storageGb} GB
                                            </td>
                                            <td className="px-4 py-2.5 text-slate-600">
                                              {vm.hostAsset || <span className="text-slate-400 italic">Unassigned</span>}
                                            </td>
                                            <td className="px-4 py-2.5 text-slate-700 font-medium">
                                              {vm.ownerName}
                                            </td>
                                            <td className="px-4 py-2.5 text-slate-500 text-[11px]">
                                              {vm.renewalDate ? format(new Date(vm.renewalDate), "MMM dd, yyyy") : "N/A"}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Sub-tab 2: Requests */}
                            {activeSubTab === "requests" && (
                              <div className="space-y-2">
                                {system.requests.length === 0 ? (
                                  <div className="py-4 px-5 bg-white rounded-xl border border-slate-200 text-xs text-slate-400 italic">
                                    No provisioning or change requests found for this system.
                                  </div>
                                ) : (
                                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                                    <table className="w-full text-left border-collapse text-xs">
                                      <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                        <tr>
                                          <th className="px-4 py-2.5">Request ID</th>
                                          <th className="px-4 py-2.5">Type</th>
                                          <th className="px-4 py-2.5">Status</th>
                                          <th className="px-4 py-2.5">Environment</th>
                                          <th className="px-4 py-2.5">Requester</th>
                                          <th className="px-4 py-2.5">Submitted Date</th>
                                          <th className="px-4 py-2.5">VMs Count</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {system.requests.map(req => (
                                          <tr key={req.id} className="hover:bg-slate-50/60">
                                            <td className="px-4 py-2.5 font-mono font-bold text-indigo-700">
                                              #{req.displayId}
                                            </td>
                                            <td className="px-4 py-2.5 font-medium text-slate-700">
                                              {req.type}
                                            </td>
                                            <td className="px-4 py-2.5">
                                              <Badge 
                                                variant="outline" 
                                                className={
                                                  req.status === "APPROVED" || req.status === "PROVISIONED"
                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] font-bold"
                                                    : req.status === "REJECTED"
                                                    ? "bg-rose-50 text-rose-700 border-rose-200 text-[9px] font-bold"
                                                    : "bg-amber-50 text-amber-700 border-amber-200 text-[9px] font-bold"
                                                }
                                              >
                                                {req.status}
                                              </Badge>
                                            </td>
                                            <td className="px-4 py-2.5">
                                              <Badge variant="outline" className="text-[9px] bg-slate-50 text-slate-600 border-slate-200">
                                                {req.environment}
                                              </Badge>
                                            </td>
                                            <td className="px-4 py-2.5 text-slate-700">
                                              <div className="flex flex-col">
                                                <span className="font-semibold text-slate-800">{req.requesterName}</span>
                                                {req.requesterEmail && (
                                                  <span className="text-[10px] text-slate-400">{req.requesterEmail}</span>
                                                )}
                                              </div>
                                            </td>
                                            <td className="px-4 py-2.5 text-slate-500 text-[11px]">
                                              {format(new Date(req.submittedAt), "MMM dd, yyyy HH:mm")}
                                            </td>
                                            <td className="px-4 py-2.5 text-slate-700 font-semibold">
                                              {req.vmsCount}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Sub-tab 3: Kubernetes Namespaces */}
                            {activeSubTab === "namespaces" && (
                              <div className="space-y-2">
                                {system.namespaces.length === 0 ? (
                                  <div className="py-4 px-5 bg-white rounded-xl border border-slate-200 text-xs text-slate-400 italic">
                                    No Kubernetes namespaces mapped to this system.
                                  </div>
                                ) : (
                                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                                    <table className="w-full text-left border-collapse text-xs">
                                      <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                        <tr>
                                          <th className="px-4 py-2.5">Namespace</th>
                                          <th className="px-4 py-2.5">Supervisor IP</th>
                                          <th className="px-4 py-2.5">Cluster</th>
                                          <th className="px-4 py-2.5">Node Groups Total</th>
                                          <th className="px-4 py-2.5">Footprint</th>
                                          <th className="px-4 py-2.5">Requester</th>
                                          <th className="px-4 py-2.5">Created Date</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {system.namespaces.map(ns => (
                                          <tr key={ns.id} className="hover:bg-slate-50/60">
                                            <td className="px-4 py-2.5 font-bold text-slate-800">
                                              {ns.name}
                                            </td>
                                            <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600">
                                              {ns.supervisorIp}
                                            </td>
                                            <td className="px-4 py-2.5 text-slate-600">
                                              <Badge variant="outline" className="bg-cyan-50 text-cyan-700 border-cyan-200 text-[9px] font-semibold">
                                                {ns.clusterName}
                                              </Badge>
                                            </td>
                                            <td className="px-4 py-2.5 text-slate-700 font-semibold">
                                              {ns.totalNodes} Nodes
                                            </td>
                                            <td className="px-4 py-2.5 text-slate-600 font-medium">
                                              {ns.totalVcpu} vCPU • {ns.totalRamGb} GB • {ns.totalStorageGb} GB
                                            </td>
                                            <td className="px-4 py-2.5 text-slate-600">
                                              {ns.requester}
                                            </td>
                                            <td className="px-4 py-2.5 text-slate-500 text-[11px]">
                                              {format(new Date(ns.createdAt), "MMM dd, yyyy")}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Sub-tab 4: Remote Access Users */}
                            {activeSubTab === "users" && (
                              <div className="space-y-2">
                                {system.accessUsers.length === 0 ? (
                                  <div className="py-4 px-5 bg-white rounded-xl border border-slate-200 text-xs text-slate-400 italic">
                                    No remote access credentials mapped to resources in this system.
                                  </div>
                                ) : (
                                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                                    <table className="w-full text-left border-collapse text-xs">
                                      <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                        <tr>
                                          <th className="px-4 py-2.5">User</th>
                                          <th className="px-4 py-2.5">Access Type</th>
                                          <th className="px-4 py-2.5">Target Type</th>
                                          <th className="px-4 py-2.5">Assigned Resources</th>
                                          <th className="px-4 py-2.5">Status</th>
                                          <th className="px-4 py-2.5">Last Assigned</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {system.accessUsers.map(user => (
                                          <tr key={user.id} className="hover:bg-slate-50/60">
                                            <td className="px-4 py-2.5">
                                              <div className="flex items-center gap-2">
                                                <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                                  <User className="h-3 w-3" />
                                                </div>
                                                <div className="flex flex-col">
                                                  <span className="font-semibold text-slate-800">{user.personName}</span>
                                                  {user.email && (
                                                    <span className="text-[10px] text-slate-400">{user.email}</span>
                                                  )}
                                                </div>
                                              </div>
                                            </td>
                                            <td className="px-4 py-2.5">
                                              <div className="flex items-center gap-1">
                                                {user.accessTypes.map(t => (
                                                  <Badge
                                                    key={t}
                                                    className={
                                                      t === "VPN"
                                                        ? "bg-purple-100 text-purple-700 hover:bg-purple-100 border-none font-bold text-[9px] gap-1"
                                                        : "bg-blue-100 text-blue-700 hover:bg-blue-100 border-none font-bold text-[9px] gap-1"
                                                    }
                                                  >
                                                    {t === "VPN" ? <ShieldCheck className="h-3 w-3" /> : <Laptop className="h-3 w-3" />}
                                                    {t}
                                                  </Badge>
                                                ))}
                                              </div>
                                            </td>
                                            <td className="px-4 py-2.5">
                                              <Badge variant="outline" className="text-[9px] bg-slate-50 text-slate-600 border-slate-200">
                                                {user.targetType}
                                              </Badge>
                                            </td>
                                            <td className="px-4 py-2.5 text-slate-600 font-medium">
                                              {user.targetNames.join(", ")}
                                            </td>
                                            <td className="px-4 py-2.5">
                                              <Badge 
                                                variant="outline" 
                                                className={
                                                  user.status === "ACTIVE" 
                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] font-bold" 
                                                    : "bg-rose-50 text-rose-700 border-rose-200 text-[9px]"
                                                }
                                              >
                                                {user.status}
                                              </Badge>
                                            </td>
                                            <td className="px-4 py-2.5 text-slate-500 text-[11px]">
                                              {user.lastAssignedAt ? format(new Date(user.lastAssignedAt), "MMM dd, yyyy") : "N/A"}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!loading && total > 0 && (
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(total / pageSize)}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
}
