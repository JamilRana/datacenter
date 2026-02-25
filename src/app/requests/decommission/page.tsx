// src/app/requests/decommission/page.tsx
"use client";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { fetchAllVms } from "@/app/actions/vm-actions";
import { createDecommissionRequest, getDecommissionRequestList, submitDecommissionRequest, deleteDecommissionRequest } from "@/app/actions/decommission-actions";
import { SerializedVmInstance } from "@/types/vm";
import { toast } from "sonner";
import { Trash2, Server, Plus, AlertTriangle, X, Send, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

export default function DecommissionPage() {
  const [vms, setVms] = useState<SerializedVmInstance[]>([]);
  const [decommissionRequests, setDecommissionRequests] = useState<{ id: string; status: string; targetVm?: { hostname?: string | null; ipAddress?: string | null } | null; reason?: string | null; purpose?: string | null; createdAt: string | Date }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVm, setSelectedVm] = useState<string>("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isMounted = useRef(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [vmsRes, decommRes] = await Promise.all([
        fetchAllVms(),
        getDecommissionRequestList({ status: "ALL" })
      ]);
      if (!isMounted.current) return;
      const activeVms = vmsRes.vms.filter(vm => vm.status === "ACTIVE");
      setVms(activeVms);
      setDecommissionRequests(decommRes.data);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    fetchData();
    return () => { isMounted.current = false; };
  }, []);

  const handleSubmit = async () => {
    if (!selectedVm || !reason.trim()) {
      toast.error("Please select a VM and provide a reason");
      return;
    }
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("targetVmId", selectedVm);
      formData.append("reason", reason);
      formData.append("status", "DRAFT");
      await createDecommissionRequest(formData);
      toast.success("Decommission request created");
      setIsModalOpen(false);
      setSelectedVm("");
      setReason("");
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitForApproval = async (id: string) => {
    try {
      await submitDecommissionRequest(id);
      toast.success("Request submitted for approval");
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this request?")) return;
    try {
      await deleteDecommissionRequest(id);
      toast.success("Request deleted");
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: "bg-slate-100 text-slate-700",
      PENDING_L1: "bg-amber-100 text-amber-700",
      PENDING_L2: "bg-amber-100 text-amber-700",
      PENDING_L3: "bg-amber-100 text-amber-700",
      APPROVED: "bg-emerald-100 text-emerald-700",
      REJECTED: "bg-red-100 text-red-700",
      CLOSED: "bg-slate-100 text-slate-600",
    };
    return colors[status] || "bg-slate-100 text-slate-700";
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
        <span className="text-slate-900 font-medium">Decommission</span>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Decommission Requests</h1>
          <p className="text-slate-500 mt-1">Request removal of VMs from the infrastructure</p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4 mr-2" /> New Request
        </Button>
      </div>

      {/* Decommission Request Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              Create Decommission Request
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select VM to Decommission *</Label>
              <Select value={selectedVm} onValueChange={setSelectedVm}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an active VM" />
                </SelectTrigger>
                <SelectContent>
                  {vms.map((vm) => (
                    <SelectItem key={vm.id} value={vm.id}>
                      {vm.hostname} ({vm.ipAddress || "No IP"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason for Decommission *</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this VM needs to be decommissioned..."
                rows={4}
              />
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 inline mr-1" />
                The request will be saved as draft. You can submit it for approval after creation.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {isSubmitting ? "Creating..." : "Create Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Existing Requests */}
      {decommissionRequests.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="py-12 text-center">
            <Trash2 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No decommission requests found.</p>
            <Button
              onClick={() => setIsModalOpen(true)}
              className="mt-4 bg-indigo-600 hover:bg-indigo-700"
            >
              Create Your First Request
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {decommissionRequests.map((req) => (
            <Card key={req.id} className="border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
                      <Server className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">
                        {req.targetVm?.hostname || "VM Decommission"}
                      </p>
                      <p className="text-sm text-slate-500">
                        IP: {req.targetVm?.ipAddress || "N/A"} | Created: {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(req.status)}`}>
                      {req.status.replace(/_/g, " ")}
                    </span>
                    {req.status === "DRAFT" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleSubmitForApproval(req.id)}
                          className="bg-indigo-600 hover:bg-indigo-700"
                        >
                          <Send className="h-3 w-3 mr-1" /> Submit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(req.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {req.purpose && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-sm text-slate-600">{req.purpose}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}