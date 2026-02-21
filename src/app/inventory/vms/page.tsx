"use client";

import { redirect } from "next/navigation";
import { getInventoryMetrics, InventoryMetrics } from "@/app/actions/inventory-actions";
import { VmListClient } from "@/app/inventory/components/VmListClient";
import { CapacityDashboardClient } from "@/app/inventory/components/CapacityDashboardClient";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useSession } from "next-auth/react";
import { fetchAllVms } from "@/app/actions/vm-actions"; // ✅ Use serialized fetch
import { useEffect, useState } from "react";
import { SerializedVmInstance } from "@/types/vm"; // ✅ Correct type

export default function VmInventoryPage() {
  const { data: session } = useSession();
  const [metrics, setMetrics] = useState<InventoryMetrics | null>(null);
  const [vms, setVms] = useState<SerializedVmInstance[]>([]); // ✅ Correct type

  if (!session?.user) redirect("/auth");

  const userRoles = session.user.roles;
  const isManagement = userRoles.some(r => 
    ["ADMIN", "DCOPS", "APPROVER_L1", "APPROVER_L2", "APPROVER_L3"].includes(r)
  );

  useEffect(() => {
    const fetchVmLists = async () => {
      try {
        const [metricsRes, vmsRes] = await Promise.all([
          getInventoryMetrics(),
          fetchAllVms() // ✅ Already handles auth + serialization
        ]);
        setMetrics(metricsRes);
        setVms(vmsRes);
      } catch (error) {
        console.error("Failed to fetch VM lists:", error);
      }
    };
    
    fetchVmLists();
  }, [session]);

  return (
    <div className="p-6 md:p-10 space-y-8 bg-slate-50/20 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">VM Inventory</h1>
          <p className="text-slate-500 mt-1">
            {!isManagement 
              ? "Authoritative list of virtual machines provisioned under your ownership."
              : "System-wide inventory of all provisioned virtual instances across the cluster."}
          </p>
        </div>
      </div>

      {metrics && (
        <Card className="border-none shadow-sm ring-1 ring-slate-200 overflow-hidden">
          <CardHeader className="bg-white border-b border-slate-50 pb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <div>
                <CardTitle className="text-base">Resource Capacity Overview</CardTitle>
                <CardDescription>Live metrics of physical vs virtual resource utilization.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-8">
            <CapacityDashboardClient metrics={metrics} />
          </CardContent>
        </Card>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <VmListClient initialVms={vms} /> {/* ✅ Directly pass serialized data */}
      </div>
    </div>
  );
}