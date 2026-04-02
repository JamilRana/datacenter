"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DashboardSkeletonProps {
  className?: string;
}

export function StatsRowSkeleton({ className }: DashboardSkeletonProps) {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4", className)}>
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-5">
            <div className="space-y-3">
              <div className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
              <div className="h-8 w-16 bg-slate-200 rounded animate-pulse" />
              <div className="h-2 w-24 bg-slate-200 rounded animate-pulse" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ChartSkeleton({ className }: DashboardSkeletonProps) {
  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="h-4 w-32 bg-slate-200 rounded animate-pulse mb-4" />
        <div className="h-64 bg-slate-100 rounded animate-pulse" />
      </CardContent>
    </Card>
  );
}

export function TableSkeleton({ className }: DashboardSkeletonProps) {
  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="h-4 w-40 bg-slate-200 rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <StatsRowSkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <TableSkeleton />
    </div>
  );
}
