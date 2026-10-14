// src/types/reports.ts
import { RequestStatus, RequestType, VmStatus, Environment } from "@prisma/client";

export interface UserAllocationSummary {
  userId: string;
  name: string;
  email?: string;
  designation: string;
  organization: string;
  systemsCount: number;
  totalVms: number;
  namespacesCount: number;
  vcpuAllocated: number;
  ramAllocatedGb: number;
  storageAllocatedGb: number;
  activeVms: number;
  suspendedVms: number;
  lastActivity: string;
}

export interface UserAllocationReportResult {
  data: UserAllocationSummary[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    totalUsers: number;
    totalActiveVms: number;
    totalVcpu: number;
    totalRamGb: number;
    totalStorageGb: number;
  };
}

export interface UserVmDetail {
  id: string;
  hostname: string;
  ipAddress: string;
  systemName: string;
  environment: Environment;
  vcpu: number;
  ramGb: number;
  storageGb: number;
  os: string;
  cluster: string;
  status: VmStatus;
  renewalDate: string;
  requestId: string;
  specMissing?: boolean;
}

export interface UserNamespaceDetail {
  id: string;
  name: string;
  supervisorIp: string;
  clusterName: string;
  totalNodes: number;
  vcpu: number;
  ramGb: number;
  storageGb: number;
  systemName: string;
  nodeGroups?: {
    name: string;
    nodeCount: number;
    vcpu: number;
    ramGb: number;
    storageGb: number;
  }[];
  createdAt: string;
}

export interface UserResourceDetailsResult {
  vms: UserVmDetail[];
  namespaces: UserNamespaceDetail[];
}

export interface VmInventoryItem {
  id: string;
  hostname: string;
  ipAddress: string;
  system: string;
  project: string;
  environment: Environment;
  status: VmStatus;
  owner: string;
  ownerEmail?: string;
  vcpu: number;
  ramGb: number;
  storageGb: number;
  hostAsset: string;
  cluster: string;
  provisionedDate: string;
  renewalDate: string;
  requestId: string;
  specMissing?: boolean;
}

export interface DcCapacityItem {
  clusterId: string;
  clusterName: string;
  hostCount: number;
  totalVcpu: number;
  usedVcpu: number;
  freeVcpu: number;
  cpuUtilPercent: number;
  totalRamGb: number;
  usedRamGb: number;
  freeRamGb: number;
  ramUtilPercent: number;
  totalStorageGb: number;
  usedStorageGb: number;
  freeStorageGb: number;
  storageUtilPercent: number;
  isOverAllocated: boolean;
  overAllocationWarning?: string;
  isUnassignedLine?: boolean;
  unassignedVmCount?: number;
  lastSynced: string;
  assetId?: string;
}

