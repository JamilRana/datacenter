// src/lib/dashboard/registry.ts
import { ROLES } from "@/lib/roles";

export type DashboardRole = "ADMIN" | "DCOPS" | "APPROVER" | "REQUESTER";

export function getPrimaryRole(userRoles: string[]): DashboardRole {
  if (userRoles.includes(ROLES.ADMIN)) return "ADMIN";
  if (userRoles.includes(ROLES.DCOPS)) return "DCOPS";
  if (
    userRoles.includes(ROLES.L1_APPROVER) || 
    userRoles.includes(ROLES.L2_APPROVER) || 
    userRoles.includes(ROLES.L3_APPROVER) || 
    userRoles.includes(ROLES.L4_APPROVER) ||
    userRoles.some(r => r.startsWith("APPROVER_"))
  ) {
    return "APPROVER";
  }
  return "REQUESTER";
}

export function getRoleLabel(role: DashboardRole): string {
  switch (role) {
    case "ADMIN":
      return "Administrator";
    case "DCOPS":
      return "Data Center Operations";
    case "APPROVER":
      return "Approver Authority";
    case "REQUESTER":
      return "Requester";
    default:
      return "User";
  }
}
