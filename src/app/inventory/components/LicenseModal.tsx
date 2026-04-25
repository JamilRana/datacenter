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
import { Plus, Loader2, Award, Calendar, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createLicense, updateLicense } from "@/app/actions/license-actions";
import { SoftwareLicense } from "@/types/inventory";

interface LicenseModalProps {
  license?: SoftwareLicense;
  mode?: "create" | "edit";
}

export function LicenseModal({ license, mode = "create" }: LicenseModalProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (mode === "edit" && license) {
      formData.append("id", license.id);
    }

    startTransition(async () => {
      try {
        if (mode === "create") {
          await createLicense(formData);
          toast.success("License registered successfully");
        } else {
          await updateLicense(formData);
          toast.success("License updated successfully");
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
          <Button className="bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-100 gap-2 h-11 px-6">
            <Plus className="h-4 w-4" /> Register License
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="h-8 text-purple-600 hover:text-purple-700 font-bold">
            Edit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 bg-slate-50 border-b">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Award className="h-5 w-5 text-purple-600" />
            {mode === "create" ? "Register Software License" : "Edit Software License"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create" 
              ? "Add a new enterprise license or subscription to the registry." 
              : "Update details for an existing software license."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">License Name</Label>
              <Input id="name" name="name" defaultValue={license?.name || ""} placeholder="VMware vSphere Ent+" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor">Provider</Label>
              <Input id="vendor" name="vendor" defaultValue={license?.vendor || ""} placeholder="MIS/UNICEF/WHO etc." required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expiryDate" className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" /> Expiry Date
              </Label>
              <Input 
                id="expiryDate" 
                name="expiryDate" 
                type="date" 
                defaultValue={license?.expiryDate ? new Date(license.expiryDate).toISOString().split('T')[0] : ""} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maintenanceExpiry" className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5" /> Maintenance Expiry
              </Label>
              <Input 
                id="maintenanceExpiry" 
                name="maintenanceExpiry" 
                type="date" 
                defaultValue={license?.maintenanceExpiry ? new Date(license.maintenanceExpiry).toISOString().split('T')[0] : ""} 
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes / License Keys</Label>
            <Textarea 
              id="notes" 
              name="notes" 
              defaultValue={license?.notes || ""} 
              placeholder="Enter license keys, support contracts, or usage restrictions..."
              className="min-h-[100px]"
            />
          </div>

          <DialogFooter className="bg-white border-t p-6">
            <Button variant="ghost" type="button" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" className="bg-purple-600 hover:bg-purple-700 min-w-[120px]" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {mode === "create" ? "Register License" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