export interface RequestDashboardItem {
  id: string;
  requestId: string;
  type: RequestType;
  system: string;
  project: string;
  requester: string;
  requesterEmail?: string;
  environment: Environment;
  status: RequestStatus;
  currentLevel: string;
  currentApprover: string;
  submittedAt: string;
  provisionedAt?: string | null;
  turnaround: string;
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

export interface K8sNodeGroupDetail {
  role: string;
  nodeCount: number;
  vcpu: number;
  ramGb: number;
  storageGb: number;
}

export interface K8sNamespaceReportItem {
  id: string;
  name: string;
  supervisorIp: string;
  clusterName: string;
  clusters: string[];
  systemName?: string;
  project: string;
  owner: string;
  requester: string;
  environment: string;
  nodeGroups: K8sNodeGroupDetail[];
  subdomainsByStatus: { status: string; count: number }[];
  subdomainsSummary: string;
  totalNodes: number;
  totalVcpu: number;
  totalRamGb: number;
  totalStorageGb: number;
  status: string;
  createdAt: string;
}

export interface VpnHorizonTargetVm {
  id: string;
  hostname: string;
  ipAddress: string;
  systemName: string;
  environment: string;
  status: string;
  accessTypes: ("VPN" | "Horizon")[];
  assignedAt: string;
  expiresAt?: string | null;
  isLegacy: boolean;
  assignedBy?: string;
  notes?: string | null;
}

export interface VpnHorizonTargetNamespace {
  id: string;
  name: string;
  supervisorIp: string;
  systemName: string;
  clusterName: string;
  accessTypes: ("VPN" | "Horizon")[];
  assignedAt: string;
  expiresAt?: string | null;
  assignedBy?: string;
  notes?: string | null;
}

export interface VpnHorizonUserReportItem {
  id: string;
  personName: string;
  email?: string | null;
  portalUserId?: string | null;
  vpnAccount?: {
    username: string;
    fullName: string;
    vpnProfile: string;
    vpnIp: string;
    status: string;
  } | null;
  horizonAccount?: {
    username: string;
    fullName: string;
    email?: string | null;
    status: string;
  } | null;
  assignedVms: VpnHorizonTargetVm[];
  assignedNamespaces: VpnHorizonTargetNamespace[];
  totalVmsCount: number;
  totalNamespacesCount: number;
  hasVpn: boolean;
  hasHorizon: boolean;
  hasLegacy: boolean;
  status: string;
  lastAssignedAt?: string | null;
}

export interface VpnHorizonReportItem {
  id: string;
  userName: string;
  userEmail?: string;
  accessType: string;
  status: string;
  assignedTarget: string;
  assignedTargetType: "VM" | "NAMESPACE" | "LEGACY";
  assignedBy: string;
  assignedAt: string;
  expiresAt: string | null;
  systemName?: string;
  projectName?: string;
  targetVmName?: string | null;
  targetVmIp?: string | null;
  createdAt: string;
  provisionedAt?: string | null;
}

export interface SoftwareLicenseReportItem {
  id: string;
  name: string;
  vendor: string;
  type: string;
  expiryDate: string | null;
  maintenanceExpiry: string | null;
  daysRemaining: number | null;
  expiryStatus: "EXPIRED" | "EXPIRING_30D" | "EXPIRING_90D" | "ACTIVE" | "PERPETUAL";
  notes?: string | null;
  assignedAssets: Array<{
    id: string;
    name: string;
    type: string;
    serial?: string | null;
  }>;
  assetsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LicenseReportSummary {
  totalLicenses: number;
  expiredCount: number;
  expiringIn30Days: number;
  expiringIn90Days: number;
  activeCount: number;
  perpetualCount: number;
  totalVendors: number;
  totalTypes: number;
}

export interface SystemVmDetail {
  id: string;
  hostname: string;
  ipAddress: string;
  environment: string;
  status: string;
  vcpu: number;
  ramGb: number;
  storageGb: number;
  ownerName: string;
  hostAsset?: string | null;
  renewalDate?: string | null;
}

export interface SystemRequestDetail {
  id: string;
  displayId: string;
  type: string;
  status: string;
  environment: string;
  requesterName: string;
  requesterEmail?: string | null;
  submittedAt: string;
  vmsCount: number;
}

export interface SystemNamespaceDetail {
  id: string;
  name: string;
  supervisorIp: string;
  clusterName: string;
  clusters: string[];
  totalNodes: number;
  totalVcpu: number;
  totalRamGb: number;
  totalStorageGb: number;
  requester: string;
  status: string;
  createdAt: string;
}

export interface SystemAccessUserDetail {
  id: string;
  personName: string;
  email?: string | null;
  accessTypes: ("VPN" | "Horizon")[];
  targetType: "VM" | "NAMESPACE" | "BOTH";
  targetNames: string[];
  status: string;
  lastAssignedAt?: string | null;
}

export interface SystemReportItem {
  id: string; // normalized system key
  systemName: string; // clean display name
  environments: string[];
  totalVmsCount: number;
  totalRequestsCount: number;
  totalNamespacesCount: number;
  totalAccessUsersCount: number;
  totalVcpu: number;
  totalRamGb: number;
  totalStorageGb: number;
  vms: SystemVmDetail[];
  requests: SystemRequestDetail[];
  namespaces: SystemNamespaceDetail[];
  accessUsers: SystemAccessUserDetail[];
}

export interface SystemReportSummary {
  totalSystems: number;
  totalVms: number;
  totalRequests: number;
  totalNamespaces: number;
  totalAccessUsers: number;
  totalVcpu: number;
  totalRamGb: number;
  totalStorageGb: number;
}

export type ReportType = 
  | 'user-allocation' 
  | 'vm-inventory' 
  | 'dc-capacity' 
  | 'requests' 
  | 'renewals' 
  | 'audit-trail'
  | 'k8s-namespaces'
  | 'licenses'
  | 'systems';