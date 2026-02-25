// src/app/page.tsx
"use client";

import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Server, FileText, Clock, AlertTriangle, ArrowRight, PlusCircle, 
  Activity, Cpu, HardDrive, Database, CheckCircle2, 
  Loader2, Zap, User, Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSession } from "next-auth/react";
import { getHomeDashboardData, HomeDashboardData } from "./actions/home-actions";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

function DashboardSkeleton() {
  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-96" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-none shadow-sm">
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
            <CardContent className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                  <Skeleton className="h-10 w-10 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card className="bg-slate-900"><CardContent className="p-6 space-y-4">
            <Skeleton className="h-6 w-32 bg-slate-700" />
            <Skeleton className="h-10 w-full bg-slate-700" />
            <Skeleton className="h-10 w-full bg-slate-700" />
          </CardContent></Card>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { data: session, status } = useSession();
  const [data, setData] = useState<HomeDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      redirect("/auth");
      return;
    }

    const fetchData = async () => {
      try {
        const res = await getHomeDashboardData();
        setData(res);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [session, status]);

  if (status === "loading" || loading) {
    return <DashboardSkeleton />;
  }

  if (!session) {
    redirect("/auth");
    return null;
  }

  const roleContext = data?.roleContext || "REQUESTER";

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Command Center
          </h1>
          <p className="text-slate-500 mt-1">
            Welcome back, <span className="font-medium text-slate-700">{session.user.name}</span>
            <Badge variant="outline" className="ml-2 text-xs">
              {roleContext}
            </Badge>
          </p>
        </div>
        {(roleContext === "REQUESTER" || roleContext === "DEVELOPER") && (
          <Link href="/requests/new">
            <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100">
              <PlusCircle className="h-4 w-4 mr-2" /> New Request
            </Button>
          </Link>
        )}
      </header>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Active VMs"
          value={data?.activeVmCount || 0}
          subtitle={`${data?.decommissionedVmCount || 0} decommissioned`}
          icon={<Server className="h-5 w-5" />}
          color="indigo"
        />
        <MetricCard
          title="Pending Approvals"
          value={data?.pendingCount || 0}
          subtitle="Awaiting review"
          icon={<Clock className="h-5 w-5" />}
          color="amber"
        />
        <MetricCard
          title="Infrastructure Health"
          value="98%"
          subtitle="All systems operational"
          icon={<Activity className="h-5 w-5" />}
          color="emerald"
        />
        <MetricCard
          title="Allocated Resources"
          value={`${data?.totalAllocatedResources?.vcpu || 0} vCPU`}
          subtitle={`${data?.totalAllocatedResources?.ramGb || 0} GB RAM`}
          icon={<Cpu className="h-5 w-5" />}
          color="blue"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Primary Section - Role Based */}
        <div className="lg:col-span-2 space-y-6">
          {/* Returned Requests Alert */}
          {data?.returnedRequests && data.returnedRequests.length > 0 && (
            <Card className="border-l-4 border-l-amber-500 bg-amber-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-amber-800 text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" /> Returned Requests
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.returnedRequests.map(req => (
                  <div key={req.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-amber-100 shadow-sm">
                    <div>
                      <p className="font-semibold text-sm text-slate-800">{req.systemName}</p>
                      <p className="text-xs text-slate-500">Requires changes to proceed</p>
                    </div>
                    <Link href={`/requests/${req.id}/edit`}>
                      <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
                        Fix & Resubmit
                      </Button>
                    </Link>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Role-Based Primary Section */}
          {roleContext === "DCOPS" || roleContext === "ADMIN" ? (
            <ProvisioningQueueSection data={data} />
          ) : roleContext === "APPROVER" ? (
            <PendingApprovalsSection data={data} />
          ) : (
            <RecentRequestsSection data={data} roleContext={roleContext} />
          )}

          {/* Activity Feed */}
          {data?.activityFeed && data.activityFeed.length > 0 && (
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5 text-slate-400" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.activityFeed.slice(0, 5).map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
                      <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700">
                          <span className="font-medium">{activity.actorName}</span>
                          <span className="text-slate-500 mx-1">{getActionText(activity.action)}</span>
                          <span className="font-medium text-slate-800">{activity.entityName}</span>
                        </p>
                        <p className="text-xs text-slate-400">
                          {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xl rounded-2xl overflow-hidden">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2 text-lg">
                <Zap className="text-amber-400 h-5 w-5" /> Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(roleContext === "REQUESTER" || roleContext === "DEVELOPER") && (
                <>
                  <Link href="/requests/new" className="block w-full">
                    <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white transition-all hover:translate-x-1">
                      <PlusCircle className="h-4 w-4 mr-2" /> New VM Request
                    </Button>
                  </Link>
                  <Link href="/requests/customize" className="block w-full">
                    <Button variant="outline" className="w-full bg-white/5 border-white/20 hover:bg-white/10 text-white transition-all hover:translate-x-1">
                      <Zap className="h-4 w-4 mr-2" /> Customize VM
                    </Button>
                  </Link>
                  <Link href="/inventory/vms" className="block w-full">
                    <Button variant="outline" className="w-full bg-white/5 border-white/20 hover:bg-white/10 text-white transition-all hover:translate-x-1">
                      <HardDrive className="h-4 w-4 mr-2" /> Browse Inventory
                    </Button>
                  </Link>
                </>
              )}
              {(roleContext === "APPROVER" || roleContext === "DCOPS" || roleContext === "ADMIN") && (
                <>
                  <Link href="/approvals" className="block w-full">
                    <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white transition-all hover:translate-x-1">
                      <CheckCircle2 className="h-4 w-4 mr-2" /> Open Task Queue
                    </Button>
                  </Link>
                  <Link href="/inventory/vms" className="block w-full">
                    <Button variant="outline" className="w-full bg-white/5 border-white/20 hover:bg-white/10 text-white transition-all hover:translate-x-1">
                      <HardDrive className="h-4 w-4 mr-2" /> View Inventory
                    </Button>
                  </Link>
                </>
              )}
              {roleContext === "ADMIN" && (
                <Link href="/admin" className="block w-full">
                  <Button variant="outline" className="w-full bg-white/5 border-white/20 hover:bg-white/10 text-white transition-all hover:translate-x-1">
                    <Shield className="h-4 w-4 mr-2" /> Admin Panel
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>


          {/* Resource Summary */}
          <Card className="shadow-sm border-slate-200 rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Database className="h-4 w-4 text-indigo-500" /> Resource Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Total vCPUs</span>
                <span className="font-bold text-slate-800">{data?.totalAllocatedResources?.vcpu || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Total RAM</span>
                <span className="font-bold text-slate-800">{data?.totalAllocatedResources?.ramGb || 0} GB</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Total Storage</span>
                <span className="font-bold text-slate-800">{data?.totalAllocatedResources?.storageGb || 0} GB</span>
              </div>
            </CardContent>
                        <div className="bg-slate-50 px-6 py-3 text-xs text-slate-400 border-t">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Metric Card Component
function MetricCard({ 
  title, value, subtitle, icon, color 
}: { 
  title: string; 
  value: string | number; 
  subtitle: string; 
  icon: React.ReactNode;
  color: "indigo" | "amber" | "emerald" | "blue";
}) {
  const colorClasses = {
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    blue: "bg-blue-50 text-blue-600 border-blue-100",
  };
  const stripeColor = {
    indigo: "bg-indigo-600",
    amber: "bg-amber-500",
    emerald: "bg-emerald-500",
    blue: "bg-blue-500",
  };

  return (
    <Card className="border-none shadow-sm bg-white overflow-hidden rounded-2xl">
      <div className={`h-1 ${stripeColor[color]} w-full`} />
      <CardContent className="pt-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
          <div className={`p-2 rounded-xl ${colorClasses[color]}`}>
            {icon}
          </div>
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}


// Provisioning Queue Section (DCOPS/Admin)
function ProvisioningQueueSection({ data }: { data: HomeDashboardData | null }) {
  return (
    <Card className="shadow-sm border-slate-200 rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />
          Provisioning Queue
        </CardTitle>
        <Link href="/approvals">
          <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700">
            View All <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {data?.provisioningQueue && data.provisioningQueue.length > 0 ? (
          <div className="space-y-3">
            {data.provisioningQueue.map((req) => (
              <Link key={req.id} href={`/approvals/${req.id}`}>
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 hover:bg-indigo-50 transition-colors border border-slate-100 hover:border-indigo-200 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                      <Server className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{req.systemName}</p>
                      <p className="text-xs text-slate-500">{req.requestType} • Ready for execution</p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 font-medium">
                    APPROVED
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 bg-slate-50 rounded-xl">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">All caught up!</p>
            <p className="text-sm text-slate-400">No requests pending execution</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Pending Approvals Section (Approver)
function PendingApprovalsSection({ data }: { data: HomeDashboardData | null }) {
  return (
    <Card className="shadow-sm border-slate-200 rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5 text-amber-500" />
          Pending My Approval
        </CardTitle>
        <Link href="/approvals">
          <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700">
            View All <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {data?.pendingApprovals && data.pendingApprovals.length > 0 ? (
          <div className="space-y-3">
            {data.pendingApprovals.map((approval) => (
              <Link key={approval.id} href={`/approvals/${approval.id}`}>
                <div className="flex items-center justify-between p-4 rounded-xl bg-amber-50 hover:bg-amber-100 transition-colors border border-amber-200 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-200 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-amber-700" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{approval.systemName}</p>
                      <p className="text-xs text-slate-500">Level {approval.level} approval required</p>
                    </div>
                  </div>
                  <Badge className="bg-amber-200 text-amber-800 font-medium">
                    L{approval.level}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 bg-slate-50 rounded-xl">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">No pending approvals</p>
            <p className="text-sm text-slate-400">All requests have been processed</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Recent Requests Section (Requester/Developer)
function RecentRequestsSection({ data, roleContext }: { data: HomeDashboardData | null; roleContext: string }) {
  return (
    <Card className="shadow-sm border-slate-200 rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">
          {roleContext === "DEVELOPER" ? "My Created Requests" : "My Requests"}
        </CardTitle>
        <Link href="/requests">
          <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700">
            View All <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {data?.recentRequests && data.recentRequests.length > 0 ? (
          <div className="space-y-3">
            {data.recentRequests.map((req) => (
              <Link key={req.id} href={`/requests/${req.id}/view/`}>
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 hover:bg-indigo-50 transition-colors border border-slate-100 hover:border-indigo-200 cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 group-hover:border-indigo-200 flex items-center justify-center transition-colors">
                      <FileText className="h-5 w-5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{req.systemName}</p>
                      <p className="text-xs text-slate-500 capitalize">
                        {req.requestType.toLowerCase().replace(/_/g, " ")} • {req.environment}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={req.status} />
                    <p className="text-xs text-slate-400 mt-1">
                      {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 bg-slate-50 rounded-xl">
            <Server className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">No requests yet</p>
            <p className="text-sm text-slate-400 mb-4">Create your first VM request</p>
            <Link href="/requests/new">
              <Button className="bg-indigo-600 hover:bg-indigo-700">
                <PlusCircle className="h-4 w-4 mr-2" /> New Request
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Status Badge Component
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon?: React.ReactNode }> = {
    DRAFT: { bg: "bg-slate-100", text: "text-slate-700" },
    PENDING_L1: { bg: "bg-amber-100", text: "text-amber-700" },
    PENDING_L2: { bg: "bg-amber-100", text: "text-amber-700" },
    PENDING_L3: { bg: "bg-amber-100", text: "text-amber-700" },
    PENDING_L4: { bg: "bg-purple-100", text: "text-purple-700" },
    APPROVED: { bg: "bg-emerald-100", text: "text-emerald-700" },
    REJECTED: { bg: "bg-red-100", text: "text-red-700" },
    PROVISIONED: { bg: "bg-blue-100", text: "text-blue-700" },
    CLOSED: { bg: "bg-slate-100", text: "text-slate-600" },
  };

  const c = config[status] || config.DRAFT;

  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${c.bg} ${c.text}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// Helper to convert action codes to readable text
function getActionText(action: string): string {
  const actionMap: Record<string, string> = {
    CREATE_REQUEST: "created request for",
    SUBMIT_REQUEST: "submitted",
    APPROVAL_APPROVED_L1: "approved L1 for",
    APPROVAL_APPROVED_L2: "approved L2 for",
    APPROVAL_APPROVED_L3: "approved L3 for",
    APPROVAL_REJECTED_L1: "rejected",
    APPROVAL_REJECTED_L2: "rejected",
    APPROVAL_REJECTED_L3: "rejected",
    EXECUTE_REQUEST: "executed",
    APPLY_CUSTOMIZATION: "applied customization to",
    CREATE_DECOMMISSION: "created decommission for",
    EXECUTE_DECOMMISSION: "decommissioned",
    EDIT_REQUEST: "edited",
  };
  return actionMap[action] || action.toLowerCase().replace(/_/g, " ");
}
