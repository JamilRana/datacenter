"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { uploadBuffer, deleteFile } from "@/lib/services/minio.service";
import {
  Prisma,
  ApprovalEntityType,
  AttachmentType,
  Environment,
  LicenseProvider,
  NetworkAccess,
  RequestStatus,
  RequestType,
  ServerType,
  SSLProvider,
  Protocol,
  K8sNodeRole
} from "@prisma/client";
import { unlink } from "fs/promises";
import path from "path";
import * as fs from "fs";
import { AdditionalDisk, FirewallPort } from "@/types/requests";
import { detailsRequest } from "@/types/requests";
import { ROLES, hasRole } from "@/lib/roles";
import { User } from "@/types/users";

import { Approval } from "@/types/approvals";
import { generateApprovals } from "./approval-actions";
import { NotificationService } from "@/lib/services/notification.service";

type RequestWithRelations = Prisma.RequestGetPayload<{
  include: {
    vmInstances: { select: { id: true, hostname: true, ipAddress: true, status: true } },
    approvals: {
      include: { approver: { select: { id: true, name: true } } }
    },
    targetVm: { select: { id: true, hostname: true, status: true } },
    vmSpecifications: { select: { subdomain: true } }
  }
}>

interface Attachment {
  fileName: string;
  filePath: string;
  attachmentType: AttachmentType;
  uploadedBy: string;
}

interface RequestFilters {
  status?: RequestStatus | "ALL" | string;
  type?: RequestType | "ALL" | string;
  search?: string;
}

