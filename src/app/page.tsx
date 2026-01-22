import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Server, FileText, Clock, AlertTriangle, ArrowRight, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth");
  }

  // Redirect based on primary role
  if (session.user.role === "DC_OPS") {
    redirect("/ops");
  }
  
  if (session.user.role.startsWith("APPROVER")) {
    redirect("/approver");
  }

  // Fetch some basic stats for the user
  const vmCount = await prisma.vmInstance.count({
    where: { ownerId: session.user.id }
  });

  const requestCount = await prisma.request.count({
    where: { requesterId: session.user.id }
  });

  const pendingCount = await prisma.request.count({
    where: { 
      requesterId: session.user.id,
      status: { in: ["PENDING_L1", "PENDING_L2", "PENDING_L3"] }
    }
  });

  const recentRequests = await prisma.request.findMany({
    where: { requesterId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 5
  });

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Welcome back, {session.user.name}
        </h1>
        <p className="text-slate-500 mt-1">
          Here's an overview of your datacenter resources and requests.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <div className="h-1 bg-blue-600 w-full" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Active VMs</CardTitle>
            <Server className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{vmCount}</div>
            <p className="text-xs text-slate-500 mt-1">Provisioned and running in DC</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <div className="h-1 bg-green-600 w-full" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Requests</CardTitle>
            <FileText className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{requestCount}</div>
            <p className="text-xs text-slate-500 mt-1">Historical request total</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <div className="h-1 bg-orange-500 w-full" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Pending Action</CardTitle>
            <Clock className="h-5 w-5 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{pendingCount}</div>
            <p className="text-xs text-slate-500 mt-1">Awaiting approval or info</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
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
              {recentRequests.length > 0 ? (
                <div className="space-y-4">
                  {recentRequests.map((req) => (
                    <div  className=" p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors border">
   
                                       <Link href={`/requests/${req.id}`}>
                                       <div key={req.id} className="flex items-center justify-between  group">


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
