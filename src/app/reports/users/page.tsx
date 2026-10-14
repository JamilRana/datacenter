// src/app/reports/users/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { fetchUserReport } from "@/app/actions/report-actions";
import { 
  Download, 
  Search, 
  Users, 
  Server, 
  FileCheck, 
  Box, 
  FolderKanban, 
  Cpu, 
  HardDrive, 
  Database, 
  FileSpreadsheet, 
  FileText, 
  Loader2,
  Eye,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { UserResourceDetailModal } from "@/app/reports/components/UserResourceDetailModal";
import type { UserReportResult } from "@/lib/reports/userReport";
import { ReportEmptyState, ReportErrorState } from "@/app/reports/components/ReportSkeletons";
import { autoScaleRam, autoScaleStorage } from "@/lib/format-utils";

const roleColors: Record<string, string> = {
  ADMIN: "bg-red-50 text-red-700 border-red-200",
  DC_OPS: "bg-purple-50 text-purple-700 border-purple-200",
  APPROVER_L1: "bg-amber-50 text-amber-700 border-amber-200",
  APPROVER_L2: "bg-amber-50 text-amber-700 border-amber-200",
  APPROVER_L3: "bg-amber-50 text-amber-700 border-amber-200",
  APPROVER_L4: "bg-amber-50 text-amber-700 border-amber-200",
  REQUESTER: "bg-blue-50 text-blue-700 border-blue-200",
};

export default function UserReportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [reportData, setReportData] = useState<UserReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  
  // Selected user for detailed drilldown modal
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const [filters, setFilters] = useState({
    search: "",
    role: "all",
    department: "all",
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
        if (filters.role && filters.role !== "all") params.role = filters.role;
        if (filters.department && filters.department !== "all") params.department = filters.department;

        const result = await fetchUserReport(params);
        
        if (result.data.length === 0 && result.total === 0 && !filters.search && filters.role === "all") {
          setAccessDenied(true);
        } else {
          setReportData(result);
        }
      } catch (error) {
        console.error("Failed to fetch user report:", error);
        setAccessDenied(true);
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

  const handleInspectUser = (userId: string) => {
    setSelectedUserId(userId);
    setIsDetailModalOpen(true);
  };

  const getFullExportData = async () => {
    const params: Record<string, unknown> = {
      getAll: true,
    };
    if (filters.search) params.search = filters.search;
    if (filters.role && filters.role !== "all") params.role = filters.role;
    if (filters.department && filters.department !== "all") params.department = filters.department;

    const result = await fetchUserReport(params);
    return (result?.data || []).map(user => ({
      Name: user.name,
      Email: user.email,
      Department: user.organization || "N/A",
      Roles: user.roles.join(", "),
      Systems_Owned_Count: user.systemsCount,
      Systems_List: user.systems.join("; "),
      Active_VMs: user.activeVmCount,
      Total_VMs: user.vmCount,
      Namespaces_Owned: user.namespaceCount,
      Total_Requests: user.requestCount,
      Allocated_vCPU: user.totalVcpu,
      Allocated_RAM_GB: user.totalRamGb,
      Allocated_Storage_GB: user.totalStorageGb,
      Pending_Approvals: user.pendingApprovals,
      Last_Active: user.lastActive ? new Date(user.lastActive).toLocaleDateString() : "Never",
      Created_Date: new Date(user.createdAt).toLocaleDateString(),
    }));
  };

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      toast.info("Preparing comprehensive resource ownership CSV export...");
      const exportData = await getFullExportData();
      exportToCsv(`user-resource-ownership-report-${new Date().toISOString().split("T")[0]}.csv`, exportData);
      toast.success(`Exported ${exportData.length} users with complete resource metrics.`);
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to export user resource report");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      toast.info("Preparing comprehensive resource ownership Excel export...");
      const exportData = await getFullExportData();
      exportToExcel(`user-resource-ownership-report-${new Date().toISOString().split("T")[0]}.xls`, exportData);
      toast.success(`Exported ${exportData.length} users with complete resource metrics.`);
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to export user resource report");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = async () => {
    try {
      setIsExporting(true);
      toast.info("Preparing comprehensive resource ownership PDF/HTML export...");
      const exportData = await getFullExportData();
      exportToPdf(
        `user-resource-ownership-report-${new Date().toISOString().split("T")[0]}`,
        "User Resource & System Ownership Report",
        [
          "Name", 
          "Email", 
          "Department", 
          "Systems Count",
          "Systems List", 
          "VMs (Act/Tot)", 
          "Namespaces", 
          "Requests", 
          "vCPU", 
          "RAM (GB)", 
          "Storage (GB)"
        ],
        exportData
      );
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to export user resource report");
    } finally {
      setIsExporting(false);
    }
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

  if (!session) return null;

  if (accessDenied) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Resource & Ownership Report</h1>
          <p className="text-slate-500 mt-1">Audit of systems, VMs, namespaces, requests, and resource footprints by user</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">Access Restricted</h3>
            <p className="text-slate-500">
              You need ADMIN or DC_OPS role to view user resource reports.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!reportData) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">User Resource & System Ownership Report</h1>
          <p className="text-slate-500 mt-1">
            Comprehensive audit of which users own which systems, VMs, Kubernetes namespaces, and compute allocations.
          </p>
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

      {/* Resource Ownership Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <StatCard
          title="Users"
          value={reportData.analytics.totalUsers}
          icon={Users}
          description="Registered users"
          periodType="Current"
          tooltip="Distinct user accounts in scope."
        />
        <StatCard
          title="Systems"
          value={reportData.analytics.totalSystemsMonitored}
          icon={FolderKanban}
          description="Unique systems"
          periodType="Current"
          tooltip="Distinct application systems mapped across VMs and namespaces."
        />
        <StatCard
          title="VMs Owned"
          value={reportData.analytics.totalVmsOwned}
          icon={Server}
          description={`${reportData.analytics.totalActiveVms} active nodes`}
          periodType="Current"
          tooltip="Total virtual machines belonging to users in scope."
        />
        <StatCard
          title="Namespaces"
          value={reportData.analytics.totalNamespacesManaged}
          icon={Box}
          description="K8s clusters"
          periodType="Current"
          tooltip="Total Kubernetes namespaces mapped to users in scope."
        />
        <StatCard
          title="Total vCPU"
          value={reportData.analytics.totalVcpuAllocated}
          icon={Cpu}
          description="Allocated cores"
          periodType="Current"
          tooltip="Sum of effective vCPU cores allocated over Active VMs as of now."
        />
        <StatCard
          title="Total RAM"
          value={autoScaleRam(reportData.analytics.totalRamAllocatedGb)}
          icon={HardDrive}
          description="Memory footprint"
          periodType="Current"
          tooltip="Sum of effective RAM allocated over Active VMs as of now."
        />
        <StatCard
          title="Total Storage"
          value={autoScaleStorage(reportData.analytics.totalStorageAllocatedGb)}
          icon={Database}
          description="Disk capacity"
          periodType="Current"
          tooltip="Sum of effective storage disk capacity allocated over Active VMs as of now."
        />
      </div>

      {/* Analytics Charts: Top Resource Consumers & System Owners */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-slate-200">
          <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-indigo-600" />
              <CardTitle className="text-sm font-bold text-slate-800">
                Top Resource Consumers (Allocated vCPU Cores)
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <InventoryChart
              title=""
              type="bar"
              data={reportData.analytics.topResourceOwners.map(d => ({ 
                name: d.name, 
                value: d.vcpu 
              }))}
            />
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-blue-600" />
              <CardTitle className="text-sm font-bold text-slate-800">
                Top Virtual Machine & System Owners (VM Count)
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <InventoryChart
              title=""
              type="bar"
              data={reportData.analytics.topVmOwners.map(d => ({ 
                name: d.name, 
                value: d.vmCount 
              }))}
            />
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="border-slate-200 shadow-xs">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name, email, department, or system (e.g. Kazi Fabliha Tasnim, HMIS)..."
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                className="pl-9 bg-white"
              />
              {filters.search && (
                <button
                  type="button"
                  onClick={() => handleFilterChange("search", "")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="w-full md:w-52">
              <Select value={filters.role} onValueChange={(v) => handleFilterChange("role", v)}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="DC_OPS">DC Ops</SelectItem>
                  <SelectItem value="APPROVER_L1">Approver L1</SelectItem>
                  <SelectItem value="APPROVER_L2">Approver L2</SelectItem>
                  <SelectItem value="APPROVER_L3">Approver L3</SelectItem>
                  <SelectItem value="APPROVER_L4">Approver L4</SelectItem>
                  <SelectItem value="REQUESTER">Requester</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Report Table */}
      <Card className="border-slate-200 overflow-hidden shadow-xs">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/80 border-b border-slate-200">
              <TableRow>
                <TableHead className="text-[11px] font-bold text-slate-600 uppercase">User Identity</TableHead>
                <TableHead className="text-[11px] font-bold text-slate-600 uppercase">Department</TableHead>
                <TableHead className="text-[11px] font-bold text-slate-600 uppercase">Systems Owned</TableHead>
                <TableHead className="text-[11px] font-bold text-slate-600 uppercase">Allocated Specs</TableHead>
                <TableHead className="text-[11px] font-bold text-slate-600 uppercase text-center">VMs (Act/Tot)</TableHead>
                <TableHead className="text-[11px] font-bold text-slate-600 uppercase text-center">Namespaces</TableHead>
                <TableHead className="text-[11px] font-bold text-slate-600 uppercase text-center">Requests</TableHead>
                <TableHead className="text-[11px] font-bold text-slate-600 uppercase text-right">Drilldown & Export</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="p-8">
                    <ReportEmptyState 
                      message="No data for this period and filters" 
                      onClearFilters={() => setFilters({ search: "", role: "all", department: "all", page: 1 })} 
                    />
                  </TableCell>
                </TableRow>
              ) : (
                reportData.data.map((user) => (
                  <TableRow key={user.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* User Identity */}
                    <TableCell className="py-3">
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{user.name}</div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">{user.email}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {user.roles.map((role) => (
                            <Badge key={role} variant="outline" className={`text-[9px] font-semibold ${roleColors[role] || "bg-slate-50 text-slate-600"}`}>
                              {role.replace("_", " ")}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </TableCell>

                    {/* Department */}
                    <TableCell className="text-xs text-slate-600 font-medium">
                      {user.organization || "—"}
                    </TableCell>

                    {/* Systems Owned */}
                    <TableCell className="max-w-xs">
                      {user.systems.length === 0 ? (
                        <span className="text-xs text-slate-400">None</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {user.systems.slice(0, 3).map((sys) => (
                            <Badge
                              key={sys}
                              variant="secondary"
                              className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 flex items-center gap-1 border border-indigo-100"
                            >
                              <FolderKanban className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[120px]">{sys}</span>
                            </Badge>
                          ))}
                          {user.systems.length > 3 && (
                            <span className="text-[10px] font-bold text-slate-400 self-center">
                              +{user.systems.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>

                    {/* Allocated Specs */}
                    <TableCell>
                      {user.totalVcpu > 0 || user.totalRamGb > 0 || user.totalStorageGb > 0 ? (
                        <div className="text-xs font-semibold text-slate-700 space-y-0.5">
                          <div className="flex items-center gap-1">
                            <Cpu className="h-3 w-3 text-amber-500" />
                            <span>{user.totalVcpu} Cores</span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-500">
                            <span>{user.totalRamGb} GB RAM</span>
                            <span>•</span>
                            <span>{user.totalStorageGb} GB SSD</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">0 allocated</span>
                      )}
                    </TableCell>

                    {/* VMs */}
                    <TableCell className="text-center">
                      <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100/80 text-xs font-semibold">
                        <Server className="h-3 w-3 text-slate-500" />
                        <span className="font-bold text-emerald-600">{user.activeVmCount}</span>
                        <span className="text-slate-400">/</span>
                        <span className="text-slate-700">{user.vmCount}</span>
                      </div>
                    </TableCell>

                    {/* Namespaces */}
                    <TableCell className="text-center">
                      {user.namespaceCount > 0 ? (
                        <Badge variant="outline" className="text-xs font-bold bg-sky-50 text-sky-700 border-sky-200">
                          <Box className="h-3 w-3 mr-1" />
                          {user.namespaceCount}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </TableCell>

                    {/* Requests */}
                    <TableCell className="text-center">
                      {user.requestCount > 0 ? (
                        <Badge variant="outline" className="text-xs font-bold bg-purple-50 text-purple-700 border-purple-200">
                          <FileCheck className="h-3 w-3 mr-1" />
                          {user.requestCount}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </TableCell>

                    {/* Action */}
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleInspectUser(user.id)}
                        className="h-8 text-xs font-bold gap-1 text-indigo-700 border-indigo-200 hover:bg-indigo-50 shadow-2xs"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Inspect & Export
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination Footer */}
      {reportData.total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 text-xs text-slate-500">
          <div>
            Showing <strong className="text-slate-800">{(filters.page - 1) * 10 + 1}</strong> &ndash;{" "}
            <strong className="text-slate-800">{Math.min(filters.page * 10, reportData.total)}</strong> of{" "}
            <strong className="text-slate-800">{reportData.total}</strong> users
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(filters.page - 1)}
              disabled={filters.page <= 1}
              className="h-8 px-3 text-xs"
            >
              Previous
            </Button>
            <span className="font-medium text-slate-700">
              Page {filters.page} of {reportData.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(filters.page + 1)}
              disabled={filters.page >= reportData.totalPages}
              className="h-8 px-3 text-xs"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* User Resource Detail & Individual Export Modal */}
      <UserResourceDetailModal
        userId={selectedUserId}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedUserId(null);
        }}
      />
    </div>
  );
}
