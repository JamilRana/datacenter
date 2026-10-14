// src/app/reports/components/tables/RequestsTable.tsx
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
  Clock, 
  Filter, 
  RefreshCw 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { getRequestsReport } from "@/app/actions/report-tabular-actions";
import { RequestDashboardItem } from "@/types/reports";
import { exportToExcel, exportToCSV } from "@/lib/export-utils";
import { format } from "date-fns";
import { Pagination } from "@/components/Pagination";
import { Environment, RequestStatus, RequestType } from "@prisma/client";
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

export function RequestsTable({ 
  dateRange,
  refreshKey 
}: { 
  dateRange?: { from: Date; to: Date };
  refreshKey?: number;
}) {
  const [data, setData] = useState<RequestDashboardItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  
  // Filters matching specifications: type, status, environment, requester
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [envFilter, setEnvFilter] = useState<string>("ALL");
  const [requesterFilter, setRequesterFilter] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getRequestsReport({
        page,
        pageSize,
        type: typeFilter === "ALL" ? undefined : typeFilter as RequestType,
        status: statusFilter === "ALL" ? undefined : statusFilter as RequestStatus,
        environment: envFilter === "ALL" ? undefined : envFilter as Environment,
        requester: requesterFilter || undefined,
        searchTerm,
        startDate: dateRange?.from?.toISOString(),
        endDate: dateRange?.to?.toISOString(),
      });
      setData(result.data);
      setTotal(result.total);
    } catch (err: unknown) {
      console.error("[REPORT_REQUESTS_ERROR]", err);
      const msg = err instanceof Error ? err.message : "Unable to load requests report.";
      setError(msg);
      toast.error("Failed to load requests report");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, typeFilter, statusFilter, envFilter, requesterFilter, searchTerm, dateRange]);

  useEffect(() => {
    loadData();
  }, [loadData, sorting, refreshKey]);

  const handleClearFilters = () => {
    setSearchTerm("");
    setTypeFilter("ALL");
    setStatusFilter("ALL");
    setEnvFilter("ALL");
    setRequesterFilter("");
    setPage(1);
  };

  const getStatusBadge = (status: RequestStatus) => {
    switch (status) {
      case "PROVISIONED":
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">Provisioned</Badge>;
      case "APPROVED":
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">Approved</Badge>;
      case "REJECTED":
        return <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[10px]">Rejected</Badge>;
      case "PENDING_L1":
      case "PENDING_L2":
      case "PENDING_L3":
      case "PENDING_L4":
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">Pending</Badge>;
      case "DRAFT":
        return <Badge className="bg-slate-50 text-slate-700 border-slate-200 text-[10px]">Draft</Badge>;
      case "PARTIALLY_PROVISIONED":
        return <Badge className="bg-orange-50 text-orange-700 border-orange-200 text-[10px]">Partially Provisioned</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  const columns: ColumnDef<RequestDashboardItem>[] = [
    {
      accessorKey: "requestId",
      header: "Request ID",
      cell: info => <div className="font-mono text-xs font-bold text-slate-900">{info.getValue() as string}</div>
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: info => <Badge variant="secondary" className="font-bold text-[10px]">{info.getValue() as string}</Badge>
    },
    {
      accessorKey: "system",
      header: "System",
      cell: info => <div className="text-xs font-semibold text-slate-800 max-w-[140px] truncate" title={info.getValue() as string}>{info.getValue() as string}</div>
    },
    {
      accessorKey: "requester",
      header: "Requester",
      cell: info => (
        <div>
          <div className="font-medium text-xs text-slate-800">{info.getValue() as string}</div>
          {info.row.original.requesterEmail && (
            <div className="text-[10px] text-slate-400 truncate max-w-[120px]" title={info.row.original.requesterEmail}>
              {info.row.original.requesterEmail}
            </div>
          )}
        </div>
      )
    },
    {
      accessorKey: "currentLevel",
      header: "Current Level",
      cell: info => {
        const lvl = info.getValue() as number;
        return <span className="font-medium text-xs text-slate-700">Level {lvl}</span>;
      }
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: info => getStatusBadge(info.getValue() as RequestStatus)
    },
    {
      accessorKey: "submittedAt",
      header: "Submitted",
      cell: info => <span className="text-xs text-slate-500">{format(new Date(info.getValue() as string), "MMM dd, yyyy")}</span>
    },
    {
      accessorKey: "provisionedAt",
      header: "Provisioned",
      cell: info => {
        const val = info.getValue() as string | null;
        if (!val) return <span className="text-xs text-slate-400">—</span>;
        return <span className="text-xs text-slate-500">{format(new Date(val), "MMM dd, yyyy")}</span>;
      }
    },
    {
      accessorKey: "turnaround",
      header: "Turnaround / Age",
      cell: info => {
        const item = info.row.original;
        const val = item.turnaround;
        const isPending = !item.provisionedAt && item.status.startsWith("PENDING");
        return (
          <div className="flex items-center gap-1.5">
            <Clock className={`h-3 w-3 ${isPending ? "text-amber-500" : "text-slate-400"}`} />
            <span className={`text-xs ${isPending ? "text-amber-700 font-semibold" : "text-slate-600 font-medium"}`}>
              {val}
            </span>
          </div>
        );
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

  const handleExport = async (formatType: 'xlsx' | 'csv') => {
    try {
      setIsExporting(true);
      toast.info("Preparing complete requests export...");
      const result = await getRequestsReport({
        getAll: true,
        type: typeFilter === "ALL" ? undefined : typeFilter as RequestType,
        status: statusFilter === "ALL" ? undefined : statusFilter as RequestStatus,
        environment: envFilter === "ALL" ? undefined : envFilter as Environment,
        requester: requesterFilter || undefined,
        searchTerm,
        startDate: dateRange?.from?.toISOString(),
        endDate: dateRange?.to?.toISOString(),
      });

      const dataToExport = result.data.map(item => ({
        "Request ID": item.requestId,
        "Type": item.type,
        "System": item.system,
        "Requester": item.requester,
        "Requester Email": item.requesterEmail || "N/A",
        "Current Level": `Level ${item.currentLevel}`,
        "Status": item.status,
        "Submitted Date": format(new Date(item.submittedAt), "yyyy-MM-dd HH:mm"),
        "Provisioned Date": item.provisionedAt ? format(new Date(item.provisionedAt), "yyyy-MM-dd HH:mm") : "Pending",
        "Turnaround / Age": item.turnaround
      }));

      const filename = getReportFilename("requests", dateRange?.from, dateRange?.to, formatType);

      if (formatType === 'xlsx') {
        await exportToExcel(filename, dataToExport, {
          sheetName: "Requests",
          metadata: {
            reportTitle: "Workflow Requests Audit & Turnaround Report",
            dateRange: dateRange ? formatDateRangeUnambiguous(dateRange.from, dateRange.to) : undefined,
            scope: "Authorized Tenant Scope",
            generatedAt: formatDateDhaka(new Date()),
            filters: {
              "Search": searchTerm || "None",
              "Request Type": typeFilter,
              "Status": statusFilter,
              "Environment": envFilter,
              "Requester": requesterFilter || "All"
            },
            definitions: {
              "Turnaround / Age": "Resolved execution duration for completed requests, or aging time for active tickets pending review",
              "Current Level": "Current approval hierarchy stage awaiting sign-off"
            }
          }
        });
      } else {
        exportToCSV(filename, dataToExport);
      }
      toast.success(`Exported ${dataToExport.length} requests successfully.`);
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("Failed to export requests");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <ReportErrorState error={error} onRetry={loadData} />}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Controls and Search Bar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-3">
          <div className="flex flex-col md:flex-row justify-between items-center gap-3">
            <div className="relative flex-1 w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <Input
                placeholder="Search by request ID, system name, or requester..."
                className="pl-9 h-9 border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadData()}
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <Select value={typeFilter} onValueChange={(val) => { setTypeFilter(val); setPage(1); }}>
                <SelectTrigger className="h-9 w-32 border-slate-200 bg-white text-xs focus-visible:ring-2 focus-visible:ring-indigo-500">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  {Object.values(RequestType).map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
                <SelectTrigger className="h-9 w-32 border-slate-200 bg-white text-xs focus-visible:ring-2 focus-visible:ring-indigo-500">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  {Object.values(RequestStatus).map(st => (
                    <SelectItem key={st} value={st}>{st}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={envFilter} onValueChange={(val) => { setEnvFilter(val); setPage(1); }}>
                <SelectTrigger className="h-9 w-28 border-slate-200 bg-white text-xs focus-visible:ring-2 focus-visible:ring-indigo-500">
                  <SelectValue placeholder="Env" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Envs</SelectItem>
                  {Object.values(Environment).map(env => (
                    <SelectItem key={env} value={env}>{env}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                className={`h-9 text-xs gap-1.5 focus-visible:ring-2 focus-visible:ring-indigo-500 ${showAdvancedFilters ? "bg-indigo-50 border-indigo-200 text-indigo-700" : ""}`}
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              >
                <Filter size={13} />
                Filters
              </Button>

              <Button 
                size="sm" 
                variant="outline" 
                className="h-9 gap-1.5 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-indigo-500" 
                disabled={isExporting} 
                onClick={() => handleExport('xlsx')}
              >
                {isExporting ? <Loader2 size={14} className="animate-spin text-indigo-600" /> : <Download size={14} />} 
                XLSX
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="h-9 gap-1.5 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-indigo-500" 
                disabled={isExporting} 
                onClick={() => handleExport('csv')}
              >
                {isExporting ? <Loader2 size={14} className="animate-spin text-slate-600" /> : <Download size={14} />} 
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

          {/* Expanded Requester filter */}
          {showAdvancedFilters && (
            <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
              <Input
                placeholder="Filter specifically by Requester Name..."
                value={requesterFilter}
                onChange={(e) => { setRequesterFilter(e.target.value); setPage(1); }}
                className="h-9 bg-white text-xs max-w-sm"
              />
              {requesterFilter && (
                <Button variant="ghost" size="sm" onClick={handleClearFilters} className="text-xs h-9">
                  Clear Filter
                </Button>
              )}
            </div>
          )}
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
              Showing <span className="font-bold text-slate-800">{data.length}</span> of <span className="font-bold text-slate-800">{total}</span> requests
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
