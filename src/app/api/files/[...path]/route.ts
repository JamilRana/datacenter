// src/app/api/files/[...path]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getFileUrl, getMinioClient, minioBucket } from "@/lib/services/minio.service";
import * as fs from "fs";
import * as path from "path";

const contentTypes: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".zip": "application/zip",
  ".tar": "application/x-tar",
  ".gz": "application/gzip",
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    // 1. Enforce authentication for file access
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const { path: pathSegments } = await context.params;
    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json({ error: "File path missing" }, { status: 400 });
    }

    // 2. Prevent path traversal and hidden file access
    if (pathSegments.some((seg) => seg.includes("..") || seg.includes("\\") || seg.startsWith("."))) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const key = pathSegments.join("/");
    const fileName = pathSegments[pathSegments.length - 1];
    const ext = path.extname(fileName).toLowerCase();
    const contentType = contentTypes[ext] || "application/octet-stream";

    const urlObj = new URL(request.url);
    const isDownload = urlObj.searchParams.get("download") === "1" || urlObj.searchParams.get("download") === "true";
    const dispositionType = isDownload ? "attachment" : "inline";
    const disposition = `${dispositionType}; filename="${encodeURIComponent(fileName)}"`;

    // 3. Try resolving locally ONLY within strictly permitted upload directories
    const cleanKey = key.replace(/^uploads\//, "");
    const allowedBaseDirs = [
      path.resolve(process.cwd(), "uploads"),
      path.resolve(process.cwd(), "public", "uploads"),
    ];

    for (const baseDir of allowedBaseDirs) {
      const resolvedPath = path.resolve(baseDir, cleanKey);
      if (resolvedPath.startsWith(baseDir) && fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
        const fileBuffer = fs.readFileSync(resolvedPath);
        return new NextResponse(fileBuffer, {
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": disposition,
            "Content-Length": String(fileBuffer.length),
            "Cache-Control": "private, no-cache, no-store, must-revalidate",
          },
        });
      }
    }

    // 4. Try streaming directly from MinIO
    try {
      const client = getMinioClient();
      const minioKey = cleanKey;
      
      const targetKeys = [key, minioKey];
      for (const k of targetKeys) {
        try {
          const stream = await client.getObject(minioBucket, k);
          const chunks: Buffer[] = [];
          for await (const chunk of stream) {
            chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
          }
          const fileBuffer = Buffer.concat(chunks);
          return new NextResponse(fileBuffer, {
            headers: {
              "Content-Type": contentType,
              "Content-Disposition": disposition,
              "Content-Length": String(fileBuffer.length),
              "Cache-Control": "private, no-cache, no-store, must-revalidate",
            },
          });
        } catch (_) {
          // Continue to next key or fallback
        }
      }
    } catch (minioErr) {
      console.warn("MinIO getObject failed:", minioErr);
    }

    // 5. Fallback to presigned URL redirect if stream failed
    const url = await getFileUrl(key, 3600) || await getFileUrl(cleanKey, 3600);
    if (url) {
      return NextResponse.redirect(url);
    }

    return NextResponse.json(
      { error: "File not found or inaccessible" },
      { status: 404 }
    );
  } catch (error) {
    console.error("Error serving file:", error);
    return NextResponse.json(
      { error: "Failed to retrieve file" },
      { status: 500 }
    );
  }
}