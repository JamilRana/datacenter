// src/app/requests/decommission/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  getDecommissionRequestById, 
  executeDecommission 
} from "@/app/actions/decommission-actions";
import { toast } from "sonner";
import { VmStatus } from "@prisma/client";

interface DecommissionRequest {
  id: string;
  systemName: string;
  status: string;
  requester: {
    name: string;
    email: string;
  };
  vmInstances: {
    id: string;
    hostname: string | null;
    ipAddress: string | null;
    status: VmStatus;
  }[];
  targetVm: {
    id: string;
    hostname: string | null;
    ipAddress: string | null;
    status: VmStatus;
  } | null;
}

export default function DecommissionDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [request, setRequest] = useState<DecommissionRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRequest = async () => {
      try {
        const data = await getDecommissionRequestById(params.id);
        setRequest(data);
      } catch (err) {
        setError(`Failed to load decommission request: ${err}`);
        toast.error(`Failed to load decommission request: ${err}`);
      }
    };

    fetchRequest();
  }, [params.id]);

  const handleDecommission = async () => {
    if (!confirm("Are you sure you want to decommission these VMs? This cannot be undone.")) return;

    setLoading(true);
    try {
      await executeDecommission(params.id);
      toast.success("VMs decommissioned successfully");
      router.push("/decommission");
    } catch (error) {
      toast.error(`Failed to decommission VMs: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-red-500">{error}</p>
            <Button onClick={() => router.back()} className="mt-4">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card>
          <CardContent className="p-6 text-center">
            <p>Loading decommission request...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Determine VMs to display
  const vms = request.vmInstances.length 
    ? request.vmInstances 
    : request.targetVm 
    ? [request.targetVm] 
    : [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Decommission Request</CardTitle>
          <p className="text-sm text-muted-foreground">
            System: {request.systemName} • Status:{" "}
            <Badge variant={request.status === "CLOSED" ? "secondary" : "default"}>
              {request.status.replace(/_/g, ' ')}
            </Badge>
          </p>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <h3 className="font-medium mb-2">VMs to Decommission ({vms.length})</h3>
            {vms.length > 0 ? (
              <ul className="space-y-2">
                {vms.map((vm) => (
                  <li key={vm.id} className="flex justify-between bg-muted p-2 rounded">
                    <span>{vm.hostname || `VM ${vm.id.slice(0, 8)}`}</span>
                    <span className="text-sm text-muted-foreground">
                      {vm.ipAddress || 'No IP'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No VMs found for decommission.</p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            {request.status === "APPROVED" && (
              <Button 
                onClick={handleDecommission} 
                disabled={loading}
                variant="destructive"
              >
                {loading ? "Decommissioning..." : "Confirm Decommission"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}