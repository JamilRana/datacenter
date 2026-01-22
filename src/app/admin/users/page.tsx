// src/app/admin/users/page.tsx
import prisma from "@/lib/prisma";
import UserTable from "./UserTable";

export default async function UserManagement() {
  const users = await prisma.user.findMany({
    include: {
      roles: {
        include: { role: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const roles = await prisma.role.findMany();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
      </div>
      <UserTable initialUsers={users} allRoles={roles} />
    </div>
  );
}
