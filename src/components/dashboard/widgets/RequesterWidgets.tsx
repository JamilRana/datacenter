"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RequesterDashboardData } from "@/types/dashboard";
import { 
  Server, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  PlusCircle, 
  RotateCcw, 
  ArrowRight,
  HardDrive,
  Cpu,
  MemoryStick,
  Layers,
  Copy,
  Sliders,
  Timer
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface RequesterWidgetsProps {
  data: RequesterDashboardData;
}

export function RequesterWidgets({ data }: RequesterWidgetsProps) {
  const { kpis, actionRequired, statusPipeline, myVms, myRecentRequests } = data;

  return (
    <div className="space-y-8">
      {/* 1. HIGH-PRIORITY ACTION REQUIRED BANNER */}
      {actionRequired.length > 0 && (
        <Card className="border-2 border-rose-300 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/30 shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
              <AlertCircle className="h-5 w-5 animate-bounce" />
              <CardTitle className="text-base font-bold uppercase tracking-wider">
                Action Required: {actionRequired.length} Request{actionRequired.length > 1 ? "s" : ""} Returned
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-rose-600/90 dark:text-rose-300">
              The following requests were returned with reviewer notes. Please review comments and resubmit.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-3">
            {actionRequired.map((item) => (
              <div 
                key={item.id}
                className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{item.systemName}</span>
                    <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-200">
                      Returned by {item.reviewerName || "Reviewer"}
                    </Badge>
                  </div>
                  <p className="text-xs text-rose-700 dark:text-rose-300 italic bg-rose-50/50 dark:bg-rose-950/30 p-2 rounded-lg">
                    &quot;{item.comments}&quot;
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Returned {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}
                  </p>
                </div>

                <Button asChild size="sm" className="bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs flex-shrink-0">
                  <Link href={`/requests/${item.id}/edit`}>
                    Edit & Resubmit <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 2. TOP KPI CARDS (6 CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Card 1: My Requests */}
        <Link href="/requests" className="group">
          <Card className="h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-md border-l-4 border-l-indigo-500 bg-white dark:bg-slate-900 cursor-pointer">
            <CardContent className="p-4 space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">My Requests</p>
              <p className="text-2xl font-black text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 transition-colors">
                {kpis.myTotalRequests}
              </p>
              <p className="text-[10px] text-slate-500">Total submitted</p>
            </CardContent>
          </Card>
        </Link>

        {/* Card 2: Pending Approval */}
        <Link href="/requests?status=PENDING" className="group">
          <Card className="h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-md border-l-4 border-l-amber-500 bg-white dark:bg-slate-900 cursor-pointer">
            <CardContent className="p-4 space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">In Review</p>
              <p className="text-2xl font-black text-slate-900 dark:text-slate-100 group-hover:text-amber-600 transition-colors">
                {kpis.myPendingApprovals}
              </p>
              <p className="text-[10px] text-slate-500">Pending approval</p>
            </CardContent>
          </Card>
        </Link>

        {/* Card 3: Action Required */}
        <Card className={`h-full transition-all duration-200 border-l-4 ${kpis.myActionRequiredCount > 0 ? "border-l-rose-500" : "border-l-slate-300"} bg-white dark:bg-slate-900`}>
          <CardContent className="p-4 space-y-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Action Req.</p>
            <p className="text-2xl font-black text-slate-900 dark:text-slate-100">
              {kpis.myActionRequiredCount}
            </p>
            <p className="text-[10px] text-slate-500">Returned requests</p>
          </CardContent>
        </Card>

        {/* Card 4: Approved */}
        <Link href="/requests?status=APPROVED" className="group">
          <Card className="h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-md border-l-4 border-l-teal-500 bg-white dark:bg-slate-900 cursor-pointer">
            <CardContent className="p-4 space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Approved</p>
              <p className="text-2xl font-black text-slate-900 dark:text-slate-100 group-hover:text-teal-600 transition-colors">
                {kpis.myApprovedAwaitingOps}
              </p>
              <p className="text-[10px] text-slate-500">Awaiting DC-Ops</p>
            </CardContent>
          </Card>
        </Link>

        {/* Card 5: Active VMs */}
        <Link href="/inventory/vms" className="group">
          <Card className="h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-md border-l-4 border-l-emerald-500 bg-white dark:bg-slate-900 cursor-pointer">
            <CardContent className="p-4 space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active VMs</p>
              <p className="text-2xl font-black text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 transition-colors">
                {kpis.myActiveVms}
              </p>
              <p className="text-[10px] text-slate-500">Allocated instances</p>
            </CardContent>
          </Card>
        </Link>

        {/* Card 6: Expiring VMs */}
        <Link href="/inventory/vms" className="group">
          <Card className="h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-md border-l-4 border-l-orange-500 bg-white dark:bg-slate-900 cursor-pointer">
            <CardContent className="p-4 space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Expiring VMs</p>
              <p className="text-2xl font-black text-slate-900 dark:text-slate-100 group-hover:text-orange-600 transition-colors">
                {kpis.myExpiringVms}
              </p>
              <p className="text-[10px] text-slate-500">Next 30 days</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* 3. REQUEST STATUS PIPELINE CHIPS */}
      <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            My Request Status Tracker
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
            <Link href="/requests?status=DRAFT" className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition-colors group">
              <span className="text-xs text-slate-400 font-bold uppercase block">Drafts</span>
              <span className="text-xl font-black text-slate-700 dark:text-slate-200 block mt-1">{statusPipeline.draft}</span>
            </Link>

            <Link href="/requests?status=PENDING" className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 hover:bg-amber-100/60 transition-colors group">
              <span className="text-xs text-amber-700 dark:text-amber-400 font-bold uppercase block">In Review</span>
              <span className="text-xl font-black text-amber-700 dark:text-amber-300 block mt-1">{statusPipeline.pendingApproval}</span>
            </Link>

            <Link href="/requests?status=DRAFT" className="p-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100/60 transition-colors group">
              <span className="text-xs text-rose-700 dark:text-rose-400 font-bold uppercase block">Returned</span>
              <span className="text-xl font-black text-rose-700 dark:text-rose-300 block mt-1">{statusPipeline.returned}</span>
            </Link>

            <Link href="/requests?status=APPROVED" className="p-3 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/50 hover:bg-teal-100/60 transition-colors group">
              <span className="text-xs text-teal-700 dark:text-teal-400 font-bold uppercase block">Approved</span>
              <span className="text-xl font-black text-teal-700 dark:text-teal-300 block mt-1">{statusPipeline.approved}</span>
            </Link>

            <Link href="/requests?status=PROVISIONED" className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-100/60 transition-colors group">
              <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold uppercase block">Provisioned</span>
              <span className="text-xl font-black text-emerald-700 dark:text-emerald-300 block mt-1">{statusPipeline.provisioned}</span>
            </Link>

            <Link href="/requests?status=REJECTED" className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition-colors group">
              <span className="text-xs text-slate-400 font-bold uppercase block">Rejected</span>
              <span className="text-xl font-black text-slate-500 block mt-1">{statusPipeline.rejected}</span>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* 4. MY VMS TABLE + MY RECENT REQUESTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My VMs Table (2 cols) */}
        <Card className="lg:col-span-2 shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Server className="h-4 w-4 text-emerald-600" /> My Allocated Virtual Machines
                </CardTitle>
                <CardDescription className="text-xs">Active server instances assigned to your division</CardDescription>
              </div>
              <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                <Link href="/inventory/vms">All VMs</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {myVms.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                <Server className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No VMs Provisioned Yet</p>
                <p className="text-xs mt-1">Submit a New VM Request to provision your first instance.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 text-xs text-slate-400 uppercase">
                      <th className="py-3 px-4 font-semibold">Hostname</th>
                      <th className="py-3 px-4 font-semibold">IP Address</th>
                      <th className="py-3 px-4 font-semibold">Specs</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Renewal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {myVms.map((vm) => (
                      <tr key={vm.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <Link href={`/inventory/vms/${vm.id}`} className="font-bold text-slate-900 dark:text-slate-100 hover:text-indigo-600 block">
                            {vm.hostname}
                          </Link>
                          <span className="text-[10px] text-slate-400 uppercase">{vm.environment || "Production"}</span>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-300">
                          {vm.ipAddress || "—"}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                          {vm.vcpu}C • {vm.ramGb}G • {vm.storageGb}G
                        </td>
                        <td className="py-3 px-4">
                          <Badge 
                            variant="outline" 
                            className={`text-[10px] ${vm.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}
                          >
                            {vm.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right text-xs">
                          {vm.daysUntilRenewal !== null ? (
                            <span className={`font-bold ${vm.daysUntilRenewal <= 30 ? "text-orange-600" : "text-slate-600"}`}>
                              {vm.daysUntilRenewal} days
                            </span>
                          ) : (
                            <span className="text-slate-400">1 Year</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Recent Requests (1 col) */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-600" /> Recent Submissions
            </CardTitle>
            <CardDescription className="text-xs">Your latest submitted requests</CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-2.5">
            {myRecentRequests.length === 0 ? (
              <p className="text-xs text-slate-400 p-6 text-center italic">No requests submitted yet</p>
            ) : (
              myRecentRequests.map((req) => (
                <Link 
                  key={req.id} 
                  href={`/requests/${req.id}`}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 text-xs transition-colors block"
                >
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-200">{req.systemName}</p>
                    <p className="text-[10px] text-slate-400">{req.requestType.replace(/_/g, " ")}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {req.status.replace(/_/g, " ")}
                  </Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* 5. REQUESTER QUICK ACTIONS */}
      <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            Quick Resource Requests
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Link 
              href="/requests/new?type=NEW_VM" 
              className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:bg-indigo-50/40 text-slate-700 dark:text-slate-300 hover:text-indigo-600 font-medium text-xs text-center transition-all group"
            >
              <PlusCircle className="h-4 w-4 text-indigo-600" />
              <span>+ New VM</span>
            </Link>

            <Link 
              href="/requests/new?type=K8S_NAMESPACE" 
              className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:bg-blue-50/40 text-slate-700 dark:text-slate-300 hover:text-blue-600 font-medium text-xs text-center transition-all group"
            >
              <Layers className="h-4 w-4 text-blue-600" />
              <span>+ K8s Namespace</span>
            </Link>

            <Link 
              href="/requests/new?type=CLONE_VM" 
              className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-purple-500 hover:bg-purple-50/40 text-slate-700 dark:text-slate-300 hover:text-purple-600 font-medium text-xs text-center transition-all group"
            >
              <Copy className="h-4 w-4 text-purple-600" />
              <span>+ Clone VM</span>
            </Link>

            <Link 
              href="/requests/customize" 
              className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-teal-500 hover:bg-teal-50/40 text-slate-700 dark:text-slate-300 hover:text-teal-600 font-medium text-xs text-center transition-all group"
            >
              <Sliders className="h-4 w-4 text-teal-600" />
              <span>+ Customization</span>
            </Link>

            <Link 
              href="/requests/new?type=RENEWAL" 
              className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 hover:bg-emerald-50/40 text-slate-700 dark:text-slate-300 hover:text-emerald-600 font-medium text-xs text-center transition-all group"
            >
              <RotateCcw className="h-4 w-4 text-emerald-600" />
              <span>+ Renewal</span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
