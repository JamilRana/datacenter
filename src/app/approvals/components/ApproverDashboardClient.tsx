// src/app/approvals/components/ApproverDashboardClient.tsx
"use client";
import type { ApprovalDecision } from "@prisma/client";

import { useState, useEffect, useTransition, useMemo } from "react";
import type { ReactNode } from "react";
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
  Undo2,
  Copy,
  Code,
  Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { canUserApprove, getUserActionableLevels } from "@/lib/roles";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { handleApprovalDecision, executeRequest, forwardToLevel } from "@/app/actions/approval-actions";
import { DashboardRequest } from "@/types/approvals";
import { ProvisionVMModal } from "./ProvisionVMModal";
import { ProvisionK8sModal } from "./ProvisionK8sModal";
import { SubdomainApprovalsPanel } from "./SubdomainApprovalsPanel";
import { Pagination } from "@/components/Pagination";

interface ApproverRequest extends Omit<DashboardRequest, "createdAt"> {
  createdAt: string | Date;
}

// ✅ TYPE BADGE CONFIGURATION
const REQUEST_TYPE_CONFIG: Record<string, { label: string; color: string; icon: ReactNode }> = {
  NEW_VM: { 
    label: "New VM", 
    color: "bg-blue-50 text-blue-700 border-blue-200", 
    icon: <HardDrive className="h-3 w-3 mr-1" /> 
  },
  CLONE_VM: { 
    label: "Clone VM", 
    color: "bg-sky-50 text-sky-700 border-sky-200", 
    icon: <Copy className="h-3 w-3 mr-1" /> 
  },
  K8S_NAMESPACE: { 
    label: "K8s Namespace", 
    color: "bg-cyan-50 text-cyan-700 border-cyan-200", 
    icon: <Code className="h-3 w-3 mr-1" /> 
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
  VPN_ACCESS: { 
    label: "VPN Access", 
    color: "bg-teal-50 text-teal-700 border-teal-200", 
    icon: <Shield className="h-3 w-3 mr-1" /> 
  },
  HORIZON_ACCESS: { 
    label: "Horizon Access", 
    color: "bg-emerald-50 text-emerald-700 border-emerald-200", 
    icon: <Shield className="h-3 w-3 mr-1" /> 
  },
  SYSTEM_UPGRADE: { 
    label: "System Upgrade", 
    color: "bg-indigo-50 text-indigo-700 border-indigo-200", 
    icon: <Zap className="h-3 w-3 mr-1" /> 
  },
  UNKNOWN: {
    label: "Unknown Type", 
    color: "bg-slate-50 text-slate-700 border-slate-200", 
    icon: null 
  },
};

// ✅ DETERMINE CURRENT APPROVAL LEVEL FROM STATUS (returns number)
function getCurrentLevel(status?: string): number | null {
  if (!status) return null;
  const match = status.match(/^PENDING_L(\d+)$/);
  if (match) return parseInt(match[1], 10);
  return null;
}

export interface DynamicWorkflowLevelItem {
  level: number;
  role: string;
  roleLabel: string;
  statusCode: string;
  displayName: string;
  shortName: string;
}

export function ApproverDashboardClient({ 
  initialRequests, 
  userRoles,
  currentUserId: _currentUserId,
  initialStatusFilter,
  workflowLevels,
  workflowConfigs,
}: { 
  initialRequests: ApproverRequest[];
  userRoles: string[];
  currentUserId?: string;
  initialStatusFilter?: string;
  workflowLevels?: DynamicWorkflowLevelItem[];
  workflowConfigs?: Record<string, { requestType: string; levels: Array<{ level: number; role: string; roleLabel: string | null; isFinal: boolean }> }>;
}) {
  const router = useRouter();

  // Determine user roles and actionable approver levels
  const isAdmin = userRoles.includes("ADMIN");
  const isDCOps = userRoles.includes("DC_OPS");
  const isL1 = userRoles.includes("APPROVER_L1") || userRoles.includes("L1_APPROVER");
  const isL2 = userRoles.includes("APPROVER_L2") || userRoles.includes("L2_APPROVER");
  const isL3 = userRoles.includes("APPROVER_L3") || userRoles.includes("L3_APPROVER");
  const isL4 = userRoles.includes("APPROVER_L4") || userRoles.includes("L4_APPROVER");

  const userActionableLevels = getUserActionableLevels(userRoles);
  const isSpecificApprover = isL1 || isL2 || isL3 || isL4;
  const _isPureAdmin = isAdmin && !isSpecificApprover && !isDCOps;
  const showSubdomainTab = isL1 || isDCOps || isAdmin;

  // Default filter: Approvers default to their assigned level(s), DCOps to pending execution, pure admins to "all"
  const defaultStatusFilter = (() => {
    if (isSpecificApprover) {
      if (userActionableLevels.length === 1) {
        return `PENDING_L${userActionableLevels[0]}`;
      }
      return "MY_LEVELS";
    }
    if (isDCOps) {
      return "pending_execution";
    }
    return "all";
  })();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter || defaultStatusFilter);
  const [typeFilter, setTypeFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [activeMainTab, setActiveMainTab] = useState<"requests" | "subdomains">("requests");

  // Dynamic workflow levels reflecting active request type or all distinct system workflows
  const activeLevels = useMemo(() => {
    if (typeFilter && typeFilter !== "all" && workflowConfigs && workflowConfigs[typeFilter]) {
      return workflowConfigs[typeFilter].levels.map(l => ({
        level: l.level,
        role: l.role,
        roleLabel: l.roleLabel || `Level ${l.level}`,
        statusCode: `PENDING_L${l.level}`,
        displayName: `Level ${l.level} - ${l.roleLabel || l.role}`,
        shortName: (l.roleLabel || l.role).replace(/Assistant/i, "Asstt."),
      }));
    }
    return workflowLevels && workflowLevels.length > 0 ? workflowLevels : [
      { level: 1, role: "APPROVER_L1", roleLabel: "Assistant Maintenance Engineer", statusCode: "PENDING_L1", displayName: "Level 1 - Assistant Maintenance Engineer", shortName: "Asstt. Maintenance Engineer" },
      { level: 2, role: "APPROVER_L2", roleLabel: "Maintenance Engineer", statusCode: "PENDING_L2", displayName: "Level 2 - Maintenance Engineer", shortName: "Maintenance Engineer" },
      { level: 3, role: "APPROVER_L3", roleLabel: "System Analyst", statusCode: "PENDING_L3", displayName: "Level 3 - System Analyst", shortName: "System Analyst" },
      { level: 4, role: "DC_OPS", roleLabel: "DC Ops", statusCode: "PENDING_L4", displayName: "Level 4 - DC Ops", shortName: "DC Ops" },
    ];
  }, [typeFilter, workflowConfigs, workflowLevels]);

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
    myPendingCount: number;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
    executedCount: number;
  }

  const myActionablePending = initialRequests.filter(r => {
    const lvl = getCurrentLevel(r.status);
    return lvl !== null && userActionableLevels.includes(lvl);
  }).length;

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
      myPendingCount: myActionablePending,
      pendingCount: initialRequests.filter(r => r.status?.startsWith('PENDING_L')).length,
      approvedCount: initialRequests.filter(r => r.status === 'APPROVED' || r.status === 'PROVISIONED' || r.status === 'PARTIALLY_PROVISIONED').length,
      rejectedCount: initialRequests.filter(r => r.status === 'REJECTED').length,
      executedCount: initialRequests.filter(r => r.status === 'PROVISIONED' || r.status === 'PARTIALLY_PROVISIONED' || r.status === 'CLOSED').length,
    };
  }

  const handleFilterClick = (filter: string) => {
    setStatusFilter(filter);
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
    vmSpecifications: any[];
  }>({ 
    open: false, 
    requestId: "", 
    requestQuantity: 1, 
    existingVmsCount: 0,
    defaultSubdomain: "",
    requesterId: "",
    vmSpecifications: []
  });

  const [provisionK8sModal, setProvisionK8sModal] = useState<{
    open: boolean;
    requestId: string;
  }>({
    open: false,
    requestId: ""
  });

  // ✅ FIND THE SPECIFIC APPROVAL ID FOR THIS REQUEST + LEVEL
  const findApprovalId = (request: ApproverRequest, userLevels: number[]): string | null => {
    const requestLevel = getCurrentLevel(request.status);
    if (!requestLevel || !userLevels.includes(requestLevel)) return null;
    
    // Find pending approval for this request level
    const relevantApproval = request.approvals?.find(approval => 
      approval.level === requestLevel && 
      approval.decision === "PENDING"
    );
    
    return relevantApproval?.id || request.id;
  };

  const getEntityType = (requestType?: string): "REQUEST" | "CUSTOMIZATION" => {
    return requestType === "CUSTOMIZED" ? "CUSTOMIZATION" : "REQUEST";
  };

  const filteredRequests = sortedRequests.filter(req => {
    const matchesSearch = 
      req.systemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.requester?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Status filter mapping - supports level-wise, assigned level(s), and standard lifecycle statuses
    let matchesStatus = true;
    const filter = (statusFilter || "").toUpperCase();

    if (!filter || filter === "ALL") {
      matchesStatus = true;
    } else if (filter === "MY_LEVELS") {
      const reqLevel = getCurrentLevel(req.status);
      matchesStatus = reqLevel !== null && userActionableLevels.includes(reqLevel);
    } else if (filter === "PENDING") {
      matchesStatus = req.status?.startsWith("PENDING_L") || false;
    } else if (filter.startsWith("PENDING_L")) {
      matchesStatus = req.status === filter;
    } else if (filter === "APPROVED" || filter === "PENDING_EXECUTION") {
      matchesStatus = req.status === "APPROVED";
    } else if (filter === "PARTIAL" || filter === "PARTIALLY_PROVISIONED") {
      matchesStatus = req.status === "PARTIALLY_PROVISIONED";
    } else if (filter === "PROVISIONED") {
      matchesStatus = req.status === "PROVISIONED";
    } else if (filter === "EXECUTED") {
      matchesStatus = req.status === "PROVISIONED" || req.status === "PARTIALLY_PROVISIONED" || req.status === "CLOSED";
    } else if (filter === "REJECTED") {
      matchesStatus = req.status === "REJECTED";
    } else if (filter === "CLOSED") {
      matchesStatus = req.status === "CLOSED";
    } else {
      matchesStatus = req.status?.toUpperCase() === filter;
    }
    
    const matchesType = typeFilter === "all" || req.requestType === typeFilter;

    let matchesDate = true;
    if (startDate || endDate) {
      const createdAt = new Date(req.createdAt);
      if (startDate && createdAt < startOfDay(parseISO(startDate))) matchesDate = false;
      if (endDate && createdAt > endOfDay(parseISO(endDate))) matchesDate = false;
    }

    return matchesSearch && matchesStatus && matchesType && matchesDate;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, typeFilter, startDate, endDate]);

  const totalPages = Math.ceil(filteredRequests.length / pageSize) || 1;
  const paginatedRequests = filteredRequests.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

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
    const requestQuantity = req.quantity || req.vmSpecifications?.length || 1;
    const existingVmsCount = req.vmInstances?.length || 0;
    const requesterId = req.requester?.id || req.requesterId || "";
    const subdomain = req.subdomain || "";
    const vmSpecifications = req.vmSpecifications || [];
    
    setProvisionModal({
      open: true,
      requestId: req.id,
      requestQuantity,
      existingVmsCount,
      defaultSubdomain: subdomain,
      requesterId,
      vmSpecifications,
    });
  }

  return (
    <div className="space-y-6">
      {/* Metrics Cards - Different for DCOPS vs Approvers/Admins */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {isDCOps ? (
          // DCOPS sees: Pending Execution, Partially Executed, Executed, Closed
          <>
            <button
              onClick={() => handleFilterClick("all")}
              className={`text-left p-4 rounded-xl border transition-all ${statusFilter === "all" || statusFilter === "" ? "ring-2 ring-blue-500 bg-blue-50" : "bg-white border-slate-200 hover:border-slate-300"}`}
            >
              <p className="text-xs font-medium text-slate-500 uppercase">All Requests</p>
              <p className="text-2xl font-bold text-slate-900">{clientMetrics.totalVisible || 0}</p>
            </button>
            <button
              onClick={() => handleFilterClick("pending_execution")}
              className={`text-left p-4 rounded-xl border transition-all ${statusFilter.toLowerCase() === "pending_execution" || statusFilter.toUpperCase() === "APPROVED" ? "ring-2 ring-amber-500 bg-amber-50" : "bg-white border-slate-200 hover:border-slate-300"}`}
            >
              <p className="text-xs font-medium text-slate-500 uppercase">Pending Execution</p>
              <p className="text-2xl font-bold text-slate-900">{(clientMetrics as DCOpsMetrics).pendingExecutionCount || 0}</p>
            </button>
            <button
              onClick={() => handleFilterClick("PARTIAL")}
              className={`text-left p-4 rounded-xl border transition-all ${statusFilter.toUpperCase() === "PARTIAL" || statusFilter.toUpperCase() === "PARTIALLY_PROVISIONED" ? "ring-2 ring-orange-500 bg-orange-50" : "bg-white border-slate-200 hover:border-slate-300"}`}
            >
              <p className="text-xs font-medium text-slate-500 uppercase">Partial Executed</p>
              <p className="text-2xl font-bold text-slate-900">{(clientMetrics as DCOpsMetrics).partiallyExecutedCount || 0}</p>
            </button>
            <button
              onClick={() => handleFilterClick("EXECUTED")}
              className={`text-left p-4 rounded-xl border transition-all ${statusFilter.toUpperCase() === "EXECUTED" || statusFilter.toUpperCase() === "PROVISIONED" ? "ring-2 ring-green-500 bg-green-50" : "bg-white border-slate-200 hover:border-slate-300"}`}
            >
              <p className="text-xs font-medium text-slate-500 uppercase">Executed</p>
              <p className="text-2xl font-bold text-slate-900">{(clientMetrics as DCOpsMetrics).executedCount || 0}</p>
            </button>
            <button
              onClick={() => handleFilterClick("CLOSED")}
              className={`text-left p-4 rounded-xl border transition-all ${statusFilter.toUpperCase() === "CLOSED" ? "ring-2 ring-slate-500 bg-slate-50" : "bg-white border-slate-200 hover:border-slate-300"}`}
            >
              <p className="text-xs font-medium text-slate-500 uppercase">Closed</p>
              <p className="text-2xl font-bold text-slate-900">{initialRequests.filter(r => r.status === "CLOSED").length}</p>
            </button>
          </>
        ) : isSpecificApprover ? (
          // Approvers (even if they also hold ADMIN role): Assigned Queue, All Requests, All Pending, DC Ops Ready, Executed
          <>
            <button
              onClick={() => handleFilterClick(userActionableLevels.length === 1 ? `PENDING_L${userActionableLevels[0]}` : "MY_LEVELS")}
              className={`text-left p-4 rounded-xl border transition-all ${
                statusFilter === "MY_LEVELS" || (userActionableLevels.length === 1 && statusFilter.toUpperCase() === `PENDING_L${userActionableLevels[0]}`)
                  ? "ring-2 ring-indigo-500 bg-indigo-50/80 shadow-xs"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-indigo-700 uppercase">
                  My Pending {userActionableLevels.map(l => `L${l}`).join("/")}
                </p>
                <Badge className="bg-indigo-100 text-indigo-700 border-none text-[9px] px-1.5 py-0 font-bold">Assigned</Badge>
              </div>
              <p className="text-2xl font-bold text-indigo-950 mt-1">{(clientMetrics as ApproverMetrics).myPendingCount || 0}</p>
            </button>
            <button
              onClick={() => handleFilterClick("all")}
              className={`text-left p-4 rounded-xl border transition-all ${statusFilter === "all" || statusFilter === "" ? "ring-2 ring-blue-500 bg-blue-50" : "bg-white border-slate-200 hover:border-slate-300"}`}
            >
              <p className="text-xs font-medium text-slate-500 uppercase">All Requests</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{clientMetrics.totalVisible || 0}</p>
            </button>
            <button
              onClick={() => handleFilterClick("pending")}
              className={`text-left p-4 rounded-xl border transition-all ${statusFilter.toLowerCase() === "pending" ? "ring-2 ring-amber-500 bg-amber-50" : "bg-white border-slate-200 hover:border-slate-300"}`}
            >
              <p className="text-xs font-medium text-slate-500 uppercase">All Pending</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{(clientMetrics as ApproverMetrics).pendingCount || 0}</p>
            </button>
            <button
              onClick={() => handleFilterClick("APPROVED")}
              className={`text-left p-4 rounded-xl border transition-all ${statusFilter.toUpperCase() === "APPROVED" ? "ring-2 ring-emerald-500 bg-emerald-50" : "bg-white border-slate-200 hover:border-slate-300"}`}
            >
              <p className="text-xs font-medium text-slate-500 uppercase">DC Ops Ready</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{initialRequests.filter(r => r.status === "APPROVED").length}</p>
            </button>
            <button
              onClick={() => handleFilterClick("EXECUTED")}
              className={`text-left p-4 rounded-xl border transition-all ${statusFilter.toUpperCase() === "EXECUTED" || statusFilter.toUpperCase() === "PROVISIONED" ? "ring-2 ring-blue-500 bg-blue-50" : "bg-white border-slate-200 hover:border-slate-300"}`}
            >
              <p className="text-xs font-medium text-slate-500 uppercase">Executed</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{(clientMetrics as ApproverMetrics).executedCount || 0}</p>
            </button>
          </>
        ) : (
          // Pure Admin: All Requests, All Pending, DC Ops Ready, Rejected, Executed
          <>
            <button
              onClick={() => handleFilterClick("all")}
              className={`text-left p-4 rounded-xl border transition-all ${statusFilter === "all" || statusFilter === "" ? "ring-2 ring-blue-500 bg-blue-50" : "bg-white border-slate-200 hover:border-slate-300"}`}
            >
              <p className="text-xs font-medium text-slate-500 uppercase">All Requests</p>
              <p className="text-2xl font-bold text-slate-900">{clientMetrics.totalVisible || 0}</p>
            </button>
            <button
              onClick={() => handleFilterClick("pending")}
              className={`text-left p-4 rounded-xl border transition-all ${statusFilter.toLowerCase() === "pending" ? "ring-2 ring-amber-500 bg-amber-50" : "bg-white border-slate-200 hover:border-slate-300"}`}
            >
              <p className="text-xs font-medium text-slate-500 uppercase">Pending Approvals</p>
              <p className="text-2xl font-bold text-slate-900">{(clientMetrics as ApproverMetrics).pendingCount || 0}</p>
            </button>
            <button
              onClick={() => handleFilterClick("APPROVED")}
              className={`text-left p-4 rounded-xl border transition-all ${statusFilter.toUpperCase() === "APPROVED" ? "ring-2 ring-emerald-500 bg-emerald-50" : "bg-white border-slate-200 hover:border-slate-300"}`}
            >
              <p className="text-xs font-medium text-slate-500 uppercase">DC Ops Ready</p>
              <p className="text-2xl font-bold text-slate-900">{initialRequests.filter(r => r.status === "APPROVED").length}</p>
            </button>
            <button
              onClick={() => handleFilterClick("REJECTED")}
              className={`text-left p-4 rounded-xl border transition-all ${statusFilter.toUpperCase() === "REJECTED" ? "ring-2 ring-red-500 bg-red-50" : "bg-white border-slate-200 hover:border-slate-300"}`}
            >
              <p className="text-xs font-medium text-slate-500 uppercase">Rejected</p>
              <p className="text-2xl font-bold text-slate-900">{(clientMetrics as ApproverMetrics).rejectedCount || 0}</p>
            </button>
            <button
              onClick={() => handleFilterClick("EXECUTED")}
              className={`text-left p-4 rounded-xl border transition-all ${statusFilter.toUpperCase() === "EXECUTED" || statusFilter.toUpperCase() === "PROVISIONED" ? "ring-2 ring-blue-500 bg-blue-50" : "bg-white border-slate-200 hover:border-slate-300"}`}
            >
              <p className="text-xs font-medium text-slate-500 uppercase">Executed</p>
              <p className="text-2xl font-bold text-slate-900">{(clientMetrics as ApproverMetrics).executedCount || 0}</p>
            </button>
          </>
        )}
      </div>

      {showSubdomainTab && (
        <div className="flex border-b border-slate-200 gap-6 mb-2 overflow-x-auto whitespace-nowrap scrollbar-none">
          <button
            onClick={() => setActiveMainTab("requests")}
            className={`pb-3 text-sm font-bold border-b-2 transition-all shrink-0 ${
              activeMainTab === "requests"
                ? "border-blue-600 text-blue-600 font-extrabold"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            System Requests
          </button>
          <button
            onClick={() => setActiveMainTab("subdomains")}
            className={`pb-3 text-sm font-bold border-b-2 transition-all shrink-0 ${
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
            {/* Quick Level Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
                Level Filter:
              </span>
              {isSpecificApprover && (
                <button
                  type="button"
                  onClick={() => setStatusFilter(userActionableLevels.length === 1 ? `PENDING_L${userActionableLevels[0]}` : "MY_LEVELS")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all border ${
                    statusFilter === "MY_LEVELS" || (userActionableLevels.length === 1 && statusFilter.toUpperCase() === `PENDING_L${userActionableLevels[0]}`)
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                  }`}
                >
                  ★ My Level ({userActionableLevels.map(l => `L${l}`).join(", ")})
                </button>
              )}
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border ${
                  statusFilter === "all" || statusFilter === ""
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm font-bold"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                All Requests
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("pending")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border ${
                  statusFilter.toLowerCase() === "pending"
                    ? "bg-amber-600 text-white border-amber-600 shadow-sm font-bold"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-amber-50 hover:border-amber-300"
                }`}
              >
                All Pending
              </button>
              {activeLevels.map((lvl) => {
                const isSelected = statusFilter.toUpperCase() === lvl.statusCode;
                const isUserLevel = userActionableLevels.includes(lvl.level);
                return (
                  <button
                    key={lvl.level}
                    type="button"
                    onClick={() => setStatusFilter(lvl.statusCode)}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-all border flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-amber-500 text-white border-amber-500 shadow-sm font-bold"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-amber-50 hover:border-amber-300 font-medium"
                    }`}
                    title={lvl.roleLabel}
                  >
                    <span>Level {lvl.level}</span>
                    <span className="text-[10px] opacity-80 font-normal hidden sm:inline">({lvl.shortName})</span>
                    {isUserLevel && !isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block ml-0.5" title="Assigned to you" />
                    )}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setStatusFilter("APPROVED")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border ${
                  statusFilter.toUpperCase() === "APPROVED" || statusFilter.toLowerCase() === "pending_execution"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm font-bold"
                    : "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                }`}
              >
                Ready for DC Ops
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("EXECUTED")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border ${
                  statusFilter.toUpperCase() === "EXECUTED" || statusFilter.toUpperCase() === "PROVISIONED"
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm font-bold"
                    : "bg-white text-blue-700 border-blue-200 hover:bg-blue-50"
                }`}
              >
                Executed
              </button>
            </div>

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
                  {isSpecificApprover && (
                    <option value={userActionableLevels.length === 1 ? `PENDING_L${userActionableLevels[0]}` : "MY_LEVELS"}>
                      ★ My Level ({userActionableLevels.map(l => `L${l}`).join(", ")}) (Default)
                    </option>
                  )}
                  <option value="all">All Requests</option>
                  <option value="pending">All Pending Approvals</option>
                  {activeLevels.map((lvl) => (
                    <option key={lvl.level} value={lvl.statusCode}>
                      Level {lvl.level}: {lvl.roleLabel} ({lvl.statusCode.replace(/_/g, " ")})
                    </option>
                  ))}
                  <option value="APPROVED">Ready for DC Ops Execution</option>
                  <option value="PARTIAL">Partially Provisioned</option>
                  <option value="PROVISIONED">Fully Provisioned</option>
                  <option value="EXECUTED">All Executed (Provisioned/Closed)</option>
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
                  <optgroup label="Infrastructure">
                    <option value="NEW_VM">New VM</option>
                    <option value="CLONE_VM">Clone VM</option>
                    <option value="CUSTOMIZED">VM Customization</option>
                    <option value="SYSTEM_UPGRADE">System Upgrade</option>
                  </optgroup>
                  <optgroup label="Containers">
                    <option value="K8S_NAMESPACE">K8s Namespace</option>
                  </optgroup>
                  <optgroup label="Access">
                    <option value="VPN_ACCESS">VPN Access</option>
                    <option value="HORIZON_ACCESS">Horizon Access</option>
                  </optgroup>
                  <optgroup label="Lifecycle">
                    <option value="RENEWAL">Renewal</option>
                    <option value="DECOMMISSION">Decommission</option>
                  </optgroup>
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
              
              <div className="flex items-end justify-between md:col-span-2">
                <p className="text-[11px] text-slate-500 italic">
                  Showing <strong className="text-slate-800">{filteredRequests.length}</strong> results from{" "}
                  <strong className="text-slate-800">{initialRequests.length}</strong> total
                  {statusFilter && statusFilter !== "all" && (
                    <span className="ml-2 not-italic">
                      (Filtered by: <span className="font-semibold text-indigo-600">
                        {statusFilter === "MY_LEVELS" 
                          ? `My Level (${userActionableLevels.map(l => `L${l}`).join(", ")})` 
                          : activeLevels.find(l => l.statusCode === statusFilter)?.displayName || statusFilter.replace(/_/g, " ")}
                      </span>)
                    </span>
                  )}
                </p>
                {statusFilter && statusFilter !== "all" && (
                  <button
                    type="button"
                    onClick={() => setStatusFilter("all")}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline ml-auto cursor-pointer"
                  >
                    Show All Requests
                  </button>
                )}
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
                paginatedRequests.map((req) => {
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
                  
                  // ✅ Execute button: for DCOPS on APPROVED or PARTIALLY_PROVISIONED requests
                  const canShowExecuteButton = (req.status === "APPROVED" || req.status === "PARTIALLY_PROVISIONED") && userRoles.includes(ROLES.DCOPS);
                  
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
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-bold text-slate-900">{req.systemName || 'Unnamed System'}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {req.projectName || 'No project'}
                            </div>
                            {req.summary && (req.summary.vmCount > 0 || req.summary.namespaceCount > 0 || req.summary.cpu > 0 || req.summary.ram > 0 || req.summary.storage > 0) && (
                              <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[10px] text-slate-650 font-bold bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5 w-fit">
                                {req.summary.vmCount > 0 && (
                                  <span className="text-indigo-650">{req.summary.vmCount} VM{req.summary.vmCount > 1 ? 's' : ''}</span>
                                )}
                                {req.summary.namespaceCount > 0 && (
                                  <span className="text-cyan-600">{req.summary.namespaceCount} K8s Namespace{req.summary.namespaceCount > 1 ? 's' : ''}</span>
                                )}
                                {(req.summary.cpu > 0 || req.summary.ram > 0 || req.summary.storage > 0) && (
                                  <span className="text-slate-500 font-mono">
                                    ({[
                                      req.summary.cpu > 0 ? `${req.summary.cpu}c` : '',
                                      req.summary.ram > 0 ? `${req.summary.ram}GB` : '',
                                      req.summary.storage > 0 ? `${req.summary.storage}GB` : ''
                                    ].filter(Boolean).join("/")})
                                  </span>
                                )}
                              </div>
                            )}
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
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs font-bold text-emerald-700 border-emerald-250 bg-emerald-50/30 hover:bg-emerald-50 hover:text-emerald-800 shadow-sm"
                                onClick={() => onQuickAction(approvalId, entityType, "APPROVED")}
                                disabled={isPending || activeActionId === req.id}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 text-orange-600 border-orange-200 bg-orange-50/30 hover:bg-orange-50 hover:text-orange-700 shadow-sm"
                                onClick={() => {
                                  setActiveActionId(req.id);
                                  setSelectedAction("RETURNED");
                                  setQuickComments("");
                                }}
                                disabled={isPending}
                                title="Return to draft"
                              >
                                <Undo2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 text-blue-600 border-blue-200 bg-blue-50/30 hover:bg-blue-50 hover:text-blue-700 shadow-sm"
                                onClick={() => {
                                  setActiveActionId(req.id);
                                  setSelectedAction("FORWARDED");
                                  setForwardLevel((requestLevel || 0) + 1);
                                  setQuickComments("");
                                }}
                                disabled={isPending}
                                title="Forward to higher level"
                              >
                                <ArrowUpRight className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 text-red-605 border-red-200 bg-red-50/30 hover:bg-red-55 hover:text-red-700 shadow-sm"
                                onClick={() => {
                                  setActiveActionId(req.id);
                                  setSelectedAction("REJECTED");
                                  setQuickComments("");
                                }}
                                disabled={isPending}
                                title="Reject request"
                              >
                                <XCircle className="h-4 w-4" />
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
                                // For NEW_VM and CLONE_VM, show the modal to collect VM details
                                if (req.requestType === "NEW_VM" || req.requestType === "CLONE_VM") {
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

        {/* Pagination Footer */}
        {filteredRequests.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200 gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-500">
                Showing <strong className="text-slate-800">{(currentPage - 1) * pageSize + 1}</strong> to{" "}
                <strong className="text-slate-800">{Math.min(currentPage * pageSize, filteredRequests.length)}</strong> of{" "}
                <strong className="text-slate-800">{filteredRequests.length}</strong> requests
              </span>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-8 px-2 border border-slate-200 rounded-lg bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
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
        vmSpecifications={provisionModal.vmSpecifications}
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