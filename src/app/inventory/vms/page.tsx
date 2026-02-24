// src/app/inventory/vms/page.tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { getInventoryMetrics, InventoryMetrics } from "@/app/actions/inventory-actions";
import { VmListClient } from "@/app/inventory/components/VmListClient";
import { CapacityDashboardClient } from "@/app/inventory/components/CapacityDashboardClient";
import { BarChart3, ChevronLeft, Server } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useSession } from "next-auth/react";
import { fetchAllVms } from "@/app/actions/vm-actions";
import { useEffect, useState } from "react";
import { SerializedVmInstance } from "@/types/vm";
import { ManualVmModal } from "@/app/inventory/components/ManualVmModal";
import { ROLES } from "@/lib/roles";
import Link from "next/link";

export default function VmInventoryPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [metrics, setMetrics] = useState<InventoryMetrics | null>(null);
  const [vms, setVms] = useState<SerializedVmInstance[]>([]);
  const [loading, setLoading] = useState(true);

  const page = searchParams.page ? parseInt(searchParams.page, 10) : 1;

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/auth");
      return;
    }

    const fetchVmLists = async () => {
      try {
        const [metricsRes, vmsData] = await Promise.all([
          getInventoryMetrics(),
          fetchAllVms(page)
        ]);
        setMetrics(metricsRes);
        setVms(vmsData.vms);
      } catch (error) {
        console.error("Failed to fetch VM lists:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchVmLists();
  }, [session, status, page, router]);

  if (status === "loading" || loading) {
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

  const userRoles = session.user.roles;
  const isManagement = userRoles.some(r => 
    ["ADMIN", ROLES.DCOPS, "APPROVER_L1", "APPROVER_L2", "APPROVER_L3"].includes(r)
  );
  
  const canAddManually = userRoles.includes("ADMIN") || userRoles.includes(ROLES.DCOPS);

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
          {canAddManually && (
            <ManualVmModal actorId={session.user.id} />
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard 
          title="Active VMs" 
          value={vms.filter(v => v.status === "ACTIVE").length}
          icon={Server}
          color="indigo"
        />
        <StatsCard 
          title="Total vCPU" 
          value={vms.reduce((acc, v) => acc + (v.currentSpec?.vcpu || 0), 0)}
          icon={BarChart3}
          color="blue"
          suffix=" cores"
        />
        <StatsCard 
          title="Total RAM" 
          value={vms.reduce((acc, v) => acc + (v.currentSpec?.ramGb || 0), 0)}
          icon={Server}
          color="emerald"
          suffix=" GB"
        />
        <StatsCard 
          title="Retired" 
          value={vms.filter(v => v.status === "RETIRED").length}
          icon={Server}
          color="slate"
        />
      </div>

      {metrics && isManagement && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50 border-b">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-600" />
              <div>
                <CardTitle className="text-base">Resource Capacity Overview</CardTitle>
                <CardDescription>Physical vs virtual resource utilization</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <CapacityDashboardClient metrics={metrics} />
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <VmListClient initialVms={vms} />
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
