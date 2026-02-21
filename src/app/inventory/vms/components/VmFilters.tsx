// src/app/inventory/vms/components/VmFilters.tsx
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { VmStatus } from "@/types/enums";
import { useCallback } from "react";

export default function VmFilters({
  currentStatus,
}: {
  currentStatus: VmStatus | "all";
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const createFilterUrl = useCallback(
    (status: VmStatus | "all") => {
      const params = new URLSearchParams(searchParams.toString());
      if (status === "all") {
        params.delete("status");
      } else {
        params.set("status", status);
      }
      params.delete("page"); // reset to page 1
      return `${pathname}?${params.toString()}`;
    },
    [searchParams, pathname]
  );

  const statuses: { label: string; value: VmStatus | "all" }[] = [
    { label: "All VMs", value: "all" },
    { label: "Active", value: "ACTIVE" as VmStatus },
    { label: "Suspended", value: "SUSPENDED" as VmStatus },
    { label: "Retired", value: "RETIRED" as VmStatus },
  ];

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {statuses.map((statusOption) => (
        <button
          key={statusOption.value}
          onClick={() => router.push(createFilterUrl(statusOption.value))}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            currentStatus === statusOption.value
              ? "bg-blue-600 text-white shadow-md shadow-blue-100"
              : "bg-white text-slate-400 hover:text-slate-600 border border-slate-100"
          }`}
        >
          {statusOption.label}
        </button>
      ))}
    </div>
  );
}
