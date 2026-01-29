"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { 
  ApprovalDecision, 
  ApprovalEntityType, 
  ApprovalLevel, 
  AttachmentType, 
  Environment, 
  LicenseProvider, 
  NetworkAccess, 
  Raid, 
  RequestStatus, 
  RequestType, 
  ServerType, 
  SSLProvider 
} from "@prisma/client";
import { notifyApprovers } from "@/lib/notifications";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { AdditionalDisk, FirewallPort } from "@/types/request-form";
import { ROLES, hasRole } from "@/lib/roles";

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

interface RequestWhereInput {
  requesterId: string;
  status?: RequestStatus;
  requestType?: RequestType;
  OR?: Array<{
    systemName?: { contains: string; mode: "insensitive" };
    projectName?: { contains: string; mode: "insensitive" };
  }>;
}

interface UserRoleWithRoleName {
  role: {
    name: string;
  };
}

export async function createRequest(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (!hasRole(session.user.roles, ROLES.REQUESTER) && !hasRole(session.user.roles, ROLES.ADMIN))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const userId = session.user.id;

    const rawAdditionalDisks = formData.get("additionalDisks")?.toString();
    const rawFirewallPorts = formData.get("firewallPorts")?.toString();
    const rawNetworkAccess = formData.get("networkAccess")?.toString();

    const additionalDisks = rawAdditionalDisks ? JSON.parse(rawAdditionalDisks) : [];
    const firewallPorts = rawFirewallPorts ? JSON.parse(rawFirewallPorts) : [];
    const networkAccess = rawNetworkAccess ? JSON.parse(rawNetworkAccess) : [];
    const securityFile = formData.get("securityReport") as File;
    const requestId = crypto.randomUUID();

    const attachments: Attachment[] = [];

    const env = formData.get("environment")?.toString();
    if (!env || !["DEVELOPMENT", "STAGING", "PRODUCTION", "TESTING"].includes(env)) {
      throw new Error("Invalid environment");
    }

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
        uploadedBy: session.user.id,
      });
    }

    const newCreatedRequest = await prisma.$transaction(async (tx) => {
      const created = await tx.request.create({
        data: {
          requestType: (formData.get("requestType") as RequestType) || RequestType.NEW_VM,
          status: (formData.get("status") as RequestStatus) || RequestStatus.DRAFT,
          quantity: parseInt(formData.get("quantity")?.toString() || "1", 10),
          systemName: formData.get("systemName")?.toString() || "",
          projectName: formData.get("projectName")?.toString(),
          purpose: formData.get("purpose")?.toString() || "",
          environment: env as Environment,
          expectedEndDate: formData.get("expectedEndDate")
            ? new Date(formData.get("expectedEndDate") as string)
            : null,

          vcpu: parseInt(formData.get("vcpu")?.toString() || "0"),
          ramGb: parseInt(formData.get("ramGb")?.toString() || "0"),
          storageGb: parseInt(formData.get("storageGb")?.toString() || "0"),
          serverType: formData.get("serverType") as ServerType,
          osName: formData.get("osName")?.toString(),
          osVersion: formData.get("osVersion")?.toString(),
          osLicenseBy: formData.get("osLicenseBy") as LicenseProvider,
          subdomain: formData.get("subdomain")?.toString(),
          sslProvider: formData.get("sslProvider") as SSLProvider,
          sslCostPaidBy: formData.get("sslCostPaidBy")?.toString(),
          requiredPublicIP: formData.get("requiredPublicIP") === "on",
          vpnRequired: formData.get("vpnRequired") === "on",
          raid: formData.get("raid") as Raid,

          frontendTech: formData.get("frontendTech")?.toString(),
          backendTech: formData.get("backendTech")?.toString(),
          dataBase: formData.get("dataBase")?.toString(),
          serverArchitecture: formData.get("serverArchitecture")?.toString(),
          additionalTechNotes: formData.get("additionalTechNotes")?.toString(),

          requesterId: userId,
          responsiblePersonName: formData.get("responsiblePersonName")?.toString(),
          responsiblePersonEmail: formData.get("responsiblePersonEmail")?.toString(),

          additionalDisks: {
            create: additionalDisks.map((d: AdditionalDisk, index: number) => ({
              sizeGb: parseInt(d.sizeGb),
              purpose: d.purpose,
              sequence: index + 1,
            })),
          },
          firewallPorts: {
            create: firewallPorts.map((p: FirewallPort) => ({
              port: parseInt(p.port),
              protocol: p.protocol,
              purpose: p.purpose,
              source: p.source,
            })),
          },
          networkAccess: {
            create: networkAccess.map((type: string) => ({
              accessType: type as NetworkAccess,
            })),
          },
          vaReportSubmitted: formData.get("vaReportSubmitted") === "true",
          justificationSubmitted: formData.get("justificationSubmitted") === "true",
        },
      });

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

      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "CREATE_REQUEST",
          entityType: "REQUEST",
          entityId: created.id,
          details: JSON.stringify({ systemName: created.systemName }),
        },
      });

      return created;
    });

    return NextResponse.json(newCreatedRequest, { status: 201 });
  } catch (error) {
    console.error("Error creating request:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function editRequest(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !hasRole(session.user.roles, ROLES.REQUESTER)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const requestId = formData.get("requestId")?.toString();
    if (!requestId) {
      return NextResponse.json({ error: "Request ID is required" }, { status: 400 });
    }

    const rawAdditionalDisks = formData.get("additionalDisks")?.toString();
    const rawFirewallPorts = formData.get("firewallPorts")?.toString();
    const rawNetworkAccess = formData.get("networkAccess")?.toString();

    const additionalDisks = rawAdditionalDisks ? JSON.parse(rawAdditionalDisks) : [];
    const firewallPorts = rawFirewallPorts ? JSON.parse(rawFirewallPorts) : [];
    const networkAccess = rawNetworkAccess ? JSON.parse(rawNetworkAccess) : [];
    const securityFile = formData.get("securityReport") as File;

    const attachments: Attachment[] = [];

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
        uploadedBy: session.user.id,
      });
    }

    const updatedRequest = await prisma.$transaction(async (tx) => {
      await tx.additionalDisk.deleteMany({ where: { requestId } });
      await tx.firewallPort.deleteMany({ where: { requestId } });
      await tx.networkAccessEntry.deleteMany({ where: { requestId } });

      const updated = await tx.request.update({
        where: { id: requestId },
        data: {
          requestType: (formData.get("requestType") as RequestType) || RequestType.NEW_VM,
          status: (formData.get("status") as RequestStatus) || RequestStatus.DRAFT,
          quantity: parseInt(formData.get("quantity")?.toString() || "1", 10),
          systemName: formData.get("systemName")?.toString() || "",
          projectName: formData.get("projectName")?.toString(),
          purpose: formData.get("purpose")?.toString() || "",
          environment: formData.get("environment") as Environment,
          expectedEndDate: formData.get("expectedEndDate")
            ? new Date(formData.get("expectedEndDate") as string)
            : null,

          vcpu: parseInt(formData.get("vcpu")?.toString() || "0"),
          ramGb: parseInt(formData.get("ramGb")?.toString() || "0"),
          storageGb: parseInt(formData.get("storageGb")?.toString() || "0"),
          serverType: formData.get("serverType") as ServerType,
          osName: formData.get("osName")?.toString(),
          osVersion: formData.get("osVersion")?.toString(),
          osLicenseBy: formData.get("osLicenseBy") as LicenseProvider,
          subdomain: formData.get("subdomain")?.toString(),
          sslProvider: formData.get("sslProvider") as SSLProvider,
          sslCostPaidBy: formData.get("sslCostPaidBy")?.toString(),
          requiredPublicIP: formData.get("requiredPublicIP") === "on",
          vpnRequired: formData.get("vpnRequired") === "on",
          raid: formData.get("raid") as Raid,

          frontendTech: formData.get("frontendTech")?.toString(),
          backendTech: formData.get("backendTech")?.toString(),
          dataBase: formData.get("dataBase")?.toString(),
          serverArchitecture: formData.get("serverArchitecture")?.toString(),
          additionalTechNotes: formData.get("additionalTechNotes")?.toString(),

          responsiblePersonName: formData.get("responsiblePersonName")?.toString(),
          responsiblePersonEmail: formData.get("responsiblePersonEmail")?.toString(),

          additionalDisks: {
            create: additionalDisks.map((d: AdditionalDisk, index: number) => ({
              sizeGb: parseInt(d.sizeGb),
              purpose: d.purpose,
              sequence: index + 1,
            })),
          },
          firewallPorts: {
            create: firewallPorts.map((p: FirewallPort) => ({
              port: parseInt(p.port),
              protocol: p.protocol,
              purpose: p.purpose,
              source: p.source,
            })),
          },
          networkAccess: {
            create: networkAccess.map((type: string) => ({
              accessType: type as NetworkAccess,
            })),
          },
          vaReportSubmitted: formData.get("vaReportSubmitted") === "true",
          justificationSubmitted: formData.get("justificationSubmitted") === "true",
        },
      });

      if (attachments.length > 0) {
        await tx.attachment.createMany({
          data: attachments.map((att) => ({
            requestId: updated.id,
            fileName: att.fileName,
            filePath: att.filePath,
            attachmentType: att.attachmentType,
            uploadedBy: session.user.id,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "EDIT_REQUEST",
          entityType: "REQUEST",
          entityId: requestId,
          details: JSON.stringify({ systemName: updated.systemName }),
        },
      });

      return updated;
    });

    return NextResponse.json(updatedRequest, { status: 200 });
  } catch (error) {
    console.error("Error editing request:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
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
    },
  });

  if (!request) throw new Error("Request not found");
  if (request.requesterId !== session.user.id) {
    throw new Error("Only the requester can submit this request");
  }

  const allowedStatuses: RequestStatus[] = [RequestStatus.DRAFT, RequestStatus.REJECTED];
  if (!allowedStatuses.includes(request.status)) {
    throw new Error(`Cannot submit request in status: ${request.status}`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedReq = await tx.request.update({
      where: { id: requestId },
      data: {
        status: RequestStatus.PENDING_L1,
        submittedAt: new Date(),
      },
    });

    await tx.approval.deleteMany({
      where: { 
        entityId: requestId, 
        entityType: ApprovalEntityType.REQUEST,
        decision: ApprovalDecision.PENDING 
      },
    });

    const approvers = await tx.user.findMany({
      where: {
        roles: {
          some: {
            role: { name: { in: ["APPROVER_L1", "APPROVER_L2", "APPROVER_L3"] } },
          },
        },
      },
      select: { 
        id: true, 
        roles: { 
          select: { 
            role: { 
              select: { name: true } 
            } 
          } 
        } 
      },
    });

    const approvalData = approvers.flatMap((user) =>
      user.roles
        .map((ur: UserRoleWithRoleName) => ur.role.name)
        .filter((name: string) => {
          if (request.requestType === RequestType.DECOMMISSION) {
            return name === "APPROVER_L1";
          }
          return ["APPROVER_L1", "APPROVER_L2", "APPROVER_L3"].includes(name);
        })
        .map((roleName: string) => ({
          entityId: requestId,
          entityType: ApprovalEntityType.REQUEST,
          approverId: user.id,
          level: roleName.replace("APPROVER_", "") as ApprovalLevel,
          decision: ApprovalDecision.PENDING,
        }))
    );

    await tx.approval.createMany({ data: approvalData });

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "RESUBMIT_REQUEST",
        entityType: "REQUEST",
        entityId: requestId,
        details: JSON.stringify({
          previousStatus: request.status,
          newStatus: RequestStatus.PENDING_L1,
        }),
      },
    });

    return updatedReq;
  });

  await notifyApprovers(requestId, request.systemName);
  revalidatePath(`/requests/${requestId}`);

  return updated;
}

