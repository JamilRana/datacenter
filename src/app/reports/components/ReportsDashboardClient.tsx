// src/app/reports/components/ReportsDashboardClient.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import {
  Users,
  HardDrive,
  Activity,
  ListChecks,
  AlertCircle,
  ShieldAlert,
  BarChart4,
  Box,
  Server,
  FileCheck,
  ArrowUpRight,
  TrendingUp,
  RefreshCw,
  Calendar,
  Key,
  FolderKanban
} from "lucide-react";
import { UserAllocationTable } from "./tables/UserAllocationTable";
import { VmInventoryTable } from "./tables/VmInventoryTable";
import { CapacityTable } from "./tables/CapacityTable";
import { RequestsTable } from "./tables/RequestsTable";
import { RenewalsTable } from "./tables/RenewalsTable";
import { AuditTrailTable } from "./tables/AuditTrailTable";
import { UserVmModal } from "./UserVmModal";
import { VpnHorizonTable } from "./tables/VpnHorizonTable";
import { K8sNamespaceTable } from "@/app/reports/components/tables/K8sNamespaceTable";
import { LicenseReportTable } from "./tables/LicenseReportTable";
import { SystemWiseReportTable } from "./tables/SystemWiseReportTable";
import { HardwareReportTable } from "./tables/HardwareReportTable";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { formatDateRangeUnambiguous } from "@/lib/format-utils";
import { toast } from "sonner";

interface ReportsDashboardClientProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    id?: string | null;
    roles?: string[];
  };
  permissions: {
    canViewAllocation: boolean;
    canViewInventory: boolean;
    canViewCapacity: boolean;
    canViewRequests: boolean;
    canViewRenewals: boolean;
    canViewAudit: boolean;
    canViewLicenses?: boolean;
  };
}

const analyticsReports = [
  {
    href: "/reports/users",
    label: "User Resource Report",
    shortLabel: "User Resources",
    icon: Users,
    badge: "Resource Ownership",
    description: "Inspect systems, VMs, namespaces & vCPU per user with drilldown export"
  },
  {
    href: "/reports/vm",
    label: "VM Lifecycle Report",
    shortLabel: "VM Analytics",
    icon: Server,
    badge: "Trends & Status",
    description: "Provisioning trends, status distributions and system breakdowns"
  },
  {
    href: "/reports/approvals",
    label: "Approval SLA Report",
    shortLabel: "Approval SLA",
    icon: FileCheck,
    badge: "Workflow SLA",
    description: "Approval duration metrics, multi-level turnaround times and bottlenecks"
  },
  {
    href: "/reports/hardware",
    label: "Hardware & Hosts Report",
    shortLabel: "Hardware Hosts",
    icon: HardDrive,
    badge: "Cluster Compute",
    description: "Cluster hosts, physical core allocation and datacenter footprints"
  },
];

