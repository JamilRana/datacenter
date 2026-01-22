// src/actions/license-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";

const licenseSchema = z.object({
  name: z.string().min(1),
  vendor: z.string().min(1),
  expiryDate: z.string().optional(),
  maintenanceExpiry: z.string().optional(),
  notes: z.string().optional(),
});

const PAGE_SIZE = 10;

const updateLicenseSchema = licenseSchema.extend({
  id: z.string().uuid(),
});

export async function createLicense(formData: FormData) {
  const validated = licenseSchema.parse(Object.fromEntries(formData));
  await prisma.softwareLicense.create({
    data: {
      name: validated.name,
      vendor: validated.vendor,
      expiryDate: validated.expiryDate ? new Date(validated.expiryDate) : null,
      type: "SOFTWARE",
      maintenanceExpiry: validated.maintenanceExpiry
        ? new Date(validated.maintenanceExpiry)
        : null,
      notes: validated.notes,
    },
  });
  revalidatePath("/inventory/licenses");
}

export async function updateLicense(formData: FormData) {
  const validated = updateLicenseSchema.parse(Object.fromEntries(formData));
  await prisma.softwareLicense.update({
    where: { id: validated.id },
    data: {
      name: validated.name,
      vendor: validated.vendor,
      type: "SOFTWARE",
      expiryDate: validated.expiryDate ? new Date(validated.expiryDate) : null,
      maintenanceExpiry: validated.maintenanceExpiry
        ? new Date(validated.maintenanceExpiry)
        : null,
      notes: validated.notes,
    },
  });
  revalidatePath("/inventory/licenses");
}

export async function deleteLicense(id: string) {
  await prisma.softwareLicense.delete({
    where: { id },
  });
  revalidatePath("/inventory/licenses");
}

export async function fetchLicenseDetails(
  page: number = 1,
  search?: string,
  type?: string
) {
  const skip = (page - 1) * PAGE_SIZE;
  const where: any = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { vendor: { contains: search, mode: "insensitive" } },
    ];
  }

  if (type) {
    where.type = type;
  }

  const [licenses, total] = await Promise.all([
    prisma.softwareLicense.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        vendor: true,
        type: true,
        expiryDate: true,
        maintenanceExpiry: true,
        notes: true,
        createdAt: true,
      },
    }),
    prisma.softwareLicense.count({ where }),
  ]);

  return {
    licenses,
    totalPages: Math.ceil(total / PAGE_SIZE),
    currentPage: page,
    total,
  };
}

export async function fetchLicenseById(id: string) {
  const license = await prisma.softwareLicense.findUnique({
    where: { id },
  });
  return license;
}
