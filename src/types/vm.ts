import { Environment, Raid, VmStatus } from "@prisma/client";
import { CustomizationRequest } from "./customization";
//import { VmStatus, Environment, Raid } from "./enums";


export interface VmInstance {
  id: string;
  requestId?: string | null;
  sequenceNumber: number;
  
  ownerId?: string | null;
  owner?: { name: string | null; email: string | null } | null;
  
  environment?: Environment | null;
  hostname?: string | null;
  subdomain?: string | null;
  ipAddress?: string | null;
  publicIpAddress?: string | null;
  
  status: VmStatus;
  renewalDate?: Date | null;
  decommissionedAt?: Date | null;
  
  hasRemoteAccess: boolean;
  vpnRequired: boolean;
  
  createdAt: Date;
  updatedAt: Date;
  provisionedAt?: Date | null;
  
  // Current spec
  currentSpecId?: string | null;
  currentSpec?: VmSpec | null;
  
  // Relations
  specHistory?: VmSpec[] | null;
  customizationRequests?: CustomizationRequest[] | null;
  auditLogs?: AuditLog[] | null;
}

export interface VmSpec {
  id: string;
  vmInstanceId: string;
  vcpu: number;
  ramGb: number;
  storageGb: number;
  osName?: string | null;
  osVersion?: string | null;
  raid?: "RAID0" | "RAID1" | "RAID5" | "RAID10" | "NONE" | null;
  effectiveFrom: Date;
  createdAt: Date;
  sourceRequestId?: string | null;
  customizationRequestId?: string | null;
}

export interface VmSpecHistory extends VmSpec {
  sourceRequest?: { systemName: string } | null;
}

export interface SerializedVmInstance {
  id: string;
  systemName?: string | null;
  hostname: string | null;
  ipAddress: string | null;
  publicIpAddress: string | null;
  status: VmStatus;
  renewalDate: string | null; // ISO string
  hasRemoteAccess: boolean;
  vpnRequired: boolean;
  subdomain: string | null;
  updatedAt: string; // ISO string
  provisionedAt: string | null; // ISO string
  currentSpec: {
    vcpu: number;
    ramGb: number;
    storageGb: number;
    osName: string | null;
    osVersion: string | null;
    raid: Raid | null;
  } | null;
  owner: { id: string | null; name: string | null; email: string | null } | null;
  request: { 
    requestId: string | null; 
    systemName: string | null; 
    environment: Environment | null 
  } | null;
  tags?: { tag: { id: string; name: string; description: string | null } }[];
}

import { AuditLog } from "./audit";

// Add to @/types/vm.ts
export interface SerializedVmSpecHistory {
  id: string;
  vcpu: number;
  ramGb: number;
  storageGb: number;
  osName: string | null;
  osVersion: string | null;
  raid: Raid | null;
  effectiveFrom: string; // ISO string
  sourceRequestId: string | null;
  customizationRequestId: string | null;
}

export interface SerializedAuditLog {
  id: string;
  timestamp: string; // ISO string
  action: string;
  actorId: string;
  actor?: { name: string; email: string } | null;
  details?: Record<string, unknown> | null;
}

// Extended detail type for VM detail page
export interface SerializedVmInstanceDetail extends SerializedVmInstance {
  specHistory: SerializedVmSpecHistory[];
  auditLogs: SerializedAuditLog[];
  decommissionedAt: string | null;
  vpnRequired: boolean;
  hasRemoteAccess: boolean;
}