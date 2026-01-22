// src/app/inventory/components/InventoryClient.tsx
"use client"; // 👈 ESSENTIAL: Marks as Client Component

import { useState } from "react";
import { VmInstance, PhysicalServer, FilterState } from "@/types/inventory";
import { AssetFilters } from "./AssetFilters";
import { AssetSection } from "./AssetSection";

interface InventoryClientProps {
  vms: VmInstance[];
  physicalServers: PhysicalServer[];
}

export function InventoryClient({
  vms,
  physicalServers,
}: InventoryClientProps) {
  const [filters, setFilters] = useState<FilterState>({
    assetType: "all",
    status: "all",
    search: "",
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Datacenter Inventory</h1>
      </div>

      <AssetFilters onFilterChange={setFilters} />
      <AssetSection
        vms={vms}
        physicalServers={physicalServers}
        filters={filters}
      />
    </div>
  );
}
