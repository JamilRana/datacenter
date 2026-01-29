// src/app/requests/components/VmList.tsx
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RenewButton } from "./RenewButton";
import { VmInstance } from "@/types/inventory";

export function VmList({ vms }: { vms: VmInstance[] }) {
  if (vms.length === 0) {
    return <p className="text-muted-foreground">No VMs provisioned yet.</p>;
  }

  return (
    <div className="border rounded-md">
      <table className="w-full">
        <thead className="bg-muted/20">
          <tr>
            <th className="text-left p-3">Hostname</th>
            <th className="text-left p-3">IP</th>
            <th className="text-left p-3">OS</th>
            <th className="text-left p-3">CPU/RAM</th>
            <th className="text-left p-3">Env</th>
            <th className="text-left p-3">Status</th>
            <th className="text-left p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {vms.map((vm) => (
            <tr key={vm.id} className="border-t">
              <td className="p-3">{vm.hostname || "—"} </td>
              <td className="p-3">{vm.ipAddress || "—"}</td>
              <td className="p-3">
                {vm.vmOsName} {vm.vmOsVersion}
              </td>
              <td className="p-3">
                {vm.currentSpec?.vcpu} vCPU / {vm.currentSpec?.ramGb} GB
              </td>
              <td className="p-3">{vm.request?.environment || "—"}</td>
              <td className="p-3">
                <Badge
                  variant={vm.status === "ACTIVE" ? "default" : "secondary"}
                >
                  {vm.status}
                </Badge>
              </td>
              <td className="p-3">
                <div className="flex gap-2">
                  <Link href={`/requests/customize/${vm.id}`}>
                    <Button size="sm" variant="outline">
                      Customize
                    </Button>
                  </Link>
                  <RenewButton vmId={vm.id} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
