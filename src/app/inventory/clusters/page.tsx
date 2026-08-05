// src/app/inventory/clusters/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ROLES } from "@/lib/roles";
import { fetchClusters } from "@/app/actions/cluster-actions";
import { ClusterListClient } from "../components/ClusterListClient";
import { ClusterModal } from "../components/ClusterModal";
import { ChevronLeft, Layers, Server } from "lucide-react";
import Link from "next/link";
import { StatCard } from "@/components/analytics/StatCard";

export default function ClustersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [clusters, setClusters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClusterData = async () => {
    setLoading(true);
    try {
      const data = await fetchClusters();
      setClusters(data);
    } catch (error) {
      console.error("Failed to fetch clusters:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/auth");
      return;
    }

    const userRoles = session.user.roles || [];
    const isAdminOrDcops = userRoles.some(r => 
      ["ADMIN", "DC_OPS"].includes(r.toUpperCase())
    );
    
    if (!isAdminOrDcops) {
      router.push("/inventory/vms");
      return;
    }

    fetchClusterData();
  }, [session, status, router]);

  if (status === "loading" || loading) {
    return (
      <div className="p-6 md:p-10 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-64"></div>
          <div className="h-96 bg-slate-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const canEdit = session.user.roles.includes(ROLES.ADMIN) || session.user.roles.includes(ROLES.DCOPS);
  const totalHosts = clusters.reduce((sum, c) => sum + (c._count?.hosts || 0), 0);

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/inventory" className="hover:text-indigo-600 flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" />
          Inventory Hub
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">Physical Clusters</span>
      </nav>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Physical Clusters</h1>
          <p className="text-slate-500 mt-1">
            Group physical server hosts into logical hypervisor clusters (cls01, cls02, cls03).
          </p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <ClusterModal mode="create" onSave={fetchClusterData} />
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard
          title="Total Clusters"
          value={clusters.length}
          icon={Layers}
          description="Configured VM host clusters"
        />
        <StatCard
          title="Grouped Host Servers"
          value={totalHosts}
          icon={Server}
          description="Physical hosts active in clusters"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <ClusterListClient 
          clusters={clusters} 
          canEdit={canEdit} 
          onRefresh={fetchClusterData}
        />
      </div>
    </div>
  );
}
