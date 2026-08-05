// src/app/inventory/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Server, 
  HardDrive, 
  Key, 
  ArrowRight,
  Box,
  Layers,
  Users,
  Shield
} from "lucide-react";
import { useEffect, useState } from "react";

interface InventoryStats {
  activeVms: number;
  totalNamespaces: number;
  totalAssets: number;
  totalLicenses: number;
  expiringLicenses: number;
  totalClusters: number;
  totalHorizon: number;
  totalVpn: number;
}

export default function InventoryHubPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<InventoryStats>({
    activeVms: 0,
    totalNamespaces: 0,
    totalAssets: 0,
    totalLicenses: 0,
    expiringLicenses: 0,
    totalClusters: 0,
    totalHorizon: 0,
    totalVpn: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/auth");
      return;
    }
    
    fetchStats();
  }, [session, status, router]);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/inventory/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const isDCOPSorAdmin = session?.user?.roles?.some(r => 
    r === "ADMIN" || r === "DCOPS"
  );

  if (status === "loading" || loading) {
    return (
      <div className="p-6 md:p-10 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-64"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-slate-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Inventory Hub</h1>
        <p className="text-slate-500 mt-1">
          Centralized management for all infrastructure assets
        </p>
      </div>

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/" className="hover:text-indigo-600">Dashboard</Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">Inventory</span>
      </nav>

      {/* Main Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {/* VM Instances */}
        <Link href="/inventory/vms" className="group">
          <Card className="h-full transition-all duration-300 border-2 border-blue-200 hover:border-blue-400 hover:shadow-lg cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-xl bg-blue-100">
                  <Server className="h-7 w-7 text-blue-600" />
                </div>
                <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
              </div>
            </CardHeader>
            <CardContent>
              <CardTitle className="text-xl text-slate-900">VM Instances</CardTitle>
              <CardDescription className="mt-2 text-slate-600">
                Provisioned virtual machines with active resources
              </CardDescription>
              <div className="mt-6 pt-4 border-t border-slate-100">
                <span className="text-3xl font-bold text-slate-900">{stats.activeVms}</span>
                <span className="text-sm text-slate-500 ml-2">Active VMs</span>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* K8s Namespaces */}
        <Link href="/inventory/namespaces" className="group">
          <Card className="h-full transition-all duration-300 border-2 border-indigo-200 hover:border-indigo-400 hover:shadow-lg cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-xl bg-indigo-100">
                  <Box className="h-7 w-7 text-indigo-600" />
                </div>
                <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
              </div>
            </CardHeader>
            <CardContent>
              <CardTitle className="text-xl text-slate-900">K8s Namespaces</CardTitle>
              <CardDescription className="mt-2 text-slate-600">
                Kubernetes namespace clusters and node allocations
              </CardDescription>
              <div className="mt-6 pt-4 border-t border-slate-100">
                <span className="text-3xl font-bold text-slate-900">{stats.totalNamespaces}</span>
                <span className="text-sm text-slate-500 ml-2">Namespaces</span>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Hardware Assets */}
        <Link href="/inventory/assets" className="group">
          <Card className="h-full transition-all duration-300 border-2 border-emerald-200 hover:border-emerald-400 hover:shadow-lg cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-xl bg-emerald-100">
                  <HardDrive className="h-7 w-7 text-emerald-600" />
                </div>
                <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
              </div>
            </CardHeader>
            <CardContent>
              <CardTitle className="text-xl text-slate-900">Hardware Assets</CardTitle>
              <CardDescription className="mt-2 text-slate-600">
                Physical servers, racks, and networking equipment
              </CardDescription>
              <div className="mt-6 pt-4 border-t border-slate-100">
                <span className="text-3xl font-bold text-slate-900">{stats.totalAssets}</span>
                <span className="text-sm text-slate-500 ml-2">Assets</span>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Physical Clusters */}
        {isDCOPSorAdmin && (
          <Link href="/inventory/clusters" className="group">
            <Card className="h-full transition-all duration-300 border-2 border-amber-200 hover:border-amber-400 hover:shadow-lg cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-xl bg-amber-100">
                    <Layers className="h-7 w-7 text-amber-600" />
                  </div>
                  <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="text-xl text-slate-900">Physical Clusters</CardTitle>
                <CardDescription className="mt-2 text-slate-600">
                  ESXi virtualization clusters grouping host servers
                </CardDescription>
                <div className="mt-6 pt-4 border-t border-slate-100">
                  <span className="text-3xl font-bold text-slate-900">{stats.totalClusters}</span>
                  <span className="text-sm text-slate-500 ml-2">Clusters</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Software Licenses */}
        <Link href="/inventory/licenses" className="group">
          <Card className="h-full transition-all duration-300 border-2 border-purple-200 hover:border-purple-400 hover:shadow-lg cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-xl bg-purple-100">
                  <Key className="h-7 w-7 text-purple-600" />
                </div>
                <div className="flex items-center gap-2">
                  {stats.expiringLicenses > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {stats.expiringLicenses} Expiring
                    </Badge>
                  )}
                  <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CardTitle className="text-xl text-slate-900">Software Licenses</CardTitle>
              <CardDescription className="mt-2 text-slate-600">
                OS keys, SSL certificates, and application licenses
              </CardDescription>
              <div className="mt-6 pt-4 border-t border-slate-100">
                <span className="text-3xl font-bold text-slate-900">{stats.totalLicenses}</span>
                <span className="text-sm text-slate-500 ml-2">Licenses</span>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Horizon Users */}
        {isDCOPSorAdmin && (
          <Link href="/inventory/horizon" className="group">
            <Card className="h-full transition-all duration-300 border-2 border-amber-200 hover:border-amber-400 hover:shadow-lg cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-xl bg-amber-100">
                    <Users className="h-7 w-7 text-amber-600" />
                  </div>
                  <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="text-xl text-slate-900">Horizon Users</CardTitle>
                <CardDescription className="mt-2 text-slate-600">
                  Track client desktop endpoints and active user assignments
                </CardDescription>
                <div className="mt-6 pt-4 border-t border-slate-100">
                  <span className="text-3xl font-bold text-slate-900">{stats.totalHorizon}</span>
                  <span className="text-sm text-slate-500 ml-2">Assigned</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* VPN Assignments */}
        {isDCOPSorAdmin && (
          <Link href="/inventory/vpn" className="group">
            <Card className="h-full transition-all duration-300 border-2 border-emerald-200 hover:border-emerald-400 hover:shadow-lg cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-xl bg-emerald-100">
                    <Shield className="h-7 w-7 text-emerald-600" />
                  </div>
                  <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="text-xl text-slate-900">VPN Assignments</CardTitle>
                <CardDescription className="mt-2 text-slate-600">
                  Track secure tunnel client access profiles and IP mappings
                </CardDescription>
                <div className="mt-6 pt-4 border-t border-slate-100">
                  <span className="text-3xl font-bold text-slate-900">{stats.totalVpn}</span>
                  <span className="text-sm text-slate-500 ml-2">Active Profiles</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>

      {/* Quick Access for Admin/DCOPS */}
      {/* {isDCOPSorAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button variant="outline" asChild className="h-auto py-4 flex-col gap-2">
            <Link href="/inventory/vms">
              <Activity className="h-5 w-5 text-blue-600" />
              <span className="text-sm">Resource Capacity</span>
            </Link>
          </Button>
          <Button variant="outline" asChild className="h-auto py-4 flex-col gap-2">
            <Link href="/inventory/assets">
              <HardDrive className="h-5 w-5 text-emerald-600" />
              <span className="text-sm">Server Hardware</span>
            </Link>
          </Button>
          <Button variant="outline" asChild className="h-auto py-4 flex-col gap-2">
            <Link href="/inventory/licenses">
              <Shield className="h-5 w-5 text-purple-600" />
              <span className="text-sm">SSL Certificates</span>
            </Link>
          </Button>
          <Button variant="outline" asChild className="h-auto py-4 flex-col gap-2">
            <Link href="/inventory">
              <Box className="h-5 w-5 text-indigo-600" />
              <span className="text-sm">Full Inventory</span>
            </Link>
          </Button>
        </div>
      )} */}

      {/* Info Banner for Non-Admin Users */}
      {!isDCOPSorAdmin && (
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Box className="h-5 w-5 text-slate-400 mt-0.5" />
              <div>
                <p className="text-sm text-slate-600">
                  You have view-only access to your VM inventory. 
                  Hardware and license management is restricted to DCOPS and Admin roles.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
