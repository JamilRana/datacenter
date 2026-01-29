// src/app/approvals/[id]/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { RequestDetails } from "@/app/requests/components/RequestDetail";
import { ApprovalActionPanel } from "../components/ApprovalActionPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Timeline } from "../components/Timeline";

export default async function ApprovalDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth");

  const request = await prisma.request.findUnique({
    where: { id: params.id },
    include: {
      requester: true,
      approvals: {
        include: { approver: true },
        orderBy: { createdAt: "asc" }
      },
      vmInstances: true,
      targetVm: true,
    }
  });

  if (!request) notFound();

  const userRole = session.user.roles;
  return (
    <div className="p-6 md:p-10 space-y-10 bg-slate-50/30 min-h-screen pb-32">
       {/* Breadcrumbs / Header */}
       <div className="flex items-center justify-between">
          <div>
             <h1 className="text-2xl font-bold tracking-tight text-slate-900">Review Request</h1>
             <p className="text-slate-500">ID: {request.id}</p>
          </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Request Context (Read-Only) */}
          <div className="lg:col-span-3">
             <RequestDetails requestId={request.id} userId={session.user.id} />
          </div>

          {/* Sidebar: Approval Progress & Metadata */}
          <div className="lg:col-span-1 space-y-6">
             <Card className="shadow-sm border-slate-200">
                <CardHeader className="bg-slate-50/50 border-b">
                   <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600">Approval Workflow</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                   <Timeline 
                    requestType={request.requestType} 
                    currentStatus={request.status} 
                    approvals={JSON.parse(JSON.stringify(request.approvals))} 
                   />
                </CardContent>
             </Card>

             <Card className="shadow-sm border-slate-200">
                <CardHeader className="bg-slate-50/50 border-b">
                   <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600">Requester Profile</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                   <div>
                      <p className="text-xs text-slate-400 font-bold uppercase">Name</p>
                      <p className="text-sm font-bold text-slate-800">{request.requester.name}</p>
                   </div>
                   <div>
                      <p className="text-xs text-slate-400 font-bold uppercase">Email</p>
                      <p className="text-sm text-slate-600">{request.requester.email}</p>
                   </div>
                   <div>
                      <p className="text-xs text-slate-400 font-bold uppercase">Designation</p>
                      <p className="text-sm text-slate-600">{request.requester.designation || "N/A"}</p>
                   </div>
                </CardContent>
             </Card>
          </div>
       </div>

       {/* Floating Action Bar */}
       <ApprovalActionPanel 
         request={JSON.parse(JSON.stringify(request))} 
         userRole={userRole} 
         userId={session.user.id} 
       />
    </div>
  );
}
