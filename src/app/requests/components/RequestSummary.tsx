"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RequestDetailsData } from "@/types/requests";
import { FileText, Clock, CheckCircle2, XCircle, HardDrive } from "lucide-react";

interface RequestSummaryProps {
  requests: RequestDetailsData[];
}

export function RequestSummary({ requests }: RequestSummaryProps) {
  const stats = {
    total: requests.length,
    pending: requests.filter((r) => r.status?.startsWith("PENDING")).length,
    approved: requests.filter((r) => r.status === "APPROVED").length,
    rejected: requests.filter((r) => r.status === "REJECTED").length,
    provisioned: requests.filter((r) => r.status === "PROVISIONED").length,
  };

  const items = [
    { label: "Total Requests", value: stats.total, icon: FileText, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Pending Approvals", value: stats.pending, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Approved", value: stats.approved, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
    { label: "Rejected", value: stats.rejected, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
    { label: "Provisioned", value: stats.provisioned, icon: HardDrive, color: "text-indigo-600", bg: "bg-indigo-50" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {items.map((item) => (
        <Card key={item.label} className="border-none shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {item.label}
            </CardTitle>
            <item.icon className={`h-4 w-4 ${item.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{item.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
