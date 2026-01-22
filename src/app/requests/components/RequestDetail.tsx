// src/app/requests/components/RequestDetails.tsx
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Check,
  Copy,
  FileText,
  Shield,
  Server,
  Users,
  Code,
  Network,
} from "lucide-react";
import { ApprovalPanel } from "./ApprovalPanel";
import { VmInstanceList } from "./VmInstanceList";
import {
  getDetailedRequest,
  submitRequest,
} from "@/app/actions/request-actions";
import { da } from "zod/v4/locales";
import { useEffect, useState } from "react";

// ✅ Define proper TypeScript interface
interface RequestData {
  id: string;
  systemName: string;
  status: string;
  environment: string;
  requestType: string;
  projectName?: string | null;
  purpose: string;
  expectedEndDate?: string;
  frontendTech?: string | null;
  backendTech?: string | null;
  dataBase?: string | null;
  serverArchitecture?: string | null;
  additionalTechNotes?: string | null;
  quantity?: number;
  vcpu?: number;
  ramGb?: number;
  storageGb?: number;
  osName?: string | null;
  osVersion?: string | null;
  raid?: string | null;
  subdomain?: string | null;
  requiredPublicIP: boolean;
  vpnRequired: boolean;
  sslProvider?: string | null;
  sslCostPaidBy?: string | null;
  vaReportSubmitted: boolean;
  justificationSubmitted: boolean;
  renewalRequired: boolean;
  renewalPeriodMonths?: number | null;
  vmInstances: any[]; // Replace with actual VM type
  approvals: any[]; // Replace with actual Approval type
  responsiblePerson: any;
  alternativePerson: any;
  developer: any;
  networkAccess: string[];
  additionalDisks: { sizeGb: string; purpose: string }[];
  firewallPorts: {
    port: string;
    protocol: string;
    purpose: string;
    source?: string;
  }[];
  // Add other fields as needed
}

