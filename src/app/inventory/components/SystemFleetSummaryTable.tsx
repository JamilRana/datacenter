"use client";

import React, { useState, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { 
  FolderKanban, 
  Cpu, 
  HardDrive, 
  Database, 
  Filter, 
  X, 
  ChevronDown, 
  ChevronUp, 
  ChevronLeft,
  ChevronRight,
  Search,
  User,
  Users,
  Layers,
  ArrowUpDown
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SystemFleetSummaryRow } from "@/app/actions/vm-management-actions";

interface SystemFleetSummaryTableProps {
  fleets: SystemFleetSummaryRow[];
}

type SortField = "activeVms" | "vcpu" | "ram" | "storage" | "name";

export function SystemFleetSummaryTable({ fleets }: SystemFleetSummaryTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeSearch = searchParams.get("search") || "";
  const [tableFilter, setTableFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("activeVms");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [, startTransition] = React.useTransition();

  React.useEffect(() => {
    setCurrentPage(1);
  }, [tableFilter, sortBy]);

  // Determine which system is currently active in the inventory search
  const activeSelectedSystem = useMemo(() => {
    if (!activeSearch.trim()) return null;
    const lower = activeSearch.toLowerCase().trim();
    if (lower === "standalone" || lower === "unassigned" || lower === "__standalone__") {
      return "__STANDALONE__";
    }
    const match = fleets.find(
      (f) => f.systemName.toLowerCase() === lower
    );
    return match ? match.systemName : activeSearch;
  }, [activeSearch, fleets]);

  const handleApplyFilter = (systemName: string, isStandalone: boolean) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (isStandalone) {
        params.set("search", "standalone");
      } else {
        params.set("search", systemName);
      }
      params.set("page", "1");
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const handleClearFilter = () => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("search");
      params.set("page", "1");
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  // Filter & sort rows within the summary table
  const processedFleets = useMemo(() => {
    let result = [...fleets];

    if (tableFilter.trim()) {
      const q = tableFilter.toLowerCase().trim();
      result = result.filter(
        (f) =>
          f.systemName.toLowerCase().includes(q) ||
          f.owners.some(
            (o) =>
              o.name?.toLowerCase().includes(q) ||
              o.email?.toLowerCase().includes(q)
          ) ||
          f.hostnames.some((h) => h.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      // Keep standalone at the very end unless sorting by name
      if (sortBy !== "name") {
        if (a.isStandalone && !b.isStandalone) return 1;
        if (!a.isStandalone && b.isStandalone) return -1;
      }

      switch (sortBy) {
        case "activeVms":
          return b.activeVmCount - a.activeVmCount;
        case "vcpu":
          return b.totalVcpu - a.totalVcpu;
        case "ram":
          return b.totalRamGb - a.totalRamGb;
        case "storage":
          return b.totalStorageGb - a.totalStorageGb;
        case "name":
          return a.systemName.localeCompare(b.systemName);
        default:
          return 0;
      }
    });

    return result;
  }, [fleets, tableFilter, sortBy]);

  // Fleet overview statistics
  const totalFleetProjects = fleets.filter((f) => !f.isStandalone).length;
  const totalFleetVms = fleets.reduce((acc, f) => acc + f.totalVmCount, 0);

  const totalFleetsCount = processedFleets.length;
  const totalFleetPages = Math.max(1, Math.ceil(totalFleetsCount / pageSize));
  const paginatedFleets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedFleets.slice(start, start + pageSize);
  }, [processedFleets, currentPage, pageSize]);

  if (fleets.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden transition-all">
      {/* Top Header */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-white to-slate-50/50 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100/80">
            <FolderKanban className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                System & Project Fleets
              </h3>
              <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-700 font-medium">
                {totalFleetProjects} {totalFleetProjects === 1 ? "System" : "Systems"}
              </Badge>
              <Badge variant="outline" className="text-xs text-indigo-700 border-indigo-200 bg-indigo-50/50">
                {totalFleetVms} Total VMs
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Aggregated resource footprints and ownership across grouped systems
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          {activeSelectedSystem && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <span className="font-medium">
                Filter:{" "}
                <span className="font-bold">
                  {activeSelectedSystem === "__STANDALONE__"
                    ? "Standalone / Unassigned"
                    : activeSelectedSystem}
                </span>
              </span>
              <button
                type="button"
                onClick={handleClearFilter}
                className="hover:bg-amber-100 rounded p-0.5 ml-1 text-amber-700"
                title="Clear filter"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-xs h-8 text-slate-600 hover:text-slate-900 gap-1 font-medium"
          >
            {isCollapsed ? (
              <>
                Expand Table <ChevronDown className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Collapse <ChevronUp className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Collapsible Content */}
      {!isCollapsed && (
        <div className="p-4 sm:p-5 space-y-4">
          {/* Filter & Sort Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search system name, owner, or hostname..."
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
                className="pl-8 text-xs h-8 bg-slate-50/60 focus:bg-white"
              />
              {tableFilter && (
                <button
                  type="button"
                  onClick={() => setTableFilter("")}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 whitespace-nowrap flex items-center gap-1">
                <ArrowUpDown className="h-3 w-3 text-slate-400" /> Sort By:
              </span>
              <Select value={sortBy} onValueChange={(val) => setSortBy(val as SortField)}>
                <SelectTrigger className="w-[160px] h-8 text-xs bg-white">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activeVms" className="text-xs">Most Active VMs</SelectItem>
                  <SelectItem value="vcpu" className="text-xs">Highest vCPU</SelectItem>
                  <SelectItem value="ram" className="text-xs">Highest RAM (GB)</SelectItem>
                  <SelectItem value="storage" className="text-xs">Highest Storage (GB)</SelectItem>
                  <SelectItem value="name" className="text-xs">System Name (A-Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto rounded-lg border border-slate-200/80">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 text-slate-600 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3.5">System / Project</th>
                  <th className="py-2.5 px-3.5">System Owner(s)</th>
                  <th className="py-2.5 px-3.5 text-center">Active Nodes</th>
                  <th className="py-2.5 px-3.5 text-center">vCPU</th>
                  <th className="py-2.5 px-3.5 text-center">RAM</th>
                  <th className="py-2.5 px-3.5 text-center">Storage</th>
                  <th className="py-2.5 px-3.5 text-right">Quick Drilldown</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {processedFleets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                      No matching systems found for &quot;{tableFilter}&quot;
                    </td>
                  </tr>
                ) : (
                  paginatedFleets.map((fleet) => {
                    const isRowFiltered =
                      activeSelectedSystem &&
                      (fleet.isStandalone
                        ? activeSelectedSystem === "__STANDALONE__"
                        : activeSelectedSystem.toLowerCase() === fleet.systemName.toLowerCase());

                    return (
                      <tr
                        key={fleet.systemName}
                        className={`transition-colors hover:bg-slate-50/70 ${
                          isRowFiltered ? "bg-amber-50/40 font-medium" : ""
                        }`}
                      >
                        {/* System Name */}
                        <td className="py-3 px-3.5">
                          <div className="flex items-center gap-2">
                            {fleet.isStandalone ? (
                              <div className="p-1 rounded bg-slate-100 text-slate-500">
                                <Layers className="h-3.5 w-3.5" />
                              </div>
                            ) : (
                              <div className="p-1 rounded bg-indigo-50 text-indigo-600">
                                <FolderKanban className="h-3.5 w-3.5" />
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                <span>{fleet.systemName}</span>
                                {fleet.isStandalone && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0 border-slate-300 text-slate-500 font-normal"
                                  >
                                    Standalone
                                  </Badge>
                                )}
                              </div>
                              {fleet.environments.length > 0 && (
                                <div className="flex gap-1 mt-0.5">
                                  {fleet.environments.slice(0, 3).map((env) => (
                                    <span
                                      key={env}
                                      className="text-[9px] uppercase px-1 py-0.2 bg-slate-100 text-slate-600 rounded font-mono"
                                    >
                                      {env}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Owner */}
                        <td className="py-3 px-3.5">
                          {fleet.owners.length === 0 ? (
                            <span className="text-slate-400 italic">Unassigned</span>
                          ) : fleet.owners.length === 1 ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                                {fleet.owners[0].name ? fleet.owners[0].name[0].toUpperCase() : <User className="h-3 w-3" />}
                              </div>
                              <div className="leading-tight">
                                <p className="text-slate-800 font-medium text-xs truncate max-w-[150px]">
                                  {fleet.owners[0].name || fleet.owners[0].email}
                                </p>
                                <p className="text-[10px] text-slate-400 truncate max-w-[150px]">
                                  {fleet.owners[0].email}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px]">
                                <Users className="h-3 w-3" />
                              </div>
                              <div className="leading-tight">
                                <p className="text-slate-800 font-medium text-xs truncate max-w-[150px]">
                                  {fleet.owners[0].name || fleet.owners[0].email}
                                </p>
                                <p className="text-[10px] text-indigo-600 font-medium">
                                  +{fleet.owners.length - 1} other {fleet.owners.length - 1 === 1 ? "owner" : "owners"}
                                </p>
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Active Nodes */}
                        <td className="py-3 px-3.5 text-center">
                          <div className="inline-flex flex-col items-center">
                            <span className="font-bold text-slate-900">
                              {fleet.activeVmCount} Active
                            </span>
                            {fleet.suspendedVmCount > 0 && (
                              <span className="text-[10px] text-amber-600 font-medium">
                                {fleet.suspendedVmCount} Suspended
                              </span>
                            )}
                            {fleet.retiredVmCount > 0 && (
                              <span className="text-[10px] text-slate-400">
                                {fleet.retiredVmCount} Retired
                              </span>
                            )}
                          </div>
                        </td>

                        {/* vCPU */}
                        <td className="py-3 px-3.5 text-center">
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-800 bg-blue-50/70 text-blue-700 px-2 py-0.5 rounded-md">
                            <Cpu className="h-3 w-3" />
                            {fleet.totalVcpu} cores
                          </span>
                        </td>

                        {/* RAM */}
                        <td className="py-3 px-3.5 text-center">
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-800 bg-emerald-50/70 text-emerald-700 px-2 py-0.5 rounded-md">
                            <Database className="h-3 w-3" />
                            {fleet.totalRamGb} GB
                          </span>
                        </td>

                        {/* Storage */}
                        <td className="py-3 px-3.5 text-center">
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-800 bg-purple-50/70 text-purple-700 px-2 py-0.5 rounded-md">
                            <HardDrive className="h-3 w-3" />
                            {fleet.totalStorageGb >= 1000
                              ? `${(fleet.totalStorageGb / 1024).toFixed(1)} TB`
                              : `${fleet.totalStorageGb} GB`}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3.5 text-right">
                          {isRowFiltered ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleClearFilter}
                              className="h-7 text-xs gap-1 border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 font-semibold"
                            >
                              <X className="h-3 w-3" /> Clear Filter
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleApplyFilter(fleet.systemName, fleet.isStandalone)}
                              className="h-7 text-xs gap-1 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-medium"
                            >
                              <Filter className="h-3 w-3" /> Filter VMs
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Fleets Pagination Footer */}
          {totalFleetsCount > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 text-xs text-slate-500">
              <div className="flex items-center gap-3">
                <span>
                  Showing <strong className="text-slate-800 font-semibold">{(currentPage - 1) * pageSize + 1}</strong> &ndash;{" "}
                  <strong className="text-slate-800 font-semibold">{Math.min(currentPage * pageSize, totalFleetsCount)}</strong> of{" "}
                  <strong className="text-slate-800 font-semibold">{totalFleetsCount}</strong> systems
                </span>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    aria-label="Systems per page"
                    className="h-7 px-1.5 rounded border border-slate-200 bg-white text-xs font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {[5, 10, 20, 50].map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400 font-medium mr-1">
                  Page <strong className="text-slate-700">{currentPage}</strong> of <strong className="text-slate-700">{totalFleetPages}</strong>
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="h-7 w-7 p-0 border-slate-200 text-slate-600 disabled:opacity-40"
                  title="Previous page"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalFleetPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalFleetPages || Math.abs(p - currentPage) <= 1)
                    .reduce<(number | string)[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                        acc.push("...");
                      }
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item, idx) => {
                      if (typeof item !== "number") {
                        return (
                          <span key={`ell-${idx}`} className="px-1 text-slate-400 font-bold text-xs select-none">
                            ...
                          </span>
                        );
                      }
                      const isActive = item === currentPage;
                      return (
                        <Button
                          key={`fp-${item}`}
                          variant={isActive ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(item)}
                          className={`h-7 min-w-[28px] px-2 text-xs font-bold ${
                            isActive
                              ? "bg-indigo-600 text-white border-transparent"
                              : "border-slate-200 bg-white hover:text-indigo-600"
                          }`}
                        >
                          {item}
                        </Button>
                      );
                    })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalFleetPages, p + 1))}
                  disabled={currentPage >= totalFleetPages}
                  className="h-7 w-7 p-0 border-slate-200 text-slate-600 disabled:opacity-40"
                  title="Next page"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
