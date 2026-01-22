// src/app/requests/components/CustomizationForm.tsx
"use client";
import { useState } from "react";
import { createCustomizationRequest } from "@/app/actions/request-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CustomizationForm({
  vm,
  userId,
}: {
  vm: {
    id: string;
    hostname: string | null;
    vcpu: number;
    ramGb: number;
    additionalDiskGb: number;
  };
  userId: string;
}) {
  const [vcpu, setVcpu] = useState(vm.vcpu);
  const [ramGb, setRamGb] = useState(vm.ramGb);
  const [additionalDiskGb, setAdditionalDiskGb] = useState(0);
  const [purpose, setPurpose] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("userId", userId);
    formData.append("targetVmId", vm.id);
    formData.append("vcpu", vcpu.toString());
    formData.append("ramGb", ramGb.toString());
    formData.append("additionalDiskGb", additionalDiskGb.toString());
    formData.append("purpose", purpose);
    await createCustomizationRequest(formData);
    window.location.href = "/requests";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customize VM: {vm.hostname || vm.id}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Purpose of Change *</Label>
            <Input
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>vCPU (current: {vm.vcpu})</Label>
              <Input
                type="number"
                min={vm.vcpu}
                value={vcpu}
                onChange={(e) =>
                  setVcpu(
                    Math.max(vm.vcpu, parseInt(e.target.value) || vm.vcpu)
                  )
                }
              />
            </div>
            <div>
              <Label>RAM GB (current: {vm.ramGb})</Label>
              <Input
                type="number"
                min={vm.ramGb}
                value={ramGb}
                onChange={(e) =>
                  setRamGb(
                    Math.max(vm.ramGb, parseInt(e.target.value) || vm.ramGb)
                  )
                }
              />
            </div>
            <div>
              <Label>Additional Disk (GB)</Label>
              <Input
                type="number"
                min="0"
                value={additionalDiskGb}
                onChange={(e) =>
                  setAdditionalDiskGb(
                    Math.max(0, parseInt(e.target.value) || 0)
                  )
                }
              />
            </div>
          </div>

          <Button type="submit">Submit Customization Request</Button>
        </form>
      </CardContent>
    </Card>
  );
}
