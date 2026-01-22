// src/app/inventory/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { SummaryCards } from "./components/SummaryCards";
import { AssetTableSection } from "./components/AssetTableSection";
import { VmTableSection } from "./components/VmTableSection";
import { LicenseTableSection } from "./components/LicenseTableSection";

export default function InventoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    // Don't run if session isn't ready
    if (status === "loading") return;

    // Redirect if not authorized
    if (!session) {
      router.push("/");
      return;
    }

    // Fetch data only if authorized
    const fetchData = async () => {
      try {
        const res = await fetch("/api/inventory");
        if (!res.ok) {
          router.push("/");
          return;
        }
        const jsonData = await res.json();
        setData(jsonData);
      } catch (error) {
        console.error("Fetch error:", error);
        router.push("/");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session, status, router]);

  if (loading) {
    return <div className="p-6">Loading inventory...</div>;
  }

  if (!data) {
    return <div className="p-6">Access denied.</div>;
  }

  const isDcOps = data.role === "DC_OPS";

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold">Inventory Dashboard</h1>
      <SummaryCards summary={data.summary} />
      <AssetTableSection assets={data.recentAssets} />
      {isDcOps && <VmTableSection vms={data.recentVms} />}
      <LicenseTableSection licenses={data.recentLicenses} />
      <VmTableSection vms={data.recentVms} />
    </div>
  );
}
