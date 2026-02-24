"use client";

import { useState, useTransition } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Server, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { toast } from "sonner";
import { createAsset, updateAsset } from "@/app/actions/asset-actions";
import { AssetType } from "@/types/enums";
import { PhysicalAsset } from "@/types/inventory";

interface AssetModalProps {
  asset?: PhysicalAsset;
  mode?: "create" | "edit";
}

export function AssetModal({ asset, mode = "create" }: AssetModalProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (mode === "edit" && asset) {
      formData.append("id", asset.id);
    }

    startTransition(async () => {
      try {
        if (mode === "create") {
          await createAsset(formData);
          toast.success("Asset registered successfully");
        } else {
          await updateAsset(formData);
          toast.success("Asset updated successfully");
        }
        setOpen(false);
        window.location.reload();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Action failed");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 gap-2 h-11 px-6">
            <Plus className="h-4 w-4" /> Register New Asset
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="h-8 text-blue-600 hover:text-blue-700 font-bold">
            Edit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 bg-slate-50 border-b">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Server className="h-5 w-5 text-blue-600" />
            {mode === "create" ? "Register New Hardware Asset" : "Edit Hardware Asset"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create" 
              ? "Add a new physical asset to the datacenter inventory." 
              : "Update specifications for an existing physical asset."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Asset Name</Label>
              <Input id="name" name="name" defaultValue={asset?.name} placeholder="Hyp-Node-01" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Asset Type</Label>
              <Select name="type" defaultValue={asset?.type || AssetType.SERVER}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(AssetType).map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor</Label>
              <Input id="vendor" name="vendor" defaultValue={asset?.vendor || ""} placeholder="Dell / HP / Cisco" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input id="model" name="model" defaultValue={asset?.model || ""} placeholder="PowerEdge R740" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="serial">Serial Number</Label>
              <Input id="serial" name="serial" defaultValue={asset?.serial || ""} placeholder="Service Tag / SN" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" name="location" defaultValue={asset?.location || ""} placeholder="Rack A-01" />
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Type-Specific Specs (Optional) */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Tag className="h-3 w-3" /> Technical Specifications (Optional)
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cpuCores">CPU Cores</Label>
                <Input id="cpuCores" name="cpuCores" type="number" defaultValue={asset?.cpuCores || ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ramGb">RAM (GB)</Label>
                <Input id="ramGb" name="ramGb" type="number" defaultValue={asset?.ramGb || ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="storageGb">Storage (GB)</Label>
                <Input id="storageGb" name="storageGb" type="number" defaultValue={asset?.storageGb || ""} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="warrantyExpiry">Warranty Expiry</Label>
            <Input 
              id="warrantyExpiry" 
              name="warrantyExpiry" 
              type="date" 
              defaultValue={asset?.warrantyExpiry ? new Date(asset.warrantyExpiry).toISOString().split('T')[0] : ""} 
            />
          </div>

          <DialogFooter className="bg-white border-t p-6">
            <Button variant="ghost" type="button" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 min-w-[120px]" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {mode === "create" ? "Register Asset" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}