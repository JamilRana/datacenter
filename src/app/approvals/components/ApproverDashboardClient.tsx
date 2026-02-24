// src/app/approvals/components/ApproverDashboardClient.tsx
"use client";
import { ApprovalDecision } from "@prisma/client";

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
  ArrowUpDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { canUserApprove } from "@/lib/roles";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { handleApprovalDecision, executeRequest, executeRequestWithVmInputs } from "@/app/actions/approval-actions";
import { DashboardRequest } from "@/types/approvals";
import { VmExecutionModal } from "./VmExecutionModal";

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
  currentUserId: string 
}) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  const [isPending, startTransition] = useTransition();
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [quickComments, setQuickComments] = useState("");
  const [vmExecutionModal, setVmExecutionModal] = useState<{
    open: boolean;
    requestId: string;
    systemName: string;
    quantity: number;
    subdomain?: string | null;
  }>({ open: false, requestId: "", systemName: "", quantity: 1 });

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

  const filteredRequests = initialRequests.filter(req => {
    const matchesSearch = 
      req.systemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.requester?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || req.status === statusFilter;
    const matchesType = typeFilter === "all" || req.requestType === typeFilter;

    let matchesDate = true;
    if (startDate || endDate) {
      const createdAt = new Date(req.createdAt);
      if (startDate && createdAt < startOfDay(parseISO(startDate))) matchesDate = false;
      if (endDate && createdAt > endOfDay(parseISO(endDate))) matchesDate = false;
    }

    return matchesSearch && matchesStatus && matchesType && matchesDate;
  });

  // ✅ UPDATED: Now accepts approvalId instead of requestId
  async function onQuickAction(
    approvalId: string, 
    entityType: "REQUEST" | "CUSTOMIZATION", 
    decision: "APPROVED" | "REJECTED"
  ) {
    if (decision === "REJECTED" && !quickComments.trim()) {
      toast.error("Comments are required for rejection");
      return;
    }

    startTransition(async () => {
      try {
        // ✅ PASS approvalId (not requestId) to server action
        await handleApprovalDecision(approvalId, decision as ApprovalDecision, quickComments);
        toast.success(`Request ${decision.toLowerCase()} successfully`);
        setActiveActionId(null);
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

  function openVmExecutionModal(req: ApproverRequest) {
    setVmExecutionModal({
      open: true,
      requestId: req.id,
      systemName: req.systemName || "VM",
      quantity: (req as unknown as { quantity?: number }).quantity || 1,
      subdomain: (req as unknown as { subdomain?: string | null }).subdomain,
    });
  }

  async function handleVmExecute(requestId: string, vmInputs: {
    sequenceNumber: number;
    hostname: string;
    ipAddress: string;
    publicIpAddress: string;
    subdomain: string;
  }[]) {
    await executeRequestWithVmInputs(requestId, vmInputs, "Executed via dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-6">
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
                                className="h-8 text-xs text-red-700 hover:bg-red-50"
                                onClick={() => {
                                  setActiveActionId(req.id);
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
                                  openVmExecutionModal(req);
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

                        {/* ✅ INLINE COMMENT INPUT - Only for actionable rejections */}
                        {activeActionId === req.id && canShowApprovalButtons && approvalId && (
                          <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <div className="flex items-start gap-2">
                              <MessageSquare className="h-4 w-4 text-orange-500 mt-1 flex-shrink-0" />
                              <div className="flex-1">
                                <Textarea
                                  placeholder="Required: Explain reason for rejection..."
                                  value={quickComments}
                                  onChange={(e) => setQuickComments(e.target.value)}
                                  className="min-h-[60px] text-sm border-orange-200 focus:border-orange-400"
                                />
                                <div className="flex justify-end gap-2 mt-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setActiveActionId(null);
                                      setQuickComments("");
                                    }}
                                    disabled={isPending}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => onQuickAction(approvalId, entityType, "REJECTED")}
                                    disabled={isPending || !quickComments.trim()}
                                  >
                                    {isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      'Confirm Reject'
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

      {/* VM Execution Modal */}
      <VmExecutionModal
        open={vmExecutionModal.open}
        onOpenChange={(open) => setVmExecutionModal(prev => ({ ...prev, open }))}
        requestId={vmExecutionModal.requestId}
        systemName={vmExecutionModal.systemName}
        quantity={vmExecutionModal.quantity}
        requestSubdomain={vmExecutionModal.subdomain}
        onExecute={handleVmExecute}
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