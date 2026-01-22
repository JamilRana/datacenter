// src/app/api/dashboard/approver/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { RequestStatus } from "@prisma/client";

export async function GET() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = session.user.id;
    const userRole = session.user.role;

    // Determine approval level
    let approvalLevel: "L1" | "L2" | "L3" | null = null;
    if (userRole === "APPROVER_L1") approvalLevel = "L1";
    else if (userRole === "APPROVER_L2") approvalLevel = "L2";
    else if (userRole === "APPROVER_L3") approvalLevel = "L3";

    if (!approvalLevel) {
      return NextResponse.json({ error: "Invalid approver role" }, { status: 403 });
    }

    // Get pending approvals for this level
    const pendingApprovals = await prisma.request.findMany({
      where: { 
        status: `PENDING_${approvalLevel}` as RequestStatus
      },
      include: {
        requester: {
          select: { name: true, email: true }
        }
      },
      orderBy: { createdAt: "asc" },
      take: 10
    });

    // Get resource utilization trends (mock data - replace with real metrics)
    const resourceTrends = [
      { date: "Jan", cpu: 45, ram: 62 },
      { date: "Feb", cpu: 52, ram: 70 },
      { date: "Mar", cpu: 68, ram: 85 },
      { date: "Apr", cpu: 60, ram: 78 }
    ];

    // Get compliance stats
    const complianceStats = await Promise.all([
      prisma.request.count({
        where: { requiredPublicIP: true, status: "APPROVED" }
      }),
      prisma.request.count({
        where: { vpnRequired: true, status: "APPROVED" }
      }),
      prisma.request.count({
        where: { 
          vaReportSubmitted: false, 
          status: "APPROVED",
          environment: "PRODUCTION"
        }
      })
    ]);

    // Get recent activity
    const recentActivity = await prisma.approval.findMany({
      where: { 
        approverId: userId,
        decision: { in: ["APPROVED", "REJECTED"] }
      },
      include: {
        approver: { select: { name: true } },
        // Note: You'll need to handle polymorphic relations properly
      },
      orderBy: { decidedAt: "desc" },
      take: 5
    });

    return NextResponse.json({
      pendingApprovals: pendingApprovals.map(req => ({
        id: req.id,
        name: req.systemName,
        requester: req.requester.name,
        level: approvalLevel,
        resources: `${req.vcpu || 0} vCPU / ${req.ramGb || 0}GB RAM`,
        environment: req.environment
      })),
      resourceTrends,
      complianceStats: {
        publicIpRequests: complianceStats[0],
        vpnAccess: complianceStats[1],
        missingVaReports: complianceStats[2]
      },
      recentActivity: recentActivity.map(activity => ({
        action: activity.decision === "APPROVED" ? "Approved" : "Rejected",
        item: `REQ-${activity.entityId.slice(0, 8)}`,
        user: activity.approver.name,
        time: activity.decidedAt?.toISOString() || new Date().toISOString()
      }))
    });
  } catch (error) {
    console.error("Approver Dashboard API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch approver dashboard data" }, 
      { status: 500 }
    );
  }
}