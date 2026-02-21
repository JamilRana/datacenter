// src/app/components/vms/VmFilters.tsx
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

type VmStatus = "ACTIVE" | "SUSPENDED" | "RETIRED"

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

  const statuses: (VmStatus | "all")[] = [
    "all",
    "ACTIVE",
    "SUSPENDED",
    "RETIRED",
  ];

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {statuses.map((status) => (
        <button
          key={status}
          onClick={() => router.push(createFilterUrl(status))}
          className={`px-4 py-2 text-sm rounded-lg transition-colors ${
            currentStatus === status
              ? "bg-indigo-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {status === "all"
            ? "All VMs"
            : status.charAt(0) + status.slice(1).toLowerCase()}
        </button>
      ))}
    </div>
  );
}