export async function createRequest(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error("Unauthorized");

    const userId = session.user.id;
    const isDeveloper = hasRole(session.user.roles, ROLES.DEVELOPER);
    const isRequester = hasRole(session.user.roles, ROLES.REQUESTER);
    const isAdmin = hasRole(session.user.roles, ROLES.ADMIN);

    // ✅ VALIDATE ROLES
    if (!isDeveloper && !isRequester && !isAdmin) {
      throw new Error("Only developers, requesters, or admins can create requests");
    }

    // ✅ DEVELOPER WORKFLOW: Must assign requester + can ONLY create drafts
    let assignedRequesterId: string | null = null;
    if (isDeveloper) {
      assignedRequesterId = formData.get("requesterId")?.toString() || null;

      if (!assignedRequesterId) {
        throw new Error("Developers must assign a requester before saving draft");
      }

      // Verify assigned user has REQUESTER role
      const assignedUser = await prisma.user.findUnique({
        where: { id: assignedRequesterId },
        include: { roles: { include: { role: true } } }
      });

      if (!assignedUser || !assignedUser.roles.some((r: any) => r.role.name === ROLES.REQUESTER)) {
        throw new Error("Assigned user must have REQUESTER role");
      }

      // Force DRAFT status for developers
      formData.set("status", RequestStatus.DRAFT);
    }

    // ✅ EXTRACT DATA FROM FORM
    const rawAdditionalDisks = formData.get("additionalDisks")?.toString();
    const rawFirewallPorts = formData.get("firewallPorts")?.toString();
    const rawNetworkAccess = formData.get("networkAccess")?.toString();
    const rawVmSpecifications = formData.get("vmSpecifications")?.toString();
    const additionalDisks = rawAdditionalDisks ? JSON.parse(rawAdditionalDisks) : [];
    const firewallPorts = rawFirewallPorts ? JSON.parse(rawFirewallPorts) : [];
    const networkAccess = rawNetworkAccess ? JSON.parse(rawNetworkAccess) : [];
    const vmSpecifications = rawVmSpecifications ? JSON.parse(rawVmSpecifications) : [];
    const securityFile = formData.get("securityReport") as File;
    const justificationFile = formData.get("justificationDoc") as File;
    const requestId = crypto.randomUUID();
    const attachments: Attachment[] = [];

    const env = formData.get("environment")?.toString();
    if (!env || !["DEVELOPMENT", "STAGING", "PRODUCTION", "TESTING"].includes(env)) {
      throw new Error("Invalid environment");
    }

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
        throw new Error(`Failed to upload justification document: ${uploadResult.error}`);
      }

      attachments.push({
        fileName: justificationFile.name,
        filePath: uploadResult.key || "",
        attachmentType: AttachmentType.JUSTIFICATION,
        uploadedBy: userId,
      });
    }

    // ✅ CREATE REQUEST WITH CORRECT FIELDS (schema-aligned)
    const newCreatedRequest = await prisma.$transaction(async (tx: any) => {
      const rType = (formData.get("requestType") as RequestType) || RequestType.NEW_VM;
      const firstSpec = vmSpecifications[0];
      const isNewVmOnly = rType === RequestType.NEW_VM;
      const finalVcpu = isNewVmOnly && firstSpec ? (parseInt(firstSpec.vcpu) || 0) : parseInt(formData.get("vcpu")?.toString() || "0");
      const finalRam = isNewVmOnly && firstSpec ? (parseInt(firstSpec.ramGb) || 0) : parseInt(formData.get("ramGb")?.toString() || "0");
      const finalStorage = isNewVmOnly && firstSpec ? (parseInt(firstSpec.storageGb) || 0) : parseInt(formData.get("storageGb")?.toString() || "0");
      const finalOsVersion = isNewVmOnly && firstSpec ? firstSpec.osVersion : formData.get("osVersion")?.toString() || null;
      const finalSubdomain = isNewVmOnly && firstSpec ? firstSpec.subdomain : formData.get("subdomain")?.toString() || null;

      const created = await tx.request.create({
        data: {
          requestType: rType,
          status: (formData.get("status") as RequestStatus) || RequestStatus.DRAFT,
          quantity: parseInt(formData.get("quantity")?.toString() || "1", 10),
          systemName: formData.get("systemName")?.toString() || "",
          projectName: formData.get("projectName")?.toString() || null,
          purpose: formData.get("purpose")?.toString() || "",
          environment: env as Environment,

          // ✅ CORRECT requesterId BASED ON ROLE
          requesterId: isDeveloper && assignedRequesterId
            ? assignedRequesterId  // Developer assigns requester
            : userId,              // Requester creates for self

          // ✅ DEVELOPER RELATION (only set for developers)
          ...(isDeveloper && {
            developerId: userId,  // ← NOW VALID - schema has this field
            developerName: session.user.name || "",
            developerDesignation: session.user.designation || "",
            developerOrganization: session.user.organization || "",
            developerContact: session.user.contact || "",
            developerEmail: session.user.email || "",
          }),

          // VM Spec
          vcpu: finalVcpu,
          ramGb: finalRam,
          storageGb: finalStorage,
          serverType: (formData.get("serverType") as ServerType) || ServerType.OTHER,
          osName: isNewVmOnly ? null : (formData.get("osName")?.toString() || null),
          osVersion: finalOsVersion,
          osLicenseBy: formData.get("osLicenseBy") as LicenseProvider || null,
          subdomain: finalSubdomain,
          sslProvider: formData.get("sslProvider") as SSLProvider || SSLProvider.MIS,
          sslCostPaidBy: formData.get("sslCostPaidBy")?.toString() || null,
          requiredPublicIP: formData.get("requiredPublicIP") === "on",
          vpnRequired: formData.get("vpnRequired") === "on",
          vpnDetails: formData.get("vpnDetails")?.toString() || null,

          // Tech Stack
          frontendTech: isNewVmOnly ? null : (formData.get("frontendTech")?.toString() || null),
          backendTech: isNewVmOnly ? null : (formData.get("backendTech")?.toString() || null),
          dataBase: isNewVmOnly ? null : (formData.get("dataBase")?.toString() || null),
          serverArchitecture: isNewVmOnly ? null : (formData.get("serverArchitecture")?.toString() || null),
          additionalTechNotes: formData.get("additionalTechNotes")?.toString() || null,

          // Alternate Person (optional backup contact)
          alternativePersonName: formData.get("alternativePersonName")?.toString() || null,
          alternativePersonDesignation: formData.get("alternativePersonDesignation")?.toString() || null,
          alternativePersonOrganization: formData.get("alternativePersonOrganization")?.toString() || null,
          alternativePersonContact: formData.get("alternativePersonContact")?.toString() || null,
          alternativePersonEmail: formData.get("alternativePersonEmail")?.toString() || null,

          // Compliance
          vaReportSubmitted: formData.get("vaReportSubmitted") === "true",
          justificationSubmitted: formData.get("justificationSubmitted") === "true",
          renewalRequired: formData.get("renewalRequired") === "on",
          renewalPeriodMonths: formData.get("renewalPeriodMonths")
            ? parseInt(formData.get("renewalPeriodMonths") as string)
            : null,

          // Relations
          additionalDisks: {
            create: isNewVmOnly
              ? []
              : additionalDisks
                .filter((d: AdditionalDisk) => d.sizeGb && d.sizeGb > 0)
                .map((d: AdditionalDisk, index: number) => ({
                  sizeGb: d.sizeGb,
                  purpose: d.purpose || null,
                  sequence: index + 1,
                })),
          },
          firewallPorts: {
            create: isNewVmOnly
              ? []
              : firewallPorts
                .filter((p: FirewallPort) => p.port && p.port > 0)
                .map((p: FirewallPort) => ({
                  port: p.port,
                  protocol: p.protocol as Protocol,
                  purpose: p.purpose || "N/A",
                  source: p.source || null,
                })),
          },
          networkAccess: {
            create: isNewVmOnly
              ? []
              : networkAccess
                .filter((type: string) => type)
                .map((type: string) => ({
                  accessType: type as NetworkAccess,
                })),
          },
        },
      });

      // Loop over vmSpecifications and create VmSpecification records + nested connectivity/firewallRules/additionalStorage
      if (isNewVmOnly && vmSpecifications && vmSpecifications.length > 0) {
        for (const spec of vmSpecifications) {
          const createdSpec = await tx.vmSpecification.create({
            data: {
              requestId: created.id,
              stack: spec.stack || null,
              environment: spec.environment || Environment.PRODUCTION,
              vcpu: parseInt(spec.vcpu) || 0,
              ramGb: parseInt(spec.ramGb) || 0,
              storageGb: parseInt(spec.storageGb) || 0,
              gpuEnabled: !!spec.gpuEnabled,
              gpuVramGb: spec.gpuEnabled ? (parseInt(spec.gpuVramGb) || 0) : null,
              gpuStorageGb: spec.gpuEnabled ? (parseInt(spec.gpuStorageGb) || 0) : null,
              osVersion: spec.osVersion || null,
              subdomain: spec.subdomain || null,
              vpnDetails: spec.vpnDetails || null,
            }
          });

          // Create connectivity (NetworkAccessEntry)
          if (spec.connectivity && spec.connectivity.length > 0) {
            await tx.networkAccessEntry.createMany({
              data: spec.connectivity.map((type: string) => ({
                requestId: created.id,
                vmSpecificationId: createdSpec.id,
                accessType: type as NetworkAccess
              }))
            });
          }

          // Create firewall rules (FirewallPort)
          if (spec.firewallRules && spec.firewallRules.length > 0) {
            await tx.firewallPort.createMany({
              data: spec.firewallRules
                .filter((p: any) => p.port && p.port > 0)
                .map((p: any) => ({
                  requestId: created.id,
                  vmSpecificationId: createdSpec.id,
                  port: parseInt(p.port),
                  protocol: p.protocol as Protocol,
                  purpose: p.purpose || "N/A",
                  source: p.source || null,
                }))
            });
          }

          // Create additional storage (AdditionalDisk)
          if (spec.additionalStorage && spec.additionalStorage.length > 0) {
            await tx.additionalDisk.createMany({
              data: spec.additionalStorage
                .filter((d: any) => d.sizeGb && d.sizeGb > 0)
                .map((d: any, index: number) => ({
                  requestId: created.id,
                  vmSpecificationId: createdSpec.id,
                  sizeGb: parseInt(d.sizeGb),
                  purpose: d.purpose || null,
                  sequence: index + 1
                }))
            });
          }
        }
      }

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

    // ✅ GENERATE APPROVALS ONLY FOR SUBMITTED REQUESTS (not drafts)
    if (newCreatedRequest.status === RequestStatus.PENDING_L1) {
      await generateApprovals(
        prisma,
        newCreatedRequest.id,
        "REQUEST",
        newCreatedRequest.requestType
      );
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "CREATE_REQUEST",
        entityType: "REQUEST",
        entityId: newCreatedRequest.id,
        details: JSON.stringify({
          systemName: newCreatedRequest.systemName,
          status: newCreatedRequest.status,
          isDeveloperCreated: isDeveloper,
          ...(isDeveloper && { assignedRequesterId }),
        }),
      },
    });

    // Notify assigned requester if created by developer
    if (isDeveloper && assignedRequesterId) {
      await NotificationService.notifyRequester(
        assignedRequesterId,
        newCreatedRequest.systemName,
        "ASSIGNED_BY_DEV",
        newCreatedRequest.id,
        `Developer "${session.user.name}" created a request draft for "${newCreatedRequest.systemName}" and assigned it to you.`
      );
    }

    return newCreatedRequest;
  } catch (error) {
    console.error("Error creating request:", error);
    throw error;
  }
}

