// src/app/requests/components/RequestDetail.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useEffect, useState } from "react";
import { 
  Check, 
  Copy, 

  Server, 
  Users, 
  Code,  
  HardDrive,
  Clock,
  LucideIcon,
  Shield
} from "lucide-react";
import { ApprovalPanel } from "./ApprovalPanel";
import { VmInstanceList } from "./VmInstanceList";
import { getDetailedRequest, submitRequest } from "@/app/actions/request-actions";
// import { Person } from "@/types/request-form"; // REMOVED: Use type from requests.ts to avoid mismatch
import { RequestDetailsData, Person, Developer } from "@/types/requests";
import { toast } from "sonner";
import type { ReactNode } from "react";


export function RequestDetails({
  requestId,
  userId,
}: {
  requestId: string;
  userId: string;
}) {
const [data, setData] = useState<RequestDetailsData | null>(null);
const [loading, setLoading] = useState(true);

  const fetchRequestData = async () => {
    setLoading(true);
    try {
      const res = await getDetailedRequest(requestId);
      setData(res);
    } catch (error) {
      toast.error(`Failed to load request data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

useEffect(() => {
  if (!requestId) return;

  async function load() {
    setLoading(true);
    const res = await getDetailedRequest(requestId);
    setData(res);
    setLoading(false);
  }

  load();
}, [requestId]);


  const handleSubmit = async () => {
    if (!data) return;
    try {
      const response = await submitRequest(data.id);
      if (response) {
        toast.success("Request submitted for approval");
        fetchRequestData();
      }
    } catch (error) {
      toast.error(`Failed to submit: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading request details...</div>;
  if (!data) return <div className="p-10 text-center text-red-500">No data found for this request.</div>;

  const canClone = data.status === "APPROVED" || data.status === "PROVISIONED";
  const isDraft = data.status === "DRAFT";

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-28">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {data.systemName || "Request Detail"}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge className={
              data.status === "APPROVED" ? "bg-green-100 text-green-800" :
              data.status === "REJECTED" ? "bg-red-100 text-red-800" :
              data.status === "DRAFT" ? "bg-slate-100 text-slate-800" : "bg-blue-100 text-blue-800"
            }>
              {data.status?.replace(/_/g, " ")}
            </Badge>
            <span className="text-sm text-slate-500">•</span>
            <span className="text-sm font-medium text-slate-600">{data.environment}</span>
            <span className="text-sm text-slate-500">•</span>
            <span className="text-sm text-slate-500">{data.requestType.replace(/_/g, " ")}</span>
          </div>
        </div>

        <div className="flex gap-2">
          {canClone && (
            <Button asChild variant="outline">
              <Link href={`/requests/new?copyFrom=${data.id}`}>
                <Copy className="w-4 h-4 mr-2" /> Clone Request
              </Link>
            </Button>
          )}
          {isDraft && (
            <Button asChild className="bg-amber-600 hover:bg-amber-700">
              <Link href={
                data.requestType === "CUSTOMIZED" ? `/requests/customize?vmId=${data.targetVm?.id || data.vmInstances?.[0]?.id}` :
                data.requestType === "DECOMMISSION" ? `/requests/decommission?vmId=${data.targetVm?.id || data.vmInstances?.[0]?.id}` :
                `/requests/${data.id}/edit`
              }>
                Edit Draft
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Target VM Link (for customizations/decommissions) */}
          {(data.targetVm || data.vmInstances?.[0]) && (
            <Card title="Target Virtual Machine" icon={HardDrive}>
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div>
                  <p className="font-bold text-slate-900">
                    {data.targetVm?.hostname || data.vmInstances?.[0]?.hostname || "Reference VM"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {data.targetVm?.ipAddress || data.vmInstances?.[0]?.ipAddress || "Provisioning Pending"}
                  </p>
                </div>
                <Link href={`/inventory/vms/${data.targetVm?.id || data.vmInstances?.[0]?.id}`}>
                  <Button variant="outline" size="sm" className="h-8">View VM History</Button>
                </Link>
              </div>
            </Card>
          )}

          {/* Info Card */}
          <Card 
            title={data.requestType === "DECOMMISSION" ? "Decommission Justification" : "Request Information"} 
            icon={data.requestType === "DECOMMISSION" ? Clock : Server}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
              <DetailItem label="Project Name" value={data.projectName} />
              <DetailItem label="Environment" value={data.environment} />
              <div className="md:col-span-2">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Purpose / Reason</p>
                <p className="text-sm text-slate-700 leading-relaxed">{data.purpose}</p>
              </div>
              <DetailItem label="Quantity" value={data.quantity?.toString() || "1"} />
              <DetailItem 
                label="End Date" 
                value={data.expectedEndDate ? format(new Date(data.expectedEndDate), "PPP") : "None"} 
              />
            </div>
          </Card>

          {/* Technology Stack */}
          {data.requestType !== "DECOMMISSION" && (
            <Card title="Technology Stack" icon={Code}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DetailItem label="Frontend" value={data.frontendTech} />
                <DetailItem label="Backend" value={data.backendTech} />
                <DetailItem label="Database" value={data.dataBase} />
                <DetailItem label="Architecture" value={data.serverArchitecture} />
                <div className="md:col-span-2">
                  <DetailItem label="Tech Notes" value={data.additionalTechNotes} />
                </div>
              </div>
            </Card>
          )}

          {/* People */}
          <Card title="Responsible Personnel" icon={Users}>
             <div className="space-y-6">
                <PersonSection title="Primary Contact" person={data.responsiblePerson} />
                <PersonSection title="Alternative Contact" person={data.alternativePerson} />
                <PersonSection title="Technical Developer" person={data.developer} />
             </div>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Specification */}
          <Card title="Resource Specification" icon={HardDrive}>
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-blue-500" /> <span className="text-sm text-slate-600">vCPU</span></div>
                <span className="font-bold text-slate-900">{data.vcpu || 0} Cores</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-indigo-500" /> <span className="text-sm text-slate-600">RAM</span></div>
                <span className="font-bold text-slate-900">{data.ramGb || 0} GB</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-emerald-500" /> <span className="text-sm text-slate-600">Storage</span></div>
                <span className="font-bold text-slate-900">{data.storageGb || 0} GB</span>
              </div>
              <DetailItem label="Operating System" value={`${data.osName || ""} ${data.osVersion || ""}`} />
              <DetailItem label="RAID Level" value={data.raid || "NONE"} />
              <DetailItem label="Subdomain" value={data.subdomain} />
            </div>
          </Card>

          {/* Security & Compliance */}
          <Card title="Security & Network" icon={Shield}>
             <div className="space-y-2">
                <ComplianceItem label="Public IP" status={data.requiredPublicIP} />
                <ComplianceItem label="VPN Required" status={data.vpnRequired} />
                <ComplianceItem label="VA Report" status={data.vaReportSubmitted} />
                <ComplianceItem label="Renewal" status={data.renewalRequired} />
                {data.renewalPeriodMonths && (
                   <div className="pt-2 text-xs text-slate-500 border-t mt-2">Renew every {data.renewalPeriodMonths} months</div>
                )}
             </div>
          </Card>
        </div>
      </div>

      {/* Provisioned VMs */}
      {data.vmInstances.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Server className="h-5 w-5 text-blue-600" /> Provisioned Instances
          </h2>
          <VmInstanceList vms={data.vmInstances} />
        </div>
      )}

      {/* Approval Flow */}
      <ApprovalPanel
        // ✅ Removed unused requestId
        approvals={data.approvals}
        currentStatus={data.status}
        currentUserId={userId}
      />

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t p-4 shadow-2xl flex justify-between items-center z-50">
        <Button asChild variant="ghost">
          <Link href="/requests">Back to List</Link>
        </Button>
        
        {isDraft && (
          <div className="flex gap-3">
             <Button variant="outline" asChild>
                <Link href={`/requests/${data.id}/edit`}>Edit Content</Link>
             </Button>
             <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700">
                Submit for Approval
             </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Subcomponents (same as before, but with proper types)
interface CardProps {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}

function Card({ title, icon: Icon, children }: CardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-50 bg-slate-50/30 flex items-center gap-2.5">
        <Icon className="h-4 w-4 text-slate-500" />
        <h3 className="font-bold text-slate-800 text-sm tracking-tight capitalize">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

interface DetailItemProps {
  label: string;
  value: string | number | null | undefined;
}

function DetailItem({ label, value }: DetailItemProps) {
  const displayValue = value == null ? "—" : String(value);
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-sm font-semibold text-slate-800">{displayValue}</p>
    </div>
  );
}

function ComplianceItem({ label, status }: { label: string; status: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      {status ? (
        <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
          <Check className="h-4 w-4" /> Yes
        </span>
      ) : (
        <span className="text-slate-300">No</span>
      )}
    </div>
  );
}

function PersonSection({ title, person }: { title: string; person: Person | Developer }) {
  if (!person?.name) return null;
  
  const designation = 'designation' in person ? person.designation : 'External Developer';
  const organization = 'organization' in person ? person.organization : ('address' in person ? person.address : '');

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-slate-900 border-l-2 border-blue-500 pl-2">{title}</p>
      <div className="pl-2 space-y-0.5">
        <p className="text-sm font-semibold text-slate-800">{person.name}</p>
        <p className="text-xs text-slate-500">{designation} • {organization}</p>
        <p className="text-xs text-slate-400">{person.email} • {person.contact}</p>
      </div>
    </div>
  );
}