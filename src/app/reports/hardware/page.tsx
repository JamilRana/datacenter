// src/app/reports/hardware/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { fetchHardwareReport } from "@/app/actions/report-actions";
import { Download, Filter, Search, HardDrive, Server, Cpu, Database, FileSpreadsheet, FileText } from "lucide-react";
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

interface HardwareReportRow {
  id: string;
  assetName: string;
  type: string;
  location: string;
  clusterName?: string;
  totalCpu: number;
  totalRam: number;
  totalStorage: number;
  allocatedCpu: number;
  allocatedRam: number;
  allocatedStorage: number;
  utilizationPercent: number;
  vmCount: number;
  status: string;
}

interface HardwareReportAnalytics {
  totalCount: number;
  byType: { type: string; count: number }[];
  byLocation: { location: string; count: number }[];
  utilizationDistribution: { range: string; count: number }[];
  overloadedCount: number;
  underutilizedCount: number;
  totalCapacity: { cpu: number; ram: number; storage: number };
  usedCapacity: { cpu: number; ram: number; storage: number };
}

interface HardwareReportResult {
  data: HardwareReportRow[];
  analytics: HardwareReportAnalytics;
  total: number;
  page: number;
  totalPages: number;
}

const statusColors: Record<string, string> = {
  Available: "bg-green-100 text-green-800",
  Utilized: "bg-blue-100 text-blue-800",
  Underutilized: "bg-yellow-100 text-yellow-800",
  Overloaded: "bg-red-100 text-red-800",
};