export async function createCustomizationRequest(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const { id: userId } = session.user;
  const targetVmId = formData.get("targetVmId")?.toString();
  const parentRequestId = formData.get("parentRequestId")?.toString() || undefined;

  if (!targetVmId) throw new Error("Target VM is required");

  const vm = await prisma.vmInstance.findUnique({
    where: { id: targetVmId },
  });
  if (!vm || vm.ownerId !== userId) {
    throw new Error("You can only customize VMs you own");
  }

  if (parentRequestId) {
    const parentReq = await prisma.request.findUnique({
      where: { id: parentRequestId },
      select: { requesterId: true },
    });
    if (!parentReq || parentReq.requesterId !== userId) {
      throw new Error("Invalid parent request");
    }
  }

  const customization = await prisma.customizationRequest.create({
    data: {
      targetVmId,
      requesterId: userId,
      parentRequestId: parentRequestId || null,
      vcpu: formData.get("vcpu")
        ? parseInt(formData.get("vcpu") as string, 10)
        : undefined,
      ramGb: formData.get("ramGb")
        ? parseInt(formData.get("ramGb") as string, 10)
        : undefined,
      additionalDisks: formData.get("additionalDisks")
        ? JSON.parse(formData.get("additionalDisks") as string)
        : undefined,
      firewallPorts: formData.get("firewallPorts")
        ? JSON.parse(formData.get("firewallPorts") as string)
        : undefined,
    },
  });

  const approvers = await prisma.user.findMany({
    where: {
      roles: {
        some: {
          role: { name: { in: ["APPROVER_L1", "APPROVER_L2", "APPROVER_L3"] } },
        },
      },
    },
    select: {
      id: true,
      roles: { select: { role: { select: { name: true } } } },
    },
  });

  const approvalData = approvers.flatMap((user) =>
    user.roles.map((ur) => {
      const levelMap: Record<string, ApprovalLevel> = {
        APPROVER_L1: ApprovalLevel.L1,
        APPROVER_L2: ApprovalLevel.L2,
        APPROVER_L3: ApprovalLevel.L3,
      };
      const level = levelMap[ur.role.name];
      return {
        entityId: customization.id,
        entityType: ApprovalEntityType.CUSTOMIZATION,
        approverId: user.id,
        level,
        decision: ApprovalDecision.PENDING,
      };
    })
  );

  await prisma.approval.createMany({ data: approvalData });

  await prisma.auditLog.create({
    data: {
      actorId: session.user.id,
      action: "CREATE_CUSTOMIZATION",
      entityType: "CUSTOMIZATION",
      entityId: customization.id,
      details: JSON.stringify({ targetVmId }),
    },
  });

  revalidatePath(`/vms/${targetVmId}`);
  return customization;
}

