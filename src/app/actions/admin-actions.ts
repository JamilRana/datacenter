// src/app/actions/admin-actions.ts
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { ROLES } from "@/lib/roles";

export async function getAdminMetrics() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.roles?.includes(ROLES.ADMIN)) throw new Error("Unauthorized");

  const [users, requests, instances, audits] = await Promise.all([
    prisma.user.count(),
    prisma.request.count(),
    prisma.vmInstance.count(),
    prisma.auditLog.count({ where: { timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
  ]);

  // Bottleneck Detection: Pending approvals > 48 hours
  const bottleneckThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const stalledRequests = await prisma.request.count({
    where: {
      status: { in: ["PENDING_L1", "PENDING_L2", "PENDING_L3"] },
      submittedAt: { lte: bottleneckThreshold }
    }
  });

  // Recent high-impact audits
  const recentHighImpact = await prisma.auditLog.findMany({
    where: {
      action: { in: ["EXECUTION_COMPLETED", "DELETE_USER", "LOGIN_FAILURE"] }
    },
    orderBy: { timestamp: "desc" },
    take: 5,
    include: { actor: { select: { name: true } } }
  });

  return {
    summary: { users, requests, instances, audits24h: audits },
    bottlenecks: { stalledRequests },
    activities: recentHighImpact,
    systemStatus: "OPTIMAL"
  };
}