export async function editRequest(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error("Unauthorized");

    const userId = session.user.id;
    const isDeveloper = hasRole(session.user.roles, ROLES.DEVELOPER);
    const isRequester = hasRole(session.user.roles, ROLES.REQUESTER);
    const isAdmin = hasRole(session.user.roles, ROLES.ADMIN);

    if (!isDeveloper && !isRequester && !isAdmin) {
      throw new Error("Only developers, requesters, or admins can edit requests");
    }

    const requestId = formData.get("requestId")?.toString();
    if (!requestId) {
      throw new Error("Request ID is required");
    }

    // Parse dynamic fields
    const rawAdditionalDisks = formData.get("additionalDisks")?.toString();
    const rawFirewallPorts = formData.get("firewallPorts")?.toString();
    const rawNetworkAccess = formData.get("networkAccess")?.toString();
    const rawVmSpecifications = formData.get("vmSpecifications")?.toString();
    const additionalDisks = rawAdditionalDisks ? JSON.parse(rawAdditionalDisks) : [];
    const firewallPorts = rawFirewallPorts ? JSON.parse(rawFirewallPorts) : [];
    const networkAccess = rawNetworkAccess ? JSON.parse(rawNetworkAccess) : [];
    const vmSpecifications = rawVmSpecifications ? JSON.parse(rawVmSpecifications) : [];
    const securityFile = formData.get("securityReport") as File;
    const justificationFile = formData.get("justificationDoc") as File;
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
        throw new Error(`Failed to upload justification document: ${uploadResult.error}`);
      }

      attachments.push({
        fileName: justificationFile.name,
        filePath: uploadResult.key || "",
        attachmentType: AttachmentType.JUSTIFICATION,
        uploadedBy: userId,
      });
    }

    const updatedRequest = await prisma.$transaction(async (tx: any) => {
      // Fetch existing request with relations
      const original = await tx.request.findUnique({
        where: { id: requestId },
        include: {
          requester: true,
          developer: true
        }
      });

      if (!original) throw new Error("Request not found");

      // ✅ PERMISSION CHECK: Only requester, developer (who created draft), or admin can edit
      const isAssignedRequester = original.requesterId === userId;
      const isOriginalDeveloper = original.developerId === userId;

      if (!isAssignedRequester && !isOriginalDeveloper && !isAdmin) {
        throw new Error("You can only edit requests assigned to you or created by you");
      }

      // ✅ STATUS CHECK: Only drafts or rejected requests can be edited
      if (original.status !== RequestStatus.DRAFT && original.status !== RequestStatus.REJECTED) {
        throw new Error(`Cannot edit request in status: ${original.status}. Only DRAFT or REJECTED requests can be edited.`);
      }

      // ✅ DEVELOPER RESTRICTION: Developers can ONLY edit their own drafts
      if (isDeveloper && !isOriginalDeveloper) {
        throw new Error("Developers can only edit drafts they created");
      }

      // Clean up existing related records
      await tx.vmSpecification.deleteMany({ where: { requestId } });
      await tx.additionalDisk.deleteMany({ where: { requestId } });
      await tx.firewallPort.deleteMany({ where: { requestId } });
      await tx.networkAccessEntry.deleteMany({ where: { requestId } });

      // Handle removed attachments
      const rawRemovedAttachments = formData.get("removedAttachments")?.toString();
      console.log("Raw removed attachments:", rawRemovedAttachments);
      if (rawRemovedAttachments) {
        const removedIds = JSON.parse(rawRemovedAttachments) as string[];
        console.log("Removed IDs:", removedIds);
        if (removedIds.length > 0) {
          // Fetch attachments to get file paths before deleting
          const attachmentsToDelete = await tx.attachment.findMany({
            where: { id: { in: removedIds } },
            select: { filePath: true }
          });

          // Delete physical files
          for (const att of attachmentsToDelete) {
            if (att.filePath) {
              // Handle various path formats: "/uploads/...", "uploads/...", or MinIO keys
              const normalizedPath = att.filePath.replace(/^\/uploads\//, "uploads/");

              if (normalizedPath.startsWith("uploads/")) {
                // Local file - delete from filesystem
                const localPath = normalizedPath.replace("uploads/", "");
                const fullPath = path.join(process.cwd(), "uploads", localPath);
                try {
                  if (fs.existsSync(fullPath)) {
                    await unlink(fullPath);
                    console.log("Deleted local file:", fullPath);
                  }
                } catch (err) {
                  console.error("Failed to delete local file:", fullPath, err);
                }
              } else {
                // MinIO file - delete from MinIO
                try {
                  await deleteFile(normalizedPath);
                  console.log("Deleted MinIO file:", normalizedPath);
                } catch (err) {
                  console.error("Failed to delete MinIO file:", normalizedPath, err);
                }
              }
            }
          }

          // Delete from database
          await tx.attachment.deleteMany({
            where: {
              id: { in: removedIds },
              requestId
            }
          });
        }
      }

      const rType = (formData.get("requestType") as RequestType) || RequestType.NEW_VM;
      const firstSpec = vmSpecifications[0];
      const isNewVmOnly = rType === RequestType.NEW_VM;
      const finalVcpu = isNewVmOnly && firstSpec ? (parseInt(firstSpec.vcpu) || 0) : parseInt(formData.get("vcpu")?.toString() || "0");
      const finalRam = isNewVmOnly && firstSpec ? (parseInt(firstSpec.ramGb) || 0) : parseInt(formData.get("ramGb")?.toString() || "0");
      const finalStorage = isNewVmOnly && firstSpec ? (parseInt(firstSpec.storageGb) || 0) : parseInt(formData.get("storageGb")?.toString() || "0");
      const finalOsVersion = isNewVmOnly && firstSpec ? firstSpec.osVersion : formData.get("osVersion")?.toString() || null;
      const finalSubdomain = isNewVmOnly && firstSpec ? firstSpec.subdomain : formData.get("subdomain")?.toString() || null;

      // ✅ CRITICAL FIX: DO NOT include requesterId/developerId in update
      // Prisma automatically preserves existing relation values
      // Only include fields that can actually change during edit
      const updateData = {
        requestType: rType,
        status: (formData.get("status") as RequestStatus) || RequestStatus.DRAFT,
        quantity: parseInt(formData.get("quantity")?.toString() || "1", 10),
        systemName: formData.get("systemName")?.toString() || "",
        projectName: formData.get("projectName")?.toString() || null,
        purpose: formData.get("purpose")?.toString() || "",
        environment: formData.get("environment") as Environment,

        // VM Spec (only editable fields)
        vcpu: finalVcpu,
        ramGb: finalRam,
        storageGb: finalStorage,
        serverType: formData.get("serverType") as ServerType || ServerType.OTHER,
        osName: isNewVmOnly ? null : (formData.get("osName")?.toString() || null),
        osVersion: finalOsVersion,
        osLicenseBy: formData.get("osLicenseBy") as LicenseProvider || null,
        subdomain: finalSubdomain,
        sslProvider: formData.get("sslProvider") as SSLProvider || SSLProvider.MIS,
        sslCostPaidBy: formData.get("sslCostPaidBy")?.toString() || null,
        requiredPublicIP: formData.get("requiredPublicIP") === "on",
        vpnRequired: formData.get("vpnRequired") === "on",
        vpnDetails: formData.get("vpnDetails")?.toString() || null,

        // Tech Stack
        frontendTech: isNewVmOnly ? null : (formData.get("frontendTech")?.toString() || null),
        backendTech: isNewVmOnly ? null : (formData.get("backendTech")?.toString() || null),
        dataBase: isNewVmOnly ? null : (formData.get("dataBase")?.toString() || null),
        serverArchitecture: isNewVmOnly ? null : (formData.get("serverArchitecture")?.toString() || null),
        additionalTechNotes: formData.get("additionalTechNotes")?.toString() || null,

        // ✅ ALTERNATE PERSON (editable backup contact)
        alternativePersonName: formData.get("alternativePersonName")?.toString() || null,
        alternativePersonDesignation: formData.get("alternativePersonDesignation")?.toString() || null,
        alternativePersonOrganization: formData.get("alternativePersonOrganization")?.toString() || null,
        alternativePersonContact: formData.get("alternativePersonContact")?.toString() || null,
        alternativePersonEmail: formData.get("alternativePersonEmail")?.toString() || null,

        // Relations (recreate)
        additionalDisks: {
          create: isNewVmOnly
            ? []
            : additionalDisks
              .filter((d: AdditionalDisk) => d.sizeGb && d.sizeGb > 0)
              .map((d: AdditionalDisk, index: number) => ({
                sizeGb: d.sizeGb,
                purpose: d.purpose || null,
                sequence: index + 1,
              })),
        },
        firewallPorts: {
          create: isNewVmOnly
            ? []
            : firewallPorts
              .filter((p: FirewallPort) => p.port && p.port > 0)
              .map((p: FirewallPort) => ({
                port: p.port,
                protocol: p.protocol as Protocol,
                purpose: p.purpose || "N/A",
                source: p.source || null,
              })),
        },
        networkAccess: {
          create: isNewVmOnly
            ? []
            : networkAccess
              .filter((type: string) => type)
              .map((type: string) => ({
                accessType: type as NetworkAccess,
              })),
        },

        // Compliance
        vaReportSubmitted: formData.get("vaReportSubmitted") === "true",
        justificationSubmitted: formData.get("justificationSubmitted") === "true",
        renewalRequired: formData.get("renewalRequired") === "on",
        renewalPeriodMonths: formData.get("renewalPeriodMonths")
          ? parseInt(formData.get("renewalPeriodMonths") as string)
          : null,
      };

      const updated = await tx.request.update({
        where: { id: requestId },
        data: updateData,
      });

      // Recreate vmSpecifications
      if (rType === RequestType.NEW_VM && vmSpecifications && vmSpecifications.length > 0) {
        for (const spec of vmSpecifications) {
          const createdSpec = await tx.vmSpecification.create({
            data: {
              requestId: updated.id,
              stack: spec.stack || null,
              environment: spec.environment || Environment.PRODUCTION,
              vcpu: parseInt(spec.vcpu) || 0,
              ramGb: parseInt(spec.ramGb) || 0,
              storageGb: parseInt(spec.storageGb) || 0,
              gpuEnabled: !!spec.gpuEnabled,
              gpuVramGb: spec.gpuEnabled ? (parseInt(spec.gpuVramGb) || 0) : null,
              gpuStorageGb: spec.gpuEnabled ? (parseInt(spec.gpuStorageGb) || 0) : null,
              osVersion: spec.osVersion || null,
              subdomain: spec.subdomain || null,
              vpnDetails: spec.vpnDetails || null,
            }
          });

          // Create connectivity (NetworkAccessEntry)
          if (spec.connectivity && spec.connectivity.length > 0) {
            await tx.networkAccessEntry.createMany({
              data: spec.connectivity.map((type: string) => ({
                requestId: updated.id,
                vmSpecificationId: createdSpec.id,
                accessType: type as NetworkAccess
              }))
            });
          }

          // Create firewall rules (FirewallPort)
          if (spec.firewallRules && spec.firewallRules.length > 0) {
            await tx.firewallPort.createMany({
              data: spec.firewallRules
                .filter((p: any) => p.port && p.port > 0)
                .map((p: any) => ({
                  requestId: updated.id,
                  vmSpecificationId: createdSpec.id,
                  port: parseInt(p.port),
                  protocol: p.protocol as Protocol,
                  purpose: p.purpose || "N/A",
                  source: p.source || null,
                }))
            });
          }

          // Create additional storage (AdditionalDisk)
          if (spec.additionalStorage && spec.additionalStorage.length > 0) {
            await tx.additionalDisk.createMany({
              data: spec.additionalStorage
                .filter((d: any) => d.sizeGb && d.sizeGb > 0)
                .map((d: any, index: number) => ({
                  requestId: updated.id,
                  vmSpecificationId: createdSpec.id,
                  sizeGb: parseInt(d.sizeGb),
                  purpose: d.purpose || null,
                  sequence: index + 1
                }))
            });
          }
        }
      }

      // Also map to k8sRequestNodeGroup if requestType is K8S_NAMESPACE
      if (updated.requestType === RequestType.K8S_NAMESPACE) {
        // Delete old K8s Node Groups
        await tx.k8sRequestNodeGroup.deleteMany({ where: { requestId: updated.id } });

        const rawK8sNodeGroups = formData.get("k8sNodeGroups")?.toString();
        const k8sNodeGroupsInput = rawK8sNodeGroups ? JSON.parse(rawK8sNodeGroups) : [];
        if (k8sNodeGroupsInput && k8sNodeGroupsInput.length > 0) {
          await tx.k8sRequestNodeGroup.createMany({
            data: k8sNodeGroupsInput.map((g: any) => ({
              requestId: updated.id,
              role: g.role as K8sNodeRole,
              nodeCount: g.nodeCount,
              vcpu: g.vcpu,
              ramGb: g.ramGb,
              storageGb: g.storageGb
            }))
          });
        }
      }

      // Attachments
      if (attachments.length > 0) {
        await tx.attachment.createMany({
          data: attachments.map((att) => ({
            requestId: updated.id,
            fileName: att.fileName,
            filePath: att.filePath,
            attachmentType: att.attachmentType,
            uploadedBy: userId,
          })),
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: "EDIT_REQUEST",
          entityType: "REQUEST",
          entityId: requestId,
          details: JSON.stringify({
            systemName: updated.systemName,
            status: updated.status,
            previousStatus: original.status,
            editedBy: session.user.name,
            isDeveloperEdit: isDeveloper,
          }),
        },
      });

      return updated;
    }, { timeout: 15000 });

    // ✅ Generate approvals ONLY if status changed to PENDING_L1
    if (updatedRequest.status === RequestStatus.PENDING_L1) {
      // ✅ DELETE ALL PREVIOUS APPROVALS (not just pending) to prevent duplicate levels
      await prisma.approval.deleteMany({
        where: {
          requestId: updatedRequest.id,
          entityType: ApprovalEntityType.REQUEST
        },
      });

      await generateApprovals(
        prisma,
        requestId,
        "REQUEST",
        updatedRequest.requestType
      );
    }

    revalidatePath(`/requests/${requestId}`);
    return updatedRequest;
  } catch (error) {
    console.error("Error editing request:", error);
    throw error;
  }
}

