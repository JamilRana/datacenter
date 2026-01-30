"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
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
  MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import {  canUserApprove } from "@/lib/roles";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { handleApprovalDecision,  executeRequest } from "@/app/actions/approval-actions";
import { DashboardRequest } from "@/types/approvals";

interface ApproverRequest extends Omit<DashboardRequest, "createdAt"> {
  createdAt: string | Date; // Handle serialization
}

export function ApproverDashboardClient({ 
  initialRequests, 
  userRoles 
}: { 
  initialRequests: ApproverRequest[], 
  userRoles: string[] 
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

  async function onQuickAction(requestId: string, decision: "APPROVED" | "REJECTED") {
    if (decision === "REJECTED" && !quickComments) {
      toast.error("Comments are required for rejection");
      return;
    }

    startTransition(async () => {
      try {
        await handleApprovalDecision(requestId, decision, quickComments);
        toast.success(`Request ${decision.toLowerCase()} successfully`);
        setActiveActionId(null);
        setQuickComments("");
        router.refresh();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error) {
        toast.error(`Action failed: ${error}`);
      }
    });
  }

  async function onQuickExecute(requestId: string) {
    startTransition(async () => {
      try {
        await executeRequest(requestId, "Executed via dashboard quick action");
        toast.success("Request executed successfully");
        router.refresh();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error) {
        toast.error(`Execution failed: ${error}`);
      }
    });
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
      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden transition-all duration-500">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#f8fafc] border-b border-slate-200">
              <tr>
                <th className="px-6 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">System & Project</th>
                <th className="px-6 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Requester</th>
                <th className="px-6 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Type</th>
                <th className="px-6 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Current Status</th>
                <th className="px-6 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Submitted</th>
                <th className="px-6 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequests.map((req) => {
                let currentLevel = "";
                if (req.status === "PENDING_L1") currentLevel = "L1";
                else if (req.status === "PENDING_L2") currentLevel = "L2";
                else if (req.status === "PENDING_L3") currentLevel = "L3";
                else if (req.status === "APPROVED") currentLevel = "DCOPS";

                const canAct = canUserApprove(userRoles, currentLevel);
                const isDcOps = currentLevel === "DCOPS";

                return (
                  <tr key={req.id} className={`hover:bg-slate-50/50 transition-all group ${activeActionId === req.id ? "bg-blue-50/30" : ""}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                         <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-white to-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 group-hover:border-blue-200 group-hover:text-blue-500 transition-all shadow-sm">
                            <HardDrive className="h-5 w-5" />
                         </div>
                         <div>
                            <p className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors leading-tight">{req.systemName}</p>
                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{req.projectName || "Generic Project"}</p>
                         </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                         <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200/50">
                            <UserIcon className="h-3.5 w-3.5 text-slate-400" />
                         </div>
                         <p className="text-sm font-bold text-slate-600 truncate max-w-[120px]">{req.requester?.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className="font-black bg-white border-slate-200 text-[9px] uppercase tracking-tighter text-slate-500 px-2 py-0">
                         {req.requestType.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                       <StatusBadge status={req.status} />
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-slate-500 font-bold">
                         {format(new Date(req.createdAt), "MMM dd, yyyy")}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center gap-2">
                        {canAct && activeActionId !== req.id && (
                           <div className="flex gap-1 animate-in fade-in slide-in-from-right-2">
                              {!isDcOps ? (
                                 <>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="h-8 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                      onClick={() => setActiveActionId(req.id)}
                                    >
                                       Quick Reject
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                                      onClick={() => {
                                         setActiveActionId(req.id);
                                         setQuickComments("Approved via dashboard shortcut");
                                      }}
                                    >
                                       Approve Now
                                    </Button>
                                 </>
                              ) : (
                                 <Button 
                                   size="sm" 
                                   className="h-9 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-100 gap-2 font-bold px-4"
                                   onClick={() => onQuickExecute(req.id)}
                                   disabled={isPending}
                                 >
                                    {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                                    Execute
                                 </Button>
                              )}
                           </div>
                        )}

                        <Link href={`/approvals/${req.id}`}>
                           <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-300 hover:text-blue-600 transition-colors">
                              <Eye className="h-4 w-4" />
                           </Button>
                        </Link>
                      </div>
                      
                      {/* Expanded Quick Action Area */}
                      {activeActionId === req.id && (
                         <div className="mt-3 p-3 bg-white border border-blue-100 rounded-lg shadow-inner space-y-3 text-left animate-in zoom-in-95 duration-200">
                            <div className="flex items-center gap-2 text-blue-800">
                               <MessageSquare className="h-3.5 w-3.5" />
                               <span className="text-[10px] font-bold uppercase tracking-widest">Adding context for decision</span>
                            </div>
                            <Textarea 
                               placeholder="Add your comments here..."
                               className="min-h-[60px] text-xs bg-slate-50/50"
                               value={quickComments}
                               onChange={(e) => setQuickComments(e.target.value)}
                            />
                            <div className="flex justify-end gap-2">
                               <Button variant="ghost" size="sm" className="h-8 text-[10px] uppercase font-black" onClick={() => {setActiveActionId(null); setQuickComments("");}}>Cancel</Button>
                               {quickComments === "Approved via dashboard shortcut" ? (
                                  <Button 
                                    size="sm" 
                                    className="h-8 bg-emerald-600 hover:bg-emerald-700 text-[10px] uppercase font-black" 
                                    onClick={() => onQuickAction(req.id, "APPROVED")}
                                    disabled={isPending}
                                  >
                                     {isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />} 
                                     Confirm Approval
                                  </Button>
                               ) : (
                                  <Button 
                                    size="sm" 
                                    className="h-8 bg-red-600 hover:bg-red-700 text-[10px] uppercase font-black" 
                                    onClick={() => onQuickAction(req.id, "REJECTED")}
                                    disabled={isPending || !quickComments}
                                  >
                                     {isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <XCircle className="h-3 w-3 mr-1" />} 
                                     Confirm Rejection
                                  </Button>
                               )}
                            </div>
                         </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredRequests.length === 0 && (
                <tr>
                   <td colSpan={6} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3 opacity-20 group">
                         <Activity className="h-12 w-12 group-hover:scale-110 transition-transform duration-500" />
                         <div className="space-y-1">
                            <p className="font-black text-xl uppercase tracking-tighter">Queue is Empty</p>
                            <p className="text-sm font-medium">All tasks at your clearance level are processed</p>
                         </div>
                      </div>
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Legend / Info Footer */}
        <div className="bg-slate-50/50 px-6 py-3 border-t border-slate-100 flex items-center justify-between">
           <div className="flex gap-4">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase">
                 <div className="h-2 w-2 rounded-full bg-orange-400" /> Approval Required
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase">
                 <div className="h-2 w-2 rounded-full bg-blue-500" /> Execution Pending
              </div>
           </div>
           <p className="text-[10px] text-slate-300 font-medium italic">Data automatically synced with Neon Cloud Database</p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, string> = {
    PENDING_L1: "bg-orange-50 text-orange-700 border-orange-200",
    PENDING_L2: "bg-orange-50 text-orange-700 border-orange-200",
    PENDING_L3: "bg-orange-50 text-orange-700 border-orange-200",
    APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    REJECTED: "bg-red-50 text-red-700 border-red-200",
    PROVISIONED: "bg-blue-50 text-blue-700 border-blue-200",
    CLOSED: "bg-slate-50 text-slate-700 border-slate-200",
  };

  return (
    <Badge className={`font-black border px-2 shadow-none text-[9px] uppercase tracking-tighter ${configs[status] || "bg-slate-50"}`}>
       {status.replace(/_/g, " ")}
    </Badge>
  );
}
