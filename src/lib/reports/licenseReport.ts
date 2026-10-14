// src/lib/reports/licenseReport.ts
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { differenceInDays, addDays } from "date-fns";
import { 
  SoftwareLicenseReportItem, 
  LicenseReportSummary 
} from "@/types/reports";

export interface LicenseReportParams {
  page?: number;
  pageSize?: number;
  getAll?: boolean;
  searchTerm?: string;
  vendor?: string;
  type?: string;
  expiryStatus?: string; // "ALL" | "EXPIRED" | "EXPIRING_30D" | "EXPIRING_60D" | "EXPIRING_90D" | "ACTIVE" | "PERPETUAL"
  from?: Date;
  to?: Date;
  sortBy?: "name" | "vendor" | "type" | "expiryDate" | "daysRemaining";
  sortOrder?: "asc" | "desc";
}

export interface LicenseReportResult {
  data: SoftwareLicenseReportItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: LicenseReportSummary;
  availableVendors: string[];
  availableTypes: string[];
}

/**
 * Computes the lifecycle expiry status and days remaining for a software license.
 */
export function computeLicenseExpiryStatus(
  expiryDate: Date | string | null | undefined,
  currentDate: Date = new Date()
): {
  daysRemaining: number | null;
  expiryStatus: "EXPIRED" | "EXPIRING_30D" | "EXPIRING_90D" | "ACTIVE" | "PERPETUAL";
} {
  if (!expiryDate) {
    return {
      daysRemaining: null,
      expiryStatus: "PERPETUAL",
    };
  }

  const exp = typeof expiryDate === "string" ? new Date(expiryDate) : expiryDate;
  if (isNaN(exp.getTime())) {
    return {
      daysRemaining: null,
      expiryStatus: "PERPETUAL",
    };
  }

  const daysRemaining = differenceInDays(exp, currentDate);

  if (daysRemaining < 0) {
    return { daysRemaining, expiryStatus: "EXPIRED" };
  }
  if (daysRemaining <= 30) {
    return { daysRemaining, expiryStatus: "EXPIRING_30D" };
  }
  if (daysRemaining <= 90) {
    return { daysRemaining, expiryStatus: "EXPIRING_90D" };
  }
  return { daysRemaining, expiryStatus: "ACTIVE" };
}

/**
 * Generates the authoritative License Report covering licenses by expiry, vendor, and type.
 */
