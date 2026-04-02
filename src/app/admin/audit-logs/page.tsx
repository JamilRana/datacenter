// src/app/admin/audit-logs/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getAuditLogs, getAuditActions, getAuditEntities, getAuditStats } from "@/app/actions/admin-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Loader2, Search, Download } from "lucide-react";
import { ROLES } from "@/lib/roles";

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

const actionColors: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
  APPROVE: "bg-emerald-100 text-emerald-800",
  REJECT: "bg-orange-100 text-orange-800",
  PROVISION: "bg-purple-100 text-purple-800",
  LOGIN: "bg-cyan-100 text-cyan-800",
  LOGOUT: "bg-slate-100 text-slate-800",
};

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
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session, status, router, page, filters]);

  const handleExport = () => {
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
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Audit Logs</h1>
        <Button variant="outline" onClick={handleExport} className="gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.totalLogs}</div>
              <p className="text-sm text-slate-500">Total Events (30 days)</p>
            </CardContent>
          </Card>
          {stats.byAction.slice(0, 3).map((stat) => (
            <Card key={stat.action}>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stat.count}</div>
                <p className="text-sm text-slate-500">{stat.action}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search logs..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-9"
              />
            </div>
            <Select value={filters.action} onValueChange={(v) => setFilters({ ...filters, action: v })}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {actions.map((action) => (
                  <SelectItem key={action} value={action}>{action}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.entityType} onValueChange={(v) => setFilters({ ...filters, entityType: v })}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Entity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                {entities.map((entity) => (
                  <SelectItem key={entity} value={entity}>{entity}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="w-[150px]"
              placeholder="From"
            />
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="w-[150px]"
              placeholder="To"
            />
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Entity ID</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    No audit logs found
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>{log.actorName || log.actorId}</TableCell>
                    <TableCell>
                      <Badge className={actionColors[log.action] || "bg-gray-100"}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>{log.entityType || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {log.entityId ? log.entityId.slice(0, 8) : "-"}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      {log.details && Object.keys(log.details).length > 0 ? (
                        <pre className="text-xs bg-slate-50 p-2 rounded overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
            Previous
          </Button>
          <span className="flex items-center px-4 text-sm">
            Page {page} of {Math.ceil(total / 20)}
          </span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 20)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
