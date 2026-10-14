// src/app/reports/components/tables/VmInventoryTable.tsx
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
  SelectValue,
} from "@/components/ui/select";
import { getVmInventoryReport } from "@/app/actions/report-tabular-actions";
import { VmInventoryItem } from "@/types/reports";
import { exportToExcel, exportToCSV } from "@/lib/export-utils";
import { format } from "date-fns";
import { Pagination } from "@/components/Pagination";
import { Environment, VmStatus } from "@prisma/client";
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

export function VmInventoryTable({ 
  dateRange,
  refreshKey 
}: { 
  dateRange?: { from: Date; to: Date };
  refreshKey?: number;
}) {
  const [data, setData] = useState<VmInventoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  
  // Filters matching specifications: system, environment, status, owner, host/cluster
  const [searchTerm, setSearchTerm] = useState("");
  const [systemFilter, setSystemFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [clusterFilter, setClusterFilter] = useState("");
  const [envFilter, setEnvFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getVmInventoryReport({
        page,
        pageSize,
        environment: envFilter === "ALL" ? undefined : envFilter as Environment,
        status: statusFilter === "ALL" ? undefined : statusFilter as VmStatus,
        searchTerm,
        system: systemFilter || undefined,
        owner: ownerFilter || undefined,
        cluster: clusterFilter || undefined,
      });
      setData(result.data);
      setTotal(result.total);
    } catch (err: unknown) {
      console.error("[REPORT_VM_INVENTORY_ERROR]", err);
      const msg = err instanceof Error ? err.message : "Unable to load VM inventory.";
      setError(msg);
      toast.error("Failed to load VM inventory");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, envFilter, statusFilter, searchTerm, systemFilter, ownerFilter, clusterFilter]);

  useEffect(() => {
    loadData();
  }, [loadData, sorting, refreshKey]);

  const handleClearFilters = () => {
    setSearchTerm("");
    setSystemFilter("");
    setOwnerFilter("");
    setClusterFilter("");
    setEnvFilter("ALL");
    setStatusFilter("ALL");
    setPage(1);
  };

  const columns: ColumnDef<VmInventoryItem>[] = [
    {
      accessorKey: "hostname",
      header: "Hostname",
      cell: info => <div className="font-semibold text-indigo-600 font-mono text-xs">{info.getValue() as string}</div>
    },
    {
      accessorKey: "ipAddress",
      header: "IP",
      cell: info => <div className="font-mono text-xs text-slate-600">{info.getValue() as string}</div>
    },
    {
      accessorKey: "system",
      header: "System",
      cell: info => {
        const val = info.getValue() as string;
        const isStandalone = val.toLowerCase().includes("standalone") || val.toLowerCase().includes("unassigned");
        return (
          <div className="max-w-[160px] truncate" title={val}>
            {isStandalone ? (
              <span className="text-slate-400 italic text-xs">{val}</span>
            ) : (
              <span className="font-medium text-slate-800 text-xs">{val}</span>
            )}
          </div>
        );
      }
    },
    {
      accessorKey: "environment",
      header: "Environment",
      cell: info => <Badge variant="outline" className="text-[10px] font-semibold">{info.getValue() as string}</Badge>
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: info => {
        const status = info.getValue() as string;
        return (
          <Badge 
            variant="outline" 
            className={
              status === 'ACTIVE' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
              status === 'SUSPENDED' ? "bg-amber-50 text-amber-700 border-amber-200" :
              "bg-rose-50 text-rose-700 border-rose-200"
            }
          >
            {status}
          </Badge>
        );
      }
    },
    {
      accessorKey: "owner",
      header: "Owner",
      cell: info => (
        <div>
          <div className="font-medium text-slate-800 text-xs">{info.getValue() as string}</div>
          {info.row.original.ownerEmail && (
            <div className="text-[10px] text-slate-400 truncate max-w-[130px]" title={info.row.original.ownerEmail}>
              {info.row.original.ownerEmail}
            </div>
          )}
        </div>
      )
    },
    {
      accessorKey: "vcpu",
      header: "vCPU",
      cell: info => {
        const val = info.getValue() as number;
        if (info.row.original.specMissing) {
          return (
            <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 text-[10px] whitespace-nowrap">
              Spec Missing
            </Badge>
          );
        }
        return <span className="font-semibold text-xs text-slate-800">{val}</span>;
      }
    },
    {
      accessorKey: "ramGb",
      header: "RAM",
      cell: info => {
        const val = info.getValue() as number;
        if (info.row.original.specMissing) return <span className="text-slate-400 text-xs">—</span>;
        return <span className="text-xs font-medium text-slate-800">{autoScaleRam(val)}</span>;
      }
    },
    {
      accessorKey: "storageGb",
      header: "Storage",
      cell: info => {
        const val = info.getValue() as number;
        if (info.row.original.specMissing) return <span className="text-slate-400 text-xs">—</span>;
        return <span className="text-xs font-medium text-slate-800">{autoScaleStorage(val)}</span>;
      }
    },
    {
      accessorKey: "hostAsset",
      header: "Host Asset",
      cell: info => (
        <span className="text-indigo-600/90 font-medium text-xs" title={info.getValue() as string}>
          {info.getValue() as string}
        </span>
      )
    },
    {
      accessorKey: "provisionedDate",
      header: "Provisioned Date",
      cell: info => {
        const val = info.getValue() as string;
        return <span className="text-xs text-slate-500">{val ? format(new Date(val), "MMM dd, yyyy") : "N/A"}</span>;
      }
    },
    {
      accessorKey: "renewalDate",
      header: "Renewal Date",
      cell: info => {
        const val = info.getValue() as string;
        if (!val) return <span className="text-xs text-slate-400">N/A</span>;
        return <span className="text-xs text-slate-500">{format(new Date(val), "MMM dd, yyyy")}</span>;
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
      toast.info("Preparing complete VM inventory export...");
      const result = await getVmInventoryReport({
        getAll: true,
        environment: envFilter === "ALL" ? undefined : envFilter as Environment,
        status: statusFilter === "ALL" ? undefined : statusFilter as VmStatus,
        searchTerm,
        system: systemFilter || undefined,
        owner: ownerFilter || undefined,
        cluster: clusterFilter || undefined,
      });

      const dataToExport = result.data.map(item => ({
        "Hostname": item.hostname,
        "IP Address": item.ipAddress,
        "System": item.system,
        "Environment": item.environment,
        "Status": item.status,
        "Owner": item.owner,
        "Owner Email": item.ownerEmail || "N/A",
        "vCPU": item.vcpu,
        "RAM (GB)": item.ramGb,
        "Storage (GB)": item.storageGb,
        "Host Asset": item.hostAsset,
        "Provisioned Date": item.provisionedDate ? format(new Date(item.provisionedDate), "yyyy-MM-dd") : "N/A",
        "Renewal Date": item.renewalDate ? format(new Date(item.renewalDate), "yyyy-MM-dd") : "N/A",
        "Spec Status": item.specMissing ? "SPEC MISSING" : "OK"
      }));

      const filename = getReportFilename("vm_inventory", dateRange?.from, dateRange?.to, formatType);

      if (formatType === 'xlsx') {
        await exportToExcel(filename, dataToExport, {
          sheetName: "VM Inventory",
          metadata: {
            reportTitle: "Virtual Machine Inventory Report",
            dateRange: dateRange ? formatDateRangeUnambiguous(dateRange.from, dateRange.to) : undefined,
            scope: "Authorized Infrastructure Scope",
            generatedAt: formatDateDhaka(new Date()),
            filters: {
              "Search": searchTerm || "None",
              "Environment": envFilter,
              "Status": statusFilter,
              "System": systemFilter || "All",
              "Owner": ownerFilter || "All",
              "Host / Cluster": clusterFilter || "All"
            },
            definitions: {
              "vCPU / RAM / Storage": "Effective instance specification resolved via active spec hierarchy",
              "Host Asset": "Physical hypervisor server hosting the instance",
              "Renewal Date": "Current lease expiry milestone requiring tenancy extension"
            }
          }
        });
      } else {
        exportToCSV(filename, dataToExport);
      }
      toast.success(`Exported ${dataToExport.length} VMs successfully.`);
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("Failed to export VM inventory");
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
                placeholder="Search by hostname, IP, system, or owner..."
                className="pl-9 h-9 border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadData()}
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <Select value={envFilter} onValueChange={(val) => { setEnvFilter(val); setPage(1); }}>
                <SelectTrigger className="h-9 w-32 border-slate-200 bg-white text-xs focus-visible:ring-2 focus-visible:ring-indigo-500">
                  <SelectValue placeholder="Environment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Envs</SelectItem>
                  {Object.values(Environment).map(env => (
                    <SelectItem key={env} value={env}>{env}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
                <SelectTrigger className="h-9 w-32 border-slate-200 bg-white text-xs focus-visible:ring-2 focus-visible:ring-indigo-500">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  {Object.values(VmStatus).map(st => (
                    <SelectItem key={st} value={st}>{st}</SelectItem>
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

          {/* Advanced Multi-field Filters: System, Owner, Cluster */}
          {showAdvancedFilters && (
            <div className="pt-2 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                placeholder="Filter by System name..."
                value={systemFilter}
                onChange={(e) => { setSystemFilter(e.target.value); setPage(1); }}
                className="h-9 bg-white text-xs"
              />
              <Input
                placeholder="Filter by Owner (Name/Email)..."
                value={ownerFilter}
                onChange={(e) => { setOwnerFilter(e.target.value); setPage(1); }}
                className="h-9 bg-white text-xs"
              />
              <div className="flex gap-2">
                <Input
                  placeholder="Filter by Host Asset / Cluster..."
                  value={clusterFilter}
                  onChange={(e) => { setClusterFilter(e.target.value); setPage(1); }}
                  className="h-9 bg-white text-xs flex-1"
                />
                {(systemFilter || ownerFilter || clusterFilter) && (
                  <Button variant="ghost" size="sm" onClick={handleClearFilters} className="text-xs h-9">
                    Clear
                  </Button>
                )}
              </div>
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
              Showing <span className="font-bold text-slate-800">{data.length}</span> of <span className="font-bold text-slate-800">{total}</span> virtual machines
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
