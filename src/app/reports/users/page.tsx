// src/app/reports/users/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { fetchUserReport } from "@/app/actions/report-actions";
import { Download, Filter, Search, Users, User, FileCheck, Server, Clock, FileSpreadsheet, FileText } from "lucide-react";
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

interface UserReportRow {
  id: string;
  name: string;
  email: string;
  organization: string | null;
  roles: string[];
  vmCount: number;
  requestCount: number;
  pendingApprovals: number;
  lastActive: Date | null;
  createdAt: Date;
}

interface UserReportAnalytics {
  totalUsers: number;
  byRole: { role: string; count: number }[];
  byDepartment: { department: string; count: number }[];
  topRequesters: { userId: string; name: string; count: number }[];
  activeUsers: number;
  inactiveUsers: number;
}

interface UserReportResult {
  data: UserReportRow[];
  analytics: UserReportAnalytics;
  total: number;
  page: number;
  totalPages: number;
}

const roleColors: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-800",
  DC_OPS: "bg-purple-100 text-purple-800",
  APPROVER_L1: "bg-yellow-100 text-yellow-800",
  APPROVER_L2: "bg-yellow-100 text-yellow-800",
  APPROVER_L3: "bg-yellow-100 text-yellow-800",
  APPROVER_L4: "bg-yellow-100 text-yellow-800",
  REQUESTER: "bg-blue-100 text-blue-800",
};

export default function UserReportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [reportData, setReportData] = useState<UserReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
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
        
        if (result.data.length === 0 && result.total === 0) {
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

  const getExportData = () => {
    if (!reportData?.data) return [];
    return reportData.data.map(user => ({
      Name: user.name,
      Email: user.email,
      Department: user.organization || "N/A",
      Roles: user.roles.join(", "),
      VMs_Owned: user.vmCount,
      Requests: user.requestCount,
      Pending_Approvals: user.pendingApprovals,
      Last_Active: user.lastActive ? new Date(user.lastActive).toLocaleDateString() : "Never",
      Created: new Date(user.createdAt).toLocaleDateString(),
    }));
  };

  const handleExportCsv = () => {
    exportToCsv(`user-report-${new Date().toISOString().split("T")[0]}.csv`, getExportData());
  };

  const handleExportExcel = () => {
    exportToExcel(`user-report-${new Date().toISOString().split("T")[0]}.xls`, getExportData());
  };

  const handleExportPdf = () => {
    exportToPdf(
      `user-report-${new Date().toISOString().split("T")[0]}.html`,
      "User Report",
      ["Name", "Email", "Department", "Roles", "VMs", "Requests", "Pending", "Last Active", "Created"],
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

  if (!session) return null;

  if (accessDenied) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Report</h1>
          <p className="text-slate-500 mt-1">User activity and role report</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">Access Restricted</h3>
            <p className="text-slate-500">
              You need ADMIN or DC_OPS role to view user reports.
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
          <h1 className="text-2xl font-bold text-slate-900">User Report</h1>
          <p className="text-slate-500 mt-1">User activity, roles, and resource ownership report</p>
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
          title="Total Users"
          value={reportData.analytics.totalUsers}
          icon={Users}
          description="Registered users"
        />
        <StatCard
          title="Active Users"
          value={reportData.analytics.activeUsers}
          icon={User}
          description="Last 30 days"
        />
        <StatCard
          title="Total VMs Owned"
          value={reportData.data.reduce((sum, u) => sum + u.vmCount, 0)}
          icon={Server}
          description="Across all users"
        />
        <StatCard
          title="Total Requests"
          value={reportData.data.reduce((sum, u) => sum + u.requestCount, 0)}
          icon={FileCheck}
          description="Across all users"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Users by Role</CardTitle>
          </CardHeader>
          <CardContent>
            <InventoryChart
              title=""
              type="bar"
              data={reportData.analytics.byRole.map(d => ({ name: d.role, value: d.count }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Users by Department</CardTitle>
          </CardHeader>
          <CardContent>
            <InventoryChart
              title=""
              type="pie"
              data={reportData.analytics.byDepartment.map(d => ({ name: d.department, value: d.count }))}
            />
          </CardContent>
        </Card>
      </div>

      {/* Top Requesters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Top Requesters</CardTitle>
        </CardHeader>
        <CardContent>
          <InventoryChart
            title=""
            type="bar"
            data={reportData.analytics.topRequesters.slice(0, 10).map(d => ({ name: d.name, value: d.count }))}
          />
        </CardContent>
      </Card>

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
                placeholder="Search name or email..."
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filters.role} onValueChange={(v) => handleFilterChange("role", v)}>
              <SelectTrigger>
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
            <Select value={filters.department} onValueChange={(v) => handleFilterChange("department", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {reportData.analytics.byDepartment.map((dept) => (
                  <SelectItem key={dept.department} value={dept.department}>
                    {dept.department}
                  </SelectItem>
                ))}
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
                <TableHead>User</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>VMs</TableHead>
                <TableHead>Requests</TableHead>
                <TableHead>Pending Approvals</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                    No users found matching your criteria
                  </TableCell>
                </TableRow>
              ) : (
                reportData.data.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-xs text-slate-500">{user.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>{user.organization || "-"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role) => (
                          <Badge key={role} className={roleColors[role] || "bg-gray-100"}>
                            {role.replace("_", " ")}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Server className="h-3 w-3 text-slate-400" />
                        {user.vmCount}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <FileCheck className="h-3 w-3 text-slate-400" />
                        {user.requestCount}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.pendingApprovals > 0 ? (
                        <Badge variant="outline" className="bg-yellow-50">
                          {user.pendingApprovals} pending
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-slate-500">
                        <Clock className="h-3 w-3" />
                        {user.lastActive ? new Date(user.lastActive).toLocaleDateString() : "Never"}
                      </div>
                    </TableCell>
                    <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
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
