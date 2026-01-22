// src/app/api/inventory/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const [assets, vms, licenses, recentAssets, recentVms, recentLicenses] =
      await Promise.all([
        prisma.asset.count(),
        prisma.vmInstance.count(),
        prisma.softwareLicense.count(),
        prisma.asset.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            type: true,
            vendor: true,
            serial: true,
            location: true,
          },
        }),
        prisma.vmInstance.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          include: { request: { select: { systemName: true } } },
        }),
        prisma.softwareLicense.findMany({
          take: 5,
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            vendor: true,
          },
        }),
      ]);

    return NextResponse.json({
      summary: { assets, vms, licenses },
      recentAssets,
      recentVms,
      recentLicenses,
      role: session.user.role,
    });
  } catch (error) {
    console.error(error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