export async function submitRequest(requestId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      status: true,
      environment: true,
      vaReportSubmitted: true,
      requesterId: true,
      systemName: true,
      purpose: true,
      requestType: true,
      developerId: true, // Track if developer-created
    },
  });

  if (!request) throw new Error("Request not found");

  // ✅ PERMISSION CHECK: Only requester OR developer (who created draft) can submit
  const isAssignedRequester = request.requesterId === session.user.id;
  const isOriginalDeveloper = request.developerId === session.user.id;

  if (!isAssignedRequester && !isOriginalDeveloper) {
    throw new Error("Only the assigned requester or original developer can submit this request");
  }

  const allowedStatuses: RequestStatus[] = [RequestStatus.DRAFT, RequestStatus.REJECTED];
  if (!allowedStatuses.includes(request.status)) {
    throw new Error(`Cannot submit request in status: ${request.status}. Only DRAFT or REJECTED requests can be submitted.`);
  }

  // Backend submission validation
  if (!request.systemName?.trim()) {
    throw new Error("System Name is required before submitting");
  }
  if (!request.purpose?.trim()) {
    throw new Error("System Purpose/Justification is required before submitting");
  }

  if (request.requestType === RequestType.NEW_VM) {
    const specs = await prisma.vmSpecification.findMany({
      where: { requestId },
      include: { connectivity: true }
    });
    if (specs.length === 0) {
      throw new Error("Please add at least one VM specification before submitting");
    }
    for (let i = 0; i < specs.length; i++) {
      const spec = specs[i];
      if (!spec.environment) {
        throw new Error(`Environment is required for VM Specification ${i + 1}`);
      }
      if (!spec.vcpu || spec.vcpu <= 0) {
        throw new Error(`vCPU Cores must be a positive number for VM Specification ${i + 1}`);
      }
      if (!spec.ramGb || spec.ramGb <= 0) {
        throw new Error(`Memory (RAM) must be a positive number for VM Specification ${i + 1}`);
      }
      if (!spec.storageGb || spec.storageGb <= 0) {
        throw new Error(`Primary Storage must be a positive number for VM Specification ${i + 1}`);
      }
      const hasVpn = spec.connectivity.some((c: any) => c.accessType === "VPN");
      if (hasVpn && (!spec.vpnDetails || !spec.vpnDetails.trim())) {
        throw new Error(`VPN Details description is required when VPN connectivity is selected in VM Specification ${i + 1}`);
      }
    }
  } else if (request.requestType === RequestType.K8S_NAMESPACE) {
    const groups = await prisma.k8sRequestNodeGroup.findMany({
      where: { requestId }
    });
    if (groups.length === 0) {
      throw new Error("Please add at least one node group specification before submitting");
    }
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      if (group.nodeCount <= 0 || group.vcpu <= 0 || group.ramGb <= 0 || group.storageGb <= 0) {
        throw new Error(`Invalid values in node group ${i + 1}`);
      }
    }
  }

  const updated = await prisma.$transaction(async (tx: any) => {
    // ✅ DELETE ALL PREVIOUS APPROVALS (not just pending) to prevent duplicate levels
    await tx.approval.deleteMany({
      where: {
        requestId: requestId,
        entityType: ApprovalEntityType.REQUEST
      },
    });

    const updatedReq = await tx.request.update({
      where: { id: requestId },
      data: {
        status: RequestStatus.PENDING_L1,
        submittedAt: new Date(),
      },
    });

    // ✅ GENERATE NEW APPROVALS
    await generateApprovals(
      tx,
      requestId,
      "REQUEST",
      request.requestType as RequestType,
      true
    );

    // ✅ AUDIT LOG WITH CORRECT ACTION NAME
    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        action: request.status === RequestStatus.DRAFT
          ? "SUBMIT_REQUEST"
          : "RESUBMIT_REQUEST",
        entityType: "REQUEST",
        entityId: requestId,
        details: JSON.stringify({
          previousStatus: request.status,
          newStatus: RequestStatus.PENDING_L1,
          submittedBy: session.user.name,
          isDeveloperSubmission: isOriginalDeveloper,
        }),
      },
    });

    return updatedReq;
  }, { timeout: 15000 });

  // Post-commit: Notify Level 1 approvers
  if (updated && updated.status === RequestStatus.PENDING_L1) {
    await NotificationService.notifyApprovers(
      requestId,
      updated.systemName,
      1,
      "REQUEST"
    );
  }

  revalidatePath(`/requests/${requestId}`);

  return updated;
}

