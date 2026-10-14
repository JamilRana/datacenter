// src/app/reports/components/tables/VpnHorizonTable.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  Loader2, 
  User, 
  Calendar, 
  ShieldCheck, 
  Laptop, 
  Layers, 
  Download, 
  Filter, 
  CheckCircle2, 
  Clock, 
  Key, 
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Server,
  AlertTriangle,
  ChevronsUpDown,
  Check
} from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { getVpnHorizonReportData, type VpnHorizonUserReportItem } from "@/app/actions/report-actions";
import { exportToExcel, exportToCSV } from "@/lib/export-utils";
import { format } from "date-fns";
import { Pagination } from "@/components/Pagination";
import { toast } from "sonner";
import { 
  ReportTableSkeleton, 
  ReportEmptyState, 
  ReportErrorState 
} from "../ReportSkeletons";
import { 
  getReportFilename, 
  formatDateRangeUnambiguous, 
  formatDateDhaka 
} from "@/lib/format-utils";

export function VpnHorizonTable({ 
  dateRange,
  refreshKey 
}: { 
  dateRange?: { from: Date; to: Date };
  refreshKey?: number;
}) {
  const [data, setData] = useState<VpnHorizonUserReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [accessTypeFilter, setAccessTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [isExporting, setIsExporting] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getVpnHorizonReportData();
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setData([]);
      }
    } catch (err: unknown) {
      console.error("[REPORT_VPN_HORIZON_ERROR]", err);
      const msg = err instanceof Error ? err.message : "Unable to load VPN & Horizon access report.";
      setError(msg);
      toast.error("Failed to load VPN & Horizon access report");
    } finally {
      setLoading(false);
    }
  }, []);

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
    setAccessTypeFilter("ALL");
    setStatusFilter("ALL");
    setTargetTypeFilter("ALL");
    setPage(1);
  };

  // Filter pipeline
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      // Access type filter
      if (accessTypeFilter !== "ALL") {
        if (accessTypeFilter === "VPN" && !item.hasVpn) return false;
        if (accessTypeFilter === "HORIZON" && !item.hasHorizon) return false;
        if (accessTypeFilter === "BOTH" && (!item.hasVpn || !item.hasHorizon)) return false;
      }

      // Status filter
      if (statusFilter !== "ALL") {
        if (item.status.toUpperCase() !== statusFilter.toUpperCase()) return false;
      }

      // Target type filter
      if (targetTypeFilter !== "ALL") {
        if (targetTypeFilter === "VMS" && item.totalVmsCount === 0) return false;
        if (targetTypeFilter === "NAMESPACES" && item.totalNamespacesCount === 0) return false;
        if (targetTypeFilter === "LEGACY" && !item.hasLegacy) return false;
      }

      // Search fields: Person name, email, account usernames, assigned VM hostnames/IPs, namespace names, systems
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesPerson = item.personName.toLowerCase().includes(q) || (item.email && item.email.toLowerCase().includes(q));
        const matchesAccounts = (item.vpnAccount?.username && item.vpnAccount.username.toLowerCase().includes(q)) ||
                                (item.horizonAccount?.username && item.horizonAccount.username.toLowerCase().includes(q));
        const matchesVms = item.assignedVms.some(v => 
          v.hostname.toLowerCase().includes(q) ||
          v.ipAddress.toLowerCase().includes(q) ||
          v.systemName.toLowerCase().includes(q)
        );
        const matchesNamespaces = item.assignedNamespaces.some(n =>
          n.name.toLowerCase().includes(q) ||
          n.supervisorIp.toLowerCase().includes(q) ||
          n.systemName.toLowerCase().includes(q)
        );

        if (!matchesPerson && !matchesAccounts && !matchesVms && !matchesNamespaces) {
          return false;
        }
      }

      return true;
    });
  }, [data, search, accessTypeFilter, statusFilter, targetTypeFilter]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [search, accessTypeFilter, statusFilter, targetTypeFilter]);

  // Expand / collapse all currently filtered items
  const isAllExpanded = useMemo(() => {
    if (filteredData.length === 0) return false;
    return filteredData.every(item => expandedRows.has(item.id));
  }, [filteredData, expandedRows]);

  const toggleExpandAll = () => {
    if (isAllExpanded) {
      setExpandedRows(new Set());
    } else {
      const allIds = new Set(filteredData.map(item => item.id));
      setExpandedRows(allIds);
    }
  };

  // Pagination slice
  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, page, pageSize]);

  // Summary counts across filtered items
  const totalFilteredVms = useMemo(() => {
    return filteredData.reduce((acc, curr) => acc + curr.totalVmsCount, 0);
  }, [filteredData]);

  const totalFilteredNamespaces = useMemo(() => {
    return filteredData.reduce((acc, curr) => acc + curr.totalNamespacesCount, 0);
  }, [filteredData]);

  const handleExport = async (formatType: "xlsx" | "csv") => {
    try {
      setIsExporting(true);
      const filename = getReportFilename("vpn_horizon_allocations_by_user", dateRange?.from, dateRange?.to, formatType);

      if (formatType === "xlsx") {
        // Multi-sheet structure
        // Sheet 1: User Directory
        const userDirectorySheet = filteredData.map((item) => ({
          "Person Name": item.personName,
          "Email": item.email || "N/A",
          "Portal Linked": item.portalUserId ? "Yes" : "No",
          "Has VPN Access": item.hasVpn ? "Yes" : "No",
          "VPN Username": item.vpnAccount?.username || "N/A",
          "VPN IP": item.vpnAccount?.vpnIp || "N/A",
          "Has Horizon Client": item.hasHorizon ? "Yes" : "No",
          "Horizon Username": item.horizonAccount?.username || "N/A",
          "Total VMs": item.totalVmsCount,
          "Total Namespaces": item.totalNamespacesCount,
          "Status": item.status,
          "Has Legacy Data": item.hasLegacy ? "Yes" : "No",
          "Last Assigned Date": item.lastAssignedAt ? format(new Date(item.lastAssignedAt), "yyyy-MM-dd HH:mm") : "N/A"
        }));

        // Sheet 2: Assigned VMs
        const assignedVmsSheet: Array<Record<string, unknown>> = [];
        for (const user of filteredData) {
          for (const vm of user.assignedVms) {
            assignedVmsSheet.push({
              "Person Name": user.personName,
              "User Email": user.email || "N/A",
              "VM Hostname": vm.hostname,
              "IP Address": vm.ipAddress,
              "System Name": vm.systemName,
              "Environment": vm.environment,
              "Access Type": vm.accessTypes.join(" + "),
              "VM Status": vm.status,
              "Data Source": vm.isLegacy ? "Legacy Fallback" : "Authoritative",
              "Assigned By": vm.assignedBy || "Administrator",
              "Assigned Date": vm.assignedAt ? format(new Date(vm.assignedAt), "yyyy-MM-dd HH:mm") : "N/A",
              "Expires At": vm.expiresAt ? format(new Date(vm.expiresAt), "yyyy-MM-dd HH:mm") : "No Expiry",
              "Notes": vm.notes || ""
            });
          }
        }

        // Sheet 3: Assigned Namespaces
        const assignedNamespacesSheet: Array<Record<string, unknown>> = [];
        for (const user of filteredData) {
          for (const ns of user.assignedNamespaces) {
            assignedNamespacesSheet.push({
              "Person Name": user.personName,
              "User Email": user.email || "N/A",
              "Namespace Name": ns.name,
              "Supervisor IP": ns.supervisorIp,
              "System Name": ns.systemName,
              "Cluster Name": ns.clusterName,
              "Access Type": ns.accessTypes.join(" + "),
              "Assigned By": ns.assignedBy || "Administrator",
              "Assigned Date": ns.assignedAt ? format(new Date(ns.assignedAt), "yyyy-MM-dd HH:mm") : "N/A",
              "Expires At": ns.expiresAt ? format(new Date(ns.expiresAt), "yyyy-MM-dd HH:mm") : "No Expiry",
              "Notes": ns.notes || ""
            });
          }
        }

        await exportToExcel(filename, userDirectorySheet, {
          sheetName: "User Access Directory",
          sheets: [
            { name: "Assigned VMs", data: assignedVmsSheet },
            { name: "Assigned Namespaces", data: assignedNamespacesSheet },
          ],
          metadata: {
            reportTitle: "Remote Access (VPN & Horizon) Report by User",
            dateRange: dateRange ? formatDateRangeUnambiguous(dateRange.from, dateRange.to) : undefined,
            scope: "One parent row per person, unified accounts and de-duplicated targets",
            generatedAt: formatDateDhaka(new Date()),
            filters: {
              "Search": search || "None",
              "Access Type": accessTypeFilter,
              "Status": statusFilter,
              "Target Type": targetTypeFilter
            },
            definitions: {
              "Authoritative Source": "New vmId / namespaceId fields take complete precedence",
              "Legacy Fallback": "Old vmInstanceId or assignedVms mappings, never double counted"
            }
          }
        });
      } else {
        // Flattened CSV export with full context
        const csvRows: Array<Record<string, unknown>> = [];
        for (const user of filteredData) {
          if (user.assignedVms.length === 0 && user.assignedNamespaces.length === 0) {
            csvRows.push({
              "Person Name": user.personName,
              "Email": user.email || "N/A",
              "Portal Linked": user.portalUserId ? "Yes" : "No",
              "VPN Account": user.vpnAccount?.username || "N/A",
              "Horizon Account": user.horizonAccount?.username || "N/A",
              "Resource Type": "NONE",
              "Resource Name": "No direct targets",
              "IP Address": "N/A",
              "System": "N/A",
              "Access Method": user.hasVpn && user.hasHorizon ? "VPN + Horizon" : user.hasVpn ? "VPN" : user.hasHorizon ? "Horizon" : "N/A",
              "Data Source": "N/A",
              "Status": user.status,
              "Assigned At": user.lastAssignedAt ? format(new Date(user.lastAssignedAt), "yyyy-MM-dd HH:mm") : "N/A"
            });
          }
          for (const vm of user.assignedVms) {
            csvRows.push({
              "Person Name": user.personName,
              "Email": user.email || "N/A",
              "Portal Linked": user.portalUserId ? "Yes" : "No",
              "VPN Account": user.vpnAccount?.username || "N/A",
              "Horizon Account": user.horizonAccount?.username || "N/A",
              "Resource Type": "VM",
              "Resource Name": vm.hostname,
              "IP Address": vm.ipAddress,
              "System": vm.systemName,
              "Access Method": vm.accessTypes.join(" + "),
              "Data Source": vm.isLegacy ? "Legacy Fallback" : "Authoritative",
              "Status": vm.status,
              "Assigned At": vm.assignedAt ? format(new Date(vm.assignedAt), "yyyy-MM-dd HH:mm") : "N/A"
            });
          }
          for (const ns of user.assignedNamespaces) {
            csvRows.push({
              "Person Name": user.personName,
              "Email": user.email || "N/A",
              "Portal Linked": user.portalUserId ? "Yes" : "No",
              "VPN Account": user.vpnAccount?.username || "N/A",
              "Horizon Account": user.horizonAccount?.username || "N/A",
              "Resource Type": "NAMESPACE",
              "Resource Name": ns.name,
              "IP Address": ns.supervisorIp,
              "System": ns.systemName,
              "Access Method": ns.accessTypes.join(" + "),
              "Data Source": "Authoritative",
              "Status": "ACTIVE",
              "Assigned At": ns.assignedAt ? format(new Date(ns.assignedAt), "yyyy-MM-dd HH:mm") : "N/A"
            });
          }
        }
        exportToCSV(filename, csvRows);
      }
      toast.success(`Exported ${filteredData.length} user records successfully`);
    } catch (e) {
      console.error(e);
      toast.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <ReportErrorState error={error} onRetry={fetchData} />}

      <div className="space-y-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        {/* Search and Filters Bar */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by person name, email, accounts, VM hostname, IP, namespace..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-10 bg-slate-50 border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500 text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleExpandAll}
                disabled={filteredData.length === 0}
                className="h-9 gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500"
                title={isAllExpanded ? "Collapse all rows" : "Expand all rows"}
              >
                <ChevronsUpDown className="h-3.5 w-3.5 text-slate-500" />
                {isAllExpanded ? "Collapse All" : "Expand All"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("xlsx")}
                disabled={isExporting || filteredData.length === 0}
                className="h-9 gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200 focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                {isExporting ? <Loader2 size={13} className="animate-spin text-emerald-600" /> : <Download className="h-3.5 w-3.5" />}
                Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("csv")}
                disabled={isExporting || filteredData.length === 0}
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
                title="Refresh remote access report"
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

            <div className="w-44">
              <Select value={accessTypeFilter} onValueChange={setAccessTypeFilter}>
                <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500">
                  <SelectValue placeholder="Access Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Access Types</SelectItem>
                  <SelectItem value="VPN">Has VPN Access</SelectItem>
                  <SelectItem value="HORIZON">Has Horizon Client</SelectItem>
                  <SelectItem value="BOTH">Both (VPN + Horizon)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-40">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="EXPIRED">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-44">
              <Select value={targetTypeFilter} onValueChange={setTargetTypeFilter}>
                <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500">
                  <SelectValue placeholder="Target Resources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Targets</SelectItem>
                  <SelectItem value="VMS">Has Assigned VMs</SelectItem>
                  <SelectItem value="NAMESPACES">Has Namespaces</SelectItem>
                  <SelectItem value="LEGACY">Has Legacy Mappings</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(accessTypeFilter !== "ALL" || statusFilter !== "ALL" || targetTypeFilter !== "ALL" || search) && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-8 text-xs text-slate-500 hover:text-slate-900">
                Clear filters
              </Button>
            )}

            <div className="text-xs text-slate-500 font-medium ml-auto flex items-center gap-3">
              <span>Showing <strong className="font-bold text-slate-800">{filteredData.length}</strong> people</span>
              <span className="text-slate-300">|</span>
              <span><strong className="font-semibold text-indigo-700">{totalFilteredVms}</strong> VMs</span>
              <span className="text-slate-300">|</span>
              <span><strong className="font-semibold text-cyan-700">{totalFilteredNamespaces}</strong> Namespaces</span>
            </div>
          </div>
        </div>

        {/* Expandable Table */}
        <div className="overflow-x-auto border border-slate-100 rounded-xl min-h-[380px]">
          {loading ? (
            <ReportTableSkeleton rows={pageSize} columns={7} />
          ) : filteredData.length === 0 ? (
            <div className="p-8">
              <ReportEmptyState 
                message="No data for this period and filters" 
                onClearFilters={handleClearFilters} 
              />
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="w-10 px-3 py-3.5 text-center text-xs font-bold text-slate-400"></th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Person / User</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Provisioned Accounts</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Assigned Resources</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Data Source</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Last Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedData.map((item) => {
                  const isExpanded = expandedRows.has(item.id);
                  const isActive = item.status === "ACTIVE";

                  return (
                    <tr key={item.id} className="group">
                      <td colSpan={7} className="p-0">
                        {/* Parent Row */}
                        <div 
                          onClick={() => toggleRow(item.id)}
                          role="button"
                          tabIndex={0}
                          aria-expanded={isExpanded}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleRow(item.id);
                            }
                          }}
                          className={`flex items-center px-3 py-3.5 cursor-pointer transition-colors focus-visible:outline-none focus-visible:bg-indigo-50/50 ${
                            isExpanded ? "bg-indigo-50/30" : "hover:bg-slate-50/80"
                          }`}
                        >
                          {/* Expand/Collapse Toggle Button */}
                          <div className="w-8 flex items-center justify-center flex-shrink-0 text-slate-400 group-hover:text-slate-600">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-indigo-600 transition-transform" />
                            ) : (
                              <ChevronRight className="h-4 w-4 transition-transform" />
                            )}
                          </div>

                          {/* Person Info */}
                          <div className="w-[28%] min-w-[200px] px-2 flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-slate-100 to-indigo-100 border border-slate-200/80 flex items-center justify-center flex-shrink-0 text-indigo-600">
                              <User className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-slate-900 text-xs truncate">{item.personName}</span>
                                {item.portalUserId && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold" title="Linked to Portal User">
                                    Portal User
                                  </Badge>
                                )}
                              </div>
                              {item.email && (
                                <span className="text-[10px] text-slate-400 truncate" title={item.email}>
                                  {item.email}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Accounts (VPN & Horizon) */}
                          <div className="w-[24%] min-w-[170px] px-2 flex items-center gap-1.5 flex-wrap">
                            {item.hasVpn && (
                              <Badge className="bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 font-bold text-[10px] gap-1 px-2 py-0.5" title={item.vpnAccount ? `VPN: ${item.vpnAccount.username} (${item.vpnAccount.vpnIp || 'Auto-IP'})` : "VPN Access Assigned"}>
                                <ShieldCheck className="h-3 w-3 text-purple-600" />
                                {item.vpnAccount ? item.vpnAccount.username : "VPN Access"}
                              </Badge>
                            )}
                            {item.hasHorizon && (
                              <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold text-[10px] gap-1 px-2 py-0.5" title={item.horizonAccount ? `Horizon: ${item.horizonAccount.username}` : "Horizon Client Assigned"}>
                                <Laptop className="h-3 w-3 text-blue-600" />
                                {item.horizonAccount ? item.horizonAccount.username : "Horizon Client"}
                              </Badge>
                            )}
                            {!item.hasVpn && !item.hasHorizon && (
                              <span className="text-[11px] text-slate-400 italic">No Active Credentials</span>
                            )}
                          </div>

                          {/* Resource Counts */}
                          <div className="w-[18%] min-w-[140px] px-2 flex items-center gap-1.5">
                            <Badge variant="outline" className="bg-indigo-50/80 text-indigo-700 border-indigo-200 font-bold text-[10px] gap-1">
                              <Server className="h-3 w-3" />
                              {item.totalVmsCount} {item.totalVmsCount === 1 ? "VM" : "VMs"}
                            </Badge>
                            <Badge variant="outline" className="bg-cyan-50/80 text-cyan-700 border-cyan-200 font-bold text-[10px] gap-1">
                              <Layers className="h-3 w-3" />
                              {item.totalNamespacesCount} {item.totalNamespacesCount === 1 ? "Namespace" : "Namespaces"}
                            </Badge>
                          </div>

                          {/* Status */}
                          <div className="w-[10%] min-w-[80px] px-2">
                            <Badge 
                              variant="outline" 
                              className={
                                isActive 
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold"
                                  : "bg-rose-50 text-rose-700 border-rose-200 text-[10px] font-bold"
                              }
                            >
                              {item.status}
                            </Badge>
                          </div>

                          {/* Data Source / Legacy Indicator */}
                          <div className="w-[12%] min-w-[90px] px-2">
                            {item.hasLegacy ? (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-semibold text-[10px] gap-1" title="Contains fallback data from legacy schema fields">
                                <AlertTriangle className="h-3 w-3 text-amber-500" />
                                Legacy
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-[10px] font-medium gap-1">
                                <Check className="h-3 w-3 text-emerald-500" />
                                Authoritative
                              </Badge>
                            )}
                          </div>

                          {/* Last Activity */}
                          <div className="w-[10%] min-w-[90px] px-2 text-right">
                            <span className="text-[11px] text-slate-500">
                              {item.lastAssignedAt ? format(new Date(item.lastAssignedAt), "MMM dd, yyyy") : "N/A"}
                            </span>
                          </div>
                        </div>

                        {/* Expanded Child View */}
                        {isExpanded && (
                          <div className="px-6 py-4 bg-slate-50/70 border-t border-b border-indigo-100/70 space-y-4">
                            {/* Account metadata bar */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {item.vpnAccount ? (
                                <div className="p-3 bg-white rounded-xl border border-purple-100 shadow-xs flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2">
                                    <div className="h-7 w-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                                      <ShieldCheck className="h-4 w-4" />
                                    </div>
                                    <div>
                                      <div className="font-bold text-slate-800">VPN Account: {item.vpnAccount.username}</div>
                                      <div className="text-[10px] text-slate-400">Profile: {item.vpnAccount.vpnProfile} • IP: {item.vpnAccount.vpnIp || "Dynamic"}</div>
                                    </div>
                                  </div>
                                  <Badge className="bg-purple-100 text-purple-700 text-[9px] font-bold border-none">
                                    {item.vpnAccount.status}
                                  </Badge>
                                </div>
                              ) : (
                                <div className="p-3 bg-white/60 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 flex items-center gap-2">
                                  <ShieldCheck className="h-4 w-4 text-slate-300" />
                                  <span>No dedicated VpnUser record (access provisioned via target mapping)</span>
                                </div>
                              )}

                              {item.horizonAccount ? (
                                <div className="p-3 bg-white rounded-xl border border-blue-100 shadow-xs flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2">
                                    <div className="h-7 w-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                                      <Laptop className="h-4 w-4" />
                                    </div>
                                    <div>
                                      <div className="font-bold text-slate-800">Horizon Account: {item.horizonAccount.username}</div>
                                      <div className="text-[10px] text-slate-400">{item.horizonAccount.email || "Active VDI Client"}</div>
                                    </div>
                                  </div>
                                  <Badge className="bg-blue-100 text-blue-700 text-[9px] font-bold border-none">
                                    {item.horizonAccount.status}
                                  </Badge>
                                </div>
                              ) : (
                                <div className="p-3 bg-white/60 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 flex items-center gap-2">
                                  <Laptop className="h-4 w-4 text-slate-300" />
                                  <span>No dedicated HorizonUser record (access provisioned via target mapping)</span>
                                </div>
                              )}
                            </div>

                            {/* Assigned VMs Sub-table */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                                  <Server className="h-3.5 w-3.5 text-indigo-600" />
                                  Assigned Virtual Machines ({item.assignedVms.length})
                                </h4>
                                {item.assignedVms.some(v => v.isLegacy) && (
                                  <span className="text-[10px] text-amber-600 font-semibold flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    Legacy fallbacks indicated below
                                  </span>
                                )}
                              </div>

                              {item.assignedVms.length === 0 ? (
                                <div className="py-3 px-4 bg-white rounded-lg border border-slate-200 text-xs text-slate-400 italic">
                                  No virtual machines assigned to this person.
                                </div>
                              ) : (
                                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                                  <table className="w-full text-left border-collapse text-xs">
                                    <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                      <tr>
                                        <th className="px-4 py-2.5">Hostname</th>
                                        <th className="px-4 py-2.5">IP Address</th>
                                        <th className="px-4 py-2.5">System</th>
                                        <th className="px-4 py-2.5">Environment</th>
                                        <th className="px-4 py-2.5">Access Type</th>
                                        <th className="px-4 py-2.5">Status</th>
                                        <th className="px-4 py-2.5">Data Source</th>
                                        <th className="px-4 py-2.5">Assigned By</th>
                                        <th className="px-4 py-2.5">Assigned Date</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {item.assignedVms.map((vm) => (
                                        <tr key={vm.id} className="hover:bg-slate-50/60">
                                          <td className="px-4 py-2.5 font-semibold text-slate-800">
                                            {vm.hostname}
                                          </td>
                                          <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600">
                                            {vm.ipAddress}
                                          </td>
                                          <td className="px-4 py-2.5 text-slate-600 font-medium">
                                            {vm.systemName}
                                          </td>
                                          <td className="px-4 py-2.5">
                                            <Badge variant="outline" className="text-[9px] bg-slate-50 text-slate-600 border-slate-200">
                                              {vm.environment}
                                            </Badge>
                                          </td>
                                          <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-1">
                                              {vm.accessTypes.map((t) => (
                                                <Badge
                                                  key={t}
                                                  className={
                                                    t === "VPN"
                                                      ? "bg-purple-100 text-purple-700 hover:bg-purple-100 border-none font-bold text-[9px]"
                                                      : "bg-blue-100 text-blue-700 hover:bg-blue-100 border-none font-bold text-[9px]"
                                                  }
                                                >
                                                  {t}
                                                </Badge>
                                              ))}
                                            </div>
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
                                          <td className="px-4 py-2.5">
                                            {vm.isLegacy ? (
                                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] font-semibold">
                                                Legacy
                                              </Badge>
                                            ) : (
                                              <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-[9px]">
                                                Authoritative
                                              </Badge>
                                            )}
                                          </td>
                                          <td className="px-4 py-2.5 text-slate-600 text-[11px]">
                                            {vm.assignedBy || "Administrator"}
                                          </td>
                                          <td className="px-4 py-2.5 text-slate-500 text-[11px]">
                                            {vm.assignedAt ? format(new Date(vm.assignedAt), "MMM dd, yyyy") : "N/A"}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>

                            {/* Assigned Kubernetes Namespaces Sub-table */}
                            <div className="space-y-2">
                              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                                <Layers className="h-3.5 w-3.5 text-cyan-600" />
                                Assigned Kubernetes Namespaces ({item.assignedNamespaces.length})
                              </h4>

                              {item.assignedNamespaces.length === 0 ? (
                                <div className="py-3 px-4 bg-white rounded-lg border border-slate-200 text-xs text-slate-400 italic">
                                  No Kubernetes namespaces assigned to this person.
                                </div>
                              ) : (
                                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                                  <table className="w-full text-left border-collapse text-xs">
                                    <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                      <tr>
                                        <th className="px-4 py-2.5">Namespace</th>
                                        <th className="px-4 py-2.5">Supervisor IP</th>
                                        <th className="px-4 py-2.5">System</th>
                                        <th className="px-4 py-2.5">Cluster</th>
                                        <th className="px-4 py-2.5">Access Type</th>
                                        <th className="px-4 py-2.5">Assigned By</th>
                                        <th className="px-4 py-2.5">Assigned Date</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {item.assignedNamespaces.map((ns) => (
                                        <tr key={ns.id} className="hover:bg-slate-50/60">
                                          <td className="px-4 py-2.5 font-semibold text-slate-800">
                                            {ns.name}
                                          </td>
                                          <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600">
                                            {ns.supervisorIp}
                                          </td>
                                          <td className="px-4 py-2.5 text-slate-600 font-medium">
                                            {ns.systemName}
                                          </td>
                                          <td className="px-4 py-2.5 text-slate-600">
                                            <Badge variant="outline" className="text-[9px] bg-cyan-50 text-cyan-700 border-cyan-200">
                                              {ns.clusterName}
                                            </Badge>
                                          </td>
                                          <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-1">
                                              {ns.accessTypes.map((t) => (
                                                <Badge
                                                  key={t}
                                                  className={
                                                    t === "VPN"
                                                      ? "bg-purple-100 text-purple-700 hover:bg-purple-100 border-none font-bold text-[9px]"
                                                      : "bg-blue-100 text-blue-700 hover:bg-blue-100 border-none font-bold text-[9px]"
                                                  }
                                                >
                                                  {t}
                                                </Badge>
                                              ))}
                                            </div>
                                          </td>
                                          <td className="px-4 py-2.5 text-slate-600 text-[11px]">
                                            {ns.assignedBy || "Administrator"}
                                          </td>
                                          <td className="px-4 py-2.5 text-slate-500 text-[11px]">
                                            {ns.assignedAt ? format(new Date(ns.assignedAt), "MMM dd, yyyy") : "N/A"}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
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
        {!loading && filteredData.length > 0 && (
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(filteredData.length / pageSize)}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
}
