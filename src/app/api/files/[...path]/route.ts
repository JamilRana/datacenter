// src/app/api/files/[...path]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getFileUrl } from "@/lib/services/minio.service";
import * as fs from "fs";
import * as path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    
    // The path will be like: ["uploads", "daa88ad0-...", "filename.pdf"]
    const key = pathSegments.join("/");
    
    // Check if it's a local file path (uploads/...)
    if (key.startsWith("uploads/")) {
      // Extract the file path from the request
      const filePath = key.replace("uploads/", "");
      const localPath = path.join(process.cwd(), "uploads", filePath);
      
      // Check if file exists locally
      if (fs.existsSync(localPath)) {
        const fileBuffer = fs.readFileSync(localPath);
        const fileName = pathSegments[pathSegments.length - 1];
        const ext = path.extname(fileName).toLowerCase();
        
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
          ".txt": "text/plain",
          ".zip": "application/zip",
        };
        
        const contentType = contentTypes[ext] || "application/octet-stream";
        
        return new NextResponse(fileBuffer, {
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
          },
        });
      }
      
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }
    
    // Otherwise, try MinIO
    const url = await getFileUrl(key, 3600);
    
    if (!url) {
      return NextResponse.json(
        { error: "File not found or inaccessible" },
        { status: 404 }
      );
    }
    
    // Redirect to the presigned URL
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("Error serving file:", error);
    return NextResponse.json(
      { error: "Failed to retrieve file" },
      { status: 500 }
    );
  }
}