export async function getApprovers(): Promise<User[]> {
  const approvers = await prisma.user.findMany({
    where: {
      isActive: true,
      roles: {
        some: {
          role: { name: { in: ["APPROVER_L1", "APPROVER_L2", "APPROVER_L3"] } }
        }
      }
    },
    include: { roles: { include: { role: true } } }
  });

  // ✅ CRITICAL: Transform to match User.roles: string[]
  return approvers.map((user: any) => ({
    ...user,
    roles: user.roles.map((ur: any) => ur.role.name) // Extract role names
  }));
}


export async function getDetailedRequest(requestId: string): Promise<detailsRequest | null> {
  if (!requestId || requestId === "undefined") {
    console.error("getDetailedRequest received an invalid ID");
    return null;
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");
  const isAdmin = session.user.roles.includes(ROLES.ADMIN);
  const isApprover = session.user.roles.some((r: any) => r.startsWith("APPROVER_"));
  const isDcopsUser = session.user.roles.includes(ROLES.DCOPS);

  // ✅ INCLUDE ALL REQUIRED FIELDS & RELATIONS
  const request = await prisma.request.findUnique({
    where: {
      id: requestId,
      ...(isAdmin || isApprover || isDcopsUser
        ? {}
        : {
          OR: [
            { requesterId: session.user.id },
            { developerId: session.user.id },
          ]
        }
      )
    },
    include: {
      requester: {
        select: {
          id: true,
          name: true,
          email: true,
          designation: true,
          organization: true,
          contact: true,
        }
      },
      vmInstances: {
        include: {
          currentSpec: {
            include: {
              additionalDisks: true,
              firewallPorts: true,
              networkAccess: true,
            }
          },
          vpnAssignmentsNew: {
            include: { vpnUser: true }
          },
          horizonAssignmentsNew: {
            include: { horizonUser: true }
          }
        },
        orderBy: { sequenceNumber: "asc" }
      },
      approvals: {
        where: { entityType: ApprovalEntityType.REQUEST },
        include: {
          approver: {
            select: {
              id: true,
              name: true,
              email: true,
              designation: true
            }
          }
        },
        orderBy: { createdAt: "asc" },
      },
      targetVm: {
        include: {
          currentSpec: true,
        },
      },
      additionalDisks: true,
      firewallPorts: true,
      networkAccess: true,
      attachments: {
        include: {
          user: { select: { id: true, name: true, email: true } }
        },
        orderBy: { createdAt: "desc" }
      },
      developer: {
        select: { id: true, name: true, email: true, designation: true, organization: true, contact: true }
      },
      tags: {
        include: { tag: true }
      },
      k8sRequestNodeGroups: true,
      k8sClusters: {
        include: {
          namespace: true,
          nodeGroups: {
            include: { nodes: true }
          }
        }
      },
      vmSpecifications: {
        include: {
          connectivity: true,
          firewallRules: true,
          additionalStorage: true
        }
      },
      requestResources: {
        include: {
          vm: {
            include: {
              vpnAssignmentsNew: { include: { vpnUser: true } },
              horizonAssignmentsNew: { include: { horizonUser: true } }
            }
          },
          namespace: {
            include: {
              vpnAssignments: { include: { vpnUser: true } },
              horizonAssignments: { include: { horizonUser: true } }
            }
          }
        }
      }
    },
  });

  if (!request) throw new Error("Request not found");

  // Map vmSpecifications with fallback for legacy requests
  let vmSpecsTransformed: any[] = [];
  if (request.vmSpecifications && request.vmSpecifications.length > 0) {
    vmSpecsTransformed = request.vmSpecifications.map((spec: any) => ({
      id: spec.id,
      requestId: spec.requestId,
      stack: spec.stack || null,
      environment: spec.environment,
      vcpu: spec.vcpu,
      ramGb: spec.ramGb,
      storageGb: spec.storageGb,
      gpuEnabled: spec.gpuEnabled,
      gpuVramGb: spec.gpuVramGb,
      gpuStorageGb: spec.gpuStorageGb,
      osVersion: spec.osVersion,
      subdomain: spec.subdomain,
      connectivity: (spec.connectivity || []).map((c: any) => ({
        accessType: c.accessType
      })),
      firewallRules: (spec.firewallRules || []).map((f: any) => ({
        port: f.port,
        protocol: f.protocol,
        purpose: f.purpose,
        source: f.source || undefined
      })),
      additionalStorage: (spec.additionalStorage || []).map((d: any) => ({
        sizeGb: d.sizeGb,
        purpose: d.purpose || undefined,
        sequence: d.sequence
      }))
    }));
  } else if (request.requestType === RequestType.NEW_VM) {
    vmSpecsTransformed = [
      {
        id: "legacy-spec",
        requestId: request.id,
        stack: [
          request.frontendTech ? `Frontend: ${request.frontendTech}` : '',
          request.backendTech ? `Backend: ${request.backendTech}` : '',
          request.dataBase ? `Database: ${request.dataBase}` : '',
          request.serverArchitecture ? `Architecture: ${request.serverArchitecture}` : ''
        ].filter(Boolean).join(", ") || null,
        environment: request.environment,
        vcpu: request.vcpu || 0,
        ramGb: request.ramGb || 0,
        storageGb: request.storageGb || 0,
        gpuEnabled: false,
        gpuVramGb: null,
        gpuStorageGb: null,
        osVersion: [request.osName, request.osVersion].filter(Boolean).join(" ") || null,
        subdomain: request.subdomain || "",
        connectivity: (request.networkAccess || []).map((c: any) => ({
          accessType: c.accessType
        })),
        firewallRules: (request.firewallPorts || []).map((f: any) => ({
          port: f.port,
          protocol: f.protocol,
          purpose: f.purpose,
          source: f.source || undefined
        })),
        additionalStorage: (request.additionalDisks || []).map((d: any) => ({
          sizeGb: d.sizeGb,
          purpose: d.purpose || undefined,
          sequence: d.sequence
        }))
      }
    ];
  }

  // ✅ CRITICAL FIX: Transform flat schema fields → Person interface
  const transformed: detailsRequest = {
    id: request.id,
    requestType: request.requestType,
    status: request.status,
    quantity: request.quantity,
    requestId: request.requestId || null,
    projectName: request.projectName || null,
    systemName: request.systemName,
    purpose: request.purpose,
    environment: request.environment,

    requesterId: request.requesterId,
    // ✅ Transform User relation → Person interface
    requester: request.requester
      ? {
        name: request.requester.name,
        designation: request.requester.designation || "",
        organization: request.requester.organization || "",
        contact: request.requester.contact || "",
        email: request.requester.email,
        address: request.requester.organization || null, // Map org → address
      }
      : {
        name: "Unknown",
        designation: "",
        organization: "",
        contact: "",
        email: "",
        address: null,
      },

    // ✅ Construct alternativePerson from FLAT FIELDS (schema has no relation)
    alternativePerson: request.alternativePersonName
      ? {
        name: request.alternativePersonName,
        designation: request.alternativePersonDesignation || "",
        organization: request.alternativePersonOrganization || "",
        contact: request.alternativePersonContact || "",
        email: request.alternativePersonEmail || "",
        address: null,
      }
      : null,

    // ✅ Construct developer from RELATION (preferred) or FLAT FIELDS (fallback)
    developer: request.developer
      ? {
        name: request.developer.name,
        designation: request.developer.designation || "",
        organization: request.developer.organization || "",
        contact: request.developer.contact || "",
        email: request.developer.email,
      }
      : request.developerName
        ? {
          name: request.developerName,
          designation: request.developerDesignation || "",
          organization: request.developerOrganization || "",
          contact: request.developerContact || "",
          email: request.developerEmail || "",
        }
        : null,

    developerId: request.developerId || null,

    // VM Spec
    serverType: request.serverType as ServerType,
    vcpu: request.vcpu || null,
    ramGb: request.ramGb || null,
    osName: request.osName || null,
    osVersion: request.osVersion || null,
    osLicenseBy: request.osLicenseBy as LicenseProvider || null,
    storageGb: request.storageGb || null,
    subdomain: request.subdomain || null,
    sslProvider: request.sslProvider || null,
    sslCostPaidBy: request.sslCostPaidBy || null,
    retentionPeriod: request.retentionPeriod || null,
    requiredPublicIP: request.requiredPublicIP,
    vpnRequired: request.vpnRequired,
    vpnDetails: request.vpnDetails || null,

    // Compliance
    vaReportSubmitted: request.vaReportSubmitted,
    justificationSubmitted: request.justificationSubmitted,
    renewalRequired: request.renewalRequired,
    renewalPeriodMonths: request.renewalPeriodMonths || null,

    // Timestamps
    createdAt: request.createdAt,
    submittedAt: request.submittedAt || null,
    updatedAt: request.updatedAt,
    provisionedAt: request.provisionedAt || null,

    // Tech Stack
    frontendTech: request.frontendTech || null,
    backendTech: request.backendTech || null,
    serverArchitecture: request.serverArchitecture || null,
    dataBase: request.dataBase || null,
    additionalTechNotes: request.additionalTechNotes || null,

    // Relations
    vmInstances: request.vmInstances || [],
    approvals: (request.approvals || []).map((a: Approval) => ({
      id: a.id,
      entityType: a.entityType,
      requestId: a.requestId,
      customizationRequestId: a.customizationRequestId,

      // ✅ Ensure level is treated as a number
      level: Number(a.level),

      approverId: a.approverId,
      decision: a.decision,
      comments: a.comments || null,
      decidedAt: a.decidedAt || null,
      createdAt: a.createdAt,
      approver: a.approver
        ? {
          id: a.approver.id,
          name: a.approver.name,
          email: a.approver.email,
          designation: a.approver.designation || "",
        }
        : { id: "", name: "Unknown", email: "", designation: "" },
    })),
    customizations: [], // Empty array (not included in query - add include if needed)
    additionalDisks: (request.additionalDisks || []).map((d: any) => ({
      sizeGb: d.sizeGb,
      purpose: d.purpose || undefined,
      sequence: d.sequence,
    })),
    firewallPorts: (request.firewallPorts || []).map((p: any) => ({
      port: p.port,
      protocol: p.protocol,
      purpose: p.purpose,
      source: p.source || undefined,
    })),
    networkAccess: (request.networkAccess || []).map((n: any) => ({
      accessType: n.accessType,
    })),
    attachments: (request.attachments || []).map((a: any) => ({
      id: a.id,
      fileName: a.fileName,
      filePath: a.filePath
        ? a.filePath.startsWith("/uploads")
          ? a.filePath.replace("/uploads", "/api/files/uploads")
          : `/api/files/${a.filePath}`
        : a.filePath,
      attachmentType: a.attachmentType,
      uploadedBy: a.uploadedBy,
      createdAt: a.createdAt,
      user: a.user ? { id: a.user.id, name: a.user.name, email: a.user.email } : null,
    })),
    targetVm: request.targetVm || null,
    upgradeVmId: request.upgradeVmId || null,
    upgradeCpu: request.upgradeCpu || null,
    upgradeRamGb: request.upgradeRamGb || null,
    upgradeStorageGb: request.upgradeStorageGb || null,
    upgradeJustification: request.upgradeJustification || null,
    sourceVmId: request.sourceVmId || null,
    cloneFullDisk: request.cloneFullDisk || false,
    accessTargetVmId: request.accessTargetVmId || null,
    accessType: request.accessType || null,
    accessJustification: request.accessJustification || null,
    underExistingNamespace: request.underExistingNamespace,
    existingNamespaceId: request.existingNamespaceId || null,
    tags: (request.tags || []).map((t: any) => ({
      tag: {
        id: t.tag.id,
        name: t.tag.name,
        description: t.tag.description,
      }
    })),
    k8sRequestNodeGroups: request.k8sRequestNodeGroups || [],
    k8sClusters: request.k8sClusters || [],
    requestResources: request.requestResources || [],
    vmSpecifications: vmSpecsTransformed,
  };

  // Fetch associated Audit Logs
  try {
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entityId: requestId },
          { vmId: { in: (request.vmInstances || []).map((v: any) => v.id) } },
        ],
      },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            designation: true,
          },
        },
      },
      orderBy: { timestamp: "desc" },
    });

    transformed.auditLogs = auditLogs.map((log: any) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      details: log.details,
      timestamp: log.timestamp,
      actor: {
        id: log.actor?.id || "",
        name: log.actor?.name || "System",
        email: log.actor?.email || "",
        designation: log.actor?.designation || undefined,
      },
    }));
  } catch (err) {
    console.error("Failed to fetch audit logs for request:", err);
    transformed.auditLogs = [];
  }

  return transformed;
}

