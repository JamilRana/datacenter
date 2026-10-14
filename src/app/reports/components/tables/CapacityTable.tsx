// src/app/reports/components/tables/CapacityTable.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  Activity, 
  RefreshCw, 
  AlertTriangle,
  Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getDcCapacityReport } from "@/app/actions/report-tabular-actions";
import { DcCapacityItem } from "@/types/reports";
import { exportToExcel, exportToCSV } from "@/lib/export-utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { 
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

export function CapacityTable({
  dateRange,
  refreshKey,
}: {
  dateRange?: { from: Date; to: Date };
  refreshKey?: number;
}) {
  const [data, setData] = useState<DcCapacityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getDcCapacityReport();
      if (!result.permitted) {
        setError(result.message || "Access denied: Cluster capacity reports require Administrator or DC Operations access.");
        setData([]);
        return;
      }
      setData(result.data);
    } catch (err: unknown) {
      console.error("[REPORT_CAPACITY_ERROR]", err);
      const msg = err instanceof Error ? err.message : "Unable to load cluster capacity data.";
      setError(msg);
      toast.error("Failed to load cluster capacity report");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  const getPercentageColor = (percent: number) => {
    if (percent > 100) return "bg-rose-600";
    if (percent >= 90) return "bg-rose-500";
    if (percent >= 70) return "bg-amber-500";
    return "bg-emerald-500";
  };

  const getPercentageText = (percent: number) => {
    if (percent > 100) return "text-rose-700 font-extrabold";
    if (percent >= 90) return "text-rose-600 font-bold";
    if (percent >= 70) return "text-amber-600 font-bold";
    return "text-emerald-700 font-semibold";
  };

  const filteredData = useMemo(() => {
    return data.filter(c => 
      c.clusterName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  const handleExport = async (formatType: 'xlsx' | 'csv') => {
    try {
      setIsExporting(true);
      toast.info("Preparing cluster capacity export...");
      const dataToExport = filteredData.map(c => ({
        "Cluster Name": c.clusterName,
        "Cluster Type": c.isUnassignedLine ? "Unassigned VMs" : "Physical Cluster",
        "Hosts Count": c.hostCount,
        "Total vCPU Cores": c.totalVcpu,
        "Allocated vCPU": c.usedVcpu,
        "Free vCPU": c.freeVcpu,
        "vCPU Util %": `${c.cpuUtilPercent}%`,
        "Total RAM (GB)": c.totalRamGb,
        "Allocated RAM (GB)": c.usedRamGb,
        "Free RAM (GB)": c.freeRamGb,
        "RAM Util %": `${c.ramUtilPercent}%`,
        "Total Storage (GB)": c.totalStorageGb,
        "Allocated Storage (GB)": c.usedStorageGb,
        "Free Storage (GB)": c.freeStorageGb,
        "Storage Util %": `${c.storageUtilPercent}%`,
        "Over-allocated": c.isOverAllocated ? "YES" : "NO",
        "Hosted VM Count": c.isUnassignedLine ? (c.unassignedVmCount || 0) : "In Cluster",
      }));

      const filename = getReportFilename("cluster_capacity", dateRange?.from, dateRange?.to, formatType);

      if (formatType === 'xlsx') {
        await exportToExcel(filename, dataToExport, {
          sheetName: "Cluster Capacity",
          metadata: {
            reportTitle: "Physical Cluster Capacity & Resource Footprint",
            dateRange: dateRange ? formatDateRangeUnambiguous(dateRange.from, dateRange.to) : undefined,
            scope: "Infrastructure Administrator & DC Operations",
            generatedAt: formatDateDhaka(new Date()),
            filters: {
              "Search": searchTerm || "None",
            },
            definitions: {
              "Total Capacity": "Aggregate physical capacity from baremetal server host assets in the cluster",
              "Allocated Specs": "Sum of effective compute and memory allocated to active virtual machines",
              "Unassigned VMs": "Virtual machines provisioned without an assigned hypervisor host asset"
            }
          }
        });
      } else {
        exportToCSV(filename, dataToExport);
      }
      toast.success(`Exported ${dataToExport.length} clusters.`);
    } catch (e) {
      console.error(e);
      toast.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <ReportErrorState error={error} onRetry={loadData} />}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <Activity className="text-indigo-600" size={20} />
              <h3 className="font-bold text-slate-800 text-sm">Cluster Capacity Breakdown</h3>
            </div>
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <Input 
                placeholder="Search clusters or host assets..." 
                className="pl-8 h-9 text-xs bg-white border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto justify-end">
            <Button 
              size="sm" 
              variant="outline" 
              className="h-9 gap-1.5 font-medium focus-visible:ring-2 focus-visible:ring-indigo-500" 
              disabled={isExporting}
              onClick={() => handleExport('xlsx')}
            >
              {isExporting ? <Loader2 size={14} className="animate-spin text-indigo-600" /> : <Download size={14} />} 
              XLSX
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="h-9 gap-1.5 font-medium focus-visible:ring-2 focus-visible:ring-indigo-500" 
              disabled={isExporting}
              onClick={() => handleExport('csv')}
            >
              {isExporting ? <Loader2 size={14} className="animate-spin text-slate-600" /> : <Download size={14} />} 
              CSV
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-9 w-9 p-0 focus-visible:ring-2 focus-visible:ring-indigo-500" 
              onClick={loadData}
              title="Refresh cluster metrics"
            >
              <RefreshCw size={15} className={cn(loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        <div className="relative overflow-x-auto min-h-[380px]">
          {loading ? (
            <ReportTableSkeleton rows={4} columns={8} />
          ) : filteredData.length === 0 ? (
            <div className="p-8">
              <ReportEmptyState 
                message="No data for this period and filters" 
                onClearFilters={() => setSearchTerm("")} 
              />
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/80 sticky top-0 z-10 border-b">
                <TableRow>
                  <TableHead className="font-bold border-r text-xs text-slate-700">Cluster Name / Physical Hosts</TableHead>
                  <TableHead className="font-bold text-center border-r text-xs text-slate-700" colSpan={3}>vCPU Optimization</TableHead>
                  <TableHead className="font-bold text-center border-r text-xs text-slate-700" colSpan={3}>RAM Usage</TableHead>
                  <TableHead className="font-bold text-center border-r text-xs text-slate-700" colSpan={3}>Storage Usage</TableHead>
                  <TableHead className="font-bold text-center text-xs text-slate-700">Status / Warning</TableHead>
                </TableRow>
                <TableRow className="bg-slate-50/30">
                  <TableHead></TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-slate-500 text-center">Allocated</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-slate-500 text-center">Total</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-slate-500 border-r text-center">Util % / Free</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-slate-500 text-center">Allocated</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-slate-500 text-center">Total</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-slate-500 border-r text-center">Util % / Free</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-slate-500 text-center">Allocated</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-slate-500 text-center">Total</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-slate-500 border-r text-center">Util % / Free</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((cluster) => {
                  const isUnassigned = cluster.isUnassignedLine;
                  return (
                    <TableRow 
                      key={cluster.clusterId} 
                      className={cn(
                        "hover:bg-slate-50 border-slate-100 transition-colors",
                        isUnassigned && "bg-amber-50/40 border-amber-200 hover:bg-amber-50/70"
                      )}
                    >
                      <TableCell className="font-bold text-slate-900 border-r py-4">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className={cn("text-sm", isUnassigned && "text-amber-900 font-extrabold")}>
                              {cluster.clusterName}
                            </span>
                            {isUnassigned ? (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">
                                {cluster.unassignedVmCount} VMs Unplaced
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] bg-slate-50 border-slate-200 text-slate-600 font-semibold">
                                {cluster.hostCount} {cluster.hostCount === 1 ? 'Host' : 'Hosts'}
                              </Badge>
                            )}
                          </div>
                          {!isUnassigned && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              ID: {cluster.clusterId.slice(0, 8)}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* vCPU */}
                      <TableCell className="text-center font-bold text-xs text-indigo-700 bg-indigo-50/20">
                        {cluster.usedVcpu}
                      </TableCell>
                      <TableCell className="text-center font-medium text-xs text-slate-700">
                        {cluster.totalVcpu || "—"}
                      </TableCell>
                      <TableCell className="border-r px-3">
                        {isUnassigned ? (
                          <span className="text-[11px] text-amber-700 italic">No host bound</span>
                        ) : (
                          <div className="flex flex-col gap-1 min-w-[100px]">
                            <div className="flex justify-between text-[10px]">
                              <span className={getPercentageText(cluster.cpuUtilPercent)}>{cluster.cpuUtilPercent}%</span>
                              <span className="text-slate-500 font-medium">{cluster.freeVcpu} free</span>
                            </div>
                            <Progress value={Math.min(cluster.cpuUtilPercent, 100)} className={cn("h-1.5", getPercentageColor(cluster.cpuUtilPercent))} />
                          </div>
                        )}
                      </TableCell>

                      {/* RAM */}
                      <TableCell className="text-center font-bold text-xs text-indigo-700 bg-indigo-50/20">
                        {autoScaleRam(cluster.usedRamGb)}
                      </TableCell>
                      <TableCell className="text-center font-medium text-xs text-slate-700">
                        {cluster.totalRamGb > 0 ? autoScaleRam(cluster.totalRamGb) : "—"}
                      </TableCell>
                      <TableCell className="border-r px-3">
                        {isUnassigned ? (
                          <span className="text-[11px] text-amber-700 italic">No host bound</span>
                        ) : (
                          <div className="flex flex-col gap-1 min-w-[100px]">
                            <div className="flex justify-between text-[10px]">
                              <span className={getPercentageText(cluster.ramUtilPercent)}>{cluster.ramUtilPercent}%</span>
                              <span className="text-slate-500 font-medium">{autoScaleRam(cluster.freeRamGb)} free</span>
                            </div>
                            <Progress value={Math.min(cluster.ramUtilPercent, 100)} className={cn("h-1.5", getPercentageColor(cluster.ramUtilPercent))} />
                          </div>
                        )}
                      </TableCell>

                      {/* Storage */}
                      <TableCell className="text-center font-bold text-xs text-indigo-700 bg-indigo-50/20">
                        {autoScaleStorage(cluster.usedStorageGb)}
                      </TableCell>
                      <TableCell className="text-center font-medium text-xs text-slate-700">
                        {cluster.totalStorageGb > 0 ? autoScaleStorage(cluster.totalStorageGb) : "—"}
                      </TableCell>
                      <TableCell className="border-r px-3">
                        {isUnassigned ? (
                          <span className="text-[11px] text-amber-700 italic">No host bound</span>
                        ) : (
                          <div className="flex flex-col gap-1 min-w-[100px]">
                            <div className="flex justify-between text-[10px]">
                              <span className={getPercentageText(cluster.storageUtilPercent)}>{cluster.storageUtilPercent}%</span>
                              <span className="text-slate-500 font-medium">{autoScaleStorage(cluster.freeStorageGb)} free</span>
                            </div>
                            <Progress value={Math.min(cluster.storageUtilPercent, 100)} className={cn("h-1.5", getPercentageColor(cluster.storageUtilPercent))} />
                          </div>
                        )}
                      </TableCell>

                      {/* Status / Alert */}
                      <TableCell className="text-center py-4">
                        {isUnassigned ? (
                          <Badge variant="outline" className="border-amber-300 text-amber-800 bg-amber-50 text-[10px] font-bold gap-1">
                            <AlertTriangle size={12} className="text-amber-600" /> Action Required
                          </Badge>
                        ) : cluster.isOverAllocated ? (
                          <Badge variant="destructive" className="font-extrabold text-[10px] tracking-wide gap-1 animate-pulse">
                            <AlertTriangle size={12} /> Over-allocated
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50 text-[10px] font-bold">
                            Nominal
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
