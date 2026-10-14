// src/app/admin/audit-logs/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getAuditLogs, getAuditActions, getAuditEntities, getAuditStats } from "@/app/actions/admin-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { 
  Loader2, 
  Search, 
  Download, 
  Activity, 
  Shield, 
  Filter, 
  Clock, 
  User, 
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  X
} from "lucide-react";
import { ROLES } from "@/lib/roles";
import { format } from "date-fns";
import { toast } from "sonner";

interface AuditLog {
  id: string;
  actorId: string;
  actorName?: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: Record<string, unknown> | null;
  timestamp: Date;
}

// Function to generate high-contrast, clearly visible action badge styles
function getActionBadgeStyle(action: string) {
  const norm = (action || "").toUpperCase().trim();

  // Create / Provision / Add
  if (norm.includes("CREATE") || norm.includes("PROVISION") || norm.includes("ADD")) {
    return {
      className: "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700",
      dot: "bg-emerald-500",
    };
  }

  // Delete / Remove / Destroy / Retire / Terminate / Failure
  if (norm.includes("DELETE") || norm.includes("REMOVE") || norm.includes("DESTROY") || norm.includes("RETIRE") || norm.includes("FAILURE") || norm.includes("FAIL")) {
    return {
      className: "bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-700",
      dot: "bg-rose-500",
    };
  }

  // Update / Modify / Edit / Change / Toggle
  if (norm.includes("UPDATE") || norm.includes("MODIFY") || norm.includes("EDIT") || norm.includes("CHANGE") || norm.includes("TOGGLE")) {
    return {
      className: "bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-700",
      dot: "bg-blue-500",
    };
  }

  // Approve / Grant / Complete / Completed
  if (norm.includes("APPROVE") || norm.includes("GRANT") || norm.includes("COMPLETE")) {
    return {
      className: "bg-teal-50 text-teal-800 border-teal-300 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-700",
      dot: "bg-teal-500",
    };
  }

  // Reject / Deny / Cancel
  if (norm.includes("REJECT") || norm.includes("DENY") || norm.includes("CANCEL")) {
    return {
      className: "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700",
      dot: "bg-amber-500",
    };
  }

  // Auth / Login / Logout / Password
  if (norm.includes("LOGIN") || norm.includes("LOGOUT") || norm.includes("AUTH") || norm.includes("PASSWORD")) {
    return {
      className: "bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-700",
      dot: "bg-purple-500",
    };
  }

  // Default fallback: high contrast dark slate on light slate with prominent border
  return {
    className: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600",
    dot: "bg-slate-500",
  };
}