export default function HardwareReportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [reportData, setReportData] = useState<HardwareReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    type: "all",
    location: "all",
    clusterId: "all",
    page: 1,
  });
  const [clusters, setClusters] = useState<any[]>([]);

  useEffect(() => {
    const loadClusters = async () => {
      try {
        const { fetchClusters } = await import("@/app/actions/cluster-actions");
        const data = await fetchClusters();
        setClusters(data);
      } catch (err) {
        console.error("Failed to fetch clusters for reports:", err);
      }
    };
    loadClusters();
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
        if (filters.type && filters.type !== "all") params.type = filters.type;
        if (filters.location && filters.location !== "all") params.location = filters.location;
        if (filters.clusterId && filters.clusterId !== "all") params.clusterId = filters.clusterId;

        const result = await fetchHardwareReport(params);
        
        if (result.data.length === 0 && result.total === 0 && result.analytics.totalCount === 0) {
          setAccessDenied(true);
        } else {
          setReportData(result);
        }
      } catch (error) {
        console.error("Failed to fetch hardware report:", error);
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
    return reportData.data.map(asset => ({
      Name: asset.assetName,
      Type: asset.type,
      Cluster: asset.clusterName || "-",
      Location: asset.location,
      Total_CPU: asset.totalCpu,
      Total_RAM: asset.totalRam,
      Total_Storage: asset.totalStorage,
      Allocated_CPU: asset.allocatedCpu,
      Allocated_RAM: asset.allocatedRam,
      Allocated_Storage: asset.allocatedStorage,
      Utilization: `${asset.utilizationPercent}%`,
      VM_Count: asset.vmCount,
      Status: asset.status,
    }));
  };

  const handleExportCsv = () => {
    exportToCsv(`hardware-report-${new Date().toISOString().split("T")[0]}.csv`, getExportData());
  };

  const handleExportExcel = () => {
    exportToExcel(`hardware-report-${new Date().toISOString().split("T")[0]}.xls`, getExportData());
  };

  const handleExportPdf = () => {
    exportToPdf(
      `hardware-report-${new Date().toISOString().split("T")[0]}.html`,
      "Hardware Report",
      ["Name", "Type", "Cluster", "Location", "Total CPU", "Total RAM", "Total Storage", "Alloc CPU", "Alloc RAM", "Alloc Storage", "Utilization", "VMs", "Status"],
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
          <h1 className="text-2xl font-bold text-slate-900">Hardware Report</h1>
          <p className="text-slate-500 mt-1">Hardware asset utilization report</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <HardDrive className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">Access Restricted</h3>
            <p className="text-slate-500">
              You need ADMIN or DC_OPS role to view hardware reports.
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
          <h1 className="text-2xl font-bold text-slate-900">Hardware Report</h1>
          <p className="text-slate-500 mt-1">Hardware asset utilization and capacity report</p>
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
          title="Total Assets"
          value={reportData.analytics.totalCount}
          icon={HardDrive}
          description="Hardware assets"
        />
        <StatCard
          title="Total CPU Cores"
          value={reportData.analytics.totalCapacity.cpu}
          icon={Cpu}
          description="Across all assets"
        />
        <StatCard
          title="Total RAM"
          value={`${reportData.analytics.totalCapacity.ram} GB`}
          icon={Server}
          description="Across all assets"
        />
        <StatCard
          title="Total Storage"
          value={`${reportData.analytics.totalCapacity.storage} GB`}
          icon={Database}
          description="Across all assets"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Overloaded"
          value={reportData.analytics.overloadedCount}
          icon={HardDrive}
          description=">90% utilization"
        />
        <StatCard
          title="Underutilized"
          value={reportData.analytics.underutilizedCount}
          icon={HardDrive}
          description="<25% utilization"
        />
        <StatCard
          title="CPU Usage"
          value={`${reportData.analytics.totalCapacity.cpu > 0 ? Math.round((reportData.analytics.usedCapacity.cpu / reportData.analytics.totalCapacity.cpu) * 100) : 0}%`}
          icon={Cpu}
          description="Overall CPU utilization"
        />
        <StatCard
          title="RAM Usage"
          value={`${reportData.analytics.totalCapacity.ram > 0 ? Math.round((reportData.analytics.usedCapacity.ram / reportData.analytics.totalCapacity.ram) * 100) : 0}%`}
          icon={Server}
          description="Overall RAM utilization"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Assets by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <InventoryChart
              title=""
              type="bar"
              data={reportData.analytics.byType.map(d => ({ name: d.type, value: d.count }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Utilization Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <InventoryChart
              title=""
              type="pie"
              data={reportData.analytics.utilizationDistribution.map(d => ({ name: d.range, value: d.count }))}
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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search asset name..."
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filters.type} onValueChange={(v) => handleFilterChange("type", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="SERVER">Server</SelectItem>
                <SelectItem value="WORKSTATION">Workstation</SelectItem>
                <SelectItem value="LAPTOP">Laptop</SelectItem>
                <SelectItem value="STORAGE">Storage</SelectItem>
                <SelectItem value="NETWORK">Network</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.location} onValueChange={(v) => handleFilterChange("location", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {reportData.analytics.byLocation.map((loc) => (
                  <SelectItem key={loc.location} value={loc.location}>
                    {loc.location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.clusterId} onValueChange={(v) => handleFilterChange("clusterId", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Cluster" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clusters</SelectItem>
                <SelectItem value="none">Standalone (No Cluster)</SelectItem>
                {clusters.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
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
                <TableHead>Asset</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Cluster</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Total CPU</TableHead>
                <TableHead>Total RAM</TableHead>
                <TableHead>Allocated</TableHead>
                <TableHead>Utilization</TableHead>
                <TableHead>VMs</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-slate-500">
                    No assets found matching your criteria
                  </TableCell>
                </TableRow>
              ) : (
                reportData.data.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell className="font-medium">{asset.assetName}</TableCell>
                    <TableCell>{asset.type}</TableCell>
                    <TableCell>
                      {asset.clusterName ? (
                        <Badge variant="outline" className="font-bold text-[9px] px-2 py-0.5 border border-amber-300 text-amber-700 bg-amber-50">
                           {asset.clusterName}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">-</span>
                      )}
                    </TableCell>
                    <TableCell>{asset.location}</TableCell>
                    <TableCell>{asset.totalCpu}</TableCell>
                    <TableCell>{asset.totalRam} GB</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>CPU: {asset.allocatedCpu}</div>
                        <div>RAM: {asset.allocatedRam} GB</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${asset.utilizationPercent > 90 ? 'bg-red-500' : asset.utilizationPercent > 50 ? 'bg-blue-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(100, asset.utilizationPercent)}%` }}
                          />
                        </div>
                        <span className="text-sm">{asset.utilizationPercent}%</span>
                      </div>
                    </TableCell>
                    <TableCell>{asset.vmCount}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[asset.status] || "bg-gray-100"}>
                        {asset.status}
                      </Badge>
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
