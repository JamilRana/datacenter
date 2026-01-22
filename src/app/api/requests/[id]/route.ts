// src/app/api/requests/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { ApprovalEntityType } from "@prisma/client";
import { RequestStatus } from "@prisma/client";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { parse } from "path";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "text/plain",
];

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: requestId } = params;

  const req = await prisma.request.findUnique({
    where: { id: requestId, requesterId: session.user.id },
    include: {
      vmInstances: {
        select: {
          id: true,
          hostname: true,
          ipAddress: true,
          publicIpAddress: true,
          status: true,
          currentSpec: {
            select: {
              vcpu: true,
              ramGb: true,
              storageGb: true,
              osName: true,
              osVersion: true,
            },
          },
        },
      },
    },
  });

  if (!req) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const approvals = await prisma.approval.findMany({
    where: {
      entityType: ApprovalEntityType.REQUEST,
      entityId: requestId,
    },
    include: {
      approver: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return Response.json({ ...req, approvals });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = request.headers.get("content-type");
    if (!contentType || !contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Content-Type must be multipart/form-data" },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const requestId = params.id; // ✅ Use URL param, NOT new UUID

    // ✅ Verify ownership and status
    const existingRequest = await prisma.request.findUnique({
      where: {
        id: requestId,
        requesterId: session.user.id,
        status: "DRAFT", // Only allow editing DRAFT
      },
    });

    if (!existingRequest) {
      return NextResponse.json(
        {
          error: "Request not found, not owned by you, or not in DRAFT status",
        },
        { status: 403 }
      );
    }

    // --- Parse fields (same as POST) ---
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

    const attachments: {
      fileName: string;
      filePath: string;
      attachmentType: "SECURITY_REPORT" | "JUSTIFICATION";
      uploadedBy: string;
    }[] = [];

    // Create upload dir for this request (reuse existing if possible)
    const uploadDir = join(process.cwd(), "public", "uploads", requestId);
    await mkdir(uploadDir, { recursive: true });

    // Process Security Report
    if (securityFile && securityFile.size > 0) {
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
    if (justificationFile && justificationFile.size > 0) {
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

    // --- Update request in transaction ---
    const updatedRequest = await prisma.$transaction(async (tx) => {
      // 1. Update main request
      const updated = await tx.request.update({
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

      // 2. Clear old relations
      await tx.additionalDisk.deleteMany({ where: { requestId } });
      await tx.firewallPort.deleteMany({ where: { requestId } });
      await tx.networkAccessEntry.deleteMany({ where: { requestId } });

      // 3. Create new relations
      if (additionalDisks.length > 0) {
        await tx.additionalDisk.createMany({
          data: additionalDisks
            .filter((d: any) => d.sizeGb && !isNaN(parseInt(d.sizeGb)))
            .map((d: any, i: number) => ({
              requestId,
              sizeGb: parseInt(d.sizeGb, 10),
              purpose: d.purpose || null,
              sequence: i,
            })),
        });
      }

      if (firewallPorts.length > 0) {
        await tx.firewallPort.createMany({
          data: firewallPorts
            .filter((p: any) => p.port && !isNaN(parseInt(p.port)))
            .map((p: any) => ({
              requestId,
              port: parseInt(p.port, 10),
              protocol: p.protocol || "TCP",
              purpose: p.purpose || "N/A",
              source: p.source || null,
            })),
        });
      }

      if (networkAccess.length > 0) {
        await tx.networkAccessEntry.createMany({
          data: networkAccess
            .filter((type: any) =>
              ["LOCAL", "INTERNET", "REMOTE"].includes(type)
            )
            .map((type: string) => ({
              requestId,
              accessType: type as any,
            })),
        });
      }

      // 4. Create new attachments (do NOT delete old ones unless replacing)
      if (attachments.length > 0) {
        await tx.attachment.createMany({
          data: attachments.map((att) => ({
            ...att,
            requestId,
          })),
        });
      }

      return updated;
    });

    return NextResponse.json(
      { message: "Request updated successfully", requestId: updatedRequest.id },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Edit API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update request" },
      { status: 500 }
    );
  }
}
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: requestId } = params;

    const existingRequest = await prisma.request.findUnique({
      where: {
        id: requestId,
        requesterId: session.user.id,
      },
    });

    if (!existingRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (existingRequest.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only draft requests can be deleted" },
        { status: 400 }
      );
    }

    // Delete associated relations first (or rely on CASCADE if configured)
    await prisma.$transaction([
      prisma.additionalDisk.deleteMany({ where: { requestId } }),
      prisma.firewallPort.deleteMany({ where: { requestId } }),
      prisma.networkAccessEntry.deleteMany({ where: { requestId } }),
      prisma.attachment.deleteMany({ where: { requestId } }),
      prisma.approval.deleteMany({ where: { entityId: requestId, entityType: "REQUEST" } }),
      prisma.request.delete({ where: { id: requestId } }),
    ]);

    return NextResponse.json({ message: "Request deleted successfully" });
  } catch (error: any) {
    console.error("Delete API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete request" },
      { status: 500 }
    );
  }
}
