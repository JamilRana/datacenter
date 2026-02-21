// src/app/inventory/assets/page.tsx
"use client";
import { redirect } from "next/navigation";
import { ROLES } from "@/lib/roles";
import { AssetListClient } from "../components/AssetListClient";
import {  Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { PhysicalAsset } from "@/types/inventory";
import { fetchAllAssets } from "@/app/actions/asset-actions";

export default function AssetsPage() {
   const { data: session } = useSession();
   const [assets, setAssets] = useState<PhysicalAsset[]>([]);
  if (!session?.user) redirect("/auth");

  // REQUESTERS cannot view physical hardware assets per requirements
  if (session.user.roles.includes(ROLES.REQUESTER)) {
     redirect("/inventory/vms");
  }

  useEffect(()=>{
   const fetchAssets = async () => {
   try{
    const res = await fetchAllAssets();
    if(!res){
      throw new Error("Failed to load Vm metrics");
    }
    setAssets(JSON.parse(JSON.stringify(res)));
   }catch(error){
    console.log(error);
   }
  }
  fetchAssets();
  },[session]);
  const canEdit = session.user.roles.includes(ROLES.ADMIN) || session.user.roles.includes(ROLES.DCOPS);

  return (
    <div className="p-6 md:p-10 space-y-8 bg-slate-50/20 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Physical Infrastructure</h1>
          <p className="text-slate-500 mt-1">Authoritative inventory of hardware assets, including hypervisors and networking stack.</p>
        </div>
        {canEdit && (
           <Button asChild className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 gap-2 h-11 px-6">
              <Link href="/inventory/assets/new">
                <Plus className="h-4 w-4" /> Register New Asset
              </Link>
           </Button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
         <AssetListClient initialAssets={assets} />
      </div>
    </div>
  );
}
