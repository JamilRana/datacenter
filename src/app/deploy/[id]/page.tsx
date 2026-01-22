// src/app/deploy/[id]/page.tsx
"use client";
import { useEffect, useState } from "react";
import { provisionRequest, getRequestForProvisioning } from "@/app/actions/deploy-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function ProvisionPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [request, setRequest] = useState<any>(null);
  const [vms, setVms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getRequestForProvisioning(params.id).then((req) => {
      setRequest(req);
      if (req) {
        const initialVms = Array.from({ length: req.quantity }, () => ({
          hostname: "",
          ipAddress: "",
          publicIpAddress: "",
          vCenterVmId: "",
          cluster: "",
          datastore: "",
        }));
        setVms(initialVms);
      }
    });
  }, [params.id]);

  const updateVm = (i: number, field: string, value: string) => {
    const newVms = [...vms];
    newVms[i][field] = value;
    setVms(newVms);
  };

  const handleSubmit = async () => {
    // Validate required fields
    const missing = vms.some(vm => !vm.hostname.trim() || !vm.ipAddress.trim());
    if (missing) {
      toast.error("Hostname and IP Address are required for all VMs");
      return;
    }

    setLoading(true);
    try {
      await provisionRequest(params.id, vms);
      toast.success("VMs provisioned successfully");
      router.push("/deploy");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!request) return <div className="p-6">Loading request...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Provisioning: {request.systemName}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Environment: {request.environment} | Request ID: {request.id}
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="border rounded p-3">
              <p className="text-xs text-muted-foreground uppercase">CPU</p>
              <p className="font-bold">{request.vcpu} vCPUs</p>
            </div>
            <div className="border rounded p-3">
              <p className="text-xs text-muted-foreground uppercase">RAM</p>
              <p className="font-bold">{request.ramGb} GB</p>
            </div>
            <div className="border rounded p-3">
              <p className="text-xs text-muted-foreground uppercase">Storage</p>
              <p className="font-bold">{request.storageGb} GB</p>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>VM #</TableHead>
                <TableHead>Hostname *</TableHead>
                <TableHead>IP Address *</TableHead>
                <TableHead>Public IP</TableHead>
                <TableHead>vCenter VM ID</TableHead>
                <TableHead>Cluster</TableHead>
                <TableHead>Datastore</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vms.map((vm, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{i + 1}</TableCell>
                  <TableCell>
                    <Input
                      placeholder="e.g. srv-app-01"
                      value={vm.hostname}
                      onChange={(e) => updateVm(i, "hostname", e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      placeholder="10.0.0.x"
                      value={vm.ipAddress}
                      onChange={(e) => updateVm(i, "ipAddress", e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      placeholder="Optional"
                      value={vm.publicIpAddress}
                      onChange={(e) => updateVm(i, "publicIpAddress", e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      placeholder="vm-12345"
                      value={vm.vCenterVmId}
                      onChange={(e) => updateVm(i, "vCenterVmId", e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      placeholder="Cluster-A"
                      value={vm.cluster}
                      onChange={(e) => updateVm(i, "cluster", e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      placeholder="Datastore-SSD"
                      value={vm.datastore}
                      onChange={(e) => updateVm(i, "datastore", e.target.value)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex justify-end mt-6 gap-3">
            <Button variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? "Provisioning..." : "Complete Provisioning"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}