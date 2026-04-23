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

export interface AdminDashboardData {
  stats: AdminDashboardStats;
  monthlyTrends: MonthlyRequestTrend[];
  approvalDistribution: ApprovalDistribution[];
  recentAuditLogs: AuditLogEntry[];
}
