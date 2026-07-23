import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isAdmin(roles: string[] | undefined): boolean {
  if (!roles) return false;
  
  const roleArray = Array.isArray(roles) ? roles : [];
  if (roleArray.length === 0) return false;
  
  const roleStrings = roleArray.map(r => String(r).toUpperCase().trim());
  
  return roleStrings.some(r => 
    r === "ADMIN" || 
    r === "DC_OPS" ||
    r === "APPROVER_L1" ||
    r === "APPROVER_L2" ||
    r === "APPROVER_L3" ||
    r === "APPROVER_L4"
  );
}

export function getAppUrl(): string {
  const url = process.env.APP_URL || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  let cleaned = url.trim().replace(/\/$/, "");
  if (cleaned.endsWith(":80")) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  return cleaned;
}
