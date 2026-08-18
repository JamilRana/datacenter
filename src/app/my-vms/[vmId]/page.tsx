// src/app/vms/[vmId]/page.tsx
"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { getVmDetails, VmDetailsData } from "@/app/actions/vm-management-actions";
import { 
  ChevronRight, 
  Copy, 
  Check,
  Cpu,
  HardDrive,
  Globe,
  Shield,
  Network,
  ShieldAlert,
  Clock,
  Zap,
  Trash2,
  AlertTriangle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="ml-2 text-slate-400 hover:text-indigo-600"
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export default function VmDetailsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const vmId = params.vmId as string;
  
  const [loading, setLoading] = useState(true);
  const [vmData, setVmData] = useState<VmDetailsData | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    
    const fetchVm = async () => {
      try {
        const data = await getVmDetails(vmId);
        setVmData(data);
      } catch (err) {
        console.error("Failed to fetch VM", err);
      } finally {
        setLoading(false);
      }
    };
    
    if (session) {
      fetchVm();
    }
  }, [status, session, vmId]);

  if (status === "loading" || loading) {
    return (
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
        <div className="h-10 w-48 bg-slate-200 animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-48 bg-slate-100 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!session) {
    router.push("/auth");
    return null;
  }

  if (!vmData) {
    return (
      <div className="p-6 md:p-10 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900">VM Not Found</h2>
          <p className="text-slate-500 mt-2">The VM you are looking for does not exist.</p>
          <Link href="/dashboard/vms">
            <Button className="mt-4">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  const totalStorage = (vmData.currentSpec?.storageGb || 0) + 
    (vmData.currentSpec?.additionalDisks?.reduce((sum, d) => sum + d.sizeGb, 0) || 0);

  const getStatusBadge = (vmStatus: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      ACTIVE: "default",
      SUSPENDED: "secondary",
      RETIRED: "destructive",
    };
    return (
      <Badge variant={variants[vmStatus] || "secondary"} className="capitalize">
        {vmStatus.toLowerCase()}
      </Badge>
    );
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      {/* Production Warning */}
      {vmData.environment === "PRODUCTION" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <span className="text-sm font-medium text-red-800">
            You are viewing a production VM.
          </span>
        </div>
      )}

      {/* Breadcrumbs */}
      <div className="flex items-center text-sm text-slate-500">
        <Link href="/" className="hover:text-slate-900">Home</Link>
        <ChevronRight className="h-4 w-4 mx-2" />
        <Link href="/my-vms" className="hover:text-slate-900">VM Dashboard</Link>
        <ChevronRight className="h-4 w-4 mx-2" />
        <span className="text-slate-900 font-medium">{vmData.hostname || "VM Details"}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {vmData.hostname || "Unnamed VM"}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            {vmData.request && (
              <span className="text-lg text-slate-600">{vmData.request.systemName}</span>
            )}
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              vmData.environment === "PRODUCTION" 
                ? "bg-amber-100 text-amber-800" 
                : vmData.environment === "DEVELOPMENT"
                ? "bg-blue-100 text-blue-800"
                : "bg-green-100 text-green-800"
            }`}>
              {vmData.environment || "—"}
            </span>
            {getStatusBadge(vmData.status)}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/requests/customize?vmId=${vmData.id}`}>
              <Zap className="h-4 w-4 mr-2" />
              Request Customization
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/requests/decommission?vmId=${vmData.id}`}>
              <Trash2 className="h-4 w-4 mr-2" />
              Request Decommission
            </Link>
          </Button>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Compute Card */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              Compute
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">vCPU</span>
                <span className="font-medium">{vmData.currentSpec?.vcpu ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">RAM</span>
                <span className="font-medium">{vmData.currentSpec?.ramGb ? `${vmData.currentSpec.ramGb} GB` : "—"}</span>
              </div>
              <div className="h-px bg-slate-200" />
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">OS Name</span>
                <span className="font-medium">{vmData.currentSpec?.osName || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">OS Version</span>
                <span className="font-medium">{vmData.currentSpec?.osVersion || "—"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Storage Card */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Storage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Primary Disk</span>
                <span className="font-medium">{vmData.currentSpec?.storageGb ? `${vmData.currentSpec.storageGb} GB` : "—"}</span>
              </div>
              {vmData.currentSpec?.additionalDisks && vmData.currentSpec.additionalDisks.length > 0 && (
                <>
                  <div className="h-px bg-slate-200" />
                  <div className="space-y-2">
                    <span className="text-sm text-slate-500">Additional Disks</span>
                    {vmData.currentSpec.additionalDisks.map((disk) => (
                      <div key={disk.id} className="flex justify-between text-sm">
                        <span className="text-slate-600">{disk.purpose || `Disk ${disk.sequence}`}</span>
                        <span className="font-medium">{disk.sizeGb} GB</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="h-px bg-slate-200" />
              <div className="flex justify-between font-medium">
                <span className="text-slate-500">Total Storage</span>
                <span>{totalStorage} GB</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Network Card */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Network
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <span className="text-sm text-slate-500">Private IP</span>
                <div className="flex items-center mt-1">
                  <span className="font-mono">{vmData.ipAddress || "—"}</span>
                  {vmData.ipAddress && <CopyButton value={vmData.ipAddress} />}
                </div>
              </div>
              <div>
                <span className="text-sm text-slate-500">Public IP</span>
                <div className="flex items-center mt-1">
                  <span className="font-mono">{vmData.publicIpAddress || "—"}</span>
                  {vmData.publicIpAddress && <CopyButton value={vmData.publicIpAddress} />}
                </div>
              </div>
              <div>
                <span className="text-sm text-slate-500">Subdomain</span>
                <div className="flex items-center mt-1">
                  <span className="font-mono">
                    {vmData.subdomain 
                      ? (vmData.subdomain.endsWith(".dghs.gov.bd") ? vmData.subdomain : `${vmData.subdomain}.dghs.gov.bd`) 
                      : "—"}
                  </span>
                  {vmData.subdomain && (
                    <CopyButton 
                      value={vmData.subdomain.endsWith(".dghs.gov.bd") ? vmData.subdomain : `${vmData.subdomain}.dghs.gov.bd`} 
                    />
                  )}
                </div>
              </div>
              {vmData.vpnRequired && (
                <div className="flex items-center gap-2 text-amber-600">
                  <ShieldAlert className="h-4 w-4" />
                  <span className="text-sm font-medium">VPN Required</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security & Network Access */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Firewall Rules */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Firewall Rules
            </CardTitle>
          </CardHeader>
          <CardContent>
            {vmData.currentSpec?.firewallPorts && vmData.currentSpec.firewallPorts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-2 font-medium text-slate-500">Port</th>
                      <th className="text-left py-2 font-medium text-slate-500">Protocol</th>
                      <th className="text-left py-2 font-medium text-slate-500">Purpose</th>
                      <th className="text-left py-2 font-medium text-slate-500">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vmData.currentSpec.firewallPorts.map((rule) => (
                      <tr key={rule.id} className="border-b last:border-0">
                        <td className="py-2 font-mono">{rule.port}</td>
                        <td className="py-2">{rule.protocol}</td>
                        <td className="py-2">{rule.purpose}</td>
                        <td className="py-2">{rule.source || "Any"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No firewall rules configured</p>
            )}
          </CardContent>
        </Card>

        {/* Network Access */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase flex items-center gap-2">
              <Network className="h-4 w-4" />
              Network Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            {vmData.currentSpec?.networkAccess && vmData.currentSpec.networkAccess.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {vmData.currentSpec.networkAccess.map((access) => (
                  <Badge key={access.id} variant="outline" className="capitalize">
                    {access.accessType.toLowerCase()}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No network access configured</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Customization History */}
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-500 uppercase flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Customization History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {vmData.customizationHistory && vmData.customizationHistory.length > 0 ? (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" />
              <div className="space-y-6">
                {vmData.customizationHistory.map((history) => (
                  <div key={history.id} className="relative pl-10">
                    <div className="absolute left-2.5 w-3 h-3 rounded-full bg-indigo-500" />
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">
                          {format(new Date(history.createdAt), "MMM dd, yyyy 'at' HH:mm")}
                        </span>
                        <span className="text-sm text-slate-500">
                          by {history.appliedBy?.name || "Unknown"}
                        </span>
                      </div>
                      {history.reason && (
                        <p className="text-sm text-slate-600 mb-2">{history.reason}</p>
                      )}
                      <div className="flex gap-4 text-sm">
                        {history.beforeSpec && (
                          <div className="bg-white rounded px-3 py-2 border">
                            <span className="text-slate-500">Before: </span>
                            <span className="font-mono">
                              {history.beforeSpec.vcpu}vCPU / {history.beforeSpec.ramGb}GB / {history.beforeSpec.storageGb}GB
                            </span>
                          </div>
                        )}
                        {history.afterSpec && (
                          <div className="bg-white rounded px-3 py-2 border">
                            <span className="text-slate-500">After: </span>
                            <span className="font-mono">
                              {history.afterSpec.vcpu}vCPU / {history.afterSpec.ramGb}GB / {history.afterSpec.storageGb}GB
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No customization history</p>
          )}
        </CardContent>
      </Card>

      {/* Governance */}
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-500 uppercase">
            Governance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <span className="text-sm text-slate-500">Request ID</span>
              <p className="font-mono text-sm mt-1">{vmData.request?.id || "—"}</p>
            </div>
            <div>
              <span className="text-sm text-slate-500">Requester</span>
              <p className="font-medium text-sm mt-1">{vmData.request?.requester.name || "—"}</p>
            </div>
            <div>
              <span className="text-sm text-slate-500">System Name</span>
              <p className="font-medium text-sm mt-1">{vmData.request?.systemName || "—"}</p>
            </div>
            <div>
              <span className="text-sm text-slate-500">Environment</span>
              <p className="font-medium text-sm mt-1">{vmData.request?.environment || "—"}</p>
            </div>
            <div>
              <span className="text-sm text-slate-500">Provisioned Date</span>
              <p className="font-medium text-sm mt-1">
                {vmData.request?.provisionedAt 
                  ? format(new Date(vmData.request.provisionedAt), "MMM dd, yyyy")
                  : "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
