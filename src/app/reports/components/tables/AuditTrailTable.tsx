// src/app/reports/components/tables/AuditTrailTable.tsx
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
  Loader2, 
  Download, 
  ShieldAlert, 
  Eye, 
  User,
  Activity,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAuditTrailReport } from "@/app/actions/report-tabular-actions";
import { AuditTrailItem } from "@/types/reports";
import { exportToExcel, exportToCSV } from "@/lib/export-utils";
import { format } from "date-fns";
import { Pagination } from "@/components/Pagination";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

export function AuditTrailTable({ dateRange }: { dateRange?: { from: Date; to: Date } }) {
  const [data, setData] = useState<AuditTrailItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [selectedLog, setSelectedLog] = useState<AuditTrailItem | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAuditTrailReport({
        page,
        pageSize,
        startDate: dateRange?.from?.toISOString(),
        endDate: dateRange?.to?.toISOString()
      });
      setData(result.data);
      setTotal(result.total);
    } catch (error) {
      console.error("Failed to load audit trail report", error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, dateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExport = (formatType: 'xlsx' | 'csv') => {
    const dataToExport = data.map(item => ({
      "Timestamp": format(new Date(item.timestamp), "yyyy-MM-dd HH:mm:ss"),
      "Actor": item.actor,
      "Roles": Array.isArray(item.role) ? item.role.join(", ") : item.role,
      "Action": item.action,
      "Entity Type": item.entityType,
      "Entity ID": item.entityId
    }));
    
    if (formatType === 'xlsx') {
      exportToExcel('Audit_Trail_Report', dataToExport);
    } else {
      exportToCSV('Audit_Trail_Report', dataToExport);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-row justify-between items-center">
          <div className="flex items-center gap-2">
            <ShieldAlert className="text-indigo-600" size={20} />
            <h3 className="font-bold text-slate-800">Security & Activity Logs</h3>
          </div>
          <div className="flex gap-2">
             <Button size="sm" variant="outline" className="h-9 gap-2 font-medium" onClick={() => handleExport('xlsx')}>
                <Download size={16} /> Excel
              </Button>
              <Button size="sm" variant="outline" className="h-9 gap-2 font-medium" onClick={() => handleExport('csv')}>
                <Download size={16} /> CSV
              </Button>
          </div>
        </div>

        <div className="relative overflow-auto min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-20 gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
              <p className="text-slate-400 font-bold uppercase text-[10px]">Retrieving secure logs...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-20 opacity-40">
              <ShieldAlert size={48} className="mb-4 text-indigo-200" />
              <p className="text-xl font-semibold">No audit logs recorded</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/80 sticky top-0 z-10 border-b">
                <TableRow>
                  <TableHead className="font-bold">Timestamp</TableHead>
                  <TableHead className="font-bold">Actor</TableHead>
                  <TableHead className="font-bold">Action</TableHead>
                  <TableHead className="font-bold">Entity Type</TableHead>
                  <TableHead className="font-bold">Entity ID</TableHead>
                  <TableHead className="font-bold text-center">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((log) => (
                  <TableRow key={log.id} className="hover:bg-indigo-50/10 border-slate-100">
                    <TableCell className="text-[12px] font-medium text-slate-500 font-mono whitespace-nowrap">
                      {format(new Date(log.timestamp), "MMM dd, HH:mm:ss")}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{log.actor}</span>
                        <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-tighter">
                          {Array.isArray(log.role) ? log.role[0] : log.role}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-indigo-50 border-indigo-100 text-indigo-700 font-bold text-[10px] uppercase">
                        {log.action.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-500 font-medium">{log.entityType}</TableCell>
                    <TableCell className="text-slate-400 font-mono text-[11px]">{log.entityId.slice(0, 12)}...</TableCell>
                    <TableCell className="text-center">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-600"
                        onClick={() => setSelectedLog(log)}
                      >
                        <Eye size={16} />
                      </Button>
                    </TableCell>
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

      <Sheet open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <SheetContent className="sm:max-w-xl w-full overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-xl font-bold flex items-center gap-2">
              <Info className="text-indigo-600" /> Log Details
            </SheetTitle>
            <SheetDescription className="font-mono text-xs">
              ID: {selectedLog?.id}
            </SheetDescription>
          </SheetHeader>

          {selectedLog && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Triggered At</p>
                  <p className="text-sm font-medium">{format(new Date(selectedLog.timestamp), "yyyy-MM-dd HH:mm:ss")}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Entity Impacted</p>
                  <p className="text-sm font-medium">{selectedLog.entityType}: {selectedLog.entityId}</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-2 px-1 flex items-center gap-2">
                  <Activity size={16} className="text-indigo-500" /> Payload & Changes
                </h4>
                <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-indigo-300 overflow-x-auto border-4 border-slate-800 shadow-xl">
                  {selectedLog.details ? (
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-slate-500 italic">No detailed breakdown available for this action.</p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 bg-indigo-50/30">
                <div className="flex items-center gap-4">
                   <div className="h-12 w-12 rounded-full bg-white border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                      <User size={24} />
                   </div>
                   <div>
                      <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest line-clamp-1">Accountable Actor</p>
                      <p className="text-lg font-bold text-slate-900 leading-tight">{selectedLog.actor}</p>
                      <p className="text-xs text-slate-500">{Array.isArray(selectedLog.role) ? selectedLog.role.join(", ") : selectedLog.role}</p>
                   </div>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
