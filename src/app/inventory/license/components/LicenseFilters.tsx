// app/inventory/licenses/components/LicenseFilters.tsx
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useDebouncedCallback } from "use-debounce";

export default function LicenseFilters({
  search: initialSearch,
  type: initialType,
}: {
  search?: string;
  type?: string;
}) {
  const [searchInput, setSearchInput] = useState(initialSearch || "");
  const [selectedType, setSelectedType] = useState(initialType || "");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const createQueryString = (
    params: Record<string, string | number | null>
  ) => {
    const newParams = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === "") {
        newParams.delete(key);
      } else {
        newParams.set(key, String(value));
      }
    }
    newParams.delete("page"); // reset to page 1 on filter change
    return newParams.toString();
  };

  // Debounced search
  const handleSearch = useDebouncedCallback((value: string) => {
    router.push(`${pathname}?${createQueryString({ search: value || null })}`);
  }, 400);

  useEffect(() => {
    handleSearch(searchInput);
  }, [searchInput, handleSearch]);

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || "";
    setSelectedType(value);
    router.push(`${pathname}?${createQueryString({ type: value || null })}`);
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border mb-6">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
        {/* Search */}
        <div className="flex-1 min-w-0">
          <label
            htmlFor="search"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Search
          </label>
          <input
            type="text"
            id="search"
            placeholder="Name or vendor..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        {/* Type Filter */}
        <div className="w-full md:w-auto">
          <label
            htmlFor="type"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Type
          </label>
          <select
            id="type"
            className="w-full md:w-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={selectedType}
            onChange={handleTypeChange}
          >
            <option value="">All Types</option>
            <option value="SOFTWARE">Software</option>
            {/* Add more if needed */}
          </select>
        </div>
      </div>
    </div>
  );
}
