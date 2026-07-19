// src/app/my-vms/page.tsx
"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { getUserVms, getUserVmStats, getSystemSummary, type VmFilters, type UserVmStats, type UserVmData, type SystemSummary } from "@/app/actions/vm-management-actions";
import { K8sDashboard } from "./components/K8sDashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Server, 
  Terminal, 
  Globe, 
  Search, 
  Loader2, 
  HardDrive, 
  Cpu, 
  Layers, 
  CheckCircle2, 
  AlertCircle,
  Activity,
  History,
  ChevronRight,
  ExternalLink
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pagination } from "@/components/Pagination";

const STORAGE_KEY = "vm_dashboard_state";

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
  const [activeTab, setActiveTab] = useState<"vms" | "k8s">("vms");
  
  const [listLoading, setListLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<VmFilters>({ environment: "ALL", systemName: "", search: "" });
  const [isInitialized, setIsInitialized] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  const [stats, setStats] = useState<UserVmStats>({
    totalActive: 0,
    production: 0,
    development: 0,
    staging: 0,
    withPublicIp: 0
  });
  const [systemSummary, setSystemSummary] = useState<SystemSummary[]>([]);
  const [vmsData, setVmsData] = useState<{
    vms: UserVmData[];
    total: number;
    totalPages: number;
  } | null>(null);

  const PAGE_SIZE = 10;

  // Initialize from sessionStorage
  useEffect(() => {
    if (isInitialized) return;
    const stored = getStoredState();
    setCurrentPage(stored.page);
    setFilters(stored.filters);
    setIsInitialized(true);
  }, [isInitialized]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.search || "");
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    if (status === "loading" || !session || !isInitialized) return;
    
    const fetchStats = async () => {
      try {
        const [statsData, systems] = await Promise.all([
          getUserVmStats(),
          getSystemSummary()
        ]);
        setStats(statsData);
        setSystemSummary(systems);
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
        if (debouncedSearch) {
          filterParams.search = debouncedSearch;
        }
        
        const data = await getUserVms(filterParams, currentPage, PAGE_SIZE);
        setVmsData(data);
      } catch (err) {
        console.error("Failed to fetch VMs", err);
      } finally {
        setListLoading(false);
      }
    };

    fetchVms();
  }, [status, session, currentPage, filters.environment, filters.systemName, debouncedSearch, isInitialized]);

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

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
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
        <span className="text-slate-900 font-medium">My VMs</span>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Virtual Machines</h1>
          <p className="text-slate-500 mt-1">
            Monitor and manage your provisioned server infrastructure
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href="/requests">
              <History className="h-4 w-4 mr-2" /> Request History
            </Link>
          </Button>
          <Button size="sm" asChild className="bg-indigo-600 hover:bg-indigo-700">
            <Link href="/requests/new">
              <Plus className="h-4 w-4 mr-2" /> New VM
            </Link>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6 mb-2">
        <button
          onClick={() => setActiveTab("vms")}
          className={`pb-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === "vms"
              ? "border-indigo-650 text-indigo-600 font-extrabold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          Virtual Machines
        </button>
        <button
          onClick={() => setActiveTab("k8s")}
          className={`pb-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === "k8s"
              ? "border-indigo-650 text-indigo-600 font-extrabold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          Kubernetes Namespaces
        </button>
      </div>

      {activeTab === "vms" ? (
        <>
          {/* Stats Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-none shadow-sm bg-white overflow-hidden group">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                <Server className="h-5 w-5" />
              </div>
              <Badge className="bg-green-100 text-green-700 border-none">Active</Badge>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold text-slate-900">{stats.totalActive}</div>
              <div className="text-xs font-semibold text-slate-500 uppercase mt-1">Total Servers</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold text-slate-900">{stats.production}</div>
              <div className="text-xs font-semibold text-slate-500 uppercase mt-1 text-emerald-600">Production</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <Activity className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold text-slate-900">{stats.staging}</div>
              <div className="text-xs font-semibold text-slate-500 uppercase mt-1 text-blue-600">Staging</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                <Terminal className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold text-slate-900">{stats.development}</div>
              <div className="text-xs font-semibold text-slate-500 uppercase mt-1 text-amber-600">Development</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                <Globe className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold text-slate-900">{stats.withPublicIp}</div>
              <div className="text-xs font-semibold text-slate-500 uppercase mt-1 text-purple-600">Public Access</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & View Actions */}
      <div className="flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 w-full space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by hostname, IP address or specs..."
                className="pl-10 bg-white border-slate-200"
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
              />
            </div>
            <div className="w-full md:w-48">
              <Select
                value={filters.environment}
                onValueChange={(v) => handleFilterChange("environment", v)}
              >
                <SelectTrigger className="bg-white border-slate-200">
                  <SelectValue placeholder="Environment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Environments</SelectItem>
                  <SelectItem value="PRODUCTION">Production</SelectItem>
                  <SelectItem value="STAGING">Staging</SelectItem>
                  <SelectItem value="DEVELOPMENT">Development</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-64">
<Select
  value={filters.systemName}
  onValueChange={(v) => handleFilterChange("systemName", v)}
>
  <SelectTrigger className="bg-white border-slate-200">
    <SelectValue placeholder="System/Project" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="ALL">All Systems</SelectItem>
    {systemSummary.map((sys) => (
      <SelectItem
        key={sys.systemName}
        value={sys.systemName}
      >
        {sys.systemName} ({sys.totalVms})
      </SelectItem>
    ))}
  </SelectContent>
</Select>
            </div>
          </div>
        </div>
      </div>

      {/* VM List Table */}
      <Card className="border-none shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Server Info</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Resources</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Environment</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {listLoading && !vmsData ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="px-6 py-8">
                        <div className="h-10 bg-slate-50 animate-pulse rounded" />
                      </td>
                    </tr>
                  ))
                ) : !vmsData || vmsData.vms.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center">
                        <div className="p-4 bg-slate-50 rounded-full mb-4">
                          <AlertCircle className="h-8 w-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900">No servers found</h3>
                        <p className="text-slate-500 max-w-xs mx-auto mt-1">
                          We couldn&apos;t find any provisioned VMs matching your criteria.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  vmsData.vms.map((vm) => (
                    <tr key={vm.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-2">
                            {vm.hostname}
                            {vm.subdomain && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1 font-normal text-slate-400 border-slate-200">
                                {vm.subdomain}
                              </Badge>
                            )}
                          </span>
                          <span className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <Layers className="h-3 w-3" /> {vm.ipAddress || "No assigned IP"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-none font-medium text-[11px] gap-1 px-2">
                            <Cpu className="h-3 w-3" /> {vm.vcpu} vCPU
                          </Badge>
                          <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-none font-medium text-[11px] gap-1 px-2">
                            <HardDrive className="h-3 w-3" /> {vm.ramGb}GB RAM
                          </Badge>
                          <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-none font-medium text-[11px] gap-1 px-2">
                            <HardDrive className="h-3 w-3" /> {vm.storageGb}GB Disk
                          </Badge>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={`
                          ${vm.environment === 'PRODUCTION' ? 'bg-emerald-100 text-emerald-700' : 
                            vm.environment === 'STAGING' ? 'bg-blue-100 text-blue-700' : 
                            'bg-amber-100 text-amber-700'} 
                          border-none text-[11px] font-bold uppercase tracking-wider px-2
                        `}>
                          {vm.environment}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${vm.status === 'ACTIVE' ? 'bg-green-500' : 'bg-slate-300'} shadow-[0_0_8px_rgba(34,197,94,0.4)]`} />
                          <span className="text-sm font-medium text-slate-700 capitalize">{vm.status.toLowerCase()}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" asChild className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-semibold px-3">
                            <Link href={`/my-vms/${vm.id}`}>Details</Link>
                          </Button>
                          {vm.ipAddress && (
                            <Button variant="ghost" size="icon" title="Open Subdomain" asChild className="h-8 w-8 text-slate-400 hover:text-indigo-600">
                               <a href={vm.subdomain ? `https://${vm.subdomain}` : '#'} target="_blank" rel="noopener noreferrer">
                                 <ExternalLink className="h-4 w-4" />
                               </a>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

          {/* Pagination */}
          {vmsData && vmsData.totalPages > 1 && (
            <div className="mt-8 flex justify-center">
              <Pagination
                currentPage={currentPage}
                totalPages={vmsData.totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </>
      ) : (
        <K8sDashboard />
      )}
    </div>
  );
}

// Subcomponents / local Types if needed
function Plus({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
  );
}
