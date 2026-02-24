// src/app/api/inventory/stats/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { VmStatus } from "@prisma/client";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = session.user.roles.includes("ADMIN");
    const isDCOPS = session.user.roles.includes("DCOPS");
    const canViewAll = isAdmin || isDCOPS;

    // Get active VM count (PROVISIONED status)
    const activeVms = await prisma.vmInstance.count({
      where: {
        status: VmStatus.ACTIVE,
        ...(!canViewAll ? { ownerId: session.user.id } : {})
      }
    });

    // For non-privileged users, only return VM count
    if (!canViewAll) {
      return NextResponse.json({
        activeVms,
        totalAssets: 0,
        totalLicenses: 0,
        expiringLicenses: 0
      });
    }

    // Get total assets count
    const totalAssets = await prisma.asset.count();

    // Get total licenses count
    const totalLicenses = await prisma.softwareLicense.count();

    // Get expiring licenses (within 30 days)
    const expiringLicenses = await prisma.softwareLicense.count({
      where: {
        expiryDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      }
    });

    return NextResponse.json({
      activeVms,
      totalAssets,
      totalLicenses,
      expiringLicenses
    });
  } catch (error) {
    console.error("Error fetching inventory stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch inventory stats" },
      { status: 500 }
    );
  }
}
