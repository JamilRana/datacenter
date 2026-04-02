// src/app/reports/vm/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchVmReport } from "@/app/actions/report-actions";
import { Download, Filter, Search, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { exportToCsv, exportToExcel, exportToPdf } from "@/lib/export-utils";

interface VmReportRow {
  id: string;
  vmName: string;
  hostname: string;
  ownerName: string;
  ownerEmail: string;
  systemName: string;
  domain: string;
  environment: string;
  vcpu: number;
  ramGb: number;
  storageGb: number;
  status: string;
  createdAt: Date;
}

interface VmReportAnalytics {
  totalCount: number;
  byOwner: { ownerName: string; count: number }[];
  bySystem: { systemName: string; count: number }[];
  byStatus: { status: string; count: number }[];
  monthlyTrend: { month: string; count: number }[];
}

interface VmReportResult {
  data: VmReportRow[];
  analytics: VmReportAnalytics;
  total: number;
  page: number;
  totalPages: number;
}

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  SUSPENDED: "bg-yellow-100 text-yellow-800",
  RETIRED: "bg-gray-100 text-gray-800",
  PROVISIONING: "bg-blue-100 text-blue-800",
  FAILED: "bg-red-100 text-red-800",
};

export default function VmReportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [reportData, setReportData] = useState<VmReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: searchParams.get("search") || "",
    status: searchParams.get("status") || "all",
    environment: searchParams.get("environment") || "all",
    page: parseInt(searchParams.get("page") || "1", 10),
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
        if (filters.environment && filters.environment !== "all") params.environment = filters.environment;

        const result = await fetchVmReport(params);
        setReportData(result);
      } catch (error) {
        console.error("Failed to fetch VM report:", error);
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

  const handleExportCsv = () => {
    if (!reportData?.data) return;
    
    const exportData = reportData.data.map(vm => ({
      Hostname: vm.hostname,
      Owner: vm.ownerName,
      Email: vm.ownerEmail,
      System: vm.systemName,
      Domain: vm.domain,
      Environment: vm.environment,
      Status: vm.status,
      vCPU: vm.vcpu,
      RAM_GB: vm.ramGb,
      Storage_GB: vm.storageGb,
      Created: new Date(vm.createdAt).toLocaleDateString(),
    }));
    
    exportToCsv(`vm-report-${new Date().toISOString().split("T")[0]}.csv`, exportData);
  };

  const handleExportExcel = () => {
    if (!reportData?.data) return;
    
    const exportData = reportData.data.map(vm => ({
      Hostname: vm.hostname,
      Owner: vm.ownerName,
      Email: vm.ownerEmail,
      System: vm.systemName,
      Domain: vm.domain,
      Environment: vm.environment,
      Status: vm.status,
      vCPU: vm.vcpu,
      RAM_GB: vm.ramGb,
      Storage_GB: vm.storageGb,
      Created: new Date(vm.createdAt).toLocaleDateString(),
    }));
    
    exportToExcel(`vm-report-${new Date().toISOString().split("T")[0]}.xls`, exportData);
  };

  const handleExportPdf = () => {
    if (!reportData?.data) return;
    
    const exportData = reportData.data.map(vm => ({
      Hostname: vm.hostname,
      Owner: vm.ownerName,
      Email: vm.ownerEmail,
      System: vm.systemName,
      Domain: vm.domain,
      Environment: vm.environment,
      Status: vm.status,
      vCPU: vm.vcpu,
      RAM_GB: vm.ramGb,
      Storage_GB: vm.storageGb,
      Created: new Date(vm.createdAt).toLocaleDateString(),
    }));
    
    exportToPdf(
      `vm-report-${new Date().toISOString().split("T")[0]}.html`,
      "VM Report",
      ["Hostname", "Owner", "Email", "System", "Domain", "Environment", "Status", "vCPU", "RAM (GB)", "Storage (GB)", "Created"],
      exportData
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
          <h1 className="text-2xl font-bold text-slate-900">VM Report</h1>
          <p className="text-slate-500 mt-1">Virtual machine inventory and utilization report</p>
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
          title="Total VMs"
          value={reportData.analytics.totalCount}
          icon={Server}
          description="All VM instances"
        />
        {reportData.analytics.byStatus.map((stat) => (
          <StatCard
            key={stat.status}
            title={stat.status}
            value={stat.count}
            icon={Server}
            description="By status"
          />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">VMs by Owner</CardTitle>
          </CardHeader>
          <CardContent>
            <InventoryChart
              title=""
              type="bar"
              data={reportData.analytics.byOwner.slice(0, 10).map(d => ({ name: d.ownerName, value: d.count }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">VMs by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <InventoryChart
              title=""
              type="pie"
              data={reportData.analytics.byStatus.map(d => ({ name: d.status, value: d.count }))}
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
                placeholder="Search hostname..."
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
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
                <SelectItem value="RETIRED">Retired</SelectItem>
                <SelectItem value="PROVISIONING">Provisioning</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.environment} onValueChange={(v) => handleFilterChange("environment", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Environment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Environments</SelectItem>
                <SelectItem value="PRODUCTION">Production</SelectItem>
                <SelectItem value="STAGING">Staging</SelectItem>
                <SelectItem value="DEVELOPMENT">Development</SelectItem>
                <SelectItem value="TEST">Test</SelectItem>
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
                <TableHead>Hostname</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>System</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>vCPU</TableHead>
                <TableHead>RAM (GB)</TableHead>
                <TableHead>Storage (GB)</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                    No VMs found matching your criteria
                  </TableCell>
                </TableRow>
              ) : (
                reportData.data.map((vm) => (
                  <TableRow key={vm.id}>
                    <TableCell className="font-medium">{vm.hostname || "-"}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{vm.ownerName}</div>
                        <div className="text-xs text-slate-500">{vm.ownerEmail}</div>
                      </div>
                    </TableCell>
                    <TableCell>{vm.systemName}</TableCell>
                    <TableCell>{vm.environment}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[vm.status] || "bg-gray-100"}>
                        {vm.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{vm.vcpu}</TableCell>
                    <TableCell>{vm.ramGb}</TableCell>
                    <TableCell>{vm.storageGb}</TableCell>
                    <TableCell>{new Date(vm.createdAt).toLocaleDateString()}</TableCell>
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

import { Server } from "lucide-react";