export async function getLicenseReport(
  params: LicenseReportParams = {}
): Promise<LicenseReportResult> {
  const {
    page = 1,
    pageSize = 10,
    getAll = false,
    searchTerm,
    vendor,
    type,
    expiryStatus = "ALL",
    from,
    to,
    sortBy = "expiryDate",
    sortOrder = "asc"
  } = params;

  const now = new Date();
  const in30Days = addDays(now, 30);
  const in60Days = addDays(now, 60);
  const in90Days = addDays(now, 90);

  // Build Prisma where conditions
  const andClauses: Prisma.SoftwareLicenseWhereInput[] = [];

  // 1. Search term filter
  if (searchTerm && searchTerm.trim()) {
    const q = searchTerm.trim();
    andClauses.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { vendor: { contains: q, mode: "insensitive" } },
        { type: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
        { assets: { some: { name: { contains: q, mode: "insensitive" } } } },
      ]
    });
  }

  // 2. Vendor filter
  if (vendor && vendor !== "ALL") {
    andClauses.push({
      vendor: { equals: vendor, mode: "insensitive" }
    });
  }

  // 3. Type filter
  if (type && type !== "ALL") {
    andClauses.push({
      type: { equals: type, mode: "insensitive" }
    });
  }

  // 4. Expiry status filter
  if (expiryStatus && expiryStatus !== "ALL") {
    switch (expiryStatus) {
      case "EXPIRED":
        andClauses.push({ expiryDate: { lt: now } });
        break;
      case "EXPIRING_30D":
        andClauses.push({ expiryDate: { gte: now, lte: in30Days } });
        break;
      case "EXPIRING_60D":
        andClauses.push({ expiryDate: { gte: now, lte: in60Days } });
        break;
      case "EXPIRING_90D":
        andClauses.push({ expiryDate: { gte: now, lte: in90Days } });
        break;
      case "ACTIVE":
        andClauses.push({ expiryDate: { gte: now } });
        break;
      case "PERPETUAL":
        andClauses.push({ expiryDate: null });
        break;
    }
  }

  // 5. Date range boundary filter (on expiryDate)
  if (from || to) {
    andClauses.push({
      expiryDate: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      }
    });
  }

  const whereClause: Prisma.SoftwareLicenseWhereInput = andClauses.length > 0 
    ? { AND: andClauses } 
    : {};

  const skip = getAll ? undefined : (page - 1) * pageSize;
  const take = getAll ? undefined : pageSize;

  // Ordering definition
  let orderByClause: Prisma.SoftwareLicenseOrderByWithRelationInput = { expiryDate: "asc" };
  if (sortBy === "name") {
    orderByClause = { name: sortOrder };
  } else if (sortBy === "vendor") {
    orderByClause = { vendor: sortOrder };
  } else if (sortBy === "type") {
    orderByClause = { type: sortOrder };
  } else if (sortBy === "expiryDate" || sortBy === "daysRemaining") {
    orderByClause = { expiryDate: sortOrder };
  }

  // Execute database queries in parallel
  const [
    licenses,
    totalMatching,
    allVendorsRaw,
    allTypesRaw,
    summaryTotal,
    summaryExpired,
    summary30D,
    summary90D,
    summaryPerpetual
  ] = await Promise.all([
    prisma.softwareLicense.findMany({
      where: whereClause,
      include: {
        assets: {
          select: {
            id: true,
            name: true,
            type: true,
            serial: true,
          }
        }
      },
      skip,
      take,
      orderBy: orderByClause
    }),
    prisma.softwareLicense.count({ where: whereClause }),
    // Distinct vendors in system
    prisma.softwareLicense.findMany({
      where: { vendor: { not: "" } },
      select: { vendor: true },
      distinct: ["vendor"]
    }),
    // Distinct types in system
    prisma.softwareLicense.findMany({
      where: { type: { not: "" } },
      select: { type: true },
      distinct: ["type"]
    }),
    // System-wide KPI counts
    prisma.softwareLicense.count(),
    prisma.softwareLicense.count({ where: { expiryDate: { lt: now } } }),
    prisma.softwareLicense.count({ where: { expiryDate: { gte: now, lte: in30Days } } }),
    prisma.softwareLicense.count({ where: { expiryDate: { gte: now, lte: in90Days } } }),
    prisma.softwareLicense.count({ where: { expiryDate: null } }),
  ]);

  const activeCount = Math.max(0, summaryTotal - summaryExpired - summaryPerpetual);

  const availableVendors = allVendorsRaw
    .map(v => v.vendor.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const availableTypes = allTypesRaw
    .map(t => t.type.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  // Transform to SoftwareLicenseReportItem
  const data: SoftwareLicenseReportItem[] = licenses.map((lic) => {
    const { daysRemaining, expiryStatus: calculatedStatus } = computeLicenseExpiryStatus(lic.expiryDate, now);

    return {
      id: lic.id,
      name: lic.name,
      vendor: lic.vendor,
      type: lic.type,
      expiryDate: lic.expiryDate ? lic.expiryDate.toISOString() : null,
      maintenanceExpiry: lic.maintenanceExpiry ? lic.maintenanceExpiry.toISOString() : null,
      daysRemaining,
      expiryStatus: calculatedStatus,
      notes: lic.notes,
      assignedAssets: lic.assets.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        serial: a.serial,
      })),
      assetsCount: lic.assets.length,
      createdAt: lic.createdAt.toISOString(),
      updatedAt: lic.updatedAt.toISOString(),
    };
  });

  const summary: LicenseReportSummary = {
    totalLicenses: summaryTotal,
    expiredCount: summaryExpired,
    expiringIn30Days: summary30D,
    expiringIn90Days: summary90D,
    activeCount,
    perpetualCount: summaryPerpetual,
    totalVendors: availableVendors.length,
    totalTypes: availableTypes.length,
  };

  return {
    data,
    total: totalMatching,
    page,
    pageSize,
    summary,
    availableVendors,
    availableTypes,
  };
}
