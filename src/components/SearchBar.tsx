// src/app/components/SearchBar.tsx
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

export function SearchBar() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const handleSearch = useCallback(
    (term: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (term) {
        params.set("search", term);
      } else {
        params.delete("search");
      }
      params.delete("page"); // reset to page 1 on new search

      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`);
      });
    },
    [searchParams, pathname, router]
  );

  return (
    <input
      type="text"
      placeholder="Search by name, vendor, or department..."
      className="w-full max-w-md px-4 py-2 border rounded-md"
      defaultValue={searchParams.get("search")?.toString() || ""}
      onChange={(e) => handleSearch(e.target.value)}
      disabled={isPending}
    />
  );
}
