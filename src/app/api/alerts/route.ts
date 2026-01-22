// src/app/api/alerts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";

// Alert severity levels
type AlertSeverity = "critical" | "warning" | "info";

// Mock data structure (replace with real monitoring system)
interface SystemAlert {
  id: string;
  severity: AlertSeverity;
  message: string;
  source: string;
  timestamp: string;
}

// Simulate real-time monitoring data
function generateMockAlerts(): SystemAlert[] {
  const now = new Date();
  return [
    {
      id: "alert-001",
      severity: "critical" as AlertSeverity,
      message: "High CPU usage on node-03",
      source: "compute-cluster",
      timestamp: new Date(now.getTime() - 2 * 60 * 1000).toISOString(), // 2 min ago
    },
    {
      id: "alert-002",
      severity: "warning" as AlertSeverity,
      message: "Disk space low on storage-01",
      source: "storage-cluster",
      timestamp: new Date(now.getTime() - 15 * 60 * 1000).toISOString(), // 15 min ago
    },
    {
      id: "alert-003",
      severity: "info" as AlertSeverity,
      message: "VM provisioning completed successfully",
      source: "provisioning-service",
      timestamp: new Date(now.getTime() - 60 * 60 * 1000).toISOString(), // 1 hour ago
    },
    {
      id: "alert-004",
      severity: "warning" as AlertSeverity,
      message: "Network latency spike detected",
      source: "network-monitor",
      timestamp: new Date(now.getTime() - 8 * 60 * 1000).toISOString(), // 8 min ago
    },
  ];
}

// Real implementation would connect to monitoring system
async function fetchSystemAlerts(): Promise<SystemAlert[]> {
  // In production, replace with actual monitoring API calls:
  // - Prometheus/Grafana alerts
  // - Custom monitoring service
  // - Cloud provider metrics (AWS CloudWatch, Azure Monitor)
  
  // For now, return mock data
  return generateMockAlerts();
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  // Only DC Ops can access alerts
  if (!session?.user || session.user.role !== "DC_OPS") {
    return NextResponse.json(
      { error: "Unauthorized" }, 
      { status: 403 }
    );
  }

  try {
    const alerts = await fetchSystemAlerts();
    
    // Optional: Save critical alerts to database for audit
    const criticalAlerts = alerts.filter(a => a.severity === "critical");
    if (criticalAlerts.length > 0) {
      await prisma.auditLog.createMany({
        data: criticalAlerts.map(alert => ({
          actorId: session.user.id,
          action: "ALERT_TRIGGERED",
          entityType: "SYSTEM_ALERT",
          entityId: alert.id,
          details: {
            message: alert.message,
            source: alert.source,
            severity: alert.severity
          }
        }))
      });
    }

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error("Failed to fetch alerts:", error);
    return NextResponse.json(
      { error: "Failed to fetch alerts" }, 
      { status: 500 }
    );
  }
}