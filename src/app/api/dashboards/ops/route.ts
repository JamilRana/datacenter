// src/app/api/dashboard/ops/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";

// Mock system health data (replace with real monitoring system)
function getSystemHealth() {
  return {
    computeNodes: { value: 98, status: "healthy" },
    storageCluster: { value: 87, status: "warning" },
    network: { value: 100, status: "healthy" },
    database: { value: 92, status: "healthy" }
  };
}

// Mock real-time resource usage
function getResourceUsage() {
  return {
    cpu: Math.floor(Math.random() * 30) + 60, // 60-90%
    memory: Math.floor(Math.random() * 25) + 70, // 70-95%
    diskIo: Math.floor(Math.random() * 50) + 30 // 30-80%
  };
}

// Mock provisioning queue
async function getProvisioningQueue() {
  const provisioningRequests = await prisma.request.findMany({
    where: { 
      status: "APPROVED",
      vmInstances: { none: {} } // No VMs provisioned yet
    },
    orderBy: { createdAt: "asc" },
    take: 5,
    select: {
      id: true,
      systemName: true,
      createdAt: true
    }
  });

  const provisioningInProgress = await prisma.request.findMany({
    where: { 
      status: "PROVISIONED",
      provisionedAt: { gte: new Date(Date.now() - 3600000) } // Last hour
    },
    orderBy: { provisionedAt: "desc" },
    take: 5,
    select: {
      id: true,
      systemName: true,
      provisionedAt: true
    }
  });

  return {
    queued: provisioningRequests.map(req => ({
      id: req.id,
      name: req.systemName,
      status: "QUEUED",
      progress: 0
    })),
    inProgress: provisioningInProgress.map(req => ({
      id: req.id,
      name: req.systemName,
      status: "PROVISIONING",
      progress: Math.floor(Math.random() * 40) + 60 // 60-100%
    }))
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user || session.user.role !== "DC_OPS") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    // Get system health
    const systemHealth = getSystemHealth();
    
    // Get resource usage
    const resourceUsage = getResourceUsage();
    
    // Get provisioning queue
    const { queued, inProgress } = await getProvisioningQueue();
    
    // Get recent alerts
    const alerts = [
      { id: "1", severity: "critical", message: "High CPU on node-03", source: "compute", timestamp: new Date().toISOString() },
      { id: "2", severity: "warning", message: "Low Disk on storage-01", source: "storage", timestamp: new Date().toISOString() },
    ];

    return NextResponse.json({
      systemHealth,
      resourceUsage,
      provisioningQueue: [...inProgress, ...queued],
      alerts: alerts
    });
  } catch (error) {
    console.error("Ops Dashboard API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch ops dashboard data" }, 
      { status: 500 }
    );
  }
}