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
import { useState } from "react";

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
export function EditAssetModal({ asset }: { asset: any }) {
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
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
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
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
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
function AssetFormFields({ asset }: { asset?: any }) {
  const getValue = (key: string) => asset?.[key] ?? "";
  const getDateValue = (key: string) =>
    asset?.[key] ? asset[key].split("T")[0] : "";

  return (
    <>
      <div>
        <Label>Name *</Label>
        <Input name="name" defaultValue={getValue("name")} required />
      </div>

      <div>
        <Label>Type *</Label>
        <Select name="type" defaultValue={getValue("type") || "OTHER"} required>
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
        <Input name="vendor" defaultValue={getValue("vendor")} />
      </div>

      <div>
        <Label>Model</Label>
        <Input name="model" defaultValue={getValue("model")} />
      </div>

      <div>
        <Label>Serial Number</Label>
        <Input name="serial" defaultValue={getValue("serial")} />
      </div>

      <div>
        <Label>Location</Label>
        <Input name="location" defaultValue={getValue("location")} />
      </div>

      <div>
        <Label>Warranty Expiry</Label>
        <Input
          name="warrantyExpiry"
          type="date"
          defaultValue={getDateValue("warrantyExpiry")}
        />
      </div>

      {/* Compute specs (for servers/workstations) */}
      <div className="grid grid-cols-3 gap-2 pt-2">
        <div>
          <Label>CPU Cores</Label>
          <Input
            name="cpuCores"
            type="number"
            defaultValue={getValue("cpuCores")}
          />
        </div>
        <div>
          <Label>RAM (GB)</Label>
          <Input name="ramGb" type="number" defaultValue={getValue("ramGb")} />
        </div>
        <div>
          <Label>Storage (GB)</Label>
          <Input
            name="storageGb"
            type="number"
            defaultValue={getValue("storageGb")}
          />
        </div>
      </div>

      {/* Graphics (optional) */}
      <div>
        <Label>Graphics Card Model</Label>
        <Input
          name="graphicsCardModel"
          defaultValue={getValue("graphicsCardModel")}
        />
      </div>
      <div>
        <Label>Graphics Spec</Label>
        <Textarea
          name="graphicsCardSpec"
          defaultValue={getValue("graphicsCardSpec")}
        />
      </div>

      {/* Network specs */}
      <div>
        <Label>Interfaces (Ports)</Label>
        <Input
          name="interfaces"
          type="number"
          defaultValue={getValue("interfaces")}
        />
      </div>
      <div>
        <Label>Throughput (Gbps)</Label>
        <Input
          name="throughputGbps"
          type="number"
          step="0.1"
          defaultValue={getValue("throughputGbps")}
        />
      </div>
      <div className="flex items-center gap-2">
        <Label>VLAN Support</Label>
        <Switch
          name="vlanSupport"
          defaultChecked={asset?.vlanSupport}
          aria-label="VLAN Support"
        />
      </div>

      {/* Storage-specific */}
      <div>
        <Label>Capacity (TB)</Label>
        <Input
          name="capacityTb"
          type="number"
          step="0.1"
          defaultValue={getValue("capacityTb")}
        />
      </div>
    </>
  );
}
