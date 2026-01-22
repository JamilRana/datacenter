"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";

// =============== VM Instance ===============
const vmSchema = z.object({
  id: z.string().optional(),
  requestId: z.string(),
  sequenceNumber: z.number(),
  hostname: z.string().optional(),
  ipAddress: z.string().optional(),
  vcpu: z.number().optional(),
  ramGb: z.number().optional(),
  storageGb: z.number().optional(),
  raid: z.enum(["RAID0", "RAID1", "RAID5", "RAID10"]).optional(),
  ownerId: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "SUSPENDED", "RETIRED"]),
});

export async function createVm(formData: FormData) {
  const validated = vmSchema.parse(Object.fromEntries(formData));
  await prisma.vmInstance.create({ data: validated });
  revalidatePath("/inventory");
}

export async function updateVm(formData: FormData) {
  const validated = vmSchema.parse(Object.fromEntries(formData));
  await prisma.vmInstance.update({
    where: { id: validated.id },
    data: validated,
  });
  revalidatePath("/inventory");
}

export async function deleteVm(id: string) {
  await prisma.vmInstance.delete({ where: { id } });
  revalidatePath("/inventory");
}

// =============== Physical Server ===============
const physicalServerSchema = z.object({
  id: z.string().optional(),
  vendor: z.string().optional(),
  model: z.string().optional(),
  serial: z.string().optional(),
  location: z.string().optional(),
  cpuCores: z.number().optional(),
  ramGb: z.number().optional(),
  storageGb: z.number().optional(),
});

export async function createPhysicalServer(formData: FormData) {
  const validated = physicalServerSchema.parse(Object.fromEntries(formData));
  await prisma.physicalServer.create({ data: validated });
  revalidatePath("/inventory");
}

export async function updatePhysicalServer(formData: FormData) {
  const validated = physicalServerSchema.parse(Object.fromEntries(formData));
  await prisma.physicalServer.update({
    where: { id: validated.id },
    data: validated,
  });
  revalidatePath("/inventory");
}

export async function deletePhysicalServer(id: string) {
  await prisma.physicalServer.delete({ where: { id } });
  revalidatePath("/inventory");
}
