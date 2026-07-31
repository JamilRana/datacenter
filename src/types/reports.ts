// src/types/reports.ts
import { RequestStatus, RequestType, VmStatus, Environment } from "@prisma/client";

export interface UserAllocationSummary {
  userId: string;
  name: string;
  designation: string;
  organization: string;
  totalVms: number;
  vcpuAllocated: number;
  ramAllocatedGb: number;
  storageAllocatedGb: number;
  activeVms: number;
  suspendedVms: number;
  lastActivity: string;
}

export interface UserVmDetail {
  id: string;
  hostname: string;
  ipAddress: string;
  environment: Environment;
  vcpu: number;
  ramGb: number;
  storageGb: number;
  os: string;
  cluster: string;
  status: VmStatus;
  renewalDate: string;
  requestId: string;
}

export interface VmInventoryItem {
  id: string;
  hostname: string;
  owner: string;
  project: string;
  environment: Environment;
  vcpu: number;
  ramGb: number;
  storageGb: number;
  cluster: string;
  status: VmStatus;
  provisionedDate: string;
  renewalDate: string;
  requestId: string;
}

export interface DcCapacityItem {
  assetId: string;
  clusterName: string;
  totalVcpu: number;
  usedVcpu: number;
  freeVcpu: number;
  totalRamGb: number;
  usedRamGb: number;
  freeRamGb: number;
  totalStorageGb: number;
  usedStorageGb: number;
  freeStorageGb: number;
  lastSynced: string;
}

export interface RequestDashboardItem {
  id: string;
  requestId: string;
  type: RequestType;
  requester: string;
  project: string;
  environment: Environment;
  status: RequestStatus;
  currentApprover: string;
  submittedAt: string;
  updatedAt: string;
  agingDays: number;
}

export interface RenewalItem {
  id: string;
  vmName: string;
  ownerName: string;
  project: string;
  environment: Environment;
  renewalDate: string;
  daysRemaining: number;
  status: VmStatus;
  lastRenewed: string;
}

export interface AuditTrailItem {
  id: string;
  timestamp: string;
  actor: string;
  role: string | string[];
  action: string;
  entityType: string;
  entityId: string;
  ipAddress: string;
  details: {
    before?: unknown;
    after?: unknown;
  } | null;
}

export interface K8sNamespaceReportItem {
  id: string;
  name: string;
  supervisorIp: string;
  clusterName: string;
  project: string;
  owner: string;
  environment: string;
  totalNodes: number;
  totalVcpu: number;
  totalRamGb: number;
  status: string;
  createdAt: string;
}

export type ReportType = 
  | 'user-allocation' 
  | 'vm-inventory' 
  | 'dc-capacity' 
  | 'requests' 
  | 'renewals' 
  | 'audit-trail'
  | 'k8s-namespaces';