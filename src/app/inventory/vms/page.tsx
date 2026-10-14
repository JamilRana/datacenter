// src/app/inventory/vms/page.tsx
"use client";

import React from "react";
import { getInventoryMetrics, InventoryMetrics } from "@/app/actions/inventory-actions";
import { VmListClient } from "@/app/inventory/components/VmListClient";
import { CapacityDashboardClient } from "@/app/inventory/components/CapacityDashboardClient";
import { BarChart3, ChevronLeft, Server, HardDrive, Activity, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useSession } from "next-auth/react";
import { fetchAllVms, getVmInventorySummary, VmInventorySummary } from "@/app/actions/vm-actions";
import { useEffect, useState } from "react";
import { SerializedVmInstance } from "@/types/vm";
import { ManualVmModal } from "@/app/inventory/components/ManualVmModal";
import Link from "next/link";
import { exportToCsv } from "@/lib/export-utils";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { StatCard } from "@/components/analytics/StatCard";
import { RecentActivity } from "@/components/analytics/RecentActivity";
import { fetchVmAnalytics } from "@/app/actions/analytics-actions";
import { useSearchParams } from "next/navigation";
import { SystemFleetSummaryTable } from "@/app/inventory/components/SystemFleetSummaryTable";
import { getSystemFleetSummaries, SystemFleetSummaryRow } from "@/app/actions/vm-management-actions";

