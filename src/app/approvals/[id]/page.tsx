//src/app/approvals/[id]/page.tsx
"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RequestDetails } from "@/app/requests/components/RequestDetail";
import { ProvisionVMModal } from "../components/ProvisionVMModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Timeline } from "../components/Timeline";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { detailsRequest } from "@/types/requests";
import { getDetailedRequest } from "@/app/actions/request-actions";
import { CustomizationRequest } from "@/types/customization";
import { getCustomizationRequest } from "@/app/actions/customization-actions";
import { CustomizationRequestDetails } from "@/app/requests/customize/components/CustomizationRequestDetails";
import { Server } from "lucide-react";
import { ROLES } from "@/lib/roles";

type EntityType = "request" | "customization";

export default function ApprovalDetailPage({ params }: { params: { id: string } }) {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const [request, setRequest] = useState<detailsRequest | null>(null);
  const [customizationRequest, setCustomizationRequest] = useState<CustomizationRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  
  // ✅ GET ENTITY TYPE FROM QUERY PARAM (avoids double fetch)
  const entityType = (searchParams.get("type") as EntityType) || null;
  
  const userRoles = session?.user?.roles || [];
  const isDCOps = userRoles.includes(ROLES.DCOPS) || userRoles.includes(ROLES.ADMIN);
  
  const requestStatus = request?.status;
  const canProvision = isDCOps && 
    (requestStatus === "APPROVED" || requestStatus === "PARTIALLY_PROVISIONED") &&
    entityType === "request";

  useEffect(() => {
    if (status === "unauthenticated") {
      window.location.href = "/auth";
    }
  }, [status]);

  useEffect(() => {
    if (!session?.user) return;
    if (!entityType) {
      setError("Entity type not specified. Please use ?type=request or ?type=customization");
      setIsLoading(false);
      return;
    }

    const loadEntity = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // ✅ SINGLE FETCH BASED ON TYPE
        if (entityType === "request") {
          const response = await getDetailedRequest(params.id);
          if (!response) throw new Error("Request not found");
          // Handle both ApiResponse and raw data for backwards compatibility
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = (response as any).success ? (response as any).data : response;
          if (!data) throw new Error("Request not found");
          setRequest(data as detailsRequest);
          setCustomizationRequest(null);
        } else if (entityType === "customization") {
          const data = await getCustomizationRequest(params.id);
          if (!data) throw new Error("Customization request not found");
          setCustomizationRequest(data);
          setRequest(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load entity");
        console.error("Fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadEntity();
  }, [params.id, session, entityType]);

  if (status === "loading" || isLoading) return <Skeleton className="h-screen w-full" />;
  if (error) return <div className="p-6 text-destructive">Error: {error}</div>;
  if (!request && !customizationRequest) {
    return <div className="p-6">Entity not found</div>;
  }

  const isCustomization = !!customizationRequest;
  const displayRequest = isCustomization ? null : request;
  const displayCustomization = isCustomization ? customizationRequest : null;

  return (
    <div className="p-6 md:p-10 space-y-10 bg-slate-50/30 min-h-screen pb-32">
      {/* Breadcrumbs with type indicator */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {isCustomization ? "Customization Request" : 
               displayRequest?.requestType === "DECOMMISSION" ? "Decommission Request" : 
               "Infrastructure Request"}
            </h1>
            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
              isCustomization ? "bg-blue-50 text-blue-700" :
              displayRequest?.requestType === "DECOMMISSION" ? "bg-red-50 text-red-700" :
              "bg-emerald-50 text-emerald-700"
            }`}>
              {isCustomization ? "CUSTOMIZATION" : displayRequest?.requestType.replace(/_/g, " ")}
            </span>
          </div>
          <p className="text-slate-500">ID: {params.id}</p>
        </div>
        {canProvision && (
          <Button onClick={() => setShowProvisionModal(true)}>
            <Server className="h-4 w-4 mr-2" />
            Provision VMs
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-3">
          {session?.user && displayRequest && (
            <RequestDetails requestId={displayRequest.id} />
          )}
          {session?.user && displayCustomization && (
            <CustomizationRequestDetails 
              request={displayCustomization} 
            />
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
                requestType={isCustomization ? "CUSTOMIZED" : displayRequest?.requestType || "NEW_VM"}
                currentStatus={isCustomization ? (displayCustomization?.status || "DRAFT") : (displayRequest?.status || "DRAFT")}
                approvals={isCustomization ? (displayCustomization?.approvals || []) : (displayRequest?.approvals || [])}
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
                  {(displayRequest?.requester?.name || displayCustomization?.requester?.name) || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase">Email</p>
                <p className="text-sm text-slate-600">
                  {(displayRequest?.requester?.email || displayCustomization?.requester?.email) || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase">Designation</p>
                <p className="text-sm text-slate-600">
                  {(displayRequest?.requester?.designation || displayCustomization?.requester?.designation) || "N/A"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Unified Action Panel - showing in sidebar only */}
      {/* Provision VM Modal */}
      {showProvisionModal && request && (
        <ProvisionVMModal
          open={showProvisionModal}
          onOpenChange={setShowProvisionModal}
          requestId={request.id}
          requestQuantity={request.quantity}
          existingVmsCount={request.vmInstances?.length || 0}
          defaultSubdomain={request.subdomain || ""}
          requesterId={request.requesterId}
          onSuccess={() => {
            // Refresh the page to show updated data
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}