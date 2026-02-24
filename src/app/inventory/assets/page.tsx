// src/app/inventory/assets/page.tsx
"use client";

import { useSession } from "next-auth/react";
import { ROLES } from "@/lib/roles";
import { AssetListClient } from "../components/AssetListClient";
import { useEffect, useState } from "react";
import { PhysicalAsset } from "@/types/inventory";
import { fetchAllAssets } from "@/app/actions/asset-actions";
import { AssetModal } from "../components/AssetModal";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AssetsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [assets, setAssets] = useState<PhysicalAsset[]>([]);
  const [loading, setLoading] = useState(true);

  const page = searchParams.page ? parseInt(searchParams.page, 10) : 1;

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/auth");
      return;
    }

    // REQUESTERS cannot view physical hardware assets
    if (session.user.roles.includes(ROLES.REQUESTER) && 
        !session.user.roles.includes(ROLES.ADMIN) && 
        !session.user.roles.includes(ROLES.DCOPS)) {
      router.push("/inventory/vms");
      return;
    }

    const fetchAssets = async () => {
      try {
        const res = await fetchAllAssets(page);
        setAssets(res.assets as PhysicalAsset[]);
      } catch (error) {
        console.log(error);
      } finally {
        setLoading(false);
      }
    };
    fetchAssets();
  }, [session, status, page, router]);

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
        {canEdit && (
          <AssetModal mode="create" />
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <AssetListClient initialAssets={assets} canEdit={canEdit} />
      </div>
    </div>
  );
}
