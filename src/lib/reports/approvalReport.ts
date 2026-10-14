// lib/reports/approvalReport.ts
import prisma from "@/lib/prisma";
import { Prisma, RequestStatus } from "@prisma/client";

export interface ApprovalReportParams {
  page?: number;
  pageSize?: number;
  getAll?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  status?: string;
  requesterId?: string;
  level?: number;
  search?: string;
  userId?: string;
  userRoles?: string[];
}

export interface ApprovalReportRow {
  id: string;
  requestId: string;
  systemName: string;
  requesterName: string;
  requesterEmail: string;
  currentLevel: number;
  status: string;
  submittedAt: Date;
  approvedAt: Date | null;
  totalApprovalTime: string | null;
  isPending: boolean;
  pendingAgeDays?: number | null;
  approverName?: string;
}

export interface ApprovalReportAnalytics {
  totalCount: number;
  byStatus: { status: string; count: number }[];
  byLevel: { level: number; count: number }[];
  avgApprovalTimeByLevel: { 
    level: number; 
    avgDays: number; 
    medianDays: number; 
    p90Days: number; 
    count: number;
  }[];
  byApproverTurnaround: {
    approverName: string;
    avgDays: number;
    medianDays: number;
    p90Days: number;
    count: number;
  }[];
  medianTurnaroundDays: number;
  p90TurnaroundDays: number;
  pendingPastThresholdCount: number;
  successRate: number;
}

export interface ApprovalReportResult {
  data: ApprovalReportRow[];
  analytics: ApprovalReportAnalytics;
  total: number;
  page: number;
  totalPages: number;
}

function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return Math.round(sorted[Math.max(0, Math.min(index, sorted.length - 1))] * 10) / 10;
}

