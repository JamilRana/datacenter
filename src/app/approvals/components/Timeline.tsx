"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, User } from "lucide-react";
import { format } from "date-fns";
import { Approval } from "@prisma/client";


interface TimelineProps {
  requestType: string;
  currentStatus: string;
  approvals: Approval[];
}

export function Timeline({ requestType, currentStatus, approvals }: TimelineProps) {
  // Define levels based on type
  const levels = requestType === "DECOMMISSION" ? ["L1", "DCOPS"] : ["L1", "L2", "L3", "DCOPS"];

  return (
    <div className="space-y-8 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
      {levels.map((level) => {
        const approval = approvals.find(a => a.level === level);
        const isActive = isLevelActive(level, currentStatus);
        const isCompleted = !!approval && approval.decision === "APPROVED";
        const isRejected = !!approval && approval.decision === "REJECTED";

        return (
          <div key={level} className="relative pl-10">
            {/* Step Icon */}
            <div className={`absolute left-0 top-0 h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 z-10 ${
               isCompleted ? "bg-emerald-500 border-emerald-500 text-white" :
               isRejected ? "bg-red-500 border-red-500 text-white" :
               isActive ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200" :
               "bg-white border-slate-200 text-slate-300"
            }`}>
               {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : 
                isRejected ? <XCircle className="h-4 w-4" /> :
                <span className="text-[10px] font-bold">{level}</span>}
            </div>

            {/* Content */}
            <div className="space-y-1">
               <div className="flex items-center gap-2">
                  <p className={`text-sm font-bold uppercase tracking-tight ${isActive ? "text-blue-700" : "text-slate-600"}`}>
                     {level === "DCOPS" ? "Final Execution" : `Level ${level} Approval`}
                  </p>
                  {isActive && <Badge variant="secondary" className="bg-blue-50 text-blue-700 text-[10px] animate-pulse">Action Required</Badge>}
               </div>

               {approval ? (
                  <div className="bg-white rounded-lg border border-slate-100 p-3 shadow-sm space-y-2">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                           <User className="h-3 w-3" />
                           {approval.level}
                        </div>
                        <span className="text-[10px] text-slate-400">{format(new Date(approval.decidedAt?.toString() || ""), "MMM dd, HH:mm")}</span>
                     </div>
                     {approval.comments && (
                        <p className="text-xs text-slate-500 italic bg-slate-50 p-2 rounded">&quot{approval.comments}&quot</p>
                     )}
                  </div>
               ) : (
                  <p className="text-xs text-slate-400 italic pl-1">
                     {isCompleted ? "Step processed" : isActive ? "Waiting for review..." : "Upcoming stage"}
                  </p>
               )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function isLevelActive(level: string, status: string) {
  if (level === "L1") return status === "PENDING_L1";
  if (level === "L2") return status === "PENDING_L2";
  if (level === "L3") return status === "PENDING_L3";
  if (level === "DCOPS") return status === "APPROVED";
  return false;
}
