// lib/analytics/licenseAnalytics.ts
import prisma from "@/lib/prisma";

export interface LicenseSummary {
  total: number;
  expiringSoon: number;
  expiringThisMonth: number;
}

export interface LicenseByVendor {
  vendor: string;
  count: number;
}

export interface LicenseByType {
  type: string;
  count: number;
}

export interface LicenseExpiry {
  id: string;
  name: string;
  vendor: string;
  expiryDate: Date | null;
}

export interface LicenseActivity {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorName: string;
  details: string;
  createdAt: Date;
}

export interface LicenseAnalytics {
  summary: LicenseSummary;
  byVendor: LicenseByVendor[];
  byType: LicenseByType[];
  expiringLicenses: LicenseExpiry[];
  recentActivity: LicenseActivity[];
}

export async function getLicenseAnalytics(): Promise<LicenseAnalytics> {
  const [
    summary,
    byVendor,
    byType,
    expiringLicenses,
    recentActivity,
  ] = await Promise.all([
    getLicenseSummary(),
    getLicenseByVendor(),
    getLicenseByType(),
    getExpiringLicenses(),
    getRecentLicenseActivity(),
  ]);

  return {
    summary,
    byVendor,
    byType,
    expiringLicenses,
    recentActivity,
  };
}

async function getLicenseSummary(): Promise<LicenseSummary> {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [total, expiringSoon, expiringThisMonth] = await Promise.all([
    prisma.softwareLicense.count(),
    prisma.softwareLicense.count({
      where: {
        expiryDate: {
          lte: thirtyDaysFromNow,
          gt: now,
        },
      },
    }),
    prisma.softwareLicense.count({
      where: {
        expiryDate: {
          lte: thirtyDaysFromNow,
          gte: now,
        },
      },
    }),
  ]);

  return { total, expiringSoon, expiringThisMonth };
}

async function getLicenseByVendor(): Promise<LicenseByVendor[]> {
  const licenses = await prisma.softwareLicense.findMany({
    where: { vendor: { not: "" } },
    select: { vendor: true },
  });
  
  const vendorCount: Record<string, number> = {};
  for (const lic of licenses) {
    vendorCount[lic.vendor] = (vendorCount[lic.vendor] || 0) + 1;
  }
  
  return Object.entries(vendorCount)
    .map(([vendor, count]: any) => ({ vendor, count }))
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, 10);
}

async function getLicenseByType(): Promise<LicenseByType[]> {
  const licenses = await prisma.softwareLicense.findMany({
    where: { type: { not: "" } },
    select: { type: true },
  });
  
  const typeCount: Record<string, number> = {};
  for (const lic of licenses) {
    typeCount[lic.type] = (typeCount[lic.type] || 0) + 1;
  }
  
  return Object.entries(typeCount)
    .map(([type, count]: any) => ({ type, count }))
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, 10);
}

async function getExpiringLicenses(): Promise<LicenseExpiry[]> {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const licenses = await prisma.softwareLicense.findMany({
    where: {
      expiryDate: {
        lte: thirtyDaysFromNow,
        gt: now,
      },
    },
    select: {
      id: true,
      name: true,
      vendor: true,
      expiryDate: true,
    },
    orderBy: { expiryDate: "asc" },
    take: 10,
  });

  return licenses;
}

async function getRecentLicenseActivity(): Promise<LicenseActivity[]> {
  const logs = await prisma.auditLog.findMany({
    where: {
      action: {
        in: ["LICENSE_CREATED", "LICENSE_ASSIGNED", "LICENSE_EXPIRED", "LICENSE_UPDATED"],
      },
    },
    take: 10,
    orderBy: { timestamp: "desc" },
    include: {
      actor: { select: { name: true } },
    },
  });

  return logs.map((log: any) => ({
    id: log.id,
    action: log.action,
    entityType: log.entityType || "LICENSE",
    entityId: log.entityId || "",
    actorName: log.actor?.name || "System",
    details: log.details ? JSON.stringify(log.details) : "",
    createdAt: log.timestamp,
  }));
}
