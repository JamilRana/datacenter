// src/app/inventory/licenses/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { ROLES } from "@/lib/roles";
import { FileText, ChevronLeft, Trash2, AlertTriangle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, differenceInDays } from "date-fns";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { SoftwareLicense } from "@/types/inventory";
import { fetchLicenseDetails, deleteLicense } from "@/app/actions/license-actions";
import { LicenseModal } from "../components/LicenseModal";
import { DeleteConfirmationModal } from "../components/DeleteConfirmationModal";
import { Card, CardContent } from "@/components/ui/card";
import { exportToCsv } from "@/lib/export-utils";
import { Download } from "lucide-react";
import { StatCard } from "@/components/analytics/StatCard";
import { InventoryChart } from "@/components/analytics/InventoryChart";
import { RecentActivity } from "@/components/analytics/RecentActivity";
import { fetchLicenseAnalytics } from "@/app/actions/analytics-actions";
import { LicenseAnalytics } from "@/lib/analytics/licenseAnalytics";

export default function LicensesPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [licenses, setLicenses] = useState<SoftwareLicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [licenseAnalytics, setLicenseAnalytics] = useState<LicenseAnalytics | null>(null);

  const page = searchParams.page ? parseInt(searchParams.page, 10) : 1;

  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/auth");
      return;
    }

    // REQUESTERS cannot view licenses
    const userRoles = session.user.roles || [];
    const isAdminOrDcops = userRoles.some(r => 
      ["ADMIN", "DC_OPS"].includes(r.toUpperCase())
    );
    
    if (userRoles.includes(ROLES.REQUESTER) && !isAdminOrDcops) {
      router.push("/inventory/vms");
      return;
    }

    const getLicenses = async () => {
      try {
        const [res, analytics] = await Promise.all([
          fetchLicenseDetails(page),
          fetchLicenseAnalytics()
        ]);
        if (res.licenses) {
          setLicenses(res.licenses as SoftwareLicense[]);
        }
        setLicenseAnalytics(analytics);
      } catch (err) {
        console.error("Failed to fetch licenses:", err);
      } finally {
        setLoading(false);
      }
    };

    getLicenses();
  }, [session, status, router, page]);

  const canEdit = !!(session?.user?.roles?.includes(ROLES.ADMIN) || session?.user?.roles?.includes(ROLES.DCOPS));

  const handleExport = () => {
    const exportData = licenses.map(lic => ({
      Name: lic.name,
      Vendor: lic.vendor,
      Type: lic.type || "",
      Expiry_Date: lic.expiryDate ? new Date(lic.expiryDate).toLocaleDateString() : "Perpetual",
      Maintenance_Expiry: lic.maintenanceExpiry ? new Date(lic.maintenanceExpiry).toLocaleDateString() : "",
      Notes: lic.notes || "",
    }));
    exportToCsv(`software-licenses-${new Date().toISOString().split('T')[0]}.csv`, exportData);
  };

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

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/inventory" className="hover:text-indigo-600 flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" />
          Inventory Hub
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">Software Licenses</span>
      </nav>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Software Licenses</h1>
          <p className="text-slate-500 mt-1">
            Manage OS keys, SSL certificates, and application licenses with expiry tracking.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" /> Export
          </Button>
          {canEdit && (
            <LicenseModal mode="create" />
          )}
        </div>
      </div>

      {/* Analytics Dashboard */}
      {licenseAnalytics && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              title="Total Licenses"
              value={licenseAnalytics.summary.total}
              icon={FileText}
              description="All software licenses"
            />
            <StatCard
              title="Expiring Soon"
              value={licenseAnalytics.summary.expiringSoon}
              icon={AlertTriangle}
              description="Within 30 days"
            />
            <StatCard
              title="Expiring This Month"
              value={licenseAnalytics.summary.expiringThisMonth}
              icon={Clock}
              description="In current month"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-4">
                <InventoryChart
                  title="Licenses by Vendor"
                  data={licenseAnalytics.byVendor.map(v => ({ name: v.vendor, value: v.count }))}
                  type="bar"
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <InventoryChart
                  title="Licenses by Type"
                  data={licenseAnalytics.byType.map(t => ({ name: t.type, value: t.count }))}
                  type="pie"
                />
              </CardContent>
            </Card>
          </div>

          {/* Expiring Licenses Alert */}
          {licenseAnalytics.expiringLicenses.length > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  <span className="font-bold text-orange-800">Licenses Expiring Soon</span>
                </div>
                <div className="space-y-2">
                  {licenseAnalytics.expiringLicenses.slice(0, 5).map(lic => (
                    <div key={lic.id} className="flex justify-between items-center text-sm">
                      <span className="text-orange-900">{lic.name} ({lic.vendor})</span>
                      <span className="text-orange-700 font-medium">
                        {lic.expiryDate ? format(new Date(lic.expiryDate), "MMM dd, yyyy") : "N/A"}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Activity */}
          {licenseAnalytics.recentActivity && licenseAnalytics.recentActivity.length > 0 && (
            <RecentActivity
              title="Recent License Activity"
              activities={licenseAnalytics.recentActivity.map(a => ({
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {licenses.map((lic) => (
          <LicenseCard key={lic.id} license={lic} canEdit={canEdit} />
        ))}
        {licenses.length === 0 && (
          <div className="lg:col-span-3 py-20 text-center opacity-30 select-none">
            <FileText className="h-12 w-12 mx-auto mb-3" />
            <p className="font-black uppercase tracking-widest text-lg">No License Data Recorded</p>
          </div>
        )}
      </div>
    </div>
  );
}

function LicenseCard({ license, canEdit }: { license: SoftwareLicense, canEdit: boolean }) {
  const daysToExpiry = license.expiryDate ? differenceInDays(new Date(license.expiryDate), new Date()) : null;
  
  let statusBadge = null;
  if (daysToExpiry === null) {
    statusBadge = <Badge variant="outline" className="border-slate-200 text-slate-400">PERPETUAL</Badge>;
  } else if (daysToExpiry < 0) {
    statusBadge = <Badge variant="destructive" className="font-bold">EXPIRED</Badge>;
  } else if (daysToExpiry < 30) {
    statusBadge = <Badge className="bg-orange-500 hover:bg-orange-600 font-bold">EXPIRING SOON</Badge>;
  } else {
    statusBadge = <Badge className="bg-emerald-500 hover:bg-emerald-600 font-bold">ACTIVE</Badge>;
  }

  return (
    <Card className="border-none shadow-sm ring-1 ring-slate-200 hover:ring-indigo-300 transition-all group overflow-hidden bg-white">
      <CardContent className="p-0">
        <div className="p-5 space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-0.5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{license.vendor || "Generic Vendor"}</p>
              <h3 className="font-black text-slate-900 leading-tight group-hover:text-indigo-700 transition-colors">{license.name}</h3>
            </div>
            <div className="flex flex-col items-end gap-2">
              {statusBadge}
              {canEdit && (
                <div className="flex gap-1">
                  <LicenseModal license={license} mode="edit" />
                  <DeleteConfirmationModal
                    title="Delete License"
                    description={`Are you sure you want to delete ${license.name}? All linked asset relationships will be removed.`}
                    onDelete={async () => {
                      await deleteLicense(license.id);
                      window.location.reload();
                    }}
                    trigger={
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    }
                  />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-slate-400 uppercase tracking-tighter">Utilization</span>
              <span className="text-slate-700">{(license.assets?.length || 0)} Links</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, ((license.assets?.length || 0) / 10) * 100)}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-0.5">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Expiry Date</p>
              <p className="text-xs font-black text-slate-700">{license.expiryDate ? format(new Date(license.expiryDate), "MMM dd, yyyy") : "Lifetime"}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">License Type</p>
              <p className="text-xs font-black text-slate-700">{license.type || "Standard"}</p>
            </div>
          </div>
        </div>

        <Link href={`/inventory/licenses/${license.id}`} className="block w-full py-2.5 bg-slate-50 border-t border-slate-100 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:bg-indigo-600 hover:text-white transition-all">
          View Details
        </Link>
      </CardContent>
    </Card>
  );
}
