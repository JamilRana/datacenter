// src/app/actions/settings-actions.ts
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { revalidatePath } from "next/cache";

export async function updateSetting(key: string, value: string) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  await (prisma as any).systemSetting.upsert({
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
    return (prisma as any).systemSetting.findMany();
}
