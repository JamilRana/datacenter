// src/app/admin/users/page.tsx
"use client";

import UserTable from "./components/UserTable";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { getAllUsers, getRoles } from "@/app/actions/user-actions";
import { Role, User } from "@/types/users";
import RoleTable from "./components/RolesTable";
import { useRouter } from "next/navigation";
import { ROLES } from "@/lib/roles";
import { Loader2 } from "lucide-react";

export default function UserManagement() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      // 1. Wait for session to finish loading
      if (status === "loading") return;

      // 2. Check Authentication
      if (!session?.user) {
        router.push("/auth");
        return;
      }

      // 3. Check Authorization
      if (!session.user.roles?.includes(ROLES.ADMIN)) {
        router.push("/");
        return;
      }

      // 4. If Admin, fetch data
      try {
        setIsLoading(true);
        const [userData, roleData] = await Promise.all([
          getAllUsers(),
          getRoles()
        ]);
        
        console.log("Fetched users:", userData);
        setUsers(userData);
        setRoles(roleData);
      } catch (error) {
        console.error("Failed to fetch admin data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [session, status, router]); // Run whenever session status changes

  // Loading Screen
  if (status === "loading" || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-slate-500 text-sm">Loading user management...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
      </div>
      <UserTable initialUsers={users} allRoles={roles} />
      <RoleTable roles={roles} />
    </div>
  );
}