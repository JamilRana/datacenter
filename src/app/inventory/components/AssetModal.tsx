// src/app/inventory/components/AssetModal.tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { AssetFormFields } from "./AssetFormFields";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { createAsset } from "@/app/actions/asset-actions";

const ASSET_TYPES = [
  { value: "SERVER", label: "Server" },
  { value: "ROUTER", label: "Router" },
  { value: "SWITCH", label: "Switch" },
  { value: "FIREWALL", label: "Firewall" },
  { value: "STORAGE", label: "Storage" },
  { value: "UPS", label: "UPS" },
  { value: "CONSOLE_SERVER", label: "Console Server" },
  { value: "OTHER", label: "Other" },
];

export function AssetModal() {
  const [open, setOpen] = useState(false);
  const [assetType, setAssetType] = useState("SERVER");

  const form = useForm({
    defaultValues: { type: "SERVER" },
  });

  const onSubmit = async (data: any) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value.toString());
      }
    });
    await createAsset(formData);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add Asset</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Asset</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Asset Type</label>
            <Select value={assetType} onValueChange={setAssetType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {ASSET_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <input type="hidden" {...form.register("type")} value={assetType} />
          <AssetFormFields form={form} assetType={assetType} />

          <DialogFooter>
            <Button type="submit">Create Asset</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
