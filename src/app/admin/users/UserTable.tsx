// // src/app/admin/users/UserTable.tsx
// "use client";

// import { useState } from "react";
// import { updateUserRole, toggleUserStatus } from "@/app/actions/user-actions";
// import { Button } from "@/components/ui/button";
// import { Badge } from "@/components/ui/badge";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { toast } from "sonner";
// import { User, Mail, Briefcase, ShieldCheck, Power } from "lucide-react";
// import { Role } from "@prisma/client";

// interface User {
//    id: string;
//    name: string | null;
//    email: string | null;
//    isActive: boolean;
//    designation?: string | null;
//    roles: { role: { name: string } }[];
// }

// export default function UserTable({ initialUsers, allRoles }: { initialUsers: User[], allRoles: Role[] }) {
//   const [users, setUsers] = useState(initialUsers);

//   const handleRoleChange = async (userId: string, roleName: string) => {
//     try {
//       await updateUserRole(userId, roleName);
//       toast.success("User role updated successfully.");
//       // In a real app, revalidatePath handles this, but for immediate UI feedback:
//       setUsers(prev => prev.map(u => u.id === userId ? { ...u, roles: [{ role: { name: roleName } }] } : u));
//     } catch (err) {
//       toast.error(`Failed to update role.${err as string}`);
//     }
//   };

//   const handleStatusToggle = async (userId: string, currentStatus: boolean) => {
//      try {
//        await toggleUserStatus(userId, currentStatus);
//        toast.success(`User ${currentStatus ? "deactivated" : "activated"} successfully.`);
//        setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: !currentStatus } : u));
//      } catch (err) {
//        toast.error(`Failed to update status.${err}`);
//      }
//   };

//   return (
//     <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
//       <div className="overflow-x-auto">
//         <table className="w-full text-left">
//           <thead className="bg-slate-50/50 border-b border-slate-100">
//             <tr>
//               <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Identify / Account</th>
//               <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden md:table-cell">Professional Context</th>
//               <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Auth Level / Role</th>
//               <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Access State</th>
//               <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
//             </tr>
//           </thead>
//           <tbody className="divide-y divide-slate-100">
//             {users.map((user) => {
//               const currentRole = user.roles[0]?.role?.name || "None";
//               return (
//                 <tr key={user.id} className="hover:bg-blue-50/20 transition-all group">
//                   <td className="px-6 py-5">
//                     <div className="flex items-center gap-4">
//                        <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
//                           <User className="h-4 w-4" />
//                        </div>
//                        <div>
//                           <p className="text-sm font-bold text-slate-800 leading-none">{user.name}</p>
//                           <div className="flex items-center gap-1.5 mt-1.5 text-slate-400">
//                              <Mail className="h-3 w-3" />
//                              <p className="text-[10px] font-medium leading-none">{user.email}</p>
//                           </div>
//                        </div>
//                     </div>
//                   </td>
//                   <td className="px-6 py-5 hidden md:table-cell">
//                     <div className="flex items-center gap-1.5 text-slate-600">
//                        <Briefcase className="h-3.5 w-3.5 text-slate-300" />
//                        <p className="text-xs font-bold leading-none">{user.designation || "Not Specified"}</p>
//                     </div>
//                   </td>
//                   <td className="px-6 py-5">
//                     <Select
//                       defaultValue={currentRole}
//                       onValueChange={(val) => handleRoleChange(user.id, val)}
//                     >
//                       <SelectTrigger className="w-40 h-9 bg-slate-50 border-slate-100 text-xs font-bold ring-0 focus:ring-0">
//                         <SelectValue />
//                       </SelectTrigger>
//                       <SelectContent>
//                         {allRoles.map((role) => (
//                           <SelectItem key={role.id} value={role.name} className="text-xs font-medium">
//                             {role.name.replace(/_/g, ' ')}
//                           </SelectItem>
//                         ))}
//                       </SelectContent>
//                     </Select>
//                   </td>
//                   <td className="px-6 py-5">
//                     {user.isActive ? (
//                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 shadow-none text-[9px] font-black uppercase tracking-tight gap-1">
//                           <ShieldCheck className="h-3 w-3" /> Authorized
//                        </Badge>
//                     ) : (
//                        <Badge variant="destructive" className="text-[9px] font-black uppercase tracking-tight gap-1">
//                           <Power className="h-3 w-3" /> Suspended
//                        </Badge>
//                     )}
//                   </td>
//                   <td className="px-6 py-5 text-right">
//                     <Button
//                       variant="ghost"
//                       size="sm"
//                       className={`font-black text-[10px] uppercase tracking-widest h-8 ${user.isActive ? 'text-red-400 hover:text-red-700 hover:bg-red-50' : 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50'}`}
//                       onClick={() => handleStatusToggle(user.id, user.isActive)}
//                     >
//                       {user.isActive ? "Revoke Access" : "Grant Access"}
//                     </Button>
//                   </td>
//                 </tr>
//               );
//             })}
//           </tbody>
//         </table>
//       </div>
//     </div>
//   );
// }


