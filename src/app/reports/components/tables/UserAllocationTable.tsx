// src/app/reports/components/tables/UserAllocationTable.tsx
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
  Users, 
  Cpu, 
  HardDrive, 
  Activity,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getUserAllocationReport } from "@/app/actions/report-tabular-actions";
import { UserAllocationSummary } from "@/types/reports";
import { exportToExcel, exportToCSV } from "@/lib/export-utils";
import { Pagination } from "@/components/Pagination";
import { toast } from "sonner";
import { StatCard } from "@/components/analytics/StatCard";
import { METRIC_DEFINITIONS } from "@/lib/reports/metric-definitions";
import { format } from "date-fns";
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

export function UserAllocationTable({ 
  onUserClick,
  dateRange,
  refreshKey,
  userScope = "Datacenter-wide resources",
}: { 
  onUserClick: (id: string, name: string) => void;
  dateRange?: { from: Date; to: Date };
  refreshKey?: number;
  userScope?: string;
}) {
  const [data, setData] = useState<UserAllocationSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({
    totalUsers: 0,
    totalActiveVms: 0,
    totalVcpu: 0,
    totalRamGb: 0,
    totalStorageGb: 0
  });
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
      const result = await getUserAllocationReport({
        page,
        pageSize,
        searchTerm,
      });
      setData(result.data);
      setTotal(result.total);
      if (result.summary) {
        setSummary(result.summary);
      }
    } catch (err: unknown) {
      console.error("[REPORT_USER_ALLOCATION_ERROR]", err);
      const msg = err instanceof Error ? err.message : "Unable to load user allocations.";
      setError(msg);
      toast.error("Failed to load user allocation report");
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

  const columns: ColumnDef<UserAllocationSummary>[] = [
    {
      accessorKey: "index",
      header: "#",
      cell: (info) => (page - 1) * pageSize + info.row.index + 1,
    },
    {
      accessorKey: "name",
      header: "User",
      cell: (info) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900 text-xs">{info.getValue() as string}</span>
          <span className="text-[10px] text-slate-500 font-normal">{info.row.original.email}</span>
        </div>
      ),
    },
    {
      accessorKey: "organization",
      header: "Organization",
      cell: (info) => (
        <span className="text-slate-700 text-xs font-medium" title={info.getValue() as string}>
          {(info.getValue() as string) || "N/A"}
        </span>
      ),
    },
    {
      accessorKey: "designation",
      header: "Designation",
      cell: (info) => (
        <span className="text-slate-600 text-xs" title={info.getValue() as string}>
          {(info.getValue() as string) || "N/A"}
        </span>
      ),
    },
    {
      accessorKey: "systemsCount",
      header: "Systems",
      cell: (info) => (
        <Badge variant="outline" className="font-bold text-slate-800 bg-slate-50 border-slate-200 text-xs">
          {info.getValue() as number || 0}
        </Badge>
      ),
    },
    {
      accessorKey: "totalVms",
      header: "Total VMs",
      cell: (info) => (
        <Badge variant="secondary" className="font-bold text-indigo-700 bg-indigo-50 border-indigo-100 text-xs">
          {info.getValue() as number}
        </Badge>
      ),
    },
    {
      accessorKey: "namespacesCount",
      header: "Namespaces",
      cell: (info) => (
        <Badge variant="outline" className="font-bold text-cyan-700 bg-cyan-50 border-cyan-200 text-xs">
          {info.getValue() as number || 0}
        </Badge>
      ),
    },
    {
      accessorKey: "vcpuAllocated",
      header: "vCPU",
      cell: (info) => <span className="font-bold text-slate-800 text-xs">{info.getValue() as number} Cores</span>,
    },
    {
      accessorKey: "ramAllocatedGb",
      header: "RAM",
      cell: (info) => (
        <span className="font-bold text-slate-800 text-xs">
          {autoScaleRam(info.getValue() as number)}
        </span>
      ),
    },
    {
      accessorKey: "storageAllocatedGb",
      header: "Storage",
      cell: (info) => (
        <span className="font-bold text-slate-800 text-xs">
          {autoScaleStorage(info.getValue() as number)}
        </span>
      ),
    },
    {
      accessorKey: "actions",
      header: "Drilldown",
      cell: (info) => (
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-indigo-500"
          onClick={() => onUserClick(info.row.original.userId, info.row.original.name)}
        >
          <span>View Resources</span>
          <ExternalLink size={12} />
        </Button>
      ),
    },
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

  const handleExport = async (exportFormat: "xlsx" | "csv") => {
    try {
      setIsExporting(true);
      toast.info("Preparing complete user allocation export...");
      
      const fullExport = await getUserAllocationReport({
        getAll: true,
        searchTerm,
      });

      const dataToExport = fullExport.data.map(item => ({
        "User Name": item.name,
        "Email": item.email || "N/A",
        "Organization": item.organization,
        "Designation": item.designation,
        "Systems": item.systemsCount || 0,
        "Total VMs": item.totalVms,
        "Namespaces": item.namespacesCount || 0,
        "vCPU": item.vcpuAllocated,
        "RAM (GB)": item.ramAllocatedGb,
        "Storage (GB)": item.storageAllocatedGb,
        "Active VMs": item.activeVms,
        "Suspended VMs": item.suspendedVms,
        "Last Activity": item.lastActivity ? format(new Date(item.lastActivity), "yyyy-MM-dd") : "N/A"
      }));

      const filename = getReportFilename("user_allocation", dateRange?.from, dateRange?.to, exportFormat);
      
      if (exportFormat === "xlsx") {
        await exportToExcel(filename, dataToExport, {
          sheetName: "User Allocation",
          metadata: {
            reportTitle: "User Resource & System Allocation Report",
            dateRange: dateRange ? formatDateRangeUnambiguous(dateRange.from, dateRange.to) : undefined,
            scope: userScope,
            generatedAt: formatDateDhaka(new Date()),
            filters: {
              "Search Term": searchTerm || "None",
            },
            definitions: {
              "Systems": "Distinct business applications or services owned by the user",
              "Total VMs": "Total virtual machines provisioned under user tenancy",
              "Namespaces": "Total Kubernetes namespaces granted to user",
              "vCPU / RAM / Storage": "Total effective capacity footprint allocated to user resources",
            }
          }
        });
      } else {
        exportToCSV(filename, dataToExport);
      }
      toast.success(`Exported ${dataToExport.length} user allocations successfully.`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export user allocations");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && <ReportErrorState error={error} onRetry={loadData} />}

      {/* Stat Cards with Metric Definitions and Period Badges */}
      {loading ? (
        <ReportKpiSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard 
            title="Total Users" 
            value={summary.totalUsers || total} 
            icon={<Users className="text-indigo-600" size={18}/>}
            subtitle="Unique resource owners"
            periodType="Current"
            tooltip={METRIC_DEFINITIONS.totalUsers.definition}
          />
          <StatCard 
            title="Active VMs" 
            value={summary.totalActiveVms} 
            icon={<Activity className="text-emerald-600" size={18}/>}
            subtitle="Currently provisioned"
            periodType="Current"
            tooltip={METRIC_DEFINITIONS.activeVms.definition}
          />
          <StatCard 
            title="Total vCPU" 
            value={summary.totalVcpu} 
            icon={<Cpu className="text-blue-600" size={18}/>}
            subtitle={userScope}
            periodType="Current"
            tooltip={METRIC_DEFINITIONS.totalVcpu.definition}
          />
          <StatCard 
            title="RAM Allocated" 
            value={autoScaleRam(summary.totalRamGb)} 
            icon={<HardDrive className="text-purple-600" size={18}/>}
            subtitle="Total memory footprint"
            periodType="Current"
            tooltip={METRIC_DEFINITIONS.totalRam.definition}
          />
        </div>
      )}

      {/* Table Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="relative flex-1 w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <Input 
              placeholder="Search by user name, email, organization, or system..." 
              className="pl-9 h-9 border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadData()}
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto overflow-hidden">
            <Button 
              size="sm" 
              variant="outline" 
              className="h-9 gap-2 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-indigo-500" 
              disabled={isExporting} 
              onClick={() => handleExport('xlsx')}
            >
              {isExporting ? <Loader2 size={15} className="animate-spin text-indigo-600" /> : <Download size={15} />} 
              Export XLSX
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="h-9 gap-2 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-indigo-500" 
              disabled={isExporting} 
              onClick={() => handleExport('csv')}
            >
              {isExporting ? <Loader2 size={15} className="animate-spin text-slate-600" /> : <Download size={15} />} 
              Export CSV
            </Button>
            <Button 
              size="sm" 
              className="h-9 md:px-3 bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 focus-visible:ring-2 focus-visible:ring-indigo-500" 
              onClick={loadData}
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="relative overflow-auto min-h-[380px]">
          {loading ? (
            <ReportTableSkeleton rows={pageSize} columns={7} />
          ) : data.length === 0 ? (
            <div className="p-8">
              <ReportEmptyState 
                message="No data for this period and filters" 
                onClearFilters={handleClearFilters} 
              />
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50 sticky top-0 z-10 border-b">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="font-bold py-3.5 text-xs text-slate-600">
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
                              header.column.getCanSort() ? <div className="w-3 opacity-0 group-hover:opacity-40"><ChevronUp size={12}/></div> : null
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
                  <TableRow key={row.id} className="hover:bg-slate-50/70 border-slate-100">
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
          <div className="p-4 border-t border-slate-100 bg-slate-50/30">
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
