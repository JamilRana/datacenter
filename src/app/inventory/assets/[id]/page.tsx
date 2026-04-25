// src/app/inventory/assets/[id]/page.tsx
"use client";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  ShieldCheck, 
  Cpu, 
  Database,  
  HardDrive,
  Server,
  AlertTriangle,
  Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Asset, SoftwareLicense } from "@/types/inventory";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { fetchAssetDetailsWithLicenses } from "@/app/actions/asset-actions";
import { fetchAssetUtilization } from "@/app/actions/analytics-actions";
import { AssetUtilization } from "@/lib/analytics/assetUtilization";
import { InventoryChart } from "@/components/analytics/InventoryChart";

export default function AssetDetailPage({ params }: { params: { id: string } }) {
   const { data: session } = useSession();
   const [asset, setAsset] = useState<Asset & { licenses: SoftwareLicense[] } | null>(null);
   const [utilization, setUtilization] = useState<AssetUtilization | null>(null);
   const [loading, setLoading] = useState(true);
   
   if (!session?.user) redirect("/auth");

   const userRoles = session.user.roles || [];
   const isAdmin = userRoles.some(r => ["ADMIN", "DC_OPS"].includes(r.toUpperCase()));
   
   if (!isAdmin) {
     redirect("/inventory/vms");
   }

   useEffect(() => {
     const getAsset = async (id: string) => {
       try {
         const [assetData, utilData] = await Promise.all([
           fetchAssetDetailsWithLicenses(id),
           fetchAssetUtilization(id)
         ]);
         if (!assetData) return;
         setAsset(assetData);
         setUtilization(utilData);
       } catch (err) {
         console.error(err);
       } finally {
         setLoading(false);
       }
     };

     if (session) {
       getAsset(params.id);
     }
   }, [session, params.id]);

  if (!asset || loading) {
    return (
      <div className="p-6 md:p-10">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-64"></div>
          <div className="h-64 bg-slate-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 space-y-8 bg-slate-50/20 min-h-screen">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon" className="rounded-full">
          <Link href="/inventory/assets"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-tight">{asset.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="font-bold border-slate-200 uppercase text-[10px] tracking-widest">
              {asset.type}
            </Badge>
            <span className="text-slate-300">•</span>
            <p className="text-sm font-medium text-slate-500">{asset.vendor} {asset.model}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-sm ring-1 ring-slate-200 overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500">Global Identification</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                <DetailRow label="Provider" value={asset.vendor} />
                <DetailRow label="Model" value={asset.model} />
                <DetailRow label="Serial Number" value={asset.serial} className="font-mono text-blue-600" />
                <DetailRow label="Asset ID" value={asset.id} className="text-[10px] break-all" />
              </div>
            </CardContent>
          </Card>

          {asset.type === "SERVER" && (
            <Card className="border-none shadow-sm ring-1 ring-slate-200 overflow-hidden">
              <CardHeader className="bg-blue-50/30 border-b border-blue-50">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-blue-600">Hardware Specifications</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <SpecBlock icon={Cpu} label="CPU Cores" value={asset.cpuCores} unit="Cores" color="text-blue-600 bg-blue-50" />
                  <SpecBlock icon={Database} label="System RAM" value={asset.ramGb} unit="GB" color="text-indigo-600 bg-indigo-50" />
                  <SpecBlock icon={HardDrive} label="Internal Storage" value={asset.storageGb} unit="GB" color="text-emerald-600 bg-emerald-50" />
                </div>
                
                <div className="mt-8 pt-8 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                  <DetailRow label="Network Interfaces" value={asset.interfaces} />
                  <DetailRow label="Max Throughput" value={asset.throughputGbps ? `${asset.throughputGbps} Gbps` : null} />
                  <DetailRow label="VLAN Support" value={asset.vlanSupport ? "Fully Enabled" : "Not Defined"} />
                  <DetailRow label="GPU Resources" value={asset.graphicsCardModel || "On-board Only"} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resource Utilization Section */}
          {utilization && (asset.cpuCores || asset.ramGb || asset.storageGb) && (
            <Card className={`border-none shadow-sm ring-1 ring-slate-200 overflow-hidden ${utilization.isOverallocated ? "ring-2 ring-red-300" : ""}`}>
              <CardHeader className={`border-b ${utilization.isOverallocated ? "bg-red-50" : "bg-emerald-50/30"}`}>
                <div className="flex items-center gap-2">
                  <Activity className={`h-5 w-5 ${utilization.isOverallocated ? "text-red-600" : "text-emerald-600"}`} />
                  <CardTitle className={`text-sm font-black uppercase tracking-widest ${utilization.isOverallocated ? "text-red-700" : "text-emerald-600"}`}>
                    Resource Utilization
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {utilization.isOverallocated && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">Warning: Allocated resources exceed hardware capacity</span>
                  </div>
                )}

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <UtilizationCard 
                    label="CPU" 
                    capacity={utilization.capacity.cpuCores} 
                    allocated={utilization.allocated.cpuCores} 
                  />
                  <UtilizationCard 
                    label="RAM" 
                    capacity={utilization.capacity.ramGb} 
                    allocated={utilization.allocated.ramGb} 
                    unit="GB"
                  />
                  <UtilizationCard 
                    label="Storage" 
                    capacity={utilization.capacity.storageGb} 
                    allocated={utilization.allocated.storageGb} 
                    unit="GB"
                  />
                </div>

                {/* VM Distribution Chart */}
                {utilization.vms.length > 0 && (
                  <div className="pt-4 border-t border-slate-100">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">VM Resource Distribution</h4>
                    <InventoryChart
                      title=""
                      data={utilization.vms.map(vm => ({
                        name: vm.hostname,
                        value: vm.vcpu,
                        ram: vm.ramGb,
                        storage: vm.storageGb
                      }))}
                      type="bar"
                    />
                  </div>
                )}

                {/* VM Table */}
                {utilization.vms.length > 0 && (
                  <div className="pt-4 border-t border-slate-100">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Allocated VMs ({utilization.vms.length})</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b">
                          <tr>
                            <th className="text-left py-3 px-4 font-bold text-slate-600 text-xs uppercase">VM Name</th>
                            <th className="text-left py-3 px-4 font-bold text-slate-600 text-xs uppercase">Owner</th>
                            <th className="text-center py-3 px-4 font-bold text-slate-600 text-xs uppercase">CPU</th>
                            <th className="text-center py-3 px-4 font-bold text-slate-600 text-xs uppercase">RAM (GB)</th>
                            <th className="text-center py-3 px-4 font-bold text-slate-600 text-xs uppercase">Storage (GB)</th>
                            <th className="text-center py-3 px-4 font-bold text-slate-600 text-xs uppercase">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {utilization.vms.map((vm) => (
                            <tr key={vm.id} className="border-b hover:bg-slate-50">
                              <td className="py-3 px-4 font-medium">{vm.hostname}</td>
                              <td className="py-3 px-4 text-slate-600">{vm.ownerName}</td>
                              <td className="py-3 px-4 text-center">{vm.vcpu}</td>
                              <td className="py-3 px-4 text-center">{vm.ramGb}</td>
                              <td className="py-3 px-4 text-center">{vm.storageGb}</td>
                              <td className="py-3 px-4 text-center">
                                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                  vm.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" :
                                  vm.status === "SUSPENDED" ? "bg-amber-100 text-amber-700" :
                                  "bg-slate-100 text-slate-600"
                                }`}>
                                  {vm.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {utilization.vms.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    <Server className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No VMs allocated to this hardware</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {asset.type === "STORAGE" && (
            <Card className="border-none shadow-sm ring-1 ring-slate-200 overflow-hidden">
              <CardHeader className="bg-indigo-50/30 border-b border-indigo-50">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-indigo-600">Storage Capacity Details</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                <DetailRow label="Total Capacity" value={asset.capacityTb ? `${asset.capacityTb} TB` : null} />
                <DetailRow label="Disk Enclosures" value={asset.noOfDisks} />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-sm ring-1 ring-slate-200">
            <CardHeader className="bg-slate-50/30">
              <CardTitle className="text-sm font-bold uppercase tracking-wider">Logistics & Compliance</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <SideDetail icon={MapPin} label="Physical Location" value={asset.location} />
              <SideDetail 
                icon={Calendar} 
                label="Warranty Expiry" 
                value={asset.warrantyExpiry ? format(new Date(asset.warrantyExpiry), "PPP") : null} 
              />
              <SideDetail icon={ShieldCheck} label="Maintenance Contract" value="Standard Enterprise Support" />
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm ring-1 ring-slate-200">
            <CardHeader className="bg-slate-50/30">
              <CardTitle className="text-sm font-bold uppercase tracking-wider">Linked Licenses</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {asset.licenses.length > 0 ? (
                <div className="space-y-3">
                  {asset.licenses.map((lic) => (
                    <Link key={lic.id} href={`/inventory/licenses/${lic.id}`} className="block p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                      <p className="text-xs font-bold text-slate-800">{lic.name}</p>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">{lic.vendor}</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic py-4 text-center">No software licenses linked to this asset</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// --- Typed Components ---
interface DetailRowProps {
  label: string;
  value: string | number | boolean | null | undefined;
  className?: string;
}

function DetailRow({ label, value, className = "" }: DetailRowProps) {
  const displayValue = value == null ? "—" : String(value);
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">{label}</p>
      <p className={`text-sm font-bold text-slate-800 ${className}`}>{displayValue}</p>
    </div>
  );
}

interface SpecBlockProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | null | undefined;
  unit: string;
  color: string;
}

function SpecBlock({ icon: Icon, label, value, unit, color }: SpecBlockProps) {
  const displayValue = value ?? 0;
  return (
    <div className="p-4 rounded-2xl bg-slate-50/50 border border-slate-100 flex flex-col gap-3">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="space-y-0.5">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        <p className="text-xl font-black text-slate-900 leading-tight">
          {displayValue} <span className="text-xs font-bold text-slate-400">{unit}</span>
        </p>
      </div>
    </div>
  );
}

interface UtilizationCardProps {
  label: string;
  capacity: number;
  allocated: number;
  unit?: string;
}

function UtilizationCard({ label, capacity, allocated, unit = "" }: UtilizationCardProps) {
  const percentage = capacity > 0 ? Math.min((allocated / capacity) * 100, 100) : 0;
  const isOverallocated = allocated > capacity;
  const available = Math.max(0, capacity - allocated);

  return (
    <div className={`p-4 rounded-xl border ${isOverallocated ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-600">{label}</span>
        <span className={`text-sm font-bold ${isOverallocated ? "text-red-600" : "text-slate-900"}`}>
          {allocated}{unit ? ` ${unit}` : ""} / {capacity}{unit ? ` ${unit}` : ""}
        </span>
      </div>
      <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all ${isOverallocated ? "bg-red-500" : "bg-emerald-500"}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex justify-between mt-2 text-xs">
        <span className={isOverallocated ? "text-red-600 font-medium" : "text-slate-500"}>
          {percentage.toFixed(1)}% used
        </span>
        <span className="text-slate-500">
          {available}{unit ? ` ${unit}` : ""} available
        </span>
      </div>
    </div>
  );
}

interface SideDetailProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
}

function SideDetail({ icon: Icon, label, value }: SideDetailProps) {
  const displayValue = value || "Not Assigned";
  return (
    <div className="flex items-start gap-3">
      <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-xs font-bold text-slate-700">{displayValue}</p>
      </div>
    </div>
  );
}