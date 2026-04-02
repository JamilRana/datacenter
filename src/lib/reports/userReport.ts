// lib/reports/userReport.ts
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface UserReportParams {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: string;
  department?: string;
  userRoles?: string[];
}

export interface UserReportRow {
  id: string;
  name: string;
  email: string;
  organization: string | null;
  roles: string[];
  vmCount: number;
  requestCount: number;
  pendingApprovals: number;
  lastActive: Date | null;
  createdAt: Date;
}

export interface UserReportAnalytics {
  totalUsers: number;
  byRole: { role: string; count: number }[];
  byDepartment: { department: string; count: number }[];
  topRequesters: { userId: string; name: string; count: number }[];
  activeUsers: number;
  inactiveUsers: number;
}

export interface UserReportResult {
  data: UserReportRow[];
  analytics: UserReportAnalytics;
  total: number;
  page: number;
  totalPages: number;
}

export async function getUserReport(params: UserReportParams): Promise<UserReportResult> {
  const { 
    page = 1, 
    pageSize = 10, 
    search,
    role,
    department,
    userRoles 
  } = params;

  const skip = (page - 1) * pageSize;
  const isAdmin = userRoles?.some(r => ["ADMIN", "DC_OPS"].includes(r.toUpperCase()));

  if (!isAdmin) {
    return { 
      data: [], 
      analytics: { 
        totalUsers: 0, 
        byRole: [], 
        byDepartment: [], 
        topRequesters: [], 
        activeUsers: 0, 
        inactiveUsers: 0 
      }, 
      total: 0, 
      page: 1, 
      totalPages: 0 
    };
  }

  const where: Prisma.UserWhereInput = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  if (role) {
    const usersWithRole = await prisma.userRole.findMany({
      where: {
        role: { name: role },
      },
      select: { userId: true },
    });
    where.id = { in: usersWithRole.map(u => u.userId) };
  }

  if (department) {
    where.organization = { contains: department, mode: "insensitive" };
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

  const analytics = await getUserReportAnalytics();

  const userIds = users.map(u => u.id);
  
  const [vmCounts, requestCounts, pendingApprovalCounts] = await Promise.all([
    prisma.vmInstance.groupBy({
      by: ["ownerId"],
      _count: true,
      where: { ownerId: { in: userIds } },
    }),
    prisma.request.groupBy({
      by: ["requesterId"],
      _count: true,
      where: { requesterId: { in: userIds } },
    }),
    prisma.approval.groupBy({
      by: ["approverId"],
      _count: true,
      where: { 
        approverId: { in: userIds },
        decision: "PENDING",
      },
    }),
  ]);

  const vmCountMap = new Map(vmCounts.map(v => [v.ownerId!, v._count]));
  const requestCountMap = new Map(requestCounts.map(r => [r.requesterId!, r._count]));
  const pendingApprovalMap = new Map(pendingApprovalCounts.map(p => [p.approverId!, p._count]));

  const data: UserReportRow[] = users.map(user => ({
    id: user.id,
    name: user.name || "Unknown",
    email: user.email,
    organization: user.organization,
    roles: user.roles.map(r => r.role.name),
    vmCount: vmCountMap.get(user.id) || 0,
    requestCount: requestCountMap.get(user.id) || 0,
    pendingApprovals: pendingApprovalMap.get(user.id) || 0,
    lastActive: user.updatedAt,
    createdAt: user.createdAt,
  }));

  return {
    data,
    analytics,
    total,
    page,
    totalPages: Math.ceil(total / pageSize),
  };
}

async function getUserReportAnalytics() {
  const [allUsers, roleGroups] = await Promise.all([
    prisma.user.findMany({
      include: {
        roles: {
          include: {
            role: { select: { name: true } },
          },
        },
      },
    }),
    prisma.userRole.findMany({
      include: {
        role: { select: { name: true } },
      },
    }),
  ]);

  const roleCountMap = new Map<string, number>();
  for (const r of roleGroups) {
    const roleName = r.role.name;
    roleCountMap.set(roleName, (roleCountMap.get(roleName) || 0) + 1);
  }

  const deptCountMap = new Map<string, number>();
  for (const user of allUsers) {
    const dept = user.organization || "Unassigned";
    deptCountMap.set(dept, (deptCountMap.get(dept) || 0) + 1);
  }

  const topRequesters = await prisma.request.groupBy({
    by: ["requesterId"],
    _count: true,
    orderBy: { _count: { requesterId: "desc" } },
    take: 10,
  });

  const requesterIds = topRequesters.map(r => r.requesterId);
  const requesterUsers = await prisma.user.findMany({
    where: { id: { in: requesterIds } },
    select: { id: true, name: true },
  });
  const requesterMap = new Map(requesterUsers.map(u => [u.id, u.name || "Unknown"]));

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const activeUsersCount = await prisma.user.count({
    where: { updatedAt: { gte: thirtyDaysAgo } },
  });

  return {
    totalUsers: allUsers.length,
    byRole: Array.from(roleCountMap.entries()).map(([role, count]) => ({ role, count })),
    byDepartment: Array.from(deptCountMap.entries()).map(([department, count]) => ({ department, count })),
    topRequesters: topRequesters.map(r => ({
      userId: r.requesterId,
      name: requesterMap.get(r.requesterId) || "Unknown",
      count: r._count,
    })),
    activeUsers: activeUsersCount,
    inactiveUsers: allUsers.length - activeUsersCount,
  };
}
