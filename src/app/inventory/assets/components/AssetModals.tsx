// src/app/inventory/assets/components/AssetModals.tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { createAsset, updateAsset } from "@/app/actions/asset-actions";
import { useState, useEffect } from "react";
import type { Asset } from "@prisma/client";

const assetTypes = [
  "SERVER",
  "ROUTER",
  "SWITCH",
  "FIREWALL",
  "STORAGE",
  "UPS",
  "CONSOLE_SERVER",
  "OTHER",
] as const;

// ─── Edit Modal ─────────────────────────────────────
export function EditAssetModal({ asset }: { asset: Asset }) {
  const [open, setOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await updateAsset(formData);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Asset</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="id" value={asset.id} />
          <AssetFormFields asset={asset} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── New Asset Modal ─────────────────────────────────
export function NewAssetModal() {
  const [open, setOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await createAsset(formData);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add Asset</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Asset</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <AssetFormFields />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Asset</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Shared Form Fields ──────────────────────────────
function AssetFormFields({ asset }: { asset?: Asset }) {
  const [vlanSupport, setVlanSupport] = useState(asset?.vlanSupport ?? false);

  const getString = (value: string | null | undefined) => value ?? "";
  const getNumber = (value: number | null | undefined) => value?.toString() ?? "";
  const getDate = (value: Date | string | null | undefined) => {
    if (!value) return "";
    if (value instanceof Date) return value.toISOString().split("T")[0];
    return value.split("T")[0];
  };

  // Initialize state from prop (for edit)
  useEffect(() => {
    if (asset) {
      setVlanSupport(!!asset.vlanSupport);
    }
  }, [asset]);

  return (
    <>
      <div>
        <Label>Name *</Label>
        <Input name="name" defaultValue={getString(asset?.name)} required />
      </div>

      <div>
        <Label>Type *</Label>
        <Select name="type" defaultValue={getString(asset?.type) || "OTHER"} required>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {assetTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Vendor</Label>
        <Input name="vendor" defaultValue={getString(asset?.vendor)} />
      </div>

      <div>
        <Label>Model</Label>
        <Input name="model" defaultValue={getString(asset?.model)} />
      </div>

      <div>
        <Label>Serial Number</Label>
        <Input name="serial" defaultValue={getString(asset?.serial)} />
      </div>

      <div>
        <Label>Location</Label>
        <Input name="location" defaultValue={getString(asset?.location)} />
      </div>

      <div>
        <Label>Warranty Expiry</Label>
        <Input
          name="warrantyExpiry"
          type="date"
          defaultValue={getDate(asset?.warrantyExpiry)}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2">
        <div>
          <Label>CPU Cores</Label>
          <Input name="cpuCores" type="number" defaultValue={getNumber(asset?.cpuCores)} />
        </div>
        <div>
          <Label>RAM (GB)</Label>
          <Input name="ramGb" type="number" defaultValue={getNumber(asset?.ramGb)} />
        </div>
        <div>
          <Label>Storage (GB)</Label>
          <Input name="storageGb" type="number" defaultValue={getNumber(asset?.storageGb)} />
        </div>
      </div>

      <div>
        <Label>Graphics Card Model</Label>
        <Input name="graphicsCardModel" defaultValue={getString(asset?.graphicsCardModel)} />
      </div>
      <div>
        <Label>Graphics Spec</Label>
        <Textarea name="graphicsCardSpec" defaultValue={getString(asset?.graphicsCardSpec)} />
      </div>

      <div>
        <Label>Interfaces (Ports)</Label>
        <Input name="interfaces" type="number" defaultValue={getNumber(asset?.interfaces)} />
      </div>
      <div>
        <Label>Throughput (Gbps)</Label>
        <Input
          name="throughputGbps"
          type="number"
          step="0.1"
          defaultValue={getNumber(asset?.throughputGbps)}
        />
      </div>
      <div className="flex items-center gap-2">
        <Label>VLAN Support</Label>
        <Switch
          checked={vlanSupport}
          onCheckedChange={setVlanSupport}
          aria-label="VLAN Support"
        />
        <input type="hidden" name="vlanSupport" value={vlanSupport ? "true" : "false"} />
      </div>

      <div>
        <Label>Capacity (TB)</Label>
        <Input
          name="capacityTb"
          type="number"
          step="0.1"
          defaultValue={getNumber(asset?.capacityTb)}
        />
      </div>
    </>
  );
}