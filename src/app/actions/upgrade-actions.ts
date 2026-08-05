// src/app/actions/upgrade-actions.ts
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { 
  AttachmentType, 
  RequestStatus, 
  RequestType, 
  VmStatus
} from "@prisma/client";
import { generateApprovals } from "./approval-actions";
import { ROLES, hasRole } from "@/lib/roles";
import { uploadBuffer } from "@/lib/services/minio.service";

interface Attachment {
  fileName: string;
  filePath: string;
  attachmentType: AttachmentType;
  uploadedBy: string;
}

/**
 * Returns VMs owned by the current requester that are ACTIVE and eligible
 * for an upgrade request (no pending upgrade already in flight).
 */
export async function getUpgradeableVms() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error("Unauthorized");

    const userId = session.user.id;
    const isAdmin = hasRole(session.user.roles, ROLES.ADMIN);

    // Get all upgrade requests that are not COMPLETED (PROVISIONED), REJECTED, or CLOSED
    const pendingUpgradeVmIds = await prisma.request.findMany({
      where: {
        requestType: RequestType.SYSTEM_UPGRADE,
        status: {
          notIn: [RequestStatus.PROVISIONED, RequestStatus.REJECTED, RequestStatus.CLOSED],
        },
      },
      select: { upgradeVmId: true },
    });

    const lockedIds = pendingUpgradeVmIds
      .map((r: { upgradeVmId: string | null }) => r.upgradeVmId)
      .filter(Boolean) as string[];

    const whereClause = isAdmin 
      ? { status: VmStatus.ACTIVE, id: { notIn: lockedIds } } 
      : { ownerId: userId, status: VmStatus.ACTIVE, id: { notIn: lockedIds } };

    const vms = await prisma.vmInstance.findMany({
      where: whereClause,
      include: {
        currentSpec: true,
        request: { select: { systemName: true } },
      },
      orderBy: { hostname: "asc" },
    });

    return vms;
  } catch (error) {
    console.error("Error in getUpgradeableVms:", error);
    throw error;
  }
}

/**
 * Creates or saves a system upgrade request.
 */
