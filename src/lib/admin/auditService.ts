// lib/admin/auditService.ts
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type AuditAction = 
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "APPROVE"
  | "REJECT"
  | "PROVISION"
  | "LOGIN"
  | "LOGOUT"
  | "EXPORT"
  | "LOG";

export type AuditEntity = 
  | "User"
  | "Request"
  | "VM"
  | "Hardware"
  | "Workflow"
  | "Settings"
  | "Session";

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName?: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: Record<string, unknown> | null;
  timestamp: Date;
}

export interface AuditLogParams {
  page?: number;
  pageSize?: number;
  actorId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

export interface PaginatedAuditLogs {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  totalPages: number;
}

export async function getAuditLogs(params: AuditLogParams): Promise<PaginatedAuditLogs> {
  const {
    page = 1,
    pageSize = 20,
    actorId,
    action,
    entityType,
    entityId,
    dateFrom,
    dateTo,
  } = params;

  const skip = (page - 1) * pageSize;

  const where: Prisma.AuditLogWhereInput = {};

  if (actorId) where.actorId = actorId;
  if (action) where.action = action;
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;

  if (dateFrom || dateTo) {
    where.timestamp = {};
    if (dateFrom) where.timestamp.gte = dateFrom;
    if (dateTo) where.timestamp.lte = dateTo;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { timestamp: "desc" },
      include: {
        actor: { select: { name: true, email: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs: logs.map((log: any) => ({
      id: log.id,
      actorId: log.actorId,
      actorName: log.actor.name,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      details: log.details as Record<string, unknown> | null,
      timestamp: log.timestamp,
    })),
    total,
    page,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function createAuditLog(
  actorId: string,
  action: AuditAction,
  entityType?: AuditEntity,
  entityId?: string,
  details?: Record<string, unknown>
) {
  return prisma.auditLog.create({
    data: {
      actorId,
      action,
      entityType: entityType || null,
      entityId: entityId || null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      details: details as any,
    },
  });
}

export async function getAuditStats(days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const [totalLogs, byAction, byEntity] = await Promise.all([
    prisma.auditLog.count({
      where: { timestamp: { gte: startDate } },
    }),
    prisma.auditLog.groupBy({
      by: ["action"],
      _count: true,
      where: { timestamp: { gte: startDate } },
    }),
    prisma.auditLog.groupBy({
      by: ["entityType"],
      _count: true,
      where: { timestamp: { gte: startDate } },
    }),
  ]);

  return {
    totalLogs,
    byAction: byAction.map((a: any) => ({ action: a.action, count: a._count })),
    byEntity: byEntity
      .filter((e: any) => e.entityType)
      .map((e: any) => ({ entityType: e.entityType, count: e._count })),
  };
}

export async function getRecentActivity(limit: number = 10) {
  return prisma.auditLog.findMany({
    take: limit,
    orderBy: { timestamp: "desc" },
    include: {
      actor: { select: { name: true } },
    },
  });
}

export async function getAuditActions() {
  return [
    "CREATE",
    "UPDATE",
    "DELETE",
    "APPROVE",
    "REJECT",
    "PROVISION",
    "LOGIN",
    "LOGOUT",
    "EXPORT",
    "LOG",
  ];
}

export async function getAuditEntities() {
  return [
    "User",
    "Request",
    "VM",
    "Hardware",
    "Workflow",
    "Settings",
    "Session",
  ];
}
