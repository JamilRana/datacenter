// src/app/actions/report-actions.ts
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { ROLES } from "@/lib/roles";
import { RequestStatus, Environment, Prisma } from "@prisma/client";
import { startOfDay, endOfDay, subDays, format } from "date-fns";

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  environment?: Environment;
  status?: RequestStatus;
}

/**
 * Aggregates system-wide data for the reports dashboard.
 */
export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  environment?: Environment;
  status?: RequestStatus;
}

/**
 * Aggregates system-wide data for the reports dashboard.
 */
export async function getSystemReportData(filters: ReportFilters = {}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const isAdmin = session.user.roles.includes(ROLES.ADMIN);
  const isApprover = session.user.roles.includes(ROLES.DCOPS);

  if (!isAdmin && !isApprover) {
    throw new Error("Forbidden: Access restricted to administrative roles.");
  }

  // ✅ Build date filter correctly
  const dateFilter: Prisma.DateTimeFilter<"Request"> = {};
  if (filters.startDate) {
    dateFilter.gte = startOfDay(new Date(filters.startDate));
  }
  if (filters.endDate) {
    dateFilter.lte = endOfDay(new Date(filters.endDate));
  }

  // ✅ Build where clause correctly
  const whereClause: Prisma.RequestWhereInput = {
    ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
    ...(filters.environment ? { environment: filters.environment } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };

  // 1. High-Level Summary
  const [vms, requests, licenses] = await Promise.all([
    prisma.vmInstance.count(),
    prisma.request.count({ where: whereClause }),
    prisma.softwareLicense.count(),
  ]);

  // 2. Environment Distribution
  const envGroups = await prisma.request.groupBy({
    by: ['environment'],
    _count: { _all: true },
    where: whereClause
  });

  // 3. Request Type Distribution
  const typeGroups = await prisma.request.groupBy({
    by: ['requestType'],
    _count: { _all: true },
    where: whereClause
  });

  // 4. Trend Data (Last 30 Days)
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const d = subDays(new Date(), i);
    return format(d, 'yyyy-MM-dd');
  }).reverse();

  const trendData = await Promise.all(last30Days.map(async (day) => {
    const dayStart = startOfDay(new Date(day));
    const dayEnd = endOfDay(new Date(day));
    
    const count = await prisma.request.count({
      where: {
        createdAt: {
          gte: dayStart,
          lte: dayEnd
        }
      }
    });
    return { day, count };
  }));

  // 5. User Activity (Top Requesters)
  const topRequesters = await prisma.request.groupBy({
    by: ['requesterId'],
    _count: { _all: true },
    orderBy: { _count: { requesterId: 'desc' } },
    take: 5
  });

  const requesterProfiles = await Promise.all(topRequesters.map(async (tr) => {
    const user = await prisma.user.findUnique({ 
      where: { id: tr.requesterId }, 
      select: { name: true, email: true } 
    });
    return { ...tr, user };
  }));

  return {
    summary: { vms, requests, licenses },
    envDistribution: envGroups,
    typeDistribution: typeGroups,
    trends: trendData,
    topRequesters: requesterProfiles,
    timestamp: new Date().toISOString()
  };
}

export async function getExportData(filters: ReportFilters = {}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  // ✅ Fix date filter for export data too
  const dateFilter: Prisma.DateTimeFilter<"Request"> = {};
  if (filters.startDate) {
    dateFilter.gte = startOfDay(new Date(filters.startDate));
  }
  if (filters.endDate) {
    dateFilter.lte = endOfDay(new Date(filters.endDate));
  }

  const whereClause: Prisma.RequestWhereInput = {
    ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
    ...(filters.environment ? { environment: filters.environment } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };

  const requests = await prisma.request.findMany({
    where: whereClause,
    include: {
      requester: { select: { name: true, email: true } },
      vmInstances: { select: { hostname: true, ipAddress: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  return requests.map(r => ({
    ID: r.id,
    System: r.systemName,
    Project: r.projectName || "N/A",
    Type: r.requestType,
    Status: r.status,
    Environment: r.environment,
    Requester: r.requester.name,
    Email: r.requester.email,
    Created: format(r.createdAt, "yyyy-MM-dd HH:mm:ss"),
    ProvisionedAt: r.provisionedAt ? format(r.provisionedAt, "yyyy-MM-dd") : "Pending",
    CPU: r.vcpu,
    RAM: r.ramGb,
    Storage: r.storageGb
  }));
}

