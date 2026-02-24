"use client";

import { useState, useTransition, useEffect } from "react";
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
import { Plus, Loader2, HardDrive, Network, User, Activity, Search } from "lucide-react";
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
import { createManualVm } from "@/app/actions/vm-actions";
import { getAllActiveUsers } from "@/app/actions/user-actions";
import { VmStatus, Raid } from "@/types/enums";

interface UserOption {
  id: string;
  name: string;
  email: string;
  designation: string | null;
  organization: string | null;
}

export function ManualVmModal({ actorId }: { actorId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("unassigned");

  useEffect(() => {
    if (open) {
      getAllActiveUsers().then(setUsers);
    }
  }, [open]);

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        const result = await createManualVm(formData, actorId);
        if (result) {
          toast.success("VM registered successfully");
          setOpen(false);
          window.location.reload();
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to register VM");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100 gap-2 h-11 px-6">
          <Plus className="h-4 w-4" /> Register Ad-hoc VM
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 bg-slate-50 border-b">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-emerald-600" />
            Manual VM Registration
          </DialogTitle>
          <DialogDescription>
            Register a virtual machine that was provisioned manually without a formal request.
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
                <Input id="hostname" name="hostname" placeholder="vm-prod-web-01" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subdomain">Subdomain</Label>
                <Input id="subdomain" name="subdomain" placeholder="example.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ipAddress">IP Address</Label>
                <Input id="ipAddress" name="ipAddress" placeholder="10.0.0.x" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Initial Status</Label>
                <Select name="status" defaultValue={VmStatus.ACTIVE}>
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
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Specifications Section */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Activity className="h-3 w-3" /> Specifications
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vcpu">vCPU Cores</Label>
                <Input id="vcpu" name="vcpu" type="number" defaultValue={2} min={1} required className="no-spinner" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ramGb">RAM (GB)</Label>
                <Input id="ramGb" name="ramGb" type="number" defaultValue={4} min={1} required className="no-spinner" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="storageGb">Storage (GB)</Label>
                <Input id="storageGb" name="storageGb" type="number" defaultValue={50} min={1} required className="no-spinner" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="osName">OS Name</Label>
                <Input id="osName" name="osName" placeholder="CentOS / Ubuntu / Windows" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="osVersion">OS Version</Label>
                <Input id="osVersion" name="osVersion" placeholder="7.9 / 22.04 / 2022" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="raid">Storage RAID</Label>
              <Select name="raid" defaultValue={Raid.NONE}>
                <SelectTrigger>
                  <SelectValue placeholder="Select RAID level" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(Raid).map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select 
                  name="ownerId" 
                  value={selectedOwnerId} 
                  onValueChange={setSelectedOwnerId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select owner (optional)" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="unassigned">No Owner Assigned</SelectItem>
                    {filteredUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{user.name}</span>
                          <span className="text-xs text-slate-500">{user.email}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {filteredUsers.length === 0 && searchTerm && (
                  <p className="text-xs text-slate-500">No users found matching &quot;{searchTerm}&quot;</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="hasRemoteAccess" name="hasRemoteAccess" className="rounded border-slate-300" defaultChecked />
                <Label htmlFor="hasRemoteAccess" className="text-sm font-medium">Remote Access</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="vpnRequired" name="vpnRequired" className="rounded border-slate-300" />
                <Label htmlFor="vpnRequired" className="text-sm font-medium">VPN Required</Label>
              </div>
            </div>
          </div>

          <DialogFooter className="bg-white border-t p-6">
            <Button variant="ghost" type="button" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 min-w-[120px]" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Register VM
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