export default function AuditLogsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actions, setActions] = useState<string[]>([]);
  const [entities, setEntities] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    search: "",
    action: "all",
    entityType: "all",
    dateFrom: "",
    dateTo: "",
  });
  const [stats, setStats] = useState<{ totalLogs: number; byAction: { action: string; count: number }[] } | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || !session.user.roles?.includes(ROLES.ADMIN)) {
      router.push("/");
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const [logsData, actionsData, entitiesData, statsData] = await Promise.all([
          getAuditLogs({
            page,
            pageSize: 20,
            search: filters.search || undefined,
            action: filters.action !== "all" ? filters.action : undefined,
            entityType: filters.entityType !== "all" ? filters.entityType : undefined,
            dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
            dateTo: filters.dateTo ? new Date(filters.dateTo) : undefined,
          }),
          getAuditActions(),
          getAuditEntities(),
          getAuditStats(30),
        ]);
        setLogs(logsData.logs);
        setTotal(logsData.total);
        setActions(actionsData);
        setEntities(entitiesData);
        setStats(statsData);
      } catch (error) {
        console.error("Failed to fetch audit logs:", error);
        toast.error("Failed to load audit logs");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session, status, router, page, filters]);

  const handleExport = () => {
    try {
      const csv = [
        "Timestamp,Actor,Action,Entity Type,Entity ID,Details",
        ...logs.map(log => 
          `${new Date(log.timestamp).toISOString()},${log.actorName || log.actorId},${log.action},${log.entityType || ""},${log.entityId || ""},"${JSON.stringify(log.details || {}).replace(/"/g, '""')}"`
        )
      ].join("\n");
      
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      toast.success(`Exported ${logs.length} audit logs`);
    } catch {
      toast.error("Export failed");
    }
  };

  const handleCopyJson = (details: Record<string, unknown> | null) => {
    if (!details) return;
    navigator.clipboard.writeText(JSON.stringify(details, null, 2));
    setCopied(true);
    toast.success("Payload copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClearFilters = () => {
    setFilters({
      search: "",
      action: "all",
      entityType: "all",
      dateFrom: "",
      dateTo: "",
    });
    setPage(1);
  };

  const hasActiveFilters = filters.search || filters.action !== "all" || filters.entityType !== "all" || filters.dateFrom || filters.dateTo;

  if (status === "loading" || loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="text-xs font-semibold text-slate-500">Loading authoritative audit vault...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Audit Log Vault</h1>
              <p className="text-xs text-slate-500 font-medium">
                Authoritative compliance stream and immutable record of datacenter administrative operations
              </p>
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={handleExport} className="gap-2 text-xs font-bold shadow-xs">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* KPI Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-slate-200/80 shadow-xs bg-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Recorded Events</p>
                <p className="text-2xl font-black text-slate-900 mt-1">{stats.totalLogs}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">30-Day Window</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                <Activity className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
          {stats.byAction.slice(0, 3).map((stat) => {
            const badgeMeta = getActionBadgeStyle(stat.action);
            return (
              <Card key={stat.action} className="border-slate-200/80 shadow-xs bg-white">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${badgeMeta.dot}`} />
                      <p className="text-xs font-bold text-slate-700 uppercase tracking-wider truncate max-w-[150px]" title={stat.action}>
                        {stat.action.replace(/_/g, " ")}
                      </p>
                    </div>
                    <p className="text-2xl font-black text-slate-900 mt-1">{stat.count}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Frequency Count</p>
                  </div>
                  <Badge variant="outline" className={`text-xs font-mono font-bold ${badgeMeta.className}`}>
                    {stat.action.slice(0, 4)}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Filter Toolbar */}
      <Card className="border-slate-200/80 shadow-xs bg-white">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by actor, action, entity ID or details..."
                value={filters.search}
                onChange={(e) => {
                  setFilters({ ...filters, search: e.target.value });
                  setPage(1);
                }}
                className="pl-9 text-xs h-9 bg-slate-50 border-slate-200"
              />
            </div>

            {/* Action Select */}
            <Select 
              value={filters.action} 
              onValueChange={(v) => {
                setFilters({ ...filters, action: v });
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full md:w-[170px] text-xs h-9 bg-slate-50 border-slate-200">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {actions.map((act) => (
                  <SelectItem key={act} value={act}>
                    {act.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Entity Select */}
            <Select 
              value={filters.entityType} 
              onValueChange={(v) => {
                setFilters({ ...filters, entityType: v });
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full md:w-[160px] text-xs h-9 bg-slate-50 border-slate-200">
                <SelectValue placeholder="All Entities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                {entities.map((ent) => (
                  <SelectItem key={ent} value={ent}>{ent}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date Range Inputs */}
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => {
                  setFilters({ ...filters, dateFrom: e.target.value });
                  setPage(1);
                }}
                className="w-full md:w-[135px] text-xs h-9 bg-slate-50 border-slate-200"
                title="Filter events from date"
              />
              <span className="text-xs text-slate-400 font-bold">to</span>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => {
                  setFilters({ ...filters, dateTo: e.target.value });
                  setPage(1);
                }}
                className="w-full md:w-[135px] text-xs h-9 bg-slate-50 border-slate-200"
                title="Filter events to date"
              />
            </div>

            {hasActiveFilters && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleClearFilters}
                className="h-9 text-xs text-slate-500 hover:text-slate-900 gap-1"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card className="border-slate-200/80 shadow-xs rounded-xl overflow-hidden bg-white">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/90 border-b border-slate-200">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-44 text-xs font-bold uppercase tracking-wider text-slate-600">Timestamp</TableHead>
                <TableHead className="w-48 text-xs font-bold uppercase tracking-wider text-slate-600">Actor</TableHead>
                <TableHead className="w-48 text-xs font-bold uppercase tracking-wider text-slate-900">
                  Action
                </TableHead>
                <TableHead className="w-36 text-xs font-bold uppercase tracking-wider text-slate-600">Entity</TableHead>
                <TableHead className="w-32 text-xs font-bold uppercase tracking-wider text-slate-600">Entity ID</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-600">Context Payload</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-14 text-slate-400 italic">
                    No historical audit logs found matching your filters.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => {
                  const actionStyle = getActionBadgeStyle(log.action);
                  return (
                    <TableRow key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Timestamp */}
                      <TableCell className="whitespace-nowrap font-medium text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                          <span>{format(new Date(log.timestamp), "yyyy-MM-dd HH:mm:ss")}</span>
                        </div>
                      </TableCell>

                      {/* Actor */}
                      <TableCell className="text-xs font-semibold text-slate-800">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700 flex-shrink-0">
                            {log.actorName ? log.actorName.charAt(0).toUpperCase() : "U"}
                          </div>
                          <span className="truncate max-w-[140px]" title={log.actorName || log.actorId}>
                            {log.actorName || log.actorId}
                          </span>
                        </div>
                      </TableCell>

                      {/* ACTION COLUMN - High Visibility Styled Badge */}
                      <TableCell className="whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold tracking-tight rounded-md border shadow-2xs ${actionStyle.className}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${actionStyle.dot} flex-shrink-0`} />
                          <span className="uppercase">{log.action.replace(/_/g, " ")}</span>
                        </Badge>
                      </TableCell>

                      {/* Entity */}
                      <TableCell>
                        {log.entityType ? (
                          <Badge variant="outline" className="text-[11px] font-semibold bg-slate-50 text-slate-700 border-slate-200">
                            {log.entityType}
                          </Badge>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </TableCell>

                      {/* Entity ID */}
                      <TableCell className="font-mono text-xs text-slate-500">
                        {log.entityId ? (
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-medium" title={log.entityId}>
                            {log.entityId.slice(0, 8)}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>

                      {/* Details Payload Preview & Modal Trigger */}
                      <TableCell>
                        {log.details && Object.keys(log.details).length > 0 ? (
                          <div className="flex items-center gap-2 max-w-sm">
                            <span className="text-[11px] font-mono text-slate-500 truncate max-w-[200px]" title={JSON.stringify(log.details)}>
                              {JSON.stringify(log.details)}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedLog(log)}
                              className="h-6 px-2 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 flex-shrink-0"
                            >
                              Inspect
                            </Button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">No payload</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      {total > 20 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-700">{logs.length}</strong> of <strong className="text-slate-700">{total}</strong> events
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
              className="text-xs font-bold"
            >
              Previous
            </Button>
            <span className="text-xs font-bold text-slate-700 px-2">
              Page {page} of {Math.ceil(total / 20)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= Math.ceil(total / 20)}
              className="text-xs font-bold"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Inspect JSON Details Modal */}
      {selectedLog && (
        <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-xs font-mono font-bold ${getActionBadgeStyle(selectedLog.action).className}`}
                >
                  {selectedLog.action.replace(/_/g, " ")}
                </Badge>
                <DialogTitle className="text-base font-bold text-slate-900">
                  Event Context Payload
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-slate-500">
                Event ID: <span className="font-mono">{selectedLog.id}</span> • {format(new Date(selectedLog.timestamp), "yyyy-MM-dd HH:mm:ss")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-400 font-medium">Actor:</span>
                  <p className="font-bold text-slate-800 mt-0.5">{selectedLog.actorName || selectedLog.actorId}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Target Entity:</span>
                  <p className="font-bold text-slate-800 mt-0.5">
                    {selectedLog.entityType || "Global"} {selectedLog.entityId ? `(${selectedLog.entityId})` : ""}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>JSON Payload Data:</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyJson(selectedLog.details)}
                    className="h-7 text-[11px] gap-1"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied" : "Copy JSON"}
                  </Button>
                </div>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto max-h-72 leading-relaxed">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