export async function getRequests(
  filters: RequestFilters = {},
  page: number = 1,
  pageSize: number = 10
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const userId = session.user.id;
  const userRoles = session.user.roles;

  const skip = (page - 1) * pageSize;
  const andConditions: Prisma.RequestWhereInput[] = [];

  // 1. BASE VISIBILITY: Non-admins/Non-dcops only see their own stuff
  const isPowerUser = userRoles.includes(ROLES.ADMIN) || userRoles.includes(ROLES.DCOPS);
  if (!isPowerUser) {
    andConditions.push({
      OR: [{ requesterId: userId }, { developerId: userId }]
    });
  }

  // 2. SEARCH FILTERS
  if (filters.search?.trim()) {
    andConditions.push({
      OR: [
        { systemName: { contains: filters.search, mode: "insensitive" } },
        { projectName: { contains: filters.search, mode: "insensitive" } }
      ]
    });
  }

  // 3. TYPE FILTERS
  if (filters.type && filters.type !== "ALL") {
    andConditions.push({ requestType: filters.type as RequestType });
  }

  // 5. STATUS FILTER (Global or Role-based)
  if (filters.status && filters.status !== "ALL") {
    andConditions.push({ status: filters.status as RequestStatus });
  }

  const whereClause: Prisma.RequestWhereInput = { AND: andConditions };

  const [requests, total] = await Promise.all([
    prisma.request.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        vmInstances: { select: { id: true, hostname: true, ipAddress: true, status: true } },
        approvals: {
          where: { entityType: ApprovalEntityType.REQUEST },
          include: { approver: { select: { id: true, name: true } } },
          orderBy: { level: "asc" },
        },
        targetVm: { select: { id: true, hostname: true, status: true } },
        vmSpecifications: { select: { subdomain: true } },
      },
    }),
    prisma.request.count({ where: whereClause })
  ]);

  return {
    success: true,
    data: {
      requests: requests.map((r: any) => transformRequestListItem(r)),
      total,
      totalPages: Math.ceil(total / pageSize),
      currentPage: page
    }
  };
}

