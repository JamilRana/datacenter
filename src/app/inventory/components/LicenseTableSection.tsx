// src/app/inventory/components/LicenseTableSection.tsx
"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export function LicenseTableSection({ licenses }: { licenses: any[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Software Licenses</CardTitle>
        <Link
          href="/inventory/licenses"
          className="text-sm text-primary hover:underline"
        >
          View All
        </Link>
      </CardHeader>
      <CardContent>
        {licenses.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            No licenses recorded
          </p>
        ) : (
          <div className="space-y-2">
            {licenses.map((license) => (
              <div key={license.id} className="flex justify-between text-sm">
                <span className="font-medium">{license.name}</span>
                <span className="text-muted-foreground">
                  {license.usedSeats}/{license.totalSeats} seats
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
