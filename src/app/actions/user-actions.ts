// src/app/actions/user-actions.ts
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { revalidatePath } from "next/cache";
import { ROLES } from "@/lib/roles";
import { hash } from "bcryptjs";
import { Role } from "@prisma/client";

export async function getRequesters() {
  try {
    const users = await prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: {
              name: ROLES.REQUESTER,
            },
          },
        },
        isActive: true, // Only fetch active users who can actually approve
      },
      include: {
      roles: {
        include: { role: true },
      },
    },
      orderBy: { 
        name: "asc" 
      },
    });

      return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    contact: user.contact,
    designation: user.designation,
    organization: user.organization,
    isActive: user.isActive,
    roles: user.roles.map((r) => r.role.name), // <-- FIX
  }));
  } catch (error) {
    console.error("Error fetching requesters:", error);
    return [];
  }
}

export async function getAllUsers() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.roles?.includes(ROLES.ADMIN)) throw new Error("Unauthorized");

const users = await prisma.user.findMany({
    where: { isActive: true },
    include: {
      roles: {
        include: { role: true },
      },
    },
    orderBy: { name: "asc" },
  });
  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    contact: user.contact,
    designation: user.designation,
    organization: user.organization,
    isActive: user.isActive,
    roles: user.roles.map((r) => r.role.name), // <-- FIX
  }));
}

export async function getUserById(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.roles?.includes(ROLES.ADMIN)) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      roles: {
        include: { role: true },
      },
    },
  });

  return user;
}

export async function getRoles() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.roles?.includes(ROLES.ADMIN)) throw new Error("Unauthorized");

  const roles = await prisma.role.findMany();

  return roles;
} 


export async function createUser(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.roles?.includes(ROLES.ADMIN)) throw new Error("Unauthorized");

  const name = formData.get("name")?.toString()?.trim();
  const email = formData.get("email")?.toString()?.trim();
  const password = formData.get("password")?.toString();
  const designation = formData.get("designation")?.toString()?.trim();
  const organization = formData.get("organization")?.toString()?.trim();
  const contact = formData.get("contact")?.toString()?.trim();
  const roleNames = formData.getAll("roles") as string[]; // ✅ MULTIPLE ROLES

  // Validation
  if (!name || !email || !password || roleNames.length === 0) throw new Error("Missing required fields");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email format");
  if (password.length < 8) throw new Error("Password must be at least 8 characters");
  if (roleNames.some(r => !r)) throw new Error("Invalid role selection");

  // Check email uniqueness
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("Email already in use");

  // Validate all roles exist
  const validRoles = await prisma.role.findMany({ 
    where: { name: { in: roleNames } },
    select: { id: true, name: true }
  });
  
  if (validRoles.length !== roleNames.length) {
    throw new Error("One or more invalid roles selected");
  }

  const hashedPassword = await hash(password, 10);

  await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      designation: designation || null,
      organization: organization || null,
      contact: contact || null,
      isActive: true,
      roles: { 
        create: validRoles.map(role => ({ roleId: role.id })) // ✅ CREATE MULTIPLE
      },
    },
  });

  revalidatePath("/admin/users");
}


export async function updateUserDetails(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.roles?.includes(ROLES.ADMIN)) throw new Error("Unauthorized");

  const userId = formData.get("userId")?.toString();
  const name = formData.get("name")?.toString()?.trim();
  const email = formData.get("email")?.toString()?.trim();
  const designation = formData.get("designation")?.toString()?.trim();
  const organization = formData.get("organization")?.toString()?.trim();
  const contact = formData.get("contact")?.toString()?.trim();
  const roleNames = formData.getAll("roles") as string[]; // ✅ MULTIPLE ROLES

  if (!userId || !name || !email) throw new Error("Missing required fields");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email format");

  // Check email uniqueness (excluding current user)
  const existing = await prisma.user.findFirst({
    where: { email, NOT: { id: userId } },
  });
  if (existing) throw new Error("Email already in use by another account");

  // Validate roles if provided
  let validRoles:Role[] = [];
  if (roleNames.length > 0) {
    validRoles = await prisma.role.findMany({ 
      where: { name: { in: roleNames } },
      select: { id: true,name: true }
    });
    if (validRoles.length !== roleNames.length) {
      throw new Error("One or more invalid roles selected");
    }
  }

  await prisma.$transaction(async (tx) => {
    // Update user details
    await tx.user.update({
      where: { id: userId },
      data: {
        name,
        email,
        designation: designation || null,
        organization: organization || null,
        contact: contact || null,
      },
    });

    // Update roles if provided
    if (roleNames.length > 0) {
      // Delete existing roles
      await tx.userRole.deleteMany({ where: { userId } });
      // Create new roles
      await tx.userRole.createMany({
        data: validRoles.map(role => ({ userId, roleId: role.id })),
      });
    }
  });

  revalidatePath("/admin/users");
}

export async function deleteUser(userId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.roles?.includes(ROLES.ADMIN)) throw new Error("Unauthorized");

  // Prevent deleting self
  if (session.user.id === userId) throw new Error("Cannot delete your own account");

  // Safety check: Prevent deleting last admin
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: { include: { role: true } } },
  });
  
  if (user?.roles.some(r => r.role.name === "ADMIN")) {
    const adminCount = await prisma.user.count({
      where: {
        roles: { some: { role: { name: "ADMIN" } } },
        isActive: true,
      },
    });
    if (adminCount <= 1) throw new Error("Cannot delete the last active admin account");
  }

  // Soft delete via deactivation (preserves audit trail)
  await prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
  });

  // Optional: Clear sensitive data after deactivation
  // await prisma.user.update({
  //   where: { id: userId },
  //   data: { password: "", contact: null, organization: null }
  // });

  revalidatePath("/admin/users");
}

export async function updateUserRole(userId: string, roleName: string) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.roles.includes(ROLES.ADMIN)) {
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
  if (!session || !session.user.roles.includes("ADMIN")) {
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



export async function createRole(name: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.roles?.includes(ROLES.ADMIN)) {
    throw new Error("Unauthorized");
  }

  const trimmed = name.trim().toUpperCase();
  if (!trimmed) throw new Error("Role name required");

  const exists = await prisma.role.findUnique({
    where: { name: trimmed },
  });

  if (exists) throw new Error("Role already exists");

  await prisma.role.create({
    data: { name: trimmed },
  });

  revalidatePath("/admin/users");
}

export async function updateRole(id: string, name: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.roles?.includes(ROLES.ADMIN)) {
    throw new Error("Unauthorized");
  }

  await prisma.role.update({
    where: { id },
    data: { name: name.trim().toUpperCase() },
  });

  revalidatePath("/admin/users");
}

export async function deleteRole(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.roles?.includes(ROLES.ADMIN)) {
    throw new Error("Unauthorized");
  }

  const roleInUse = await prisma.userRole.findFirst({
    where: { roleId: id },
  });

  if (roleInUse) {
    throw new Error("Cannot delete role in use");
  }

  await prisma.role.delete({
    where: { id },
  });

  revalidatePath("/admin/users");
}
