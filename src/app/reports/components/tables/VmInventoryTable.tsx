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
  Server,
  ChevronUp,
  ChevronDown
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

export function VmInventoryTable({ dateRange }: { dateRange?: { from: Date; to: Date } }) {
  const [data, setData] = useState<VmInventoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [envFilter, setEnvFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sorting, setSorting] = useState<SortingState>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getVmInventoryReport({
        page,
        pageSize,
        environment: envFilter === "ALL" ? undefined : envFilter as Environment,
        status: statusFilter === "ALL" ? undefined : statusFilter as VmStatus,
        searchTerm,
        from: dateRange?.from,
        to: dateRange?.to
      });
      setData(result.data);
      setTotal(result.total);
    } catch (error) {
      console.error("Failed to load VM inventory report", error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, envFilter, statusFilter, searchTerm, dateRange]);

  useEffect(() => {
    console.log("VmInventoryTable: dateRange changed", dateRange);
    loadData();
  }, [loadData, sorting, dateRange]);

  const columns: ColumnDef<VmInventoryItem>[] = [
    {
      accessorKey: "hostname",
      header: "VM Name",
      cell: info => <div className="font-semibold text-indigo-600">{info.getValue() as string}</div>
    },
    {
      accessorKey: "owner",
      header: "Owner",
    },
    {
      accessorKey: "project",
      header: "Project/System",
      cell: info => <div className="text-slate-500 max-w-[150px] truncate">{info.getValue() as string}</div>
    },
    {
      accessorKey: "environment",
      header: "Environment",
      cell: info => <Badge variant="outline">{info.getValue() as string}</Badge>
    },
    {
      accessorKey: "vcpu",
      header: "vCPU",
    },
    {
      accessorKey: "ramGb",
      header: "RAM (GB)",
    },
    {
      accessorKey: "storageGb",
      header: "Storage (GB)",
    },
    {
      accessorKey: "cluster",
      header: "Cluster",
      cell: info => <span className="text-indigo-600/70 font-medium">{info.getValue() as string}</span>
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
      accessorKey: "provisionedDate",
      header: "Provisioned",
      cell: info => format(new Date(info.getValue() as string), "MMM dd, yyyy")
    },
    {
      accessorKey: "renewalDate",
      header: "Renewal Date",
      cell: info => {
        const val = info.getValue() as string;
        if (!val) return "N/A";
        return format(new Date(val), "MMM dd, yyyy");
      }
    },
    {
      accessorKey: "requestId",
      header: "Request ID",
      cell: info => <span className="text-xs font-mono text-slate-400">{info.getValue() as string}</span>
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

  const handleExport = (formatType: 'xlsx' | 'csv') => {
    const dataToExport = data.map(item => ({
      "VM Name": item.hostname,
      "Owner": item.owner,
      "Project": item.project,
      "Environment": item.environment,
      "vCPU": item.vcpu,
      "RAM (GB)": item.ramGb,
      "Storage (GB)": item.storageGb,
      "Cluster": item.cluster,
      "Status": item.status,
      "Provisioned Date": format(new Date(item.provisionedDate), "yyyy-MM-dd"),
      "Renewal Date": item.renewalDate ? format(new Date(item.renewalDate), "yyyy-MM-dd") : "N/A",
      "Request ID": item.requestId
    }));
    
    if (formatType === 'xlsx') {
      exportToExcel('VM_Inventory_Report', dataToExport);
    } else {
      exportToCSV('VM_Inventory_Report', dataToExport);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-1 w-full gap-2">
            <div className="relative flex-1 w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <Input 
                placeholder="Search owner, hostname..." 
                className="pl-9 h-10 border-slate-200 focus-visible:ring-indigo-500 shadow-sm bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadData()}
              />
            </div>
            <Select value={envFilter} onValueChange={setEnvFilter}>
              <SelectTrigger className="w-[140px] h-10 bg-white">
                <SelectValue placeholder="Environment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Environments</SelectItem>
                <SelectItem value="PRODUCTION">Production</SelectItem>
                <SelectItem value="STAGING">Staging</SelectItem>
                <SelectItem value="DEVELOPMENT">Development</SelectItem>
                <SelectItem value="TESTING">Testing</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-10 bg-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
                <SelectItem value="RETIRED">Retired</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
             <Button size="sm" variant="outline" className="h-10 gap-2 font-medium" onClick={() => handleExport('xlsx')}>
                <Download size={16} /> XLSX
              </Button>
              <Button size="sm" variant="outline" className="h-10 gap-2 font-medium" onClick={() => handleExport('csv')}>
                <Download size={16} /> CSV
              </Button>
          </div>
        </div>

        <div className="relative overflow-auto min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-20 gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Processing Inventory...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-20 opacity-40">
              <Server size={48} className="mb-4 text-indigo-200" />
              <p className="text-xl font-semibold">No VM instances found</p>
              <p className="text-sm">Try adjusting your filters</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/80 sticky top-0 z-10 border-b">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="font-bold h-12">
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
                  <TableRow key={row.id} className="hover:bg-indigo-50/5 border-slate-100 group">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-3.5 group-hover:bg-indigo-50/20">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/30">
          <Pagination 
            currentPage={page}
            totalPages={Math.ceil(total / pageSize)}
            onPageChange={setPage}
          />
        </div>
      </div>
    </div>
  );
}
