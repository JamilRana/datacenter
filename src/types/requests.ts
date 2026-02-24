//types/requests.ts
import { Approval } from "./approvals";
import { CustomizationRequest } from "./customization";
// import {
//   RequestType,
//   RequestStatus,
//   Environment,
//   ServerType,
//   LicenseProvider,
//   SSLProvider,
//   Raid,
//   NetworkAccess,
//   Protocol,
//   CustomizationStatus,
// } from "./enums";

import {
  RequestType,
  RequestStatus,
  Environment,
  ServerType,
  LicenseProvider,
  SSLProvider,
  Raid,
  NetworkAccess,
  Protocol,
  CustomizationStatus,
} from "@prisma/client";

import { VmInstance } from "./vm";

// Person interfaces (reusable)
export interface Person {
  name: string;
  designation: string;
  organization: string;
  contact: string;
  email: string;
  address?: string | null;
}

// Sub-entity types
export interface AdditionalDisk {
  sizeGb: number;
  purpose?: string;
  sequence: number;
}

export interface FirewallPort {
  port: number;
  protocol: Protocol;
  purpose: string;
  source?: string;
}

export interface NetworkAccessEntry {
  accessType: NetworkAccess;
}

// Attachment interface
export interface Attachment {
  id: string;
  fileName: string;
  filePath: string;
  attachmentType: "SECURITY_REPORT" | "JUSTIFICATION";
  uploadedBy: string;
  createdAt: Date;
  user?: { id: string; name: string; email: string } | null;
}

// Main request interface
export interface detailsRequest {
  id: string;
  requestType: RequestType;
  status: RequestStatus;
  quantity: number;
  requestId?: string | null;
  projectName?: string | null;
  systemName: string;
  purpose: string;
  environment: Environment;
  expectedEndDate?: Date | null;

  requesterId: string;
  requester: Person;

  alternativePerson: Person | null;
  developer: Person | null;
  developerId?: string | null;

  // VM Spec
  serverType: ServerType;
  vcpu?: number | null;
  ramGb?: number | null;
  osName?: string | null;
  osVersion?: string | null;
  osLicenseBy?: LicenseProvider | null;
  storageGb?: number | null;
  subdomain?: string | null;
  sslProvider?: SSLProvider | null;
  sslCostPaidBy?: string | null;
  raid?: Raid | null;
  retentionPeriod?: string | null;
  requiredPublicIP: boolean;
  vpnRequired: boolean;

  // Compliance
  vaReportSubmitted: boolean;
  justificationSubmitted: boolean;
  renewalRequired: boolean;
  renewalPeriodMonths?: number | null;

  // Timestamps
  createdAt: Date;
  submittedAt?: Date | null;
  updatedAt: Date;
  provisionedAt?: Date | null;

  // Tech Stack
  frontendTech?: string | null;
  backendTech?: string | null;
  serverArchitecture?: string | null;
  dataBase?: string | null;
  additionalTechNotes?: string | null;

  // Relations
  vmInstances: VmInstance[] | null;
  approvals: Approval[] | null;
  customizations: CustomizationRequest[] | null;
  additionalDisks: AdditionalDisk[] | null;
  firewallPorts: FirewallPort[] | null;
  networkAccess: NetworkAccessEntry[] | null;
  attachments: Attachment[] | null;
  targetVm?: VmInstance | null;
}

export interface Request {
  id: string;
  requestType: RequestType;
  status: RequestStatus;
  quantity: number;
  requestId?: string | null;
  projectName?: string | null;
  systemName: string;
  purpose: string;
  environment: Environment;
  expectedEndDate?: Date | null;

  requesterId: string;
  requester: Requester | null;

  alternativePerson: Person | null;
  developer: Person | null;

  developerId?: string | null;
  requiresL4Approval?: boolean;

  // VM Spec
  serverType: ServerType;
  vcpu?: number | null;
  ramGb?: number | null;
  osName?: string | null;
  osVersion?: string | null;
  osLicenseBy?: LicenseProvider | null;
  storageGb?: number | null;
  subdomain?: string | null;
  sslProvider?: SSLProvider | null;
  sslCostPaidBy?: string | null;
  raid?: Raid | null;
  retentionPeriod?: string | null;
  requiredPublicIP: boolean;
  vpnRequired: boolean;

  // Compliance
  vaReportSubmitted: boolean;
  justificationSubmitted: boolean;
  renewalRequired: boolean;
  renewalPeriodMonths?: number | null;

  // Timestamps
  createdAt: Date;
  submittedAt?: Date | null;
  updatedAt: Date;
  provisionedAt?: Date | null;

  // Tech Stack
  frontendTech?: string | null;
  backendTech?: string | null;
  serverArchitecture?: string | null;
  dataBase?: string | null;
  additionalTechNotes?: string | null;

  // Relations
  approvals: Approval[];
  additionalDisks: AdditionalDisk[];
  firewallPorts: FirewallPort[];
  networkAccess: NetworkAccessEntry[];
}

export interface Requester {
  id: string;
  name: string;
  email: string;
  designation?: string | null;
}

export interface RequestListItem extends Pick<Request, 
  "id" | "systemName" | "projectName" | "status" | "environment" | "createdAt"> {
  requester: Pick<Requester, "name"> | null;
  vmCount: number;
}

// Helper functions
export const canEdit = (status: RequestStatus |CustomizationStatus | string) => status === RequestStatus.DRAFT;
export const canSubmit = (status: RequestStatus |CustomizationStatus | string) => status === RequestStatus.DRAFT;
