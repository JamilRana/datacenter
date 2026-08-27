//src/app/approvals/[id]/page.tsx
"use client";
import { use } from "react";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { RequestDetails } from "@/app/requests/components/RequestDetail";
import { ProvisionVMModal } from "../components/ProvisionVMModal";
import { ProvisionAccessModal } from "../components/ProvisionAccessModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Timeline } from "../components/Timeline";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { detailsRequest } from "@/types/requests";
import { getDetailedRequest } from "@/app/actions/request-actions";
import { CustomizationRequest } from "@/types/customization";
import { getCustomizationRequest } from "@/app/actions/customization-actions";
import { CustomizationRequestDetails } from "@/app/requests/customize/components/CustomizationRequestDetails";
import { Server, Play } from "lucide-react";
import { ROLES } from "@/lib/roles";
import { executeRequest } from "@/app/actions/approval-actions";
import { toast } from "sonner";
import { DcOpsExecutionCenter } from "../components/DcOpsExecutionCenter";

type EntityType = "request" | "customization";

export default function ApprovalDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const unwrappedParams = use(params);
  const id = unwrappedParams.id;
  const unwrappedSearchParams = use(searchParams);
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const [request, setRequest] = useState<detailsRequest | null>(null);
  const [customizationRequest, setCustomizationRequest] = useState<CustomizationRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [showProvisionAccessModal, setShowProvisionAccessModal] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  
  // ✅ GET ENTITY TYPE FROM QUERY PARAM (avoids double fetch)
  const entityType = (unwrappedSearchParams.type as EntityType) || null;
  
  const userRoles = session?.user?.roles || [];
  const isDCOps = userRoles.includes(ROLES.DCOPS) || userRoles.includes(ROLES.ADMIN);
  
  const requestStatus = request?.status;
  const isInstanceProvisioningType = request?.requestType === "NEW_VM" || request?.requestType === "CLONE_VM";
  const isAccessProvisioningType = request?.requestType === "VPN_ACCESS" || request?.requestType === "HORIZON_ACCESS";

  const canProvision = isDCOps && 
    (requestStatus === "APPROVED" || requestStatus === "PARTIALLY_PROVISIONED") &&
    entityType === "request" &&
    isInstanceProvisioningType;

  const canProvisionAccess = isDCOps && 
    (requestStatus === "APPROVED" || requestStatus === "PARTIALLY_PROVISIONED") &&
    entityType === "request" &&
    isAccessProvisioningType;

  const canExecuteDirectly = isDCOps &&
    requestStatus === "APPROVED" &&
    entityType === "request" &&
    !isInstanceProvisioningType &&
    !isAccessProvisioningType;

  const handleExecuteDirectly = async () => {
    if (!confirm("Are you sure you want to execute and apply this request?")) return;
    try {
      setIsExecuting(true);
      const res = await executeRequest(id);
      if (res.success) {
        toast.success("Request executed successfully!");
        window.location.reload();
      } else {
        toast.error(res.error || "Failed to execute request");
      }
    } catch (err) {
      toast.error("Failed to execute request");
      console.error(err);
    } finally {
      setIsExecuting(false);
    }
  };

  const loadEntity = async () => {
    try {
      setError(null);

      // ✅ SINGLE FETCH BASED ON TYPE
      if (entityType === "request") {
        const response = await getDetailedRequest(id);
        if (!response) throw new Error("Request not found");
        // Handle both ApiResponse and raw data for backwards compatibility
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = (response as any).success ? (response as any).data : response;
        if (!data) throw new Error("Request not found");
        setRequest(data as detailsRequest);
        setCustomizationRequest(null);
      } else if (entityType === "customization") {
        const data = await getCustomizationRequest(id);
        if (!data) throw new Error("Customization request not found");
        setCustomizationRequest(data as unknown as CustomizationRequest);
        setRequest(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load entity");
      console.error("Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      window.location.href = "/auth";
    }
  }, [status]);

  useEffect(() => {
    if (!userId) return;
    if (!entityType) {
      setError("Entity type not specified. Please use ?type=request or ?type=customization");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    loadEntity();
  }, [id, userId, entityType]);

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
              {isCustomization ? "Customization" : displayRequest?.requestType || "Request"}
            </span>
          </div>
          <p className="text-sm text-slate-500">
            {isCustomization ? `Target: ${displayCustomization?.targetVm?.hostname}` : 
             `System: ${displayRequest?.systemName}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canProvision && (
            <Button onClick={() => setShowProvisionModal(true)} className="bg-indigo-600 hover:bg-indigo-700">
              <Server className="h-4 w-4 mr-2" />
              Provision VMs
            </Button>
          )}
          {canProvisionAccess && (
            <Button onClick={() => setShowProvisionAccessModal(true)} className="bg-amber-600 hover:bg-amber-700">
              <Server className="h-4 w-4 mr-2" />
              Provision Access
            </Button>
          )}
          {canExecuteDirectly && (
            <Button 
              onClick={handleExecuteDirectly} 
              disabled={isExecuting}
              className="bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
            >
              <Play className="h-4 w-4 mr-2" />
              {isExecuting ? "Executing..." : "Execute Upgrade"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-3 space-y-8">
          {/* DC Ops Execution Center for approved/in-progress multi-resource requests */}
          {session?.user && displayRequest && isDCOps && (displayRequest.status === "APPROVED" || displayRequest.status === "PARTIALLY_PROVISIONED" || displayRequest.status === "PROVISIONED") && (
            <DcOpsExecutionCenter request={displayRequest} onRefresh={loadEntity} />
          )}

          {session?.user && displayRequest && (
            <RequestDetails requestId={displayRequest.id} hideTimeline={true} />
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
          
          {displayRequest?.developer && (
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="bg-slate-50/50 border-b">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600">
                  Developer Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase">Name</p>
                  <p className="text-sm font-bold text-slate-800">
                    {displayRequest.developer.name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase">Email</p>
                  <p className="text-sm text-slate-600">
                    {displayRequest.developer.email}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase">Designation</p>
                  <p className="text-sm text-slate-600">
                    {displayRequest.developer.designation || "N/A"}
                  </p>
                </div>
                {displayRequest.developer.organization && (
                  <div>
                    <p className="text-xs text-slate-400 font-bold uppercase">Organization</p>
                    <p className="text-sm text-slate-600">
                      {displayRequest.developer.organization}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
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
      {showProvisionAccessModal && request && (
        <ProvisionAccessModal
          open={showProvisionAccessModal}
          onOpenChange={setShowProvisionAccessModal}
          request={request}
          onSuccess={() => {
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}