// lib/reports/approvalReport.ts
import prisma from "@/lib/prisma";
import { Prisma, RequestStatus } from "@prisma/client";

export interface ApprovalReportParams {
  page?: number;
  pageSize?: number;
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
}

export interface ApprovalReportAnalytics {
  totalCount: number;
  byStatus: { status: string; count: number }[];
  byLevel: { level: number; count: number }[];
  avgApprovalTimeByLevel: { level: number; avgDays: number }[];
  successRate: number;
}

export interface ApprovalReportResult {
  data: ApprovalReportRow[];
  analytics: ApprovalReportAnalytics;
  total: number;
  page: number;
  totalPages: number;
}

export async function getApprovalReport(params: ApprovalReportParams): Promise<ApprovalReportResult> {
  const { 
    page = 1, 
    pageSize = 10, 
    dateFrom, 
    dateTo, 
    status, 
    requesterId,
    search,
    userId,
    userRoles 
  } = params;

  const skip = (page - 1) * pageSize;
  const isAdmin = userRoles?.some(r => ["ADMIN", "DC_OPS", "APPROVER_L1", "APPROVER_L2", "APPROVER_L3", "APPROVER_L4"].includes(r.toUpperCase()));

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
    ];
  }

  const [requests, total] = await Promise.all([
    prisma.request.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        requester: { select: { name: true, email: true } },
        approvals: {
          orderBy: { level: "asc" },
          select: { level: true, decision: true, decidedAt: true },
        },
      },
    }),
    prisma.request.count({ where }),
  ]);

  const analytics = await getApprovalReportAnalytics(where);

  const data: ApprovalReportRow[] = requests.map(req => {
    const approvals = req.approvals;
    const approvedAt = approvals.find(a => a.decidedAt && a.decision === "APPROVED")?.decidedAt;
    const currentLevel = approvals.length > 0 ? approvals[approvals.length - 1].level : 1;
    
    let totalApprovalTime: string | null = null;
    if (approvedAt && req.createdAt) {
      const diff = approvedAt.getTime() - req.createdAt.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      totalApprovalTime = `${days}d ${hours}h`;
    }

    return {
      id: req.id,
      requestId: req.requestId || req.id.slice(0, 8),
      systemName: req.systemName,
      requesterName: req.requester?.name || "Unknown",
      requesterEmail: req.requester?.email || "-",
      currentLevel,
      status: req.status,
      submittedAt: req.createdAt,
      approvedAt: approvedAt || null,
      totalApprovalTime,
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

async function getApprovalReportAnalytics(where: Prisma.RequestWhereInput) {
  const [allRequests, byStatus, byLevel] = await Promise.all([
    prisma.request.findMany({
      where,
      include: { approvals: true },
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

  const approved = allRequests.filter(r => r.status === "APPROVED" || r.status === "PROVISIONED").length;
  const rejected = allRequests.filter(r => r.status === "REJECTED").length;
  const successRate = (approved + rejected) > 0 ? (approved / (approved + rejected)) * 100 : 0;

  const levelApprovalTimes: Record<number, number[]> = {};
  for (const req of allRequests) {
    for (const approval of req.approvals) {
      if (approval.decidedAt) {
        if (!levelApprovalTimes[approval.level]) levelApprovalTimes[approval.level] = [];
        const days = (approval.decidedAt.getTime() - req.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        levelApprovalTimes[approval.level].push(days);
      }
    }
  }

  const avgApprovalTimeByLevel = Object.entries(levelApprovalTimes).map(([level, times]) => ({
    level: parseInt(level),
    avgDays: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
  }));

  return {
    totalCount: allRequests.length,
    byStatus: byStatus.map(r => ({ status: r.status, count: r._count })),
    byLevel: byLevel.map(r => ({ level: r.level, count: r._count })),
    avgApprovalTimeByLevel,
    successRate,
  };
}