export async function getCopyRequestData(sourceRequestId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const source = await prisma.request.findUnique({
    where: { id: sourceRequestId, requesterId: session.user.id },
    include: {
      additionalDisks: true,
      firewallPorts: true,
      networkAccess: true,
    },
  });

  if (!source) throw new Error("Request not found or access denied");

  const copyData = {
    id: sourceRequestId,
    requestType: source.requestType,
    projectName: source.projectName || "",
    systemName: `${source.systemName}`,
    purpose: source.purpose,
    environment: source.environment,
    expectedEndDate: source.expectedEndDate?.toISOString().split("T")[0] || "",
    responsiblePerson: {
      name: source.responsiblePersonName || "",
      designation: source.responsiblePersonDesignation || "",
      organization: source.responsiblePersonOrganization || "",
      contact: source.responsiblePersonContact || "",
      email: source.responsiblePersonEmail || "",
    },
    alternativePerson: {
      name: source.alternativePersonName || "",
      designation: source.alternativePersonDesignation || "",
      organization: source.alternativePersonOrganization || "",
      contact: source.alternativePersonContact || "",
      email: source.alternativePersonEmail || "",
    },
    developer: {
      name: source.developerName || "",
      address: source.developerAddress || "",
      contact: source.developerContact || "",
      email: source.developerEmail || "",
    },
    frontendTech: source.frontendTech || "",
    backendTech: source.backendTech || "",
    dataBase: source.dataBase || "",
    serverArchitecture: source.serverArchitecture || "",
    additionalTechNotes: source.additionalTechNotes || "",

    quantity: source.quantity.toString(),
    vcpu: source.vcpu?.toString() || "2",
    ramGb: source.ramGb?.toString() || "4",
    storageGb: source.storageGb?.toString() || "50",
    osName: source.osName?.toString() || "",
    osVersion: source.osVersion?.toString() || "",
    subdomain: source.subdomain?.toString() || "",
    raid: source.raid?.toString() || "NONE",
    osLicenseBy: source.osLicenseBy?.toString() || "MIS",
    sslProvider: source.sslProvider?.toString() || "MIS",
    sslCostPaidBy: source.sslCostPaidBy?.toString() || "",
    requiredPublicIP: source.requiredPublicIP,
    vpnRequired: source.vpnRequired || false,
    renewalRequired: source.renewalRequired || false,
    renewalPeriodMonths: source.renewalPeriodMonths?.toString() || "",

    additionalDisks: source.additionalDisks.map((d) => ({
      sizeGb: d.sizeGb.toString(),
      purpose: d.purpose || "",
    })),
    firewallPorts: source.firewallPorts.map((p) => ({
      port: p.port.toString(),
      protocol: p.protocol,
      purpose: p.purpose || "",
      source: p.source || "",
    })),
    networkAccess: source.networkAccess.map((n) => n.accessType),
  };
  return JSON.parse(JSON.stringify(copyData));
}

