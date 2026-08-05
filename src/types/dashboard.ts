export interface AdminDashboardStats {
  totalVms: number;
  totalUsers: number;
  pendingApprovals: number;
  totalCpuCores: number;
  totalRamGb: number;
}

export interface MonthlyRequestTrend {
  month: string;
  requests: number;
  approvals: number;
  rejections: number;
}

export interface ApprovalDistribution {
  status: string;
  count: number;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actorId: string;
  entityType: string | null;
  entityId: string | null;
  timestamp: Date;
  actor?: {
    name: string;
    email: string;
  };
}

export interface DashboardRecentActivity {
  id: string;
  type: "request" | "vm" | "approval" | "inventory";
  title: string;
  subtitle: string;
  timestamp: string | Date;
  status?: string;
}

export interface DashboardHealthCard {
  title: string;
  status: "healthy" | "warning" | "critical";
  value: string | number;
  description: string;
}

export interface AdminDashboardData {
  stats: AdminDashboardStats;
  monthlyTrends: MonthlyRequestTrend[];
  approvalDistribution: ApprovalDistribution[];
  recentAuditLogs: AuditLogEntry[];
  infrastructureOverview: {
    totalClusters: number;
    totalK8sClusters: number;
    totalVms: number;
    runningVms: number;
    stoppedVms: number;
    totalAssets: number;
  };
  resourceSummary: {
    cpuUsed: number;
    cpuTotal: number;
    cpuPercent: number;
    ramUsedGb: number;
    ramTotalGb: number;
    ramPercent: number;
    storageUsedGb: number;
    storageTotalGb: number;
    storagePercent: number;
    gpuUsed?: number;
    gpuTotal?: number;
    gpuPercent?: number;
  };
  requestsSummary: {
    pending: number;
    approved: number;
    rejected: number;
    inProgress: number;
  };
  recentActivities: DashboardRecentActivity[];
  healthStatus: DashboardHealthCard[];
}
