import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { CustomizationRequest } from "@/types/customization";
import { Cpu, Database, HardDrive } from "lucide-react";

export function CustomizationRequestDetails({
  request,
}: {
  request: CustomizationRequest;
}) {
  return (
    <div className="space-y-6 py-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Request Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-slate-700">Request ID</Label>
              <p className="mt-1 text-sm font-mono">{request.id}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">Status</Label>
              <StatusBadge status={request.status} />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">Created</Label>
              <p className="mt-1 text-sm">{new Date(request.createdAt).toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Target Virtual Machine</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-slate-700">Hostname</Label>
              <p className="mt-1 text-sm font-medium">{request.targetVm.hostname || "N/A"}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">IP Address</Label>
              <p className="mt-1 text-sm font-mono">{request.targetVm.ipAddress || "N/A"}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">Environment</Label>
              <p className="mt-1 text-sm">{request.targetVm.environment || "N/A"}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">Status</Label>
              <p className="mt-1 text-sm">{request.targetVm.status || "N/A"}</p>
            </div>
          </div>

          <div className="pt-4 border-t">
            <Label className="text-sm font-medium text-slate-700 mb-2 block">
              Current Specifications
            </Label>
            <div className="flex gap-4 flex-wrap">
              <span className="flex items-center gap-1">
                <Cpu className="h-4 w-4" /> {request.targetVm.currentSpec?.vcpu || "N/A"} vCPU
              </span>
              <span className="flex items-center gap-1">
                <Database className="h-4 w-4" /> {request.targetVm.currentSpec?.ramGb || "N/A"} GB RAM
              </span>
              <span className="flex items-center gap-1">
                <HardDrive className="h-4 w-4" /> {request.targetVm.currentSpec?.storageGb || "N/A"} GB Storage
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Requested Changes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {request.vcpu && (
            <div>
              <Label className="text-sm font-medium text-slate-700">CPU Cores</Label>
              <p className="mt-1 text-sm">{request.vcpu}</p>
            </div>
          )}
          {request.ramGb && (
            <div>
              <Label className="text-sm font-medium text-slate-700">RAM (GB)</Label>
              <p className="mt-1 text-sm">{request.ramGb}</p>
            </div>
          )}
          {request.storageGb && (
            <div>
              <Label className="text-sm font-medium text-slate-700">Storage (GB)</Label>
              <p className="mt-1 text-sm">{request.storageGb}</p>
            </div>
          )}
          {request.purpose && (
            <div>
              <Label className="text-sm font-medium text-slate-700">Purpose / Justification</Label>
              <p className="mt-1 text-sm whitespace-pre-wrap">{request.purpose}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}