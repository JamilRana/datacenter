// src/types/reports.ts
import { Environment, RequestType, RequestStatus } from "@prisma/client";

// ✅ Clean filter interface for API calls
export interface ReportFilters {
  startDate?: string;      // ISO date string: "2024-01-01"
  endDate?: string;        // ISO date string: "2024-12-31"
  environment?: Environment;
  status?: RequestStatus;
  requestType?: RequestType;
  userId?: string;
}

// ✅ Flattened, serializable types for API responses (no Prisma internals)
export interface EnvDistributionItem {
  environment: Environment;
  count: number;
  percentage: number;  // 0-100
}

export interface TypeDistributionItem {
  type: RequestType;
  count: number;
  percentage: number;
}

export interface StatusDistributionItem {
  status: RequestStatus;
  count: number;
  percentage: number;
}

export interface TrendDataPoint {
  day: string;           // ISO date: "2024-01-15"
  new: number;           // New requests created
  approved: number;      // Requests approved
  provisioned: number;   // VMs provisioned
}

export interface TopRequesterItem {
  userId: string;
  name: string | null;
  email: string | null;
  department: string | null;  // from User.organization
  requestCount: number;
  avgApprovalTimeHours: number;
}

export interface DepartmentBreakdownItem {
  department: string;
  requestCount: number;
  budgetUsed: number;  // Estimated cost
  percentage: number;
}

export interface ResourceMetricItem {
  environment: Environment | null;
  avgCpu: number;      // Average vCPU
  avgRam: number;      // Average GB RAM
  avgStorage: number;  // Average GB storage
  growthRate: number;  // Percentage growth
}

export interface ApprovalFunnelItem {
  stage: string;              // "DRAFT", "PENDING_L1", etc.
  count: number;
  conversionRate: number;     // Percentage from previous stage
}

// ✅ Main report data interface - clean and API-ready
export interface SystemReportData {
  summary: {
    totalVMs: number;
    activeRequests: number;
    pendingApprovals: number;
    avgApprovalTimeHours: number;
    totalLicenses: number;
    resourceUtilization: number;  // 0-100 percentage
  };
  envDistribution: EnvDistributionItem[];
  typeDistribution: TypeDistributionItem[];
  statusDistribution: StatusDistributionItem[];
  trends: TrendDataPoint[];
  topRequesters: TopRequesterItem[];
  departmentBreakdown: DepartmentBreakdownItem[];
  resourceMetrics: ResourceMetricItem[];
  approvalFunnel: ApprovalFunnelItem[];
  timestamp: string;  // ISO string
}

// ✅ For export data rows
export interface ExportReportRow {
  RequestID: string;
  SystemName: string;
  ProjectName: string;
  RequestType: RequestType;
  Status: RequestStatus;
  Environment: Environment;
  Requester: string;
  Email: string;
  Department: string;
  CreatedDate: string;      // Formatted: "yyyy-MM-dd HH:mm"
  ApprovedDate: string;     // "yyyy-MM-dd" or "Pending"
  ProvisionedDate: string;  // "yyyy-MM-dd" or "N/A"
  vCPU: number | null;
  RAM_GB: number | null;
  Storage_GB: number | null;
  ApprovalLevel: string;
  ApprovalDecision: string;
}