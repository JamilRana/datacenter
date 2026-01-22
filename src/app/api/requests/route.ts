// src/app/api/requests/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { ApprovalEntityType } from "@prisma/client";

import { RequestStatus } from "@prisma/client";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { parse } from "path";
import { randomUUID } from "crypto";
import { NextRequest } from "next/server";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "text/plain",
];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Fetch user's requests
  const requests = await prisma.request.findMany({
    where: { requesterId: session.user.id },
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
    },
  });

  if (requests.length === 0) {
    return Response.json([]);
  }

  // 2. Fetch all approvals for these requests
  const requestIds = requests.map((r) => r.id);
  const approvals = await prisma.approval.findMany({
    where: {
      entityType: ApprovalEntityType.REQUEST,
      entityId: { in: requestIds },
    },
    include: {
      approver: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // 3. Group approvals by entityId (requestId)
  const approvalsByRequestId = approvals.reduce((acc, approval) => {
    if (!acc[approval.entityId]) acc[approval.entityId] = [];
    acc[approval.entityId].push(approval);
    return acc;
  }, {} as Record<string, typeof approvals>);

  // 4. Attach approvals to each request
  const requestsWithApprovals = requests.map((request) => ({
    ...request,
    approvals: approvalsByRequestId[request.id] || [],
  }));

  return Response.json(requestsWithApprovals);
}

export async function POST(response: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Content-Type must be multipart/form-data" },
        { status: 400 }
      );
    }

    const formData = await response.formData();

    // --- Parse scalar fields ---
    const systemName = formData.get("systemName")?.toString()?.trim();
    const purpose = formData.get("purpose")?.toString()?.trim();
    const environment = formData.get("environment")?.toString();
    const quantity =
      parseInt(formData.get("quantity")?.toString() || "1", 10) || 1;

    if (!systemName || !purpose || !environment) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // --- Parse JSON fields safely ---
    const parseJsonField = (key: string): any[] => {
      const raw = formData.get(key)?.toString();
      if (!raw) return [];
      try {
        return JSON.parse(raw);
      } catch {
        return [];
      }
    };

    const additionalDisks = parseJsonField("additionalDisks");
    const firewallPorts = parseJsonField("firewallPorts");
    const networkAccess = parseJsonField("networkAccess");

    // --- Handle file uploads ---
    const securityFile = formData.get("securityReport") as File | null;
    const justificationFile = formData.get("justificationDoc") as File | null;

    const requestId = randomUUID();
    const uploadDir = join(process.cwd(), "public", "uploads", requestId);
    await mkdir(uploadDir, { recursive: true });

    const attachments: {
      fileName: string;
      filePath: string;
      attachmentType: "SECURITY_REPORT" | "JUSTIFICATION";
      uploadedBy: string;
    }[] = [];

    // Process Security Report
    if (securityFile) {
      if (securityFile.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "Security report must be <= 10MB" },
          { status: 400 }
        );
      }
      if (!ALLOWED_FILE_TYPES.includes(securityFile.type)) {
        return NextResponse.json(
          { error: "Invalid file type for security report" },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await securityFile.arrayBuffer());
      const safeName = `security-report-${Date.now()}${
        parse(securityFile.name).ext
      }`;
      const filePath = join(uploadDir, safeName);
      await writeFile(filePath, buffer);
      attachments.push({
        fileName: securityFile.name,
        filePath: `/uploads/${requestId}/${safeName}`,
        attachmentType: "SECURITY_REPORT",
        uploadedBy: session.user.id,
      });
    }

    // Process Justification Doc
    if (justificationFile) {
      if (justificationFile.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "Justification document must be <= 10MB" },
          { status: 400 }
        );
      }
      if (!ALLOWED_FILE_TYPES.includes(justificationFile.type)) {
        return NextResponse.json(
          { error: "Invalid file type for justification document" },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await justificationFile.arrayBuffer());
      const safeName = `justification-${Date.now()}${
        parse(justificationFile.name).ext
      }`;
      const filePath = join(uploadDir, safeName);
      await writeFile(filePath, buffer);
      attachments.push({
        fileName: justificationFile.name,
        filePath: `/uploads/${requestId}/${safeName}`,
        attachmentType: "JUSTIFICATION",
        uploadedBy: session.user.id,
      });
    }

    {
      /*// --- Create Request in Transaction ---
    const request = await prisma.$transaction(async (tx) => {
      const newRequest = await tx.request.create({
        data: {
          requestType: "NEW_VM",
          status: (formData.get("status") as RequestStatus) || "DRAFT",
          quantity,
          systemName,
          purpose,
          projectName: formData.get("projectName")?.toString()?.trim() || null,
          environment: environment as any,
          expectedEndDate: formData.get("expectedEndDate")
            ? new Date(formData.get("expectedEndDate") as string)
            : null,

          // People
          requesterId: session.user.id,
          responsiblePersonName:
            formData.get("responsiblePersonName")?.toString() || null,
          responsiblePersonDesignation:
            formData.get("responsiblePersonDesignation")?.toString() || null,
          responsiblePersonOrganization:
            formData.get("responsiblePersonOrganization")?.toString() || null,
          responsiblePersonContact:
            formData.get("responsiblePersonContact")?.toString() || null,
          responsiblePersonEmail:
            formData.get("responsiblePersonEmail")?.toString() || null,
          alternativePersonName:
            formData.get("alternativePersonName")?.toString() || null,
          alternativePersonDesignation:
            formData.get("alternativePersonDesignation")?.toString() || null,
          alternativePersonOrganization:
            formData.get("alternativePersonOrganization")?.toString() || null,
          alternativePersonContact:
            formData.get("alternativePersonContact")?.toString() || null,
          alternativePersonEmail:
            formData.get("alternativePersonEmail")?.toString() || null,

          developerName: formData.get("developerName")?.toString() || null,
          developerAddress:
            formData.get("developerAddress")?.toString() || null,
          developerContact:
            formData.get("developerContact")?.toString() || null,
          developerEmail: formData.get("developerEmail")?.toString() || null,

          // Tech Stack
          frontendTech: formData.get("frontendTech")?.toString() || null,
          backendTech: formData.get("backendTech")?.toString() || null,
          serverArchitecture:
            formData.get("serverArchitecture")?.toString() || null,
          dataBase: formData.get("dataBase")?.toString() || null,
          additionalTechNotes:
            formData.get("additionalTechNotes")?.toString() || null,

          // VM Spec
          serverType: (formData.get("serverType") as any) || "APPLICATION",
          vcpu: formData.get("vcpu")
            ? parseInt(formData.get("vcpu") as string, 10)
            : null,
          ramGb: formData.get("ramGb")
            ? parseInt(formData.get("ramGb") as string, 10)
            : null,
          storageGb: formData.get("storageGb")
            ? parseInt(formData.get("storageGb") as string, 10)
            : null,
          osName: formData.get("osName")?.toString() || null,
          osVersion: formData.get("osVersion")?.toString() || null,
          osLicenseBy: (formData.get("osLicenseBy") as any) || null,
          subdomain: formData.get("subdomain")?.toString() || null,
          sslProvider: (formData.get("sslProvider") as any) || "MIS",
          sslCostPaidBy: formData.get("sslCostPaidBy")?.toString() || null,
          raid: (formData.get("raid") as any) || "NONE",

          // Network & Security
          requiredPublicIP: formData.get("requiredPublicIP") === "on",
          vpnRequired: formData.get("vpnRequired") === "on",
          additionalDisks: {
            create: additionalDisks
              .filter((d: any) => d.sizeGb && !isNaN(parseInt(d.sizeGb)))
              .map((d: any, i: number) => ({
                sizeGb: parseInt(d.sizeGb, 10),
                purpose: d.purpose || null,
                sequence: i,
              })),
          },
          firewallPorts: {
            create: firewallPorts
              .filter((p: any) => p.port && !isNaN(parseInt(p.port)))
              .map((p: any) => ({
                port: parseInt(p.port, 10),
                protocol: p.protocol || "TCP",
                purpose: p.purpose || "N/A",
                source: p.source || null,
              })),
          },
          networkAccess: {
            create: networkAccess
              .filter((type: any) =>
                ["LOCAL", "INTERNET", "REMOTE"].includes(type)
              )
              .map((type: string) => ({ accessType: type as any })),
          },

          // Compliance
          renewalRequired: formData.get("renewalRequired") === "on",
          renewalPeriodMonths: formData.get("renewalPeriodMonths")
            ? parseInt(formData.get("renewalPeriodMonths") as string, 10)
            : null,
          vaReportSubmitted: securityFile !== null && securityFile.size > 0,
          justificationSubmitted:
            justificationFile !== null && justificationFile.size > 0,
        },
      });

      // Create attachments
      if (attachments.length > 0) {
        await tx.attachment.createMany({
          data: attachments.map((att) => ({
            ...att,
            requestId: newRequest.id,
          })),
        });
      }

      return newRequest;
    });
    */
    }

    const newRequest = await prisma.request.create({
      data: {
        requestType: "NEW_VM",
        status: (formData.get("status") as RequestStatus) || "DRAFT",
        quantity,
        systemName,
        purpose,
        projectName: formData.get("projectName")?.toString()?.trim() || null,
        environment: environment as any,
        expectedEndDate: formData.get("expectedEndDate")
          ? new Date(formData.get("expectedEndDate") as string)
          : null,

        // People
        requesterId: session.user.id,
        responsiblePersonName:
          formData.get("responsiblePersonName")?.toString() || null,
        responsiblePersonDesignation:
          formData.get("responsiblePersonDesignation")?.toString() || null,
        responsiblePersonOrganization:
          formData.get("responsiblePersonOrganization")?.toString() || null,
        responsiblePersonContact:
          formData.get("responsiblePersonContact")?.toString() || null,
        responsiblePersonEmail:
          formData.get("responsiblePersonEmail")?.toString() || null,
        alternativePersonName:
          formData.get("alternativePersonName")?.toString() || null,
        alternativePersonDesignation:
          formData.get("alternativePersonDesignation")?.toString() || null,
        alternativePersonOrganization:
          formData.get("alternativePersonOrganization")?.toString() || null,
        alternativePersonContact:
          formData.get("alternativePersonContact")?.toString() || null,
        alternativePersonEmail:
          formData.get("alternativePersonEmail")?.toString() || null,

        developerName: formData.get("developerName")?.toString() || null,
        developerAddress: formData.get("developerAddress")?.toString() || null,
        developerContact: formData.get("developerContact")?.toString() || null,
        developerEmail: formData.get("developerEmail")?.toString() || null,

        // Tech Stack
        frontendTech: formData.get("frontendTech")?.toString() || null,
        backendTech: formData.get("backendTech")?.toString() || null,
        serverArchitecture:
          formData.get("serverArchitecture")?.toString() || null,
        dataBase: formData.get("dataBase")?.toString() || null,
        additionalTechNotes:
          formData.get("additionalTechNotes")?.toString() || null,

        // VM Spec
        serverType: (formData.get("serverType") as any) || "APPLICATION",
        vcpu: formData.get("vcpu")
          ? parseInt(formData.get("vcpu") as string, 10)
          : null,
        ramGb: formData.get("ramGb")
          ? parseInt(formData.get("ramGb") as string, 10)
          : null,
        storageGb: formData.get("storageGb")
          ? parseInt(formData.get("storageGb") as string, 10)
          : null,
        osName: formData.get("osName")?.toString() || null,
        osVersion: formData.get("osVersion")?.toString() || null,
        osLicenseBy: (formData.get("osLicenseBy") as any) || null,
        subdomain: formData.get("subdomain")?.toString() || null,
        sslProvider: (formData.get("sslProvider") as any) || "MIS",
        sslCostPaidBy: formData.get("sslCostPaidBy")?.toString() || null,
        raid: (formData.get("raid") as any) || "NONE",

        // Network & Security
        requiredPublicIP: formData.get("requiredPublicIP") === "on",
        vpnRequired: formData.get("vpnRequired") === "on",
        additionalDisks: {
          create: additionalDisks
            .filter((d: any) => d.sizeGb && !isNaN(parseInt(d.sizeGb)))
            .map((d: any, i: number) => ({
              sizeGb: parseInt(d.sizeGb, 10),
              purpose: d.purpose || null,
              sequence: i,
            })),
        },
        firewallPorts: {
          create: firewallPorts
            .filter((p: any) => p.port && !isNaN(parseInt(p.port)))
            .map((p: any) => ({
              port: parseInt(p.port, 10),
              protocol: p.protocol || "TCP",
              purpose: p.purpose || "N/A",
              source: p.source || null,
            })),
        },
        networkAccess: {
          create: networkAccess
            .filter((type: any) =>
              ["LOCAL", "INTERNET", "REMOTE"].includes(type)
            )
            .map((type: string) => ({ accessType: type as any })),
        },

        // Compliance
        renewalRequired: formData.get("renewalRequired") === "on",
        renewalPeriodMonths: formData.get("renewalPeriodMonths")
          ? parseInt(formData.get("renewalPeriodMonths") as string, 10)
          : null,
        vaReportSubmitted: securityFile !== null && securityFile.size > 0,
        justificationSubmitted:
          justificationFile !== null && justificationFile.size > 0,
      },
    });

    if (attachments.length > 0) {
      try {
        await prisma.attachment.createMany({
          data: attachments.map((att) => ({
            ...att,
            requestId: newRequest.id,
          })),
        });
      } catch (attachError) {
        console.error(
          "Failed to save attachments, but request was created:",
          attachError
        );
        // Optionally: update request to mark attachment failure
      }
    }
    // --- Return success ---
    return NextResponse.json(
      { message: "Request created", requestId: newRequest.id },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PUT(response: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Content-Type must be multipart/form-data" },
        { status: 400 }
      );
    }

    const formData = await response.formData();

    // --- Parse scalar fields ---
    const systemName = formData.get("systemName")?.toString()?.trim();
    const purpose = formData.get("purpose")?.toString()?.trim();
    const environment = formData.get("environment")?.toString();
    const quantity =
      parseInt(formData.get("quantity")?.toString() || "1", 10) || 1;

    if (!systemName || !purpose || !environment) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // --- Parse JSON fields safely ---
    const parseJsonField = (key: string): any[] => {
      const raw = formData.get(key)?.toString();
      if (!raw) return [];
      try {
        return JSON.parse(raw);
      } catch {
        return [];
      }
    };

    const additionalDisks = parseJsonField("additionalDisks");
    const firewallPorts = parseJsonField("firewallPorts");
    const networkAccess = parseJsonField("networkAccess");

    // --- Handle file uploads ---
    const securityFile = formData.get("securityReport") as File | null;
    const justificationFile = formData.get("justificationDoc") as File | null;

    const requestId = randomUUID();
    const uploadDir = join(process.cwd(), "public", "uploads", requestId);
    await mkdir(uploadDir, { recursive: true });

    const attachments: {
      fileName: string;
      filePath: string;
      attachmentType: "SECURITY_REPORT" | "JUSTIFICATION";
      uploadedBy: string;
    }[] = [];

    // Process Security Report
    if (securityFile) {
      if (securityFile.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "Security report must be <= 10MB" },
          { status: 400 }
        );
      }
      if (!ALLOWED_FILE_TYPES.includes(securityFile.type)) {
        return NextResponse.json(
          { error: "Invalid file type for security report" },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await securityFile.arrayBuffer());
      const safeName = `security-report-${Date.now()}${
        parse(securityFile.name).ext
      }`;
      const filePath = join(uploadDir, safeName);
      await writeFile(filePath, buffer);
      attachments.push({
        fileName: securityFile.name,
        filePath: `/uploads/${requestId}/${safeName}`,
        attachmentType: "SECURITY_REPORT",
        uploadedBy: session.user.id,
      });
    }

    // Process Justification Doc
    if (justificationFile) {
      if (justificationFile.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "Justification document must be <= 10MB" },
          { status: 400 }
        );
      }
      if (!ALLOWED_FILE_TYPES.includes(justificationFile.type)) {
        return NextResponse.json(
          { error: "Invalid file type for justification document" },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await justificationFile.arrayBuffer());
      const safeName = `justification-${Date.now()}${
        parse(justificationFile.name).ext
      }`;
      const filePath = join(uploadDir, safeName);
      await writeFile(filePath, buffer);
      attachments.push({
        fileName: justificationFile.name,
        filePath: `/uploads/${requestId}/${safeName}`,
        attachmentType: "JUSTIFICATION",
        uploadedBy: session.user.id,
      });
    }

    const subdomain = formData.get("subdomain")?.toString();
    console.log("Subdomain received:", subdomain);

    const newRequest = await prisma.request.update({
      where: { id: requestId },
      data: {
        requestType: "NEW_VM",
        status: (formData.get("status") as RequestStatus) || "DRAFT",
        quantity,
        systemName,
        purpose,
        projectName: formData.get("projectName")?.toString()?.trim() || null,
        environment: environment as any,
        expectedEndDate: formData.get("expectedEndDate")
          ? new Date(formData.get("expectedEndDate") as string)
          : null,

        // People
        requesterId: session.user.id,
        responsiblePersonName:
          formData.get("responsiblePersonName")?.toString() || null,
        responsiblePersonDesignation:
          formData.get("responsiblePersonDesignation")?.toString() || null,
        responsiblePersonOrganization:
          formData.get("responsiblePersonOrganization")?.toString() || null,
        responsiblePersonContact:
          formData.get("responsiblePersonContact")?.toString() || null,
        responsiblePersonEmail:
          formData.get("responsiblePersonEmail")?.toString() || null,
        alternativePersonName:
          formData.get("alternativePersonName")?.toString() || null,
        alternativePersonDesignation:
          formData.get("alternativePersonDesignation")?.toString() || null,
        alternativePersonOrganization:
          formData.get("alternativePersonOrganization")?.toString() || null,
        alternativePersonContact:
          formData.get("alternativePersonContact")?.toString() || null,
        alternativePersonEmail:
          formData.get("alternativePersonEmail")?.toString() || null,

        developerName: formData.get("developerName")?.toString() || null,
        developerAddress: formData.get("developerAddress")?.toString() || null,
        developerContact: formData.get("developerContact")?.toString() || null,
        developerEmail: formData.get("developerEmail")?.toString() || null,

        // Tech Stack
        frontendTech: formData.get("frontendTech")?.toString() || null,
        backendTech: formData.get("backendTech")?.toString() || null,
        serverArchitecture:
          formData.get("serverArchitecture")?.toString() || null,
        dataBase: formData.get("dataBase")?.toString() || null,
        additionalTechNotes:
          formData.get("additionalTechNotes")?.toString() || null,

        // VM Spec
        serverType: (formData.get("serverType") as any) || "APPLICATION",
        vcpu: formData.get("vcpu")
          ? parseInt(formData.get("vcpu") as string, 10)
          : null,
        ramGb: formData.get("ramGb")
          ? parseInt(formData.get("ramGb") as string, 10)
          : null,
        storageGb: formData.get("storageGb")
          ? parseInt(formData.get("storageGb") as string, 10)
          : null,
        osName: formData.get("osName")?.toString() || null,
        osVersion: formData.get("osVersion")?.toString() || null,
        osLicenseBy: (formData.get("osLicenseBy") as any) || null,
        subdomain: formData.get("subdomain")?.toString() || null,
        sslProvider: (formData.get("sslProvider") as any) || "MIS",
        sslCostPaidBy: formData.get("sslCostPaidBy")?.toString() || null,
        raid: (formData.get("raid") as any) || "NONE",

        // Network & Security
        requiredPublicIP: formData.get("requiredPublicIP") === "on",
        vpnRequired: formData.get("vpnRequired") === "on",
        additionalDisks: {
          create: additionalDisks
            .filter((d: any) => d.sizeGb && !isNaN(parseInt(d.sizeGb)))
            .map((d: any, i: number) => ({
              sizeGb: parseInt(d.sizeGb, 10),
              purpose: d.purpose || null,
              sequence: i,
            })),
        },
        firewallPorts: {
          create: firewallPorts
            .filter((p: any) => p.port && !isNaN(parseInt(p.port)))
            .map((p: any) => ({
              port: parseInt(p.port, 10),
              protocol: p.protocol || "TCP",
              purpose: p.purpose || "N/A",
              source: p.source || null,
            })),
        },
        networkAccess: {
          create: networkAccess
            .filter((type: any) =>
              ["LOCAL", "INTERNET", "REMOTE"].includes(type)
            )
            .map((type: string) => ({ accessType: type as any })),
        },

        // Compliance
        renewalRequired: formData.get("renewalRequired") === "on",
        renewalPeriodMonths: formData.get("renewalPeriodMonths")
          ? parseInt(formData.get("renewalPeriodMonths") as string, 10)
          : null,
        vaReportSubmitted: securityFile !== null && securityFile.size > 0,
        justificationSubmitted:
          justificationFile !== null && justificationFile.size > 0,
      },
    });

    if (attachments.length > 0) {
      try {
        await prisma.attachment.createMany({
          data: attachments.map((att) => ({
            ...att,
            requestId: newRequest.id,
          })),
        });
      } catch (attachError) {
        console.error(
          "Failed to save attachments, but request was created:",
          attachError
        );
        // Optionally: update request to mark attachment failure
      }
    }
    // --- Return success ---
    return NextResponse.json(
      { message: "Request created", requestId: newRequest.id },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
