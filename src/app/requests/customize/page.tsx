// src/app/requests/customize/page.tsx
"use client";
import { useState, useEffect, useRef } from "react";
import { CustomizationModal } from "./components/CustomizationModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, Edit, Send, Trash, Plus, ChevronRight } from "lucide-react";
import Link from "next/link";
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
  const [modalMode, setModalMode] = useState<"create" | "view" | "edit">("view");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const perPage = 10;

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };
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
        ...req,
        status: req.status as CustomizationStatus,
        targetVm: {
          id: req.targetVm.id,
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
        additionalDisks: req.additionalDisks ?? [],
        firewallPorts: req.firewallPorts ?? [],
        networkAccess: req.networkAccess ?? [],
        approvals: (req.approvals ?? []).map(a => ({
          id: a.id,
          level: a.level,
          approverId: a.approverId,
          decision: a.decision,
          comments: a.comments,
          approver: a.approver,
          entityType: "CUSTOMIZATION",
          requestId: null,
          customizationRequestId: req.id,
          decidedAt: a.decidedAt ?? null,
          createdAt: a.createdAt ?? new Date(),
        })),
        requester: req.requester ? {
          id: req.requester.id,
          name: req.requester.name,
          email: req.requester.email,
        } : null,
      }));
      setRequests(transformedRequests);
      setVms(vmsRes.vms);
      setTotalPages(requestsRes.totalPages);
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to load requests:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    fetchData();
    return () => {
      isMounted.current = false;
    };
  }, [currentPage, perPage]);

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
      await fetchData();
      setRequests(requests.filter((req) => req.id !== id));
    } catch (error) {
      console.error("Failed to delete request:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center h-10">
          <div className="h-8 w-48 bg-slate-200 animate-pulse rounded" />
          <div className="h-10 w-32 bg-slate-200 animate-pulse rounded" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-slate-100 animate-pulse rounded-xl border border-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center text-sm text-slate-500">
        <Link href="/" className="hover:text-slate-900">Home</Link>
        <ChevronRight className="h-4 w-4 mx-2" />
        <Link href="/requests" className="hover:text-slate-900">Requests</Link>
        <ChevronRight className="h-4 w-4 mx-2" />
        <span className="text-slate-900 font-medium">Customization</span>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Customization Requests</h1>
          <p className="text-slate-500 mt-1">Upgrade or modify existing VM specifications</p>
        </div>
        <Button
          onClick={() => handleOpenModal(null, "create")}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" /> New Request
        </Button>
      </div>

      {requests.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="py-12 text-center">
            <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Eye className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-slate-500">No customization requests found.</p>
            <Button
              onClick={() => handleOpenModal(null, "create")}
              className="mt-4 bg-indigo-600 hover:bg-indigo-700"
            >
              Create Your First Request
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <Card key={req.id} className="border-slate-200 hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
                      <Eye className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{req.targetVm.hostname || "Unnamed VM"}</p>
                      <p className="text-sm text-slate-500">
                        IP: {req.targetVm.ipAddress || "N/A"} | Environment: {req.targetVm.environment}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Created: {new Date(req.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={req.status} />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenModal(req, "view")}
                    >
                      <Eye className="h-4 w-4 mr-1" /> View
                    </Button>
                    {canEdit(req.status) && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenModal(req, "edit")}
                        >
                          <Edit className="h-4 w-4 mr-1" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(req.id)}
                        >
                          <Trash className="h-4 w-4 mr-1" /> Delete
                        </Button>
                      </>
                    )}
                    {canSubmit(req.status) && (
                      <Button
                        size="sm"
                        onClick={() => handleOpenModal(req, "edit")}
                        className="bg-indigo-600 hover:bg-indigo-700"
                      >
                        <Send className="h-4 w-4 mr-1" /> Submit
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          <div className="flex justify-center mt-6">
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
          </div>
        </div>
      )}
      <CustomizationModal
        open={isModalOpen}
        onOpenChange={handleCloseModal}
        vms={vms}
        selectedRequest={selectedRequest}
        mode={modalMode}
      />
    </div>
  );
}