// src/lib/roles.ts
export const ROLES = {
  L1_APPROVER: "APPROVER_L1",
  L2_APPROVER: "APPROVER_L2",
  L3_APPROVER: "APPROVER_L3",
  DCOPS: "DCOPS",
  REQUESTER: "REQUESTER",
  ADMIN: "ADMIN",
} as const;

export type Role = keyof typeof ROLES;

export const APPROVAL_FLOWS = {
  NEW_VM: ["L1", "L2", "L3", "DCOPS"],
  CUSTOMIZED: ["L1", "L2", "L3", "DCOPS"],
  DECOMMISSION: ["L1", "DCOPS"],
} as const;

export function hasRole(userRoles: string[], targetRole: string) {
  return userRoles.includes(targetRole);
}

export function canUserApprove(userRoles: string[], level: string) {
  if (hasRole(userRoles, ROLES.ADMIN)) return true;
  if (level === "L1" && hasRole(userRoles, ROLES.L1_APPROVER)) return true;
  if (level === "L2" && hasRole(userRoles, ROLES.L2_APPROVER)) return true;
  if (level === "L3" && hasRole(userRoles, ROLES.L3_APPROVER)) return true;
  if (level === "DCOPS" && hasRole(userRoles, ROLES.DCOPS)) return true;
  return false;
}
