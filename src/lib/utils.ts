import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { ROLES } from "./roles";


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isAdmin(roles: string[] | undefined): boolean {
  if (!roles) return false;
  
    return roles.some(r => 
      r === "ADMIN" || 
      r === ROLES.ADMIN || 
      r === "DC_OPS" || 
      r === ROLES.DCOPS
    );
  
  return false;
}
