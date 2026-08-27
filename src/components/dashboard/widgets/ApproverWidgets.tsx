"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApproverDashboardData } from "@/types/dashboard";
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  RotateCcw, 
  ShieldCheck, 
  ArrowRight,
  User,
  Server,
  FileText,
  Building,
  Check,
  X,
  ArrowUpRight
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ApproverWidgetsProps {
  data: ApproverDashboardData;
}

export function ApproverWidgets({ data }: ApproverWidgetsProps) {
  const { kpis, decisionQueue, agingApprovals, returnedQueue, myRecentDecisions } = data;

  return (
    <div className="space-y-8">
      {/* 1. TOP KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Pending My Approval */}
        <Link href="/approvals" className="group">
          <Card className="h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-md border-l-4 border-l-amber-500 bg-white dark:bg-slate-900 cursor-pointer">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending My Approval</p>
                <p className="text-3xl font-black text-slate-900 dark:text-slate-100 group-hover:text-amber-600 transition-colors">
                  {kpis.pendingMyApproval}
                </p>
                <p className="text-[11px] text-slate-500 font-medium">Requests requiring your decision</p>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-amber-600">
                <Clock className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Card 2: Aging Approvals (>48h) */}
        <Card className={`h-full transition-all duration-200 border-l-4 ${kpis.agingRequestsCount > 0 ? "border-l-rose-500" : "border-l-slate-300"} bg-white dark:bg-slate-900`}>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Aging Approvals</p>
              <p className="text-3xl font-black text-slate-900 dark:text-slate-100">
                {kpis.agingRequestsCount}
              </p>
              <p className="text-[11px] text-slate-500 font-medium">Waiting over 48 hours for review</p>
            </div>
            <div className={`p-3 rounded-xl ${kpis.agingRequestsCount > 0 ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600" : "bg-slate-50 text-slate-400"}`}>
              <AlertTriangle className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Returned to Requester */}
        <Card className="h-full transition-all duration-200 border-l-4 border-l-orange-500 bg-white dark:bg-slate-900">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Returned for Revision</p>
              <p className="text-3xl font-black text-slate-900 dark:text-slate-100">
                {kpis.returnedToRequester}
              </p>
              <p className="text-[11px] text-slate-500 font-medium">Awaiting requester amendments</p>
            </div>
            <div className="p-3 bg-orange-50 dark:bg-orange-950/40 rounded-xl text-orange-600">
              <RotateCcw className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Recently Approved */}
        <Card className="h-full transition-all duration-200 border-l-4 border-l-emerald-500 bg-white dark:bg-slate-900">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Approved This Month</p>
              <p className="text-3xl font-black text-slate-900 dark:text-slate-100">
                {kpis.recentlyApprovedThisMonth}
              </p>
              <p className="text-[11px] text-slate-500 font-medium">Approved by your authority</p>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. PRIMARY COMPONENT: DECISION QUEUE */}
      <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-amber-600" /> Pending Decision Queue
              </CardTitle>
              <CardDescription className="text-xs">Incoming requests assigned to your approval authority level</CardDescription>
            </div>
            <Badge variant="secondary" className="bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 font-bold">
              {decisionQueue.length} Pending Actions
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {decisionQueue.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="font-bold text-slate-700 dark:text-slate-300">Decision Queue Clear</p>
              <p className="text-xs mt-1">You have reviewed all pending requests at your authority level!</p>
            </div>
          ) : (
            decisionQueue.map((item) => (
              <div 
                key={item.id}
                className={`p-4 rounded-xl border transition-all ${
                  item.hoursWaiting >= 48 
                    ? "bg-rose-50/30 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/60" 
                    : "bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 hover:border-indigo-300"
                }`}
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs font-bold bg-indigo-50 text-indigo-700 border-indigo-200">
                        Level {item.level} Approval
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {item.requestType.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-xs text-slate-400 font-mono">ID: {item.id.slice(0, 8)}</span>
                      {item.hoursWaiting >= 48 && (
                        <Badge variant="destructive" className="text-[10px] animate-pulse">
                          Waiting {item.hoursWaiting}h
                        </Badge>
                      )}
                    </div>

                    <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">{item.systemName}</h3>

                    <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        {item.requesterName}
                      </span>
                      {item.requesterOrg && (
                        <span className="flex items-center gap-1">
                          <Building className="h-3.5 w-3.5 text-slate-400" />
                          {item.requesterOrg}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        Submitted {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                      </span>
                    </div>

                    {/* Resources Snapshot */}
                    <div className="flex items-center gap-2 pt-1 text-xs">
                      {item.resourcesSummary.vcpu && (
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-medium">
                          {item.resourcesSummary.vcpu} vCPU
                        </span>
                      )}
                      {item.resourcesSummary.ramGb && (
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-medium">
                          {item.resourcesSummary.ramGb} GB RAM
                        </span>
                      )}
                      {item.resourcesSummary.storageGb && (
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-medium">
                          {item.resourcesSummary.storageGb} GB Disk
                        </span>
                      )}
                      {item.resourcesSummary.accessType && (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">
                          {item.resourcesSummary.accessType} Access
                        </span>
                      )}
                      {item.resourcesSummary.vmCount && item.resourcesSummary.vmCount > 1 && (
                        <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-medium">
                          {item.resourcesSummary.vmCount} Instances
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    <Button asChild className="bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs h-9">
                      <Link href={`/approvals/${item.id}?type=request`}>
                        Review & Decide <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* 3. AGING / RETURNED + MY RECENT DECISIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Returned to Requester Queue */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-orange-600" /> Returned for Amendments
            </CardTitle>
            <CardDescription className="text-xs">Requests returned to requesters awaiting their revisions</CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-2.5">
            {returnedQueue.length === 0 ? (
              <p className="text-xs text-slate-400 p-6 text-center italic">No requests currently in revision</p>
            ) : (
              returnedQueue.map((item) => (
                <div key={item.id} className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs space-y-1">
                  <div className="flex justify-between items-center">
                    <p className="font-bold text-slate-900 dark:text-slate-100">{item.systemName}</p>
                    <span className="text-[10px] text-slate-400">
                      {formatDistanceToNow(new Date(item.returnedAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">Requester: {item.requesterName}</p>
                  {item.comments && (
                    <p className="text-[11px] text-orange-700 dark:text-orange-300 italic bg-orange-50/50 dark:bg-orange-950/30 p-1.5 rounded">
                      &quot;{item.comments}&quot;
                    </p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* My Recent Decisions */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> My Recent Approval Decisions
            </CardTitle>
            <CardDescription className="text-xs">Your recent sign-offs and reviews</CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-2.5">
            {myRecentDecisions.length === 0 ? (
              <p className="text-xs text-slate-400 p-6 text-center italic">No decisions logged yet</p>
            ) : (
              myRecentDecisions.map((dec) => (
                <div key={dec.id} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 text-xs">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-slate-100">{dec.systemName}</p>
                    <p className="text-[10px] text-slate-400">Level {dec.level} • {dec.requestType.replace(/_/g, " ")}</p>
                  </div>
                  <div className="text-right">
                    <Badge 
                      className={`text-[10px] ${
                        dec.decision === "APPROVED" 
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40" 
                          : dec.decision === "REJECTED"
                          ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40"
                          : "bg-orange-50 text-orange-700 dark:bg-orange-950/40"
                      }`}
                    >
                      {dec.decision}
                    </Badge>
                    {dec.decidedAt && (
                      <span className="block text-[9px] text-slate-400 mt-0.5">
                        {formatDistanceToNow(new Date(dec.decidedAt), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
