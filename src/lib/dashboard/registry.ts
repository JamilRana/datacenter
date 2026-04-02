// src/lib/dashboard/registry.ts
import { ROLES } from "@/lib/roles";

export function getPrimaryRole(userRoles: string[]): "ADMIN" | "DCOPS" | "REQUESTER" {
  if (userRoles.includes(ROLES.ADMIN)) return "ADMIN";
  if (userRoles.includes(ROLES.DCOPS)) return "DCOPS";
  return "REQUESTER";
}

export function getRoleLabel(role: "ADMIN" | "DCOPS" | "REQUESTER"): string {
  switch (role) {
    case "ADMIN":
      return "Administrator";
    case "DCOPS":
      return "Data Center Operations";
    case "REQUESTER":
      return "Requester";
    default:
      return "User";
  }
}
