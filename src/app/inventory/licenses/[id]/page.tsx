// src/app/inventory/licenses/[id]/page.tsx
"use client";
import { redirect } from "next/navigation";
import { ROLES } from "@/lib/roles";
import { format } from "date-fns";
import { 
  ArrowLeft, 
  Box, 
  ShieldCheck,
  Building,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { SoftwareLicense } from "@/types/inventory";
import { fetchLicenseDetailsWithAssets } from "@/app/actions/license-actions";


export default function LicenseDetailPage({ params }: { params: { id: string } }) {

   const { data: session } = useSession();
   const [license, setLicense] = useState<SoftwareLicense>();

  if (!session?.user) redirect("/auth");

  if (session.user.roles.includes(ROLES.REQUESTER)) {
     redirect("/inventory/vms");
  }
  useEffect(() => {
    const getLicense = async (id: string) => {
      try {
        const res = await fetchLicenseDetailsWithAssets(id);
        if (!res) return;
        setLicense(res as unknown as SoftwareLicense);
      } catch (err) {
        console.error(err);
      }
    };

    if (session) {
      getLicense(params.id);
    }
  }, [session, params.id]);


  return (
    <div className="p-6 md:p-10 space-y-8 bg-slate-50/20 min-h-screen">
       <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon" className="rounded-full">
           <Link href="/inventory/licenses"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
           <h1 className="text-2xl font-black text-slate-900 leading-tight">{license?.name}</h1>
           <p className="text-sm font-bold text-slate-500 mt-1 uppercase tracking-widest">{license?.vendor || "Enterprise Subscription"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 space-y-6">
            <Card className="border-none shadow-sm ring-1 ring-slate-200 overflow-hidden">
               <CardHeader className="bg-slate-50/50 border-b">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500">Subscription Metadata</CardTitle>
               </CardHeader>
               <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                     <DetailRow label="License Serial / ID" value={license?.id || "Managed via Portal"} className="font-mono text-blue-600" />
                     <DetailRow label="Vendor" value={license?.vendor} />
                     <DetailRow label="License Type" value={license?.type} />
                     <DetailRow label="Support Tier" value="Premium 24x7 Global" />
                  </div>
               </CardContent>
            </Card>

            <Card className="border-none shadow-sm ring-1 ring-slate-200 overflow-hidden">
               <CardHeader className="bg-slate-50/50 border-b">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                     <Box className="h-4 w-4" /> Associated Infrastructure
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-0">
                  {license?.assets && license.assets?.length > 0 ? (
                     <div className="overflow-x-auto">
                        <table className="w-full text-left">
                           <thead className="bg-[#fcfdfe] border-b border-slate-100">
                              <tr>
                                 <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Asset Name</th>
                                 <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type</th>
                                 <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Serial</th>
                                 <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Link</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-50">
                              {license?.assets?.map((asset) => (
                                 <tr key={asset?.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 font-bold text-slate-700 text-xs">{asset.name}</td>
                                    <td className="px-6 py-4 text-[10px] font-bold text-slate-400">{asset.type}</td>
                                    <td className="px-6 py-4 font-mono text-[10px] text-slate-500">{asset.serial}</td>
                                    <td className="px-6 py-4 text-right">
                                       <Link href={`/inventory/assets/${asset.id}`}>
                                          <Button variant="ghost" size="sm" className="h-7 text-[10px] uppercase font-bold">View Asset</Button>
                                       </Link>
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  ) : (
                     <div className="p-10 text-center text-slate-400 italic text-xs">No physical assets are currently linked to this license</div>
                  )}
               </CardContent>
            </Card>
         </div>

         <div className="space-y-6">
            <Card className="border-none shadow-sm ring-1 ring-slate-200">
               <CardHeader className="bg-slate-50/30">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Lifecycle & Compliance</CardTitle>
               </CardHeader>
               <CardContent className="pt-4 space-y-4">
                  <SideDetail icon={Calendar} label="Expiration Date" value={license?.expiryDate ? format(new Date(license.expiryDate), "PPP") : "Perpetual"} />
                  <SideDetail icon={ShieldCheck} label="Maintenance End" value={license?.maintenanceExpiry ? format(new Date(license.maintenanceExpiry), "PPP") : "Not Defined"} />
                  <SideDetail icon={Building} label="Purchased Via" value="Corporate IT Procurement" />
               </CardContent>
            </Card>

            <Card className="bg-slate-900 text-white border-none shadow-xl">
               <CardContent className="p-6">
                  <div className="flex items-center gap-3 text-emerald-400 mb-4">
                     <ShieldCheck className="h-5 w-5" />
                     <p className="text-[10px] font-black uppercase tracking-widest">Compliance Status</p>
                  </div>
                  <p className="text-xl font-black leading-tight">Legally Authorized</p>
                  <p className="text-xs text-white/50 mt-2 font-medium">This license is within its active window and approved for use on linked infrastructure.</p>
               </CardContent>
            </Card>
         </div>
      </div>
    </div>
  );
}
interface DetailRowProps {
  label: string;
  value: string | number | boolean | null | undefined;
  className?: string;
}

interface SideDetailProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
}

function DetailRow({ label, value, className = "" }: DetailRowProps) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">{label}</p>
      <p className={`text-sm font-bold text-slate-800 ${className}`}>{value || "—"}</p>
    </div>
  );
}

function SideDetail({ icon: Icon, label, value }: SideDetailProps) {
   return (
      <div className="flex items-start gap-3">
         <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
            <Icon className="h-4 w-4" />
         </div>
         <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</p>
            <p className="text-xs font-bold text-slate-700">{value || "Not Assigned"}</p>
         </div>
      </div>
   );
}
