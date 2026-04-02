// lib/services/role.service.ts

export enum UserRole {
  DEVELOPER = "DEVELOPER",
  L1_APPROVER = "APPROVER_L1",
  L2_APPROVER = "APPROVER_L2",
  L3_APPROVER = "APPROVER_L3",
  L4_APPROVER = "APPROVER_L4",
  DCOPS = "DC_OPS",
  REQUESTER = "REQUESTER",
  ADMIN = "ADMIN",
}

export const MANAGEMENT_ROLES = [
  UserRole.ADMIN,
  UserRole.DCOPS,
  UserRole.L1_APPROVER,
  UserRole.L2_APPROVER,
  UserRole.L3_APPROVER,
  UserRole.L4_APPROVER,
];

export type UserRoles = string[] | undefined;

export class RoleService {
  static hasRole(userRoles: UserRoles, targetRole: UserRole | string): boolean {
    if (!userRoles || !Array.isArray(userRoles)) return false;
    return userRoles.includes(targetRole);
  }

  static hasAnyRole(userRoles: UserRoles, targetRoles: string[]): boolean {
    if (!userRoles || !Array.isArray(userRoles)) return false;
    return targetRoles.some(role => userRoles.includes(role));
  }

  static hasAllRoles(userRoles: UserRoles, targetRoles: string[]): boolean {
    if (!userRoles || !Array.isArray(userRoles)) return false;
    return targetRoles.every(role => userRoles.includes(role));
  }

  static isManagement(userRoles: UserRoles): boolean {
    if (!userRoles || !Array.isArray(userRoles) || userRoles.length === 0) return false;
    const roleStrings = userRoles.map((r) => String(r).toUpperCase());
    return MANAGEMENT_ROLES.some((role) => roleStrings.includes(role.toUpperCase()));
  }

  static isAdmin(userRoles: UserRoles): boolean {
    return this.hasRole(userRoles, UserRole.ADMIN);
  }

  static isDCOps(userRoles: UserRoles): boolean {
    return this.hasRole(userRoles, UserRole.DCOPS);
  }

  static isRequester(userRoles: UserRoles): boolean {
    return this.hasRole(userRoles, UserRole.REQUESTER);
  }

  static isDeveloper(userRoles: UserRoles): boolean {
    return this.hasRole(userRoles, UserRole.DEVELOPER);
  }

  static canManageInventory(userRoles: UserRoles): boolean {
    if (!userRoles || !Array.isArray(userRoles) || userRoles.length === 0) return false;
    const roleStrings = userRoles.map((r) => String(r).toUpperCase());
    return roleStrings.includes(UserRole.ADMIN) || roleStrings.includes(UserRole.DCOPS);
  }

  static canApproveAtLevel(userRoles: UserRoles, level: number | string): boolean {
    if (!userRoles) return false;
    if (this.hasRole(userRoles, UserRole.ADMIN)) return true;

    const levelStr = String(level).toUpperCase();

    if ((level === 1 || levelStr === "L1") && this.hasRole(userRoles, UserRole.L1_APPROVER)) return true;
    if ((level === 2 || levelStr === "L2") && this.hasRole(userRoles, UserRole.L2_APPROVER)) return true;
    if ((level === 3 || levelStr === "L3") && this.hasRole(userRoles, UserRole.L3_APPROVER)) return true;
    if ((level === 4 || levelStr === "L4") && this.hasRole(userRoles, UserRole.L4_APPROVER)) return true;
    if (levelStr === "DCOPS" && this.hasRole(userRoles, UserRole.DCOPS)) return true;

    return false;
  }

  static canExecute(userRoles: UserRoles): boolean {
    return this.hasAnyRole(userRoles, [UserRole.ADMIN, UserRole.DCOPS]);
  }

  static canViewReports(userRoles: UserRoles): boolean {
    return this.hasAnyRole(userRoles, [UserRole.ADMIN, UserRole.DCOPS]);
  }

  static canAccessAdmin(userRoles: UserRoles): boolean {
    return this.isAdmin(userRoles);
  }

  static getApprovalLevel(userRoles: UserRoles): number | null {
    if (this.hasRole(userRoles, UserRole.L4_APPROVER)) return 4;
    if (this.hasRole(userRoles, UserRole.L3_APPROVER)) return 3;
    if (this.hasRole(userRoles, UserRole.L2_APPROVER)) return 2;
    if (this.hasRole(userRoles, UserRole.L1_APPROVER)) return 1;
    return null;
  }

  static getRoleLabel(role: string): string {
    const labels: Record<string, string> = {
      [UserRole.ADMIN]: "Administrator",
      [UserRole.DCOPS]: "DC Operations",
      [UserRole.L1_APPROVER]: "L1 Approver",
      [UserRole.L2_APPROVER]: "L2 Approver",
      [UserRole.L3_APPROVER]: "L3 Approver",
      [UserRole.L4_APPROVER]: "L4 Approver",
      [UserRole.REQUESTER]: "Requester",
      [UserRole.DEVELOPER]: "Developer",
    };
    return labels[role] || role;
  }
}
