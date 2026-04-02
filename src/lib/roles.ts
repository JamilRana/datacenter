// src/lib/roles.ts
// import { getWorkflowConfig } from "./workflow";

export const ROLES = {
  DEVELOPER: "DEVELOPER",
  L1_APPROVER: "APPROVER_L1",
  L2_APPROVER: "APPROVER_L2",
  L3_APPROVER: "APPROVER_L3",
  L4_APPROVER: "APPROVER_L4",
  DCOPS: "DC_OPS",
  REQUESTER: "REQUESTER",
  ADMIN: "ADMIN",
} as const;

export type Role = keyof typeof ROLES;

export const MANAGEMENT_ROLES = [
  ROLES.ADMIN,
  ROLES.DCOPS,
  ROLES.L1_APPROVER,
  ROLES.L2_APPROVER,
  ROLES.L3_APPROVER,
  ROLES.L4_APPROVER,
] as const;

export function isManagementRole(userRoles: string[] | undefined): boolean {
  if (!userRoles || !Array.isArray(userRoles) || userRoles.length === 0) return false;
  const roleStrings = userRoles.map(r => String(r).toUpperCase());
  return MANAGEMENT_ROLES.some(role => roleStrings.includes(role.toUpperCase()));
}

export function canManageInventory(userRoles: string[] | undefined): boolean {
  if (!userRoles || !Array.isArray(userRoles) || userRoles.length === 0) return false;
  const roleStrings = userRoles.map(r => String(r).toUpperCase());
  return roleStrings.includes("ADMIN") || roleStrings.includes("DC_OPS");
}

export function hasRole(userRoles: string[] | undefined, targetRole: string) {
  if (!userRoles || !Array.isArray(userRoles)) return false;
  return userRoles.includes(targetRole);
}

export async function canUserApproveAtLevel(userRoles: string[] | undefined, level: number, _requestType?: string): Promise<boolean> {
  if (!userRoles) return false;
  if (hasRole(userRoles, ROLES.ADMIN)) return true;
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void _requestType;
  
  // Simplified check - fallback to role-based lookup
  if (level === 1 && hasRole(userRoles, ROLES.L1_APPROVER)) return true;
  if (level === 2 && hasRole(userRoles, ROLES.L2_APPROVER)) return true;
  if (level === 3 && hasRole(userRoles, ROLES.L3_APPROVER)) return true;
  if (level === 4 && hasRole(userRoles, ROLES.L4_APPROVER)) return true;
  return false;
}

export function canUserApprove(userRoles: string[] | undefined, level: string): boolean {
  if (!userRoles) return false;
  if (hasRole(userRoles, ROLES.ADMIN)) return true;
  if (level === "L1" && hasRole(userRoles, ROLES.L1_APPROVER)) return true;
  if (level === "L2" && hasRole(userRoles, ROLES.L2_APPROVER)) return true;
  if (level === "L3" && hasRole(userRoles, ROLES.L3_APPROVER)) return true;
  if (level === "L4" && hasRole(userRoles, ROLES.L4_APPROVER)) return true;
  if (level === "DCOPS" && hasRole(userRoles, ROLES.DCOPS)) return true;
  return false;
}
