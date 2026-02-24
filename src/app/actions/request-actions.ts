"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { 
  Prisma,
  ApprovalDecision, 
  ApprovalEntityType,  
  AttachmentType, 
  Environment, 
  LicenseProvider, 
  NetworkAccess, 
  Raid, 
  RequestStatus, 
  RequestType, 
  ServerType, 
  SSLProvider,
  Protocol
} from "@prisma/client";
import { notifyApprovers } from "@/lib/notifications";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { AdditionalDisk, FirewallPort } from "@/types/requests";
import { detailsRequest } from "@/types/requests";
import { ROLES, hasRole } from "@/lib/roles";
import { User } from "@/types/users";

import { Approval } from "@/types/approvals";

type RequestWithRelations = Prisma.RequestGetPayload<{
  include: {
    vmInstances: { select: { id: true, hostname: true, ipAddress: true, status: true } },
    approvals: { 
      include: { approver: { select: { id: true, name: true } } } 
    },
    targetVm: { select: { id: true, hostname: true, status: true } }
  }
}>

interface Attachment {
  fileName: string;
  filePath: string;
  attachmentType: AttachmentType;
  uploadedBy: string;
}

// Type definitions for Prisma queries
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

      if (!assignedUser || !assignedUser.roles.some(r => r.role.name === ROLES.REQUESTER)) {
        throw new Error("Assigned user must have REQUESTER role");
      }

      // Force DRAFT status for developers
      formData.set("status", RequestStatus.DRAFT);
    }

    // ✅ EXTRACT DATA FROM FORM
    const rawAdditionalDisks = formData.get("additionalDisks")?.toString();
    const rawFirewallPorts = formData.get("firewallPorts")?.toString();
    const rawNetworkAccess = formData.get("networkAccess")?.toString();
    const additionalDisks = rawAdditionalDisks ? JSON.parse(rawAdditionalDisks) : [];
    const firewallPorts = rawFirewallPorts ? JSON.parse(rawFirewallPorts) : [];
    const networkAccess = rawNetworkAccess ? JSON.parse(rawNetworkAccess) : [];
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
      const uploadDir = path.join(process.cwd(), "uploads", requestId);
      await mkdir(uploadDir, { recursive: true });
      const filePath = path.join(uploadDir, securityFile.name);
      const buffer = Buffer.from(await securityFile.arrayBuffer());
      await writeFile(filePath, buffer);
      attachments.push({
        fileName: securityFile.name,
        filePath: `/uploads/${requestId}/${securityFile.name}`,
        attachmentType: AttachmentType.SECURITY_REPORT,
        uploadedBy: userId,
      });
    }

    // Handle justification document upload
    if (justificationFile && justificationFile.size > 0) {
      const uploadDir = path.join(process.cwd(), "uploads", requestId);
      await mkdir(uploadDir, { recursive: true });
      const filePath = path.join(uploadDir, justificationFile.name);
      const buffer = Buffer.from(await justificationFile.arrayBuffer());
      await writeFile(filePath, buffer);
      attachments.push({
        fileName: justificationFile.name,
        filePath: `/uploads/${requestId}/${justificationFile.name}`,
        attachmentType: AttachmentType.JUSTIFICATION,
        uploadedBy: userId,
      });
    }

    // ✅ CREATE REQUEST WITH CORRECT FIELDS (schema-aligned)
    const newCreatedRequest = await prisma.$transaction(async (tx) => {
      const created = await tx.request.create({
        data: {
          requestType: (formData.get("requestType") as RequestType) || RequestType.NEW_VM,
          status: (formData.get("status") as RequestStatus) || RequestStatus.DRAFT,
          quantity: parseInt(formData.get("quantity")?.toString() || "1", 10),
          systemName: formData.get("systemName")?.toString() || "",
          projectName: formData.get("projectName")?.toString() || null,
          purpose: formData.get("purpose")?.toString() || "",
          environment: env as Environment,
          expectedEndDate: formData.get("expectedEndDate")
            ? new Date(formData.get("expectedEndDate") as string)
            : null,

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
          vcpu: parseInt(formData.get("vcpu")?.toString() || "0"),
          ramGb: parseInt(formData.get("ramGb")?.toString() || "0"),
          storageGb: parseInt(formData.get("storageGb")?.toString() || "0"),
          serverType: (formData.get("serverType") as ServerType) || ServerType.OTHER,
          osName: formData.get("osName")?.toString() || null,
          osVersion: formData.get("osVersion")?.toString() || null,
          osLicenseBy: formData.get("osLicenseBy") as LicenseProvider || null,
          subdomain: formData.get("subdomain")?.toString() || null,
          sslProvider: formData.get("sslProvider") as SSLProvider || SSLProvider.MIS,
          sslCostPaidBy: formData.get("sslCostPaidBy")?.toString() || null,
          raid: formData.get("raid") as Raid || Raid.NONE,
          requiredPublicIP: formData.get("requiredPublicIP") === "on",
          vpnRequired: formData.get("vpnRequired") === "on",

          // Tech Stack
          frontendTech: formData.get("frontendTech")?.toString() || null,
          backendTech: formData.get("backendTech")?.toString() || null,
          dataBase: formData.get("dataBase")?.toString() || null,
          serverArchitecture: formData.get("serverArchitecture")?.toString() || null,
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
            create: additionalDisks
              .filter((d: AdditionalDisk) => d.sizeGb && d.sizeGb > 0)
              .map((d: AdditionalDisk, index: number) => ({
                sizeGb: d.sizeGb,
                purpose: d.purpose || null,
                sequence: index + 1,
              })),
          },
          firewallPorts: {
            create: firewallPorts
              .filter((p: FirewallPort) => p.port && p.port > 0)
              .map((p: FirewallPort) => ({
                port: p.port,
                protocol: p.protocol as Protocol,
                purpose: p.purpose || null,
                source: p.source || null,
              })),
          },
          networkAccess: {
            create: networkAccess
              .filter((type: string) => type)
              .map((type: string) => ({
                accessType: type as NetworkAccess,
              })),
          },
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

    // ✅ GENERATE APPROVALS ONLY FOR SUBMITTED REQUESTS (not drafts)
    if (newCreatedRequest.status === RequestStatus.PENDING_L1) {
      await generateApprovals(
        prisma,
        newCreatedRequest.id,
        ApprovalEntityType.REQUEST,
        newCreatedRequest.requestType
      );
      await notifyApprovers(newCreatedRequest.id, newCreatedRequest.systemName);
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
    const additionalDisks = rawAdditionalDisks ? JSON.parse(rawAdditionalDisks) : [];
    const firewallPorts = rawFirewallPorts ? JSON.parse(rawFirewallPorts) : [];
    const networkAccess = rawNetworkAccess ? JSON.parse(rawNetworkAccess) : [];
    const securityFile = formData.get("securityReport") as File;
    const justificationFile = formData.get("justificationDoc") as File;
    const attachments: Attachment[] = [];

    // Handle security report upload
    if (securityFile && securityFile.size > 0) {
      const uploadDir = path.join(process.cwd(), "uploads", requestId);
      await mkdir(uploadDir, { recursive: true });
      const filePath = path.join(uploadDir, securityFile.name);
      const buffer = Buffer.from(await securityFile.arrayBuffer());
      await writeFile(filePath, buffer);
      attachments.push({
        fileName: securityFile.name,
        filePath: `/uploads/${requestId}/${securityFile.name}`,
        attachmentType: AttachmentType.SECURITY_REPORT,
        uploadedBy: userId,
      });
    }

    // Handle justification document upload
    if (justificationFile && justificationFile.size > 0) {
      const uploadDir = path.join(process.cwd(), "uploads", requestId);
      await mkdir(uploadDir, { recursive: true });
      const filePath = path.join(uploadDir, justificationFile.name);
      const buffer = Buffer.from(await justificationFile.arrayBuffer());
      await writeFile(filePath, buffer);
      attachments.push({
        fileName: justificationFile.name,
        filePath: `/uploads/${requestId}/${justificationFile.name}`,
        attachmentType: AttachmentType.JUSTIFICATION,
        uploadedBy: userId,
      });
    }

    const updatedRequest = await prisma.$transaction(async (tx) => {
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
      await tx.additionalDisk.deleteMany({ where: { requestId } });
      await tx.firewallPort.deleteMany({ where: { requestId } });
      await tx.networkAccessEntry.deleteMany({ where: { requestId } });

      // ✅ CRITICAL FIX: DO NOT include requesterId/developerId in update
      // Prisma automatically preserves existing relation values
      // Only include fields that can actually change during edit
      const updateData = {
        requestType: (formData.get("requestType") as RequestType) || RequestType.NEW_VM,
        status: (formData.get("status") as RequestStatus) || RequestStatus.DRAFT,
        quantity: parseInt(formData.get("quantity")?.toString() || "1", 10),
        systemName: formData.get("systemName")?.toString() || "",
        projectName: formData.get("projectName")?.toString() || null,
        purpose: formData.get("purpose")?.toString() || "",
        environment: formData.get("environment") as Environment,
        expectedEndDate: formData.get("expectedEndDate")
          ? new Date(formData.get("expectedEndDate") as string)
          : null,

        // VM Spec (only editable fields)
        vcpu: parseInt(formData.get("vcpu")?.toString() || "0"),
        ramGb: parseInt(formData.get("ramGb")?.toString() || "0"),
        storageGb: parseInt(formData.get("storageGb")?.toString() || "0"),
        serverType: formData.get("serverType") as ServerType || ServerType.OTHER,
        osName: formData.get("osName")?.toString() || null,
        osVersion: formData.get("osVersion")?.toString() || null,
        osLicenseBy: formData.get("osLicenseBy") as LicenseProvider || null,
        subdomain: formData.get("subdomain")?.toString() || null,
        sslProvider: formData.get("sslProvider") as SSLProvider || SSLProvider.MIS,
        sslCostPaidBy: formData.get("sslCostPaidBy")?.toString() || null,
        raid: formData.get("raid") as Raid || Raid.NONE,
        requiredPublicIP: formData.get("requiredPublicIP") === "on",
        vpnRequired: formData.get("vpnRequired") === "on",

        // Tech Stack
        frontendTech: formData.get("frontendTech")?.toString() || null,
        backendTech: formData.get("backendTech")?.toString() || null,
        dataBase: formData.get("dataBase")?.toString() || null,
        serverArchitecture: formData.get("serverArchitecture")?.toString() || null,
        additionalTechNotes: formData.get("additionalTechNotes")?.toString() || null,

        // ✅ ALTERNATE PERSON (editable backup contact)
        alternativePersonName: formData.get("alternativePersonName")?.toString() || null,
        alternativePersonDesignation: formData.get("alternativePersonDesignation")?.toString() || null,
        alternativePersonOrganization: formData.get("alternativePersonOrganization")?.toString() || null,
        alternativePersonContact: formData.get("alternativePersonContact")?.toString() || null,
        alternativePersonEmail: formData.get("alternativePersonEmail")?.toString() || null,

        // ✅ DEVELOPER FLAT FIELDS (preserve original values - NOT editable after creation)
        // ⚠️ DO NOT update these on edit - they should remain as originally set
        // developerName, developerDesignation, etc. are preserved automatically

        // Relations (recreate)
        additionalDisks: {
          create: additionalDisks
            .filter((d: AdditionalDisk) => d.sizeGb && d.sizeGb > 0)
            .map((d: AdditionalDisk, index: number) => ({
              sizeGb: d.sizeGb,
              purpose: d.purpose || null,
              sequence: index + 1,
            })),
        },
        firewallPorts: {
          create: firewallPorts
            .filter((p: FirewallPort) => p.port && p.port > 0)
            .map((p: FirewallPort) => ({
              port: p.port,
              protocol: p.protocol as Protocol,
              purpose: p.purpose || null,
              source: p.source || null,
            })),
        },
        networkAccess: {
          create: networkAccess
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
        ApprovalEntityType.REQUEST,
        updatedRequest.requestType
      );
      
      await notifyApprovers(requestId, updatedRequest.systemName);
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

  const updated = await prisma.$transaction(async (tx) => {
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
      ApprovalEntityType.REQUEST, 
      request.requestType as RequestType
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

  await notifyApprovers(requestId, request.systemName);
  revalidatePath(`/requests/${requestId}`);

  return updated;
}

// ✅ TRANSFORM Prisma roles → string array to match User interface
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
  return approvers.map(user => ({
    ...user,
    roles: user.roles.map(ur => ur.role.name) // Extract role names
  }));
}

// src/app/actions/request-actions.ts
export async function generateApprovals(
  tx: Prisma.TransactionClient | typeof prisma,
  entityId: string,
  entityType: ApprovalEntityType,
  requestType: RequestType
) {
  const baseLevels =
    requestType === RequestType.DECOMMISSION
      ? [1]
      : [1, 2, 3];

  const approvalData: Prisma.ApprovalCreateManyInput[] = [];

  for (const level of baseLevels) {
    const roleName =
      level === 1 ? "APPROVER_L1" :
      level === 2 ? "APPROVER_L2" :
      "APPROVER_L3";

    const approver = await tx.user.findFirst({
      where: {
        isActive: true,
        roles: { some: { role: { name: roleName } } }
      },
      orderBy: { createdAt: "asc" }
    });

    if (approver) {
      approvalData.push({
        entityType,
        level,
        approverId: approver.id,
        decision: ApprovalDecision.PENDING,
        ...(entityType === ApprovalEntityType.REQUEST
          ? { requestId: entityId }
          : { customizationRequestId: entityId }),
      });
    }
  }

  if (approvalData.length > 0) {
    await tx.approval.createMany({
      data: approvalData
    });
  }
}


export async function getDetailedRequest(requestId: string): Promise<detailsRequest | null> {
  if (!requestId || requestId === "undefined") {
    console.error("getDetailedRequest received an invalid ID");
    return null;
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");
  const isAdmin = session.user.roles.includes(ROLES.ADMIN);
  const isApprover = session.user.roles.some(r => r.startsWith("APPROVER_"));
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
      vmInstances: true,
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
      targetVm: true,
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
      }
    },
  });

  if (!request) throw new Error("Request not found");

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
    expectedEndDate: request.expectedEndDate || null,

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
    osLicenseBy: request.osLicenseBy as LicenseProvider|| null,
    storageGb: request.storageGb || null,
    subdomain: request.subdomain || null,
    sslProvider: request.sslProvider || null,
    sslCostPaidBy: request.sslCostPaidBy || null,
    raid: request.raid || null,
    retentionPeriod: request.retentionPeriod || null,
    requiredPublicIP: request.requiredPublicIP,
    vpnRequired: request.vpnRequired,

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
    additionalDisks: (request.additionalDisks || []).map((d) => ({
      sizeGb: d.sizeGb,
      purpose: d.purpose || undefined,
      sequence: d.sequence,
    })),
    firewallPorts: (request.firewallPorts || []).map((p) => ({
      port: p.port,
      protocol: p.protocol,
      purpose: p.purpose,
      source: p.source || undefined,
    })),
    networkAccess: (request.networkAccess || []).map((n) => ({
      accessType: n.accessType,
    })),
    attachments: (request.attachments || []).map((a) => ({
      id: a.id,
      fileName: a.fileName,
      filePath: a.filePath,
      attachmentType: a.attachmentType,
      uploadedBy: a.uploadedBy,
      createdAt: a.createdAt,
      user: a.user ? { id: a.user.id, name: a.user.name, email: a.user.email } : null,
    })),
    targetVm: request.targetVm || null,
  };

  return transformed;
}

// export async function getRequests(
//   filters: RequestFilters = {}, 
//   page: number = 1, 
//   pageSize: number = 10
// ) {
//   const session = await getServerSession(authOptions);
//   if (!session?.user) throw new Error("Unauthorized");
  
//   const userId = session.user.id;
//   const userRoles = session.user.roles;
//   const isApprover = session.user.roles.some(r => r.startsWith("APPROVER_"));
//   const isAdmin = userRoles.includes(ROLES.ADMIN);
  
  
//   const skip = (page - 1) * pageSize;
//   const andConditions: Prisma.RequestWhereInput[] = [];
//   if (!isApprover && !isAdmin) {
//   andConditions.push({
//     OR: [
//       { requesterId: userId },
//       { developerId: userId }
//     ]
//   });
// }
// if (filters.search?.trim()) {
//   andConditions.push({
//     OR: [
//       { systemName: { contains: filters.search, mode: "insensitive" } },
//       { projectName: { contains: filters.search, mode: "insensitive" } }
//     ]
//   });
// }
//   // ✅ BUILD QUERY WITH PROPER VISIBILITY RULES
//     const whereClause: Prisma.RequestWhereInput = {
//     // Regular users: only their own requests

//     AND: andConditions,
//     // Status filter with role-based enforcement
//     ...(filters.status && filters.status !== "ALL"
//       ? { status: filters.status as RequestStatus }
//       : !isApprover || isAdmin
//         ? {} 
//         : {
//             status: {
//               in: userRoles.flatMap(role => {
//                 if (role === "APPROVER_L1") return [RequestStatus.PENDING_L1];
//                 if (role === "APPROVER_L2") return [RequestStatus.PENDING_L2];
//                 if (role === "APPROVER_L3") return [RequestStatus.PENDING_L3];
//                 if (role === ROLES.L4_APPROVER) return [RequestStatus.PENDING_L4];
//                 return [];
//               }).filter(Boolean)
//             }
//           }
//     ),
    
//     // Type & search filters (same as before)
//     ...(filters.type && filters.type !== "ALL" && {
//       requestType: filters.type as RequestType
//     }),

//   };

//   // ✅ CRITICAL FIX: Approvers ONLY see requests with PENDING approval assigned to THEM
// // ✅ CRITICAL FIX: Approvers ONLY see requests with PENDING approval assigned to THEM
// if (isApprover && !isAdmin) {
//   // 1. Map roles to their integer levels
//   const levelMapping: Record<string, number> = {
//     "APPROVER_L1": 1,
//     "APPROVER_L2": 2,
//     "APPROVER_L3": 3,
//     [ROLES.L4_APPROVER]: 4,
//   };

//   const myActionableLevels = userRoles
//     .map(role => levelMapping[role])
//     .filter((lvl): lvl is number => lvl !== undefined);

//   // 2. Get request IDs where CURRENT USER has a PENDING approval record
//   const pendingApprovals = await prisma.approval.findMany({
//     where: {
//       approverId: userId,
//       decision: ApprovalDecision.PENDING,
//       entityType: ApprovalEntityType.REQUEST,
//       level: { in: myActionableLevels } // ✅ Matches numeric level
//     },
//     select: { requestId: true },
//     take: 1000
//   });

//   const requestIdsForApprover = pendingApprovals
//     .map(a => a.requestId)
//     .filter((id): id is string => id !== null);

//   // 3. Restrict whereClause to only these IDs
//   // If the user has no pending items, we force an empty set
//   whereClause.id = { in: requestIdsForApprover };
// }
// const [requests, total] = await Promise.all([
//   prisma.request.findMany({
//     where: whereClause,
//     orderBy: { createdAt: "desc" },
//     skip,
//     take: pageSize,
//     include: {
//       vmInstances: { 
//         select: { id: true, hostname: true, ipAddress: true, status: true } 
//       },
//       approvals: { 
//         where: { entityType: ApprovalEntityType.REQUEST },
//         include: { approver: { select: { id: true, name: true } } },
//         orderBy: { createdAt: "asc" },
//       },
//       // Include this for all so the Type remains consistent
//       targetVm: { 
//         select: { id: true, hostname: true, status: true } 
//       },
//     },
//   }),
//   prisma.request.count({ where: whereClause })
// ]);
  
//   const totalPages = Math.ceil(total / pageSize);
  
//   return { 
//     requests: requests.map(r => transformRequestListItem(r)), 
//     total, 
//     totalPages, 
//     currentPage: page 
//   };
// }

export async function getRequests(
  filters: RequestFilters = {},
  page: number = 1,
  pageSize: number = 10
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const userId = session.user.id;
  const userRoles = session.user.roles;
  const isAdmin = userRoles.includes(ROLES.ADMIN);
  const isApprover = session.user.roles.some(r => r.startsWith("APPROVER_") || r === ROLES.L4_APPROVER);
  
  const levelMapping: Record<string, number> = {
      "APPROVER_L1": 1,
      "APPROVER_L2": 2,
      "APPROVER_L3": 3,
      [ROLES.L4_APPROVER]: 4,
    };
  const skip = (page - 1) * pageSize;
  const andConditions: Prisma.RequestWhereInput[] = [];

  // 1. BASE VISIBILITY: Non-admins/Non-approvers only see their own stuff
  if (!isAdmin && !isApprover) {
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

  // 4. APPROVER SPECIFIC FILTERING
  // If user is an Approver and NOT an Admin, they should ONLY see what they need to sign
  if (isApprover && !isAdmin) {
    
    const myActionableLevels = userRoles
      .map(role => levelMapping[role])
      .filter((lvl): lvl is number => lvl !== undefined);

    // Filter by pending approvals assigned to THIS specific user at THEIR level
    andConditions.push({
      approvals: {
        some: {
          approverId: userId,
          decision: ApprovalDecision.PENDING,
          entityType: ApprovalEntityType.REQUEST,
          level: { in: myActionableLevels }
        }
      }
    });
  }

  // 5. STATUS FILTER (Global or Role-based)
  if (filters.status && filters.status !== "ALL") {
    andConditions.push({ status: filters.status as RequestStatus });
  } else if (isApprover && !isAdmin) {
    // If no specific status filter is picked, default to the statuses relevant to their levels
    const statusMapping: Record<number, RequestStatus> = {
      1: RequestStatus.PENDING_L1,
      2: RequestStatus.PENDING_L2,
      3: RequestStatus.PENDING_L3,
      4: RequestStatus.PENDING_L4,
    };
    
    const myStatuses = userRoles
      .map(role => statusMapping[levelMapping[role]])
      .filter(Boolean);

    andConditions.push({ status: { in: myStatuses } });
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
      },
    }),
    prisma.request.count({ where: whereClause })
  ]);

  return {
    requests: requests.map(r => transformRequestListItem(r)),
    total,
    totalPages: Math.ceil(total / pageSize),
    currentPage: page
  };
}

function transformRequestListItem(r: RequestWithRelations) {
  return {
    id: r.id,
    requestType: r.requestType,
    status: r.status,
    systemName: r.systemName,
    environment: r.environment,
    purpose: r.purpose,
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

  // ✅ ONLY delete Request records - NO customization handling
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: { id: true, requesterId: true, status: true, requestType: true }
  });

  if (!request) {
    throw new Error("Request not found");
  }

  if (request.requesterId !== session.user.id) {
    throw new Error("Unauthorized: You can only delete your own requests");
  }

  // Prevent deletion of non-DRAFT requests
  if (request.status !== RequestStatus.DRAFT) {
    throw new Error("Only DRAFT requests can be deleted");
  }

  await prisma.request.delete({ where: { id: requestId } });

  await prisma.auditLog.create({
    data: {
      actorId: session.user.id,
      action: "DELETE_REQUEST",
      entityType: "REQUEST",
      entityId: requestId,
    },
  });

  revalidatePath("/requests");
  return { success: true };
}


