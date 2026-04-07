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
  Table as TableIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getUserAllocationReport } from "@/app/actions/report-tabular-actions";
import { UserAllocationSummary } from "@/types/reports";
import { exportToExcel, exportToCSV } from "@/lib/export-utils";
import { format } from "date-fns";
import { Pagination } from "@/components/Pagination";

export function UserAllocationTable({ 
  onUserClick,
  dateRange
}: { 
  onUserClick: (id: string, name: string) => void;
  dateRange?: { from: Date; to: Date };
}) {
  const [data, setData] = useState<UserAllocationSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getUserAllocationReport({
        page,
        pageSize,
        searchTerm,
        from: dateRange?.from,
        to: dateRange?.to
      });
      setData(result.data);
      setTotal(result.total);
    } catch (error) {
      console.error("Failed to load user allocation report", error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchTerm, dateRange]);

  useEffect(() => {
    console.log("UserAllocationTable: dateRange changed", dateRange);
    loadData();
  }, [loadData, sorting]);

  const columns: ColumnDef<UserAllocationSummary>[] = [
    {
      accessorKey: "index",
      header: "#",
      cell: info => (page - 1) * pageSize + info.row.index + 1
    },
    {
      accessorKey: "name",
      header: "User Name",
      cell: info => <div className="font-semibold text-slate-900">{info.getValue() as string}</div>
    },
    {
      accessorKey: "designation",
      header: "Designation",
      cell: info => <div className="text-slate-500">{info.getValue() as string}</div>
    },
    {
      accessorKey: "organization",
      header: "Organization",
      cell: info => <div className="text-indigo-600 font-medium">{info.getValue() as string}</div>
    },
    {
      accessorKey: "totalVms",
      header: "Total VMs",
      cell: info => (
        <Button 
          variant="ghost" 
          onClick={() => onUserClick(info.row.original.userId, info.row.original.name)}
          className="h-8 px-3 gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg border border-indigo-100"
        >
          {info.getValue() as number}
          <ExternalLink size={12} />
        </Button>
      )
    },
    {
      accessorKey: "vcpuAllocated",
      header: "vCPU Allocated",
    },
    {
      accessorKey: "ramAllocatedGb",
      header: "RAM (GB)",
    },
    {
      accessorKey: "storageAllocatedGb",
      header: "Storage (GB)",
    },
    {
      accessorKey: "activeVms",
      header: "Active",
      cell: info => <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">{info.getValue() as number}</Badge>
    },
    {
      accessorKey: "suspendedVms",
      header: "Suspended",
      cell: info => <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">{info.getValue() as number}</Badge>
    },
    {
      accessorKey: "lastActivity",
      header: "Last Activity",
      cell: info => {
        const date = new Date(info.getValue() as string);
        return <div className="text-xs text-slate-400 font-medium">{format(date, "MMM dd, yyyy")}</div>;
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

  const handleExport = (exportFormat: 'xlsx' | 'csv') => {
    const dataToExport = data.map(item => ({
      "User Name": item.name,
      "Designation": item.designation,
      "Organization": item.organization,
      "Total VMs": item.totalVms,
      "vCPU": item.vcpuAllocated,
      "RAM (GB)": item.ramAllocatedGb,
      "Storage (GB)": item.storageAllocatedGb,
      "Active": item.activeVms,
      "Suspended": item.suspendedVms,
      "Last Activity": format(new Date(item.lastActivity), "yyyy-MM-dd")
    }));
    
    if (exportFormat === 'xlsx') {
      exportToExcel('User_Allocation_Report', dataToExport);
    } else {
      exportToCSV('User_Allocation_Report', dataToExport);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard 
          title="Total Users" 
          value={total} 
          icon={<Users className="text-indigo-600" size={18}/>}
          subtitle="Unique assignees"
        />
        <StatCard 
          title="Active VMs" 
          value={data.reduce((sum, item) => sum + item.activeVms, 0)} 
          icon={<Activity className="text-emerald-600" size={18}/>}
          subtitle="Currently provisioned"
        />
        <StatCard 
          title="Total vCPU" 
          value={data.reduce((sum, item) => sum + item.vcpuAllocated, 0)} 
          icon={<Cpu className="text-blue-600" size={18}/>}
          subtitle="Across all tenants"
        />
        <StatCard 
          title="RAM Allocated" 
          value={`${(data.reduce((sum, item) => sum + item.ramAllocatedGb, 0) / 1024).toFixed(2)} TB`} 
          icon={<HardDrive className="text-purple-600" size={18}/>}
          subtitle="Total memory usage"
        />
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="relative flex-1 w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <Input 
              placeholder="Search by name, organization..." 
              className="pl-9 h-9 border-slate-200 focus-visible:ring-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadData()}
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto overflow-hidden">
             <Button size="sm" variant="outline" className="h-9 gap-2 whitespace-nowrap" onClick={() => handleExport('xlsx')}>
                <Download size={15} /> Export XLSX
              </Button>
              <Button size="sm" variant="outline" className="h-9 gap-2 whitespace-nowrap" onClick={() => handleExport('csv')}>
                <Download size={15} /> Export CSV
              </Button>
              <Button size="sm" className="h-9 md:px-3 bg-indigo-600 hover:bg-indigo-700" onClick={loadData}>
                Refresh
              </Button>
          </div>
        </div>

        <div className="relative overflow-auto min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              <p className="text-slate-400 font-medium animate-pulse">Loading allocation data...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-20 opacity-40">
              <TableIcon size={40} className="mb-2" />
              <p>No data matches the selected filters.</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50 sticky top-0 z-10 border-b">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="font-bold py-4">
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
                  <TableRow key={row.id} className="hover:bg-indigo-50/10 border-slate-100">
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

function StatCard({ title, value, icon, subtitle }: { title: string, value: string | number, icon: React.ReactNode, subtitle: string }) {
  return (
    <Card className="shadow-none border-slate-200">
      <CardContent className="p-4 flex items-center gap-4">
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex-shrink-0">
          {icon}
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{title}</p>
          <div className="flex items-baseline gap-2">
            <h4 className="text-2xl font-bold tracking-tight text-slate-900">{value}</h4>
          </div>
          <p className="text-[10px] text-slate-400 italic mb-[-2px]">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}
