// src/app/reports/components/tables/RenewalsTable.tsx
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
  Mail,
  Calendar,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  Clock,
  RefreshCcw,
  Bell
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getRenewalsReport } from "@/app/actions/report-tabular-actions";
import { RenewalItem } from "@/types/reports";
import { exportToExcel, exportToCSV } from "@/lib/export-utils";
import { format } from "date-fns";
import { Pagination } from "@/components/Pagination";
import { toast } from "sonner";

export function RenewalsTable({ dateRange }: { dateRange?: { from: Date; to: Date } }) {
  const [data, setData] = useState<RenewalItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getRenewalsReport({
        page,
        pageSize,
        searchTerm,
        from: dateRange?.from,
        to: dateRange?.to
      });
      setData(result.data);
      setTotal(result.total);
    } catch (error) {
      console.error("Failed to load renewals report", error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchTerm, dateRange]);

  useEffect(() => {
    loadData();
  }, [loadData, sorting]);

  const handleReminder = (vmName: string, owner: string) => {
    toast.success(`Reminder notification sent to ${owner} regarding ${vmName}`);
  };

  const handleRenewal = (vmName: string) => {
    toast.promise(new Promise(resolve => setTimeout(resolve, 1000)), {
      loading: 'Initiating renewal sequence...',
      success: `Renewal process started for ${vmName}`,
      error: 'Failed to start renewal'
    });
  };

  const columns: ColumnDef<RenewalItem>[] = [
    {
      accessorKey: "vmName",
      header: "VM Name",
      cell: info => <div className="font-bold text-slate-900">{info.getValue() as string}</div>
    },
    {
      accessorKey: "ownerName",
      header: "Owner",
    },
    {
      accessorKey: "project",
      header: "Project",
      cell: info => <div className="text-slate-500 max-w-[150px] truncate">{info.getValue() as string}</div>
    },
    {
      accessorKey: "environment",
      header: "Env",
      cell: info => <Badge variant="outline" className="text-[10px] font-bold">{info.getValue() as string}</Badge>
    },
    {
      accessorKey: "renewalDate",
      header: "Renewal Date",
      cell: info => (
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-slate-400" />
          <span className="font-medium">{format(new Date(info.getValue() as string), "MMM dd, yyyy")}</span>
        </div>
      )
    },
    {
      accessorKey: "daysRemaining",
      header: "Days Remaining",
      cell: info => {
        const days = info.getValue() as number;
        let colorClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
        let Icon = Clock;
        
        if (days <= 30) {
          colorClass = "bg-rose-50 text-rose-700 border-rose-200 animate-pulse";
          Icon = AlertCircle;
        } else if (days <= 90) {
          colorClass = "bg-amber-50 text-amber-700 border-amber-200";
        }

        return (
          <Badge variant="outline" className={`${colorClass} flex items-center gap-1.5 px-2.5 py-1 font-bold`}>
            <Icon size={12} />
            {days}d
          </Badge>
        );
      }
    },
    {
      accessorKey: "status",
      header: "Status",
    },
    {
      accessorKey: "lastRenewed",
      header: "Last Activity",
      cell: info => format(new Date(info.getValue() as string), "MMM dd, yyyy")
    },
    {
      id: "actions",
      header: "Action",
      cell: info => (
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-8 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
            title="Send Email Reminder"
            onClick={() => handleReminder(info.row.original.vmName, info.row.original.ownerName)}
          >
            <Mail size={14} />
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-8 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
            title="Initiate Renewal Request"
            onClick={() => handleRenewal(info.row.original.vmName)}
          >
            <RefreshCcw size={14} />
          </Button>
        </div>
      )
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
      "VM Name": item.vmName,
      "Owner": item.ownerName,
      "Project": item.project,
      "Env": item.environment,
      "Renewal Date": format(new Date(item.renewalDate), "yyyy-MM-dd"),
      "Days Remaining": item.daysRemaining,
      "Status": item.status,
      "Last Activity": format(new Date(item.lastRenewed), "yyyy-MM-dd")
    }));
    
    if (formatType === 'xlsx') {
      exportToExcel('Renewal_Report', dataToExport);
    } else {
      exportToCSV('Renewal_Report', dataToExport);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="relative flex-1 w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <Input 
              placeholder="Search by VM name or owner..." 
              className="pl-9 h-10 border-slate-200 focus-visible:ring-indigo-500 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadData()}
            />
          </div>
          <div className="flex gap-2">
             <Button size="sm" variant="outline" className="h-10 gap-2" onClick={() => handleExport('xlsx')}>
                <Download size={16} /> XLSX Export
              </Button>
              <Button size="sm" variant="outline" className="h-10 gap-2" onClick={() => handleExport('csv')}>
                <Download size={16} /> CSV Export
              </Button>
              <Button size="sm" className="h-10 bg-indigo-600 hover:bg-indigo-700 gap-2" onClick={loadData}>
                <RefreshCcw size={14} /> Refresh
              </Button>
          </div>
        </div>

        <div className="relative overflow-auto min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-20 gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Checking expiration dates...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-20 opacity-40">
              <Bell size={48} className="mb-4 text-indigo-200" />
              <p className="text-xl font-semibold">No upcoming renewals found</p>
              <p>Everything is currently up to date.</p>
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
