// src/app/approvals/[id]/page.tsx
"use client"; // REQUIRED since using client hooks

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { fetchApprovalData } from "@/app/actions/approval-actions"; // Must be client-safe action
import { ApprovalRequestDetail } from "@/types/approvals"; // NEW IMPORT
import { RequestDetails } from "@/app/requests/components/RequestDetail";
import { ApprovalActionPanel } from "../components/ApprovalActionPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Timeline } from "../components/Timeline";
import { Skeleton } from "@/components/ui/skeleton"; // For loading states

export default function ApprovalDetailPage({ params }: { params: { id: string } }) {
  const { data: session, status } = useSession();
  const [request, setRequest] = useState<ApprovalRequestDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handle auth redirect safely in client component
  useEffect(() => {
    if (status === "unauthenticated") {
      window.location.href = "/auth";
    }
  }, [status]);

  // Fetch data safely in client component
  useEffect(() => {
    if (!session?.user) return;
    
    const loadRequest = async () => {
      try {
        setIsLoading(true);
        const data = await fetchApprovalData(params.id);
        if (!data) throw new Error("Request not found");
        setRequest(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load request");
        console.error("Fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadRequest();
  }, [params.id, session]);

  // Loading/error states
  if (status === "loading" || isLoading) return <Skeleton className="h-screen w-full" />;
  if (error) return <div className="p-6 text-destructive">Error: {error}</div>;
  if (!request) return <div className="p-6">Request not found</div>;

  return (
    <div className="p-6 md:p-10 space-y-10 bg-slate-50/30 min-h-screen pb-32">
      {/* Breadcrumbs */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Review Request</h1>
          <p className="text-slate-500">ID: {request.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-3">
         {session?.user && (
          <RequestDetails requestId={request.id} userId={session.user.id} />
         )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600">
                Approval Workflow
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <Timeline 
                requestType={request.requestType} 
                currentStatus={request.status} 
                approvals={request.approvals} // ✅ Now type-safe
              />
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600">
                Requester Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase">Name</p>
                <p className="text-sm font-bold text-slate-800">
                  {request.requester?.name || "N/A"} {/* ✅ Null-safe */}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase">Email</p>
                <p className="text-sm text-slate-600">
                  {request.requester?.email || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase">Designation</p>
                <p className="text-sm text-slate-600">
                  {request.requester?.designation || "N/A"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Action Panel - Pass typed request directly */}
      {session?.user && request &&(
      <ApprovalActionPanel 
        request={request} 
        userRole={session?.user.roles} 
      />
      )}
    </div>
  );
}