export function ReportsDashboardClient({ user, permissions }: ReportsDashboardClientProps) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const tabs = [
    { id: "allocation", label: "User Allocation", icon: Users, show: permissions.canViewAllocation },
    { id: "systems", label: "System-wise Report", icon: FolderKanban, show: true },
    { id: "inventory", label: "VM Inventory", icon: HardDrive, show: permissions.canViewInventory },
    { id: "k8snamespaces", label: "K8s Namespaces", icon: Box, show: true },
    { id: "capacity", label: "Cluster Capacity", icon: Activity, show: permissions.canViewCapacity },
    { id: "hardware", label: "Hardware Assets", icon: Server, show: permissions.canViewCapacity },
    { id: "requests", label: "Requests", icon: ListChecks, show: permissions.canViewRequests },
    { id: "vpnhorizon", label: "VPN & Horizon Access", icon: ShieldAlert, show: true },
    { id: "licenses", label: "Software Licenses", icon: Key, show: permissions.canViewLicenses ?? true },
    { id: "renewals", label: "Renewals", icon: AlertCircle, show: permissions.canViewRenewals },
    { id: "audit", label: "Audit Trail", icon: ShieldAlert, show: permissions.canViewAudit },
  ].filter(tab => tab.show);

  const initialTab = tabParam && tabs.some(t => t.id === tabParam) ? tabParam : "allocation";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [modalUserId, setModalUserId] = useState<string | null>(null);
  const [modalUserName, setModalUserName] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 30D is rolling, ending today
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { from, to };
  });
  const [datePreset, setDatePreset] = useState("30D");
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Compute scope label based on user's authorized role
  const userScope = useMemo(() => {
    const roles = user?.roles || [];
    const isAdmin = roles.some(r => ["ADMIN", "DCOPS"].includes(r.toUpperCase()));
    const isApprover = roles.some(r => r.toUpperCase().startsWith("APPROVER"));
    if (isAdmin) return "Datacenter-wide (all tenants)";
    if (isApprover) return "Within your review scope";
    return "Your allocated tenant resources";
  }, [user]);

  useEffect(() => {
    if (tabParam && tabs.some(t => t.id === tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", val);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const handleDatePreset = (preset: string) => {
    const now = new Date();
    let from: Date;

    switch (preset) {
      case "Today": {
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        from = today;
        break;
      }
      case "7D":
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30D":
        // 30D is rolling, ending today
        from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "6M":
        from = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      default:
        from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    setDatePreset(preset);
    setDateRange({ from, to: now });
  };

  const handleRefresh = () => {
    setLastUpdated(new Date());
    setRefreshKey(prev => prev + 1);
    toast.info("Refreshed reporting data");
  };

  const handleUserClick = (id: string, name: string) => {
    setModalUserId(id);
    setModalUserName(name);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-200 flex-shrink-0">
              <BarChart4 size={24} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Resource & Allocation Reports</h1>
              <div className="flex flex-wrap items-center gap-2 text-slate-600 mt-0.5">
                <span className="text-xs md:text-sm font-medium">{format(new Date(), "EEEE, MMMM dd, yyyy")}</span>
                <span className="h-1 w-1 rounded-full bg-slate-300"></span>
                <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border-none px-2 py-0 text-[11px] font-bold uppercase">
                  {user?.roles?.[0] || "User"} Scope
                </Badge>
                <span className="h-1 w-1 rounded-full bg-slate-300"></span>
                <span className="text-xs text-slate-500 font-medium" title={userScope}>{userScope}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Global Date Preset & Range Controls */}
        <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-50 border border-slate-200 rounded-xl shadow-inner w-full xl:w-auto">
          {/* Unambiguous Active Date Range Label */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50/80 border border-indigo-200/80 rounded-lg text-xs font-bold text-indigo-800 shadow-xs">
            <Calendar size={13} className="text-indigo-600" />
            <span>{formatDateRangeUnambiguous(dateRange.from, dateRange.to)}</span>
          </div>

          {/* Presets */}
          <div className="flex bg-white rounded-lg p-0.5 border border-slate-200/60 shadow-sm">
            {['Today', '7D', '30D', '6M'].map((period) => (
              <button
                key={period}
                onClick={() => handleDatePreset(period)}
                aria-pressed={datePreset === period}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${datePreset === period ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {period}
              </button>
            ))}
          </div>

          <div className="h-6 w-[1px] bg-slate-200 hidden sm:block"></div>

          {/* Custom Date Pickers */}
          <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-200/60 shadow-sm">
            <input
              type="date"
              aria-label="Start date"
              className="text-xs bg-transparent border-none focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 text-slate-700 font-medium rounded"
              value={format(dateRange.from, "yyyy-MM-dd")}
              onChange={(e) => {
                setDatePreset("Custom");
                setDateRange({
                  from: new Date(e.target.value),
                  to: dateRange.to
                });
              }}
            />
            <span className="text-xs text-slate-400 font-semibold">to</span>
            <input
              type="date"
              aria-label="End date"
              className="text-xs bg-transparent border-none focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 text-slate-700 font-medium rounded"
              value={format(dateRange.to, "yyyy-MM-dd")}
              onChange={(e) => {
                setDatePreset("Custom");
                setDateRange({
                  from: dateRange.from,
                  to: new Date(e.target.value)
                });
              }}
            />
          </div>

          <div className="h-6 w-[1px] bg-slate-200 hidden sm:block"></div>

          {/* Refresh & Last Updated Timestamp */}
          <div className="flex items-center gap-1.5 pl-1">
            <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
              Updated: <span className="font-bold text-slate-700">{format(lastUpdated, "HH:mm:ss")}</span>
            </span>
            <button
              onClick={handleRefresh}
              aria-label="Refresh active report"
              title="Refresh report data"
              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-white border border-transparent hover:border-slate-200 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Analytics Reports Quick Jump Cards 
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {analyticsReports.map((report) => (
          <Link
            key={report.href}
            href={report.href}
            className="group relative bg-white hover:bg-gradient-to-br hover:from-white hover:to-indigo-50/40 p-4 rounded-xl border border-slate-200 hover:border-indigo-300 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-indigo-50 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white flex items-center justify-center transition-colors shadow-sm">
                  <report.icon size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    {report.label}
                  </h3>
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-none px-1.5 py-0 text-[10px] font-semibold">
                    {report.badge}
                  </Badge>
                </div>
              </div>
              <div className="h-6 w-6 rounded-md bg-slate-50 group-hover:bg-indigo-100 text-slate-400 group-hover:text-indigo-600 flex items-center justify-center transition-all">
                <ArrowUpRight size={14} />
              </div>
            </div>
            <p className="text-xs text-slate-600 mt-2.5 line-clamp-1 group-hover:text-slate-700" title={report.description}>
              {report.description}
            </p>
          </Link>
        ))}
      </div>
      */}

      {/* Main Content Area with Single Unified Navigation Bar */}
      <Tabs value={activeTab} className="w-full" onValueChange={handleTabChange}>
        <div className="sticky top-0 z-40 bg-slate-50/95 backdrop-blur-md pt-2 pb-3">
          <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-2">
            {/* Operational Tabs Trigger List */}
            <TabsList className="h-auto p-1 bg-slate-100/80 rounded-xl border-none gap-1 w-full xl:w-auto scrollbar-hide overflow-x-auto justify-start flex-nowrap" role="tablist">
              {tabs.map(tab => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className="rounded-lg px-3.5 py-2 gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm font-bold text-xs md:text-sm transition-all whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                >
                  <tab.icon size={15} />
                  <span>{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>


          </div>
        </div>

        <div className="mt-4 animate-in fade-in slide-in-from-bottom-3 duration-300">
          <TabsContent value="allocation" className="m-0 focus-visible:outline-none">
            <UserAllocationTable
              onUserClick={handleUserClick}
              dateRange={dateRange}
              refreshKey={refreshKey}
              userScope={userScope}
            />
          </TabsContent>

          <TabsContent value="inventory" className="m-0 focus-visible:outline-none">
            <VmInventoryTable
              dateRange={dateRange}
              refreshKey={refreshKey}
            />
          </TabsContent>

          <TabsContent value="k8snamespaces" className="m-0 focus-visible:outline-none">
            <K8sNamespaceTable
              dateRange={dateRange}
              refreshKey={refreshKey}
            />
          </TabsContent>

          <TabsContent value="systems" className="m-0 focus-visible:outline-none">
            <SystemWiseReportTable
              dateRange={dateRange}
              refreshKey={refreshKey}
            />
          </TabsContent>

          <TabsContent value="capacity" className="m-0 focus-visible:outline-none">
            <CapacityTable
              dateRange={dateRange}
              refreshKey={refreshKey}
            />
          </TabsContent>

          <TabsContent value="hardware" className="m-0 focus-visible:outline-none">
            <HardwareReportTable
              dateRange={dateRange}
              refreshKey={refreshKey}
            />
          </TabsContent>

          <TabsContent value="requests" className="m-0 focus-visible:outline-none">
            <RequestsTable
              dateRange={dateRange}
              refreshKey={refreshKey}
            />
          </TabsContent>

          <TabsContent value="vpnhorizon" className="m-0 focus-visible:outline-none">
            <VpnHorizonTable
              dateRange={dateRange}
              refreshKey={refreshKey}
            />
          </TabsContent>

          <TabsContent value="licenses" className="m-0 focus-visible:outline-none">
            <LicenseReportTable
              dateRange={dateRange}
              refreshKey={refreshKey}
            />
          </TabsContent>

          <TabsContent value="renewals" className="m-0 focus-visible:outline-none">
            <RenewalsTable
              dateRange={dateRange}
            />
          </TabsContent>

          <TabsContent value="audit" className="m-0 focus-visible:outline-none">
            <AuditTrailTable
              dateRange={dateRange}
            />
          </TabsContent>
        </div>
      </Tabs>

      {/* Shared Modals */}
      <UserVmModal
        userId={modalUserId}
        userName={modalUserName}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}