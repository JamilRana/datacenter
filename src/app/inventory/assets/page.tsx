// src/app/inventory/assets/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { ROLES } from "@/lib/roles";
import { AssetListClient } from "../components/AssetListClient";
import { PhysicalAsset } from "@/types/inventory";
import { fetchAllAssets } from "@/app/actions/asset-actions";
import { AssetModal } from "../components/AssetModal";
import { ChevronLeft, Server, MapPin, HardDrive, Download } from "lucide-react";
import Link from "next/link";
import { exportToCsv } from "@/lib/export-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/analytics/StatCard";
import { InventoryChart } from "@/components/analytics/InventoryChart";
import { RecentActivity } from "@/components/analytics/RecentActivity";
import { fetchHardwareAnalytics } from "@/app/actions/analytics-actions";
import { HardwareAnalytics } from "@/lib/analytics/hardwareAnalytics";

export default function AssetsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1;

  const [assets, setAssets] = useState<PhysicalAsset[]>([]);
  const [totalAssets, setTotalAssets] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [hardwareAnalytics, setHardwareAnalytics] = useState<HardwareAnalytics | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/auth");
      return;
    }

    // REQUESTERS cannot view physical hardware assets
    const userRoles = session.user.roles || [];
    const isAdminOrDcops = userRoles.some(r => 
      ["ADMIN", "DC_OPS"].includes(r.toUpperCase())
    );
    
    if (userRoles.includes(ROLES.REQUESTER) && !isAdminOrDcops) {
      router.push("/inventory/vms");
      return;
    }

    const fetchAssets = async () => {
      setLoading(true);
      try {
        const [res, analytics] = await Promise.all([
          fetchAllAssets(page),
          fetchHardwareAnalytics()
        ]);
        setAssets(res.assets as PhysicalAsset[]);
        setTotalAssets(res.total);
        setHardwareAnalytics(analytics);
      } catch (error) {
        console.error("Failed to fetch assets:", error);
      } finally {
        setLoading(false);
        setIsInitialLoad(false);
      }
    };
    fetchAssets();
  }, [session, status, page, router]);

  if (status === "loading" || (loading && isInitialLoad)) {
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

  const handleExport = () => {
    const exportData = assets.map(asset => ({
      Name: asset.name,
      Type: asset.type,
      Provider: asset.vendor || "",
      Model: asset.model || "",
      Serial: asset.serial || "",
      Location: asset.location || "",
      CPU_Cores: asset.cpuCores || "",
      RAM_GB: asset.ramGb || "",
      Storage_GB: asset.storageGb || "",
      Warranty_Expiry: asset.warrantyExpiry ? new Date(asset.warrantyExpiry).toLocaleDateString() : "",
    }));
    exportToCsv(`hardware-assets-${new Date().toISOString().split('T')[0]}.csv`, exportData);
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
        <span className="text-slate-900 font-medium">Hardware Assets</span>
      </nav>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Hardware Assets</h1>
          <p className="text-slate-500 mt-1">
            Physical infrastructure: servers, racks, networking equipment, and storage devices.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" /> Export
          </Button>
          {canEdit && (
            <AssetModal mode="create" />
          )}
        </div>
      </div>

      {/* Analytics Dashboard */}
      {hardwareAnalytics && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              title="Total Assets"
              value={hardwareAnalytics.summary.total}
              icon={Server}
              description="All hardware assets"
            />
            <StatCard
              title="By Type"
              value={hardwareAnalytics.byType.length}
              icon={HardDrive}
              description="Asset types"
            />
            <StatCard
              title="Locations"
              value={hardwareAnalytics.byLocation.length}
              icon={MapPin}
              description="Unique locations"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-4">
                <InventoryChart
                  title="Assets by Type"
                  data={hardwareAnalytics.byType.map(t => ({ name: t.type, value: t.count }))}
                  type="bar"
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <InventoryChart
                  title="Assets by Location"
                  data={hardwareAnalytics.byLocation.map(l => ({ name: l.location, value: l.count }))}
                  type="pie"
                />
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          {hardwareAnalytics.recentActivity && hardwareAnalytics.recentActivity.length > 0 && (
            <RecentActivity
              title="Recent Hardware Activity"
              activities={hardwareAnalytics.recentActivity.map(a => ({
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
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <AssetListClient 
          initialAssets={assets} 
          canEdit={canEdit} 
          total={totalAssets}
          currentPage={page}
          isLoading={loading}
        />
      </div>
    </div>
  );
}
