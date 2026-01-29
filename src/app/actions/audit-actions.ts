"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { ROLES } from "@/lib/roles";
import { Prisma } from "@prisma/client";

export async function getAuditLogs({
  search,
  action,
  page = 1,
  perPage = 20,
}: {
  search?: string;
  action?: string;
  page?: number;
  perPage?: number;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.roles?.includes(ROLES.ADMIN)) 
    throw new Error("Unauthorized");

  const where: Prisma.AuditLogWhereInput = {};
  const searchTerm = search?.trim();

  // Search across action and details
if (searchTerm) {
    where.OR = [
      { action: { contains: searchTerm, mode: "insensitive" as const } },
      { entityType: { contains: searchTerm, mode: "insensitive" as const } },
      { entityId: { contains: searchTerm, mode: "insensitive" as const } },
    ];
  }

  // Action filter
  if (action && action !== "all") {
    where.action = action;
  }

  const skip = (page - 1) * perPage;
  
  const [logs, total, uniqueActions] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { timestamp: "desc" },
      select: {
        id: true,
        timestamp: true,
        action: true,
        entityType: true,
        entityId: true,
        details: true,
        actor: {
          select: { id: true, name: true, email: true }
        }
      },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ 
      by: ["action"],
      _count: true,
      orderBy: { action: "asc" }
    }).then(groups => groups.map(g => g.action)),
  ]);

  // Safely parse details
  const processedLogs = logs.map(log => ({
    ...log,
    details: log.details 
      ? (() => {
          try {
            return typeof log.details === "string" 
              ? JSON.parse(log.details) 
              : log.details;
          } catch {
            return log.details;
          }
        })()
      : undefined,
  }));

  return {
    logs: processedLogs,
    total,
    totalPages: Math.ceil(total / perPage),
    currentPage: page,
    uniqueActions,
  };
}