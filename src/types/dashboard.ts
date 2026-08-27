// src/types/dashboard.ts

// ==========================================
// 1. Common / Shared Types
// ==========================================
export type HealthStatusLevel = "healthy" | "warning" | "error";

export interface SystemHealthItem {
  name: string;
  status: HealthStatusLevel;
  latencyMs?: number;
  message?: string;
  category: "database" | "cache" | "storage" | "app" | "smtp";
}

export interface DashboardRecentActivity {
  id: string;
  type: "request" | "approval" | "vm" | "user" | "license";
  action: string;
  title: string;
  subtitle: string;
  actorName?: string;
  timestamp: Date;
  status?: string;
}

// ==========================================
// 2. Admin Dashboard Types
// ==========================================
export interface AdminKPIs {
  totalVms: {
    total: number;
    active: number;
    suspended: number;
    retired: number;
  };
  totalRequests: {
    total: number;
    thisMonth: number;
    pending: number;
  };
  pendingApprovals: {
    total: number;
    l1: number;
    l2: number;
    l3: number;
    l4: number;
  };
  pendingDcOps: number; // Approved requests waiting for provisioning
  activeUsers: {
    total: number;
    active: number;
    inactive: number;
  };
  expiringVms: {
    next30Days: number;
    next60Days: number;
    next90Days: number;
  };
  expiringLicenses: {
    next30Days: number;
    next60Days: number;
    next90Days: number;
  };
  systemAlertsCount: number;
}

export interface RequestPipelineCounts {
  draft: number;
  l1: number;
  l2: number;
  l3: number;
  l4: number;
  dcops: number; // Approved awaiting provisioning
  provisioned: number;
  closed: number;
}

export interface ResourceOverviewData {
  cpu: {
    allocated: number;
    available: number;
    total: number;
    utilizationPercent: number;
  };
  ram: {
    allocatedGb: number;
    availableGb: number;
    totalGb: number;
    utilizationPercent: number;
  };
  storage: {
    allocatedGb: number;
    availableGb: number;
    totalGb: number;
    utilizationPercent: number;
  };
}

export interface ExpiringVmItem {
  id: string;
  hostname: string;
  systemName?: string;
  ownerName?: string;
  renewalDate: Date | null;
  daysRemaining: number;
}

export interface ExpiringLicenseItem {
  id: string;
  name: string;
  vendor: string;
  expiryDate: Date | null;
  daysRemaining: number;
}

export interface StuckRequestItem {
  id: string;
  systemName: string;
  requestType: string;
  status: string;
  requesterName: string;
  createdAt: Date;
  hoursWaiting: number;
}

export interface AdminDashboardData {
  kpis: AdminKPIs;
  requestPipeline: RequestPipelineCounts;
  resourceOverview: ResourceOverviewData;
  systemHealth: SystemHealthItem[];
  expiryAndAttention: {
    expiringVms: ExpiringVmItem[];
    expiringLicenses: ExpiringLicenseItem[];
    stuckRequests: StuckRequestItem[];
  };
  recentActivities: DashboardRecentActivity[];
}

// ==========================================
// 3. DC_OPS Dashboard Types
// ==========================================
export interface DcopsKPIs {
  pendingProvisioning: number;
  provisioningToday: number;
  activeVms: number;
  availableCpu: number;
  availableRamGb: number;
  availableStorageGb: number;
  expiringVms30Days: number;
  openOperations: number;
}

export interface ExecutionQueueItem {
  id: string;
  requestId: string | null;
  systemName: string;
  requestType: string;
  totalVms: number;
  provisionedVms: number;
  approvedAt: Date | null;
  hoursWaiting: number;
  priority: "HIGH" | "NORMAL" | "LOW";
  requesterName: string;
  environment: string;
  vcpu?: number;
  ramGb?: number;
  storageGb?: number;
}

export interface MultiVmProgressItem {
  requestId: string;
  systemName: string;
  totalVms: number;
  completedVms: number;
  vmDetails: Array<{
    sequence: number;
    hostname: string | null;
    ipAddress: string | null;
    status: "PROVISIONED" | "PENDING";
  }>;
}

