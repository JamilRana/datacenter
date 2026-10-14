// src/app/reports/approvals/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { fetchApprovalReport } from "@/app/actions/report-actions";
import { getDynamicApprovalLevelsAction } from "@/app/actions/admin-actions";
import { 
  Download, 
  Filter, 
  Search, 
  FileCheck, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  FileSpreadsheet, 
  FileText, 
  Loader2,
  Timer,
  UserCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exportToCsv, exportToExcel, exportToPdf } from "@/lib/export-utils";
import { toast } from "sonner";
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
import type { ApprovalReportResult } from "@/lib/reports/approvalReport";
import { ReportEmptyState } from "@/app/reports/components/ReportSkeletons";

const statusColors: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-800",
  PENDING_L1: "bg-amber-100 text-amber-800 border-amber-200",
  PENDING_L2: "bg-amber-100 text-amber-800 border-amber-200",
  PENDING_L3: "bg-amber-100 text-amber-800 border-amber-200",
  PENDING_L4: "bg-amber-100 text-amber-800 border-amber-200",
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REJECTED: "bg-rose-100 text-rose-800 border-rose-200",
  PROVISIONED: "bg-blue-100 text-blue-800 border-blue-200",
  RETURNED: "bg-orange-100 text-orange-800 border-orange-200",
};