function transformRequestListItem(r: RequestWithRelations) {
  const subdomains: string[] = [];
  if (r.subdomain?.trim()) {
    subdomains.push(...r.subdomain.split(",").map(s => s.trim()).filter(Boolean));
  }
  if (r.vmSpecifications && r.vmSpecifications.length > 0) {
    r.vmSpecifications.forEach((spec: any) => {
      if (spec.subdomain?.trim()) {
        const sub = spec.subdomain.trim();
        const suffix = sub.includes(".") ? "" : "";
        subdomains.push(`${sub}${suffix}`);
      }
    });
  }
  const subdomainString = Array.from(new Set(subdomains)).join(", ");

  return {
    id: r.id,
    requestType: r.requestType,
    status: r.status,
    systemName: r.systemName,
    environment: r.environment,
    purpose: r.purpose,
    subdomain: subdomainString || null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    submittedAt: r.submittedAt ?? undefined,
    approvals: (r.approvals || []).map(a => ({
      id: a.id,
      level: a.level,
      decision: a.decision,
      approver: {
        id: a.approver.id,
        name: a.approver.name || "Unknown"
      },
    })),
    vmInstances: r.vmInstances,
    targetVm: r.targetVm
      ? {
        id: r.targetVm.id,
        hostname: r.targetVm.hostname,
        status: r.targetVm.status
      }
      : undefined,
  };
}