export async function getApprovalReport(params: ApprovalReportParams): Promise<ApprovalReportResult> {
  const { 
    page = 1, 
    pageSize = 10, 
    getAll = false,
    dateFrom, 
    dateTo, 
    status, 
    requesterId,
    search,
    userId,
    userRoles 
  } = params;

  const skip = getAll ? undefined : (page - 1) * pageSize;
  const take = getAll ? undefined : pageSize;
  const isAdmin = userRoles?.some((r: any) => ["ADMIN", "DC_OPS", "APPROVER_L1", "APPROVER_L2", "APPROVER_L3", "APPROVER_L4"].includes(r.toUpperCase()));

  const where: Prisma.RequestWhereInput = {};

  // Role-based filtering
  if (!isAdmin && userId) {
    where.requesterId = userId;
  }

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = dateFrom;
    if (dateTo) where.createdAt.lte = dateTo;
  }

  if (status) where.status = status as RequestStatus;
  if (requesterId && isAdmin) where.requesterId = requesterId;
  
  if (search) {
    where.OR = [
      { systemName: { contains: search, mode: "insensitive" } },
      { requestId: { contains: search, mode: "insensitive" } },
      { requester: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [requests, total] = await Promise.all([
    prisma.request.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        requester: { select: { name: true, email: true } },
        approvals: {
          orderBy: { level: "asc" },
          include: {
            approver: { select: { name: true } }
          }
        },
      },
    }),
    prisma.request.count({ where }),
  ]);

  const analytics = await getApprovalReportAnalytics(where);

  const now = new Date();
  const data: ApprovalReportRow[] = requests.map((req: any) => {
    const approvals = req.approvals;
    const decidedApproval = approvals.find((a: any) => a.decidedAt && a.decision === "APPROVED");
    const approvedAt = decidedApproval?.decidedAt;
    const currentLevel = approvals.length > 0 ? approvals[approvals.length - 1].level : 1;
    const pendingApproval = approvals.find((a: any) => a.decision === "PENDING");
    const isPending = !approvedAt && req.status.startsWith("PENDING");

    let totalApprovalTime: string | null = null;
    let pendingAgeDays: number | null = null;

    if (approvedAt && req.createdAt) {
      // Decided approval: show actual turnaround duration
      const diff = approvedAt.getTime() - req.createdAt.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      totalApprovalTime = `${days}d ${hours}h`;
    } else if (req.createdAt) {
      // Pending approvals have no decidedAt; show age instead of duration
      const ageMs = now.getTime() - req.createdAt.getTime();
      pendingAgeDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((ageMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      totalApprovalTime = `Age: ${pendingAgeDays}d ${hours}h`;
    }

    const approverName = pendingApproval?.approver?.name || decidedApproval?.approver?.name || "TBD";

    return {
      id: req.id,
      requestId: req.requestId || req.id.slice(0, 8),
      systemName: req.systemName || "Standalone / Unassigned",
      requesterName: req.requester?.name || "Unknown",
      requesterEmail: req.requester?.email || "-",
      currentLevel,
      status: req.status,
      submittedAt: req.createdAt,
      approvedAt: approvedAt || null,
      totalApprovalTime,
      isPending,
      pendingAgeDays,
      approverName
    };
  });

  return {
    data,
    analytics,
    total,
    page,
    totalPages: Math.ceil(total / pageSize),
  };
}

async function getApprovalReportAnalytics(where: Prisma.RequestWhereInput): Promise<ApprovalReportAnalytics> {
  const [allRequests, byStatus, byLevel] = await Promise.all([
    prisma.request.findMany({
      where,
      include: {
        approvals: {
          include: {
            approver: { select: { name: true } }
          }
        }
      },
    }),
    prisma.request.groupBy({
      by: ["status"],
      _count: true,
      where,
    }),
    prisma.approval.groupBy({
      by: ["level"],
      _count: true,
      where: {
        request: where,
      },
    }),
  ]);

  const approved = allRequests.filter((r: any) => r.status === "APPROVED" || r.status === "PROVISIONED").length;
  const rejected = allRequests.filter((r: any) => r.status === "REJECTED").length;
  const successRate = (approved + rejected) > 0 ? (approved / (approved + rejected)) * 100 : 0;

  const now = new Date();
  const allTurnarounds: number[] = [];
  const levelTimes: Record<number, number[]> = {};
  const approverTimes: Record<string, number[]> = {};
  let pendingPastThresholdCount = 0; // threshold: > 3 days pending

  for (const req of allRequests) {
    const isPending = req.status.startsWith("PENDING");
    if (isPending && req.createdAt) {
      const ageDays = (now.getTime() - req.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays > 3) {
        pendingPastThresholdCount++;
      }
    }

    for (const approval of req.approvals) {
      if (approval.decidedAt && approval.createdAt) {
        const days = (approval.decidedAt.getTime() - approval.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        allTurnarounds.push(days);

        if (!levelTimes[approval.level]) levelTimes[approval.level] = [];
        levelTimes[approval.level].push(days);

        const approverName = approval.approver?.name || "Unassigned Approver";
        if (!approverTimes[approverName]) approverTimes[approverName] = [];
        approverTimes[approverName].push(days);
      }
    }
  }

  const avgApprovalTimeByLevel = Object.entries(levelTimes).map(([lvlStr, times]) => {
    const lvl = parseInt(lvlStr, 10);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    return {
      level: lvl,
      avgDays: Math.round(avg * 10) / 10,
      medianDays: calculatePercentile(times, 50),
      p90Days: calculatePercentile(times, 90),
      count: times.length
    };
  });

  const byApproverTurnaround = Object.entries(approverTimes).map(([approverName, times]) => {
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    return {
      approverName,
      avgDays: Math.round(avg * 10) / 10,
      medianDays: calculatePercentile(times, 50),
      p90Days: calculatePercentile(times, 90),
      count: times.length
    };
  });

  return {
    totalCount: allRequests.length,
    byStatus: byStatus.map((r: any) => ({ status: r.status, count: r._count })),
    byLevel: byLevel.map((r: any) => ({ level: r.level, count: r._count })),
    avgApprovalTimeByLevel,
    byApproverTurnaround,
    medianTurnaroundDays: calculatePercentile(allTurnarounds, 50),
    p90TurnaroundDays: calculatePercentile(allTurnarounds, 90),
    pendingPastThresholdCount,
    successRate: Math.round(successRate),
  };
}
