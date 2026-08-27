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

  const [users, requests, instances, audits] = await Promise.all([
    prisma.user.count(),
    prisma.request.count(),
    prisma.vmInstance.count(),
    prisma.auditLog.count({ where: { timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
  ]);

  const bottleneckThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const stalledRequests = await prisma.request.count({
    where: {
      status: { in: ["PENDING_L1", "PENDING_L2", "PENDING_L3"] },
      submittedAt: { lte: bottleneckThreshold }
    }
  });

  const recentHighImpact = await prisma.auditLog.findMany({
    where: {
      action: { in: ["EXECUTION_COMPLETED", "DELETE_USER", "LOGIN_FAILURE"] }
    },
    orderBy: { timestamp: "desc" },
    take: 5,
    include: { actor: { select: { name: true } } }
  });

  return {
    summary: { users, requests, instances, audits24h: audits },
    bottlenecks: { stalledRequests },
    activities: recentHighImpact,
    systemStatus: "OPTIMAL"
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