export function RequestDetails({
  requestId,
  userId,
}: {
  requestId: string;
  userId: string;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const fetchRequestData = async () => {
    setLoading(true);
    try {
      const res = await getDetailedRequest(requestId);
      setData(res);
    } catch (error) {
      alert("Failed to load request data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequestData();
  }, [requestId]);

  if (loading) {
    return <div className="p-10 text-center">Loading request details...</div>;
  }

  if (!data) {
    return (
      <div className="p-10 text-center">No data found for this request.</div>
    );
  }

  const canClone = data.status === "APPROVED";
  const isDraft = data.status === "DRAFT";

  const handleSubmit = async () => {
    const formData = new FormData();
    formData.append("requestId", data.id);
    try {
      const response = await submitRequest(data.id);
      if (!response) {
        throw new Error("Failed to submit request for approval.");
      }
      alert("Request submitted for approval.");
      window.location.reload();
    } catch (error) {
      alert((error as Error).message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-28">
      {" "}
      {/* Added padding to avoid fixed bar overlap */}
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {data.systemName}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge
              variant={data.status === "REJECTED" ? "destructive" : "default"}
            >
              {data.status.replace(/_/g, " ")}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {data.environment} • {data.requestType.replace(/_/g, " ")}
            </span>
          </div>
        </div>

        {canClone && (
          <Button asChild>
            <Link href={`/requests/new?copyFrom=${data.id}`}>
              <Copy className="w-4 h-4 mr-2" />
              Clone Request
            </Link>
          </Button>
        )}
      </div>
      {/* Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Section 1: System & Purpose */}
        <div className="lg:col-span-2 space-y-6">
          <Card title="System Information" icon={Server}>
            <DetailItem label="Project Name" value={data.projectName || "-"} />
            <DetailItem label="Purpose" value={data.purpose} />
            <DetailItem
              label="Expected End Date"
              value={
                data.expectedEndDate
                  ? format(new Date(data.expectedEndDate), "PPP")
                  : "-"
              }
            />
          </Card>

          <Card title="Technology Stack" icon={Code}>
            <DetailItem label="Frontend" value={data.frontendTech || "-"} />
            <DetailItem label="Backend" value={data.backendTech || "-"} />
            <DetailItem label="Database" value={data.dataBase || "-"} />
            <DetailItem
              label="Architecture"
              value={data.serverArchitecture || "-"}
            />
            <DetailItem
              label="Additional Notes"
              value={data.additionalTechNotes || "-"}
            />
          </Card>

          <Card title="Responsible Persons" icon={Users}>
            <PersonSection
              title="Primary Responsible"
              person={data.responsiblePerson}
            />
            <PersonSection
              title="Alternate Responsible"
              person={data.alternativePerson}
            />
            <PersonSection title="Developer" person={data.developer} />
          </Card>
        </div>

        {/* Section 2: VM Specification & Network */}
        <div className="space-y-6">
          <Card title="VM Specification" icon={Server}>
            <DetailItem
              label="Quantity"
              value={data.quantity?.toString() || "1"}
            />
            <DetailItem label="vCPU" value={data.vcpu?.toString() || "0"} />
            <DetailItem
              label="RAM (GB)"
              value={data.ramGb?.toString() || "0"}
            />
            <DetailItem
              label="OS Disk (GB)"
              value={data.storageGb?.toString() || "0"}
            />
            <DetailItem
              label="OS"
              value={`${data.osName || "-"} ${data.osVersion || ""}`}
            />
            <DetailItem label="RAID" value={data.raid || "NONE"} />
            <DetailItem label="Subdomain" value={data.subdomain || "-"} />
          </Card>

          <Card title="Additional Disks" icon={Server}>
            {data.additionalDisks.length > 0 ? (
              data.additionalDisks.map((disk: any, i: any) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{disk.purpose || `Disk ${i + 1}`}</span>
                  <span className="font-medium">{disk.sizeGb} GB</span>
                </div>
              ))
            ) : (
              <span className="text-muted-foreground">None</span>
            )}
          </Card>

          <Card title="Network & Security" icon={Network}>
            <DetailItem
              label="Network Access"
              value={data.networkAccess.join(", ")}
            />
            <DetailItem
              label="Public IP"
              value={data.requiredPublicIP ? "Yes" : "No"}
            />
            <DetailItem
              label="VPN Required"
              value={data.vpnRequired ? "Yes" : "No"}
            />
            <DetailItem label="SSL Provider" value={data.sslProvider || "-"} />
            <DetailItem label="SSL Paid By" value={data.sslCostPaidBy || "-"} />
          </Card>

          <Card title="Firewall Ports" icon={Shield}>
            {data.firewallPorts.length > 0 ? (
              data.firewallPorts.map((port: any, i: any) => (
                <div key={i} className="text-sm">
                  <span className="font-medium">
                    {port.port}/{port.protocol}
                  </span>
                  {port.purpose && ` - ${port.purpose}`}
                  {port.source && ` (Source: ${port.source})`}
                </div>
              ))
            ) : (
              <span className="text-muted-foreground">None</span>
            )}
          </Card>

          <Card title="Compliance" icon={FileText}>
            <DetailItem
              label="VA Report Submitted"
              value={data.vaReportSubmitted ? "Yes" : "No"}
            />
            <DetailItem
              label="Justification Submitted"
              value={data.justificationSubmitted ? "Yes" : "No"}
            />
            <DetailItem
              label="Renewal Required"
              value={data.renewalRequired ? "Yes" : "No"}
            />
            {data.renewalRequired && (
              <DetailItem
                label="Renewal Period"
                value={`${data.renewalPeriodMonths} months`}
              />
            )}
          </Card>
        </div>
      </div>
      {/* VM Instances */}
      {data.vmInstances.length > 0 && (
        <>
          <h2 className="text-xl font-semibold border-b pb-2">
            Provisioned VMs
          </h2>
          <VmInstanceList vms={data.vmInstances} />
        </>
      )}
      {/* Approvals */}
      <ApprovalPanel
        requestId={data.id}
        approvals={data.approvals}
        currentStatus={data.status}
        currentUserId={userId}
      />
      {/* Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg flex justify-between z-50">
        <Button asChild variant="outline">
          <Link href="/requests">Back to Requests</Link>
        </Button>
        {isDraft && (
          <Button asChild>
            <Link href={`/requests/${data.id}/edit`}>
              <Check className="w-4 h-4 mr-2" />
              Edit Draft
            </Link>
          </Button>
        )}
      </div>
      {data.status === "DRAFT" && (
        <div className="flex gap-2">
          <Button onClick={handleSubmit}>Submit for Approval</Button>
          <Link href="/requests">
            <Button variant="outline">Back to List</Button>
          </Link>
        </div>
      )}
    </div>
  );
}

// Helper Components (unchanged from your original)
function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
}) {
  return (
    <div className="border rounded-lg bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-5 h-5 text-muted-foreground" />
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function PersonSection({
  title,
  person,
}: {
  title: string;
  person: {
    name: string;
    designation: string;
    organization: string;
    contact: string;
    email: string;
  };
}) {
  if (!person.name) return null;

  return (
    <div className="pt-2">
      <h4 className="font-medium text-sm mb-1">{title}</h4>
      <div className="text-sm space-y-1">
        <div>
          {person.name} ({person.designation})
        </div>
        <div>{person.organization}</div>
        <div>
          {person.contact} | {person.email}
        </div>
      </div>
    </div>
  );
}
