// src/app/dashboard/vms/page.tsx
"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  getUserVmStats, 
  getSystemSummary, 
  getSubdomainSummary, 
  getUserVms,
  UserVmStats,
  SystemSummary,
  SubdomainSummary,
  UserVmData,
  VmFilters
} from "@/app/actions/vm-management-actions";
import { 
  Server, 
  Globe, 
  Shield, 
  Database, 
  Cpu, 
  Loader2, 
  ChevronRight,
  Search,
  Monitor
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/Pagination";
import { format } from "date-fns";

const STORAGE_KEY = "dashboard_vms_state";

function getStoredState() {
  if (typeof window === "undefined") return { page: 1, filters: { environment: "ALL", systemName: "", search: "" } };
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { page: 1, filters: { environment: "ALL", systemName: "", search: "" } };
}

function saveState(page: number, filters: VmFilters) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ page, filters }));
  } catch {}
}

export default function DashboardVmsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<VmFilters>({ environment: "ALL", systemName: "", search: "" });
  const [isInitialized, setIsInitialized] = useState(false);
  
  const [stats, setStats] = useState<UserVmStats>({
    totalActive: 0,
    production: 0,
    development: 0,
    staging: 0,
    withPublicIp: 0
  });
  const [systemSummary, setSystemSummary] = useState<SystemSummary[]>([]);
  const [subdomainSummary, setSubdomainSummary] = useState<SubdomainSummary[]>([]);
  const [vmsData, setVmsData] = useState<{
    vms: UserVmData[];
    total: number;
    totalPages: number;
  } | null>(null);

  const PAGE_SIZE = 10;

  useEffect(() => {
    if (isInitialized) return;
    const stored = getStoredState();
    setCurrentPage(stored.page);
    setFilters(stored.filters);
    setIsInitialized(true);
  }, [isInitialized]);

  useEffect(() => {
    if (status === "loading" || !session || !isInitialized) return;
    
    const fetchStats = async () => {
      try {
        const [statsData, systems, subdomains] = await Promise.all([
          getUserVmStats(),
          getSystemSummary(),
          getSubdomainSummary()
        ]);
        setStats(statsData);
        setSystemSummary(systems);
        setSubdomainSummary(subdomains);
      } catch (err) {
        console.error("Failed to fetch stats", err);
      }
    };
    fetchStats();
  }, [status, session, isInitialized]);

  useEffect(() => {
    if (status === "loading" || !session || !isInitialized) return;
    
    const fetchVms = async () => {
      setListLoading(true);
      try {
        const filterParams: VmFilters = {};
        if (filters.environment && filters.environment !== "ALL") {
          filterParams.environment = filters.environment;
        }
        if (filters.systemName) {
          filterParams.systemName = filters.systemName;
        }
        if (filters.search) {
          filterParams.search = filters.search;
        }
        
        const data = await getUserVms(filterParams, currentPage, PAGE_SIZE);
        setVmsData(data);
      } catch (err) {
        console.error("Failed to fetch VMs", err);
      } finally {
        setListLoading(false);
        setLoading(false);
      }
    };
    fetchVms();
  }, [status, session, currentPage, filters, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    saveState(currentPage, filters);
  }, [currentPage, filters, isInitialized]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  if (status === "loading" || loading) {
    return (
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
        <div className="h-10 w-48 bg-slate-200 animate-pulse rounded" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-100 animate-pulse rounded-xl" />
          ))}
        </div>
        <div className="h-96 bg-slate-100 animate-pulse rounded-xl" />
      </div>
    );
  }

  if (!session) {
    router.push("/auth");
    return null;
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      {/* Breadcrumbs */}
      <div className="flex items-center text-sm text-slate-500">
        <Link href="/" className="hover:text-slate-900">Home</Link>
        <ChevronRight className="h-4 w-4 mx-2" />
        <span className="text-slate-900 font-medium">VM Dashboard</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">VM Dashboard</h1>
        <p className="text-slate-500 mt-1">
          Overview of your virtual machine instances
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase">Total Active</CardTitle>
            <Server className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalActive}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase">Production</CardTitle>
            <Shield className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.production}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase">Development</CardTitle>
            <Database className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.development}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase">Staging</CardTitle>
            <Cpu className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.staging}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase">Public IP</CardTitle>
            <Globe className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.withPublicIp}</div>
          </CardContent>
        </Card>
      </div>

      {/* System & Subdomain Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* System Summary */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">System Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {systemSummary.length === 0 ? (
              <p className="text-sm text-slate-500">No systems found</p>
            ) : (
              <div className="space-y-3">
                {systemSummary.slice(0, 5).map((sys) => (
                  <div key={sys.systemName} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{sys.systemName}</div>
                      <div className="text-xs text-slate-500">
                        {sys.totalVms} VMs
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {Object.entries(sys.environments).map(([env, count]) => (
                        <Badge key={env} variant="outline" className="text-xs">
                          {env}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subdomain Summary */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Subdomain Usage</CardTitle>
          </CardHeader>
          <CardContent>
            {subdomainSummary.length === 0 ? (
              <p className="text-sm text-slate-500">No subdomains found</p>
            ) : (
              <div className="space-y-3">
                {subdomainSummary.slice(0, 5).map((sub) => (
                  <div key={sub.subdomain} className="flex items-center justify-between">
                    <div className="font-mono text-sm text-slate-600">{sub.subdomain}</div>
                    <Badge variant="outline">{sub.vmCount} VMs</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search hostname or IP..."
              className="pl-9 bg-slate-50 border-slate-200"
              value={filters.search || ""}
              onChange={(e) => handleFilterChange("search", e.target.value)}
            />
          </div>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search system name..."
              className="pl-9 bg-slate-50 border-slate-200"
              value={filters.systemName || ""}
              onChange={(e) => handleFilterChange("systemName", e.target.value)}
            />
          </div>
          <div className="w-full md:w-48">
            <Select
              value={filters.environment || "ALL"}
              onValueChange={(v) => handleFilterChange("environment", v)}
            >
              <SelectTrigger className="bg-slate-50 border-slate-200">
                <SelectValue placeholder="Environment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Environments</SelectItem>
                <SelectItem value="PRODUCTION">Production</SelectItem>
                <SelectItem value="DEVELOPMENT">Development</SelectItem>
                <SelectItem value="STAGING">Staging</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* VM Table */}
      {listLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : vmsData?.vms.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-dashed border-slate-300">
          <Monitor className="w-10 h-10 text-slate-400 mb-2" />
          <p className="text-slate-600 font-medium">No VMs found</p>
          <p className="text-slate-400 text-sm mt-1">Your VMs will appear here once provisioned.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Hostname</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">System Name</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Environment</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Private IP</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Public IP</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">vCPU</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">RAM</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Storage</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Status</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Provisioned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {vmsData?.vms.map((vm) => (
                    <tr key={vm.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4">
                        <Link 
                          href={`my-vms/${vm.id}`}
                          className="font-medium text-slate-900 hover:text-indigo-600"
                        >
                          {vm.hostname || "—"}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {vm.systemName || "—"}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          vm.environment === "PRODUCTION" 
                            ? "bg-amber-100 text-amber-800" 
                            : vm.environment === "DEVELOPMENT"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-green-100 text-green-800"
                        }`}>
                          {vm.environment || "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-slate-600">
                        {vm.ipAddress || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-slate-600">
                        {vm.publicIpAddress || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {vm.vcpu ?? "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {vm.ramGb ?? "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {vm.storageGb ?? "—"}
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant={vm.status === "ACTIVE" ? "default" : "secondary"}
                          className="capitalize"
                        >
                          {vm.status.toLowerCase()}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {vm.provisionedAt
                          ? format(new Date(vm.provisionedAt), "MMM dd, yyyy")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {vmsData && vmsData.totalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <Pagination
                currentPage={currentPage}
                totalPages={vmsData.totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
