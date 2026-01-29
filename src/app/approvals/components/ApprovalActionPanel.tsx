"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  Zap, 
  Loader2,
  AlertCircle
} from "lucide-react";
import { handleApprovalDecision, executeRequest } from "@/app/actions/approval-actions";
import {  canUserApprove } from "@/lib/roles";
import { Request } from "@prisma/client";

export function ApprovalActionPanel({ 
  request, 
  userRole,
   
}: { 
  request: Request, 
  userRole: string[], 
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [comments, setComments] = useState("");

  // Determine if this user is allowed to act RIGHT NOW
  let currentLevel = "";
  if (request.status === "PENDING_L1") currentLevel = "L1";
  else if (request.status === "PENDING_L2") currentLevel = "L2";
  else if (request.status === "PENDING_L3") currentLevel = "L3";
  else if (request.status === "APPROVED") currentLevel = "DCOPS";

  const canAct = canUserApprove(userRole, currentLevel);
  const isDcOpsLevel = currentLevel === "DCOPS";

  if (!canAct) {
    return (
       <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex justify-center items-center z-50 shadow-2xl">
          <p className="text-slate-500 text-sm italic font-medium flex items-center gap-2">
             <AlertCircle className="h-4 w-4" /> You are not authorized to perform actions at the current stage: {request.status.replace(/_/g, " ")}
          </p>
       </div>
    );
  }

  async function onAction(decision: "APPROVED" | "REJECTED" | "RETURNED") {
    if ((decision === "REJECTED" || decision === "RETURNED") && !comments) {
      toast.error("Comments are required for rejections or returns");
      return;
    }

    startTransition(async () => {
      try {
        await handleApprovalDecision(request.id, decision, comments);
        toast.success(`Request ${decision.toLowerCase()} successfully`);
        router.refresh();
        router.push("/approvals");
      } catch (error) {
        toast.error(`Failed to process decision ${error}`);
      }
    });
  }

  async function onExecute() {
    startTransition(async () => {
      try {
        await executeRequest(request.id, comments);
        toast.success("Request executed and inventory updated!");
        router.refresh();
        router.push("/approvals");
      } catch (error) {
        toast.error(`Execution failed ${error}`);
      }
    });
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t p-4 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-all">
       <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-6">
          
          <div className="flex-1 w-full relative">
             <Textarea 
                placeholder={isDcOpsLevel ? "Execution notes (optional)..." : "Add internal comments or reason for decision..."}
                className="bg-white border-slate-200 focus:border-blue-500 min-h-[60px] max-h-[100px] text-sm"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
             />
             <div className="absolute right-3 bottom-2">
                <span className={`text-[10px] font-bold ${(comments.length === 0 && !isDcOpsLevel) ? "text-orange-400" : "text-slate-300"}`}>
                   {isDcOpsLevel ? "Optional" : "Mandatory for Reject/Return"}
                </span>
             </div>
          </div>

          <div className="flex gap-3 w-full md:w-auto">
             {!isDcOpsLevel ? (
                <>
                   <Button 
                      variant="outline" 
                      className="flex-1 md:flex-none border-orange-200 text-orange-700 hover:bg-orange-50 gap-2 h-12 px-6 font-bold"
                      disabled={isPending}
                      onClick={() => onAction("RETURNED")}
                   >
                      <RotateCcw className="h-4 w-4" /> Return
                   </Button>
                   <Button 
                      variant="outline" 
                      className="flex-1 md:flex-none border-red-200 text-red-700 hover:bg-red-50 gap-2 h-12 px-6 font-bold"
                      disabled={isPending}
                      onClick={() => onAction("REJECTED")}
                   >
                      <XCircle className="h-4 w-4" /> Reject
                   </Button>
                   <Button 
                      className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-12 px-8 font-bold shadow-lg shadow-emerald-100"
                      disabled={isPending}
                      onClick={() => onAction("APPROVED")}
                   >
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Approve Level
                   </Button>
                </>
             ) : (
                <Button 
                   className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white gap-3 h-14 px-12 font-bold shadow-xl shadow-blue-100 rounded-xl"
                   disabled={isPending}
                   onClick={onExecute}
                >
                   {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5 fill-current" />}
                   {request.requestType === "NEW_VM" ? "Confirm Provisioning" : 
                    request.requestType === "CUSTOMIZED" ? "Apply Customization" : 
                    "Confirm Decommission"}
                </Button>
             )}
          </div>
       </div>
    </div>
  );
}
