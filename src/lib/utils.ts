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
