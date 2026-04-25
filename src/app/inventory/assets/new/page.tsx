// src/app/inventory/assets/new/page.tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
  Server, 
  Tag, 
  ChevronLeft, 
  Loader2,
  HardDrive,
  Cpu,
  MemoryStick
} from "lucide-react";
import Link from "next/link";
import { createAsset } from "@/app/actions/asset-actions";
import { AssetType } from "@/types/enums";
import { ROLES } from "@/lib/roles";

export default function NewAssetPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isPending, startTransition] = useTransition();

  if (!session) return null;

  const canCreate = session.user.roles.includes(ROLES.ADMIN) || session.user.roles.includes(ROLES.DCOPS);
  if (!canCreate) {
    router.push("/inventory/assets");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await createAsset(formData);
        toast.success("Asset created successfully");
        router.push("/inventory/assets");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to create asset");
      }
    });
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/inventory" className="hover:text-indigo-600">Inventory</Link>
        <span>/</span>
        <Link href="/inventory/assets" className="hover:text-indigo-600">Hardware Assets</Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">New Asset</span>
      </nav>

      <div className="flex items-center gap-4">
        <Link href="/inventory/assets">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Register Hardware Asset</h1>
          <p className="text-slate-500 mt-1">Add a new physical asset to the datacenter inventory</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Server className="h-5 w-5 text-indigo-600" />
              Basic Information
            </CardTitle>
            <CardDescription>Essential details about the hardware asset</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Asset Name *</Label>
              <Input id="name" name="name" placeholder="e.g., Hyp-Node-01" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Asset Type *</Label>
              <Select name="type" defaultValue={AssetType.SERVER}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(AssetType).map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor">Provider</Label>
              <Input id="vendor" name="vendor" placeholder="MIS/UNICEF/WHO etc." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input id="model" name="model" placeholder="e.g., PowerEdge R740" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="serial">Serial Number</Label>
              <Input id="serial" name="serial" placeholder="Service Tag / Serial Number" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" name="location" placeholder="e.g., Rack A-01, Row 3" />
            </div>
          </CardContent>
        </Card>

        {/* Technical Specifications */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Tag className="h-5 w-5 text-indigo-600" />
              Technical Specifications
            </CardTitle>
            <CardDescription>Hardware specifications (optional)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cpuCores" className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-slate-400" /> CPU Cores
                </Label>
                <Input id="cpuCores" name="cpuCores" type="number" placeholder="e.g., 64" className="no-spinner" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ramGb" className="flex items-center gap-2">
                  <MemoryStick className="h-4 w-4 text-slate-400" /> RAM (GB)
                </Label>
                <Input id="ramGb" name="ramGb" type="number" placeholder="e.g., 256" className="no-spinner" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="storageGb" className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-slate-400" /> Storage (GB)
                </Label>
                <Input id="storageGb" name="storageGb" type="number" placeholder="e.g., 2000" className="no-spinner" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="warrantyExpiry">Warranty Expiry Date</Label>
              <Input id="warrantyExpiry" name="warrantyExpiry" type="date" />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Register Asset
          </Button>
        </div>
      </form>
    </div>
  );
}
