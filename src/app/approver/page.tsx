// src/app/approver/dashboards/page.tsx

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import Link from "next/link";

import { notFound } from "next/navigation";
import {
  ApprovalLevel,
  ApprovalEntityType,
  ApprovalDecision,
  RequestStatus,
  Prisma,
} from "@prisma/client";
import { SearchBar } from "@/components/SearchBar";
import { Pagination } from "@/components/Pagination";
import ApprovalItem from "./ApprovalItem";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Clock, Inbox } from "lucide-react";

const ITEMS_PER_PAGE = 20;

type ApprovalDecisionType = "PENDING" | "APPROVED" | "REJECTED" | "RETURNED";

const LEVEL_TITLES: Record<ApprovalLevel, string> = {
  L1: "Level 1",
  L2: "Level 2",
  L3: "Level 3",
};

const LEVEL_TO_STATUS: Record<ApprovalLevel, RequestStatus> = {
  L1: RequestStatus.PENDING_L1,
  L2: RequestStatus.PENDING_L2,
  L3: RequestStatus.PENDING_L3,
};

// Server Component
export default async function UnifiedApproverInbox({
  searchParams,
}: {
  searchParams: { 
    filter?: string; 
    page?: string; 
    search?: string 
  };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return notFound();

  const approverRoles = await prisma.userRole.findMany({
    where: {
      userId: session.user.id,
      role: { name: { startsWith: "APPROVER_" } },
    },
    select: { role: { select: { name: true } } },
  });

  if (approverRoles.length === 0) return notFound();

  const levels = approverRoles
    .map(ur => ur.role.name.replace("APPROVER_", "") as ApprovalLevel)
    .filter(level => ["L1", "L2", "L3"].includes(level));

  const filter = (searchParams.filter as ApprovalDecisionType | "ALL") || "PENDING";
  const searchTerm = (searchParams.search || "").trim();
  const currentPage = Math.max(1, parseInt(searchParams.page || "1", 10));
  const skip = (currentPage - 1) * ITEMS_PER_PAGE;

  const baseWhere: any = {
    approverId: session.user.id,
    level: { in: levels },
    entityType: ApprovalEntityType.REQUEST,
  };

  if (filter !== "ALL") {
    baseWhere.decision = filter;
  }

  let requestWhere: any = {};
  if (searchTerm) {
    requestWhere = {
      OR: [
        { systemName: { contains: searchTerm, mode: "insensitive" } },
        { projectName: { contains: searchTerm, mode: "insensitive" } },
        { requester: { name: { contains: searchTerm, mode: "insensitive" } } },
        { requester: { email: { contains: searchTerm, mode: "insensitive" } } },
      ],
    };
  }

  let approvals = [];
  let totalCount = 0;

  if (filter === "PENDING") {
    const rawApprovals = await prisma.approval.findMany({
      where: {
        ...baseWhere,
        decision: "PENDING",
        request: requestWhere,
      },
      include: {
        request: {
          select: {
            id: true,
            systemName: true,
            projectName: true,
            environment: true,
            submittedAt: true,
            status: true,
            requester: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const validApprovals = rawApprovals.filter(approval => {
      if (!approval.request) return false;
      return approval.request.status === LEVEL_TO_STATUS[approval.level];
    });

    totalCount = validApprovals.length;
    approvals = validApprovals.slice(skip, skip + ITEMS_PER_PAGE);
  } else {
    totalCount = await prisma.approval.count({
      where: {
        ...baseWhere,
        request: requestWhere,
      },
    });

    approvals = await prisma.approval.findMany({
      where: {
        ...baseWhere,
        request: requestWhere,
      },
      include: {
        request: {
          select: {
            id: true,
            systemName: true,
            projectName: true,
            environment: true,
            submittedAt: true,
            status: true,
            requester: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: ITEMS_PER_PAGE,
    });
  }

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const pendingCount = filter === "PENDING" 
    ? totalCount 
    : await (async () => {
        const raw = await prisma.approval.findMany({
          where: {
            approverId: session.user.id,
            level: { in: levels },
            entityType: ApprovalEntityType.REQUEST,
            decision: "PENDING",
          },
          include: { request: { select: { status: true } } },
        });
        return raw.filter(a =>
          a.request && a.request.status === LEVEL_TO_STATUS[a.level]
        ).length;
      })();

  const stats = [
    { title: "Pending My Action", value: pendingCount, icon: Inbox, color: "text-blue-600", bg: "bg-blue-50" },
    { 
      title: "Approved by Me", 
      value: await prisma.approval.count({ where: { approverId: session.user.id, decision: "APPROVED" } }), 
      icon: CheckCircle, 
      color: "text-green-600",
      bg: "bg-green-50"
    },
    { 
      title: "Rejected by Me", 
      value: await prisma.approval.count({ where: { approverId: session.user.id, decision: "REJECTED" } }), 
      icon: XCircle, 
      color: "text-red-600",
      bg: "bg-red-50"
    },
  ];

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Approvals Inbox</h1>
        <p className="text-slate-500 mt-1">Review and manage VM provisioning requests awaiting your decision.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-none shadow-sm bg-white overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">{stat.title}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-wrap gap-2">
            {([
              { key: "PENDING", label: `Pending (${pendingCount})`, color: "blue" },
              { key: "APPROVED", label: "Approved", color: "green" },
              { key: "REJECTED", label: "Rejected", color: "red" },
              { key: "RETURNED", label: "Returned", color: "yellow" },
              { key: "ALL", label: "All", color: "gray" },
            ] as const).map(({ key, label, color }) => (
              <Link
                key={key}
                href={`?filter=${key}${searchTerm ? `&search=${searchTerm}` : ""}`}
                className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
                  filter === key
                    ? `bg-${color}-100 text-${color}-700 border border-${color}-200`
                    : "text-slate-600 hover:bg-slate-100 border border-transparent"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
          <div className="w-full md:w-64">
            <SearchBar />
          </div>
        </div>

        <div className="space-y-4">
          {approvals.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed rounded-xl">
              <Inbox className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">
                No {filter === "ALL" ? "" : `${filter.toLowerCase()} `}requests found.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {approvals.map((approval) => {
                  if (!approval.request) return null;
                  return (
                    <ApprovalItem
                      key={approval.id}
                      approval={approval}
                      levelTitle={LEVEL_TITLES[approval.level]}
                      isPending={filter === "PENDING"}
                    />
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="pt-6 border-t mt-6">
                  <Pagination totalPages={totalPages} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
