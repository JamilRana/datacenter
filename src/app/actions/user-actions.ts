// src/app/actions/user-actions.ts
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { revalidatePath } from "next/cache";

export async function updateUserRole(userId: string, roleName: string) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  // Find the role ID
  const role = await prisma.role.findUnique({
    where: { name: roleName },
  });

  if (!role) throw new Error("Role not found");

  // Update or Create UserRole (Primary role assumes 1-to-1 for simplicity here, 
  // though schema supports many. We'll replace all existing roles with this one for now)
  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId } }),
    prisma.userRole.create({
      data: {
        userId,
        roleId: role.id,
      },
    }),
    prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "UPDATE_USER_ROLE",
        entityType: "USER",
        entityId: userId,
        details: JSON.stringify({ newRole: roleName }),
      },
    }),
  ]);

  revalidatePath("/admin/users");
}

export async function toggleUserStatus(userId: string, currentStatus: boolean) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: !currentStatus },
  });

  await prisma.auditLog.create({
     data: {
        actorId: session.user.id,
        action: "TOGGLE_USER_STATUS",
        entityType: "USER",
        entityId: userId,
        details: JSON.stringify({ active: !currentStatus }),
     }
  });

  revalidatePath("/admin/users");
}
