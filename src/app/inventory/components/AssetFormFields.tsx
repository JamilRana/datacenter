"use client";

import { UseFormReturn, Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Asset } from "@/types/inventory"; // Using the Asset type that matches the schema

interface AssetFormFieldsProps {
  form: UseFormReturn<Asset>;
  assetType: string;
}

export function AssetFormFields({ form, assetType }: AssetFormFieldsProps) {
  const { register, control } = form;

  const commonFields = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Name</Label>
        <Input {...register("name")} placeholder="e.g., SIEM Server" />
      </div>
      <div className="space-y-2">
        <Label>Provider</Label>
        <Input {...register("vendor")} placeholder="MIS/UNICEF/WHO etc." />
      </div>
      <div className="space-y-2">
        <Label>Model</Label>
        <Input {...register("model")} />
      </div>
      <div className="space-y-2">
        <Label>Serial Number</Label>
        <Input {...register("serial")} />
      </div>
      <div className="space-y-2">
        <Label>Location</Label>
        <Input {...register("location")} placeholder="Rack A3, Row 5" />
      </div>
      <div className="space-y-2">
        <Label>Warranty Expiry</Label>
        <Input type="date" {...register("warrantyExpiry")} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {commonFields}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
        {assetType === "SERVER" && (
          <>
            <div className="space-y-2">
              <Label>CPU Cores</Label>
              <Input
                type="number"
                {...register("cpuCores", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label>RAM (GB)</Label>
              <Input
                type="number"
                {...register("ramGb", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label>Storage (GB)</Label>
              <Input
                type="number"
                {...register("storageGb", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label>Graphics Card Model</Label>
              <Input {...register("graphicsCardModel")} />
            </div>
            <div className="space-y-2">
              <Label>Graphics Card Spec</Label>
              <Input {...register("graphicsCardSpec")} />
            </div>
          </>
        )}

        {(assetType === "SWITCH" || assetType === "ROUTER" || assetType === "FIREWALL") && (
          <>
            <div className="space-y-2">
              <Label>Interfaces/Ports</Label>
              <Input
                type="number"
                {...register("interfaces", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label>Throughput (Gbps)</Label>
              <Input
                type="number"
                step="0.1"
                {...register("throughputGbps", { valueAsNumber: true })}
              />
            </div>
            {assetType === "SWITCH" && (
              <div className="flex items-center justify-between p-3 border rounded-md col-span-full">
                <Label htmlFor="vlan-support">VLAN Support</Label>
                <Controller
                  control={control}
                  name="vlanSupport"
                  render={({ field }) => (
                    <Switch
                      id="vlan-support"
                      checked={field.value ?? false}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>
            )}
          </>
        )}

        {assetType === "STORAGE" && (
          <>
            <div className="space-y-2">
              <Label>Capacity (TB)</Label>
              <Input
                type="number"
                step="0.1"
                {...register("capacityTb", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label>Number of Disks</Label>
              <Input
                type="number"
                {...register("noOfDisks", { valueAsNumber: true })}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}