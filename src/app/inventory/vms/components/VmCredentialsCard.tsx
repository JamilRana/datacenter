"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Key, Eye, EyeOff, Mail, Save, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { getVmCredentials, saveVmCredentials, sendCredentialsEmail } from "@/app/actions/vm-management-actions";
import { ROLES, hasRole } from "@/lib/roles";

interface VmCredentialsCardProps {
  vmId: string;
  ownerId: string | null;
  currentUser: {
    id: string;
    roles: string[];
  };
}

export default function VmCredentialsCard({ vmId, ownerId, currentUser }: VmCredentialsCardProps) {
  const isOwner = ownerId === currentUser.id;
  const isAdmin = hasRole(currentUser.roles, ROLES.ADMIN);
  const isDcops = hasRole(currentUser.roles, ROLES.DCOPS);
  
  const canView = isOwner || isAdmin;
  const canEdit = isDcops || isAdmin;

  // View state
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isLoadingCreds, setIsLoadingCreds] = useState(false);
  const [isEmailing, setIsEmailing] = useState(false);

  // Edit/Save state
  const [isEditing, setIsEditing] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleToggleReveal = async () => {
    if (isRevealed) {
      setIsRevealed(false);
      return;
    }

    if (credentials) {
      setIsRevealed(true);
      return;
    }

    try {
      setIsLoadingCreds(true);
      const data = await getVmCredentials(vmId);
      if (data) {
        setCredentials(data);
        setIsRevealed(true);
      } else {
        toast.info("No credentials configured for this VM.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load credentials");
    } finally {
      setIsLoadingCreds(false);
    }
  };

  const handleEmailCredentials = async () => {
    try {
      setIsEmailing(true);
      const res = await sendCredentialsEmail(vmId);
      if (res.success) {
        toast.success("Credentials emailed successfully to the VM owner!");
      } else {
        toast.error("Failed to email credentials");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to email credentials");
    } finally {
      setIsEmailing(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim() || !passwordInput.trim()) {
      toast.error("Username and password are required");
      return;
    }

    try {
      setIsSaving(true);
      const res = await saveVmCredentials(vmId, usernameInput, passwordInput);
      if (res.success) {
        toast.success("Credentials updated successfully!");
        setCredentials({ username: usernameInput, password: passwordInput });
        setIsRevealed(true);
        setIsEditing(false);
        setPasswordInput("");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save credentials");
    } finally {
      setIsSaving(false);
    }
  };

  if (!canView && !canEdit) {
    return null;
  }

  return (
    <Card className="border-none shadow-sm ring-1 ring-slate-200 overflow-hidden">
      <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between py-4">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
          <Key className="h-4 w-4 text-indigo-500" />
          VM Login Credentials
        </CardTitle>
        {canEdit && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
            onClick={() => {
              if (!isEditing) {
                setUsernameInput(credentials?.username || "root");
              }
              setIsEditing(!isEditing);
            }}
          >
            {isEditing ? "Cancel" : "Manage"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="pt-5 space-y-4">
        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-xs font-bold text-slate-500 uppercase tracking-wide">Username *</Label>
              <Input 
                id="username"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="e.g. root"
                className="h-9 border-slate-200"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pass" className="text-xs font-bold text-slate-500 uppercase tracking-wide">Password / Key *</Label>
              <Input 
                id="pass"
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••••••"
                className="h-9 border-slate-200"
                required
              />
            </div>
            <Button type="submit" disabled={isSaving} className="w-full h-9 gap-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700">
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Credentials
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            {canView ? (
              <>
                <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-400 uppercase tracking-wider">Username</span>
                    <span className="font-semibold text-slate-700 font-mono">
                      {isRevealed && credentials ? credentials.username : "••••••"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-400 uppercase tracking-wider">Password</span>
                    <span className="font-semibold text-slate-700 font-mono">
                      {isRevealed && credentials ? credentials.password : "••••••••••••"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-9 gap-1.5 text-xs font-bold text-slate-700 border-slate-200 hover:bg-slate-50"
                    onClick={handleToggleReveal}
                    disabled={isLoadingCreds}
                  >
                    {isLoadingCreds ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isRevealed ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                    {isRevealed ? "Hide" : "Reveal"}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-9 gap-1.5 text-xs font-bold text-slate-700 border-slate-200 hover:bg-slate-50"
                    onClick={handleEmailCredentials}
                    disabled={isEmailing}
                  >
                    {isEmailing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Mail className="h-3.5 w-3.5" />
                    )}
                    Email Me
                  </Button>
                </div>
              </>
            ) : (
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-800 leading-relaxed font-medium">
                  You are not authorized to view these credentials. Only the VM owner or an Administrator can view credentials.
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
