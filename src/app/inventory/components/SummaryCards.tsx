// src/app/inventory/components/SummaryCards.tsx
"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SummaryCards({
  summary,
}: {
  summary: { assets: number; vms: number; licenses: number };
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Physical Assets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.assets}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">VM Instances</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.vms}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">
            Software Licenses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.licenses}</div>
        </CardContent>
      </Card>
    </div>
  );
}
