// src/app/inventory/components/VmTableSection.tsx
"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export function VmTableSection({ vms }: { vms: any[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>VM Instances</CardTitle>
        <Link
          href="/inventory/vms"
          className="text-sm text-primary hover:underline"
        >
          View All
        </Link>
      </CardHeader>
      <CardContent>
        {vms.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            No VMs provisioned
          </p>
        ) : (
          <div className="space-y-2">
            {vms.map((vm) => (
              <div key={vm.id} className="flex justify-between text-sm">
                <span className="font-medium">
                  {vm.hostname || `VM #${vm.sequenceNumber}`}
                </span>
                <span className="text-muted-foreground">
                  {vm.ipAddress || "—"} • {vm.request.systemName}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
