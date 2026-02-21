// src/app/requests/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { CustomizationModal } from "./components/CustomizationModal";
import { Button } from "@/components/ui/button";
import { Eye, Edit, Send, Trash } from "lucide-react";
import { Pagination } from "@/components/Pagination";
import { deleteCustomizationRequest, getCustomizationRequests } from "@/app/actions/customization-actions";
import { fetchAllVms } from "@/app/actions/vm-actions";
import { CustomizationRequest as CustomizationRequestType } from "@/types/customization";
import { SerializedVmInstance } from "@/types/vm";
import { canEdit, canSubmit } from "@/types/requests";
import { CustomizationStatus, Environment, VmStatus } from "@/types/enums";
import { StatusBadge } from "@/components/StatusBadge";

export default function CustomizationRequestsPage() {
  const [requests, setRequests] = useState<CustomizationRequestType[]>([]);
  const [vms, setVms] = useState<SerializedVmInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<CustomizationRequestType | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "view" | "edit">("view"); // ✅ Fixed type
  
const currentPage = 1;
  const [totalPages, setTotalPages] = useState(1);
  const perPage = 10;

const isMounted = useRef(true);

    const fetchData = async () => {
    setIsLoading(true);
    try {
      const [requestsRes, vmsRes] = await Promise.all([
        getCustomizationRequests({ page: currentPage, perPage }),
        fetchAllVms()
      ]);
      if (!isMounted.current) return;

      const transformedRequests: CustomizationRequestType[] = requestsRes.requests.map(req => ({
  // ✅ Spread base properties first
  ...req,
  
  // ✅ Override with explicit typing where needed
  status: req.status as CustomizationStatus,
  
  // ✅ targetVm is guaranteed to exist - no null check needed
  targetVm: {
    id: req.targetVm.id, // ✅ Required field, always present
    hostname: req.targetVm.hostname,
    ipAddress: req.targetVm.ipAddress,
    publicIpAddress: req.targetVm.publicIpAddress,
    subdomain: req.targetVm.subdomain,
    status: req.targetVm.status as VmStatus,
    renewalDate: req.targetVm.renewalDate ? new Date(req.targetVm.renewalDate) : null,
    environment: req.targetVm.environment as Environment || "PRODUCTION",
    hasRemoteAccess: req.targetVm.hasRemoteAccess ?? false,
    vpnRequired: req.targetVm.vpnRequired ?? false,

    currentSpec: req.targetVm.currentSpec,
  },
  
  // ✅ Ensure all required array fields have defaults
  additionalDisks: req.additionalDisks ?? [],
  firewallPorts: req.firewallPorts ?? [],
  networkAccess: req.networkAccess ?? [],
approvals: (req.approvals ?? []).map(a => ({
  id: a.id,
  level: a.level,
  approverId: a.approverId,
  decision: a.decision, // or your ApprovalDecision enum
  comments: a.comments,
  approver: a.approver,
  
  // ✅ Add missing required fields
  entityType: "CUSTOMIZATION",
  requestId: null,
  customizationRequestId: req.id,
  decidedAt: a.decidedAt ?? null,
  createdAt: a.createdAt ?? new Date(),
})),
  // ✅ Ensure requester is properly typed
  requester: req.requester ? {
    id: req.requester.id,
    name: req.requester.name,
    email: req.requester.email,
  } : null,
}));

      setRequests(transformedRequests);
      setVms(vmsRes);
      setTotalPages(requestsRes.totalPages);
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to load requests:", error);
    } finally {
      setIsLoading(false);
    }
  };


useEffect(() => {
    isMounted.current = true; // Set to true when effect runs
    fetchData();
    
    return () => { 
      isMounted.current = false; // ✅ FIX: Cleanup using ref
    };
  }, [currentPage, perPage]);

  // ✅ FIXED: Updated handler signature
  const handleOpenModal = (
    request: CustomizationRequestType | null, 
    mode: "create" | "view" | "edit"
  ) => {
    setSelectedRequest(request);
    setModalMode(mode);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedRequest(null);
    setModalMode("view");
    fetchData();
  };

    const handleDelete = async (id: string) => {
      if (!confirm("Are you sure you want to delete this request?")) return;
      try {
      await deleteCustomizationRequest(id);
      await   fetchData();
      setRequests(requests.filter((req) => req.id !== id));
    } catch (error) {
      console.error("Failed to delete request:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg text-slate-500">Loading customization requests...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Customization Requests</h1>
        <Button 
          onClick={() => handleOpenModal(null, "create")} // ✅ Pass null for new request
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          + New Request
        </Button>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
          <p className="text-slate-500">No customization requests found.</p>
          <Button 
            onClick={() => handleOpenModal(null, "create")} // ✅ Pass null
            className="mt-4"
          >
            Create Your First Request
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div
              key={req.id}
              className="flex items-center justify-between p-4 border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow"
            >
              <div>
                <p className="font-medium">{req.targetVm.hostname || "Unnamed VM"}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Created: {new Date(req.createdAt).toLocaleDateString()}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  IP: {req.targetVm.ipAddress || "N/A"} | Environment: {req.targetVm.environment}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <StatusBadge status={req.status} /> {/* ✅ Fixed component */}
                
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => handleOpenModal(req, "view")}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>

                {canEdit(req.status) && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleOpenModal(req, "edit")}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                )}


                {canSubmit(req.status) && (
                  <Button 
                    size="sm"
                    onClick={() => handleOpenModal(req, "edit")}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Submit
                  </Button>
                )}
                                {canEdit(req.status) && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleDelete(req.id)}
                  >
                    <Trash className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          ))}
          
          <div className="flex justify-center mt-6">
            <Pagination
              totalPages={totalPages}
            />
          </div>
        </div>
      )}

      <CustomizationModal
        open={isModalOpen}
        onOpenChange={handleCloseModal}
        vms={vms}
        selectedRequest={selectedRequest}
        mode={modalMode} // ✅ Now correctly typed
      />
    </div>
  );
}