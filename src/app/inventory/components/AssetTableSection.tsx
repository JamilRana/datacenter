// src/app/inventory/components/AssetTableSection.tsx
"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export function AssetTableSection({ assets }: { assets: any[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Physical Assets</CardTitle>
        <Link
          href="/inventory/assets"
          className="text-sm text-primary hover:underline"
        >
          View All
        </Link>
      </CardHeader>
      <CardContent>
        {assets.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            No assets recorded
          </p>
        ) : (
          <div className="space-y-2">
            {assets.map((asset) => (
              <div key={asset.id} className="flex justify-between text-sm">
                <span className="font-medium">{asset.name}</span>
                <span className="text-muted-foreground">
                  {asset.type.replace(/_/g, " ")} • {asset.serial || "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
