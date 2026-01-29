"use client";

import { useState, useEffect } from "react";
import { FilterState } from "@/types/inventory";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, Filter } from "lucide-react";

const DEFAULT_FILTERS: FilterState = {
  assetType: "all",
  status: "all",
  search: "",
};

interface AssetFiltersProps {
  onFilterChange: (filters: FilterState) => void;
  initialFilters?: Partial<FilterState>;
}

export function AssetFilters({
  onFilterChange,
  initialFilters,
}: AssetFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  });

  useEffect(() => {
    onFilterChange(filters);
  }, [filters, onFilterChange]);

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
    onFilterChange(DEFAULT_FILTERS);
  };

  return (
    <div className="bg-card p-4 rounded-lg border space-y-4">
      <div className="flex items-center gap-2">
        <Filter className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-medium">Filters</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Asset Type */}
        <div>
          <label className="text-sm font-medium block mb-1">Asset Type</label>
          <Select
            value={filters.assetType}
            onValueChange={(value) =>
              setFilters((prev) => ({ ...prev, assetType: value as FilterState["assetType"] }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assets</SelectItem>
              <SelectItem value="vm">Virtual Machines</SelectItem>
              <SelectItem value="physical">Physical Servers</SelectItem>
              <SelectItem value="router">Routers</SelectItem>
              <SelectItem value="switch">Switches</SelectItem>
              <SelectItem value="firewall">Firewalls</SelectItem>
              <SelectItem value="storage">Storage</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Status (only for VMs) */}
        <div>
          <label className="text-sm font-medium block mb-1">Status</label>
<Select
  value={filters.status}
  onValueChange={(value) => 
    setFilters(prev => ({ ...prev, status: value as FilterState["status"] }))
  }
>
            <SelectTrigger>
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="SUSPENDED">Suspended</SelectItem>
              <SelectItem value="RETIRED">Retired</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Search */}
        <div className="md:col-span-2">
          <label className="text-sm font-medium block mb-1">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Hostname, IP, model, serial..."
              className="pl-10"
              value={filters.search}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, search: e.target.value }))
              }
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={handleReset}>
          Reset Filters
        </Button>
      </div>
    </div>
  );
}
