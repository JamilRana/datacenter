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
  Box,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getK8sNamespaceReport } from "@/app/actions/report-tabular-actions";
import { K8sNamespaceReportItem } from "@/types/reports";
import { exportToExcel, exportToCSV } from "@/lib/export-utils";
import { format } from "date-fns";
import { Pagination } from "@/components/Pagination";

export function K8sNamespaceTable({ dateRange }: { dateRange?: { from: Date; to: Date } }) {
  const [data, setData] = useState<K8sNamespaceReportItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getK8sNamespaceReport({
        page,
        pageSize,
        searchTerm,
        from: dateRange?.from,
        to: dateRange?.to
      });
      setData(result.data);
      setTotal(result.total);
    } catch (error) {
      console.error("Failed to load K8s Namespace report:", error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchTerm, dateRange]);

  useEffect(() => {
    loadData();
  }, [loadData, sorting, dateRange]);

  const columns: ColumnDef<K8sNamespaceReportItem>[] = [
    {
      accessorKey: "name",
      header: "Namespace Name",
      cell: info => <div className="font-semibold text-indigo-600">{info.getValue() as string}</div>
    },
    {
      accessorKey: "supervisorIp",
      header: "Supervisor IP",
    },
    {
      accessorKey: "clusterName",
      header: "Cluster",
      cell: info => <span className="text-slate-500 font-medium">{info.getValue() as string}</span>
    },
    {
      accessorKey: "project",
      header: "Project/System",
      cell: info => <div className="text-slate-500 max-w-[150px] truncate">{info.getValue() as string}</div>
    },
    {
      accessorKey: "owner",
      header: "Owner",
    },
    {
      accessorKey: "environment",
      header: "Environment",
      cell: info => <Badge variant="outline">{info.getValue() as string}</Badge>
    },
    {
      accessorKey: "totalNodes",
      header: "Nodes Count",
    },
    {
      accessorKey: "totalVcpu",
      header: "vCPU Cores",
    },
    {
      accessorKey: "totalRamGb",
      header: "RAM (GB)",
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
              status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
              status === "SUSPENDED" ? "bg-amber-50 text-amber-700 border-amber-200" :
              "bg-rose-50 text-rose-700 border-rose-200"
            }
          >
            {status}
          </Badge>
        );
      }
    },
    {
      accessorKey: "createdAt",
      header: "Provisioned",
      cell: info => format(new Date(info.getValue() as string), "MMM dd, yyyy")
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

  const handleExport = (formatType: "xlsx" | "csv") => {
    const dataToExport = data.map(item => ({
      "Namespace Name": item.name,
      "Supervisor IP": item.supervisorIp,
      "Cluster Name": item.clusterName,
      "Project": item.project,
      "Owner": item.owner,
      "Environment": item.environment,
      "Nodes Count": item.totalNodes,
      "vCPU Cores": item.totalVcpu,
      "RAM (GB)": item.totalRamGb,
      "Status": item.status,
      "Provisioned Date": format(new Date(item.createdAt), "yyyy-MM-dd")
    }));
    
    if (formatType === "xlsx") {
      exportToExcel("K8s_Namespace_Report", dataToExport);
    } else {
      exportToCSV("K8s_Namespace_Report", dataToExport);
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
                placeholder="Search namespace, owner, project..." 
                className="pl-9 h-10 border-slate-200 focus-visible:ring-indigo-500 shadow-sm bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadData()}
              />
            </div>
            <Button size="sm" variant="outline" className="h-10 font-bold" onClick={loadData}>
              Search
            </Button>
          </div>
          <div className="flex gap-2">
             <Button size="sm" variant="outline" className="h-10 gap-2 font-medium" onClick={() => handleExport("xlsx")}>
                <Download size={16} /> XLSX
              </Button>
              <Button size="sm" variant="outline" className="h-10 gap-2 font-medium" onClick={() => handleExport("csv")}>
                <Download size={16} /> CSV
              </Button>
          </div>
        </div>

        <div className="relative overflow-auto min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-20 gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Processing Report...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-20 opacity-40">
              <Box size={48} className="mb-4 text-indigo-200" />
              <p className="text-xl font-semibold">No namespace records found</p>
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
