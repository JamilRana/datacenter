import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { ROLES } from "./roles";


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isAdmin(roles: string[] | undefined): boolean {
  if (!roles) return false;
  
  if (Array.isArray(roles)) {
    // Check for string roles: ["ADMIN", "USER"]
    if (roles.some(r => typeof r === 'string' && r === "ADMIN")) {
      return true;
    }
    
    // Check for role objects: [{ name: "ADMIN" }, ...]
    if (roles.includes(ROLES.ADMIN)) {
      return true;
    }
  }
  
  return false;
}
