// src/actions/asset-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { ASSET_TYPES } from "@/types/inventory";

// Helper: safely convert empty string to undefined, and assert type
const optionalString = (value: unknown): string | undefined => {
  return value === "" || value == null ? undefined : String(value);
};

const optionalNumber = (value: unknown): number | undefined => {
  if (value === "" || value == null) return undefined;
  const num = Number(value);
  return isNaN(num) ? undefined : num;
};

const optionalBoolean = (value: unknown): boolean | undefined => {
  if (value === "" || value == null) return undefined;
  if (typeof value === "boolean") return value;
  return value === "true";
};

const assetBaseSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(ASSET_TYPES, { message: "Invalid asset type" }), // ✅ valid syntax

  vendor: z.string().optional().transform(optionalString),
  model: z.string().optional().transform(optionalString),
  serial: z.string().optional().transform(optionalString),
  location: z.string().optional().transform(optionalString),

  warrantyExpiry: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : null))
    .refine((date) => !date || !isNaN(date.getTime()), {
      message: "Invalid warranty expiry date",
    }),

  cpuCores: z
    .union([z.number(), z.string()])
    .optional()
    .transform(optionalNumber),
  ramGb: z.union([z.number(), z.string()]).optional().transform(optionalNumber),
  storageGb: z
    .union([z.number(), z.string()])
    .optional()
    .transform(optionalNumber),

  graphicsCardModel: z.string().optional().transform(optionalString),
  graphicsCardSpec: z.string().optional().transform(optionalString),

  interfaces: z
    .union([z.number(), z.string()])
    .optional()
    .transform(optionalNumber),
  throughputGbps: z
    .union([z.number(), z.string()])
    .optional()
    .transform(optionalNumber),

  vlanSupport: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform(optionalBoolean),

  capacityTb: z
    .union([z.number(), z.string()])
    .optional()
    .transform(optionalNumber),
});

const createAssetSchema = assetBaseSchema;
const updateAssetSchema = assetBaseSchema.extend({
  id: z.string().uuid("Invalid asset ID"),
});

// --- Actions ---

export async function createAsset(formData: FormData) {
  const validated = createAssetSchema.parse(Object.fromEntries(formData));
  await prisma.asset.create({
    data: {
      ...validated,
      warrantyExpiry: validated.warrantyExpiry,
      // Ensure all optional fields are properly typed for Prisma
      vendor: validated.vendor ?? undefined,
      model: validated.model ?? undefined,
      serial: validated.serial ?? undefined,
      location: validated.location ?? undefined,
      graphicsCardModel: validated.graphicsCardModel ?? undefined,
      graphicsCardSpec: validated.graphicsCardSpec ?? undefined,
    },
  });
  revalidatePath("/inventory/assets");
}

export async function updateAsset(formData: FormData) {
  const validated = updateAssetSchema.parse(Object.fromEntries(formData));
  const { id, ...data } = validated;
  await prisma.asset.update({
    where: { id },
    data: {
      ...data,
      warrantyExpiry: data.warrantyExpiry,
      vendor: data.vendor ?? undefined,
      model: data.model ?? undefined,
      serial: data.serial ?? undefined,
      location: data.location ?? undefined,
      graphicsCardModel: data.graphicsCardModel ?? undefined,
      graphicsCardSpec: data.graphicsCardSpec ?? undefined,
    },
  });
  revalidatePath("/inventory/assets");
}

export async function deleteAsset(id: string) {
  await prisma.asset.delete({ where: { id } });
  revalidatePath("/inventory/assets");
}

export async function fetchAssetDetails(id: string) {
  return await prisma.asset.findUnique({ where: { id } });
}

export async function fetchAllAssets() {
  return await prisma.asset.findMany({
    orderBy: { name: "asc" },
  });
}
