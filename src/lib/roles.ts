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

export function getUserActionableLevels(userRoles: string[] | undefined): number[] {
  if (!userRoles || !Array.isArray(userRoles)) return [];
  const levels = new Set<number>();
  
  if (userRoles.includes("APPROVER_L1") || userRoles.includes("L1_APPROVER")) levels.add(1);
  if (userRoles.includes("APPROVER_L2") || userRoles.includes("L2_APPROVER")) levels.add(2);
  if (userRoles.includes("APPROVER_L3") || userRoles.includes("L3_APPROVER")) levels.add(3);
  if (userRoles.includes("APPROVER_L4") || userRoles.includes("L4_APPROVER")) levels.add(4);
  
  // If user has specific approver level(s) assigned, those are strictly their actionable levels
  if (levels.size > 0) {
    return Array.from(levels);
  }
  
  // Only pure admin (without specific approver tiers assigned) can act on any level
  if (userRoles.includes(ROLES.ADMIN)) {
    return [1, 2, 3, 4];
  }
  
  return [];
}

export function canUserApprove(userRoles: string[] | undefined, level: string | number): boolean {
  if (!userRoles || !Array.isArray(userRoles)) return false;
  const levelStr = String(level).toUpperCase();
  if (levelStr === "DCOPS" || levelStr === "DC_OPS") {
    return hasRole(userRoles, ROLES.DCOPS) || (hasRole(userRoles, ROLES.ADMIN) && getUserActionableLevels(userRoles).length === 4);
  }
  
  const cleanLevel = typeof level === "number" ? level : parseInt(levelStr.replace("L", ""), 10);
  if (isNaN(cleanLevel)) return false;
  
  const actionableLevels = getUserActionableLevels(userRoles);
  return actionableLevels.includes(cleanLevel);
}

export async function canUserApproveAtLevel(userRoles: string[] | undefined, level: number, _requestType?: string): Promise<boolean> {
  return canUserApprove(userRoles, level);
}
