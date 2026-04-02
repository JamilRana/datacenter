//scr/app/requests/components/RequestList.tsx
"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";
import { 
  Trash2, 
  Eye, 
  Edit2, 
  Copy, 
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { detailsRequest } from "@/types/requests";
import { deleteRequest } from "@/app/actions/request-actions";

// ✅ MINIMAL, PRECISE INTERFACES (matches EXACT data shape used)
interface RequestListProps {
  requests: detailsRequest[];
}

export function RequestList({ requests: initialRequests }: RequestListProps) {
  const [requests, setRequests] = useState<detailsRequest[]>(initialRequests);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this draft?")) return;

    try {
      const res = await deleteRequest(id);
      if (res.success) {
        setRequests(prev => prev.filter(r => r.id !== id));
        toast.success("Draft deleted successfully");
      } else {
        toast.error("Failed to delete draft");
      }
    } catch {
      toast.error("Network error");
    }
  };

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-dashed border-slate-300">
        <AlertCircle className="w-10 h-10 text-slate-400 mb-2" />
        <p className="text-slate-600 font-medium">No requests found</p>
        <p className="text-slate-400 text-sm mt-1">Start by creating a new VM request.</p>
        <Link href="/requests/new" className="mt-4">
          <Button variant="outline">Create Request</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">System Name</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Subdomain</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Environment</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">VMs</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Submitted</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
            <tbody className="divide-y divide-slate-200">
            {requests.map((req) => {
              const vmCount = req.vmInstances?.length || 0;
              return (
              <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-900">{req.systemName}</div>
                  <div className="text-xs text-slate-500 truncate max-w-[200px]">{req.purpose}</div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-slate-600 font-mono">
                    {req.subdomain || "—"}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <Badge variant="outline" className="font-normal border-slate-200 bg-slate-50">
                    {req.requestType.replace(/_/g, " ").toLowerCase()}
                  </Badge>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    req.environment === 'PRODUCTION' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {req.environment}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <Badge
                    variant={
                      req.status.toString() === "REJECTED"
                        ? "destructive"
                        : req.status.toString() === "DRAFT"
                        ? "secondary"
                        : "default"
                    }
                    className="capitalize"
                  >
                    {req.status.toString().toLowerCase().replace(/_/g, " ")}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-center">
                  {vmCount > 0 ? (
                    <Link 
                      href={`/inventory/vms?search=${encodeURIComponent(req.systemName)}`}
                      className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full bg-indigo-100 text-indigo-700 text-sm font-medium hover:bg-indigo-200 transition-colors"
                    >
                      {vmCount}
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {req.submittedAt
                    ? format(new Date(req.submittedAt), "MMM dd, yyyy")
                    : "—"}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <Link href={`/requests/${req.id}/view`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </Link>

                    {(req.status.toString() === "DRAFT" || req.status.toString() === "RETURNED") && (
                      <>
                        <Link href={`/requests/${req.id}/edit`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-amber-600" title="Edit Request">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </Link>
                        {req.status.toString() === "DRAFT" && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-400 hover:text-red-600"
                            onClick={() => handleDelete(req.id)}
                            title="Delete Draft"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </>
                    )}

                    {["APPROVED", "REJECTED", "PROVISIONED"].includes(req.status.toString()) && (
                      <Link href={`/requests/new?copyFrom=${req.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-green-600" title="Copy Request">
                          <Copy className="w-4 h-4" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            );})}
          </tbody>
        </table>
      </div>
    </div>
  );
}