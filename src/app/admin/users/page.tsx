// src/app/admin/users/page.tsx
"use client";

import UserTable from "./UserTable";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { getAllUsers, getRoles } from "@/app/actions/user-actions";
import { Role, User } from "@/types/users";


export default async function UserManagement() {

    const {data:session} = useSession();
    const [users, setUsers] = useState<User []>([]);
    const [roles, setRoles] = useState<Role []>([]);
  
    if (!session?.user?.id) {
      throw new Error("Unauthorized");
    }
    useEffect(() => {
      const fetchUsers = async () => {
        try {
          const res = await getAllUsers();
          setUsers(res);
          const roles = await getRoles();
          setRoles(roles);
        } catch (error) {
          console.error("Failed to fetch users:", error);
        }
      }
      fetchUsers();
    }, [session]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
      </div>
      <UserTable initialUsers={users} allRoles={roles} />
    </div>
  );
}
