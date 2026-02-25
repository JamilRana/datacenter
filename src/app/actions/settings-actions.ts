// src/app/actions/settings-actions.ts
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { revalidatePath } from "next/cache";
import { ROLES } from "@/lib/roles";
import fs from "fs";
import path from "path";

export async function updateSetting(key: string, value: string) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.roles.includes(ROLES.ADMIN)) {
    throw new Error("Unauthorized");
  }

  await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });

  await prisma.auditLog.create({
    data: {
      actorId: session.user.id,
      action: "UPDATE_SETTING",
      entityType: "SYSTEM_SETTING",
      entityId: key,
      details: JSON.stringify({ value }),
    },
  });

  revalidatePath("/admin/settings");
}

export async function getSettings() {
  return prisma.systemSetting.findMany();
}

export async function saveSettings(settings: { key: string; value: string }[]) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.roles.includes(ROLES.ADMIN)) {
    throw new Error("Unauthorized");
  }

  try {
    // ✅ FIX: Add timeout and maxWait options to transaction
    // timeout: 30 seconds, maxWait: 10 seconds to acquire connection
    await prisma.$transaction(
      async (tx) => {
        // Batch upserts for better performance
        const upsertPromises = settings.map((s) =>
          tx.systemSetting.upsert({
            where: { key: s.key },
            update: { value: s.value },
            create: { key: s.key, value: s.value },
          })
        );

        // Execute all upserts in parallel within transaction
        await Promise.all(upsertPromises);

        // Create audit log
        await tx.auditLog.create({
          data: {
            actorId: session.user.id,
            action: "UPDATE_SETTINGS",
            entityType: "SYSTEM_SETTING",
            entityId: "bulk_update",
            details: JSON.stringify({ 
              settings: settings.map(s => s.key),
              count: settings.length 
            }),
          },
        });
      },
      {
        maxWait: 10000,  // Wait up to 10s to acquire connection
        timeout: 30000,  // Transaction timeout: 30 seconds
      }
    );

    revalidatePath("/admin/settings");
    return { success: true };
  } catch (error) {
    console.error("Transaction error saving settings:", error);
    
    // ✅ Handle specific Prisma error codes
    if (error instanceof Error && 'code' in error) {
      const prismaError = error as any;
      if (prismaError.code === 'P2028') {
        throw new Error("Database transaction timeout. Please try again or reduce the number of settings being saved.");
      }
      if (prismaError.code === 'P2002') {
        throw new Error("Unique constraint failed. A setting with this key already exists.");
      }
    }
    
    throw new Error("Failed to save settings. Please check database connectivity and try again.");
  }
}

export async function getSystemHealth() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.roles.includes(ROLES.ADMIN)) {
    throw new Error("Unauthorized");
  }

  let dbStatus: "connected" | "disconnected" = "connected";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = "disconnected";
  }

  let diskUsage = 0;
  try {
    const uploadPath = path.join(process.cwd(), "uploads");
    if (fs.existsSync(uploadPath)) {
      const size = getDirSize(uploadPath);
      diskUsage = Math.min(95, Math.round((size / (100 * 1024 * 1024 * 1024)) * 100));
    }
  } catch {
    console.error("Error calculating disk usage");
  }

  let uploadSize = 0;
  try {
    const uploadPath = path.join(process.cwd(), "uploads");
    if (fs.existsSync(uploadPath)) {
      uploadSize = getDirSize(uploadPath);
    }
  } catch {
    console.error("Error getting upload size");
  }

  return {
    database: dbStatus,
    diskUsage,
    uploadPath: path.join(process.cwd(), "uploads"),
    uploadSize,
  };
}

function getDirSize(dirPath: string): number {
  let size = 0;
  try {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        size += getDirSize(filePath);
      } else {
        size += stat.size;
      }
    }
  } catch {
    // Ignore errors
  }
  return size;
}