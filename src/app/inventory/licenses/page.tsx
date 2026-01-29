// src/app/inventory/licenses/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { getLicenses } from "@/app/actions/inventory-actions";
import { ROLES } from "@/lib/roles";
import { 
  FileText, 
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays } from "date-fns";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { EnrollmentLicense } from "@/types/inventory";

export default async function LicensesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth");

  // Only Admin, DCOPS, and Approvers see licenses
  if (session.user.roles.includes(ROLES.REQUESTER)) {
     redirect("/inventory/vms");
  }

  const licenses = await getLicenses();
  const canEdit = session.user.roles.includes(ROLES.ADMIN) || session.user.roles.includes(ROLES.DCOPS);

  return (
    <div className="p-6 md:p-10 space-y-8 bg-slate-50/20 min-h-screen">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Software Subscriptions</h1>
          <p className="text-slate-500 mt-1">Manage centralized software licensing, maintenance windows, and compliance alerts.</p>
        </div>
        {canEdit && (
           <Button asChild className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100 gap-2 h-11 px-6">
              <Link href="/inventory/licenses/new">
                <Plus className="h-4 w-4" /> Register New License
              </Link>
           </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {licenses.map((lic) => (
            <LicenseCard key={lic.id} license={lic} />
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

function LicenseCard({ license }: { license: EnrollmentLicense }) {
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
      <Card className="border-none shadow-sm ring-1 ring-slate-200 hover:ring-blue-300 transition-all group overflow-hidden bg-white">
         <CardContent className="p-0">
            <div className="p-5 space-y-4">
               <div className="flex justify-between items-start">
                  <div className="space-y-0.5">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{license.vendor || "Generic Vendor"}</p>
                     <h3 className="font-black text-slate-900 leading-tight group-hover:text-blue-700 transition-colors">{license.name}</h3>
                  </div>
                  {statusBadge}
               </div>

               <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                     <span className="text-slate-400 uppercase tracking-tighter">Utilization</span>
                     <span className="text-slate-700">{(license.assets?.length || 0)} Links</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                     <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, ((license.assets?.length || 0) / 10) * 100)}%` }} />
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

            <Link href={`/inventory/licenses/${license.id}`} className="block w-full py-2.5 bg-slate-50 border-t border-slate-100 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:bg-blue-600 hover:text-white transition-all">
               Deep Review Profile
            </Link>
         </CardContent>
      </Card>
   );
}