export default function VmInventoryPage() {
  const { data: session, status } = useSession();
  const [metrics, setMetrics] = useState<InventoryMetrics | null>(null);
  const [summary, setSummary] = useState<VmInventorySummary | null>(null);
  const [vms, setVms] = useState<SerializedVmInstance[]>([]);
  const [totalVms, setTotalVms] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [vmAnalytics, setVmAnalytics] = useState<Awaited<ReturnType<typeof fetchVmAnalytics>> | null>(null);
  const [fleetSummaries, setFleetSummaries] = useState<SystemFleetSummaryRow[]>([]);

  const queryParams = useSearchParams();
  const page = queryParams.get("page") ? parseInt(queryParams.get("page")!, 10) : 1;
  const pageSize = queryParams.get("pageSize") ? parseInt(queryParams.get("pageSize")!, 10) : 20;
  const statusFilter = queryParams.get("status") || undefined;
  const searchParam = queryParams.get("search") || undefined;

  useEffect(() => {
    if (status === "loading" || !session?.user?.id) return;
    
    const fetchVmLists = async () => {
      setLoading(true);
      try {
        const [metricsRes, vmsData, analytics, summaryRes, fleetsRes] = await Promise.all([
          getInventoryMetrics(),
          fetchAllVms(page, pageSize, statusFilter, searchParam),
          fetchVmAnalytics(),
          getVmInventorySummary(),
          getSystemFleetSummaries()
        ]);
        setMetrics(metricsRes);
        setVms(vmsData.vms);
        setTotalVms(vmsData.total);
        setVmAnalytics(analytics);
        setSummary(summaryRes);
        setFleetSummaries(fleetsRes);
      } catch (error) {
        console.error("Failed to fetch VM lists:", error);
      } finally {
        setLoading(false);
        setIsInitialLoad(false);
      }
    };
    
    fetchVmLists();
  }, [session?.user?.id, status, page, pageSize, statusFilter, searchParam]);

  if (status === "loading" || (loading && isInitialLoad)) {
    return (
      <div className="p-6 md:p-10 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-64"></div>
          <div className="h-64 bg-slate-200 rounded-xl"></div>
          <div className="h-96 bg-slate-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const userRoles = session.user.roles || [];
  const isManagement = userRoles.some(r => 
    ["ADMIN", "DC_OPS", "APPROVER_L1", "APPROVER_L2", "APPROVER_L3", "APPROVER_L4"].includes(r.toUpperCase())
  );
  const canAddManually = userRoles.some(r => 
    ["ADMIN", "DC_OPS"].includes(r.toUpperCase())
  );

  const handleExport = async () => {
    try {
      setIsExporting(true);
      toast.info("Preparing export for all matching VMs...");
      const fullData = await fetchAllVms(1, 0, statusFilter, searchParam, true);
      const exportData = fullData.vms.map(vm => ({
        Hostname: vm.hostname || "",
        System: vm.systemName || vm.request?.systemName || "Standalone / Unassigned",
        IP_Address: vm.ipAddress || "",
        Public_IP: vm.publicIpAddress || "",
        Status: vm.status,
        Owner: vm.owner?.name || "",
        Owner_Email: vm.owner?.email || "",
        vCPU: vm.currentSpec?.vcpu || "",
        RAM_GB: vm.currentSpec?.ramGb || "",
        Storage_GB: vm.currentSpec?.storageGb || "",
        OS: vm.currentSpec?.osName || "",
        OS_Version: vm.currentSpec?.osVersion || "",
        Subdomain: vm.subdomain || "",
        Provisioned_At: vm.provisionedAt ? new Date(vm.provisionedAt).toLocaleDateString() : "",
      }));
      exportToCsv(`vm-instances-${new Date().toISOString().split('T')[0]}.csv`, exportData);
      toast.success(`Exported ${exportData.length} VMs successfully.`);
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to export VMs");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/inventory" className="hover:text-indigo-600 flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" />
          Inventory Hub 
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">VM Instances</span>
      </nav>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">VM Instances</h1>
          <p className="text-slate-500 mt-1">
            {!isManagement 
              ? "Virtual machines provisioned under your ownership."
              : "All provisioned virtual instances across the cluster."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={isExporting} onClick={handleExport} className="gap-2">
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export
          </Button>
          {canAddManually && (
            <ManualVmModal actorId={session.user.id} />
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard 
          title="Active VMs" 
          value={summary ? summary.activeVms : vms.filter(v => v.status === "ACTIVE").length}
          icon={Server}
          color="indigo"
        />
        <StatsCard 
          title="Total vCPU" 
          value={summary ? summary.totalVcpu : vms.reduce((acc, v) => acc + (v.currentSpec?.vcpu || 0), 0)}
          icon={BarChart3}
          color="blue"
          suffix=" cores"
        />
        <StatsCard 
          title="Total RAM" 
          value={summary ? summary.totalRamGb : vms.reduce((acc, v) => acc + (v.currentSpec?.ramGb || 0), 0)}
          icon={Server}
          color="emerald"
          suffix=" GB"
        />
        <StatsCard 
          title="Retired" 
          value={summary ? summary.retiredVms : vms.filter(v => v.status === "RETIRED").length}
          icon={Server}
          color="slate"
        />
      </div>

      {/* Analytics Dashboard - Only for Admin/DCOPS */}
      {vmAnalytics && (
        <div className="space-y-6">
          {/* Analytics Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              title="Total VMs"
              value={vmAnalytics.summary.total}
              icon={Server}
              description="All VM instances"
            />
            <StatCard
              title="Active"
              value={vmAnalytics.summary.active}
              icon={Activity}
              description="Running VMs"
            />
            <StatCard
              title="Suspended"
              value={vmAnalytics.summary.suspended}
              icon={Zap}
              description="Suspended VMs"
            />
            <StatCard
              title="Retired"
              value={vmAnalytics.summary.retired}
              icon={HardDrive}
              description="Decommissioned VMs"
            />
          </div>
        </div>
      )}

      {/* Two-Column Layout: Recent VM Activity and Resource Capacity Overview */}
      {(metrics || vmAnalytics) && (
        <div className={`grid grid-cols-1 ${metrics && vmAnalytics ? "lg:grid-cols-2" : ""} gap-6 items-stretch`}>
          {/* Recent VM Activity */}
          {vmAnalytics && (
            <RecentActivity
              title="Recent VM Activity"
              description="Latest provisioning and state changes"
              headerClassName="bg-slate-50 border-b"
              icon={Activity}
              maxItems={5}
              headerAction={
                isManagement ? (
                  <Button asChild variant="ghost" size="sm" className="h-7 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                    <Link href="/admin/audit-logs">View All</Link>
                  </Button>
                ) : undefined
              }
              className="border-slate-200 shadow-sm flex flex-col h-full"
              activities={(vmAnalytics.recentActivity || []).map(a => ({
                id: a.id,
                action: a.action,
                entityType: a.entityType,
                entityId: a.entityId,
                actorName: a.actorName,
                details: a.details,
                createdAt: a.createdAt,
              }))}
            />
          )}

          {/* Resource Capacity Overview */}
          {metrics && (
            <Card className="border-slate-200 shadow-sm flex flex-col h-full">
              <CardHeader className="bg-slate-50 border-b">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-indigo-600" />
                  <div>
                    <CardTitle className="text-base font-semibold text-slate-900">Resource Capacity Overview</CardTitle>
                    <CardDescription>Physical vs virtual resource utilization</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 flex-1 flex flex-col justify-between">
                <CapacityDashboardClient metrics={metrics} />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* System & Project Fleets Summary Table */}
      <SystemFleetSummaryTable fleets={fleetSummaries} />

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <VmListClient 
            initialVms={vms} 
            canEdit={isManagement} 
            total={totalVms}
            currentPage={page}
            pageSize={pageSize}
            isLoading={loading}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function StatsCard({ 
  title, 
  value, 
  icon: Icon, 
  color,
  suffix = ""
}: { 
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  suffix?: string;
}) {
  const colors: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-600",
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    slate: "bg-slate-100 text-slate-600",
  };

  return (
    <Card className="border-slate-200">
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className={`p-2.5 rounded-xl ${colors[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold text-slate-900">
              {value.toLocaleString()}{suffix}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
