//src/app/lib/validation.ts
import prisma from "@/lib/prisma";import { getServerSession } from "next-auth";
import { authOptions } from "./authOptions";
import { isAdmin } from "./utils";

// utils/validation.ts
export async function validateVmAccess(vmId: string, userId: string, requireOwnership = true) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const vm = await prisma.vmInstance.findUnique({ 
    where: { id: vmId },
    select: { ownerId: true, id: true }
  });

  if (!vm) throw new Error("VM not found");

  if (requireOwnership && !isAdmin(session.user.roles) && vm.ownerId !== userId) {
    throw new Error("Unauthorized access");
  }

  return vm;
}