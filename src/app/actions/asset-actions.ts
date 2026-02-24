// src/app/actions/asset-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { ROLES } from "@/lib/roles";


const optionalString = (value: unknown): string | undefined => {
  return value === "" || value == null ? undefined : String(value);
};

const optionalNumber = (value: unknown): number | undefined => {
  if (value === "" || value == null) return undefined;
  const num = Number(value);
  return isNaN(num) ? undefined : num;
};

const assetBaseSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.string().min(1, "Type is required"),
  vendor: z.string().optional().transform(optionalString),
  model: z.string().optional().transform(optionalString),
  serial: z.string().optional().transform(optionalString),
  location: z.string().optional().transform(optionalString),
  warrantyExpiry: z.string().optional().transform((val) => val ? new Date(val) : null),
  cpuCores: z.union([z.number(), z.string()]).optional().transform(optionalNumber),
  ramGb: z.union([z.number(), z.string()]).optional().transform(optionalNumber),
  storageGb: z.union([z.number(), z.string()]).optional().transform(optionalNumber),
});

export async function createAsset(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.roles?.some(r => r === ROLES.ADMIN || r === ROLES.DCOPS)) {
    throw new Error("Unauthorized");
  }

  const validated = assetBaseSchema.parse(Object.fromEntries(formData));
  
  await prisma.asset.create({
    data: {
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
    },
  });

  revalidatePath("/inventory/assets");
}

export async function updateAsset(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.roles?.some(r => r === ROLES.ADMIN || r === ROLES.DCOPS)) {
    throw new Error("Unauthorized");
  }

  const id = formData.get("id")?.toString();
  if (!id) throw new Error("Asset ID is required");

  const validated = assetBaseSchema.parse(Object.fromEntries(formData));
  
  await prisma.asset.update({
    where: { id },
    data: {
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
    },
  });

  revalidatePath("/inventory/assets");
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
