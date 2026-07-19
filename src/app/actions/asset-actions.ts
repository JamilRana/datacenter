// src/app/actions/asset-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { ROLES } from "@/lib/roles";


import { safeString, optionalSafeString } from "@/lib/validations/utils";

const optionalNumber = (val: number | string | undefined | null) => {
  if (val === undefined || val === null || val === "") return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
};

const optionalJson = (val: string | undefined | null) => {
  if (!val) return null;
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
};

const assetBaseSchema = z.object({
  name: z.string().min(1, "Name is required").pipe(safeString),
  type: z.string().min(1, "Type is required").pipe(safeString),
  vendor: optionalSafeString,
  model: optionalSafeString,
  serial: optionalSafeString,
  location: optionalSafeString,
  warrantyExpiry: z.string().optional().nullable().transform((val) => val ? new Date(val) : null),
  cpuCores: z.union([z.number(), z.string()]).optional().transform(optionalNumber),
  ramGb: z.union([z.number(), z.string()]).optional().transform(optionalNumber),
  storageGb: z.union([z.number(), z.string()]).optional().transform(optionalNumber),
  details: z.string().optional().transform(optionalJson),
});

export async function createAsset(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.roles?.some(r => r === ROLES.ADMIN || r === ROLES.DCOPS)) {
      return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const rawData = Object.fromEntries(formData);
    const validated = assetBaseSchema.parse(rawData);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyData: any = {
      name: validated.name,
      type: validated.type as import("@prisma/client").$Enums.AssetType,
      vendor: validated.vendor,
      model: validated.model,
      serial: validated.serial,
      location: validated.location,
      warrantyExpiry: validated.warrantyExpiry,
      cpuCores: validated.cpuCores,
      ramGb: validated.ramGb,
      storageGb: validated.storageGb,
    };

    await prisma.asset.create({ data: anyData });

    revalidatePath("/inventory/assets");
    return { success: true };
  } catch (error) {
    console.error("Failed to create asset:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message, code: "VALIDATION_ERROR" };
    }
    return { success: false, error: "Failed to create asset", code: "SERVER_ERROR" };
  }
}

export async function updateAsset(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.roles?.some(r => r === ROLES.ADMIN || r === ROLES.DCOPS)) {
      return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    const id = formData.get("id")?.toString();
    if (!id) return { success: false, error: "Asset ID is required", code: "BAD_REQUEST" };

    const rawData = Object.fromEntries(formData);
    const validated = assetBaseSchema.parse(rawData);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyData: any = {
      name: validated.name,
      type: validated.type as import("@prisma/client").$Enums.AssetType,
      vendor: validated.vendor,
      model: validated.model,
      serial: validated.serial,
      location: validated.location,
      warrantyExpiry: validated.warrantyExpiry,
      cpuCores: validated.cpuCores,
      ramGb: validated.ramGb,
      storageGb: validated.storageGb,
    };

    await prisma.asset.update({
      where: { id },
      data: anyData,
    });

    revalidatePath("/inventory/assets");
    return { success: true };
  } catch (error) {
    console.error("Failed to update asset:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message, code: "VALIDATION_ERROR" };
    }
    return { success: false, error: "Failed to update asset", code: "SERVER_ERROR" };
  }
}


export async function deleteAsset(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.roles?.some(r => r === ROLES.ADMIN || r === ROLES.DCOPS)) {
    throw new Error("Unauthorized");
  }

  await prisma.asset.delete({ where: { id } });
  revalidatePath("/inventory/assets");
}

export async function fetchAssetDetails(id: string) {
  return await prisma.asset.findUnique({ where: { id } });
}

export async function fetchAssetDetailsWithLicenses(id: string) {
  const asset = await prisma.asset.findUnique({
    where: { id },
    include: { licenses: true },
  });

  if (!asset) return null;

  return {
    ...asset,
    warrantyExpiry: asset.warrantyExpiry?.toISOString() ?? null,
    licenses: asset.licenses.map((license) => ({
      ...license,
      expiryDate: license.expiryDate?.toISOString() ?? null,
      maintenanceExpiry: license.maintenanceExpiry?.toISOString() ?? null,
    })),
  };
}

export async function fetchAllAssets(page: number = 1, pageSize: number = 20) {
  const skip = (page - 1) * pageSize;
  const [assets, total] = await Promise.all([
    prisma.asset.findMany({
      orderBy: { name: "asc" },
      skip,
      take: pageSize,
    }),
    prisma.asset.count()
  ]);

  return { assets, total };
}
