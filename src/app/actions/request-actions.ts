//src/app/actions/request-actions.ts

"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { ApprovalDecision, ApprovalEntityType } from "@prisma/client";
import { notifyApprovers, notifyRequester } from "@/lib/notifications";

import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { RequestStatus } from "@/types/requests";
import { NextResponse } from "next/server";
import { request } from "http";

export async function createRequest(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "REQUESTER" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const userId = session.user.id;

    // ... (lines 25-55) ...
    const rawAdditionalDisks = formData.get("additionalDisks")?.toString();
    const rawFirewallPorts = formData.get("firewallPorts")?.toString();
    const rawNetworkAccess = formData.get("networkAccess")?.toString();

    const additionalDisks = rawAdditionalDisks
      ? JSON.parse(rawAdditionalDisks)
      : [];
    const firewallPorts = rawFirewallPorts ? JSON.parse(rawFirewallPorts) : [];
    const networkAccess = rawNetworkAccess ? JSON.parse(rawNetworkAccess) : [];
    const securityFile = formData.get("securityReport") as File;
    const requestId = crypto.randomUUID(); // Pre-generate to use in path

    let attachments = [];

    if (securityFile && securityFile.size > 0) {
      const uploadDir = path.join(process.cwd(), "uploads", requestId);
      await mkdir(uploadDir, { recursive: true });

      const filePath = path.join(uploadDir, securityFile.name);
      const buffer = Buffer.from(await securityFile.arrayBuffer());
      await writeFile(filePath, buffer);

      // Prepare metadata for DB
      attachments.push({
        fileName: securityFile.name,
        filePath: `/uploads/${requestId}/${securityFile.name}`,
        attachmentType: "SECURITY_REPORT",
        uploadedBy: session.user.id,
      });
    }

    const newCreatedRequest = await prisma.$transaction(async (tx) => {
      const created = await tx.request.create({
        data: {
          requestType: (formData.get("requestType") as any) || "NEW_VM",
          status: (formData.get("status") as RequestStatus) || "DRAFT",
          quantity: parseInt(formData.get("quantity")?.toString() || "1", 10),
          systemName: formData.get("systemName")?.toString() || "",
          projectName: formData.get("projectName")?.toString(),
          purpose: formData.get("purpose")?.toString() || "",
          environment: formData.get("environment") as any,
          expectedEndDate: formData.get("expectedEndDate")
            ? new Date(formData.get("expectedEndDate") as string)
            : null,

          // Hardware Specs
          vcpu: parseInt(formData.get("vcpu")?.toString() || "0"),
          ramGb: parseInt(formData.get("ramGb")?.toString() || "0"),
          storageGb: parseInt(formData.get("storageGb")?.toString() || "0"),
          serverType: formData.get("serverType") as any,
          osName: formData.get("osName")?.toString(),
          osVersion: formData.get("osVersion")?.toString(),
          osLicenseBy: formData.get("osLicenseBy") as any,
          subdomain: formData.get("subdomain")?.toString(),
          sslProvider: formData.get("sslProvider") as any,
          sslCostPaidBy: formData.get("sslCostPaidBy") as any,
          requiredPublicIP: formData.get("requiredPublicIP") === "on",
          vpnRequired: formData.get("vpnRequired") === "on",
          raid: formData.get("raid") as any,

          // Tech Stack
          frontendTech: formData.get("frontendTech")?.toString(),
          backendTech: formData.get("backendTech")?.toString(),
          dataBase: formData.get("dataBase")?.toString(),
          serverArchitecture: formData.get("serverArchitecture")?.toString(),
          additionalTechNotes: formData.get("additionalTechNotes")?.toString(),

          // People
          requesterId: userId,
          responsiblePersonName: formData
            .get("responsiblePersonName")
            ?.toString(),
          responsiblePersonEmail: formData
            .get("responsiblePersonEmail")
            ?.toString(),
          // ... include other person fields here ...

          // Nested Relations (Normalized)
          additionalDisks: {
            create: additionalDisks.map((d: any, index: number) => ({
              sizeGb: parseInt(d.sizeGb),
              purpose: d.purpose,
              sequence: index + 1,
            })),
          },
          firewallPorts: {
            create: firewallPorts.map((p: any) => ({
              port: parseInt(p.port),
              protocol: p.protocol,
              purpose: p.purpose,
              source: p.source,
            })),
          },
          networkAccess: {
            create: networkAccess.map((type: string) => ({
              accessType: type as any,
            })),
          },
          vaReportSubmitted: formData.get("vaReportSubmitted") === "true",
          justificationSubmitted: formData.get("justificationSubmitted") === "true",
        },
      });
      if (attachments.length > 0) {
        await tx.attachment.createMany({
          data: attachments.map((att: any) => ({
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
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function editRequest(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "REQUESTER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const userId = session.user.id;

    // Parse complex types from JSON strings sent by the client
    const requestId = formData.get("requestId")?.toString();
    if (!requestId) {
      return NextResponse.json(
        { error: "Request ID is required" },
        { status: 400 }
      );
    }
    const rawAdditionalDisks = formData.get("additionalDisks")?.toString();
    const rawFirewallPorts = formData.get("firewallPorts")?.toString();
    const rawNetworkAccess = formData.get("networkAccess")?.toString();

    const additionalDisks = rawAdditionalDisks
      ? JSON.parse(rawAdditionalDisks)
      : [];
    const firewallPorts = rawFirewallPorts ? JSON.parse(rawFirewallPorts) : [];
    const networkAccess = rawNetworkAccess ? JSON.parse(rawNetworkAccess) : [];
    const securityFile = formData.get("securityReport") as File;

    let attachments = [];

    if (securityFile && securityFile.size > 0) {
      const uploadDir = path.join(process.cwd(), "uploads", requestId);
      await mkdir(uploadDir, { recursive: true });

      const filePath = path.join(uploadDir, securityFile.name);
      const buffer = Buffer.from(await securityFile.arrayBuffer());
      await writeFile(filePath, buffer);

      // Prepare metadata for DB
      attachments.push({
        fileName: securityFile.name,
        filePath: `/uploads/${requestId}/${securityFile.name}`,
        attachmentType: "SECURITY_REPORT",
        uploadedBy: session.user.id,
      });
    }

    const updatedRequest = await prisma.$transaction(async (tx) => {
      // Delete old relations first if we're replacing them
      await tx.additionalDisk.deleteMany({ where: { requestId } });
      await tx.firewallPort.deleteMany({ where: { requestId } });
      await tx.networkAccessEntry.deleteMany({ where: { requestId } });

      const updated = await tx.request.update({
        where: { id: requestId },
        data: {
          requestType: (formData.get("requestType") as any) || "NEW_VM",
          status: (formData.get("status") as RequestStatus) || "DRAFT",
          quantity: parseInt(formData.get("quantity")?.toString() || "1", 10),
          systemName: formData.get("systemName")?.toString() || "",
          projectName: formData.get("projectName")?.toString(),
          purpose: formData.get("purpose")?.toString() || "",
          environment: formData.get("environment") as any,
          expectedEndDate: formData.get("expectedEndDate")
            ? new Date(formData.get("expectedEndDate") as string)
            : null,

          // Hardware Specs
          vcpu: parseInt(formData.get("vcpu")?.toString() || "0"),
          ramGb: parseInt(formData.get("ramGb")?.toString() || "0"),
          storageGb: parseInt(formData.get("storageGb")?.toString() || "0"),
          serverType: formData.get("serverType") as any,
          osName: formData.get("osName")?.toString(),
          osVersion: formData.get("osVersion")?.toString(),
          osLicenseBy: formData.get("osLicenseBy") as any,
          subdomain: formData.get("subdomain")?.toString(),
          sslProvider: formData.get("sslProvider") as any,
          sslCostPaidBy: formData.get("sslCostPaidBy") as any,
          requiredPublicIP: formData.get("requiredPublicIP") === "on",
          vpnRequired: formData.get("vpnRequired") === "on",
          raid: formData.get("raid") as any,

          // Tech Stack
          frontendTech: formData.get("frontendTech")?.toString(),
          backendTech: formData.get("backendTech")?.toString(),
          dataBase: formData.get("dataBase")?.toString(),
          serverArchitecture: formData.get("serverArchitecture")?.toString(),
          additionalTechNotes: formData.get("additionalTechNotes")?.toString(),

          // People
          responsiblePersonName: formData.get("responsiblePersonName")?.toString(),
          responsiblePersonEmail: formData.get("responsiblePersonEmail")?.toString(),

          // Nested Relations (Normalized)
          additionalDisks: {
            create: additionalDisks.map((d: any, index: number) => ({
              sizeGb: parseInt(d.sizeGb),
              purpose: d.purpose,
              sequence: index + 1,
            })),
          },
          firewallPorts: {
            create: firewallPorts.map((p: any) => ({
              port: parseInt(p.port),
              protocol: p.protocol,
              purpose: p.purpose,
              source: p.source,
            })),
          },
          networkAccess: {
            create: networkAccess.map((type: string) => ({
              accessType: type as any,
            })),
          },
          vaReportSubmitted: formData.get("vaReportSubmitted") === "true",
          justificationSubmitted: formData.get("justificationSubmitted") === "true",
        },
      });

      if (attachments.length > 0) {
        await tx.attachment.createMany({
          data: attachments.map((att: any) => ({
            requestId: updated.id,
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
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
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
    },
  });

  if (!request) throw new Error("Request not found");
  if (request.requesterId !== session.user.id) {
    throw new Error("Only the requester can submit this request");
  }

  const allowedStatuses: RequestStatus[] = ["DRAFT", "REJECTED"];
  if (!allowedStatuses.includes(request.status)) {
    throw new Error(`Cannot submit request in status: ${request.status}`);
  }

  // Enforce security report for PRODUCTION
  // if (request.environment === "PRODUCTION" && !request.vaReportSubmitted) {
  //   throw new Error("Security assessment report is required for production requests.");
  // }

  // ✅ Run ONLY database operations in the transaction
  const updated = await prisma.$transaction(async (tx) => {
    // 1. Update request
    const updatedReq = await tx.request.update({
      where: { id: requestId },
      data: {
        status: "PENDING_L1",
        submittedAt: new Date(),
      },
    });

    // 2. Clear old approvals
    await tx.approval.deleteMany({
      where: { entityId: requestId, entityType: "REQUEST" },
    });

    // 3. Fetch approvers
    const approvers = await tx.user.findMany({
      where: {
        roles: {
          some: {
            role: { name: { in: ["APPROVER_L1", "APPROVER_L2", "APPROVER_L3"] } },
          },
        },
      },
      select: { id: true, roles: { select: { role: { select: { name: true } } } } },
    });

    // 4. Prepare approval data
    const approvalData = approvers.flatMap((user) =>
      user.roles
        .map((ur) => ur.role.name)
        .filter((name) => ["APPROVER_L1", "APPROVER_L2", "APPROVER_L3"].includes(name))
        .map((roleName) => ({
          entityId: requestId,
          entityType: ApprovalEntityType.REQUEST,
          approverId: user.id,
          level: roleName.replace("APPROVER_", "") as "L1" | "L2" | "L3",
          decision: ApprovalDecision.PENDING,
        }))
    );

    // 5. Create new approvals
    await tx.approval.createMany({ data: approvalData });

    // 6. Create audit log
    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "RESUBMIT_REQUEST",
        entityType: "REQUEST",
        entityId: requestId,
        details: JSON.stringify({
          previousStatus: request.status,
          newStatus: "PENDING_L1",
        }),
      },
    });

    return updatedReq;
  }); // ← Transaction ends here (~<5s)

  // ✅ NOW do non-DB work OUTSIDE the transaction
  await notifyApprovers(requestId, request.systemName);
  revalidatePath(`/requests/${requestId}`);

  return updated;
}

export async function createCustomizationRequest(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const userId = session.user.id;
  const targetVmId = formData.get("targetVmId")?.toString();
  const parentRequestId =
    formData.get("parentRequestId")?.toString() || undefined;

  if (!targetVmId) throw new Error("Target VM is required");

  // 🔒 Ensure user owns the VM
  const vm = await prisma.vmInstance.findUnique({
    where: { id: targetVmId },
  });
  if (!vm || vm.ownerId !== userId) {
    throw new Error("You can only customize VMs you own");
  }

  // Optional: if parentRequestId is provided, verify it belongs to the user
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
      parentRequestId: parentRequestId || null, // optional
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

  // 🟢 Now create approvals for this CustomizationRequest
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
      const levelMap: Record<string, "L1" | "L2" | "L3"> = {
        APPROVER_L1: "L1",
        APPROVER_L2: "L2",
        APPROVER_L3: "L3",
      };
      const level = levelMap[ur.role.name];
      return {
        entityId: customization.id, // 🟢 link to CustomizationRequest.id
        entityType: ApprovalEntityType.CUSTOMIZATION, // 🟢 not "REQUEST"
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

//fetch copied request data and append to the new request form request-actions.ts
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

  // Return only the fields you want to reuse
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
    // Tech stack
    frontendTech: source.frontendTech || "",
    backendTech: source.backendTech || "",
    dataBase: source.dataBase || "",
    serverArchitecture: source.serverArchitecture || "",
    additionalTechNotes: source.additionalTechNotes || "",

    // VM Spec
    quantity: source.quantity.toString(),
    vcpu: source.vcpu?.toString() || "2",
    ramGb: source.ramGb?.toString() || "4",
    storageGb: source.storageGb?.toString() || "50",
    osName: source.osName?.toString() || "",
    osVersion: source.osVersion?.toString() || "",
    subdomain: source.subdomain?.toString() || "",
    raid: source.raid?.toString() || "NONE",
    sslProvider: source.sslProvider?.toString() || "MIS",
    sslCostPaidBy: source.sslCostPaidBy?.toString() || "",
    requiredPublicIP: source.requiredPublicIP,
    vpnRequired: source.vpnRequired || false,
    renewalRequired: source.renewalRequired || false,
    renewalPeriodMonths: source.renewalPeriodMonths?.toString() || "",

    // Normalized lists
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

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      additionalDisks: true,
      firewallPorts: true,
      networkAccess: true,
      approvals: {
        where: { entityType: "REQUEST" },
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
        },
      },
    },
  });

  if (!request) throw new Error("Request not found");

  // Transform data to match the UI state (e.g., responsiblePerson.name) [cite: 18, 53, 78]
  return {
    ...request,
    // Format date for <input type="date"> [cite: 63]
    expectedEndDate: request.expectedEndDate?.toISOString().split("T")[0] || "",
    responsiblePerson: {
      name: request.responsiblePersonName || "",
      designation: request.responsiblePersonDesignation || "",
      organization: request.responsiblePersonOrganization || "",
      contact: request.responsiblePersonContact || "",
      email: request.responsiblePersonEmail || "",
    },
    alternativePerson: {
      name: request.alternativePersonName || "",
      designation: request.alternativePersonDesignation || "",
      organization: request.alternativePersonOrganization || "",
      contact: request.alternativePersonContact || "",
      email: request.alternativePersonEmail || "",
    },
    developer: {
      name: request.developerName || "",
      address: request.developerAddress || "",
      contact: request.developerContact || "",
      email: request.developerEmail || "",
    },
    // Flatten array of objects to array of strings for the Checkbox group [cite: 14, 24, 141]
    networkAccess: request.networkAccess.map((n) => n.accessType),
    // Convert numbers to strings for dynamic list Inputs [cite: 11, 19, 130]
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
  };
}
