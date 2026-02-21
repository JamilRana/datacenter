// src/app/requests/components/VmList.tsx

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RenewButton } from "./RenewButton";
import { useState } from "react";
import { useSession } from "next-auth/react";
import {  SerializedVmInstanceDetail } from "@/types/vm";
import { CustomizationModal } from "../customize/components/CustomizationModal";

export function VmList({ vms }: { vms: SerializedVmInstanceDetail [] }) {
  const {data:session} = useSession();
  const [isModalOpen, setIsModalOpen] = useState(false);
  if(!session?.user) return null;

  if (vms.length === 0) {
    return <p className="text-muted-foreground">No VMs provisioned yet.</p>;
  }

    const handleOpenModal = () => {
      setIsModalOpen(true);
    };

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
                {vm.currentSpec?.osName} {vm.currentSpec?.osVersion}
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

                    <Button size="sm" variant="outline" onClick={handleOpenModal}>
                      Customize
                    </Button>

                  <RenewButton vmId={vm.id} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <CustomizationModal
  open={isModalOpen}
  onOpenChange={setIsModalOpen}
  vms={vms}
  mode="create"
/>
    </div>
  );
}
