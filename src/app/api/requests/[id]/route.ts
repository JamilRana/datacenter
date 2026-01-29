// src/app/api/requests/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { 
   
  RequestStatus,
  ServerType,
  Environment,
  LicenseProvider,
  SSLProvider,
  Raid,
  Protocol,
  NetworkAccess
} from "@prisma/client";
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

// ✅ Helper function with proper typing
function parseJsonField<T>(key: string, formData: FormData): T[] {
  const raw = formData.get(key)?.toString();
  if (!raw) return [] as T[];
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [] as T[];
  }
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
    const requestId = params.id;

    // ✅ Verify ownership and status
    const existingRequest = await prisma.request.findUnique({
      where: {
        id: requestId,
        requesterId: session.user.id,
        status: "DRAFT",
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

    // --- Parse fields ---
    const systemName = formData.get("systemName")?.toString()?.trim();
    const purpose = formData.get("purpose")?.toString()?.trim();
    const environment = formData.get("environment")?.toString() as Environment | undefined;
    const quantity = parseInt(formData.get("quantity")?.toString() || "1", 10) || 1;

    if (!systemName || !purpose || !environment) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // ✅ Parse with proper types
    interface AdditionalDiskInput {
      sizeGb: string;
      purpose: string;
    }
    
    interface FirewallPortInput {
      port: string;
      protocol: string;
      purpose: string;
      source?: string;
    }

    const additionalDisks = parseJsonField<AdditionalDiskInput>("additionalDisks", formData);
    const firewallPorts = parseJsonField<FirewallPortInput>("firewallPorts", formData);
    const networkAccess = parseJsonField<string>("networkAccess", formData);

    // --- Handle file uploads ---
    const securityFile = formData.get("securityReport") as File | null;
    const justificationFile = formData.get("justificationDoc") as File | null;

    interface AttachmentData {
      fileName: string;
      filePath: string;
      attachmentType: "SECURITY_REPORT" | "JUSTIFICATION";
      uploadedBy: string;
    }

    const attachments: AttachmentData[] = [];

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
      const safeName = `security-report-${Date.now()}${parse(securityFile.name).ext}`;
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
      const safeName = `justification-${Date.now()}${parse(justificationFile.name).ext}`;
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
          environment: environment,
          expectedEndDate: formData.get("expectedEndDate")
            ? new Date(formData.get("expectedEndDate") as string)
            : null,

          // People
          responsiblePersonName: formData.get("responsiblePersonName")?.toString() || null,
          responsiblePersonDesignation: formData.get("responsiblePersonDesignation")?.toString() || null,
          responsiblePersonOrganization: formData.get("responsiblePersonOrganization")?.toString() || null,
          responsiblePersonContact: formData.get("responsiblePersonContact")?.toString() || null,
          responsiblePersonEmail: formData.get("responsiblePersonEmail")?.toString() || null,
          alternativePersonName: formData.get("alternativePersonName")?.toString() || null,
          alternativePersonDesignation: formData.get("alternativePersonDesignation")?.toString() || null,
          alternativePersonOrganization: formData.get("alternativePersonOrganization")?.toString() || null,
          alternativePersonContact: formData.get("alternativePersonContact")?.toString() || null,
          alternativePersonEmail: formData.get("alternativePersonEmail")?.toString() || null,

          developerName: formData.get("developerName")?.toString() || null,
          developerAddress: formData.get("developerAddress")?.toString() || null,
          developerContact: formData.get("developerContact")?.toString() || null,
          developerEmail: formData.get("developerEmail")?.toString() || null,

          // Tech Stack
          frontendTech: formData.get("frontendTech")?.toString() || null,
          backendTech: formData.get("backendTech")?.toString() || null,
          serverArchitecture: formData.get("serverArchitecture")?.toString() || null,
          dataBase: formData.get("dataBase")?.toString() || null,
          additionalTechNotes: formData.get("additionalTechNotes")?.toString() || null,

          // VM Spec
          serverType: (formData.get("serverType") as ServerType) || "APPLICATION",
          vcpu: formData.get("vcpu") ? parseInt(formData.get("vcpu") as string, 10) : null,
          ramGb: formData.get("ramGb") ? parseInt(formData.get("ramGb") as string, 10) : null,
          storageGb: formData.get("storageGb") ? parseInt(formData.get("storageGb") as string, 10) : null,
          osName: formData.get("osName")?.toString() || null,
          osVersion: formData.get("osVersion")?.toString() || null,
          osLicenseBy: (formData.get("osLicenseBy") as LicenseProvider) || null,
          subdomain: formData.get("subdomain")?.toString() || null,
          sslProvider: (formData.get("sslProvider") as SSLProvider) || "MIS",
          sslCostPaidBy: formData.get("sslCostPaidBy")?.toString() || null,
          raid: (formData.get("raid") as Raid) || "NONE",

          // Network & Security
          requiredPublicIP: formData.get("requiredPublicIP") === "on",
          vpnRequired: formData.get("vpnRequired") === "on",

          // Compliance
          renewalRequired: formData.get("renewalRequired") === "on",
          renewalPeriodMonths: formData.get("renewalPeriodMonths")
            ? parseInt(formData.get("renewalPeriodMonths") as string, 10)
            : null,
          vaReportSubmitted: securityFile !== null && securityFile.size > 0,
          justificationSubmitted: justificationFile !== null && justificationFile.size > 0,
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
            .filter((d) => d.sizeGb && !isNaN(parseInt(d.sizeGb)))
            .map((d, i) => ({
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
            .filter((p) => p.port && !isNaN(parseInt(p.port)))
            .map((p) => ({
              requestId,
              port: parseInt(p.port, 10),
              protocol: (p.protocol as Protocol) || "TCP",
              purpose: p.purpose || "N/A",
              source: p.source || null,
            })),
        });
      }

      if (networkAccess.length > 0) {
        await tx.networkAccessEntry.createMany({
          data: networkAccess
            .filter((type): type is NetworkAccess => 
              ["LOCAL", "INTERNET", "REMOTE"].includes(type)
            )
            .map((type) => ({
              requestId,
              accessType: type,
            })),
        });
      }

      // 4. Create new attachments
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
  } catch (error) {
    console.error("Failed to fetch expected facilities:", error);
    return NextResponse.json(
      { error: "Failed to load facilities" },
      { status: 500 }
    );
  }
}