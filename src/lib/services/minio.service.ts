// src/lib/services/minio.service.ts

import { Client } from "minio";

const minioEndpoint = process.env.MINIO_ENDPOINT || "localhost";
const minioPort = parseInt(process.env.MINIO_PORT || "9000");
const minioAccessKey = process.env.MINIO_ACCESS_KEY || "minioadmin";
const minioSecretKey = process.env.MINIO_SECRET_KEY || "minioadmin";
const minioBucket = process.env.MINIO_BUCKET || "datacenter";
const minioUseSSL = process.env.MINIO_USE_SSL === "true";

let minioClient: Client | null = null;

export function getMinioClient(): Client {
  if (!minioClient) {
    minioClient = new Client({
      endPoint: minioEndpoint,
      port: minioPort,
      useSSL: minioUseSSL,
      accessKey: minioAccessKey,
      secretKey: minioSecretKey,
    });
  }
  return minioClient;
}

export async function ensureBucketExists(bucketName: string = minioBucket): Promise<void> {
  const client = getMinioClient();
  const exists = await client.bucketExists(bucketName);
  if (!exists) {
    await client.makeBucket(bucketName);
  }
}

export interface UploadResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}

export async function uploadFile(
  file: Buffer,
  fileName: string,
  folder: string = "attachments",
  contentType: string = "application/octet-stream"
): Promise<UploadResult> {
  try {
    const client = getMinioClient();
    const bucket = minioBucket;
    
    // Ensure bucket exists
    await ensureBucketExists(bucket);
    
    // Generate unique key
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const key = `${folder}/${timestamp}-${sanitizedFileName}`;
    
    // Upload file
    await client.putObject(bucket, key, file, file.length, {
      ContentType: contentType,
    });
    
    // Generate presigned URL for download (valid for 7 days)
    const url = await client.presignedGetObject(bucket, key, 60 * 60 * 24 * 7);
    
    return {
      success: true,
      url,
      key,
    };
  } catch (error) {
    console.error("MinIO upload error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

export async function uploadBuffer(
  buffer: Buffer,
  originalFileName: string,
  folder: string = "attachments"
): Promise<UploadResult> {
  // Determine content type based on file extension
  const ext = originalFileName.split(".").pop()?.toLowerCase() || "";
  const contentType = getContentType(ext);
  
  return uploadFile(buffer, originalFileName, folder, contentType);
}

export async function deleteFile(key: string): Promise<boolean> {
  try {
    const client = getMinioClient();
    await client.removeObject(minioBucket, key);
    return true;
  } catch (error) {
    console.error("MinIO delete error:", error);
    return false;
  }
}

export async function getFileUrl(key: string, expiresIn: number = 3600): Promise<string | null> {
  try {
    const client = getMinioClient();
    return await client.presignedGetObject(minioBucket, key, expiresIn);
  } catch (error) {
    console.error("MinIO URL generation error:", error);
    return null;
  }
}

export async function listFiles(prefix: string = "") {
  try {
    const client = getMinioClient();
    const objects: unknown[] = [];
    const stream = client.listObjects(minioBucket, prefix, true);
    
    return new Promise((resolve, reject) => {
      stream.on("data", (obj) => objects.push(obj));
      stream.on("error", reject);
      stream.on("end", () => resolve(objects));
    });
  } catch (error) {
    console.error("MinIO list error:", error);
    return [];
  }
}

function getContentType(ext: string): string {
  const contentTypes: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    txt: "text/plain",
    zip: "application/zip",
    rar: "application/x-rar-compressed",
  };
  
  return contentTypes[ext] || "application/octet-stream";
}

export { minioBucket };
