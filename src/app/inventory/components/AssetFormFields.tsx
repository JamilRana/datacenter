// src/app/inventory/components/AssetFormFields.tsx
"use client";

import { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AssetFormFieldsProps {
  form: UseFormReturn<any>;
  assetType: string;
}

export function AssetFormFields({ form, assetType }: AssetFormFieldsProps) {
  const { register } = form;

  const commonFields = (
    <>
      <div>
        <Label>Name</Label>
        <Input {...register("name")} placeholder="e.g., SIEM Server" />
      </div>
      <div>
        <Label>Vendor</Label>
        <Input {...register("vendor")} placeholder="Dell, Cisco, etc." />
      </div>
      <div>
        <Label>Model</Label>
        <Input {...register("model")} />
      </div>
      <div>
        <Label>Serial Number</Label>
        <Input {...register("serial")} />
      </div>
      <div>
        <Label>Location</Label>
        <Input {...register("location")} placeholder="Rack A3, Row 5" />
      </div>
      <div>
        <Label>Warranty Expiry</Label>
        <Input type="date" {...register("warrantyExpiry")} />
      </div>
    </>
  );

  switch (assetType) {
    case "SERVER":
      return (
        <>
          {commonFields}
          <div>
            <Label>CPU Cores</Label>
            <Input
              type="number"
              {...register("cpuCores", { valueAsNumber: true })}
            />
          </div>
          <div>
            <Label>RAM (GB)</Label>
            <Input
              type="number"
              {...register("ramGb", { valueAsNumber: true })}
            />
          </div>
          <div>
            <Label>Storage (GB)</Label>
            <Input
              type="number"
              {...register("storageGb", { valueAsNumber: true })}
            />
          </div>
          <div>
            <Label>Graphics Card Model</Label>
            <Input {...register("graphicsCardModel")} />
          </div>
          <div>
            <Label>Graphics Card Spec</Label>
            <Input {...register("graphicsCardSpec")} />
          </div>
        </>
      );

    case "SWITCH":
    case "ROUTER":
    case "FIREWALL":
      return (
        <>
          {commonFields}
          <div>
            <Label>Interfaces/Ports</Label>
            <Input
              type="number"
              {...register("interfaces", { valueAsNumber: true })}
            />
          </div>
          <div>
            <Label>Throughput (Gbps)</Label>
            <Input
              type="number"
              step="0.1"
              {...register("throughputGbps", { valueAsNumber: true })}
            />
          </div>
          {assetType === "SWITCH" && (
            <div className="flex items-center justify-between">
              <Label>VLAN Support</Label>
              <Switch {...register("vlanSupport")} />
            </div>
          )}
        </>
      );

    case "STORAGE":
      return (
        <>
          {commonFields}
          <div>
            <Label>Capacity (TB)</Label>
            <Input
              type="number"
              step="0.1"
              {...register("capacityTb", { valueAsNumber: true })}
            />
          </div>
        </>
      );

    default:
      return commonFields;
  }
}
