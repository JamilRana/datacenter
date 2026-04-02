// src/app/actions/file-actions.ts

"use server";

import { getFileUrl } from "@/lib/services/minio.service";

export async function getAttachmentUrl(filePath: string): Promise<string> {
  // If it's already a URL, return it
  if (filePath.startsWith("http")) {
    return filePath;
  }
  
  // If it's a MinIO key, generate a presigned URL
  if (filePath.includes("/")) {
    const url = await getFileUrl(filePath, 3600); // 1 hour expiry
    return url || filePath;
  }
  
  // Fallback - return as is
  return filePath;
}

export async function getAttachmentUrls(filePaths: string[]): Promise<string[]> {
  const urls = await Promise.all(
    filePaths.map(path => getAttachmentUrl(path))
  );
  return urls;
}
