// src/app/reports/components/tables/LicenseReportTable.tsx
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
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  RefreshCw,
  Server,
  FileText,
  ShieldAlert,
  Building2,
  Calendar,
  Layers,
  Info
} from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  getLicenseReportAction, 
  type LicenseReportResult 
} from "@/app/actions/report-tabular-actions";
import { SoftwareLicenseReportItem, LicenseReportSummary } from "@/types/reports";
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
  getReportFilename, 
  formatDateRangeUnambiguous, 
  formatDateDhaka 
} from "@/lib/format-utils";

export function LicenseReportTable({ 
  dateRange,
  refreshKey 
}: { 
  dateRange?: { from: Date; to: Date };
  refreshKey?: number;
}) {
  const [data, setData] = useState<SoftwareLicenseReportItem[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<LicenseReportSummary>({
    totalLicenses: 0,
    expiredCount: 0,
    expiringIn30Days: 0,
    expiringIn90Days: 0,
    activeCount: 0,
    perpetualCount: 0,
    totalVendors: 0,
    totalTypes: 0,
  });
  const [availableVendors, setAvailableVendors] = useState<string[]>([]);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [expiryFilter, setExpiryFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [isExporting, setIsExporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getLicenseReportAction({
        page,
        pageSize,
        searchTerm: search,
        vendor: vendorFilter,
        type: typeFilter,
        expiryStatus: expiryFilter,
        from: dateRange?.from,
        to: dateRange?.to,
      });

      setData(res.data);
      setTotal(res.total);
      setSummary(res.summary);
      setAvailableVendors(res.availableVendors);
      setAvailableTypes(res.availableTypes);
    } catch (err: unknown) {
      console.error("[REPORT_LICENSES_ERROR]", err);
      const msg = err instanceof Error ? err.message : "Unable to load software licenses report.";
      setError(msg);
      toast.error("Failed to load licenses report");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, vendorFilter, typeFilter, expiryFilter, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  const handleClearFilters = () => {
    setSearch("");
    setVendorFilter("ALL");
    setTypeFilter("ALL");
    setExpiryFilter("ALL");
    setPage(1);
  };

  const handleExport = async (formatType: "xlsx" | "csv") => {
    try {
      setIsExporting(true);
      toast.info("Preparing complete software licenses export...");

      const fullRes = await getLicenseReportAction({
        getAll: true,
        searchTerm: search,
        vendor: vendorFilter,
        type: typeFilter,
        expiryStatus: expiryFilter,
        from: dateRange?.from,
        to: dateRange?.to,
      });

      const filename = getReportFilename("software_licenses", dateRange?.from, dateRange?.to, formatType);

      if (formatType === "xlsx") {
        const licenseSheet = fullRes.data.map(item => ({
          "License Name": item.name,
          "Vendor": item.vendor,
          "License Type": item.type,
          "Expiry Date": item.expiryDate ? format(new Date(item.expiryDate), "yyyy-MM-dd") : "Perpetual / No Expiry",
          "Days Remaining": item.daysRemaining !== null ? `${item.daysRemaining} days` : "Perpetual",
          "Lifecycle Status": item.expiryStatus,
          "Maintenance Expiry": item.maintenanceExpiry ? format(new Date(item.maintenanceExpiry), "yyyy-MM-dd") : "N/A",
          "Assigned Assets Count": item.assetsCount,
          "Assigned Host Assets": item.assignedAssets.map(a => a.name).join(", ") || "None",
          "Notes": item.notes || "",
          "Created Date": format(new Date(item.createdAt), "yyyy-MM-dd HH:mm")
        }));

        // Compute Vendor Breakdown Sheet
        const vendorMap: Record<string, number> = {};
        for (const item of fullRes.data) {
          vendorMap[item.vendor] = (vendorMap[item.vendor] || 0) + 1;
        }
        const vendorSheet = Object.entries(vendorMap).map(([v, count]) => ({
          "Vendor": v,
          "License Count": count,
          "Percentage": `${((count / (fullRes.data.length || 1)) * 100).toFixed(1)}%`
        }));

        // Compute Type Breakdown Sheet
        const typeMap: Record<string, number> = {};
        for (const item of fullRes.data) {
          typeMap[item.type] = (typeMap[item.type] || 0) + 1;
        }
        const typeSheet = Object.entries(typeMap).map(([t, count]) => ({
          "License Type": t,
          "License Count": count,
          "Percentage": `${((count / (fullRes.data.length || 1)) * 100).toFixed(1)}%`
        }));

        await exportToExcel(filename, licenseSheet, {
          sheetName: "Licenses Directory",
          metadata: {
            reportTitle: "Datacenter Software Licenses Report by Expiry, Vendor & Type",
            dateRange: dateRange ? formatDateRangeUnambiguous(dateRange.from, dateRange.to) : undefined,
            scope: "Datacenter Software & Infrastructure Licenses",
            generatedAt: formatDateDhaka(new Date()),
            filters: {
              "Search": search || "None",
              "Vendor Filter": vendorFilter,
              "Type Filter": typeFilter,
              "Expiry Filter": expiryFilter,
            },
            definitions: {
              "Lifecycle Status": "EXPIRED: passed expiry date; EXPIRING_30D/90D: upcoming renewal window; ACTIVE: valid license; PERPETUAL: no expiration date",
              "Assigned Assets": "Physical host servers and infrastructure hardware mapped to this license"
            }
          }
        });
      } else {
        const csvRows = fullRes.data.map(item => ({
          "License Name": item.name,
          "Vendor": item.vendor,
          "License Type": item.type,
          "Expiry Date": item.expiryDate ? format(new Date(item.expiryDate), "yyyy-MM-dd") : "Perpetual",
          "Days Remaining": item.daysRemaining !== null ? item.daysRemaining : "N/A",
          "Lifecycle Status": item.expiryStatus,
          "Maintenance Expiry": item.maintenanceExpiry ? format(new Date(item.maintenanceExpiry), "yyyy-MM-dd") : "N/A",
          "Assigned Assets Count": item.assetsCount,
          "Notes": item.notes || ""
        }));
        exportToCSV(filename, csvRows);
      }

      toast.success(`Exported ${fullRes.data.length} software licenses successfully.`);
    } catch (e) {
      console.error(e);
      toast.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const renderExpiryBadge = (item: SoftwareLicenseReportItem) => {
    switch (item.expiryStatus) {
      case "EXPIRED":
        return (
          <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 font-bold text-[10px] gap-1 px-2 py-0.5">
            <AlertTriangle className="h-3 w-3 text-rose-600" />
            Expired ({Math.abs(item.daysRemaining || 0)}d ago)
          </Badge>
        );
      case "EXPIRING_30D":
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-bold text-[10px] gap-1 px-2 py-0.5 animate-pulse">
            <Clock className="h-3 w-3 text-amber-600" />
            {item.daysRemaining}d remaining
          </Badge>
        );
      case "EXPIRING_90D":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200 font-semibold text-[10px] gap-1 px-2 py-0.5">
            <Clock className="h-3 w-3 text-yellow-600" />
            {item.daysRemaining}d remaining
          </Badge>
        );
      case "ACTIVE":
        return (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium text-[10px] gap-1 px-2 py-0.5">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            {item.daysRemaining}d remaining
          </Badge>
        );
      case "PERPETUAL":
      default:
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-medium text-[10px] gap-1 px-2 py-0.5">
            <CheckCircle2 className="h-3 w-3 text-blue-600" />
            Perpetual (No Expiry)
          </Badge>
        );
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
            title="Total Licenses" 
            value={summary.totalLicenses} 
            icon={<FileText className="text-indigo-600" size={18}/>}
            subtitle={`${summary.totalVendors} vendors • ${summary.totalTypes} types`}
            periodType="Current"
            tooltip="Total software licenses registered across the datacenter"
          />
          <StatCard 
            title="Expired Licenses" 
            value={summary.expiredCount} 
            icon={<AlertTriangle className="text-rose-600" size={18}/>}
            subtitle={summary.expiredCount > 0 ? "Requires urgent renewal" : "All licenses currently active"}
            periodType="Current"
            tooltip="Licenses whose expiration date has already passed"
          />
          <StatCard 
            title="Expiring Soon (30D)" 
            value={summary.expiringIn30Days} 
            icon={<Clock className="text-amber-600" size={18}/>}
            subtitle={`${summary.expiringIn90Days} expiring within 90 days`}
            periodType="Current"
            tooltip="Licenses expiring within the next 30 days"
          />
          <StatCard 
            title="Active & Perpetual" 
            value={summary.activeCount + summary.perpetualCount} 
            icon={<CheckCircle2 className="text-emerald-600" size={18}/>}
            subtitle={`${summary.perpetualCount} perpetual licenses`}
            periodType="Current"
            tooltip="Licenses currently valid or provisioned with perpetual non-expiring terms"
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
                placeholder="Search by license name, vendor, type, notes, host assets..."
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
                title="Refresh license report"
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

            {/* Expiry Status Filter */}
            <div className="w-48">
              <Select 
                value={expiryFilter} 
                onValueChange={(val) => {
                  setExpiryFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500">
                  <SelectValue placeholder="Expiry Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Expiry Windows</SelectItem>
                  <SelectItem value="EXPIRED">Expired</SelectItem>
                  <SelectItem value="EXPIRING_30D">Expiring in 30 Days</SelectItem>
                  <SelectItem value="EXPIRING_60D">Expiring in 60 Days</SelectItem>
                  <SelectItem value="EXPIRING_90D">Expiring in 90 Days</SelectItem>
                  <SelectItem value="ACTIVE">Active (&gt; 90 Days)</SelectItem>
                  <SelectItem value="PERPETUAL">Perpetual / No Expiry</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Vendor Filter */}
            <div className="w-44">
              <Select 
                value={vendorFilter} 
                onValueChange={(val) => {
                  setVendorFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500">
                  <SelectValue placeholder="Vendor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Vendors</SelectItem>
                  {availableVendors.map(v => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type Filter */}
            <div className="w-44">
              <Select 
                value={typeFilter} 
                onValueChange={(val) => {
                  setTypeFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 text-xs bg-slate-50 border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  {availableTypes.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(expiryFilter !== "ALL" || vendorFilter !== "ALL" || typeFilter !== "ALL" || search) && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-8 text-xs text-slate-500 hover:text-slate-900">
                Clear filters
              </Button>
            )}

            <div className="text-xs text-slate-500 font-medium ml-auto">
              Showing <span className="font-bold text-slate-700">{total}</span> matching licenses
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-slate-100 rounded-xl min-h-[380px]">
          {loading ? (
            <ReportTableSkeleton rows={pageSize} columns={7} />
          ) : data.length === 0 ? (
            <div className="p-8">
              <ReportEmptyState 
                message="No software licenses match the selected criteria and filters" 
                onClearFilters={handleClearFilters} 
              />
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">License Name</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Vendor</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Expiry Date</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Lifecycle Status</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Maintenance</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Assigned Assets</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* License Name */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-600">
                          <FileText className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-slate-900 text-xs truncate max-w-[240px]" title={item.name}>
                            {item.name}
                          </span>
                          {item.notes && (
                            <span className="text-[10px] text-slate-400 truncate max-w-[240px]" title={item.notes}>
                              {item.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Vendor */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 font-semibold text-[10px] gap-1 px-2 py-0.5">
                        <Building2 className="h-3 w-3 text-slate-400" />
                        {item.vendor}
                      </Badge>
                    </td>

                    {/* Type */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 font-semibold text-[10px] px-2 py-0.5">
                        {item.type}
                      </Badge>
                    </td>

                    {/* Expiry Date */}
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-700 font-medium">
                      {item.expiryDate ? (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span>{format(new Date(item.expiryDate), "MMM dd, yyyy")}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Perpetual</span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {renderExpiryBadge(item)}
                    </td>

                    {/* Maintenance Expiry */}
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-600">
                      {item.maintenanceExpiry ? (
                        <span className="text-slate-600">
                          {format(new Date(item.maintenanceExpiry), "MMM dd, yyyy")}
                        </span>
                      ) : (
                        <span className="text-slate-400">N/A</span>
                      )}
                    </td>

                    {/* Assigned Assets */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {item.assetsCount > 0 ? (
                        <div className="flex items-center gap-1.5" title={item.assignedAssets.map(a => a.name).join(", ")}>
                          <Badge variant="outline" className="bg-cyan-50 text-cyan-700 border-cyan-200 text-[10px] font-semibold gap-1">
                            <Server className="h-3 w-3 text-cyan-600" />
                            {item.assetsCount} {item.assetsCount === 1 ? "Host" : "Hosts"}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                  </tr>
                ))}
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
