"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { ROLES, hasRole } from "@/lib/roles";
import { revalidatePath } from "next/cache";

export async function getComplianceTags() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error("Unauthorized");

    const tags = await prisma.complianceTag.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            requests: true,
            vmInstances: true,
          },
        },
      },
    });

    return tags;
  } catch (error) {
    console.error("Error fetching compliance tags:", error);
    throw error;
  }
}

export async function createComplianceTag(name: string, description?: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");

    const isAdmin = hasRole(session.user.roles, ROLES.ADMIN);
    if (!isAdmin) throw new Error("Only Administrators can manage compliance tags");

    if (!name.trim()) throw new Error("Tag name cannot be empty");

    const tag = await prisma.complianceTag.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "CREATE_COMPLIANCE_TAG",
        entityType: "TAG",
        entityId: tag.id,
        details: JSON.stringify({ name: tag.name }),
      },
    });

    revalidatePath("/admin/tags");
    return { success: true, tag };
  } catch (error) {
    console.error("Error creating compliance tag:", error);
    throw error;
  }
}

export async function deleteComplianceTag(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");

    const isAdmin = hasRole(session.user.roles, ROLES.ADMIN);
    if (!isAdmin) throw new Error("Only Administrators can manage compliance tags");

    const tag = await prisma.complianceTag.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "DELETE_COMPLIANCE_TAG",
        entityType: "TAG",
        entityId: id,
        details: JSON.stringify({ name: tag.name }),
      },
    });

    revalidatePath("/admin/tags");
    return { success: true };
  } catch (error) {
    console.error("Error deleting compliance tag:", error);
    throw error;
  }
}

export async function assignTagsToRequest(requestId: string, tagIds: string[]) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");

    const isAdmin = hasRole(session.user.roles, ROLES.ADMIN);
    if (!isAdmin) throw new Error("Only Administrators can assign compliance tags");

    await prisma.$transaction(async (tx) => {
      // Delete existing assignments
      await tx.requestTag.deleteMany({
        where: { requestId },
      });

      // Create new assignments
      if (tagIds.length > 0) {
        await tx.requestTag.createMany({
          data: tagIds.map((tagId) => ({
            requestId,
            tagId,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "ASSIGN_REQUEST_TAGS",
          entityType: "REQUEST",
          entityId: requestId,
          details: JSON.stringify({ tagIds }),
        },
      });
    });

    revalidatePath(`/requests/${requestId}/view`);
    return { success: true };
  } catch (error) {
    console.error("Error assigning tags to request:", error);
    throw error;
  }
}

export async function assignTagsToVm(vmInstanceId: string, tagIds: string[]) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");

    const isAdmin = hasRole(session.user.roles, ROLES.ADMIN);
    if (!isAdmin) throw new Error("Only Administrators can assign compliance tags");

    await prisma.$transaction(async (tx) => {
      // Delete existing assignments
      await tx.vmTag.deleteMany({
        where: { vmInstanceId },
      });

      // Create new assignments
      if (tagIds.length > 0) {
        await tx.vmTag.createMany({
          data: tagIds.map((tagId) => ({
            vmInstanceId,
            tagId,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "ASSIGN_VM_TAGS",
          entityType: "VM",
          entityId: vmInstanceId,
          details: JSON.stringify({ tagIds }),
        },
      });
    });

    revalidatePath(`/inventory/vms/${vmInstanceId}`);
    return { success: true };
  } catch (error) {
    console.error("Error assigning tags to VM:", error);
    throw error;
  }
}
