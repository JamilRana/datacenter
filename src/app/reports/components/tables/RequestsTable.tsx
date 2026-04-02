// src/app/reports/components/tables/RequestsTable.tsx
"use client";

import { useState, useEffect } from "react";
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
  ListChecks,
  ChevronUp,
  ChevronDown,
  Clock
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
import { getRequestsReport } from "@/app/actions/report-tabular-actions";
import { RequestDashboardItem } from "@/types/reports";
import { exportToExcel, exportToCSV } from "@/lib/export-utils";
import { format } from "date-fns";
import { Pagination } from "@/components/Pagination";
import { RequestStatus } from "@prisma/client";

export function RequestsTable({ dateRange }: { dateRange?: { from: Date; to: Date } }) {
  const [data, setData] = useState<RequestDashboardItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sorting, setSorting] = useState<SortingState>([]);

  useEffect(() => {
    loadData();
  }, [page, pageSize, sorting, statusFilter, dateRange]);

  async function loadData() {
    setLoading(true);
    try {
      const result = await getRequestsReport({
        page,
        pageSize,
        status: statusFilter === "ALL" ? undefined : statusFilter as RequestStatus,
        searchTerm,
        startDate: dateRange?.from?.toISOString(),
        endDate: dateRange?.to?.toISOString()
      });
      setData(result.data);
      setTotal(result.total);
    } catch (error) {
      console.error("Failed to load requests report", error);
    } finally {
      setLoading(false);
    }
  }

  const getStatusBadge = (status: RequestStatus) => {
    switch (status) {
      case "PROVISIONED":
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Provisioned</Badge>;
      case "APPROVED":
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200">Approved</Badge>;
      case "REJECTED":
        return <Badge className="bg-rose-50 text-rose-700 border-rose-200">Rejected</Badge>;
      case "PENDING_L1":
      case "PENDING_L2":
      case "PENDING_L3":
      case "PENDING_L4":
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Pending</Badge>;
      case "DRAFT":
        return <Badge className="bg-slate-50 text-slate-700 border-slate-200">Draft</Badge>;
      case "CLOSED":
        return <Badge className="bg-slate-200 text-slate-700 border-slate-300">Closed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const columns: ColumnDef<RequestDashboardItem>[] = [
    {
      accessorKey: "requestId",
      header: "Request ID / #",
      cell: info => <div className="font-mono text-[13px] font-bold text-slate-900 leading-tight">{info.getValue() as string}</div>
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: info => <Badge variant="secondary" className="font-bold text-[10px]">{info.getValue() as string}</Badge>
    },
    {
      accessorKey: "requester",
      header: "Requester",
      cell: info => <div className="font-medium text-slate-700">{info.getValue() as string}</div>
    },
    {
      accessorKey: "project",
      header: "Project / System",
      cell: info => <div className="text-slate-500 max-w-[150px] truncate">{info.getValue() as string}</div>
    },
    {
      accessorKey: "environment",
      header: "Environment",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: info => getStatusBadge(info.getValue() as RequestStatus)
    },
    {
      accessorKey: "currentApprover",
      header: "Current Approver",
      cell: info => (
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
            <Clock size={12} className="text-slate-500" />
          </div>
          <span className="text-sm text-slate-600 font-medium">{info.getValue() as string}</span>
        </div>
      )
    },
    {
      accessorKey: "submittedAt",
      header: "Submitted",
      cell: info => format(new Date(info.getValue() as string), "MMM dd, yyyy")
    },
    {
      accessorKey: "agingDays",
      header: "Aging",
      cell: info => {
        const days = info.getValue() as number;
        return (
          <div className="flex items-center gap-2">
            <span className={days > 5 ? "font-bold text-rose-600 animate-pulse" : "font-medium text-slate-400"}>
              {days}d
            </span>
            <div className="h-1 w-8 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={days > 5 ? "h-full bg-rose-500" : "h-full bg-slate-300"} 
                style={{ width: `${Math.min(100, (days/10)*100)}%` }}
              />
            </div>
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

  const handleExport = (formatType: 'xlsx' | 'csv') => {
    const dataToExport = data.map(item => ({
      "Request ID": item.requestId,
      "Type": item.type,
      "Requester": item.requester,
      "Project": item.project,
      "Environment": item.environment,
      "Status": item.status,
      "Approver": item.currentApprover,
      "Submitted At": format(new Date(item.submittedAt), "yyyy-MM-dd HH:mm"),
      "Aging (Days)": item.agingDays
    }));
    
    if (formatType === 'xlsx') {
      exportToExcel('Request_Report', dataToExport);
    } else {
      exportToCSV('Request_Report', dataToExport);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-1 w-full gap-2 shrink-0">
            <div className="relative flex-1 w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <Input 
                placeholder="Search requester, Project..." 
                className="pl-9 h-10 border-slate-200 focus-visible:ring-indigo-500 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadData()}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] h-10 bg-white">
                <SelectValue placeholder="Status Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="PENDING_L1">Pending L1</SelectItem>
                <SelectItem value="PENDING_L2">Pending L2</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="PROVISIONED">Provisioned</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
             <Button size="sm" variant="outline" className="h-10 gap-2" onClick={() => handleExport('xlsx')}>
                <Download size={16} /> Export XLSX
              </Button>
              <Button size="sm" variant="outline" className="h-10 gap-2" onClick={() => handleExport('csv')}>
                <Download size={16} /> Export CSV
              </Button>
          </div>
        </div>

        <div className="relative overflow-auto min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-20 gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Filtering request data...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-20 opacity-40">
              <ListChecks size={48} className="mb-4 text-indigo-200" />
              <p className="text-xl font-semibold">No requests found</p>
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
                  <TableRow key={row.id} className="hover:bg-indigo-50/5 border-slate-100 group">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-3.5 group-hover:bg-indigo-50/10">
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