export async function createSystemUpgradeRequest(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error("Unauthorized");

    const userId = session.user.id;
    const isDeveloper = hasRole(session.user.roles, ROLES.DEVELOPER);
    const isRequester = hasRole(session.user.roles, ROLES.REQUESTER);
    const isAdmin = hasRole(session.user.roles, ROLES.ADMIN);

    if (!isDeveloper && !isRequester && !isAdmin) {
      throw new Error("Only developers, requesters, or admins can create upgrade requests");
    }

    let assignedRequesterId: string | null = null;
    if (isDeveloper) {
      assignedRequesterId = formData.get("requesterId")?.toString() || null;
      if (!assignedRequesterId) {
        throw new Error("Developers must assign a requester before saving draft");
      }

      const assignedUser = await prisma.user.findUnique({
        where: { id: assignedRequesterId },
        include: { roles: { include: { role: true } } }
      });

      if (!assignedUser || !assignedUser.roles.some((r: any) => r.role.name === ROLES.REQUESTER)) {
        throw new Error("Assigned user must have REQUESTER role");
      }

      formData.set("status", RequestStatus.DRAFT);
    }

    const upgradeVmId = formData.get("upgradeVmId")?.toString();
    if (!upgradeVmId) {
      throw new Error("Target VM is required for upgrade request");
    }

    // Validate VM exists and belongs to requester (or admin)
    const effectiveRequesterId = isDeveloper && assignedRequesterId ? assignedRequesterId : userId;
    const targetVm = await prisma.vmInstance.findUnique({
      where: { id: upgradeVmId },
      include: { owner: true, currentSpec: true }
    });

    if (!targetVm) {
      throw new Error("Target VM not found");
    }

    if (!isAdmin && targetVm.ownerId !== effectiveRequesterId) {
      throw new Error("You can only upgrade your own VMs");
    }

    if (targetVm.status !== VmStatus.ACTIVE) {
      throw new Error("Target VM must be ACTIVE to upgrade");
    }

    // Extract upgrade values
    const upgradeCpu = formData.get("upgradeCpu") ? parseInt(formData.get("upgradeCpu")!.toString()) : null;
    const upgradeRamGb = formData.get("upgradeRamGb") ? parseInt(formData.get("upgradeRamGb")!.toString()) : null;
    const upgradeStorageGb = formData.get("upgradeStorageGb") ? parseInt(formData.get("upgradeStorageGb")!.toString()) : null;
    const purpose = formData.get("purpose")?.toString() || "";

    if (!upgradeCpu && !upgradeRamGb && !upgradeStorageGb) {
      throw new Error("At least one resource upgrade (vCPU, RAM, or Storage) must be specified");
    }

    // Validate upgrades are higher than current allocation (prevent downgrade)
    const currentSpec = targetVm.currentSpec;
    if (currentSpec) {
      if (upgradeCpu !== null && upgradeCpu <= currentSpec.vcpu) {
        throw new Error(`Requested CPU (${upgradeCpu} Cores) must be greater than current allocation (${currentSpec.vcpu} Cores)`);
      }
      if (upgradeRamGb !== null && upgradeRamGb <= currentSpec.ramGb) {
        throw new Error(`Requested RAM (${upgradeRamGb} GB) must be greater than current allocation (${currentSpec.ramGb} GB)`);
      }
    }

    const securityFile = formData.get("securityReport") as File;
    const justificationFile = formData.get("justificationDoc") as File;
    const requestId = crypto.randomUUID();
    const attachments: Attachment[] = [];

    // Handle security report upload
    if (securityFile && securityFile.size > 0) {
      const buffer = Buffer.from(await securityFile.arrayBuffer());
      const uploadResult = await uploadBuffer(buffer, securityFile.name, `requests/${requestId}`);
      
      if (!uploadResult.success) {
        throw new Error(`Failed to upload security report: ${uploadResult.error}`);
      }
      
      attachments.push({
        fileName: securityFile.name,
        filePath: uploadResult.key || "",
        attachmentType: AttachmentType.SECURITY_REPORT,
        uploadedBy: userId,
      });
    }

    // Handle justification document upload
    if (justificationFile && justificationFile.size > 0) {
      const buffer = Buffer.from(await justificationFile.arrayBuffer());
      const uploadResult = await uploadBuffer(buffer, justificationFile.name, `requests/${requestId}`);
      
      if (!uploadResult.success) {
        throw new Error(`Failed to upload justification: ${uploadResult.error}`);
      }
      
      attachments.push({
        fileName: justificationFile.name,
        filePath: uploadResult.key || "",
        attachmentType: AttachmentType.JUSTIFICATION,
        uploadedBy: userId,
      });
    }

    const newCreatedRequest = await prisma.$transaction(async (tx: any) => {
      const created = await tx.request.create({
        data: {
          requestType: RequestType.SYSTEM_UPGRADE,
          status: (formData.get("status") as RequestStatus) || RequestStatus.DRAFT,
          systemName: `Upgrade of ${targetVm.hostname || targetVm.systemName || "VM"}`,
          purpose: purpose,
          environment: targetVm.environment || "PRODUCTION",

          requesterId: effectiveRequesterId,

          ...(isDeveloper && { 
            developerId: userId,
            developerName: session.user.name || "",
            developerDesignation: session.user.designation || "",
            developerOrganization: session.user.organization || "",
            developerContact: session.user.contact || "",
            developerEmail: session.user.email || "",
          }),

          // Set request details
          vcpu: upgradeCpu ?? currentSpec?.vcpu ?? 0,
          ramGb: upgradeRamGb ?? currentSpec?.ramGb ?? 0,
          storageGb: (currentSpec?.storageGb ?? 0) + (upgradeStorageGb ?? 0),
          serverType: targetVm.request?.serverType || "OTHER",
          osName: currentSpec?.osName || "Unknown",
          osVersion: currentSpec?.osVersion || "Unknown",
          subdomain: targetVm.subdomain || null,

          // Upgrade specific fields
          targetVmId: upgradeVmId,
          upgradeVmId: upgradeVmId,
          upgradeCpu: upgradeCpu,
          upgradeRamGb: upgradeRamGb,
          upgradeStorageGb: upgradeStorageGb,
          upgradeJustification: purpose,
        },
      });

      // Attachments
      if (attachments.length > 0) {
        await tx.attachment.createMany({
          data: attachments.map((att) => ({
            requestId: created.id,
            fileName: att.fileName,
            filePath: att.filePath,
            attachmentType: att.attachmentType,
            uploadedBy: att.uploadedBy,
          })),
        });
      }

      return created;
    }, { timeout: 15000 });

    // Generate approvals only for submitted requests (not drafts)
    if (newCreatedRequest.status === RequestStatus.PENDING_L1) {
      await generateApprovals(
        prisma,
        newCreatedRequest.id,
        "REQUEST",
        RequestType.SYSTEM_UPGRADE
      );
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "CREATE_UPGRADE_REQUEST",
        entityType: "REQUEST",
        entityId: newCreatedRequest.id,
        details: JSON.stringify({
          systemName: newCreatedRequest.systemName,
          status: newCreatedRequest.status,
          upgradeVmId,
          upgradeCpu,
          upgradeRamGb,
          upgradeStorageGb,
          isDeveloperCreated: isDeveloper,
        }),
      },
    });

    return newCreatedRequest;
  } catch (error) {
    console.error("Error creating upgrade request:", error);
    throw error;
  }
}
