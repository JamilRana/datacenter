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
import { Loader2, HardDrive, Network, User, ActivityIcon } from "lucide-react";
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
import { updateVm, deleteVm } from "@/app/actions/vm-actions";
import { getAllActiveUsers } from "@/app/actions/user-actions";
import { VmStatus } from "@/types/enums";
import { SerializedVmInstance } from "@/types/vm";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import { Combobox } from "@/components/ui/combobox";

interface UserOption {
  id: string;
  name: string;
  email: string;
  designation: string | null;
  organization: string | null;
}

interface EditVmModalProps {
  vm: SerializedVmInstance;
}

export function EditVmModal({ vm }: EditVmModalProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>(vm.owner?.id || "unassigned");

  const handleSearch = async () => {
    if (open && users.length === 0) {
      const allUsers = await getAllActiveUsers();
      setUsers(allUsers);
    }
  };



  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.append("id", vm.id);

    startTransition(async () => {
      try {
        await updateVm(formData);
        toast.success("VM updated successfully");
        setOpen(false);
        window.location.reload();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update VM");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (isOpen) handleSearch();
    }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 text-blue-600 hover:text-blue-700 font-bold">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 bg-slate-50 border-b">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-emerald-600" />
            Edit VM Instance
          </DialogTitle>
          <DialogDescription>
            Update the configuration and ownership details for this virtual machine.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Identity Section */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Network className="h-3 w-3" /> Network Identity
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hostname">Hostname</Label>
                <Input id="hostname" name="hostname" defaultValue={vm.hostname || ""} placeholder="vm-prod-web-01" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subdomain">Subdomain</Label>
                <Input id="subdomain" name="subdomain" defaultValue={vm.subdomain || ""} placeholder="example.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ipAddress">IP Address</Label>
                <Input id="ipAddress" name="ipAddress" defaultValue={vm.ipAddress || ""} placeholder="10.0.0.x" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="publicIpAddress">Public IP Address</Label>
                <Input id="publicIpAddress" name="publicIpAddress" defaultValue={vm.publicIpAddress || ""} placeholder="203.0.113.x" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select name="status" defaultValue={vm.status || VmStatus.ACTIVE}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(VmStatus).map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="renewalDate">Renewal Date</Label>
                <Input 
                  id="renewalDate" 
                  name="renewalDate" 
                  type="date" 
                  defaultValue={vm.renewalDate ? vm.renewalDate.split('T')[0] : ""} 
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Specification Section */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <HardDrive className="h-3 w-3" /> Allocation Specs
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vcpu">vCPU (Cores)</Label>
                <Input id="vcpu" name="vcpu" type="number" defaultValue={vm.currentSpec?.vcpu || 1} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ramGb">RAM (GB)</Label>
                <Input id="ramGb" name="ramGb" type="number" defaultValue={vm.currentSpec?.ramGb || 2} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="storageGb">Storage (GB)</Label>
                <Input id="storageGb" name="storageGb" type="number" defaultValue={vm.currentSpec?.storageGb || 50} required />
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* OS Section */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <ActivityIcon className="h-3 w-3" /> System & OS
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="osName">OS Name</Label>
                <Input id="osName" name="osName" defaultValue={vm.currentSpec?.osName || ""} placeholder="Ubuntu" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="osVersion">OS Version</Label>
                <Input id="osVersion" name="osVersion" defaultValue={vm.currentSpec?.osVersion || ""} placeholder="22.04 LTS" />
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Ownership Section */}
          <div className="space-y-4 pb-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <User className="h-3 w-3" /> Ownership & Access
            </h4>
            <div className="space-y-2">
              <Label htmlFor="ownerId">Owner (Optional)</Label>
              <Combobox
                name="ownerId"
                options={[
                  { label: "No Owner Assigned", value: "unassigned" },
                  ...users.map(user => ({
                    label: user.name,
                    value: user.id,
                    description: user.email
                  }))
                ]}
                value={selectedOwnerId}
                onValueChange={setSelectedOwnerId}
                placeholder="Select owner (optional)"
                searchPlaceholder="Search by name or email..."
              />
            </div>
            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  id="hasRemoteAccess" 
                  name="hasRemoteAccess" 
                  className="rounded border-slate-300" 
                  defaultChecked={vm.hasRemoteAccess} 
                  value="true"
                />
                <Label htmlFor="hasRemoteAccess" className="text-sm font-medium">Remote Access</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  id="vpnRequired" 
                  name="vpnRequired" 
                  className="rounded border-slate-300" 
                  defaultChecked={vm.vpnRequired} 
                  value="true"
                />
                <Label htmlFor="vpnRequired" className="text-sm font-medium">VPN Required</Label>
              </div>
            </div>
          </div>

          <DialogFooter className="bg-white border-t p-6">
            <DeleteConfirmationModal
              title="Delete VM"
              description={`Are you sure you want to delete ${vm.hostname || 'this VM'}? This action cannot be undone.`}
              onDelete={async () => {
                await deleteVm(vm.id);
                window.location.reload();
              }}
              trigger={
                <Button type="button" variant="destructive" className="mr-auto">
                  Delete VM
                </Button>
              }
            />
            <Button variant="ghost" type="button" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 min-w-[120px]" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
