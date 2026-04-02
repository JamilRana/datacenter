// lib/analytics/hardwareAnalytics.ts
import prisma from "@/lib/prisma";

export interface HardwareSummary {
  total: number;
}

export interface HardwareByCategory {
  category: string;
  count: number;
}

export interface HardwareByType {
  type: string;
  count: number;
}

export interface HardwareByLocation {
  location: string;
  count: number;
}

export interface HardwareActivity {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorName: string;
  details: string;
  createdAt: Date;
}

export interface HardwareAnalytics {
  summary: HardwareSummary;
  byCategory: HardwareByCategory[];
  byType: HardwareByType[];
  byLocation: HardwareByLocation[];
  recentActivity: HardwareActivity[];
}

export async function getHardwareAnalytics(): Promise<HardwareAnalytics> {
  const [
    summary,
    byCategory,
    byType,
    byLocation,
    recentActivity,
  ] = await Promise.all([
    getHardwareSummary(),
    getHardwareByCategory(),
    getHardwareByType(),
    getHardwareByLocation(),
    getRecentHardwareActivity(),
  ]);

  return {
    summary,
    byCategory,
    byType,
    byLocation,
    recentActivity,
  };
}

async function getHardwareSummary(): Promise<HardwareSummary> {
  const total = await prisma.asset.count();
  return { total };
}

async function getHardwareByCategory(): Promise<HardwareByCategory[]> {
  const assets = await prisma.asset.findMany({
    select: { type: true },
  });
  
  const categoryCount: Record<string, number> = {};
  for (const asset of assets) {
    categoryCount[asset.type] = (categoryCount[asset.type] || 0) + 1;
  }
  
  return Object.entries(categoryCount)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

async function getHardwareByType(): Promise<HardwareByType[]> {
  const assets = await prisma.asset.findMany({
    select: { type: true },
  });
  
  const typeCount: Record<string, number> = {};
  for (const asset of assets) {
    typeCount[asset.type] = (typeCount[asset.type] || 0) + 1;
  }
  
  return Object.entries(typeCount)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

async function getHardwareByLocation(): Promise<HardwareByLocation[]> {
  const assets = await prisma.asset.findMany({
    where: { location: { not: "" } },
    select: { location: true },
  });
  
  const locationCount: Record<string, number> = {};
  for (const asset of assets) {
    if (asset.location) {
      locationCount[asset.location] = (locationCount[asset.location] || 0) + 1;
    }
  }
  
  return Object.entries(locationCount)
    .map(([location, count]) => ({ location, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

async function getRecentHardwareActivity(): Promise<HardwareActivity[]> {
  const logs = await prisma.auditLog.findMany({
    where: {
      action: {
        in: ["ASSET_CREATED", "ASSET_ALLOCATED", "ASSET_UPDATED", "ASSET_RETIRED"],
      },
    },
    take: 10,
    orderBy: { timestamp: "desc" },
    include: {
      actor: { select: { name: true } },
    },
  });

  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    entityType: log.entityType || "ASSET",
    entityId: log.entityId || "",
    actorName: log.actor?.name || "System",
    details: log.details ? JSON.stringify(log.details) : "",
    createdAt: log.timestamp,
  }));
}
