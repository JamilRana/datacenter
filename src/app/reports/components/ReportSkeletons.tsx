"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw, FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReportKpiSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-${count} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-5 bg-white rounded-xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24 bg-slate-200" />
            <Skeleton className="h-5 w-12 rounded-full bg-slate-100" />
          </div>
          <Skeleton className="h-8 w-20 bg-slate-200" />
          <Skeleton className="h-3 w-32 bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export function ReportTableSkeleton({ rows = 6, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-4 space-y-4">
      <div className="flex justify-between items-center pb-2">
        <Skeleton className="h-9 w-64 bg-slate-100 rounded-lg" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20 bg-slate-100 rounded-lg" />
          <Skeleton className="h-9 w-20 bg-slate-100 rounded-lg" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-10 bg-slate-50 border-b border-slate-100 rounded-md flex items-center px-4 gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-3.5 flex-1 bg-slate-200" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="h-12 border-b border-slate-50 flex items-center px-4 gap-4">
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton key={c} className="h-3.5 flex-1 bg-slate-100" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReportEmptyState({
  message = "No data for this period and filters",
  onClearFilters,
}: {
  message?: string;
  onClearFilters?: () => void;
}) {
  return (
    <div className="py-14 px-6 text-center bg-white rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center gap-3">
      <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
        <FilterX className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <h4 className="text-sm font-bold text-slate-800">{message}</h4>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Try broadening your search query, clearing filters, or adjusting the date range preset.
        </p>
      </div>
      {onClearFilters && (
        <Button
          variant="outline"
          size="sm"
          onClick={onClearFilters}
          className="mt-2 text-xs font-semibold gap-1.5 h-8 border-slate-200 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <FilterX className="h-3.5 w-3.5 text-slate-500" />
          Clear filters
        </Button>
      )}
    </div>
  );
}

export function ReportErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="p-6 bg-rose-50/50 border border-rose-200 rounded-xl text-center flex flex-col items-center justify-center gap-3">
      <div className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
        <AlertCircle className="h-5 w-5" />
      </div>
      <div className="space-y-0.5 max-w-md">
        <h4 className="text-sm font-bold text-rose-900">Failed to load report data</h4>
        <p className="text-xs text-rose-700">{error}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="mt-1 gap-1.5 text-xs font-semibold bg-white border-rose-200 text-rose-800 hover:bg-rose-50 focus-visible:ring-2 focus-visible:ring-rose-500"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Retry
      </Button>
    </div>
  );
}