"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateUserRole,
  toggleUserStatus,
  createUser,
  updateUserDetails,
  deleteUser,
} from "@/app/actions/user-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  EyeOff,
} from "lucide-react";

import { Role, User, UserFormData } from "@/types/users";

export default function UserTable({ 
  initialUsers, 
  allRoles 
}: { 
  initialUsers: User[]; 
  allRoles: Role[] 
}) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  
  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  
  // Form states
  const [createForm, setCreateForm] = useState<UserFormData>({
    name: "",
    email: "",
    password: "",
    designation: "",
    organization: "",
    contact: "",
    roles: ["REQUESTER"],
  });
  
  const [editForm, setEditForm] = useState<UserFormData>({
    name: "",
    email: "",
    designation: "",
    organization: "",
    contact: "",
    roles: [],
  });

  // CREATE handlers
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      Object.entries(createForm).forEach(([key, value]) => {
        if (value) formData.append(key, value);
      });
      
      await createUser(formData);
      toast.success("User created successfully");
      setIsCreateOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(`Creation failed: ${(err as Error).message}`);
    }
  };

  // EDIT handlers
  const openEditModal = (user: User) => {
    setEditingUser(user);
    setEditForm({
      id: user.id,
      name: user.name || "",
      email: user.email || "",
      designation: user.designation || "",
      organization: "",
      contact: "",
      roles: user.roles.map(r => r.role.name), // ✅ EXTRACT ALL ROLES
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    
    try {
      const formData = new FormData();
      formData.append("userId", editingUser.id);
      formData.append("name", editForm.name);
      formData.append("email", editForm.email);
      formData.append("designation", editForm.designation);
      formData.append("organization", editForm.organization);
      formData.append("contact", editForm.contact);
      
      await updateUserDetails(formData);
      toast.success("User updated successfully");
      setIsEditOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(`Update failed: ${(err as Error).message}`);
    }
  };

  // DELETE handlers
  const openDeleteModal = (user: User) => {
    setDeletingUser(user);
    setIsDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingUser) return;
    try {
      await deleteUser(deletingUser.id);
      toast.success(`User "${deletingUser.name}" deactivated successfully`);
      setIsDeleteOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(`Deletion failed: ${(err as Error).message}`);
    }
  };

  // Existing role/status handlers (unchanged)
  const handleRoleChange = async (userId: string, roleName: string) => {
    try {
      await updateUserRole(userId, roleName);
      toast.success("Role updated");
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, roles: [{ role: { name: roleName } }] } : u
      ));
    } catch (err) {
      toast.error(`Role update failed: ${(err as Error).message}`);
    }
  };

  const handleStatusToggle = async (userId: string, currentStatus: boolean) => {
    try {
      await toggleUserStatus(userId, currentStatus);
      toast.success(`User ${currentStatus ? "deactivated" : "activated"}`);
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, isActive: !currentStatus } : u
      ));
    } catch (err) {
      toast.error(`Status update failed: ${(err as Error).message}`);
    }
  };

  return (
    <>
      {/* CREATE USER BUTTON */}
      <div className="flex justify-end mb-4">
        <Button 
          onClick={() => setIsCreateOpen(true)} 
          className="gap-2 bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Create User
        </Button>
      </div>

      {/* USERS TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Identify / Account</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden md:table-cell">Professional Context</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Auth Level / Role</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Access State</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => {
                const currentRole = user.roles[0]?.role?.name || "None";
                return (
                  <tr key={user.id} className="hover:bg-blue-50/20 transition-all group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                          <UserIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800 leading-none">{user.name}</p>
                          <div className="flex items-center gap-1.5 mt-1.5 text-slate-400">
                            <Mail className="h-3 w-3" />
                            <p className="text-[10px] font-medium leading-none">{user.email}</p>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 hidden md:table-cell">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Briefcase className="h-3.5 w-3.5 text-slate-300" />
                        <p className="text-xs font-bold leading-none">{user.designation || "Not Specified"}</p>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-wrap gap-1 max-w-[180px]">
                        {user.roles.length > 0 ? (
                          user.roles.map((ur, idx) => (
                            <Badge 
                              key={idx} 
                              variant="outline" 
                              className="text-[8px] font-black uppercase bg-blue-50 text-blue-700 border-blue-200"
                            >
                              {ur.role.name.replace(/_/g, ' ')}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="secondary" className="text-[9px]">No Roles</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {user.isActive ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 shadow-none text-[9px] font-black uppercase tracking-tight gap-1">
                          <ShieldCheck className="h-3 w-3" /> Authorized
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[9px] font-black uppercase tracking-tight gap-1">
                          <Power className="h-3 w-3" /> Suspended
                        </Badge>
                      )}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 p-1.5 hover:bg-blue-50 hover:text-blue-700"
                          onClick={() => openEditModal(user)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 p-1.5 hover:bg-amber-50 hover:text-amber-700"
                          onClick={() => handleStatusToggle(user.id, user.isActive)}
                        >
                          {user.isActive ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <ShieldCheck className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 p-1.5 hover:bg-red-50 hover:text-red-700"
                          onClick={() => openDeleteModal(user)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE MODAL */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[450px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5 text-blue-600" />
              Create New User Account
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4 py-4">
<div className="grid gap-2">
              <Label htmlFor="create-name">Full Name *</Label>
              <Input
                id="create-name"
                value={createForm.name}
                onChange={(e) => setCreateForm({...createForm, name: e.target.value})}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-email">Email *</Label>
              <Input
                id="create-email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({...createForm, email: e.target.value})}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-password">Password *</Label>
              <Input
                id="create-password"
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm({...createForm, password: e.target.value})}
                minLength={8}
                required
              />
            </div>

            {/* ✅ MULTI-ROLE SELECTION */}
            <div className="space-y-2">
              <Label>Roles *</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-lg">
                {allRoles.map((role) => (
                  <div key={role.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`create-role-${role.id}`}
                      checked={createForm.roles.includes(role.name)}
                      onCheckedChange={(checked) => {
                        setCreateForm(prev => {
                          if (checked) {
                            return { ...prev, roles: [...prev.roles, role.name] };
                          }
                          return { ...prev, roles: prev.roles.filter(r => r !== role.name) };
                        });
                      }}
                    />
                    <Label 
                      htmlFor={`create-role-${role.id}`} 
                      className="text-sm font-medium cursor-pointer flex-1"
                    >
                      {role.name.replace(/_/g, ' ')}
                    </Label>
                  </div>
                ))}
              </div>
              {createForm.roles.length === 0 && (
                <p className="text-xs text-red-500 mt-1">At least one role is required</p>
              )}
            </div>
            
<div className="grid gap-2">
              <Label htmlFor="edit-name">Full Name *</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email *</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-designation">Designation</Label>
              <Input
                id="edit-designation"
                value={editForm.designation}
                onChange={(e) => setEditForm({...editForm, designation: e.target.value})}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-blue-600 hover:bg-blue-700"
                disabled={createForm.roles.length === 0}
              >
                Create Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT MODAL */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[450px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-amber-600" />
              Edit User Details
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 py-4">
<div className="grid gap-2">
              <Label htmlFor="edit-name">Full Name *</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email *</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-designation">Designation</Label>
              <Input
                id="edit-designation"
                value={editForm.designation}
                onChange={(e) => setEditForm({...editForm, designation: e.target.value})}
              />
            </div>
            {/* ✅ MULTI-ROLE SELECTION */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <Label>Assigned Roles *</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-lg">
                {allRoles.map((role) => (
                  <div key={role.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`edit-role-${role.id}`}
                      checked={editForm.roles.includes(role.name)}
                      onCheckedChange={(checked) => {
                        setEditForm(prev => {
                          if (checked) {
                            return { ...prev, roles: [...prev.roles, role.name] };
                          }
                          return { ...prev, roles: prev.roles.filter(r => r !== role.name) };
                        });
                      }}
                    />
                    <Label 
                      htmlFor={`edit-role-${role.id}`} 
                      className="text-sm font-medium cursor-pointer flex-1"
                    >
                      {role.name.replace(/_/g, ' ')}
                    </Label>
                  </div>
                ))}
              </div>
              {editForm.roles.length === 0 && (
                <p className="text-xs text-red-500 mt-1">At least one role is required</p>
              )}
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-amber-600 hover:bg-amber-700"
                disabled={editForm.roles.length === 0}
              >
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>


      {/* DELETE MODAL */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Deactivate User Account?
            </DialogTitle>
            <DialogDescription>
              This will immediately revoke all system access for{" "}
              <span className="font-bold">{deletingUser?.name}</span>. 
              This action is reversible by reactivating the account later.
              <div className="mt-3 p-3 bg-red-50 rounded-md border border-red-200">
                <div className="flex items-start gap-2">
                  <EyeOff className="h-4 w-4 mt-0.5 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700">
                    <span className="font-bold">Note:</span> For security, we deactivate accounts instead of permanent deletion to preserve audit history. All associated requests and approvals remain intact.
                  </p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 gap-2"
            >
              <Trash2 className="h-4 w-4" /> Deactivate Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}