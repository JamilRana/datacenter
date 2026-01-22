// src/app/inventory/licenses/components/Pagination.tsx
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export function Pagination({ totalPages }: { totalPages: number }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const currentPage = Number(searchParams.get("page")) || 1;

  const createPageURL = (pageNumber: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", pageNumber.toString());
    return `${pathname}?${params.toString()}`;
  };

  return (
    <div className="flex justify-center items-center gap-2">
      <button
        onClick={() => router.push(createPageURL(currentPage - 1))}
        disabled={currentPage <= 1 || isPending}
        className="px-3 py-1 border rounded disabled:opacity-50"
      >
        Prev
      </button>

      <span className="px-3 py-1">
        Page {currentPage} of {totalPages}
      </span>

      <button
        onClick={() => router.push(createPageURL(currentPage + 1))}
        disabled={currentPage >= totalPages || isPending}
        className="px-3 py-1 border rounded disabled:opacity-50"
      >
        Next
      </button>
    </div>
  );
}