export default function ApprovalReportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [reportData, setReportData] = useState<ApprovalReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    page: 1,
  });
  const [workflowLevels, setWorkflowLevels] = useState<Array<{ level: number; displayName: string; statusCode: string; roleLabel: string; shortName: string }>>([]);

  useEffect(() => {
    getDynamicApprovalLevelsAction()
      .then((lvls) => setWorkflowLevels(lvls))
      .catch((err) => console.error("Failed to load dynamic workflow levels:", err));
  }, []);

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

  const getFullExportData = async () => {
    const params: Record<string, unknown> = {
      getAll: true,
    };
    if (filters.search) params.search = filters.search;
    if (filters.status && filters.status !== "all") params.status = filters.status;

    const result = await fetchApprovalReport(params);
    return (result?.data || []).map(req => ({
      Request_ID: req.requestId,
      System: req.systemName,
      Requester: req.requesterName,
      Email: req.requesterEmail,
      Current_Level: (() => {
        const levelInfo = workflowLevels.find(w => w.level === req.currentLevel);
        return levelInfo ? `Level ${req.currentLevel} (${levelInfo.shortName})` : `Level ${req.currentLevel}`;
      })(),
      Approver: req.approverName || "Pending Assignee",
      Status: req.status,
      Submitted: new Date(req.submittedAt).toLocaleDateString(),
      Approved: req.approvedAt ? new Date(req.approvedAt).toLocaleDateString() : "Pending",
      Turnaround_Or_Age: req.totalApprovalTime || "N/A",
      Is_Pending_Past_Threshold: (req.pendingAgeDays ?? 0) > 3 ? "YES" : "NO",
    }));
  };

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      toast.info("Preparing CSV export for all matching approvals...");
      const exportData = await getFullExportData();
      exportToCsv(`approval-sla-report-${new Date().toISOString().split("T")[0]}.csv`, exportData);
      toast.success(`Exported ${exportData.length} records successfully.`);
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to export approval report");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      toast.info("Preparing Excel export for all matching approvals...");
      const exportData = await getFullExportData();
      exportToExcel(`approval-sla-report-${new Date().toISOString().split("T")[0]}.xls`, exportData);
      toast.success(`Exported ${exportData.length} records successfully.`);
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to export approval report");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = async () => {
    try {
      setIsExporting(true);
      toast.info("Preparing PDF export for all matching approvals...");
      const exportData = await getFullExportData();
      exportToPdf(
        `approval-sla-report-${new Date().toISOString().split("T")[0]}.html`,
        "Approval SLA & Turnaround Report",
        ["Request ID", "System", "Requester", "Email", "Level", "Approver", "Status", "Submitted", "Approved", "Turnaround / Age", "Past SLA Threshold"],
        exportData
      );
      toast.success(`Exported ${exportData.length} records successfully.`);
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to export approval report");
    } finally {
      setIsExporting(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="p-6 md:p-10 max-w-7xl mx-auto">
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
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Approval SLA & Turnaround Report</h1>
          <p className="text-slate-500 mt-1">Multi-level turnaround SLA percentiles, aging tickets, and approver efficiency</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={isExporting} onClick={handleExportCsv} className="gap-2">
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} CSV
          </Button>
          <Button variant="outline" disabled={isExporting} onClick={handleExportExcel} className="gap-2">
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Excel
          </Button>
          <Button variant="outline" disabled={isExporting} onClick={handleExportPdf} className="gap-2">
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} PDF
          </Button>
        </div>
      </div>

      {/* SLA Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard
          title="Median Turnaround"
          value={`${reportData.analytics.medianTurnaroundDays || 0}d`}
          icon={Timer}
          description="50th percentile (Median)"
          periodType="In selected period"
          tooltip="50% of requests are fully approved in this time or faster."
        />
        <StatCard
          title="90th Percentile SLA"
          value={`${reportData.analytics.p90TurnaroundDays || 0}d`}
          icon={Clock}
          description="90% SLA completion"
          periodType="In selected period"
          tooltip="90% of requests are completed within this turnaround duration."
        />
        <StatCard
          title="Pending > 3 Days"
          value={reportData.analytics.pendingPastThresholdCount || 0}
          icon={AlertTriangle}
          description="Past SLA threshold"
          periodType="Current"
          tooltip="Requests pending approval for more than 3 days without a decision."
        />
        <StatCard
          title="Total Requests"
          value={reportData.analytics.totalCount}
          icon={FileCheck}
          description="Processed & pending"
          periodType="In selected period"
          tooltip="Total workflow requests submitted within the active scope."
        />
        <StatCard
          title="Success Rate"
          value={`${Math.round(reportData.analytics.successRate)}%`}
          icon={CheckCircle}
          description="Approved vs Rejected"
          periodType="In selected period"
          tooltip="Percentage of decided requests that received full approval."
        />
      </div>

      {/* SLA Breakdowns: By Level and By Approver */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Level Table */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-600" />
              Turnaround SLA by Approval Level
            </CardTitle>
            <CardDescription className="text-xs">Median and 90th percentile turnaround days per level</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="text-xs font-bold">Level</TableHead>
                  <TableHead className="text-xs font-bold text-right">Processed Count</TableHead>
                  <TableHead className="text-xs font-bold text-right">Avg Turnaround</TableHead>
                  <TableHead className="text-xs font-bold text-right">Median SLA</TableHead>
                  <TableHead className="text-xs font-bold text-right">P90 SLA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.analytics.avgApprovalTimeByLevel.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-xs text-slate-400">
                      No multi-level approval history recorded
                    </TableCell>
                  </TableRow>
                ) : (
                  reportData.analytics.avgApprovalTimeByLevel.map((lvl) => {
                    const levelInfo = workflowLevels.find(w => w.level === lvl.level);
                    return (
                      <TableRow key={lvl.level}>
                        <TableCell className="font-bold text-xs text-slate-800">
                          Level {lvl.level}
                          {levelInfo && (
                            <span className="text-slate-400 font-normal ml-1.5 text-[11px]">
                              ({levelInfo.roleLabel})
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-right font-medium text-slate-600">{lvl.count}</TableCell>
                        <TableCell className="text-xs text-right font-medium text-slate-600">{lvl.avgDays}d</TableCell>
                        <TableCell className="text-xs text-right font-bold text-indigo-600">{lvl.medianDays}d</TableCell>
                        <TableCell className="text-xs text-right font-bold text-slate-800">{lvl.p90Days}d</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* By Approver Table */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-emerald-600" />
              Turnaround SLA by Approver
            </CardTitle>
            <CardDescription className="text-xs">Individual approver performance metrics and turnaround</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="text-xs font-bold">Approver</TableHead>
                  <TableHead className="text-xs font-bold text-right">Decisions</TableHead>
                  <TableHead className="text-xs font-bold text-right">Avg Turnaround</TableHead>
                  <TableHead className="text-xs font-bold text-right">Median SLA</TableHead>
                  <TableHead className="text-xs font-bold text-right">P90 SLA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.analytics.byApproverTurnaround.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-xs text-slate-400">
                      No approver records available yet
                    </TableCell>
                  </TableRow>
                ) : (
                  reportData.analytics.byApproverTurnaround.map((appr) => (
                    <TableRow key={appr.approverName}>
                      <TableCell className="font-bold text-xs text-slate-800">{appr.approverName}</TableCell>
                      <TableCell className="text-xs text-right font-medium text-slate-600">{appr.count}</TableCell>
                      <TableCell className="text-xs text-right font-medium text-slate-600">{appr.avgDays}d</TableCell>
                      <TableCell className="text-xs text-right font-bold text-emerald-600">{appr.medianDays}d</TableCell>
                      <TableCell className="text-xs text-right font-bold text-slate-800">{appr.p90Days}d</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold">Requests by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <InventoryChart
              title=""
              type="pie"
              data={reportData.analytics.byStatus.map(d => ({ name: d.status.replace("_", " "), value: d.count }))}
            />
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold">Approvals Volume by Level</CardTitle>
          </CardHeader>
          <CardContent>
            <InventoryChart
              title=""
              type="bar"
              data={reportData.analytics.byLevel.map(d => {
                const levelInfo = workflowLevels.find(w => w.level === d.level);
                return { 
                  name: levelInfo ? `L${d.level} - ${levelInfo.shortName}` : `Level ${d.level}`, 
                  value: d.count 
                };
              })}
            />
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <CardTitle className="text-sm font-bold">Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by request ID, system, or approver..."
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                className="pl-9 h-10 text-sm bg-slate-50 border-slate-200"
              />
            </div>
            <Select value={filters.status} onValueChange={(v) => handleFilterChange("status", v)}>
              <SelectTrigger className="h-10 text-sm bg-slate-50 border-slate-200">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                {workflowLevels.length > 0 ? (
                  workflowLevels.map((lvl) => (
                    <SelectItem key={lvl.level} value={lvl.statusCode}>
                      {lvl.displayName}
                    </SelectItem>
                  ))
                ) : (
                  <>
                    <SelectItem value="PENDING_L1">Level 1 - Assistant Maintenance Engineer</SelectItem>
                    <SelectItem value="PENDING_L2">Level 2 - Maintenance Engineer</SelectItem>
                    <SelectItem value="PENDING_L3">Level 3 - System Analyst</SelectItem>
                    <SelectItem value="PENDING_L4">Level 4 - DC Ops</SelectItem>
                  </>
                )}
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="PROVISIONED">Provisioned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Report Table */}
      <Card className="border-slate-200 overflow-hidden shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-xs font-bold">Request ID</TableHead>
                <TableHead className="text-xs font-bold">System</TableHead>
                <TableHead className="text-xs font-bold">Requester</TableHead>
                <TableHead className="text-xs font-bold">Level</TableHead>
                <TableHead className="text-xs font-bold">Approver</TableHead>
                <TableHead className="text-xs font-bold">Status</TableHead>
                <TableHead className="text-xs font-bold">Submitted</TableHead>
                <TableHead className="text-xs font-bold">Approved</TableHead>
                <TableHead className="text-xs font-bold">Turnaround / Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="p-8">
                    <ReportEmptyState 
                      message="No data for this period and filters" 
                      onClearFilters={() => setFilters({ search: "", status: "all", page: 1 })} 
                    />
                  </TableCell>
                </TableRow>
              ) : (
                reportData.data.map((req) => {
                  const isOldPending = (req.pendingAgeDays ?? 0) > 3;

                  return (
                    <TableRow key={req.id} className="hover:bg-slate-50/60">
                      <TableCell className="font-mono text-xs font-bold text-slate-800">{req.requestId.slice(0, 8)}</TableCell>
                      <TableCell className="text-xs font-semibold text-slate-900">{req.systemName}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-xs text-slate-800">{req.requesterName}</div>
                          <div className="text-[10px] text-slate-400">{req.requesterEmail}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        <span className="font-semibold">Level {req.currentLevel}</span>
                        {(() => {
                          const levelInfo = workflowLevels.find(w => w.level === req.currentLevel);
                          return levelInfo ? (
                            <span className="text-[10px] text-slate-400 block truncate max-w-[120px]" title={levelInfo.roleLabel}>
                              {levelInfo.shortName}
                            </span>
                          ) : null;
                        })()}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 font-medium">
                        {req.approverName || <span className="text-slate-400 italic">Pending Assignment</span>}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statusColors[req.status] || "bg-slate-100 text-slate-800"} text-[10px] font-bold`}>
                          {req.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">{new Date(req.submittedAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {req.approvedAt ? new Date(req.approvedAt).toLocaleDateString() : <span className="text-amber-600 font-medium">Pending</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Clock className={`h-3.5 w-3.5 ${isOldPending ? "text-rose-500 animate-pulse" : "text-slate-400"}`} />
                          <span className={`text-xs ${isOldPending ? "text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200" : "text-slate-700 font-medium"}`}>
                            {req.totalApprovalTime || "-"}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {reportData.totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(filters.page - 1)}
            disabled={filters.page <= 1}
          >
            Previous
          </Button>
          <span className="flex items-center px-4 text-xs font-medium text-slate-600">
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