export async function deleteRequest(requestId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: { id: true, requesterId: true, status: true, requestType: true, systemName: true }
  });

  if (!request) {
    throw new Error("Request not found");
  }

  const userIsAdmin = hasRole(session.user.roles, ROLES.ADMIN) || hasRole(session.user.roles, ROLES.DCOPS);
  const isOwner = request.requesterId === session.user.id;

  if (!isOwner && !userIsAdmin) {
    throw new Error("Unauthorized: You can only delete your own requests");
  }

  // Non-admins can only delete DRAFT or REJECTED requests
  if (!userIsAdmin && request.status !== RequestStatus.DRAFT && request.status !== RequestStatus.REJECTED) {
    throw new Error("Only DRAFT or REJECTED requests can be deleted");
  }

  await prisma.$transaction(async (tx: any) => {
    // 1. Delete approvals
    await tx.approval.deleteMany({ where: { requestId } });

    // 2. Delete attachments
    await tx.attachment.deleteMany({ where: { requestId } });

    // 3. Delete tags
    await tx.requestTag.deleteMany({ where: { requestId } });

    // 4. Delete request resources
    await tx.requestResource.deleteMany({ where: { requestId } });

    // 5. Delete VM specifications and their nested tables
    const specs = await tx.vmSpecification.findMany({
      where: { requestId },
      select: { id: true }
    });
    for (const spec of specs) {
      await tx.additionalDisk.deleteMany({ where: { vmSpecificationId: spec.id } });
      await tx.firewallPort.deleteMany({ where: { vmSpecificationId: spec.id } });
      await tx.networkAccessEntry.deleteMany({ where: { vmSpecificationId: spec.id } });
    }
    await tx.vmSpecification.deleteMany({ where: { requestId } });

    // 6. Delete top-level disks, ports, network entries, node groups
    await tx.additionalDisk.deleteMany({ where: { requestId } });
    await tx.firewallPort.deleteMany({ where: { requestId } });
    await tx.networkAccessEntry.deleteMany({ where: { requestId } });
    await tx.k8sRequestNodeGroup.deleteMany({ where: { requestId } });

    // 7. Unlink from VmSpec
    await tx.vmSpec.updateMany({
      where: { sourceRequestId: requestId },
      data: { sourceRequestId: null }
    });

    // 8. Unlink from CustomizationRequest
    await tx.customizationRequest.updateMany({
      where: { parentRequestId: requestId },
      data: { parentRequestId: null }
    });

    // 9. Unlink from VmInstance
    await tx.vmInstance.updateMany({
      where: { requestId },
      data: { requestId: null }
    });
    await tx.vmInstance.updateMany({
      where: { cloneOfRequestId: requestId },
      data: { cloneOfRequestId: null }
    });

    // 10. Unlink from K8sCluster
    await tx.k8sCluster.updateMany({
      where: { requestId },
      data: { requestId: null }
    });

    // 11. Delete the Request
    await tx.request.delete({ where: { id: requestId } });

    // 12. Create audit log
    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "DELETE_REQUEST",
        entityType: "REQUEST",
        entityId: requestId,
        details: JSON.stringify({
          systemName: request.systemName,
          requestType: request.requestType,
          status: request.status,
        })
      },
    });
  }, { timeout: 30000 });

  revalidatePath("/requests");
  return { success: true };
}


export async function getRequestStats(requestType?: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const isAdmin = hasRole(session.user.roles, ROLES.ADMIN) || hasRole(session.user.roles, ROLES.DCOPS);
  const baseWhere: Prisma.RequestWhereInput = {
    ...(!isAdmin ? { requesterId: session.user.id } : {}),
    ...(requestType && requestType !== "ALL" ? { requestType: requestType as RequestType } : {}),
  };

  const [total, draft, pending, approved, rejected, deployed, byTypeRaw] = await Promise.all([
    prisma.request.count({ where: baseWhere }),
    prisma.request.count({ where: { ...baseWhere, status: RequestStatus.DRAFT } }),
    prisma.request.count({
      where: {
        ...baseWhere,
        status: { in: [RequestStatus.PENDING_L1, RequestStatus.PENDING_L2, RequestStatus.PENDING_L3, RequestStatus.PENDING_L4] },
      },
    }),
    prisma.request.count({ where: { ...baseWhere, status: RequestStatus.APPROVED } }),
    prisma.request.count({ where: { ...baseWhere, status: RequestStatus.REJECTED } }),
    prisma.request.count({ where: { ...baseWhere, status: RequestStatus.PROVISIONED } }),
    prisma.request.groupBy({
      by: ["requestType"],
      where: isAdmin ? {} : { requesterId: session.user.id },
      _count: true,
    }),
  ]);

  const byType: Record<string, number> = {};
  for (const entry of byTypeRaw) {
    byType[entry.requestType] = entry._count;
  }

  return {
    success: true,
    data: { total, draft, pending, approved, rejected, deployed, byType },
  };
}
