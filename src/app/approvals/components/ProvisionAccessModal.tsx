"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, User, Globe } from "lucide-react";
import { toast } from "sonner";
import { getExistingHorizonUsers, getExistingVpnUsers, provisionAccessRequest } from "@/app/actions/access-actions";

interface ProvisionAccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: any;
  onSuccess: () => void;
}

export function ProvisionAccessModal({
  open,
  onOpenChange,
  request,
  onSuccess,
}: ProvisionAccessModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingUsers, setExistingUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("NEW");
  
  // Fields state
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [vpnProfile, setVpnProfile] = useState("Full Tunnel");
  const [assignedIp, setAssignedIp] = useState("");
  const [notes, setNotes] = useState("");

  const isVpn = request?.requestType === "VPN_ACCESS";

  useEffect(() => {
    if (open) {
      setSelectedUserId("NEW");
      setUsername("");
      setFullName("");
      setEmail("");
      setVpnProfile("Full Tunnel");
      setAssignedIp("");
      setNotes("");

      // Fetch existing users
      const fetchUsers = async () => {
        try {
          const users = isVpn 
            ? await getExistingVpnUsers() 
            : await getExistingHorizonUsers();
          setExistingUsers(users);
        } catch (e) {
          console.error("Failed to load existing users", e);
        }
      };
      fetchUsers();
    }
  }, [open, isVpn]);

  const handleUserChange = (val: string) => {
    setSelectedUserId(val);
    if (val === "NEW") {
      setUsername("");
      setFullName("");
      setEmail("");
      if (isVpn) {
        setVpnProfile("Full Tunnel");
        setAssignedIp("");
      }
    } else {
      const user = existingUsers.find(u => u.id === val);
      if (user) {
        setUsername(user.username);
        setFullName(user.fullName);
        setEmail(user.email || "");
        if (isVpn) {
          setVpnProfile(user.vpnProfile);
          setAssignedIp(user.vpnIp);
        }
      }
    }
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
    if (isVpn && !assignedIp.trim()) {
      toast.error("VPN IP Address is required");
      return false;
    }
    // Simple IP address regex check
    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    if (assignedIp.trim() && !ipRegex.test(assignedIp.trim())) {
      toast.error("Please enter a valid IP address");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const result = await provisionAccessRequest(request.id, {
        username: username.trim(),
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        vpnProfile: isVpn ? vpnProfile : undefined,
        assignedIp: assignedIp.trim() || undefined,
        notes: notes.trim() || undefined,
        expiresAt: null,
      });

      if (result.success) {
        toast.success(result.message);
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(result.message);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to provision access");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => onOpenChange(false)}
          />

          {/* Modal Container */}
          <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-2xl m-4 border border-slate-100">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isVpn ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Provision {isVpn ? "VPN" : "Horizon"} Access
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Assign and activate user permissions and resources
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* User Selection */}
              <div className="space-y-2">
                <Label className="font-semibold text-slate-700">Assign To User</Label>
                <Select value={selectedUserId} onValueChange={handleUserChange}>
                  <SelectTrigger className="border-slate-200">
                    <SelectValue placeholder="Create a new user or select existing..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW" className="font-semibold text-emerald-600">
                      + Create New {isVpn ? "VPN" : "Horizon"} User
                    </SelectItem>
                    {existingUsers.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.username} ({user.fullName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* User fields card */}
              <Card className="border-slate-100 shadow-sm bg-slate-50/30">
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-700 font-medium">Username *</Label>
                      <Input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="e.g., rana_dev"
                        disabled={selectedUserId !== "NEW"}
                        className="bg-white border-slate-200"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-700 font-medium">Full Name *</Label>
                      <Input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g., Rana Ahmed"
                        disabled={selectedUserId !== "NEW"}
                        className="bg-white border-slate-200"
                      />
                    </div>
                  </div>

                  {!isVpn && (
                    <div className="space-y-2">
                      <Label className="text-slate-700 font-medium">Email Address</Label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g., rana@dghs.gov.bd"
                        disabled={selectedUserId !== "NEW"}
                        className="bg-white border-slate-200"
                      />
                    </div>
                  )}

                  {isVpn && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-slate-700 font-medium">VPN Profile style *</Label>
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
                        <Label className="text-slate-700 font-medium">Assigned VPN IP *</Label>
                        <Input
                          value={assignedIp}
                          onChange={(e) => setAssignedIp(e.target.value)}
                          placeholder="e.g., 10.8.0.50"
                          disabled={selectedUserId !== "NEW"}
                          className="bg-white border-slate-200"
                        />
                      </div>
                    </div>
                  )}

                  {!isVpn && (
                    <div className="space-y-2">
                      <Label className="text-slate-700 font-medium">Assigned Horizon IP Address</Label>
                      <Input
                        value={assignedIp}
                        onChange={(e) => setAssignedIp(e.target.value)}
                        placeholder="e.g., 192.168.10.50 (optional)"
                        className="bg-white border-slate-200"
                      />
                    </div>
                  )}



                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Provisioning Notes / Instructions</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any config details or static assignments notes..."
                      className="bg-white border-slate-200 resize-none h-20"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Resource List Summary */}
              <div className="space-y-3">
                <Label className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-slate-500" />
                  Assigned Resources ({request?.requestResources?.length || 0})
                </Label>
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50/50 max-h-40 overflow-y-auto divide-y divide-slate-100">
                  {request?.requestResources?.map((res: any) => (
                    <div key={res.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          res.vmId ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                        }`}>
                          {res.vmId ? 'VM' : 'K8S'}
                        </span>
                        <span className="font-semibold text-slate-800">
                          {res.vmId 
                            ? (res.vm?.hostname || "Virtual Machine") 
                            : (res.namespace?.name || "K8s Namespace")}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {res.vmId 
                          ? `IP: ${res.vm?.ipAddress || "N/A"}`
                          : `Supervisor: ${res.namespace?.supervisorIp || "N/A"}`}
                      </span>
                    </div>
                  ))}
                  {(!request?.requestResources || request.requestResources.length === 0) && (
                    <p className="text-xs text-slate-400 p-4 text-center">No target resources mapped to this request</p>
                  )}
                </div>
              </div>
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
                className={isVpn ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}
              >
                {isSubmitting ? "Provisioning..." : "Activate & Provision"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
