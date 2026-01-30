"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { RequestStatus } from "@prisma/client";

export interface HomeDashboardData {
  activeVmCount: number;
  decommissionedVmCount: number;
  totalRequestCount: number;
  pendingCount: number;
  returnedRequests: Array<{
    id: string;
    systemName: string;
    status: RequestStatus;
  }>;
  rejectedCount: number;
  recentRequests: Array<{
    id: string;
    systemName: string;
    requestType: string;
    environment: string;
    status: RequestStatus;
    createdAt: Date;
  }>;
}

export async function getHomeDashboardData(): Promise<HomeDashboardData> {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const userId = session.user.id;

  // Parallelize all queries for optimal performance
  const [
    activeVmCount,
    decommissionedVmCount,
    totalRequestCount,
    pendingCount,
    returnedRequests,
    rejectedCount,
    recentRequests
  ] = await Promise.all([
    prisma.vmInstance.count({
      where: { 
        status: "ACTIVE",
        request: { requesterId: userId } 
      }
    }),
    prisma.vmInstance.count({
      where: { 
        status: "RETIRED",
        request: { requesterId: userId } 
      }
    }),
    prisma.request.count({
      where: { requesterId: userId }
    }),
    prisma.request.count({
      where: { 
        requesterId: userId,
        status: { in: ["PENDING_L1", "PENDING_L2", "PENDING_L3"] }
      }
    }),
    prisma.request.findMany({
      where: { 
        requesterId: userId,
        status: "DRAFT",
        approvals: { some: { decision: "RETURNED" } }
      },
      select: {
        id: true,
        systemName: true,
        status: true
      },
      take: 3
    }),
    prisma.request.count({
      where: { 
        requesterId: userId, 
        status: "REJECTED" 
      }
    }),
    prisma.request.findMany({
      where: { requesterId: userId },
      select: {
        id: true,
        systemName: true,
        requestType: true,
        environment: true,
        status: true,
        createdAt: true
      },
      orderBy: { createdAt: "desc" },
      take: 5
    })
  ]);

  return {
    activeVmCount,
    decommissionedVmCount,
    totalRequestCount,
    pendingCount,
    returnedRequests,
    rejectedCount,
    recentRequests
  };
}