export async function getDetailedRequest(requestId: string) {
  if (!requestId || requestId === "undefined") {
    console.error("getDetailedRequest received an invalid ID");
    return null;
  }
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  let request = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      additionalDisks: true,
      firewallPorts: true,
      networkAccess: true,
      approvals: {
        where: { entityType: ApprovalEntityType.REQUEST },
        include: { approver: true },
        orderBy: { createdAt: "asc" },
      },
      vmInstances: {
        include: {
          currentSpec: {
            include: {
              additionalDisks: true,
              firewallPorts: true,
              networkAccess: true,
            },
          },
          owner: { select: { name: true, email: true } },
          request: { select: { systemName: true, environment: true } },
        },
      },
      targetVm: {
        select: {
          id: true,
          hostname: true,
          ipAddress: true,
          status: true,
          provisionedAt: true,
          owner: { select: { name: true, email: true } },
          request: { select: { systemName: true, environment: true } },
        }
      }
    },
  });

  if (!request) {
    const cust = await prisma.customizationRequest.findUnique({
      where: { id: requestId },
      include: {
        requester: true,
        targetVm: { 
          include: { 
            currentSpec: true,
            owner: { select: { name: true, email: true } },
            request: { select: { systemName: true, environment: true } }
          } 
        },
        additionalDisks: true,
        firewallPorts: true,
        networkAccess: true,
      }
    });

    if (cust) {
      const custApprovals = await prisma.approval.findMany({
        where: { entityId: requestId, entityType: ApprovalEntityType.CUSTOMIZATION },
        include: { approver: true },
        orderBy: { createdAt: "asc" }
      });

      // ✅ COMPLETE TRANSFORMATION: Map CustomizationRequest to Request structure
      request = {
        // Required Request fields
        id: cust.id,
        createdAt: cust.createdAt,
        updatedAt: cust.updatedAt,
        requestType: RequestType.CUSTOMIZED,
        status: cust.status,
        quantity: 1,
        requestId: null,
        projectName: "Infrastructure Update",
        systemName: cust.targetVm?.hostname || "Customization",
        purpose: "Standard hardware/software customization review.",
        environment: Environment.PRODUCTION,
        expectedEndDate: null,
        
        // People fields
        requesterId: cust.requesterId || '',
        responsiblePersonName: null,
        responsiblePersonDesignation: null,
        responsiblePersonOrganization: null,
        responsiblePersonContact: null,
        responsiblePersonEmail: null,
        alternativePersonName: null,
        alternativePersonDesignation: null,
        alternativePersonOrganization: null,
        alternativePersonContact: null,
        alternativePersonEmail: null,
        developerName: null,
        developerAddress: null,
        developerContact: null,
        developerEmail: null,
        
        // Hardware specs (from customization)
        serverType: ServerType.OTHER,
        vcpu: cust.vcpu,
        ramGb: cust.ramGb,
        storageGb: cust.storageGb || null,
        osName: cust.targetVm?.currentSpec?.osName || null,
        osVersion: cust.targetVm?.currentSpec?.osVersion || null,
        osLicenseBy: null,
        subdomain: cust.targetVm?.subdomain || null,
        sslProvider: null,
        sslCostPaidBy: null,
        raid: cust.targetVm?.currentSpec?.raid || null,
        retentionPeriod: null,
        requiredPublicIP: false,
        vpnRequired: false,
        vaReportSubmitted: false,
        justificationSubmitted: false,
        renewalRequired: false,
        renewalPeriodMonths: null,
        
        // Tech stack
        frontendTech: null,
        backendTech: null,
        serverArchitecture: null,
        dataBase: null,
        additionalTechNotes: null,
        
        // Timestamps
        submittedAt: null,
        provisionedAt: null,
        
        // Relations
        vmInstances: [],
        approvals: custApprovals,
        additionalDisks: cust.additionalDisks.map(d => ({ 
          id: d.id, 
          requestId: cust.id, 
          sizeGb: d.sizeGb, 
          purpose: d.purpose, 
          sequence: 0 
        })),
        firewallPorts: cust.firewallPorts.map(p => ({ 
          id: p.id, 
          requestId: cust.id, 
          port: p.port, 
          protocol: p.protocol, 
          purpose: p.purpose, 
          source: p.source 
        })),
        networkAccess: cust.networkAccess.map(n => ({ 
          id: n.id, 
          requestId: cust.id, 
          accessType: n.accessType 
        })),
        
        // Target VM
        targetVmId: cust.targetVmId,
        targetVm: cust.targetVm ? {
          id: cust.targetVm.id,
          hostname: cust.targetVm.hostname,
          ipAddress: cust.targetVm.ipAddress,
          status: cust.targetVm.status,
          provisionedAt: cust.targetVm.provisionedAt,
          owner: cust.targetVm.owner 
            ? { name: cust.targetVm.owner.name, email: cust.targetVm.owner.email } 
            : null,
          request: {
            systemName: cust.targetVm.request.systemName,
            environment: cust.targetVm.request.environment,
          },
        } : null,
    
      };
    }
  }

  if (!request) throw new Error("Request not found");

  const n = (s: string | null | undefined): string | undefined => s ?? undefined;

  return {
    ...request,
    projectName: n(request.projectName),
    frontendTech: n(request.frontendTech),
    backendTech: n(request.backendTech),
    dataBase: n(request.dataBase),
    serverArchitecture: n(request.serverArchitecture),
    additionalTechNotes: n(request.additionalTechNotes),
    osName: n(request.osName),
    osVersion: n(request.osVersion),
    subdomain: n(request.subdomain),
    sslProvider: n(request.sslProvider),
    sslCostPaidBy: n(request.sslCostPaidBy),
    raid: request.raid || Raid.NONE,

    quantity: request.quantity ?? 1,
    vcpu: request.vcpu ?? 0,
    ramGb: request.ramGb ?? 0,
    storageGb: request.storageGb ?? 0,

    requiredPublicIP: request.requiredPublicIP ?? false,
    vpnRequired: request.vpnRequired ?? false,
    vaReportSubmitted: request.vaReportSubmitted ?? false,
    justificationSubmitted: request.justificationSubmitted ?? false,
    renewalRequired: request.renewalRequired ?? false,

    expectedEndDate: request.expectedEndDate?.toISOString().split("T")[0] || "",

    responsiblePerson: {
      name: n(request.responsiblePersonName) || "",
      designation: n(request.responsiblePersonDesignation) || "",
      organization: n(request.responsiblePersonOrganization) || "",
      contact: n(request.responsiblePersonContact) || "",
      email: n(request.responsiblePersonEmail) || "",
    },
    alternativePerson: {
      name: n(request.alternativePersonName) || "",
      designation: n(request.alternativePersonDesignation) || "",
      organization: n(request.alternativePersonOrganization) || "",
      contact: n(request.alternativePersonContact) || "",
      email: n(request.alternativePersonEmail) || "",
    },
    developer: {
      name: n(request.developerName) || "",
      address: n(request.developerAddress) || "",
      contact: n(request.developerContact) || "",
      email: n(request.developerEmail) || "",
    },

    networkAccess: request.networkAccess.map((n) => n.accessType),
    additionalDisks: request.additionalDisks.map((d) => ({
      sizeGb: d.sizeGb.toString(),
      purpose: d.purpose || "",
    })),
    firewallPorts: request.firewallPorts.map((p) => ({
      port: p.port.toString(),
      protocol: p.protocol,
      purpose: p.purpose || "",
      source: p.source || "",
    })),

    approvals: request.approvals,
    vmInstances: request.vmInstances,
    targetVm: request.targetVm,
  };
}

export async function getRequests(filters: RequestFilters = {}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const { id: userId } = session.user;

  const where: RequestWhereInput = {
    requesterId: userId,
  };

  if (filters.status && filters.status !== "ALL") {
    where.status = filters.status as RequestStatus;
  }
  if (filters.type && filters.type !== "ALL") {
    where.requestType = filters.type as RequestType;
  }
  if (filters.search) {
    const search = { contains: filters.search, mode: "insensitive" as const };
    where.OR = [
      { systemName: search },
      { projectName: search },
    ];
  }

  const requests = await prisma.request.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      vmInstances: {
        select: {
          id: true,
          hostname: true,
          ipAddress: true,
          status: true,
        },
      },
      approvals: {
        include: {
          approver: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  return JSON.parse(JSON.stringify(requests));
}