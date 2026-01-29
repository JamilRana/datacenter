"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Server, ServerCog } from "lucide-react";

// ✅ LOCAL TYPE: Matches EXACT shape passed from InventoryClient
interface AssetRow {
  id: string;
  category: "vm" | "physical"; // Parent uses "category", NOT "type"
  name: string;
  details: string;
  status?: string; // VM status only (string safe for display)
}

interface AssetTableSectionProps {
  assets: AssetRow[];
}

export function AssetTableSection({ assets }: AssetTableSectionProps) {
  // ✅ DYNAMIC TITLE: Compute from asset contents (no external prop needed)
  const hasVms = assets.some(a => a.category === "vm");
  const hasPhysical = assets.some(a => a.category === "physical");
  const title = 
    hasVms && !hasPhysical ? "Virtual Machines" :
    hasPhysical && !hasVms ? "Physical Assets" :
    "All Assets";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <Link href="/inventory/assets" className="text-sm text-primary hover:underline">
          View All
        </Link>
      </CardHeader>
      <CardContent>
        {assets.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No assets match your filters
          </p>
        ) : (
          <div className="space-y-3">
            {assets.map((asset) => (
              <div 
                key={asset.id} 
                className={`flex justify-between items-center p-3 rounded-lg border ${
                  asset.category === "vm" 
                    ? "border-blue-100 bg-blue-50/30" 
                    : "border-emerald-100 bg-emerald-50/30"
                }`}
              >
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {asset.category === "vm" ? (
                      <Server className="h-4 w-4 text-blue-600" />
                    ) : (
                      <ServerCog className="h-4 w-4 text-emerald-600" />
                    )}
                    {asset.name}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {asset.details}
                  </div>
                </div>
                {asset.category === "vm" && asset.status && (
                  <Badge variant={
                    asset.status === "ACTIVE" ? "default" :
                    asset.status === "SUSPENDED" ? "secondary" : "destructive"
                  }>
                    {asset.status}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}