export interface ResourceCapacityGauges {
  cpu: {
    allocated: number;
    total: number;
    available: number;
    utilizationPercent: number;
  };
  ram: {
    allocatedGb: number;
    totalGb: number;
    availableGb: number;
    utilizationPercent: number;
  };
  storage: {
    allocatedGb: number;
    totalGb: number;
    availableGb: number;
    utilizationPercent: number;
  };
  isOverAllocated: boolean;
  totalHostsCount: number;
  activeHostsCount: number;
}

export interface OperationalAlertItem {
  id: string;
  level: "critical" | "warning" | "info";
  title: string;
  description: string;
  timestamp: Date;
  actionHref?: string;
}

export interface DcopsDashboardData {
  kpis: DcopsKPIs;
  executionQueue: ExecutionQueueItem[];
  multiVmProgress: MultiVmProgressItem[];
  resourceCapacity: ResourceCapacityGauges;
  operationalAlerts: OperationalAlertItem[];
  recentActivities: DashboardRecentActivity[];
}

// ==========================================
// 4. Approver Dashboard Types
// ==========================================
export interface ApproverKPIs {
  pendingMyApproval: number;
  agingRequestsCount: number; // > 48h
  returnedToRequester: number;
  recentlyApprovedThisMonth: number;
}

export interface DecisionQueueItem {
  id: string;
  approvalId: string;
  systemName: string;
  requestType: string;
  level: number;
  requesterName: string;
  requesterEmail: string;
  requesterOrg?: string | null;
  environment: string;
  createdAt: Date;
  hoursWaiting: number;
  resourcesSummary: {
    vcpu?: number | null;
    ramGb?: number | null;
    storageGb?: number | null;
    vmCount?: number;
    accessType?: string | null;
  };
}

export interface ReturnedQueueItem {
  id: string;
  systemName: string;
  requesterName: string;
  returnedAt: Date;
  comments: string | null;
}

export interface ApproverHistoryItem {
  id: string;
  systemName: string;
  requestType: string;
  decision: "APPROVED" | "REJECTED" | "RETURNED" | "FORWARDED";
  level: number;
  decidedAt: Date | null;
  comments: string | null;
}

export interface ApproverDashboardData {
  kpis: ApproverKPIs;
  decisionQueue: DecisionQueueItem[];
  agingApprovals: DecisionQueueItem[];
  returnedQueue: ReturnedQueueItem[];
  myRecentDecisions: ApproverHistoryItem[];
}

// ==========================================
// 5. Requester Dashboard Types
// ==========================================
export interface RequesterKPIs {
  myTotalRequests: number;
  myPendingApprovals: number;
  myActionRequiredCount: number;
  myApprovedAwaitingOps: number;
  myActiveVms: number;
  myExpiringVms: number;
}

export interface ActionRequiredItem {
  id: string;
  systemName: string;
  requestType: string;
  status: string; // RETURNED / DRAFT with comments
  reviewerName?: string | null;
  reviewerRole?: string | null;
  comments: string;
  updatedAt: Date;
}

export interface RequesterPipelineCounts {
  draft: number;
  pendingApproval: number;
  returned: number;
  approved: number;
  provisioned: number;
  rejected: number;
}

export interface RequesterVmItem {
  id: string;
  hostname: string | null;
  ipAddress: string | null;
  environment: string | null;
  status: string;
  vcpu: number;
  ramGb: number;
  storageGb: number;
  renewalDate: Date | null;
  daysUntilRenewal: number | null;
}

export interface RequesterRecentRequestItem {
  id: string;
  systemName: string;
  requestType: string;
  status: string;
  createdAt: Date;
}

export interface RequesterDashboardData {
  kpis: RequesterKPIs;
  actionRequired: ActionRequiredItem[];
  statusPipeline: RequesterPipelineCounts;
  myVms: RequesterVmItem[];
  myRecentRequests: RequesterRecentRequestItem[];
}
