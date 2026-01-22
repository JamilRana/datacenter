// src/app/api/dashboard/requester/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = session.user.id;

    // Get request stats
    const [activeRequests, approvedVms, pendingApprovals] = await Promise.all([
      prisma.request.count({
        where: { 
          requesterId: userId, 
          status: { in: ["DRAFT", "PENDING_L1", "PENDING_L2", "PENDING_L3"] } 
        }
      }),
      prisma.vmInstance.count({
        where: { 
          request: { requesterId: userId },
          status: "ACTIVE"
        }
      }),
      prisma.request.count({
        where: { 
          requesterId: userId, 
          status: { in: ["PENDING_L1", "PENDING_L2", "PENDING_L3"] } 
        }
      })
    ]);

    // Get total resources
    const totalResources = await prisma.vmSpec.aggregate({
      _sum: {
        vcpu: true,
        ramGb: true
      },
      where: {
        vmInstance: {
          request: { requesterId: userId },
          status: "ACTIVE"
        }
      }
    });

    // Get recent requests
    const recentRequests = await prisma.request.findMany({
      where: { requesterId: userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        systemName: true,
        status: true,
        environment: true,
        createdAt: true
      }
    });

    // Get active VMs with current specs
    const activeVms = await prisma.vmInstance.findMany({
      where: { 
        request: { requesterId: userId },
        status: "ACTIVE"
      },
      include: {
        currentSpec: {
          select: {
            vcpu: true,
            ramGb: true
          }
        }
      },
      take: 5
    });

    return NextResponse.json({
      stats: {
        activeRequests,
        approvedVms,
        pendingApprovals,
        totalResources: {
          vcpu: totalResources._sum.vcpu || 0,
          ramGb: totalResources._sum.ramGb || 0
        }
      },
      recentRequests,
      activeVms: activeVms.map(vm => ({
        id: vm.id,
        name: `vm-${vm.id.slice(0, 8)}`,
        ip: vm.ipAddress || "N/A",
        status: vm.status,
        cpu: "N/A", // Would come from monitoring system
        ram: "N/A"
      }))
    });
  } catch (error) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" }, 
      { status: 500 }
    );
  }
}