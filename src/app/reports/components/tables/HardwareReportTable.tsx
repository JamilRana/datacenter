// src/app/reports/components/tables/HardwareReportTable.tsx
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
  Server,
  HardDrive,
  Cpu,
  Database,
  Network,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Key,
  Calendar,
  Layers,
  Activity,
  User,
  Zap
} from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { fetchHardwareReport } from "@/app/actions/report-actions";
import type { 
  HardwareReportResult, 
  HardwareReportRow 
} from "@/lib/reports/hardwareReport";
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

export function HardwareReportTable({ 
  dateRange,
  refreshKey 
}: { 
  dateRange?: { from: Date; to: Date };
  refreshKey?: number;
}) {
  const [reportData, setReportData] = useState<HardwareReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [warrantyFilter, setWarrantyFilter] = useState<string>("ALL");
  const [clusterFilter, setClusterFilter] = useState<string>("ALL");
  const [locationFilter, setLocationFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [isExporting, setIsExporting] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Available clusters for dropdown
  const [clusters, setClusters] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    const loadClusters = async () => {
      try {
        const { fetchClusters } = await import("@/app/actions/cluster-actions");
        const data = await fetchClusters();
        setClusters(data);
      } catch (err) {
        console.error("Failed to fetch clusters:", err);
      }
    };
    loadClusters();
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = {
        page,
        pageSize,
        search: search.trim() || undefined,
        type: typeFilter !== "ALL" ? typeFilter : undefined,
        warrantyStatus: warrantyFilter !== "ALL" ? warrantyFilter : undefined,
        clusterId: clusterFilter !== "ALL" ? clusterFilter : undefined,
        location: locationFilter !== "ALL" ? locationFilter : undefined,
        dateFrom: dateRange?.from,
        dateTo: dateRange?.to,
      };

      const res = await fetchHardwareReport(params);
      if (res.permitted === false) {
        setError(res.message || "Infrastructure reports (Hardware & Hosts) are restricted to Administrator and DC Operations roles.");
        setReportData(null);
      } else {
        setReportData(res);
      }
    } catch (err: unknown) {
      console.error("[REPORT_HARDWARE_ERROR]", err);
      const msg = err instanceof Error ? err.message : "Unable to load hardware assets report.";
      setError(msg);
      toast.error("Failed to load hardware report");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, typeFilter, warrantyFilter, clusterFilter, locationFilter, dateRange]);

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
    setTypeFilter("ALL");
    setWarrantyFilter("ALL");
    setClusterFilter("ALL");
    setLocationFilter("ALL");
    setPage(1);
  };

  const assetsList = reportData?.data || [];
  const totalAssets = reportData?.total || 0;
  const analytics = reportData?.analytics;

  const isAllExpanded = useMemo(() => {
    if (assetsList.length === 0) return false;
    return assetsList.every(a => expandedRows.has(a.id));
  }, [assetsList, expandedRows]);

  const toggleExpandAll = () => {
    if (isAllExpanded) {
      setExpandedRows(new Set());
    } else {
      const allIds = new Set(assetsList.map(a => a.id));
      setExpandedRows(allIds);
    }
  };

  const handleExport = async (formatType: "xlsx" | "csv") => {
    try {
      setIsExporting(true);
      toast.info("Preparing complete hardware assets export...");

      const params: Record<string, unknown> = {
        getAll: true,
        search: search.trim() || undefined,
        type: typeFilter !== "ALL" ? typeFilter : undefined,
        warrantyStatus: warrantyFilter !== "ALL" ? warrantyFilter : undefined,
        clusterId: clusterFilter !== "ALL" ? clusterFilter : undefined,
        location: locationFilter !== "ALL" ? locationFilter : undefined,
        dateFrom: dateRange?.from,
        dateTo: dateRange?.to,
      };

      const fullRes = await fetchHardwareReport(params);
      const fullAssets: HardwareReportRow[] = fullRes?.data || [];
      const filename = getReportFilename("hardware_assets_inventory", dateRange?.from, dateRange?.to, formatType);

      if (formatType === "xlsx") {
        // Sheet 1: Assets Directory
        const assetsSheet = fullAssets.map(a => ({
          "Asset Name": a.assetName,
          "Asset Type": a.type,
          "Vendor": a.vendor,
          "Model": a.model,
          "Serial Number": a.serial,
          "Cluster": a.clusterName || "Standalone",
          "Location": a.location,
          "CPU Cores": a.cpuCores ?? "N/A",
          "RAM (GB)": a.ramGb ?? "N/A",
          "GPU Model": a.graphicsCardModel || "None",
          "Interfaces (Ports)": a.interfaces ?? "N/A",
          "Throughput (Gbps)": a.throughputGbps ?? "N/A",
          "Storage Capacity (TB)": a.capacityTb ?? "N/A",
          "Disks Count": a.noOfDisks ?? "N/A",
          "Allocated vCPU": a.allocatedCpu,
          "Allocated RAM (GB)": a.allocatedRam,
          "Allocated Storage (GB)": a.allocatedStorage,
          "Host Utilization %": `${a.utilizationPercent}%`,
          "Host Status": a.utilizationStatus,
          "Hosted VMs Count": a.vmCount,
          "Mapped Licenses Count": a.licenseCount,
          "Warranty Expiry": a.warrantyExpiry ? format(new Date(a.warrantyExpiry), "yyyy-MM-dd") : "Unknown",
          "Warranty Status": a.warrantyStatus,
        }));

        // Sheet 2: Hosted VMs
        const hostedVmsSheet: Array<Record<string, unknown>> = [];
        for (const asset of fullAssets) {
          for (const vm of asset.hostedVms) {
            hostedVmsSheet.push({
              "Host Asset": asset.assetName,
              "Host Serial": asset.serial,
              "VM Hostname": vm.hostname,
              "IP Address": vm.ipAddress,
              "System": vm.systemName,
              "Environment": vm.environment,
              "Status": vm.status,
              "vCPU": vm.vcpu,
              "RAM (GB)": vm.ramGb,
              "Storage (GB)": vm.storageGb,
              "Owner": vm.ownerName,
            });
          }
        }

        // Sheet 3: Attached Licenses
        const licensesSheet: Array<Record<string, unknown>> = [];
        for (const asset of fullAssets) {
          for (const lic of asset.licenses) {
            licensesSheet.push({
              "Host Asset": asset.assetName,
              "Host Serial": asset.serial,
              "License Name": lic.name,
              "Vendor": lic.vendor,
              "Type": lic.type,
              "Expiry Date": lic.expiryDate ? format(new Date(lic.expiryDate), "yyyy-MM-dd") : "Perpetual",
              "Maintenance Expiry": lic.maintenanceExpiry ? format(new Date(lic.maintenanceExpiry), "yyyy-MM-dd") : "N/A",
              "Notes": lic.notes || "",
            });
          }
        }

        await exportToExcel(filename, assetsSheet, {
          sheetName: "Hardware Assets",
          sheets: [
            { name: "Hosted VMs", data: hostedVmsSheet },
            { name: "Attached Licenses", data: licensesSheet },
          ],
          metadata: {
            reportTitle: "Hardware & Host Infrastructure Report",
            dateRange: dateRange ? formatDateRangeUnambiguous(dateRange.from, dateRange.to) : undefined,
            scope: "Physical rack inventory, per-host utilisation, hosted VMs, and mapped licenses",
            generatedAt: formatDateDhaka(new Date()),
            filters: {
              "Search": search || "None",
              "Asset Type": typeFilter,
              "Warranty Status": warrantyFilter,
              "Cluster": clusterFilter,
              "Location": locationFilter,
            },
            definitions: {
              "Host Utilization": "Derived from maximum allocated metric percentage against physical capacity",
              "Warranty Status": "EXPIRED: past date; EXPIRING_30D/90D: upcoming warranty end; ACTIVE: under warranty"
            }
          }
        });
      } else {
        // Consolidated CSV
        const csvRows = fullAssets.map(a => ({
          "Asset Name": a.assetName,
          "Asset Type": a.type,
          "Vendor": a.vendor,
          "Model": a.model,
          "Serial Number": a.serial,
          "Cluster": a.clusterName || "Standalone",
          "Location": a.location,
          "Utilization %": `${a.utilizationPercent}%`,
          "Status": a.status,
          "Hosted VMs": a.vmCount,
          "Mapped Licenses": a.licenseCount,
          "Warranty Expiry": a.warrantyExpiry ? format(new Date(a.warrantyExpiry), "yyyy-MM-dd") : "N/A",
          "Warranty Status": a.warrantyStatus,
        }));
        exportToCSV(filename, csvRows);
      }

      toast.success(`Exported ${fullAssets.length} hardware assets successfully.`);
    } catch (e) {
      console.error(e);
      toast.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const renderWarrantyBadge = (asset: HardwareReportRow) => {
    switch (asset.warrantyStatus) {
      case "EXPIRED":
        return (
          <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 font-bold text-[10px] gap-1 px-2 py-0.5">
            <AlertTriangle className="h-3 w-3 text-rose-600" />
            Expired ({Math.abs(asset.daysUntilWarrantyExpiry || 0)}d ago)
          </Badge>
        );
      case "EXPIRING_30D":
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-bold text-[10px] gap-1 px-2 py-0.5 animate-pulse">
            <Clock className="h-3 w-3 text-amber-600" />
            {asset.daysUntilWarrantyExpiry}d left
          </Badge>
        );
      case "EXPIRING_90D":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200 font-semibold text-[10px] gap-1 px-2 py-0.5">
            <Clock className="h-3 w-3 text-yellow-600" />
            {asset.daysUntilWarrantyExpiry}d left
          </Badge>
        );
      case "ACTIVE":
        return (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium text-[10px] gap-1 px-2 py-0.5">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            Active
          </Badge>
        );
      case "UNKNOWN":
      default:
        return (
          <span className="text-[11px] text-slate-400 italic">No warranty date</span>
        );
    }
  };

  const renderTypeSpecificSpecs = (asset: HardwareReportRow) => {
    switch (asset.type) {
      case "SERVER":
        return (
          <div className="flex flex-col text-xs">
            <span className="font-semibold text-slate-800">
              {asset.cpuCores ? `${asset.cpuCores} Cores` : "N/A Cores"} • {asset.ramGb ? autoScaleRam(asset.ramGb) : "N/A RAM"}
            </span>
            <span className="text-[10px] text-slate-400 truncate max-w-[180px]" title={asset.graphicsCardModel || "No GPU"}>
              GPU: {asset.graphicsCardModel || "None"}
            </span>
          </div>
        );
      case "ROUTER":
      case "SWITCH":
      case "FIREWALL":
      case "CONSOLE_SERVER":
        return (
          <div className="flex flex-col text-xs">
            <span className="font-semibold text-slate-800">
              {asset.interfaces ? `${asset.interfaces} Ports` : "N/A Ports"}
            </span>
            <span className="text-[10px] text-slate-400">
              {asset.throughputGbps ? `${asset.throughputGbps} Gbps throughput` : "Standard throughput"}
            </span>
          </div>
        );
      case "STORAGE":
        return (
          <div className="flex flex-col text-xs">
            <span className="font-semibold text-slate-800">
              {asset.capacityTb ? `${asset.capacityTb} TB Capacity` : "N/A TB"}
            </span>
            <span className="text-[10px] text-slate-400">
              {asset.noOfDisks ? `${asset.noOfDisks} Disks` : "Disk array"}
            </span>
          </div>
        );
      default:
        return (
          <span className="text-xs text-slate-500">
            {asset.location ? `Loc: ${asset.location}` : "Standard Equipment"}
          </span>
        );
    }
  };

  const renderUtilisationMetric = (asset: HardwareReportRow) => {
    if (asset.utilizationStatus === "N/A") {
      return <span className="text-[11px] text-slate-400 italic">N/A</span>;
    }

    const util = asset.utilizationPercent;
    let barColor = "bg-emerald-500";
    let badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";

    if (util > 90) {
      barColor = "bg-rose-500";
      badgeClass = "bg-rose-50 text-rose-700 border-rose-200";
    } else if (util >= 75) {
      barColor = "bg-amber-500";
      badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
    } else if (util >= 40) {
      barColor = "bg-blue-500";
      badgeClass = "bg-blue-50 text-blue-700 border-blue-200";
    } else if (asset.vmCount > 0) {
      barColor = "bg-slate-400";
      badgeClass = "bg-slate-50 text-slate-600 border-slate-200";
    }

    return (
      <div className="flex flex-col gap-1 min-w-[120px]">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-bold text-slate-700">{util}%</span>
          <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 font-semibold ${badgeClass}`}>
            {asset.utilizationStatus}
          </Badge>
        </div>
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div 
            className={`h-full ${barColor} rounded-full transition-all duration-300`} 
            style={{ width: `${Math.min(util, 100)}%` }} 
          />
        </div>
        <div className="text-[9px] text-slate-400 truncate">
          {asset.allocatedCpu}c / {autoScaleRam(asset.allocatedRam)} used
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {error && <ReportErrorState error={error} onRetry={fetchData} />}

      {/* KPI Stat Cards */}
      {loading ? (
        <ReportKpiSkeleton count={4} />
      ) : analytics ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard 
            title="Total Physical Assets" 
            value={analytics.totalCount} 
            icon={<Server className="text-indigo-600" size={18}/>}
            subtitle={`${analytics.byType.find(t => t.type === 'SERVER')?.count || 0} compute servers`}
            periodType="Current"
            tooltip="Total physical infrastructure assets registered in the datacenter"
          />
          <StatCard 
            title="Compute Capacity" 
            value={`${analytics.totalCapacity.cpu} Cores`} 
            icon={<Cpu className="text-blue-600" size={18}/>}
            subtitle={`${autoScaleRam(analytics.totalCapacity.ram)} • ${autoScaleStorage(analytics.totalCapacity.storage)}`}
            periodType="Current"
            tooltip="Physical compute and memory capacity across all registered host assets"
          />
          <StatCard 
            title="Capacity In Use" 
            value={`${analytics.usedCapacity.cpu} Cores`} 
            icon={<Activity className="text-emerald-600" size={18}/>}
            subtitle={`${autoScaleRam(analytics.usedCapacity.ram)} allocated to VMs`}
            periodType="Current"
            tooltip="Total effective CPU and RAM allocated to active virtual machines"
          />
          <StatCard 
            title="Warranty Alerts" 
            value={
              (analytics.byWarranty.find(w => w.status === 'EXPIRED')?.count || 0) +
              (analytics.byWarranty.find(w => w.status === 'EXPIRING_30D')?.count || 0)
            } 
            icon={<AlertTriangle className="text-rose-600" size={18}/>}
            subtitle={`${analytics.byWarranty.find(w => w.status === 'EXPIRED')?.count || 0} expired warranties`}
            periodType="Current"
            tooltip="Hardware assets whose manufacturer warranty is either expired or expiring within 30 days"
          />
        </div>
      ) : null}

      {/* Main Table Card */}
      <div className="space-y-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        {/* Search and Action Bar */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by asset name, model, serial, cluster, or hosted VM..."
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
                disabled={assetsList.length === 0}
                className="h-9 gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500"
                title={isAllExpanded ? "Collapse all assets" : "Expand all assets"}
              >
                <ChevronsUpDown className="h-3.5 w-3.5 text-slate-500" />
                {isAllExpanded ? "Collapse All" : "Expand All"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("xlsx")}
                disabled={isExporting || assetsList.length === 0}
                className="h-9 gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200 focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                {isExporting ? <Loader2 size={13} className="animate-spin text-emerald-600" /> : <Download className="h-3.5 w-3.5" />}
                Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("csv")}
                disabled={isExporting || assetsList.length === 0}
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
                title="Refresh hardware report"
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

            {/* Asset Type Filter */}
            <div className="w-44">
              <Select 
                value={typeFilter} 
                onValueChange={(val) => {
                  setTypeFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500">
                  <SelectValue placeholder="Asset Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  <SelectItem value="SERVER">Server</SelectItem>
                  <SelectItem value="ROUTER">Router</SelectItem>
                  <SelectItem value="SWITCH">Switch</SelectItem>
                  <SelectItem value="FIREWALL">Firewall</SelectItem>
                  <SelectItem value="STORAGE">Storage</SelectItem>
                  <SelectItem value="UPS">UPS</SelectItem>
                  <SelectItem value="CONSOLE_SERVER">Console Server</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Warranty Status Filter */}
            <div className="w-44">
              <Select 
                value={warrantyFilter} 
                onValueChange={(val) => {
                  setWarrantyFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500">
                  <SelectValue placeholder="Warranty Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Warranty Windows</SelectItem>
                  <SelectItem value="EXPIRED">Expired</SelectItem>
                  <SelectItem value="EXPIRING_30D">Expiring in 30 Days</SelectItem>
                  <SelectItem value="EXPIRING_90D">Expiring in 90 Days</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="UNKNOWN">No Warranty Date</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Cluster Filter */}
            <div className="w-44">
              <Select 
                value={clusterFilter} 
                onValueChange={(val) => {
                  setClusterFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500">
                  <SelectValue placeholder="Cluster" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Clusters</SelectItem>
                  <SelectItem value="none">Standalone (No Cluster)</SelectItem>
                  {clusters.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(typeFilter !== "ALL" || warrantyFilter !== "ALL" || clusterFilter !== "ALL" || locationFilter !== "ALL" || search) && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-8 text-xs text-slate-500 hover:text-slate-900">
                Clear filters
              </Button>
            )}

            <div className="text-xs text-slate-500 font-medium ml-auto">
              Showing <span className="font-bold text-slate-700">{totalAssets}</span> hardware assets
            </div>
          </div>
        </div>

        {/* Expandable Table */}
        <div className="overflow-x-auto border border-slate-100 rounded-xl min-h-[380px]">
          {loading ? (
            <ReportTableSkeleton rows={pageSize} columns={7} />
          ) : assetsList.length === 0 ? (
            <div className="p-8">
              <ReportEmptyState 
                message="No hardware assets match the selected criteria and filters" 
                onClearFilters={handleClearFilters} 
              />
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="w-10 px-3 py-3.5 text-center text-xs font-bold text-slate-400"></th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Asset / Identification</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Hardware Specifications</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Host Utilisation</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Warranty Status</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Allocated Targets</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assetsList.map((asset) => {
                  const isExpanded = expandedRows.has(asset.id);

                  return (
                    <tr key={asset.id} className="group">
                      <td colSpan={7} className="p-0">
                        {/* Parent Row */}
                        <div 
                          onClick={() => toggleRow(asset.id)}
                          role="button"
                          tabIndex={0}
                          aria-expanded={isExpanded}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleRow(asset.id);
                            }
                          }}
                          className={`flex items-center px-3 py-3.5 cursor-pointer transition-colors focus-visible:outline-none focus-visible:bg-indigo-50/50 ${
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

                          {/* Asset Name & Identification */}
                          <div className="w-[26%] min-w-[200px] px-2 flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-slate-100 to-indigo-50 border border-slate-200/80 flex items-center justify-center flex-shrink-0 text-indigo-600">
                              {asset.type === "SERVER" ? (
                                <Server className="h-4 w-4" />
                              ) : asset.type === "STORAGE" ? (
                                <Database className="h-4 w-4" />
                              ) : (
                                <Network className="h-4 w-4" />
                              )}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-slate-900 text-xs truncate" title={asset.assetName}>
                                {asset.assetName}
                              </span>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                <span className="font-mono">{asset.serial}</span>
                                {asset.clusterName && asset.clusterName !== "-" && (
                                  <>
                                    <span>•</span>
                                    <span className="text-amber-700 font-medium truncate max-w-[90px]">{asset.clusterName}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Asset Type */}
                          <div className="w-[12%] min-w-[90px] px-2">
                            <Badge variant="outline" className="text-[10px] font-semibold bg-slate-50 text-slate-700 border-slate-200">
                              {asset.type}
                            </Badge>
                          </div>

                          {/* Dynamic Hardware Specifications (Depends on Type) */}
                          <div className="w-[22%] min-w-[170px] px-2">
                            {renderTypeSpecificSpecs(asset)}
                          </div>

                          {/* Host Utilisation */}
                          <div className="w-[18%] min-w-[130px] px-2">
                            {renderUtilisationMetric(asset)}
                          </div>

                          {/* Warranty Status */}
                          <div className="w-[14%] min-w-[110px] px-2">
                            {renderWarrantyBadge(asset)}
                          </div>

                          {/* Allocated Targets (VMs and Licenses) */}
                          <div className="w-[8%] min-w-[70px] px-2 flex items-center gap-1.5 justify-end">
                            <Badge variant="outline" className="bg-indigo-50/80 text-indigo-700 border-indigo-200 font-bold text-[9px] gap-1 px-1.5 py-0.5" title="Hosted VMs">
                              <Server className="h-3 w-3" />
                              {asset.vmCount}
                            </Badge>
                            <Badge variant="outline" className="bg-purple-50/80 text-purple-700 border-purple-200 font-bold text-[9px] gap-1 px-1.5 py-0.5" title="Mapped Software Licenses">
                              <Key className="h-3 w-3" />
                              {asset.licenseCount}
                            </Badge>
                          </div>
                        </div>

                        {/* Expanded Child View */}
                        {isExpanded && (
                          <div className="px-6 py-4 bg-slate-50/70 border-t border-b border-indigo-100/70 space-y-4">
                            {/* Sub-table 1: Hosted Virtual Machines */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                                  <Server className="h-3.5 w-3.5 text-indigo-600" />
                                  Hosted Virtual Machines ({asset.hostedVms.length})
                                </h4>
                                {asset.hostedVms.length > 0 && (
                                  <span className="text-[11px] text-slate-500 font-medium">
                                    Total allocated: <strong className="text-slate-700">{asset.allocatedCpu} vCPU</strong> • <strong className="text-slate-700">{autoScaleRam(asset.allocatedRam)}</strong> RAM • <strong className="text-slate-700">{autoScaleStorage(asset.allocatedStorage)}</strong> Disk
                                  </span>
                                )}
                              </div>

                              {asset.hostedVms.length === 0 ? (
                                <div className="py-3 px-4 bg-white rounded-lg border border-slate-200 text-xs text-slate-400 italic">
                                  No virtual machines hosted on this asset.
                                </div>
                              ) : (
                                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-2xs">
                                  <table className="w-full text-left border-collapse text-xs">
                                    <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                      <tr>
                                        <th className="px-4 py-2.5">Hostname</th>
                                        <th className="px-4 py-2.5">IP Address</th>
                                        <th className="px-4 py-2.5">System</th>
                                        <th className="px-4 py-2.5">Environment</th>
                                        <th className="px-4 py-2.5">Status</th>
                                        <th className="px-4 py-2.5">Effective Spec</th>
                                        <th className="px-4 py-2.5">Owner</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {asset.hostedVms.map(vm => (
                                        <tr key={vm.id} className="hover:bg-slate-50/60">
                                          <td className="px-4 py-2.5 font-bold text-slate-800">
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
                                          <td className="px-4 py-2.5 text-slate-700 font-medium">
                                            {vm.vcpu} vCPU • {vm.ramGb} GB • {vm.storageGb} GB
                                          </td>
                                          <td className="px-4 py-2.5 text-slate-700 font-medium">
                                            {vm.ownerName}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>

                            {/* Sub-table 2: Mapped Software Licenses */}
                            <div className="space-y-2">
                              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                                <Key className="h-3.5 w-3.5 text-purple-600" />
                                Mapped Software Licenses ({asset.licenses.length})
                              </h4>

                              {asset.licenses.length === 0 ? (
                                <div className="py-3 px-4 bg-white rounded-lg border border-slate-200 text-xs text-slate-400 italic">
                                  No software licenses mapped to this asset.
                                </div>
                              ) : (
                                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-2xs">
                                  <table className="w-full text-left border-collapse text-xs">
                                    <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                      <tr>
                                        <th className="px-4 py-2.5">License Name</th>
                                        <th className="px-4 py-2.5">Vendor</th>
                                        <th className="px-4 py-2.5">Type</th>
                                        <th className="px-4 py-2.5">Expiry Date</th>
                                        <th className="px-4 py-2.5">Maintenance Expiry</th>
                                        <th className="px-4 py-2.5">Notes</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {asset.licenses.map(lic => (
                                        <tr key={lic.id} className="hover:bg-slate-50/60">
                                          <td className="px-4 py-2.5 font-bold text-slate-800">
                                            {lic.name}
                                          </td>
                                          <td className="px-4 py-2.5">
                                            <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 text-[9px] font-medium">
                                              {lic.vendor}
                                            </Badge>
                                          </td>
                                          <td className="px-4 py-2.5">
                                            <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-none text-[9px] font-bold">
                                              {lic.type}
                                            </Badge>
                                          </td>
                                          <td className="px-4 py-2.5 text-slate-600 font-medium">
                                            {lic.expiryDate ? format(new Date(lic.expiryDate), "MMM dd, yyyy") : "Perpetual"}
                                          </td>
                                          <td className="px-4 py-2.5 text-slate-500 text-[11px]">
                                            {lic.maintenanceExpiry ? format(new Date(lic.maintenanceExpiry), "MMM dd, yyyy") : "N/A"}
                                          </td>
                                          <td className="px-4 py-2.5 text-slate-500 text-[11px]">
                                            {lic.notes || "-"}
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
        {!loading && totalAssets > 0 && (
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(totalAssets / pageSize)}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
}
