// src/app/admin/users/UserTable.tsx
"use client";

import { useState } from "react";
import { updateUserRole, toggleUserStatus } from "@/app/actions/user-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function UserTable({ initialUsers, allRoles }: { initialUsers: any[], allRoles: any[] }) {
  const [users, setUsers] = useState(initialUsers);

  const handleRoleChange = async (userId: string, roleName: string) => {
    try {
      await updateUserRole(userId, roleName);
      toast.success("User role updated successfully.");
      // In a real app, revalidatePath handles this, but for immediate UI feedback:
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, roles: [{ role: { name: roleName } }] } : u));
    } catch (err) {
      toast.error("Failed to update role.");
    }
  };

  const handleStatusToggle = async (userId: string, currentStatus: boolean) => {
     try {
       await toggleUserStatus(userId, currentStatus);
       toast.success(`User ${currentStatus ? "deactivated" : "activated"} successfully.`);
       setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: !currentStatus } : u));
     } catch (err) {
       toast.error("Failed to update status.");
     }
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-slate-50 border-b">
          <tr>
            <th className="p-4 font-semibold text-slate-700">Name</th>
            <th className="p-4 font-semibold text-slate-700">Email</th>
            <th className="p-4 font-semibold text-slate-700">Designation</th>
            <th className="p-4 font-semibold text-slate-700">Role</th>
            <th className="p-4 font-semibold text-slate-700">Status</th>
            <th className="p-4 font-semibold text-slate-700">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {users.map((user) => {
            const currentRole = user.roles[0]?.role?.name || "None";
            return (
              <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4">{user.name}</td>
                <td className="p-4 text-slate-600">{user.email}</td>
                <td className="p-4 text-slate-500">{user.designation || "—"}</td>
                <td className="p-4">
                  <Select
                    defaultValue={currentRole}
                    onValueChange={(val) => handleRoleChange(user.id, val)}
                  >
                    <SelectTrigger className="w-40 h-8">
                      <SelectValue placeholder="Select Role" />
                    </SelectTrigger>
                    <SelectContent>
                      {allRoles.map((role) => (
                        <SelectItem key={role.id} value={role.name}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-4">
                  <Badge variant={user.isActive ? "default" : "destructive"}>
                    {user.isActive ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="p-4">
                  <Button
                    variant={user.isActive ? "outline" : "default"}
                    size="sm"
                    onClick={() => handleStatusToggle(user.id, user.isActive)}
                  >
                    {user.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
