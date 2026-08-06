"use client";
import { redirect, notFound, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { 
  Cpu, Database, HardDrive, User, History, ShieldAlert, 
  Server, Zap, Trash2, Activity, Calendar, Monitor, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateVmSystemName } from "@/app/actions/vm-management-actions";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { fetchVmDetailsSerialized } from "@/app/actions/vm-actions";
import type { SerializedVmInstanceDetail } from "@/types/vm";
import { getPendingCustomizationForVm } from "@/app/actions/customization-actions";
import { CustomizationModal } from "@/app/requests/customize/components/CustomizationModal";
import { toast } from "sonner";
import { use } from "react";
import DecommissionModal from "@/components/vms/DecommissionModal";
import VmCredentialsCard from "../components/VmCredentialsCard";
import ComplianceTagsCard from "@/components/vms/ComplianceTagsCard";

export default function VmDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const id = unwrappedParams.id;
  const { data: session } = useSession();
  const [vm, setVm] = useState<SerializedVmInstanceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
  const [isDecommissionModalOpen, setIsDecommissionModalOpen] = useState(false);
  const [hasPendingCustomization, setHasPendingCustomization] = useState(false);
  const router = useRouter();

  // VM Rename state
  const [isEditingSystemName, setIsEditingSystemName] = useState(false);
  const [newSystemName, setNewSystemName] = useState("");
  const [isSavingSystemName, setIsSavingSystemName] = useState(false);

  useEffect(() => {
    if (vm) {
      setNewSystemName(vm.systemName || "");
    }
  }, [vm]);

  if (!session?.user) redirect("/auth");

  useEffect(() => {
    const fetchVm = async () => {
      try {
        const [vmData, pendingCheck] = await Promise.all([
          fetchVmDetailsSerialized(id),
          getPendingCustomizationForVm(id, session.user.id)
        ]);
        if (!vmData) notFound();
        setVm(vmData);
        setHasPendingCustomization(pendingCheck.hasPending);
      } catch (error) {
        console.error("Error fetching VM details:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchVm();
  }, [id, session, isCustomizeModalOpen, isDecommissionModalOpen]);

  const handleRename = async () => {
    if (!newSystemName.trim() || !vm) return;
    try {
      setIsSavingSystemName(true);
      const res = await updateVmSystemName(vm.id, newSystemName);
      if (res.success) {
        toast.success("VM renamed successfully!");
        setVm({ ...vm, systemName: newSystemName });
        setIsEditingSystemName(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rename VM");
    } finally {
      setIsSavingSystemName(false);
    }
  };

  if (isLoading) return <div className="p-10 text-center">Loading VM details...</div>;
  if (!vm) return notFound();

  const isOwner = vm?.owner?.id === session?.user?.id;
  const isAdminUser = session?.user?.roles?.includes("ADMIN");
  const canRename = isOwner || isAdminUser;

  return (
    <div className="p-6 md:p-10 space-y-6 bg-slate-50/20 min-h-screen">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/inventory" className="hover:text-indigo-600 flex items-center gap-1">
          <HardDrive className="h-4 w-4" />
          Inventory Hub
        </Link>
        <span>/</span>
        <Link href="/inventory/vms" className="hover:text-indigo-600">VM Instances</Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">{vm.hostname || vm.id}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
            <Server className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {vm.hostname || "Unnamed VM"}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-sm font-medium text-slate-500">
                {vm.ipAddress || "No IP Assigned"}
              </p>
              <Badge className={
                vm.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" :
                vm.status === "RETIRED" ? "bg-slate-100 text-slate-800" : "bg-orange-100 text-orange-800"
              }>
                {vm.status}
              </Badge>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          {vm.status === "ACTIVE" && !hasPendingCustomization ? (
            <>
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => setIsCustomizeModalOpen(true)}
              >
                <Zap className="h-4 w-4" /> Request Upgrade
              </Button>
              <Button 
                variant="outline" 
                className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100"
                onClick={() => setIsDecommissionModalOpen(true)}
              >
                <Trash2 className="h-4 w-4" /> Decommission
              </Button>
            </>
          ) : vm.status === "ACTIVE" && hasPendingCustomization ? (
            <Badge variant="secondary" className="bg-yellow-50 text-yellow-800 gap-2">
              <Activity className="h-3 w-3" /> Pending customization request in progress
            </Badge>
          ) : null}
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <Cpu className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">vCPU</p>
                <p className="text-xl font-bold text-slate-900">{vm.currentSpec?.vcpu ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-50">
                <Database className="h-4 w-4 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">RAM</p>
                <p className="text-xl font-bold text-slate-900">{vm.currentSpec?.ramGb ?? 0} GB</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50">
                <HardDrive className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Storage</p>
                <p className="text-xl font-bold text-slate-900">{vm.currentSpec?.storageGb ?? 0} GB</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50">
                <Monitor className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">OS</p>
                <p className="text-sm font-bold text-slate-900 truncate">{vm.currentSpec?.osName || "Unknown"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Current Allocation Details */}
          <Card className="border-none shadow-sm ring-1 ring-slate-200 overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Server className="h-4 w-4" /> VM Specifications
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">System Name</p>
                  {isEditingSystemName ? (
                    <div className="flex gap-2 items-center">
                      <Input
                        value={newSystemName}
                        onChange={(e) => setNewSystemName(e.target.value)}
                        className="h-8 text-xs font-semibold max-w-[200px]"
                        disabled={isSavingSystemName}
                      />
                      <Button
                        size="sm"
                        className="h-8 px-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                        onClick={handleRename}
                        disabled={isSavingSystemName}
                      >
                        {isSavingSystemName ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2"
                        onClick={() => {
                          setIsEditingSystemName(false);
                          setNewSystemName(vm.systemName || "");
                        }}
                        disabled={isSavingSystemName}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">
                        {vm.systemName || "None"}
                      </span>
                      {canRename && (
                        <button
                          onClick={() => setIsEditingSystemName(true)}
                          className="text-xs text-indigo-600 hover:underline font-medium"
                        >
                          (Edit)
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <DetailItem 
                  label="Operating System" 
                  value={`${vm.currentSpec?.osName || "Unknown"} ${vm.currentSpec?.osVersion || ""}`} 
                />
                <DetailItem 
                  label="Provisioned At" 
                  value={vm.provisionedAt ? format(new Date(vm.provisionedAt), "PPP p") : "Not recorded"} 
                />
                <DetailItem 
                  label="Original Request" 
                  value={vm.request?.requestId ? (
                    <Link href={`/requests/${vm.request.requestId}/view`} className="text-blue-600 hover:underline font-bold">
                      REQ-{vm.request.requestId.slice(0, 8)}
                    </Link>
                  ) : "Not recorded"} 
                />
                <DetailItem 
                  label="Environment" 
                  value={vm.request?.environment || "STAGING"} 
                />
              </div>
            </CardContent>
          </Card>

          {/* Specification Audit Trail */}
          <Card className="border-none shadow-sm ring-1 ring-slate-200 overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <History className="h-4 w-4" /> Specification Audit Trail
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {vm.specHistory && vm.specHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-[#fcfdfe] border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Effective Date</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">vCPU</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">RAM</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Disk</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Context</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {vm.specHistory.map((spec) => (
                        <tr key={spec.id} className="text-xs">
                          <td className="px-6 py-4 font-medium text-slate-700">
                            {format(new Date(spec.effectiveFrom), "MMM dd, yyyy")}
                          </td>
                          <td className="px-6 py-4">{spec.vcpu}</td>
                          <td className="px-6 py-4">{spec.ramGb} GB</td>
                          <td className="px-6 py-4">{spec.storageGb} GB</td>
                          <td className="px-6 py-4 font-medium text-slate-400">
                            {spec.sourceRequestId ? `REQ-${spec.sourceRequestId.slice(0, 6)}` : "Initial Build"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 italic text-xs">
                  No specification history available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Ownership Card */}
          <Card className="border-none shadow-sm ring-1 ring-slate-200">
            <CardHeader className="bg-slate-50/30">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Ownership</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{vm.owner?.name || "Unknown"}</p>
                  <p className="text-xs font-medium text-slate-400 uppercase">{vm.owner?.email || "N/A"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Credentials Card */}
          <VmCredentialsCard
            vmId={vm.id}
            ownerId={vm.owner?.id || null}
            currentUser={{
              id: session.user.id,
              roles: session.user.roles || [],
            }}
          />

          {/* Compliance & Tags Card */}
          <ComplianceTagsCard
            entityId={vm.id}
            entityType="VM"
            assignedTags={vm.tags || []}
            currentUser={{
              roles: session.user.roles || [],
            }}
          />

          {/* Timeline Card */}
          <Card className="border-none shadow-sm ring-1 ring-slate-200">
            <CardHeader className="bg-slate-50/30">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-blue-50">
                  <Calendar className="h-3 w-3 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Provisioned</p>
                  <p className="text-sm font-bold text-slate-800">
                    {vm.provisionedAt ? format(new Date(vm.provisionedAt), "MMM dd, yyyy") : "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-amber-50">
                  <Activity className="h-3 w-3 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Last Updated</p>
                  <p className="text-sm font-bold text-slate-800">
                    {vm.specHistory && vm.specHistory[0] 
                      ? format(new Date(vm.specHistory[0].effectiveFrom), "MMM dd, yyyy") 
                      : "N/A"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Security Events */}
          <Card className="border-none shadow-sm ring-1 ring-slate-200 overflow-hidden">
            <CardHeader className="bg-slate-50/30">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {vm.auditLogs && vm.auditLogs.length > 0 ? (
                <div className="divide-y divide-slate-50">
                  {vm.auditLogs.slice(0, 5).map((log) => (
                    <div key={log.id} className="p-4 space-y-1 hover:bg-slate-50/50 transition-colors">
                      <p className="text-xs font-medium text-slate-800 leading-tight">
                        {log.action.replace(/_/g, " ")}
                      </p>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-400 font-medium">
                          {format(new Date(log.timestamp), "MMM dd, HH:mm")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 italic text-xs">
                  No recent activity
                </div>
              )}
            </CardContent>
          </Card>

          {/* Retired Warning */}
          {vm.status === "RETIRED" && (
            <Card className="bg-red-50 border-red-100 border shadow-none">
              <CardContent className="p-4 flex gap-3">
                <ShieldAlert className="h-5 w-5 text-red-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-red-900 uppercase tracking-tight">Terminal Instance</p>
                  <p className="text-[10px] text-red-700 leading-relaxed mt-1 font-medium italic">
                    This VM has been retired. Records are preserved for compliance.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <CustomizationModal
        open={isCustomizeModalOpen}
        onOpenChange={setIsCustomizeModalOpen}
        vms={vm ? [vm] : []}
        selectedRequest={null}
        mode="create"
      />
      
      <DecommissionModal
        isOpen={isDecommissionModalOpen}
        onClose={() => setIsDecommissionModalOpen(false)}
        vmId={vm.id}
        hostname={vm.hostname || undefined}
        onSuccess={() => {
          router.refresh();
          toast.success("Decommission request created. Awaiting approval.");
        }}
      />
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      <div className="text-sm font-semibold text-slate-800">
        {value ?? "—"}
      </div>
    </div>
  );
}
