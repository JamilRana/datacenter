"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUser, updateUserDetails } from "@/app/actions/user-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription, // Added back for accessibility/linting fix
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  User as UserIcon,
  Mail,
  Briefcase,
  ShieldCheck,
  Power,
  Plus,
  Pencil,
  Trash2,
  Building2,
  Crown,
  Lock,
} from "lucide-react";

import { Role, User, UserFormData } from "@/types/users";

export default function UserTable({ initialUsers, allRoles }: { initialUsers: User[]; allRoles: Role[] }) {
  const router = useRouter();
  
  // Cleaned up unused setUsers
  const [users] = useState(initialUsers); 
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [isPending, setIsPending] = useState(false);

  const [formData, setFormData] = useState<UserFormData>({
    name: "",
    email: "",
    password: "",
    designation: "",
    organization: "",
    contact: "",
    roles: ["REQUESTER"],
  });

  const openEditModal = (user: User) => {
    setFormData({
      id: user.id,
      name: user.name || "",
      email: user.email || "",
      designation: user.designation || "",
      organization: user.organization || "",
      contact: user.contact || "",
      roles: user.roles,
    });
    setIsEditOpen(true);
  };

  const openDeleteModal = (user: User) => {
    setDeletingUser(user);
    setIsDeleteOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent, mode: 'create' | 'edit') => {
    e.preventDefault();
    setIsPending(true);
    try {
      const fData = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (value) {
          if (Array.isArray(value)) value.forEach(v => fData.append(key, v));
          else fData.append(key, value as string);
        }
      });

      if (mode === 'create') await createUser(fData);
      else await updateUserDetails(fData);

      toast.success(`User ${mode === 'create' ? 'created' : 'updated'} successfully`);
      setIsCreateOpen(false);
      setIsEditOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(`Operation failed: ${(err as Error).message}`);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Table Header Section */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">System Users</h2>
          <p className="text-sm text-slate-500">Manage access levels and professional profiles</p>
        </div>
        <Button onClick={() => {
            setFormData({ name: "", email: "", password: "", designation: "", organization: "", contact: "", roles: ["REQUESTER"] });
            setIsCreateOpen(true);
        }} className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-md">
          <Plus className="h-4 w-4" /> Create User
        </Button>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">User / Account</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase hidden md:table-cell">Affiliation</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Role & Access</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${user.roles.includes('ADMIN') ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                      {user.roles.includes('ADMIN') ? <Crown className="h-5 w-5" /> : <UserIcon className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1"><Mail className="h-3 w-3" /> {user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 hidden md:table-cell">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-700 flex items-center gap-1">
                      <Building2 className="h-3 w-3 text-slate-400" /> {user.organization || "No Org"}
                    </p>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Briefcase className="h-3 w-3" /> {user.designation || "No Title"}
                    </p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((r) => (
                        <Badge key={r} variant="secondary" className={`text-[10px] px-1.5 py-0 ${r === 'ADMIN' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100'}`}>
                          {r.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                    {user.isActive ? 
                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> ACTIVE</span> :
                      <span className="text-[10px] text-red-500 font-bold flex items-center gap-1"><Power className="h-3 w-3" /> SUSPENDED</span>
                    }
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => openEditModal(user)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => openDeleteModal(user)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CREATE / EDIT DIALOG */}
      <Dialog open={isCreateOpen || isEditOpen} onOpenChange={(val) => { if(!val) { setIsCreateOpen(false); setIsEditOpen(false); } }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isCreateOpen ? <Plus className="text-blue-600" /> : <Pencil className="text-amber-600" />}
              {isCreateOpen ? "Create New User" : "Update User Profile"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={(e) => handleSubmit(e, isCreateOpen ? 'create' : 'edit')} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                    <Label>Full Name *</Label>
                    <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="John Doe" />
                </div>
                <div className="space-y-2 col-span-2 md:col-span-1">
                    <Label>Email Address *</Label>
                    <Input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="john@company.com" />
                </div>
                {isCreateOpen && (
                    <div className="space-y-2 col-span-2 md:col-span-1">
                        <Label>Initial Password *</Label>
                        <div className="relative">
                            <Input required type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                            <Lock className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-xs">Organization</Label>
                        <Input value={formData.organization} onChange={e => setFormData({...formData, organization: e.target.value})} placeholder="IT Dept" className="bg-white" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs">Designation</Label>
                        <Input value={formData.designation} onChange={e => setFormData({...formData, designation: e.target.value})} placeholder="Lead Developer" className="bg-white" />
                    </div>
                </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold">Security Roles</Label>
              <div className="grid grid-cols-2 gap-2 p-3 border rounded-lg bg-white">
                {allRoles.map((role) => (
                  <label key={role.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer transition-colors">
                    <Checkbox 
                        checked={formData.roles.includes(role.name)} 
                        onCheckedChange={(checked) => {
                            const updated = checked ? [...formData.roles, role.name] : formData.roles.filter(r => r !== role.name);
                            setFormData({...formData, roles: updated});
                        }} 
                    />
                    <span className="text-xs font-medium text-slate-700">{role.name.replace(/_/g, ' ')}</span>
                  </label>
                ))}
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => {setIsCreateOpen(false); setIsEditOpen(false);}}>Cancel</Button>
              <Button type="submit" disabled={isPending} className={isCreateOpen ? "bg-blue-600" : "bg-amber-600"}>
                {isPending ? "Processing..." : isCreateOpen ? "Create Account" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Suspend User Account?</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate <strong>{deletingUser?.name}</strong>? They will no longer be able to log in to the system.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => {
              toast.error("Delete action not yet implemented in parent");
              setIsDeleteOpen(false);
            }}>Confirm Suspension</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}