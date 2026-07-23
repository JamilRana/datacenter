// lib/admin/userService.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

export interface CreateUserInput {
  name: string;
  email: string;
  designation?: string;
  organization?: string;
  contact?: string;
  password: string;
  roles: string[];
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  designation?: string;
  organization?: string;
  contact?: string;
  password?: string;
  roles?: string[];
  isActive?: boolean;
}

export interface UserListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: string;
  status?: "active" | "inactive" | "all";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface PaginatedUsers {
  users: any[];
  total: number;
  page: number;
  totalPages: number;
}

export async function getUsers(params: UserListParams): Promise<PaginatedUsers> {
  const { page = 1, pageSize = 10, search, role, status = "all" } = params;
  const skip = (page - 1) * pageSize;

  const where: Prisma.UserWhereInput = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  if (status === "active") {
    where.isActive = true;
  } else if (status === "inactive") {
    where.isActive = false;
  }

  if (role) {
    where.roles = {
      some: {
        role: { name: role },
      },
    };
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        roles: {
          include: {
            role: { select: { name: true } },
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users: users.map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      designation: u.designation,
      organization: u.organization,
      contact: u.contact,
      isActive: u.isActive,
      roles: u.roles.map((r: any) => r.role.name),
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    })),
    total,
    page,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      roles: {
        include: {
          role: { select: { name: true } },
        },
      },
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    designation: user.designation,
    organization: user.organization,
    contact: user.contact,
    isActive: user.isActive,
    roles: user.roles.map((r: any) => r.role.name),
    createdAt: user.createdAt,
  };
}

export async function createUser(input: CreateUserInput) {
  const { name, email, designation, organization, contact, password, roles } = input;

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { name }],
    },
  });

  if (existingUser) {
    throw new Error("User with this email or name already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      designation,
      organization,
      contact,
      password: hashedPassword,
      roles: {
        create: roles.map((roleName) => ({
          role: {
            connect: { name: roleName },
          },
        })),
      },
    },
    include: {
      roles: {
        include: {
          role: { select: { name: true } },
        },
      },
    },
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roles: user.roles.map((r: any) => r.role.name),
  };
}

export async function updateUser(id: string, input: UpdateUserInput) {
  const { name, email, designation, organization, contact, password, roles, isActive } = input;

  const updateData: Prisma.UserUpdateInput = {
    name,
    email,
    designation,
    organization,
    contact,
    isActive,
  };

  if (password) {
    updateData.password = await bcrypt.hash(password, 12);
  }

  if (roles) {
    await prisma.userRole.deleteMany({ where: { userId: id } });
    if (roles.length > 0) {
      for (const roleName of roles) {
        const role = await prisma.role.findUnique({ where: { name: roleName } });
        if (role) {
          await prisma.userRole.create({
            data: {
              userId: id,
              roleId: role.id,
            },
          });
        }
      }
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    include: {
      roles: {
        include: {
          role: { select: { name: true } },
        },
      },
    },
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isActive: user.isActive,
    roles: user.roles.map((r: any) => r.role.name),
  };
}

export async function toggleUserStatus(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new Error("User not found");

  return prisma.user.update({
    where: { id },
    data: { isActive: !user.isActive },
  });
}

export async function deleteUser(id: string) {
  return prisma.user.delete({ where: { id } });
}

export async function getAllRoles() {
  return prisma.role.findMany({
    orderBy: { name: "asc" },
  });
}
