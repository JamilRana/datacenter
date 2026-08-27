// src/app/admin/users/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getUsers, createUser, updateUser, toggleUserStatus, deleteUser, changeUserPassword } from "@/app/actions/admin-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Loader2, Plus, Search, Trash2, ToggleLeft, X, KeyRound, Eye, EyeOff, Lock, RefreshCw } from "lucide-react";
import { ROLES } from "@/lib/roles";
import { toast } from "sonner";

interface User {
  id: string;
  name: string;
  email: string;
  designation?: string;
  organization?: string;
  contact?: string;
  isActive: boolean;
  roles: string[];
  createdAt: Date;
}

const roleOptions = [
  { value: "ADMIN", label: "Admin" },
  { value: "DC_OPS", label: "DC Ops" },
  { value: "REQUESTER", label: "Requester" },
  { value: "APPROVER_L1", label: "Approver Level 1" },
  { value: "APPROVER_L2", label: "Approver Level 2" },
  { value: "APPROVER_L3", label: "Approver Level 3" },
  { value: "APPROVER_L4", label: "Approver Level 4" },
  { value: "DEVELOPER", label: "Developer" },
];

export default function UserManagementPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [userStatus, setUserStatus] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Password Change Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordTargetUser, setPasswordTargetUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showDialogPassword, setShowDialogPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    designation: "",
    organization: "",
    contact: "",
    password: "",
    roles: [] as string[],
  });
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to page 1 on new search
    }, 500);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || !session.user.roles?.includes(ROLES.ADMIN)) {
      router.push("/");
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const usersData = await getUsers({ 
          page, 
          pageSize: 10, 
          search: debouncedSearch, 
          status: userStatus as "active" | "inactive" | "all" 
        });
        setUsers(usersData.users);
        setTotal(usersData.total);
      } catch (error) {
        console.error("Failed to fetch users:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session, status, router, page, debouncedSearch, userStatus]);

  const handleSubmit = async () => {
    try {
      setSaving(true);
      if (editingUser) {
        await updateUser(editingUser.id, formData);
        toast.success("User updated successfully");
      } else {
        await createUser(formData);
        toast.success("User created successfully");
      }
      setIsDialogOpen(false);
      setEditingUser(null);
      setFormData({ name: "", email: "", designation: "", organization: "", contact: "", password: "", roles: [] });
      
      // Force refresh data
      const usersData = await getUsers({ page, pageSize: 10, search: debouncedSearch, status: userStatus as "active" | "inactive" | "all" });
      setUsers(usersData.users);
      setTotal(usersData.total);
    } catch (error: unknown) {
      console.error("Failed to save user:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (userId: string) => {
    try {
      await toggleUserStatus(userId);
      toast.success("User status toggled");
      const usersData = await getUsers({ page, pageSize: 10, search: debouncedSearch, status: userStatus as "active" | "inactive" | "all" });
      setUsers(usersData.users);
    } catch (error: unknown) {
      console.error("Failed to toggle user status:", error);
      toast.error(error instanceof Error ? error.message : "Failed to toggle status");
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      designation: user.designation || "",
      organization: user.organization || "",
      contact: user.contact || "",
      password: "",
      roles: user.roles,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      await deleteUser(userId);
      toast.success("User deleted successfully");
      const usersData = await getUsers({ page, pageSize: 10, search: debouncedSearch, status: userStatus as "active" | "inactive" | "all" });
      setUsers(usersData.users);
      setTotal(usersData.total);
    } catch (error: unknown) {
      console.error("Failed to delete user:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete user");
    }
  };

  const openCreateDialog = () => {
    setEditingUser(null);
    setFormData({ name: "", email: "", designation: "", organization: "", contact: "", password: "", roles: [] });
    setShowDialogPassword(false);
    setIsDialogOpen(true);
  };

  const handleOpenPasswordModal = (user: User) => {
    setPasswordTargetUser(user);
    setNewPassword("");
    setConfirmPassword("");
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setIsPasswordModalOpen(true);
  };

  const generateRandomPassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*";
    let pass = "Dghs@";
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pass);
    setConfirmPassword(pass);
    setShowNewPassword(true);
    setShowConfirmPassword(true);
    toast.info(`Generated password: ${pass}`);
  };

  const handleSavePassword = async () => {
    if (!passwordTargetUser) return;
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    try {
      setChangingPassword(true);
      await changeUserPassword(passwordTargetUser.id, newPassword);
      toast.success(`Password successfully updated for ${passwordTargetUser.name}`);
      setIsPasswordModalOpen(false);
      setPasswordTargetUser(null);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: unknown) {
      console.error("Failed to change password:", error);
      toast.error(error instanceof Error ? error.message : "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const toggleRole = (role: string) => {
    const current = formData.roles;
    if (current.includes(role)) {
      setFormData({ ...formData, roles: current.filter(r => r !== role) });
    } else {
      setFormData({ ...formData, roles: [...current, role] });
    }
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" /> Add User
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={userStatus} onValueChange={setUserStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="font-bold text-slate-700">Name</TableHead>
                  <TableHead className="font-bold text-slate-700">Mobile/Email</TableHead>
                  <TableHead className="font-bold text-slate-700">Organization</TableHead>
                  <TableHead className="font-bold text-slate-700">Roles</TableHead>
                  <TableHead className="font-bold text-slate-700">Status</TableHead>
                  <TableHead className="font-bold text-slate-700">Created</TableHead>
                  <TableHead className="text-right font-bold text-slate-700">Actions</TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {loading && users.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7} className="py-4">
                      <div className="h-6 bg-slate-100 animate-pulse rounded" />
                    </TableCell>
                  </TableRow>
                ))
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} className={loading ? "opacity-50" : ""}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{user.email}</span>
                        {user.contact && <span className="text-xs text-slate-500">{user.contact}</span>}
                      </div>
                    </TableCell>
                    <TableCell>{user.organization || "-"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role) => (
                          <Badge key={role} variant="outline" className="text-xs">
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={user.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5 items-center">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleOpenPasswordModal(user)}
                          title="Change Password"
                          className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleEdit(user)}
                          className="h-8 px-2 text-xs"
                        >
                          Edit
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleToggleStatus(user.id)}
                          title={user.isActive ? "Deactivate User" : "Activate User"}
                          className="h-8 w-8"
                        >
                          <ToggleLeft className={`h-4 w-4 ${user.isActive ? "text-green-600" : "text-slate-400"}`} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDelete(user.id)}
                          title="Delete User"
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > 10 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
            Previous
          </Button>
          <span className="flex items-center px-4 text-sm">
            Page {page} of {Math.ceil(total / 10)}
          </span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 10)}>
            Next
          </Button>
        </div>
      )}

      {/* User Create / Edit Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl">
            <CardContent className="pt-6 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{editingUser ? "Edit User" : "Create User"}</h2>
                <Button variant="ghost" size="icon" onClick={() => setIsDialogOpen(false)} className="h-8 w-8">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium block mb-1 text-slate-700 dark:text-slate-300">Name *</label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Full name" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1 text-slate-700 dark:text-slate-300">Email *</label>
                  <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="name@domain.gov.bd" />
                </div>
                {!editingUser ? (
                  <div>
                    <label className="text-sm font-medium block mb-1 text-slate-700 dark:text-slate-300">Password *</label>
                    <div className="relative">
                      <Input 
                        type={showDialogPassword ? "text" : "password"} 
                        value={formData.password} 
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })} 
                        placeholder="••••••••"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowDialogPassword(!showDialogPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none"
                        tabIndex={-1}
                      >
                        {showDialogPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-sm font-medium block mb-1 text-slate-700 dark:text-slate-300">New Password <span className="text-xs font-normal text-slate-400">(leave blank to keep current)</span></label>
                    <div className="relative">
                      <Input 
                        type={showDialogPassword ? "text" : "password"} 
                        value={formData.password} 
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })} 
                        placeholder="Enter new password to update"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowDialogPassword(!showDialogPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none"
                        tabIndex={-1}
                      >
                        {showDialogPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium block mb-1 text-slate-700 dark:text-slate-300">Designation</label>
                  <Input value={formData.designation} onChange={(e) => setFormData({ ...formData, designation: e.target.value })} placeholder="e.g. Administrator" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1 text-slate-700 dark:text-slate-300">Organization</label>
                  <Input value={formData.organization} onChange={(e) => setFormData({ ...formData, organization: e.target.value })} placeholder="e.g. DGHS" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1 text-slate-700 dark:text-slate-300">Contact/Mobile</label>
                  <Input value={formData.contact} onChange={(e) => setFormData({ ...formData, contact: e.target.value })} placeholder="e.g. 01700000000" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-2 text-slate-700 dark:text-slate-300">Roles</label>
                  <div className="grid grid-cols-2 gap-2">
                    {roleOptions.map((role) => (
                      <label key={role.value} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.roles.includes(role.value)}
                          onChange={() => toggleRole(role.value)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        {role.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              
              <Button onClick={handleSubmit} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white mt-4">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {editingUser ? "Update User" : "Create User"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Admin Change Password Modal */}
      {isPasswordModalOpen && passwordTargetUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl overflow-hidden">
            <CardContent className="pt-6 space-y-4">
              <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Change Password</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {passwordTargetUser.name} <span className="text-slate-400">({passwordTargetUser.email})</span>
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsPasswordModalOpen(false)} className="h-8 w-8 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="space-y-4 pt-1">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Generate random password
                  </button>
                </div>

                <div>
                  <label className="text-sm font-medium block mb-1 text-slate-700 dark:text-slate-300">New Password *</label>
                  <div className="relative">
                    <Input 
                      type={showNewPassword ? "text" : "password"} 
                      value={newPassword} 
                      onChange={(e) => setNewPassword(e.target.value)} 
                      placeholder="Minimum 6 characters"
                      className="pr-10 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 focus:outline-none transition-colors"
                      tabIndex={-1}
                      aria-label={showNewPassword ? "Hide password" : "Show password"}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium block mb-1 text-slate-700 dark:text-slate-300">Confirm New Password *</label>
                  <div className="relative">
                    <Input 
                      type={showConfirmPassword ? "text" : "password"} 
                      value={confirmPassword} 
                      onChange={(e) => setConfirmPassword(e.target.value)} 
                      placeholder="Re-enter new password"
                      className="pr-10 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 focus:outline-none transition-colors"
                      tabIndex={-1}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button variant="outline" onClick={() => setIsPasswordModalOpen(false)} className="w-1/2">
                  Cancel
                </Button>
                <Button onClick={handleSavePassword} disabled={changingPassword} className="w-1/2 bg-amber-600 hover:bg-amber-700 text-white font-medium">
                  {changingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                  Update Password
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
