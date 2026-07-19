// Consolidated enums - ONE definition per enum
export enum RequestType {
  NEW_VM = "NEW_VM",
  CLONE_VM = "CLONE_VM",
  K8S_NAMESPACE = "K8S_NAMESPACE",
  CUSTOMIZED = "CUSTOMIZED",
  RENEWAL = "RENEWAL",
  DECOMMISSION = "DECOMMISSION",
  VPN_ACCESS = "VPN_ACCESS",
  HORIZON_ACCESS = "HORIZON_ACCESS",
}

export enum RequestStatus {
  DRAFT = "DRAFT",
  PENDING_L1 = "PENDING_L1",
  PENDING_L2 = "PENDING_L2",
  PENDING_L3 = "PENDING_L3",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  PROVISIONED = "PROVISIONED",
  CLOSED = "CLOSED",
}

export enum CustomizationStatus {
  DRAFT = "DRAFT",
  PENDING_L1 = "PENDING_L1",
  PENDING_L2 = "PENDING_L2",
  PENDING_L3 = "PENDING_L3",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  APPLIED = "APPLIED",
}

export enum Environment {
  DEVELOPMENT = "DEVELOPMENT",
  STAGING = "STAGING",
  PRODUCTION = "PRODUCTION",
  TESTING = "TESTING",
}

export enum VmStatus {
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  RETIRED = "RETIRED",
}

export enum ApprovalDecision {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  RETURNED = "RETURNED",
}

export enum ApprovalLevel {
  L1 = "L1",
  L2 = "L2",
  L3 = "L3",
}

export enum ApprovalEntityType {
  REQUEST = "REQUEST",
  CUSTOMIZATION = "CUSTOMIZATION",
}

export enum Raid {
  RAID0 = "RAID0",
  RAID1 = "RAID1",
  RAID5 = "RAID5",
  RAID10 = "RAID10",
  NONE = "NONE",
}

export enum Protocol {
  TCP = "TCP",
  UDP = "UDP",
  OTHER = "OTHER",
}

export enum ServerType {
  APPLICATION = "APPLICATION",
  MAIL = "MAIL",
  DATABASE = "DATABASE",
  FTP = "FTP",
  OTHER = "OTHER",
}

export enum LicenseProvider {
  REQUESTER = "REQUESTER",
  PARTNER = "PARTNER",
  OPEN_SOURCE = "OPEN_SOURCE",
}

export enum SSLProvider {
  REQUESTER = "REQUESTER",
  MIS = "MIS",
}

export enum NetworkAccess {
  LOCAL = "LOCAL",
  INTERNET = "INTERNET",
  REMOTE = "REMOTE",
}

export enum AssetType {
  SERVER = "SERVER",
  ROUTER = "ROUTER",
  SWITCH = "SWITCH",
  FIREWALL = "FIREWALL",
  STORAGE = "STORAGE",
  UPS = "UPS",
  CONSOLE_SERVER = "CONSOLE_SERVER",
  OTHER = "OTHER",
}

export enum AttachmentType {
  SECURITY_REPORT = "SECURITY_REPORT",
  JUSTIFICATION = "JUSTIFICATION",
}

export enum UserRole {
  ADMIN = "ADMIN",
  REQUESTER = "REQUESTER",
  DCOPS = "DCOPS",
  APPROVER_L1 = "APPROVER_L1",
  APPROVER_L2 = "APPROVER_L2",
  APPROVER_L3 = "APPROVER_L3",
}

export enum AccessType {
  VPN = "VPN",
  HORIZON = "HORIZON",
}

export enum K8sNodeRole {
  MASTER = "MASTER",
  WORKER = "WORKER",
}