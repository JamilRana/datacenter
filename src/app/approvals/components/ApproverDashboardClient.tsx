// src/app/approvals/components/ApproverDashboardClient.tsx
"use client";
import type { ApprovalDecision } from "@prisma/client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { ROLES } from "@/lib/roles";
import { format, startOfDay, endOfDay, parseISO } from "date-fns";
import { 
  Eye, 
  Search,
  User as UserIcon,  
  HardDrive,
  Activity,
  CheckCircle2,
  XCircle,
  Zap,
  Calendar,
  Loader2,
  MessageSquare,
  ArrowUpDown,
  ArrowUpRight,
  Undo2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { canUserApprove } from "@/lib/roles";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { handleApprovalDecision, executeRequest, forwardToLevel } from "@/app/actions/approval-actions";
import { DashboardRequest } from "@/types/approvals";
import { ProvisionVMModal } from "./ProvisionVMModal";
import { ProvisionK8sModal } from "./ProvisionK8sModal";
import { SubdomainApprovalsPanel } from "./SubdomainApprovalsPanel";

interface ApproverRequest extends Omit<DashboardRequest, "createdAt"> {
  createdAt: string | Date;
}

// ✅ TYPE BADGE CONFIGURATION
const REQUEST_TYPE_CONFIG: Record<string, { label: string; color: string; icon: JSX.Element | null }> = {
  NEW_VM: { 
    label: "New VM", 
    color: "bg-blue-50 text-blue-700 border-blue-200", 
    icon: <HardDrive className="h-3 w-3 mr-1" /> 
  },
  CUSTOMIZED: { 
    label: "Customization", 
    color: "bg-purple-50 text-purple-700 border-purple-200", 
    icon: <Zap className="h-3 w-3 mr-1" /> 
  },
  DECOMMISSION: { 
    label: "Decommission", 
    color: "bg-red-50 text-red-700 border-red-200", 
    icon: <Activity className="h-3 w-3 mr-1" /> 
  },
  RENEWAL: { 
    label: "Renewal", 
    color: "bg-green-50 text-green-700 border-green-200", 
    icon: <ArrowUpDown className="h-3 w-3 mr-1" /> 
  },
  UNKNOWN: {
    label: "Unknown Type", 
    color: "bg-slate-50 text-slate-700 border-slate-200", 
    icon: null 
  },
};

export function ApproverDashboardClient({ 
  initialRequests, 
  userRoles,
  currentUserId
}: { 
  initialRequests: ApproverRequest[], 
  userRoles: string[],
  currentUserId: string,
}) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // Default empty (shows all)
  const [typeFilter, setTypeFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Determine if user is admin (has ADMIN role)
  const isAdmin = userRoles.includes("ADMIN");
  const isDCOps = userRoles.includes("DC_OPS");
  const isL1 = userRoles.includes("APPROVER_L1");
  const showSubdomainTab = isL1 || isDCOps || isAdmin;

  const [activeMainTab, setActiveMainTab] = useState<"requests" | "subdomains">("requests");

  // Sort requests - pending first, then by date
  const sortedRequests = [...initialRequests].sort((a, b) => {
    const aPending = a.status?.startsWith("PENDING_L") ? 0 : 1;
    const bPending = b.status?.startsWith("PENDING_L") ? 0 : 1;
    if (aPending !== bPending) return aPending - bPending;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Client-side metrics - different for DCOPS vs approvers
  interface DCOpsMetrics {
    totalVisible: number;
    pendingExecutionCount: number;
    partiallyExecutedCount: number;
    executedCount: number;
  }

  interface ApproverMetrics {
    totalVisible: number;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
    executedCount: number;
  }

  let clientMetrics: DCOpsMetrics | ApproverMetrics;
  if (isDCOps) {
    // DCOPS sees: pending execution (APPROVED), partially executed, executed
    clientMetrics = {
      totalVisible: initialRequests.length,
      pendingExecutionCount: initialRequests.filter(r => r.status === 'APPROVED').length,
      partiallyExecutedCount: initialRequests.filter(r => r.status === 'PARTIALLY_PROVISIONED').length,
      executedCount: initialRequests.filter(r => r.status === 'PROVISIONED' || r.status === 'CLOSED').length,
    };
  } else {
    // Approvers/Admins see: pending approval, approved, rejected, executed
    clientMetrics = {
      totalVisible: initialRequests.length,
      pendingCount: initialRequests.filter(r => r.status?.startsWith('PENDING_L')).length,
      approvedCount: initialRequests.filter(r => r.status === 'APPROVED' || r.status === 'PROVISIONED' || r.status === 'PARTIALLY_PROVISIONED').length,
      rejectedCount: initialRequests.filter(r => r.status === 'REJECTED').length,
      executedCount: initialRequests.filter(r => r.status === 'PROVISIONED' || r.status === 'PARTIALLY_PROVISIONED' || r.status === 'CLOSED').length,
    };
  }

  const handleFilterClick = (filter: string) => {
    setStatusFilter(filter.toLowerCase());
  };
  
  const [isPending, startTransition] = useTransition();
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<"APPROVED" | "REJECTED" | "RETURNED" | "FORWARDED" | null>(null);
  const [forwardLevel, setForwardLevel] = useState<number | null>(null);
  const [quickComments, setQuickComments] = useState("");
  const [provisionModal, setProvisionModal] = useState<{
    open: boolean;
    requestId: string;
    requestQuantity: number;
    existingVmsCount: number;
    defaultSubdomain: string;
    requesterId: string;
  }>({ 
    open: false, 
    requestId: "", 
    requestQuantity: 1, 
    existingVmsCount: 0,
    defaultSubdomain: "",
    requesterId: ""
  });

  const [provisionK8sModal, setProvisionK8sModal] = useState<{
    open: boolean;
    requestId: string;
  }>({
    open: false,
    requestId: ""
  });

  // ✅ DETERMINE CURRENT APPROVAL LEVEL FROM STATUS (returns number)
  const getCurrentLevel = (status: string): number | null => {
    const match = status.match(/^PENDING_L(\d+)$/);
    if (match) return parseInt(match[1], 10);
    if (status === "APPROVED") return 99; // DCOPS execution level
    return null;
  };

  // ✅ GET ALL LEVELS THIS USER CAN ACT ON
  const getUserActionableLevels = (roles: string[]): number[] => {
    return roles
      .map(role => {
        if (role.startsWith("APPROVER_L")) {
          const level = parseInt(role.replace("APPROVER_L", ""), 10);
          return Number.isFinite(level) ? level : null;
        }
        if (role === "L4_APPROVER") return 4;
        return null;
      })
      .filter((lvl): lvl is number => lvl !== null);
  };

  // ✅ FIND THE SPECIFIC APPROVAL ID FOR THIS USER + REQUEST + LEVEL
  const findApprovalId = (request: ApproverRequest, userLevels: number[]): string | null => {
    if (!request.approvals || !currentUserId) return null;
    
    const relevantApproval = request.approvals.find(approval => 
      approval.level && 
      userLevels.includes(approval.level) && 
      approval.approverId === currentUserId && 
      approval.decision === "PENDING"
    );
    
    return relevantApproval?.id || null;
  };

  const getEntityType = (requestType?: string): "REQUEST" | "CUSTOMIZATION" => {
    return requestType === "CUSTOMIZED" ? "CUSTOMIZATION" : "REQUEST";
  };

  const filteredRequests = sortedRequests.filter(req => {
    const matchesSearch = 
      req.systemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.requester?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Status filter mapping - handle different status formats
    let matchesStatus = true;
    if (statusFilter === "pending") {
      matchesStatus = req.status?.startsWith("PENDING_L") || false;
    } else if (statusFilter === "approved") {
      matchesStatus = req.status === 'APPROVED' || req.status === 'PROVISIONED' || req.status === 'PARTIALLY_PROVISIONED';
    } else if (statusFilter === "rejected") {
      matchesStatus = req.status === 'REJECTED';
    } else if (statusFilter === "executed") {
      matchesStatus = req.status === 'PROVISIONED' || req.status === 'PARTIALLY_PROVISIONED' || req.status === 'CLOSED';
    } else if (statusFilter === "pending_execution") {
      // DCOPS: pending execution = APPROVED (ready for provisioning)
      matchesStatus = req.status === 'APPROVED';
    } else if (statusFilter === "partial") {
      // DCOPS: partially executed = PARTIALLY_PROVISIONED
      matchesStatus = req.status === 'PARTIALLY_PROVISIONED';
    } else if (statusFilter === "closed") {
      // DCOPS: closed requests
      matchesStatus = req.status === 'CLOSED';
    }
    // Empty statusFilter shows everything (default view)
    
    const matchesType = typeFilter === "all" || req.requestType === typeFilter;

    let matchesDate = true;
    if (startDate || endDate) {
      const createdAt = new Date(req.createdAt);
      if (startDate && createdAt < startOfDay(parseISO(startDate))) matchesDate = false;
      if (endDate && createdAt > endOfDay(parseISO(endDate))) matchesDate = false;
    }

    return matchesSearch && matchesStatus && matchesType && matchesDate;
  });

  // ✅ Handles all approval actions: APPROVE, REJECT, RETURN, FORWARD
  async function onQuickAction(
    approvalId: string, 
    entityType: "REQUEST" | "CUSTOMIZATION", 
    decision: "APPROVED" | "REJECTED" | "RETURNED" | "FORWARDED",
    targetLevel?: number
  ) {
    if ((decision === "REJECTED" || decision === "RETURNED") && !quickComments.trim()) {
      toast.error("Comments are required for rejection or return");
      return;
    }

    startTransition(async () => {
      try {
        if (decision === "FORWARDED" && targetLevel) {
          await forwardToLevel(approvalId, targetLevel, quickComments || `Forwarded to level ${targetLevel}`);
          toast.success(`Request forwarded to level ${targetLevel}`);
        } else {
          await handleApprovalDecision(approvalId, decision as ApprovalDecision, quickComments);
          toast.success(`Request ${decision.toLowerCase()} successfully`);
        }
        setActiveActionId(null);
        setSelectedAction(null);
        setForwardLevel(null);
        setQuickComments("");
        router.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        toast.error(`Action failed: ${message}`);
        console.error("Approval error:", error);
      }
    });
  }

  async function onQuickExecute(requestId: string) {
    startTransition(async () => {
      try {
        await executeRequest(requestId, "Executed via dashboard quick action");
        toast.success("Request executed successfully");
        router.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        toast.error(`Execution failed: ${message}`);
        console.error("Execution error:", error);
      }
    });
  }

  function openProvisionModal(req: ApproverRequest) {
    const requestQuantity = req.quantity || 1;
    const existingVmsCount = req.vmInstances?.length || 0;
    const requesterId = req.requester?.id || "";
    const subdomain = req.subdomain || "";
    
    setProvisionModal({
      open: true,
      requestId: req.id,
      requestQuantity,
      existingVmsCount,
      defaultSubdomain: subdomain,
      requesterId,
    });
  }

  return (
    <div className="space-y-6">
      {/* Metrics Cards - Different for DCOPS vs Approvers/Admins */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {isDCOps ? (
          // DCOPS sees: Pending Execution, Partially Executed, Executed
          <>
            <button
              onClick={() => handleFilterClick("")}
              className={`text-left p-4 rounded-xl border transition-all ${statusFilter === "" ? "ring-2 ring-blue-500 bg-blue-50" : "bg-white border-slate-200 hover:border-slate-300"}`}
            >
              <p className="text-xs font-medium text-slate-500 uppercase">All Requests</p>
              <p className="text-2xl font-bold text-slate-900">{clientMetrics.totalVisible || 0}</p>
            </button>
            <button
              onClick={() => handleFilterClick("PENDING_EXECUTION")}
              className={`text-left p-4 rounded-xl border transition-all ${statusFilter === "pending_execution" ? "ring-2 ring-amber-500 bg-amber-50" : "bg-white border-slate-200 hover:border-slate-300"}`}
            >
              <p className="text-xs font-medium text-slate-500 uppercase">Pending Execution</p>
              <p className="text-2xl font-bold text-slate-900">{(clientMetrics as DCOpsMetrics).pendingExecutionCount || 0}</p>
            </button>
            <button
              onClick={() => handleFilterClick("PARTIAL")}
              className={`text-left p-4 rounded-xl border transition-all ${statusFilter === "partial" ? "ring-2 ring-orange-500 bg-orange-50" : "bg-white border-slate-200 hover:border-slate-300"}`}
            >
              <p className="text-xs font-medium text-slate-500 uppercase">Partial Executed</p>
              <p className="text-2xl font-bold text-slate-900">{(clientMetrics as DCOpsMetrics).partiallyExecutedCount || 0}</p>
            </button>
            <button
              onClick={() => handleFilterClick("EXECUTED")}
              className={`text-left p-4 rounded-xl border transition-all ${statusFilter === "executed" ? "ring-2 ring-green-500 bg-green-50" : "bg-white border-slate-200 hover:border-slate-300"}`}
            >
              <p className="text-xs font-medium text-slate-500 uppercase">Executed</p>
              <p className="text-2xl font-bold text-slate-900">{(clientMetrics as DCOpsMetrics).executedCount || 0}</p>
            </button>
            <button
              onClick={() => handleFilterClick("CLOSED")}
              className={`text-left p-4 rounded-xl border transition-all ${statusFilter === "closed" ? "ring-2 ring-slate-500 bg-slate-50" : "bg-white border-slate-200 hover:border-slate-300"}`}
            >
              <p className="text-xs font-medium text-slate-500 uppercase">Closed</p>
              <p className="text-2xl font-bold text-slate-900">0</p>
            </button>
          </>
        ) : isAdmin ? (
          // Admin sees: All Requests, Pending, Approved, Rejected, Executed
          <>
            <button
              onClick={() => handleFilterClick("")}
              className={`text-left p-4 rounded-xl border transition-all ${statusFilter === "" ? "ring-2 ring-blue-500 bg-blue-50" : "bg-white border-slate-200 hover:border-slate-300"}`}
            >
              <p className="text-xs font-medium text-slate-500 uppercase">All Requests</p>
              <p className="text-2xl font-bold text-slate-900">{clientMetrics.totalVisible || 0}</p>
            </button>
            <button
              onClick={() => handleFilterClick("PENDING")}
              className={`text-left p-4 rounded-xl border transition-all ${statusFilter === "pending" ? "ring-2 ring-amber-500 bg-amber-50" : "bg-white border-slate-200 hover:border-slate-300"}`}
            >
              <p className="text-xs font-medium text-slate-500 uppercase">Pending</p>
              <p className="text-2xl font-bold text-slate-900">{(clientMetrics as ApproverMetrics).pendingCount || 0}</p>
            </button>
            <button
              onClick={() => handleFilterClick("APPROVED")}
              className={`text-left p-4 rounded-xl border transition-all ${statusFilter === "approved" ? "ring-2 ring-emerald-500 bg-emerald-50" : "bg-white border-slate-200 hover:border-slate-300"}`}
            >
              <p className="text-xs font-medium text-slate-500 uppercase">Approved</p>
              <p className="text-2xl font-bold text-slate-900">{(clientMetrics as ApproverMetrics).approvedCount || 0}</p>
            </button>
            <button
              onClick={() => handleFilterClick("REJECTED")}
              className={`text-left p-4 rounded-xl border transition-all ${statusFilter === "rejected" ? "ring-2 ring-red-500 bg-red-50" : "bg-white border-slate-200 hover:border-slate-300"}`}
            >
              <p className="text-xs font-medium text-slate-500 uppercase">Rejected</p>
              <p className="text-2xl font-bold text-slate-900">{(clientMetrics as ApproverMetrics).rejectedCount || 0}</p>
            </button>
            <button
              onClick={() => handleFilterClick("EXECUTED")}
              className={`text-left p-4 rounded-xl border transition-all ${statusFilter === "executed" ? "ring-2 ring-blue-500 bg-blue-50" : "bg-white border-slate-200 hover:border-slate-300"}`}
            >
              <p className="text-xs font-medium text-slate-500 uppercase">Executed</p>
              <p className="text-2xl font-bold text-slate-900">{(clientMetrics as ApproverMetrics).executedCount || 0}</p>
            </button>
          </>
        ) : (
          // Non-admin approvers see: Assigned, Pending, Approved, Rejected, Executed
          <>
            <button
              onClick={() => handleFilterClick("")}
              className={`text-left p-4 rounded-xl border transition-all ${statusFilter === "" ? "ring-2 ring-blue-500 bg-blue-50" : "bg-white border-slate-200 hover:border-slate-300"}`}
            >
              <p className="text-xs font-medium text-slate-500 uppercase">Assigned</p>
              <p className="text-2xl font-bold text-slate-900">{clientMetrics.totalVisible || 0}</p>
            </button>
            <button
              onClick={() => handleFilterClick("PENDING")}
              className={`text-left p-4 rounded-xl border transition-all ${statusFilter === "pending" ? "ring-2 ring-amber-500 bg-amber-50" : "bg-white border-slate-200 hover:border-slate-300"}`}
            >
              <p className="text-xs font-medium text-slate-500 uppercase">Pending</p>
              <p className="text-2xl font-bold text-slate-900">{(clientMetrics as ApproverMetrics).pendingCount || 0}</p>
            </button>
            <button
              onClick={() => handleFilterClick("APPROVED")}
              className={`text-left p-4 rounded-xl border transition-all ${statusFilter === "approved" ? "ring-2 ring-emerald-500 bg-emerald-50" : "bg-white border-slate-200 hover:border-slate-300"}`}
            >
              <p className="text-xs font-medium text-slate-500 uppercase">Approved</p>
              <p className="text-2xl font-bold text-slate-900">{(clientMetrics as ApproverMetrics).approvedCount || 0}</p>
            </button>
            <button
              onClick={() => handleFilterClick("REJECTED")}
              className={`text-left p-4 rounded-xl border transition-all ${statusFilter === "rejected" ? "ring-2 ring-red-500 bg-red-50" : "bg-white border-slate-200 hover:border-slate-300"}`}
            >
              <p className="text-xs font-medium text-slate-500 uppercase">Rejected</p>
              <p className="text-2xl font-bold text-slate-900">{(clientMetrics as ApproverMetrics).rejectedCount || 0}</p>
            </button>
            <button
              onClick={() => handleFilterClick("EXECUTED")}
              className={`text-left p-4 rounded-xl border transition-all ${statusFilter === "executed" ? "ring-2 ring-blue-500 bg-blue-50" : "bg-white border-slate-200 hover:border-slate-300"}`}
            >
              <p className="text-xs font-medium text-slate-500 uppercase">Executed</p>
              <p className="text-2xl font-bold text-slate-900">{(clientMetrics as ApproverMetrics).executedCount || 0}</p>
            </button>
          </>
        )}
      </div>

      {showSubdomainTab && (
        <div className="flex border-b border-slate-200 gap-6 mb-2">
          <button
            onClick={() => setActiveMainTab("requests")}
            className={`pb-3 text-sm font-bold border-b-2 transition-all ${
              activeMainTab === "requests"
                ? "border-blue-600 text-blue-600 font-extrabold"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            System Requests
          </button>
          <button
            onClick={() => setActiveMainTab("subdomains")}
            className={`pb-3 text-sm font-bold border-b-2 transition-all ${
              activeMainTab === "subdomains"
                ? "border-blue-600 text-blue-600 font-extrabold"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Subdomain Route Activations
          </button>
        </div>
      )}

      {activeMainTab === "requests" ? (
        <>
          {/* Filters Bar */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
           <div className="md:col-span-2 space-y-1.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Search Context</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search system, requester, project..." 
                  className="pl-9 h-11 bg-slate-50/50 border-slate-100 focus:bg-white transition-all shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
           </div>

           <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Work Status</p>
              <select 
                className="w-full h-11 px-3 py-2 rounded-md border border-slate-100 bg-slate-50/50 text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Lifecycle States</option>
                <option value="PENDING_L1">Pending L1</option>
                <option value="PENDING_L2">Pending L2</option>
                <option value="PENDING_L3">Pending L3</option>
                <option value="APPROVED">Ready for Execution</option>
                <option value="PROVISIONED">Provisioned</option>
                <option value="REJECTED">Rejected</option>
                <option value="CLOSED">Closed/Retired</option>
              </select>
           </div>
           <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Request Type</p>
              <select 
                className="w-full h-11 px-3 py-2 rounded-md border border-slate-100 bg-slate-50/50 text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="all">All Request Types</option>
                <option value="NEW_VM">Infrastructure: New VM</option>
                <option value="CUSTOMIZED">Infrastructure: Customization</option>
                <option value="DECOMMISSION">Lifecycle: Decommission</option>
              </select>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 border-t border-slate-50">
           <div className="flex items-center gap-4">
              <div className="flex-1 space-y-1">
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Start Date</p>
                 <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <Input 
                      type="date" 
                      className="pl-9 h-10 text-xs bg-slate-50/30 border-slate-100" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                 </div>
              </div>
              <div className="flex-1 space-y-1">
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">End Date</p>
                 <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <Input 
                      type="date" 
                      className="pl-9 h-10 text-xs bg-slate-50/30 border-slate-100" 
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                 </div>
              </div>
           </div>
           
           <div className="flex items-end md:col-span-2">
              <p className="text-[11px] text-slate-400 italic">Showing {filteredRequests.length} results from {initialRequests.length} total assigned</p>
           </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">System</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Requester</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="h-8 w-8 text-slate-300" />
                      <p className="text-sm font-medium">No requests match your filters</p>
                      <p className="text-xs text-slate-400">Try adjusting your search or filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => {
                  // ✅ SAFE requestType handling
                  const requestType = req.requestType || "UNKNOWN";
                  const isCustomization = requestType === "CUSTOMIZED";
                  const entityType = getEntityType(requestType);
                  
                  const requestLevel = getCurrentLevel(req.status);
                  const userLevels = getUserActionableLevels(userRoles);
                  
                  // ✅ KEY LOGIC: Only actionable if request level matches user's levels
                  const isActionableLevel = requestLevel !== null && userLevels.includes(requestLevel);
                  
                  // ✅ Permission check (extra safety layer)
                  const canShowApprovalButtons = isActionableLevel && canUserApprove(userRoles, `L${requestLevel}`);
                  
                  // ✅ Execute button: only for DCOPS on APPROVED requests
                  const canShowExecuteButton = req.status === "APPROVED" && userRoles.includes(ROLES.DCOPS);
                  
                  // ✅ FIND THE SPECIFIC APPROVAL ID FOR THIS REQUEST + USER
                  const approvalId = findApprovalId(req, userLevels);
                  
                  // ✅ SAFE CONFIG LOOKUP
                  const typeConfig = REQUEST_TYPE_CONFIG[requestType] || REQUEST_TYPE_CONFIG.UNKNOWN;
                  
                  // Format date safely
                  const createdAtDate = new Date(req.createdAt);
                  const formattedDate = isNaN(createdAtDate.getTime()) 
                    ? "Invalid Date" 
                    : format(createdAtDate, 'MMM dd, yyyy HH:mm');

                  return (
                    <tr 
                      key={req.id} 
                      className={`hover:bg-slate-50/50 transition-all ${
                        activeActionId === req.id ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      {/* System Name */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-bold text-slate-900">{req.systemName || 'Unnamed System'}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {req.projectName || 'No project'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Request Type */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge className={`font-black border px-2.5 py-1 shadow-none text-[10px] uppercase tracking-tight flex items-center ${typeConfig.color}`}>
                          {typeConfig.icon}
                          {typeConfig.label}
                        </Badge>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={req.status} />
                      </td>

                      {/* Requester */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <UserIcon className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-slate-900">{req.requester?.name || 'Unknown'}</div>
                            <div className="text-xs text-slate-500">{req.requester?.email || ''}</div>
                          </div>
                        </div>
                      </td>

                      {/* Created At */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {formattedDate}
                      </td>

                      {/* Actions Column */}
                      <td className="px-6 py-4">
                        <div className="flex justify-end items-center gap-2">
                          
                          {/* ✅ APPROVAL BUTTONS - Only show if level matches AND approvalId exists */}
                          {canShowApprovalButtons && approvalId && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-emerald-700 hover:bg-emerald-50"
                                onClick={() => onQuickAction(approvalId, entityType, "APPROVED")}
                                disabled={isPending || activeActionId === req.id}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Approve
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-orange-700 hover:bg-orange-50"
                                onClick={() => {
                                  setActiveActionId(req.id);
                                  setSelectedAction("RETURNED");
                                  setQuickComments("");
                                }}
                                disabled={isPending}
                                title="Return to draft"
                              >
                                <Undo2 className="h-3 w-3 mr-1" />
                                Return
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-blue-700 hover:bg-blue-50"
                                onClick={() => {
                                  setActiveActionId(req.id);
                                  setSelectedAction("FORWARDED");
                                  setForwardLevel((requestLevel || 0) + 1);
                                  setQuickComments("");
                                }}
                                disabled={isPending}
                                title="Forward to higher level"
                              >
                                <ArrowUpRight className="h-3 w-3 mr-1" />
                                Forward
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-red-700 hover:bg-red-50"
                                onClick={() => {
                                  setActiveActionId(req.id);
                                  setSelectedAction("REJECTED");
                                  setQuickComments("");
                                }}
                                disabled={isPending}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}

                          {/* ✅ EXECUTE BUTTON - Only for DCOPS on APPROVED */}
                          {canShowExecuteButton && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 bg-blue-600 hover:bg-blue-700 text-white border-blue-600 text-xs shadow"
                              onClick={() => {
                                // For NEW_VM, show the modal to collect VM details
                                if (req.requestType === "NEW_VM") {
                                  openProvisionModal(req);
                                } else if (req.requestType === "K8S_NAMESPACE") {
                                  setProvisionK8sModal({ open: true, requestId: req.id });
                                } else {
                                  // For other types (DECOMMISSION, RENEWAL, CUSTOMIZED), execute directly
                                  onQuickExecute(req.id);
                                }
                              }}
                              disabled={isPending}
                            >
                              <Zap className="h-3 w-3 mr-1" />
                              Execute
                            </Button>
                          )}

                          {/* ✅ View Details - Always visible */}
                          <Link href={`/approvals/${req.id}?type=${isCustomization ? 'customization' : 'request'}`}>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-9 w-9 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>

                        {/* ✅ INLINE COMMENT INPUT - For Reject/Return/Forward actions */}
                        {activeActionId === req.id && canShowApprovalButtons && approvalId && selectedAction && (
                          <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <div className="flex items-start gap-2">
                              <MessageSquare className={`h-4 w-4 mt-1 flex-shrink-0 ${
                                selectedAction === "REJECTED" ? "text-red-500" : 
                                selectedAction === "RETURNED" ? "text-orange-500" : "text-blue-500"
                              }`} />
                              <div className="flex-1">
                                {selectedAction === "FORWARDED" && (
                                  <div className="mb-2 flex items-center gap-2">
                                    <label className="text-xs font-medium text-slate-600">Forward to Level:</label>
                                    <select
                                      className="h-8 px-2 text-sm border border-slate-200 rounded bg-white"
                                      value={forwardLevel || (requestLevel || 0) + 1}
                                      onChange={(e) => setForwardLevel(parseInt(e.target.value, 10))}
                                    >
                                      {requestLevel && Array.from({ length: 5 - requestLevel }, (_, i) => (
                                        <option key={i + 1} value={requestLevel + i + 1}>
                                          Level {requestLevel + i + 1}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                                <Textarea
                                  placeholder={
                                    selectedAction === "REJECTED" ? "Required: Explain reason for rejection..." :
                                    selectedAction === "RETURNED" ? "Required: Explain reason for returning to draft..." :
                                    "Optional: Add comments for forwarding..."
                                  }
                                  value={quickComments}
                                  onChange={(e) => setQuickComments(e.target.value)}
                                  className={`min-h-[60px] text-sm ${
                                    selectedAction === "REJECTED" ? "border-red-200 focus:border-red-400" :
                                    selectedAction === "RETURNED" ? "border-orange-200 focus:border-orange-400" :
                                    "border-blue-200 focus:border-blue-400"
                                  }`}
                                />
                                <div className="flex justify-end gap-2 mt-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setActiveActionId(null);
                                      setSelectedAction(null);
                                      setForwardLevel(null);
                                      setQuickComments("");
                                    }}
                                    disabled={isPending}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    variant={selectedAction === "REJECTED" ? "destructive" : "default"}
                                    size="sm"
                                    className={
                                      selectedAction === "RETURNED" ? "bg-orange-600 hover:bg-orange-700" :
                                      selectedAction === "FORWARDED" ? "bg-blue-600 hover:bg-blue-700" : ""
                                    }
                                    onClick={() => {
                                      if (selectedAction === "FORWARDED" && forwardLevel) {
                                        onQuickAction(approvalId, entityType, "FORWARDED", forwardLevel);
                                      } else if (selectedAction === "RETURNED") {
                                        onQuickAction(approvalId, entityType, "RETURNED");
                                      } else {
                                        onQuickAction(approvalId, entityType, "REJECTED");
                                      }
                                    }}
                                    disabled={isPending || (
                                      (selectedAction === "REJECTED" || selectedAction === "RETURNED") && !quickComments.trim()
                                    )}
                                  >
                                    {isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      selectedAction === "REJECTED" ? "Confirm Reject" :
                                      selectedAction === "RETURNED" ? "Confirm Return" :
                                      `Forward to L${forwardLevel}`
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* ✅ Optional: Visual indicator for non-actionable requests */}
                        {!isActionableLevel && requestLevel && requestLevel !== 99 && (
                          <div className="mt-2 flex justify-end">
                            <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-200">
                              Level {requestLevel} • Assigned to another approver
                            </Badge>
                          </div>
                        )}
                        
                        {/* ✅ Debug: Show if approvalId is missing (helpful during development) */}
                        {process.env.NODE_ENV === 'development' && canShowApprovalButtons && !approvalId && (
                          <div className="mt-2 flex justify-end">
                            <Badge variant="destructive" className="text-[10px]">
                              ⚠️ No approval record found
                            </Badge>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      ) : (
        <SubdomainApprovalsPanel />
      )}

      {/* Provision VM Modal */}
      <ProvisionVMModal
        open={provisionModal.open}
        onOpenChange={(open) => setProvisionModal(prev => ({ ...prev, open }))}
        requestId={provisionModal.requestId}
        requestQuantity={provisionModal.requestQuantity}
        existingVmsCount={provisionModal.existingVmsCount}
        defaultSubdomain={provisionModal.defaultSubdomain}
        requesterId={provisionModal.requesterId}
        onSuccess={() => router.refresh()}
      />

      {/* Provision K8s Modal */}
      <ProvisionK8sModal
        open={provisionK8sModal.open}
        onOpenChange={(open) => setProvisionK8sModal(prev => ({ ...prev, open }))}
        requestId={provisionK8sModal.requestId}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}

// ✅ StatusBadge component
function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, string> = {
    PENDING_L1: "bg-orange-50 text-orange-700 border-orange-200",
    PENDING_L2: "bg-orange-50 text-orange-700 border-orange-200",
    PENDING_L3: "bg-orange-50 text-orange-700 border-orange-200",
    PENDING_L4: "bg-orange-50 text-orange-700 border-orange-200",
    APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    REJECTED: "bg-red-50 text-red-700 border-red-200",
    PROVISIONED: "bg-blue-50 text-blue-700 border-blue-200",
    CLOSED: "bg-slate-50 text-slate-700 border-slate-200",
    APPLIED: "bg-purple-50 text-purple-700 border-purple-200",
  };

  return (
    <Badge className={`font-black border px-2 shadow-none text-[9px] uppercase tracking-tighter ${
      configs[status] || "bg-slate-50 text-slate-700 border-slate-200"
    }`}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}