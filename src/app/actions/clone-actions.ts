// src/app/actions/clone-actions.ts
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { 
  AttachmentType, 
  Environment, 
  RequestStatus, 
  RequestType, 
  ServerType,
  LicenseProvider,
  SSLProvider,
  Protocol,
  NetworkAccess,
  VmStatus
} from "@prisma/client";
import { generateApprovals } from "./approval-actions";
import { AdditionalDisk, FirewallPort } from "@/types/requests";
import { ROLES, hasRole } from "@/lib/roles";

interface Attachment {
  fileName: string;
  filePath: string;
  attachmentType: AttachmentType;
  uploadedBy: string;
}

export async function createCloneRequest(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error("Unauthorized");

    const userId = session.user.id;
    const isDeveloper = hasRole(session.user.roles, ROLES.DEVELOPER);
    const isRequester = hasRole(session.user.roles, ROLES.REQUESTER);
    const isAdmin = hasRole(session.user.roles, ROLES.ADMIN);

    if (!isDeveloper && !isRequester && !isAdmin) {
      throw new Error("Only developers, requesters, or admins can create clone requests");
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

    // Validate source VM exists and belongs to requester
    const sourceVmId = formData.get("sourceVmId")?.toString();
    if (!sourceVmId) {
      throw new Error("Source VM is required for clone request");
    }

    const sourceVm = await prisma.vmInstance.findUnique({
      where: { id: sourceVmId },
      include: { owner: true, currentSpec: true }
    });

    if (!sourceVm) {
      throw new Error("Source VM not found");
    }

    // Check if requester owns the source VM (or is admin)
    const effectiveRequesterId = isDeveloper && assignedRequesterId ? assignedRequesterId : userId;
    if (!isAdmin && sourceVm.ownerId !== effectiveRequesterId) {
      throw new Error("You can only clone your own VMs");
    }

    if (sourceVm.status !== "ACTIVE") {
      throw new Error("Source VM must be ACTIVE to clone");
    }

    // ✅ CREATE REQUEST WITH CORRECT FIELDS
    const newCreatedRequest = await prisma.$transaction(async (tx: any) => {
      const created = await tx.request.create({
        data: {
          requestType: RequestType.CLONE_VM,
          status: (formData.get("status") as RequestStatus) || RequestStatus.DRAFT,
          quantity: 1, // Clone is always 1 VM
          systemName: formData.get("systemName")?.toString() || "",
          projectName: formData.get("projectName")?.toString() || null,
          purpose: formData.get("purpose")?.toString() || "",
          environment: env as Environment,
          expectedDeliveryDate: formData.get("expectedDeliveryDate")
            ? new Date(formData.get("expectedDeliveryDate") as string)
            : null,

          requesterId: isDeveloper && assignedRequesterId 
            ? assignedRequesterId
            : userId,

          ...(isDeveloper && { 
            developerId: userId,
            developerName: session.user.name || "",
            developerDesignation: session.user.designation || "",
            developerOrganization: session.user.organization || "",
            developerContact: session.user.contact || "",
            developerEmail: session.user.email || "",
          }),

          // Use source VM specs as defaults (can be overridden in form)
          vcpu: parseInt(formData.get("vcpu")?.toString() || sourceVm.currentSpec?.vcpu?.toString() || "0"),
          ramGb: parseInt(formData.get("ramGb")?.toString() || sourceVm.currentSpec?.ramGb?.toString() || "0"),
          storageGb: parseInt(formData.get("storageGb")?.toString() || sourceVm.currentSpec?.storageGb?.toString() || "0"),
          serverType: (formData.get("serverType") as ServerType) || ServerType.OTHER,
          osName: formData.get("osName")?.toString() || sourceVm.currentSpec?.osName || null,
          osVersion: formData.get("osVersion")?.toString() || sourceVm.currentSpec?.osVersion || null,
          osLicenseBy: formData.get("osLicenseBy") as LicenseProvider || null,
          subdomain: formData.get("subdomain")?.toString() || null,
          sslProvider: formData.get("sslProvider") as SSLProvider || SSLProvider.MIS,
          sslCostPaidBy: formData.get("sslCostPaidBy")?.toString() || null,
          requiredPublicIP: formData.get("requiredPublicIP") === "on",
          vpnRequired: formData.get("vpnRequired") === "on",

          // Clone specific fields
          sourceVmId: sourceVmId,
          cloneFullDisk: formData.get("cloneFullDisk") === "on" || true,

          // K8s option
          kubernetesOption: formData.get("kubernetesOption") === "on",
          kubernetesNamespace: formData.get("kubernetesNamespace")?.toString() || null,

          // Tech Stack
          frontendTech: formData.get("frontendTech")?.toString() || null,
          backendTech: formData.get("backendTech")?.toString() || null,
          dataBase: formData.get("dataBase")?.toString() || null,
          serverArchitecture: formData.get("serverArchitecture")?.toString() || null,
          additionalTechNotes: formData.get("additionalTechNotes")?.toString() || null,

          // Alternate Person
          alternativePersonName: formData.get("alternativePersonName")?.toString() || null,
          alternativePersonDesignation: formData.get("alternativePersonDesignation")?.toString() || null,
          alternativePersonOrganization: formData.get("alternativePersonOrganization")?.toString() || null,
          alternativePersonContact: formData.get("alternativePersonContact")?.toString() || null,
          alternativePersonEmail: formData.get("alternativePersonEmail")?.toString() || null,

          // Compliance
          vaReportSubmitted: formData.get("vaReportSubmitted") === "true",
          justificationSubmitted: formData.get("justificationSubmitted") === "true",

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
                purpose: p.purpose || "N/A",
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
        "REQUEST",
        RequestType.CLONE_VM
      );
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "CREATE_CLONE_REQUEST",
        entityType: "REQUEST",
        entityId: newCreatedRequest.id,
        details: JSON.stringify({
          systemName: newCreatedRequest.systemName,
          status: newCreatedRequest.status,
          sourceVmId,
          isDeveloperCreated: isDeveloper,
        }),
      },
    });

    return newCreatedRequest;
  } catch (error) {
    console.error("Error creating clone request:", error);
    throw error;
  }
}

// Re-export uploadBuffer from request-actions
import { uploadBuffer } from "@/lib/services/minio.service";

export async function getSourceVmDetails(vmId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error("Unauthorized");

    const vm = await prisma.vmInstance.findUnique({
      where: { id: vmId },
      include: {
        currentSpec: {
          include: {
            additionalDisks: true,
          },
        },
        owner: true,
        request: {
          select: {
            systemName: true,
          },
        },
      },
    });

    if (!vm) throw new Error("VM not found");

    const isAdmin = hasRole(session.user.roles, ROLES.ADMIN);
    if (!isAdmin && vm.ownerId !== session.user.id) {
      throw new Error("You do not have permission to view this VM");
    }

    return vm;
  } catch (error) {
    console.error("Error in getSourceVmDetails:", error);
    throw error;
  }
}

export async function getCloneableVms() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error("Unauthorized");

    const isAdmin = hasRole(session.user.roles, ROLES.ADMIN);
    const whereClause = isAdmin ? { status: VmStatus.ACTIVE } : { ownerId: session.user.id, status: VmStatus.ACTIVE };

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
    console.error("Error in getCloneableVms:", error);
    throw error;
  }
}