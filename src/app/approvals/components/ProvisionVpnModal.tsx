"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Shield, Server, Network } from "lucide-react";
import { toast } from "sonner";
import { getExistingVpnUsers, provisionVpnForRequest } from "@/app/actions/access-actions";

interface ProvisionVpnModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  provisionedVms: { id: string; hostname?: string | null; ipAddress?: string | null }[];
  namespaces?: { id: string; name: string }[];
  onSuccess: () => void;
}

export function ProvisionVpnModal({
  open,
  onOpenChange,
  requestId,
  provisionedVms,
  namespaces = [],
  onSuccess,
}: ProvisionVpnModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingUsers, setExistingUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("NEW");

  // Form State
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [vpnProfile, setVpnProfile] = useState("Full Tunnel");
  const [assignedIp, setAssignedIp] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedVmIds, setSelectedVmIds] = useState<string[]>([]);
  const [selectedNamespaceIds, setSelectedNamespaceIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setSelectedUserId("NEW");
      setUsername("");
      setFullName("");
      setVpnProfile("Full Tunnel");
      setAssignedIp("");
      setNotes("");
      // By default, select all provisioned VMs in this request
      setSelectedVmIds(provisionedVms.map((v) => v.id));
      setSelectedNamespaceIds(namespaces.map((n) => n.id));

      const loadUsers = async () => {
        try {
          const users = await getExistingVpnUsers();
          setExistingUsers(users);
        } catch (e) {
          console.error("Failed to load VPN users:", e);
        }
      };
      loadUsers();
    }
  }, [open, provisionedVms, namespaces]);

  const handleUserChange = (val: string) => {
    setSelectedUserId(val);
    if (val === "NEW") {
      setUsername("");
      setFullName("");
      setVpnProfile("Full Tunnel");
      setAssignedIp("");
    } else {
      const user = existingUsers.find((u) => u.id === val);
      if (user) {
        setUsername(user.username);
        setFullName(user.fullName);
        setVpnProfile(user.vpnProfile || "Full Tunnel");
        setAssignedIp(user.vpnIp || "");
      }
    }
  };

  const toggleVm = (vmId: string) => {
    setSelectedVmIds((prev) =>
      prev.includes(vmId) ? prev.filter((id) => id !== vmId) : [...prev, vmId]
    );
  };

  const toggleNamespace = (nsId: string) => {
    setSelectedNamespaceIds((prev) =>
      prev.includes(nsId) ? prev.filter((id) => id !== nsId) : [...prev, nsId]
    );
  };

  const validate = (): boolean => {
    if (!username.trim()) {
      toast.error("Username is required");
      return false;
    }
    if (!fullName.trim()) {
      toast.error("Full Name is required");
      return false;
    }
    if (!assignedIp.trim()) {
      toast.error("VPN IP Address is required");
      return false;
    }
    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    if (!ipRegex.test(assignedIp.trim())) {
      toast.error("Please enter a valid IP address (e.g., 10.8.0.50)");
      return false;
    }
    if (selectedVmIds.length === 0 && selectedNamespaceIds.length === 0) {
      toast.error("Select at least one VM or Kubernetes Namespace to associate with this VPN access");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const result = await provisionVpnForRequest(requestId, {
        username: username.trim(),
        fullName: fullName.trim(),
        vpnProfile,
        assignedIp: assignedIp.trim(),
        selectedVmIds,
        selectedNamespaceIds,
        notes: notes.trim() || undefined,
      });

      if (result.success) {
        toast.success(result.message);
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(result.message);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to provision VPN access");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-amber-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Provision VPN Access</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Assign and activate VPN credentials and resource associations
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="text-slate-400 hover:text-slate-700 rounded-full"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* User Selection */}
          <div className="space-y-2">
            <Label className="font-bold text-slate-700">Assign To VPN User</Label>
            <Select value={selectedUserId} onValueChange={handleUserChange}>
              <SelectTrigger className="border-slate-200 bg-white h-11">
                <SelectValue placeholder="Create a new user or select existing..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NEW" className="font-semibold text-emerald-600">
                  + Create New VPN User Account
                </SelectItem>
                {existingUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.username} ({user.fullName}) - IP: {user.vpnIp}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* User fields card */}
          <Card className="border-slate-200 bg-slate-50/50 shadow-sm">
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">VPN Username *</Label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g., mis_rana"
                    disabled={selectedUserId !== "NEW"}
                    className="bg-white border-slate-200"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">Full Name *</Label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g., Younus Jamil Rana"
                    disabled={selectedUserId !== "NEW"}
                    className="bg-white border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">VPN Profile *</Label>
                  <Select
                    value={vpnProfile}
                    onValueChange={setVpnProfile}
                    disabled={selectedUserId !== "NEW"}
                  >
                    <SelectTrigger className="bg-white border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Full Tunnel">Full Tunnel</SelectItem>
                      <SelectItem value="Split Tunnel">Split Tunnel</SelectItem>
                      <SelectItem value="Admin Access">Admin Access</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">Assigned VPN IP Address *</Label>
                  <Input
                    value={assignedIp}
                    onChange={(e) => setAssignedIp(e.target.value)}
                    placeholder="e.g., 10.8.0.50"
                    disabled={selectedUserId !== "NEW"}
                    className="bg-white border-slate-200"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">Configuration Notes / Remarks</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes or tunnel configuration details..."
                  className="bg-white border-slate-200 resize-none h-18 text-sm"
                />
              </div>
            </CardContent>
          </Card>

          {/* Target VMs Selection */}
          <div className="space-y-3">
            <Label className="font-bold text-slate-800 flex items-center gap-2">
              <Server className="w-4 h-4 text-slate-500" />
              Target Provisioned VMs to Associate ({selectedVmIds.length}/{provisionedVms.length})
            </Label>
            {provisionedVms.length === 0 ? (
              <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-xl text-xs text-amber-800">
                No VMs have been provisioned yet. You can provision VMs first, or assign VPN directly to target namespaces below.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto p-1">
                {provisionedVms.map((vm) => (
                  <div
                    key={vm.id}
                    onClick={() => toggleVm(vm.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedVmIds.includes(vm.id)
                        ? "bg-amber-50/80 border-amber-300 ring-1 ring-amber-300"
                        : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <Checkbox
                      checked={selectedVmIds.includes(vm.id)}
                      onCheckedChange={() => toggleVm(vm.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {vm.hostname || "Virtual Machine"}
                      </p>
                      <p className="text-[11px] font-mono text-slate-500">
                        IP: {vm.ipAddress || "Unassigned"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Target Namespaces Selection if available */}
          {namespaces.length > 0 && (
            <div className="space-y-3">
              <Label className="font-bold text-slate-800 flex items-center gap-2">
                <Network className="w-4 h-4 text-slate-500" />
                Target Kubernetes Namespaces ({selectedNamespaceIds.length}/{namespaces.length})
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {namespaces.map((ns) => (
                  <div
                    key={ns.id}
                    onClick={() => toggleNamespace(ns.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedNamespaceIds.includes(ns.id)
                        ? "bg-indigo-50/80 border-indigo-300 ring-1 ring-indigo-300"
                        : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <Checkbox
                      checked={selectedNamespaceIds.includes(ns.id)}
                      onCheckedChange={() => toggleNamespace(ns.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{ns.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t bg-slate-50 border-slate-100">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="border-slate-200"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
          >
            {isSubmitting ? "Activating VPN..." : "Activate & Assign VPN"}
          </Button>
        </div>
      </div>
    </div>
  );
}
