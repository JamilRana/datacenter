"use client";

import { useState, useMemo, useEffect } from "react";
import { AssetType, VmStatus } from "@/types/enums";
import { AssetFilters } from "./AssetFilters";
import { AssetTableSection } from "./AssetTableSection";
import { 
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious 
} from "@/components/ui/pagination";
import { FilterState } from "@/types/inventory";


interface DisplayAsset {
  id: string;
  category: "vm" | "physical";
  name: string;
  details: string;
  status?: VmStatus;
  physicalType?: AssetType;
}

interface InventoryClientProps {
  vms: Array<{
    id: string;
    hostname: string | null;
    ipAddress: string | null;
    status: VmStatus;
    request?: { systemName: string } | null;
  }>;
  physicalAssets: Array<{
    id: string;
    name: string;
    model: string | null;
    serial: string | null;
    type: AssetType;
    vendor: string | null;
  }>;
}

export function InventoryClient({ vms, physicalAssets }: InventoryClientProps) {
  const [filters, setFilters] = useState<FilterState>({
    assetType: "all",
    status: "all",
    search: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => setCurrentPage(1), [filters]);

  const { filteredAssets, totalCount } = useMemo(() => {
    // Transform VMs (schema-aligned)
    const vmItems: DisplayAsset[] = vms.map(vm => ({
      id: vm.id,
      category: "vm",
      name: vm.hostname || `VM-${vm.id.slice(0, 8)}`,
      details: `${vm.ipAddress || "No IP"} • ${vm.status}`,
      status: vm.status,
    }));

    // Transform Physical Assets (schema-aligned)
    const physicalItems: DisplayAsset[] = physicalAssets.map(asset => ({
      id: asset.id,
      category: "physical",
      name: asset.name,
      details: `${asset.model || "—"} • ${asset.serial || "—"}`,
      physicalType: asset.type,
    }));

    // ✅ FILTER LOGIC: Map UI concepts to schema reality
    let combined = filters.assetType.includes("vm") 
      ? vmItems 
      : filters.assetType.includes("physical")
        ? physicalItems
        : filters.assetType.includes("all")
          ? [...vmItems, ...physicalItems]
          : physicalItems.filter(item => item.physicalType === filters.assetType); // Specific physical type

    // Search across relevant fields per schema
    if (filters.search.trim()) {
      const term = filters.search.toLowerCase().trim();
      combined = combined.filter(item => {
        if (item.category === "vm") {
          const vm = vms.find(v => v.id === item.id);
          return (
            item.name.toLowerCase().includes(term) ||
            item.details.toLowerCase().includes(term) ||
            (vm?.request?.systemName || "").toLowerCase().includes(term)
          );
        } else {
          const asset = physicalAssets.find(a => a.id === item.id);
          return (
            item.name.toLowerCase().includes(term) ||
            (asset?.model || "").toLowerCase().includes(term) ||
            (asset?.serial || "").toLowerCase().includes(term) ||
            (asset?.vendor || "").toLowerCase().includes(term)
          );
        }
      });
    }

    // Status filter: ONLY apply to VMs (Physical assets have NO status field per schema)
    if (filters.status !== "all" && !filters.assetType.includes("physical") && !Object.values(AssetType).includes(filters.assetType as AssetType)) {
      combined = combined.filter(item => 
        item.category === "physical" || item.status === filters.status
      );
    }

    return { filteredAssets: combined, totalCount: combined.length };
  }, [vms, physicalAssets, filters]);

  // Pagination logic (unchanged from previous correct version)
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const paginatedAssets = filteredAssets.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      document.querySelector(".inventory-table")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">Datacenter Inventory</h1>
        <span className="text-sm text-muted-foreground">
          {totalCount} asset{totalCount !== 1 ? "s" : ""} found
        </span>
      </div>

      {/* ✅ FIXED: Removed non-existent prop 'currentAssetType' */}
      <AssetFilters onFilterChange={setFilters} />
      
      <div className="inventory-table">
        <AssetTableSection assets={paginatedAssets} />
      </div>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious 
                onClick={() => handlePageChange(currentPage - 1)}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
            
            {[...Array(totalPages)].map((_, i) => {
              const page = i + 1;
              if (
                page === 1 || 
                page === totalPages || 
                Math.abs(page - currentPage) <= 1
              ) {
                return (
                  <PaginationItem key={page}>
                    <PaginationLink 
                      onClick={() => handlePageChange(page)}
                      isActive={currentPage === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                );
              }
              if ((page === currentPage - 2 && currentPage > 3) || 
                  (page === currentPage + 2 && currentPage < totalPages - 2)) {
                return <PaginationItem key={`ellipsis-${page}`}>...</PaginationItem>;
              }
              return null;
            })}
            
            <PaginationItem>
              <PaginationNext 
                onClick={() => handlePageChange(currentPage + 1)}
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}