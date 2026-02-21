//src/app/page.tsx
"use client";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Server, FileText, Clock, AlertTriangle, ArrowRight, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { getHomeDashboardData, HomeDashboardData } from "./actions/home-actions";
import { useEffect, useState } from "react";

export default function Home() {
const {data: session} = useSession();
const [homeDashboardData, setHomeDashboardData] = useState<HomeDashboardData | null>(null);

  if (!session) {
    redirect("/auth");
  }

  // Redirect based on roles (inclusive logic)
  if (session.user.roles.includes("DC_OPS")) { 
    redirect("/ops");
  }
  
  if (session.user.roles.some(r => r.startsWith("APPROVER"))) {
    redirect("/approvals");
  }

useEffect(() => {
  const fetchHomeDashboardData = async () => {
    try {
      const res = await getHomeDashboardData();
setHomeDashboardData(res);
      console.log(res);
    } catch (error) {
      console.error("Failed to fetch home dashboard data:", error);
    }
  }
  fetchHomeDashboardData();
}, [session]);

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Welcome back, {session.user.name}
        </h1>
        <p className="text-slate-500 mt-1">
          Here&lsquo;s an overview of your datacenter resources and requests.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <div className="h-1 bg-blue-600 w-full" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active VMs</CardTitle>
            <Server className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{homeDashboardData?.activeVmCount}</div>
            <p className="text-[10px] text-slate-500 mt-1">{homeDashboardData?.decommissionedVmCount} decommissioned</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <div className="h-1 bg-green-600 w-full" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Requests</CardTitle>
            <FileText className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{homeDashboardData?.totalRequestCount}</div>
            <p className="text-[10px] text-slate-500 mt-1">{homeDashboardData?.rejectedCount} rejected</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <div className="h-1 bg-amber-500 w-full" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pending Approvals</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{homeDashboardData?.pendingCount}</div>
            <p className="text-[10px] text-slate-500 mt-1">Waiting for MIS team</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <div className="h-1 bg-red-500 w-full" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">Returned</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{homeDashboardData?.returnedRequests.length}</div>
            <p className="text-[10px] text-slate-500 mt-1">Action required by you</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {homeDashboardData?.returnedRequests && homeDashboardData?.returnedRequests.length > 0 && (
            <Card className="border-none shadow-sm bg-red-50 border-l-4 border-l-red-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-red-800 text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" /> Returned Requests
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {homeDashboardData?.returnedRequests.map(req => (
                  <div key={req.id} className="flex justify-between items-center bg-white p-3 rounded border border-red-100">
                    <div>
                      <p className="font-semibold text-sm">{req.systemName}</p>
                      <p className="text-[10px] text-slate-500">Requires changes to proceed</p>
                    </div>
                    <Link href={`/requests/${req.id}/edit`}>
                      <Button variant="outline" size="sm" className="h-8 text-red-600 border-red-200 hover:bg-red-50">
                        Fix & Resubmit
                      </Button>
                    </Link>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Requests</CardTitle>
              <Link href="/requests">
                <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">
                  View All <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {homeDashboardData?.recentRequests && homeDashboardData?.recentRequests.length > 0 ? (
                <div className="space-y-4">
                  {homeDashboardData?.recentRequests.map((req,key:number) => (
                    <div key={req.id}  className=" p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors border">
                        <Link href={`/requests/${req.id}/view/`}>
                        <div key={key} className="flex items-center justify-between  group">
                      <div className="flex items-center gap-4">
                        <div className="bg-white p-2 rounded border group-hover:border-blue-200 transition-colors">
                          <FileText className="h-5 w-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{req.systemName}</p>
                          <p className="text-xs text-slate-500 capitalize">{req.requestType.toLowerCase().replace(/_/g, ' ')} • {req.environment}</p>
                        </div>
                      </div>
                      <div className="text-right">
                         <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                           req.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                           req.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                           'bg-blue-100 text-blue-800'
                         }`}>
                           {req.status.replace(/_/g, ' ')}
                         </span>
                         <p className="text-[10px] text-slate-400 mt-1">{new Date(req.createdAt).toLocaleDateString()}</p>
                      </div>
                      </div>
 </Link>
                    </div>
                 
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                   <p className="text-slate-500 italic">No recent requests found.</p>
                   <Link href="/requests/new">
                      <Button variant="outline" className="mt-4">Create your first request</Button>
                   </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
           <Card className="border-none shadow-sm bg-gradient-to-br from-slate-900 to-slate-800 text-white">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <PlusCircle className="text-blue-400" /> Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                 <Link href="/requests/new" className="block w-full">
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 border-none transition-all hover:translate-x-1">
                       New VM Request
                    </Button>
                 </Link>
                 <Link href="/inventory/vms" className="block w-full">
                    <Button variant="outline" className="w-full bg-white/5 border-white/20 hover:bg-white/10 text-white transition-all hover:translate-x-1">
                       Browse Inventory
                    </Button>
                 </Link>
                 <Link href="/requests/new?type=RENEWAL" className="block w-full">
                    <Button variant="outline" className="w-full bg-white/5 border-white/20 hover:bg-white/10 text-white transition-all hover:translate-x-1">
                       Renew Resources
                    </Button>
                 </Link>
              </CardContent>
           </Card>

           <Card className="border-none shadow-sm overflow-hidden bg-slate-900 text-white">
              <CardContent className="p-0">
                 <div className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                       <AlertTriangle className="text-yellow-400 h-6 w-6" />
                       <h3 className="font-bold">System Status</h3>
                    </div>
                    <div className="space-y-2">
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-400">vCenter Connectivity</span>
                          <span className="flex items-center gap-1.5 text-green-400">
                             <div className="h-2 w-2 rounded-full bg-green-400" /> Operational
                          </span>
                       </div>
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-400">Database Engine</span>
                          <span className="flex items-center gap-1.5 text-green-400">
                             <div className="h-2 w-2 rounded-full bg-green-400" /> Operational
                          </span>
                       </div>
                    </div>
                 </div>
                 <div className="bg-slate-800 p-4 text-center text-xs text-slate-400 border-t border-slate-700">
                    Version 2.4.0 (Build 562)
                 </div>
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}
