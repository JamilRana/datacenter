// src/app/inventory/assets/[id]/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { ROLES } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  ShieldCheck, 
  Cpu, 
  Database,  
  HardDrive
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Asset, SoftwareLicense } from "@prisma/client";

export default async function AssetDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth");

  if (session.user.roles.includes(ROLES.REQUESTER)) {
    redirect("/inventory/vms");
  }

  const asset = await prisma.asset.findUnique({
    where: { id: params.id },
    include: {
      licenses: true,
    },
  }) as (Asset & { licenses: SoftwareLicense[] }) | null;

  if (!asset) notFound();

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
                <DetailRow label="Vendor" value={asset.vendor} />
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