// src/app/reports/approvals/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { fetchApprovalReport } from "@/app/actions/report-actions";
import { Download, Filter, Search, FileCheck, Clock, CheckCircle, XCircle, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exportToCsv, exportToExcel, exportToPdf } from "@/lib/export-utils";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/analytics/StatCard";
import { InventoryChart } from "@/components/analytics/InventoryChart";

interface ApprovalReportRow {
  id: string;
  requestId: string;
  systemName: string;
  requesterName: string;
  requesterEmail: string;
  currentLevel: number;
  status: string;
  submittedAt: Date;
  approvedAt: Date | null;
  totalApprovalTime: string | null;
}

interface ApprovalReportAnalytics {
  totalCount: number;
  byStatus: { status: string; count: number }[];
  byLevel: { level: number; count: number }[];
  avgApprovalTimeByLevel: { level: number; avgDays: number }[];
  successRate: number;
}

interface ApprovalReportResult {
  data: ApprovalReportRow[];
  analytics: ApprovalReportAnalytics;
  total: number;
  page: number;
  totalPages: number;
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  PENDING_L1: "bg-yellow-100 text-yellow-800",
  PENDING_L2: "bg-yellow-100 text-yellow-800",
  PENDING_L3: "bg-yellow-100 text-yellow-800",
  PENDING_L4: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  PROVISIONED: "bg-blue-100 text-blue-800",
  RETURNED: "bg-orange-100 text-orange-800",
};

export default function ApprovalReportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [reportData, setReportData] = useState<ApprovalReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    page: 1,
  });

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/auth");
      return;
    }

    const fetchReport = async () => {
      try {
        const params: Record<string, unknown> = {
          page: filters.page,
          pageSize: 10,
        };
        
        if (filters.search) params.search = filters.search;
        if (filters.status && filters.status !== "all") params.status = filters.status;

        const result = await fetchApprovalReport(params);
        setReportData(result);
      } catch (error) {
        console.error("Failed to fetch approval report:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [session, status, router, filters]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  const getExportData = () => {
    if (!reportData?.data) return [];
    return reportData.data.map(req => ({
      Request_ID: req.requestId,
      System: req.systemName,
      Requester: req.requesterName,
      Email: req.requesterEmail,
      Current_Level: req.currentLevel,
      Status: req.status,
      Submitted: new Date(req.submittedAt).toLocaleDateString(),
      Approved: req.approvedAt ? new Date(req.approvedAt).toLocaleDateString() : "Pending",
      Approval_Time: req.totalApprovalTime || "N/A",
    }));
  };

  const handleExportCsv = () => {
    exportToCsv(`approval-report-${new Date().toISOString().split("T")[0]}.csv`, getExportData());
  };

  const handleExportExcel = () => {
    exportToExcel(`approval-report-${new Date().toISOString().split("T")[0]}.xls`, getExportData());
  };

  const handleExportPdf = () => {
    exportToPdf(
      `approval-report-${new Date().toISOString().split("T")[0]}.html`,
      "Approval Report",
      ["Request ID", "System", "Requester", "Email", "Level", "Status", "Submitted", "Approved", "Time"],
      getExportData()
    );
  };

  if (status === "loading" || loading) {
    return (
      <div className="p-6 md:p-10 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-64"></div>
          <div className="h-48 bg-slate-200 rounded-xl"></div>
          <div className="h-96 bg-slate-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (!session || !reportData) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Approval Report</h1>
          <p className="text-slate-500 mt-1">Approval workflow and request processing report</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCsv} className="gap-2">
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" onClick={handleExportExcel} className="gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" onClick={handleExportPdf} className="gap-2">
            <FileText className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Requests"
          value={reportData.analytics.totalCount}
          icon={FileCheck}
          description="All requests"
        />
        <StatCard
          title="Success Rate"
          value={`${Math.round(reportData.analytics.successRate)}%`}
          icon={CheckCircle}
          description="Approved vs Rejected"
        />
        {reportData.analytics.byStatus.slice(0, 2).map((stat) => (
          <StatCard
            key={stat.status}
            title={stat.status.replace("_", " ")}
            value={stat.count}
            icon={stat.status === "APPROVED" ? CheckCircle : XCircle}
            description="By status"
          />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Requests by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <InventoryChart
              title=""
              type="pie"
              data={reportData.analytics.byStatus.map(d => ({ name: d.status.replace("_", " "), value: d.count }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Approvals by Level</CardTitle>
          </CardHeader>
          <CardContent>
            <InventoryChart
              title=""
              type="bar"
              data={reportData.analytics.byLevel.map(d => ({ name: `Level ${d.level}`, value: d.count }))}
            />
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <CardTitle className="text-base">Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search system name..."
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filters.status} onValueChange={(v) => handleFilterChange("status", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="PENDING_L1">Pending L1</SelectItem>
                <SelectItem value="PENDING_L2">Pending L2</SelectItem>
                <SelectItem value="PENDING_L3">Pending L3</SelectItem>
                <SelectItem value="PENDING_L4">Pending L4</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="PROVISIONED">Provisioned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Report Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request ID</TableHead>
                <TableHead>System</TableHead>
                <TableHead>Requester</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Approved</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                    No requests found matching your criteria
                  </TableCell>
                </TableRow>
              ) : (
                reportData.data.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium font-mono text-sm">{req.requestId.slice(0, 8)}</TableCell>
                    <TableCell>{req.systemName}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{req.requesterName}</div>
                        <div className="text-xs text-slate-500">{req.requesterEmail}</div>
                      </div>
                    </TableCell>
                    <TableCell>Level {req.currentLevel}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[req.status] || "bg-gray-100"}>
                        {req.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(req.submittedAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {req.approvedAt ? new Date(req.approvedAt).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-400" />
                        {req.totalApprovalTime || "-"}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {reportData.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(filters.page - 1)}
            disabled={filters.page <= 1}
          >
            Previous
          </Button>
          <span className="flex items-center px-4 text-sm">
            Page {filters.page} of {reportData.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(filters.page + 1)}
            disabled={filters.page >= reportData.totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
