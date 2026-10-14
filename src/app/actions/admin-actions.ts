// src/app/actions/admin-actions.ts
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { ROLES } from "@/lib/roles";
import * as userService from "@/lib/admin/userService";
import * as workflowService from "@/lib/admin/workflowService";
import * as emailService from "@/lib/admin/emailService";
import * as auditService from "@/lib/admin/auditService";
import { checkSystemHealth } from "@/lib/dashboard/systemHealth";
import type { SystemHealthItem } from "@/types/dashboard";

import { RequestStatus } from "@prisma/client";
import { getDistinctWorkflowLevels, getWorkflowLevelsForType } from "@/lib/workflow";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.roles?.includes(ROLES.ADMIN)) {
    throw new Error("Unauthorized: Admin access required");
  }
  return session;
}

export async function getAdminMetrics() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.roles?.includes(ROLES.ADMIN)) throw new Error("Unauthorized");

  const bottleneckThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Fetch dynamic workflow levels
  const distinctWorkflowLevels = await getDistinctWorkflowLevels();
  const activePendingStatuses = distinctWorkflowLevels.map(l => l.statusCode);

  const [
    totalUsers,
    activeUsers,
    inactiveUsers,
    rolesWithCount,
    totalRequests,
    requestsThisMonth,
    totalInstances,
    activeInstances,
    suspendedInstances,
    serverAssets,
    totalAssets,
    totalClusters,
    audits24h,
    levelCountsResults,
    stalledRequestsList,
    recentActivities,
    systemHealthItems,
  ] = await Promise.all([
    // 1. User totals
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isActive: false } }),
    prisma.role.findMany({
      include: {
        _count: {
          select: { users: true },
        },
      },
      orderBy: { name: "asc" },
    }),

    // 2. Request & Approvals
    prisma.request.count(),
    prisma.request.count({ where: { createdAt: { gte: startOfMonth } } }),

    // 3. Infrastructure
    prisma.vmInstance.count(),
    prisma.vmInstance.count({ where: { status: "ACTIVE" } }),
    prisma.vmInstance.count({ where: { status: "SUSPENDED" } }),
    prisma.asset.count({ where: { type: "SERVER" } }),
    prisma.asset.count(),
    prisma.physicalCluster.count(),

    // 4. Audit in last 24h
    prisma.auditLog.count({ where: { timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),

    // 5. Dynamic Approval Level counts
    Promise.all(
      distinctWorkflowLevels.map(lvl =>
        prisma.approval.count({ where: { decision: "PENDING", level: lvl.level } })
      )
    ),

    // 6. Stalled requests (> 48h pending across all dynamic workflow stages)
    prisma.request.findMany({
      where: {
        status: { in: (activePendingStatuses.length > 0 ? activePendingStatuses : ["PENDING_L1", "PENDING_L2", "PENDING_L3", "PENDING_L4"]) as RequestStatus[] },
        submittedAt: { lte: bottleneckThreshold },
      },
      orderBy: { submittedAt: "asc" },
      take: 5,
      include: {
        requester: { select: { name: true, email: true } },
      },
    }),

    // 7. Recent high-impact audit logs
    prisma.auditLog.findMany({
      orderBy: { timestamp: "desc" },
      take: 8,
      include: { actor: { select: { name: true, email: true } } },
    }),

    // 8. System Health check
    checkSystemHealth(),
  ]);

  const levelsList = distinctWorkflowLevels.map((lvl, index) => ({
    level: lvl.level,
    label: lvl.shortName,
    fullLabel: lvl.roleLabel,
    role: lvl.role,
    statusCode: lvl.statusCode,
    count: levelCountsResults[index] || 0,
  }));

  const pendingApprovalsTotal = levelsList.reduce((sum, l) => sum + l.count, 0);
  const pendingL1 = levelsList.find(l => l.level === 1)?.count || 0;
  const pendingL2 = levelsList.find(l => l.level === 2)?.count || 0;
  const pendingL3 = levelsList.find(l => l.level === 3)?.count || 0;
  const pendingL4 = levelsList.find(l => l.level === 4)?.count || 0;

  const stalledRequestsCount = stalledRequestsList.length;

  const hasAnyHealthError = systemHealthItems.some((i: SystemHealthItem) => i.status === "error");
  const hasAnyHealthWarning = systemHealthItems.some((i: SystemHealthItem) => i.status === "warning");
  const systemStatus = hasAnyHealthError ? "CRITICAL" : hasAnyHealthWarning ? "DEGRADED" : "OPTIMAL";

  return {
    summary: {
      users: totalUsers,
      activeUsers,
      inactiveUsers,
      requests: totalRequests,
      requestsThisMonth,
      instances: totalInstances,
      activeInstances,
      suspendedInstances,
      serverAssets,
      totalAssets,
      totalClusters,
      audits24h,
    },
    roles: rolesWithCount.map((r: { name: string; _count: { users: number } }) => ({
      name: r.name,
      count: r._count.users,
    })),
    approvals: {
      total: pendingApprovalsTotal,
      level1: pendingL1,
      level2: pendingL2,
      level3: pendingL3,
      level4: pendingL4,
      levels: levelsList,
    },
    bottlenecks: {
      stalledRequests: stalledRequestsCount,
      items: stalledRequestsList.map((r) => {
        const matchingLevel = distinctWorkflowLevels.find(l => l.statusCode === r.status);
        return {
          id: r.id,
          displayId: r.requestId || r.id.slice(0, 8),
          systemName: r.systemName || r.projectName || "Unassigned",
          status: r.status,
          levelLabel: matchingLevel ? matchingLevel.shortName : r.status,
          requesterName: r.requester?.name || "Unknown",
          requesterEmail: r.requester?.email || "",
          submittedAt: r.submittedAt,
          hoursStalled: r.submittedAt ? Math.round((Date.now() - new Date(r.submittedAt).getTime()) / (1000 * 60 * 60)) : 48,
        };
      }),
    },
    activities: recentActivities,
    systemHealth: systemHealthItems,
    systemStatus,
  };
}

