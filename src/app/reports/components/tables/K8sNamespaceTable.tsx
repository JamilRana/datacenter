// src/app/reports/components/tables/K8sNamespaceTable.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  ColumnDef, 
  flexRender, 
  getCoreRowModel, 
  useReactTable, 
  getSortedRowModel, 
  SortingState 
} from "@tanstack/react-table";
import { 
  Loader2, 
  Download, 
  Search, 
  ChevronUp, 
  ChevronDown, 
  RefreshCw,
  Server
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getK8sNamespaceReport } from "@/app/actions/report-tabular-actions";
import { K8sNamespaceReportItem } from "@/types/reports";
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
  autoScaleRam, 
  autoScaleStorage, 
  getReportFilename, 
  formatDateRangeUnambiguous, 
  formatDateDhaka 
} from "@/lib/format-utils";

export function K8sNamespaceTable({
  dateRange,
  refreshKey,
}: {
  dateRange?: { from: Date; to: Date };
  refreshKey?: number;
}) {
  const [data, setData] = useState<K8sNamespaceReportItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getK8sNamespaceReport({
        page,
        pageSize,
        searchTerm,
      });
      setData(result.data);
      setTotal(result.total);
    } catch (err: unknown) {
      console.error("[REPORT_K8S_NAMESPACES_ERROR]", err);
      const msg = err instanceof Error ? err.message : "Unable to load Kubernetes namespaces.";
      setError(msg);
      toast.error("Failed to load Kubernetes namespaces");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchTerm]);

  useEffect(() => {
    loadData();
  }, [loadData, sorting, refreshKey]);

  const handleClearFilters = () => {
    setSearchTerm("");
    setPage(1);
  };

  const columns: ColumnDef<K8sNamespaceReportItem>[] = [
    {
      accessorKey: "name",
      header: "Namespace",
      cell: info => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-900 text-xs font-mono">{info.getValue() as string}</span>
          <span className="text-[10px] text-slate-500">{info.row.original.project || "Default Project"}</span>
        </div>
      )
    },
    {
      accessorKey: "supervisorIp",
      header: "Supervisor IP",
      cell: info => <span className="font-mono text-xs text-slate-600">{info.getValue() as string}</span>
    },
    {
      accessorKey: "clusters",
      header: "Clusters",
      cell: info => {
        const clusters = info.getValue() as string[];
        return (
          <div className="flex flex-wrap gap-1 max-w-[180px]">
            {clusters && clusters.length > 0 ? (
              clusters.map((c, idx) => (
                <Badge key={idx} variant="outline" className="text-[10px] font-semibold bg-indigo-50/60 text-indigo-700 border-indigo-200">
                  {c}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-slate-400">None</span>
            )}
          </div>
        );
      }
    },
    {
      accessorKey: "nodeGroups",
      header: "Node Groups",
      cell: info => {
        const nodeGroups = info.row.original.nodeGroups || [];
        if (nodeGroups.length === 0) return <span className="text-xs text-slate-400">Default Spec</span>;
        return (
          <div className="flex flex-col gap-1 max-w-[200px]">
            {nodeGroups.map((ng, i) => (
              <div key={i} className="text-[11px] bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5 flex items-center justify-between">
                <span className="font-bold text-slate-700">{ng.role}: {ng.nodeCount} nodes</span>
                <span className="text-slate-500 font-mono text-[10px]">{ng.vcpu}c / {autoScaleRam(ng.ramGb)}</span>
              </div>
            ))}
          </div>
        );
      }
    },
    {
      accessorKey: "subdomainsByStatus",
      header: "Subdomains",
      cell: info => {
        const subdomains = info.row.original.subdomainsByStatus || [];
        if (subdomains.length === 0) return <span className="text-xs text-slate-400">None</span>;
        return (
          <div className="flex flex-wrap gap-1 max-w-[150px]">
            {subdomains.map((s, idx) => (
              <Badge 
                key={idx} 
                variant="outline"
                className={
                  s.status === 'ACTIVE' ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px]" :
                  s.status === 'PENDING' ? "bg-amber-50 text-amber-700 border-amber-200 text-[9px]" :
                  "bg-slate-50 text-slate-600 border-slate-200 text-[9px]"
                }
              >
                {s.status}: {s.count}
              </Badge>
            ))}
          </div>
        );
      }
    },
    {
      accessorKey: "requester",
      header: "Requester",
      cell: info => (
        <div className="flex flex-col">
          <span className="font-medium text-slate-800 text-xs">{info.getValue() as string}</span>
          <span className="text-[10px] text-slate-400">{info.row.original.owner}</span>
        </div>
      )
    },
    {
      accessorKey: "totals",
      header: "Resources",
      cell: info => (
        <div className="space-y-0.5 text-xs">
          <div className="font-semibold text-slate-800">{info.row.original.totalVcpu} vCPU</div>
          <div className="text-[10px] text-slate-500">
            {autoScaleRam(info.row.original.totalRamGb)} / {autoScaleStorage(info.row.original.totalStorageGb)}
          </div>
        </div>
      )
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: info => {
        const val = info.getValue() as string;
        return <span className="text-xs text-slate-500">{val ? format(new Date(val), "MMM dd, yyyy") : "N/A"}</span>;
      }
    }
  ];

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualSorting: true,
  });

  const handleExport = async (formatType: "xlsx" | "csv") => {
    try {
      setIsExporting(true);
      toast.info("Preparing complete Kubernetes namespaces export...");
      const result = await getK8sNamespaceReport({
        getAll: true,
        searchTerm,
      });

      const dataToExport = result.data.map(item => ({
        "Namespace": item.name,
        "Supervisor IP": item.supervisorIp,
        "Clusters": (item.clusters || []).join(", "),
        "Project": item.project,
        "Requester": item.requester,
        "Owner / Tenant": item.owner,
        "Environment": item.environment,
        "Total Nodes": item.totalNodes,
        "Total vCPU": item.totalVcpu,
        "Total RAM (GB)": item.totalRamGb,
        "Total Storage (GB)": item.totalStorageGb,
        "Subdomains Summary": item.subdomainsSummary,
        "Status": item.status,
        "Created Date": item.createdAt ? format(new Date(item.createdAt), "yyyy-MM-dd") : "N/A"
      }));

      const filename = getReportFilename("k8s_namespaces", dateRange?.from, dateRange?.to, formatType);

      if (formatType === "xlsx") {
        await exportToExcel(filename, dataToExport, {
          sheetName: "K8s Namespaces",
          metadata: {
            reportTitle: "Kubernetes Namespaces & Multi-Cluster Report",
            dateRange: dateRange ? formatDateRangeUnambiguous(dateRange.from, dateRange.to) : undefined,
            scope: "Authorized Cluster Scope",
            generatedAt: formatDateDhaka(new Date()),
            filters: {
              "Search Query": searchTerm || "None",
            },
            definitions: {
              "Supervisor IP": "Virtual IP of the Kubernetes management plane supervisor",
              "Node Groups": "Worker and control node distribution with assigned compute specs",
              "Subdomains": "Ingress domains mapped to the namespace grouped by status"
            }
          }
        });
      } else {
        exportToCSV(filename, dataToExport);
      }
      toast.success(`Exported ${dataToExport.length} namespaces successfully.`);
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("Failed to export Kubernetes namespaces");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <ReportErrorState error={error} onRetry={loadData} />}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Search and Export Bar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <Input 
              placeholder="Search by namespace, supervisor IP, cluster, or requester..." 
              className="pl-9 h-9 border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500 shadow-sm bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadData()}
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Button 
              size="sm" 
              variant="outline" 
              className="h-9 gap-2 font-medium focus-visible:ring-2 focus-visible:ring-indigo-500" 
              disabled={isExporting} 
              onClick={() => handleExport("xlsx")}
            >
              {isExporting ? <Loader2 size={15} className="animate-spin text-indigo-600" /> : <Download size={15} />} 
              XLSX
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="h-9 gap-2 font-medium focus-visible:ring-2 focus-visible:ring-indigo-500" 
              disabled={isExporting} 
              onClick={() => handleExport("csv")}
            >
              {isExporting ? <Loader2 size={15} className="animate-spin text-slate-600" /> : <Download size={15} />} 
              CSV
            </Button>
            <Button 
              size="sm" 
              className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 focus-visible:ring-2 focus-visible:ring-indigo-500" 
              onClick={loadData}
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="relative overflow-auto min-h-[380px]">
          {loading ? (
            <ReportTableSkeleton rows={pageSize} columns={8} />
          ) : data.length === 0 ? (
            <div className="p-8">
              <ReportEmptyState 
                message="No data for this period and filters" 
                onClearFilters={handleClearFilters} 
              />
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/80 sticky top-0 z-10 border-b">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="font-bold h-11 text-xs text-slate-600 whitespace-nowrap">
                        {header.isPlaceholder ? null : (
                          <div
                            {...{
                              className: header.column.getCanSort()
                                ? "cursor-pointer select-none flex items-center gap-1 group"
                                : "",
                              onClick: header.column.getToggleSortingHandler(),
                            }}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {{
                              asc: <ChevronUp size={14} className="text-indigo-600"/>,
                              desc: <ChevronDown size={14} className="text-indigo-600"/>,
                            }[header.column.getIsSorted() as string] ?? (
                              header.column.getCanSort() ? <div className="w-3 opacity-0 group-hover:opacity-40 transition-all"><ChevronUp size={12}/></div> : null
                            )}
                          </div>
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className="hover:bg-slate-50/60 transition-colors">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {!loading && data.length > 0 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/30 flex justify-between items-center">
            <p className="text-xs text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-800">{data.length}</span> of <span className="font-bold text-slate-800">{total}</span> namespaces
            </p>
            <Pagination
              currentPage={page}
              totalPages={Math.ceil(total / pageSize)}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
