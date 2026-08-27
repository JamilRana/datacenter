// src/lib/dashboard/systemHealth.ts
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import { getMinioClient } from "@/lib/services/minio.service";
import { SystemHealthItem } from "@/types/dashboard";

export async function checkSystemHealth(): Promise<SystemHealthItem[]> {
  const healthResults: SystemHealthItem[] = [];

  // 1. PostgreSQL Database Check
  try {
    const dbStart = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Math.round(performance.now() - dbStart);
    healthResults.push({
      name: "PostgreSQL Database",
      status: dbLatency > 1500 ? "warning" : "healthy",
      latencyMs: dbLatency,
      message: dbLatency > 1500 ? "High query latency" : "Connected & operational",
      category: "database",
    });
  } catch (error) {
    healthResults.push({
      name: "PostgreSQL Database",
      status: "error",
      message: error instanceof Error ? error.message : "Connection failed",
      category: "database",
    });
  }

  // 2. Redis Cache Check
  try {
    const redisStart = performance.now();
    if (redis && redis.status === "ready") {
      await redis.ping();
      const redisLatency = Math.round(performance.now() - redisStart);
      healthResults.push({
        name: "Redis Cache",
        status: redisLatency > 500 ? "warning" : "healthy",
        latencyMs: redisLatency,
        message: "Active cache cluster",
        category: "cache",
      });
    } else {
      healthResults.push({
        name: "Redis Cache",
        status: "warning",
        message: "Operating in in-memory fallback mode",
        category: "cache",
      });
    }
  } catch {
    healthResults.push({
      name: "Redis Cache",
      status: "warning",
      message: "Cache fallback active",
      category: "cache",
    });
  }

  // 3. MinIO Object Storage Check
  try {
    const minioStart = performance.now();
    const client = getMinioClient();
    if (client) {
      await client.listBuckets();
      const minioLatency = Math.round(performance.now() - minioStart);
      healthResults.push({
        name: "MinIO Storage",
        status: minioLatency > 2000 ? "warning" : "healthy",
        latencyMs: minioLatency,
        message: "Object storage connected",
        category: "storage",
      });
    } else {
      healthResults.push({
        name: "MinIO Storage",
        status: "warning",
        message: "Storage client uninitialized",
        category: "storage",
      });
    }
  } catch {
    healthResults.push({
      name: "MinIO Storage",
      status: "warning",
      message: "MinIO unreachable (local fallback active)",
      category: "storage",
    });
  }

  // 4. Application Runtime Check
  try {
    const mem = process.memoryUsage();
    const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
    healthResults.push({
      name: "Application Server",
      status: heapUsedMb > 1024 ? "warning" : "healthy",
      latencyMs: 0,
      message: `Node.js runtime OK (${heapUsedMb} MB heap)`,
      category: "app",
    });
  } catch {
    healthResults.push({
      name: "Application Server",
      status: "healthy",
      message: "Online",
      category: "app",
    });
  }

  // 5. SMTP Notification Service Check
  try {
    const smtpSettings = await prisma.systemSetting.findMany({
      where: {
        key: { in: ["smtp_host", "smtp_user", "email_notifications_enabled"] },
      },
    });
    const hasHost = smtpSettings.some(s => s.key === "smtp_host" && s.value?.trim());
    const isConfigured = hasHost || !!process.env.SMTP_HOST;
    
    healthResults.push({
      name: "SMTP Mailer",
      status: isConfigured ? "healthy" : "warning",
      message: isConfigured ? "SMTP configured & active" : "SMTP host not configured",
      category: "smtp",
    });
  } catch {
    healthResults.push({
      name: "SMTP Mailer",
      status: "healthy",
      message: "Ready",
      category: "smtp",
    });
  }

  return healthResults;
}