export async function getUsers(params: userService.UserListParams) {
  await requireAdmin();
  return userService.getUsers(params);
}

export async function getUserById(id: string) {
  await requireAdmin();
  return userService.getUserById(id);
}

export async function createUser(input: userService.CreateUserInput) {
  const session = await requireAdmin();
  const user = await userService.createUser(input);
  await auditService.createAuditLog(session.user.id, "CREATE", "User", user.id, { name: user.name, email: user.email });
  return user;
}

export async function updateUser(id: string, input: userService.UpdateUserInput) {
  const session = await requireAdmin();
  const user = await userService.updateUser(id, input);
  await auditService.createAuditLog(session.user.id, "UPDATE", "User", id, input as unknown as Record<string, unknown>);
  return user;
}

export async function toggleUserStatus(id: string) {
  const session = await requireAdmin();
  const user = await userService.toggleUserStatus(id);
  await auditService.createAuditLog(session.user.id, "UPDATE", "User", id, { action: "toggle_status" });
  return user;
}

export async function changeUserPassword(id: string, newPassword: string) {
  const session = await requireAdmin();
  const res = await userService.changeUserPassword(id, newPassword);
  await auditService.createAuditLog(session.user.id, "UPDATE", "User", id, { action: "admin_change_password" });
  return res;
}

export async function deleteUser(id: string) {
  const session = await requireAdmin();
  await userService.deleteUser(id);
  await auditService.createAuditLog(session.user.id, "DELETE", "User", id);
}

export async function getAllRoles() {
  await requireAdmin();
  return userService.getAllRoles();
}

export async function getWorkflows(requestType?: string) {
  await requireAdmin();
  return workflowService.getWorkflows(requestType);
}

export async function getWorkflowsByType(requestType: string) {
  await requireAdmin();
  return workflowService.getWorkflowsByType(requestType);
}

export async function createWorkflowLevel(input: workflowService.CreateWorkflowInput) {
  const session = await requireAdmin();
  const workflow = await workflowService.createWorkflowLevel(input);
  await auditService.createAuditLog(session.user.id, "CREATE", "Workflow", workflow.id, input as unknown as Record<string, unknown>);
  return workflow;
}

export async function updateWorkflowLevel(id: string, input: workflowService.UpdateWorkflowInput) {
  const session = await requireAdmin();
  const workflow = await workflowService.updateWorkflowLevel(id, input);
  await auditService.createAuditLog(session.user.id, "UPDATE", "Workflow", id, input as unknown as Record<string, unknown>);
  return workflow;
}

export async function deleteWorkflowLevel(id: string) {
  const session = await requireAdmin();
  await workflowService.deleteWorkflowLevel(id);
  await auditService.createAuditLog(session.user.id, "DELETE", "Workflow", id);
}

export async function getRequestTypes() {
  await requireAdmin();
  return workflowService.getRequestTypes();
}

export async function getAvailableRoles() {
  await requireAdmin();
  return workflowService.getAvailableRoles();
}

export async function getEmailSettings() {
  await requireAdmin();
  return emailService.getEmailSettings();
}

export async function saveEmailSettings(settings: emailService.EmailSettings) {
  const session = await requireAdmin();
  await emailService.saveEmailSettings(settings);
  await auditService.createAuditLog(session.user.id, "UPDATE", "Settings", undefined, { category: "smtp" });
}

export async function testEmailSettings(testEmail: string) {
  await requireAdmin();
  return emailService.testEmailSettings(testEmail);
}

export async function getAuditLogs(params: auditService.AuditLogParams) {
  await requireAdmin();
  return auditService.getAuditLogs(params);
}

export async function getAuditStats(days?: number) {
  await requireAdmin();
  return auditService.getAuditStats(days);
}

export async function getRecentActivity(limit?: number) {
  await requireAdmin();
  return auditService.getRecentActivity(limit);
}

export async function getAuditActions() {
  await requireAdmin();
  return auditService.getAuditActions();
}

export async function getAuditEntities() {
  await requireAdmin();
  return auditService.getAuditEntities();
}

export async function getDynamicApprovalLevelsAction() {
  return getDistinctWorkflowLevels();
}

export async function getWorkflowLevelsForTypeAction(requestType?: string) {
  if (requestType && requestType !== "all" && requestType !== "ALL") {
    return getWorkflowLevelsForType(requestType);
  }
  return getDistinctWorkflowLevels();
}
