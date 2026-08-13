// src/app/requests/components/RequestDetail.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format } from "date-fns";
import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import ComplianceTagsCard from "@/components/vms/ComplianceTagsCard";
import { 
  Check, 
  Copy, 
  Server, 
  Users, 
  Code,  
  HardDrive,
  Clock,
  LucideIcon,
  Shield,
  FileText,
  Download,
  Cpu,
  Globe,
  Printer,
  FileSpreadsheet
} from "lucide-react";
import { ApprovalPanel } from "@/app/approvals/components/ApprovalPanel";
import { Timeline } from "@/app/approvals/components/Timeline";
import { VmInstanceList } from "./VmInstanceList";
import { getDetailedRequest, submitRequest } from "@/app/actions/request-actions";
import { detailsRequest, Person } from "@/types/requests";
import { toast } from "sonner";
import type { ReactNode } from "react";

export function RequestDetails({
  requestId,
  hideTimeline = false,
}: {
  requestId: string;
  hideTimeline?: boolean;
}) {
  const { data: session } = useSession();
  const [data, setData] = useState<detailsRequest | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRequestData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getDetailedRequest(requestId);
      if (!response) {
        setData(null);
        return;
      }
      // Handle both ApiResponse and raw data for backwards compatibility
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const requestData = (response as any).success ? (response as any).data : response;
      setData(requestData as detailsRequest | null);
    } catch (error) {
      toast.error(`Failed to load request data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    if (!requestId) return;
    fetchRequestData();
  }, [requestId, fetchRequestData]);

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

  // Calculations block
  let vmCount = 0;
  let namespaceCount = 0;
  let totalCpu = 0;
  let totalRam = 0;
  let totalStorage = 0;
  let osText = "";
  const envs: string[] = [];
  const techStacks: string[] = [];
  const subdomains: string[] = [];
  const targetResources: string[] = [];

  const requestType = data.requestType;

  if (requestType === "NEW_VM") {
    vmCount = data.vmSpecifications?.length || data.quantity || 1;
    if (data.vmSpecifications && data.vmSpecifications.length > 0) {
      data.vmSpecifications.forEach(spec => {
        totalCpu += spec.vcpu || 0;
        totalRam += spec.ramGb || 0;
        totalStorage += spec.storageGb || 0;
        if (spec.additionalStorage) {
          spec.additionalStorage.forEach((disk: any) => {
            totalStorage += disk.sizeGb || 0;
          });
        }
        if (spec.osVersion && !osText.includes(spec.osVersion)) {
          osText = osText ? `${osText}, ${spec.osVersion}` : spec.osVersion;
        }
        if (spec.environment && !envs.includes(spec.environment)) {
          envs.push(spec.environment);
        }
        if (spec.stack && !techStacks.includes(spec.stack)) {
          techStacks.push(spec.stack);
        }
        if (spec.subdomain) {
          subdomains.push(`${spec.subdomain}.dghs.gov.bd`);
        }
      });
    } else {
      totalCpu = (data.vcpu || 1) * vmCount;
      totalRam = (data.ramGb || 2) * vmCount;
      totalStorage = (data.storageGb || 50) * vmCount;
      osText = `${data.osName || ""} ${data.osVersion || ""}`.trim() || "—";
      envs.push(data.environment || "—");
      if (data.subdomain) subdomains.push(data.subdomain);
    }
  } else if (requestType === "CLONE_VM") {
    vmCount = 1;
    totalCpu = data.vcpu || data.targetVm?.currentSpec?.vcpu || 1;
    totalRam = data.ramGb || data.targetVm?.currentSpec?.ramGb || 2;
    totalStorage = data.storageGb || data.targetVm?.currentSpec?.storageGb || 50;
    osText = `${data.targetVm?.currentSpec?.osName || ""} ${data.targetVm?.currentSpec?.osVersion || ""}`.trim() || "—";
    envs.push(data.environment || "—");
    if (data.subdomain) subdomains.push(data.subdomain);
  } else if (requestType === "K8S_NAMESPACE") {
    namespaceCount = 1;
    if (data.k8sRequestNodeGroups && data.k8sRequestNodeGroups.length > 0) {
      data.k8sRequestNodeGroups.forEach(group => {
        const count = group.nodeCount || 1;
        totalCpu += (group.vcpu || 0) * count;
        totalRam += (group.ramGb || 0) * count;
        totalStorage += (group.storageGb || 0) * count;
      });
    }
    envs.push(data.environment || "—");
  } else if (requestType === "SYSTEM_UPGRADE") {
    vmCount = 1;
    const currentCpu = data.targetVm?.currentSpec?.vcpu || 0;
    const currentRam = data.targetVm?.currentSpec?.ramGb || 0;
    const currentStorage = data.targetVm?.currentSpec?.storageGb || 0;
    
    totalCpu = data.upgradeCpu ? data.upgradeCpu : currentCpu;
    totalRam = data.upgradeRamGb ? data.upgradeRamGb : currentRam;
    totalStorage = data.upgradeStorageGb ? (currentStorage + data.upgradeStorageGb) : currentStorage;
    
    osText = `${data.targetVm?.currentSpec?.osName || ""} ${data.targetVm?.currentSpec?.osVersion || ""}`.trim() || "—";
    envs.push(data.targetVm?.environment || "—");
    const resources = (data as any).requestResources || [];
    resources.forEach((r: any) => {
      if (r.vm) {
        vmCount++;
        targetResources.push(`VM: ${r.vm.hostname || "Unnamed"} (${r.vm.ipAddress || "No IP"})`);
      } else if (r.namespace) {
        namespaceCount++;
        targetResources.push(`Namespace: ${r.namespace.name}`);
      }
    });
    
    if (targetResources.length === 0 && data.targetVm) {
      vmCount = 1;
      targetResources.push(`VM: ${data.targetVm.hostname || "Unnamed"} (${data.targetVm.ipAddress || "No IP"})`);
    }
  } else if (requestType === "CUSTOMIZED" || requestType === "DECOMMISSION") {
    vmCount = 1;
    totalCpu = data.targetVm?.currentSpec?.vcpu || 0;
    totalRam = data.targetVm?.currentSpec?.ramGb || 0;
    totalStorage = data.targetVm?.currentSpec?.storageGb || 0;
    osText = `${data.targetVm?.currentSpec?.osName || ""} ${data.targetVm?.currentSpec?.osVersion || ""}`.trim() || "—";
    envs.push(data.targetVm?.environment || "—");
  }

  if (techStacks.length === 0 && (data.frontendTech || data.backendTech || data.dataBase)) {
    if (data.frontendTech) techStacks.push(`Frontend: ${data.frontendTech}`);
    if (data.backendTech) techStacks.push(`Backend: ${data.backendTech}`);
    if (data.dataBase) techStacks.push(`Database: ${data.dataBase}`);
  }

  // Exporters
  const exportRequestCSV = (reqData: detailsRequest) => {
    const lines: string[] = [];
    const addSection = (title: string) => {
      lines.push("");
      lines.push(`"${title.toUpperCase()}"`);
    };
    const addRow = (key: string, val: any) => {
      const safeVal = val === null || val === undefined ? "" : String(val);
      lines.push(`"${key}","${safeVal.replace(/"/g, '""')}"`);
    };

    lines.push(`"DATACENTER REQUEST COMPLETE RECORD - ID: ${reqData.id}"`);
    lines.push(`"Generated: ${new Date().toLocaleString()}"`);

    addSection("Request Details");
    addRow("Request ID", reqData.id);
    addRow("System Name", reqData.systemName);
    addRow("Project Name", reqData.projectName);
    addRow("Request Type", reqData.requestType);
    addRow("Status", reqData.status);
    addRow("Environment", reqData.environment);
    addRow("Submitted At", reqData.submittedAt ? format(new Date(reqData.submittedAt), "yyyy-MM-dd HH:mm") : "—");
    addRow("Purpose / Reason", reqData.purpose);

    addSection("Requester Details");
    if (reqData.requester) {
      addRow("Name", reqData.requester.name);
      addRow("Email", reqData.requester.email);
      addRow("Designation", reqData.requester.designation || "—");
      addRow("Organization", reqData.requester.organization || "—");
      addRow("Contact", reqData.requester.contact || "—");
    }

    if (reqData.alternativePerson) {
      addSection("Alternative Person Details");
      addRow("Name", reqData.alternativePerson.name);
      addRow("Email", reqData.alternativePerson.email || "—");
      addRow("Designation", reqData.alternativePerson.designation || "—");
      addRow("Organization", reqData.alternativePerson.organization || "—");
      addRow("Contact", reqData.alternativePerson.contact || "—");
    }

    if (reqData.developer) {
      addSection("Technical Developer Details");
      addRow("Name", reqData.developer.name);
      addRow("Email", reqData.developer.email || "—");
      addRow("Designation", reqData.developer.designation || "—");
      addRow("Organization", reqData.developer.organization || "—");
      addRow("Contact", reqData.developer.contact || "—");
    }

    addSection("Technology Stack");
    addRow("Frontend Tech", reqData.frontendTech || "—");
    addRow("Backend Tech", reqData.backendTech || "—");
    addRow("Database", reqData.dataBase || "—");
    addRow("Server Architecture", reqData.serverArchitecture || "—");
    addRow("Additional Tech Notes", reqData.additionalTechNotes || "—");

    addSection("Network & Connectivity");
    addRow("VPN Required", reqData.vpnRequired ? "Yes" : "No");
    addRow("Public IP Required", reqData.requiredPublicIP ? "Yes" : "No");
    addRow("VPN Details", reqData.vpnDetails || "—");
    addRow("VA Report Submitted", reqData.vaReportSubmitted ? "Yes" : "No");
    addRow("Renewal Required", reqData.renewalRequired ? "Yes" : "No");
    addRow("Renewal Period (Months)", reqData.renewalPeriodMonths || "—");

    if (reqData.vmSpecifications && reqData.vmSpecifications.length > 0) {
      addSection("Requested Virtual Machines");
      reqData.vmSpecifications.forEach((spec: any, idx: number) => {
        lines.push(`"VM ${idx + 1} - Stack","${spec.stack || 'General Purpose'}"`);
        lines.push(`"VM ${idx + 1} - Environment","${spec.environment || '—'}"`);
        lines.push(`"VM ${idx + 1} - Compute","${spec.vcpu} vCPUs / ${spec.ramGb} GB RAM"`);
        lines.push(`"VM ${idx + 1} - Storage","${spec.storageGb} GB Disk"`);
        lines.push(`"VM ${idx + 1} - OS Version","${spec.osVersion || '—'}"`);
        lines.push(`"VM ${idx + 1} - Subdomain","${spec.subdomain || '—'}"`);
        if (spec.gpuEnabled) {
          lines.push(`"VM ${idx + 1} - GPU Specs","${spec.gpuVramGb} GB VRAM / ${spec.gpuStorageGb} GB SSD"`);
        }
        if (spec.firewallRules && spec.firewallRules.length > 0) {
          const rules = spec.firewallRules.map((r: any) => `${r.port}/${r.protocol} (${r.purpose})`).join(", ");
          lines.push(`"VM ${idx + 1} - Firewall Rules","${rules}"`);
        }
        if (spec.additionalStorage && spec.additionalStorage.length > 0) {
          const disks = spec.additionalStorage.map((d: any) => `${d.sizeGb}GB (${d.purpose})`).join(", ");
          lines.push(`"VM ${idx + 1} - Additional Disks","${disks}"`);
        }
      });
    }

    if (reqData.k8sRequestNodeGroups && reqData.k8sRequestNodeGroups.length > 0) {
      addSection("Kubernetes Node Groups");
      reqData.k8sRequestNodeGroups.forEach((group: any) => {
        lines.push(`"Role: ${group.role}","Nodes: ${group.nodeCount} | vCPU: ${group.vcpu} Cores | RAM: ${group.ramGb} GB | Storage: ${group.storageGb} GB"`);
      });
    }

    if (targetResources.length > 0) {
      addSection("Assigned Resources");
      targetResources.forEach((res: string, idx: number) => {
        lines.push(`"Assignment ${idx + 1}","${res}"`);
      });
    }

    if (reqData.approvals && reqData.approvals.length > 0) {
      addSection("Approval Workflow History");
      reqData.approvals.forEach((app: any) => {
        const statusText = (app.decision || "PENDING").replace(/_/g, " ");
        const name = app.approver?.name || "System/Auto";
        const role = app.approverRole || `Level ${app.level}`;
        const date = app.decidedAt ? format(new Date(app.decidedAt), "yyyy-MM-dd HH:mm") : "—";
        const comments = app.comments || "—";
        lines.push(`"${statusText}","By: ${name} (${role}) | Date: ${date} | Comments: ${comments}"`);
      });
    }

    const csvContent = lines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `request-record-${reqData.id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV export complete!");
  };

  const exportRequestExcel = (reqData: detailsRequest) => {
    const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>';
    const workbook = '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
    const worksheet = '<Worksheet ss:Name="Request Record">';
    const table = '<Table ss:ExpandedColumnCount="2">';
    
    const rows: string[] = [];
    const addTitle = (text: string) => {
      rows.push(`<Row><Cell ss:MergeAcross="1"><Data ss:Type="String">${text}</Data></Cell></Row>`);
    };
    const addSection = (title: string) => {
      rows.push(`<Row ss:Index="${rows.length + 3}"><Cell><Data ss:Type="String">${title.toUpperCase()}</Data></Cell></Row>`);
    };
    const addRow = (key: string, val: any) => {
      const safeVal = val === null || val === undefined ? "" : String(val);
      const escapedVal = safeVal.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      rows.push(`<Row><Cell><Data ss:Type="String">${key}</Data></Cell><Cell><Data ss:Type="String">${escapedVal}</Data></Cell></Row>`);
    };

    addTitle(`DATACENTER REQUEST COMPLETE RECORD - ID: ${reqData.id}`);
    addRow("Generated", new Date().toLocaleString());

    addSection("Request Details");
    addRow("Request ID", reqData.id);
    addRow("System Name", reqData.systemName);
    addRow("Project Name", reqData.projectName);
    addRow("Request Type", reqData.requestType);
    addRow("Status", reqData.status);
    addRow("Environment", reqData.environment);
    addRow("Submitted At", reqData.submittedAt ? format(new Date(reqData.submittedAt), "yyyy-MM-dd HH:mm") : "—");
    addRow("Purpose / Reason", reqData.purpose);

    addSection("Requester Details");
    if (reqData.requester) {
      addRow("Name", reqData.requester.name);
      addRow("Email", reqData.requester.email);
      addRow("Designation", reqData.requester.designation || "—");
      addRow("Organization", reqData.requester.organization || "—");
      addRow("Contact", reqData.requester.contact || "—");
    }

    if (reqData.alternativePerson) {
      addSection("Alternative Person Details");
      addRow("Name", reqData.alternativePerson.name);
      addRow("Email", reqData.alternativePerson.email || "—");
      addRow("Designation", reqData.alternativePerson.designation || "—");
      addRow("Organization", reqData.alternativePerson.organization || "—");
      addRow("Contact", reqData.alternativePerson.contact || "—");
    }

    if (reqData.developer) {
      addSection("Technical Developer Details");
      addRow("Name", reqData.developer.name);
      addRow("Email", reqData.developer.email || "—");
      addRow("Designation", reqData.developer.designation || "—");
      addRow("Organization", reqData.developer.organization || "—");
      addRow("Contact", reqData.developer.contact || "—");
    }

    addSection("Technology Stack");
    addRow("Frontend Tech", reqData.frontendTech || "—");
    addRow("Backend Tech", reqData.backendTech || "—");
    addRow("Database", reqData.dataBase || "—");
    addRow("Server Architecture", reqData.serverArchitecture || "—");
    addRow("Additional Tech Notes", reqData.additionalTechNotes || "—");

    addSection("Network & Connectivity");
    addRow("VPN Required", reqData.vpnRequired ? "Yes" : "No");
    addRow("Public IP Required", reqData.requiredPublicIP ? "Yes" : "No");
    addRow("VPN Details", reqData.vpnDetails || "—");
    addRow("VA Report Submitted", reqData.vaReportSubmitted ? "Yes" : "No");
    addRow("Renewal Required", reqData.renewalRequired ? "Yes" : "No");
    addRow("Renewal Period (Months)", reqData.renewalPeriodMonths || "—");

    if (reqData.vmSpecifications && reqData.vmSpecifications.length > 0) {
      addSection("Requested Virtual Machines");
      reqData.vmSpecifications.forEach((spec: any, idx: number) => {
        addRow(`VM ${idx + 1} - Stack`, spec.stack || 'General Purpose');
        addRow(`VM ${idx + 1} - Environment`, spec.environment || '—');
        addRow(`VM ${idx + 1} - Compute`, `${spec.vcpu} vCPUs / ${spec.ramGb} GB RAM`);
        addRow(`VM ${idx + 1} - Storage`, `${spec.storageGb} GB Disk`);
        addRow(`VM ${idx + 1} - OS Version`, spec.osVersion || '—');
        addRow(`VM ${idx + 1} - Subdomain`, spec.subdomain || '—');
        if (spec.gpuEnabled) {
          addRow(`VM ${idx + 1} - GPU Specs`, `${spec.gpuVramGb} GB VRAM / ${spec.gpuStorageGb} GB SSD`);
        }
        if (spec.firewallRules && spec.firewallRules.length > 0) {
          const rules = spec.firewallRules.map((r: any) => `${r.port}/${r.protocol} (${r.purpose})`).join(", ");
          addRow(`VM ${idx + 1} - Firewall Rules`, rules);
        }
        if (spec.additionalStorage && spec.additionalStorage.length > 0) {
          const disks = spec.additionalStorage.map((d: any) => `${d.sizeGb}GB (${d.purpose})`).join(", ");
          addRow(`VM ${idx + 1} - Additional Disks`, disks);
        }
      });
    }

    if (reqData.k8sRequestNodeGroups && reqData.k8sRequestNodeGroups.length > 0) {
      addSection("Kubernetes Node Groups");
      reqData.k8sRequestNodeGroups.forEach((group: any) => {
        addRow(`Role: ${group.role}`, `Nodes: ${group.nodeCount} | vCPU: ${group.vcpu} Cores | RAM: ${group.ramGb} GB | Storage: ${group.storageGb} GB`);
      });
    }

    if (targetResources.length > 0) {
      addSection("Assigned Resources");
      targetResources.forEach((res: string, idx: number) => {
        addRow(`Assignment ${idx + 1}`, res);
      });
    }

    if (reqData.approvals && reqData.approvals.length > 0) {
      addSection("Approval Workflow History");
      reqData.approvals.forEach((app: any) => {
        const statusText = (app.decision || "PENDING").replace(/_/g, " ");
        const name = app.approver?.name || "System/Auto";
        const role = app.approverRole || `Level ${app.level}`;
        const date = app.decidedAt ? format(new Date(app.decidedAt), "yyyy-MM-dd HH:mm") : "—";
        const comments = app.comments || "—";
        addRow(statusText, `By: ${name} (${role}) | Date: ${date} | Comments: ${comments}`);
      });
    }

    const xml = xmlHeader + workbook + worksheet + table + rows.join("") + '</Table></Worksheet></Workbook>';
    const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `request-record-${reqData.id}.xls`;
    link.click();
    toast.success("Excel export complete!");
  };

  return (
    <>
      <div className="max-w-6xl mx-auto space-y-8 pb-28 print:hidden">
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

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => exportRequestExcel(data)} className="gap-2">
              <FileSpreadsheet className="w-4 h-4" /> Export Excel
            </Button>
            <Button variant="outline" onClick={() => exportRequestCSV(data)} className="gap-2">
              <Download className="w-4 h-4" /> Export CSV
            </Button>
            <Button variant="outline" onClick={() => window.print()} className="gap-2">
              <Printer className="w-4 h-4" /> Print Request
            </Button>

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

      <ResourceSummaryCard data={data} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Target VM Link (for customizations/decommissions) */}
          {(data.targetVm || (data.vmInstances && data.vmInstances.length > 0)) && (
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
              {data.requestType === "K8S_NAMESPACE" && (
                <>
                  <DetailItem label="Namespace Source" value={data.underExistingNamespace ? "Existing Namespace" : "New Namespace"} />
                  <DetailItem label="Namespace Name" value={data.kubernetesNamespace || "To be selected"} />
                </>
              )}
            </div>
          </Card>

          {/* Technology Stack */}
          {data.requestType !== "DECOMMISSION" && data.requestType !== "NEW_VM" && (
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

          {/* Repeatable VM Specifications */}
          {(data.requestType === "NEW_VM") && data.vmSpecifications && data.vmSpecifications.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Server className="w-5 h-5 text-indigo-600" /> 
                Requested VM Specifications ({data.vmSpecifications.length})
              </h3>
              <div className="space-y-4">
                {data.vmSpecifications.map((spec: any, index: number) => (
                  <div key={spec.id || index} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-slate-50/50 px-5 py-3 border-b border-slate-100 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span className="h-5 w-5 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center text-xs font-bold">
                          {index + 1}
                        </span>
                        <span className="font-bold text-slate-700 text-sm">
                          {spec.stack || "General Purpose VM"}
                        </span>
                      </div>
                      <Badge className="bg-indigo-100 text-indigo-800">{spec.environment}</Badge>
                    </div>
                    <div className="p-5 space-y-4 text-xs">
                      {/* Grid of attributes */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-[10px] uppercase text-slate-400 font-bold">Compute</p>
                          <p className="font-semibold text-slate-800 mt-0.5">{spec.vcpu} Cores / {spec.ramGb} GB RAM</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-slate-400 font-bold">Primary Storage</p>
                          <p className="font-semibold text-slate-800 mt-0.5">{spec.storageGb} GB</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-slate-400 font-bold">OS Version</p>
                          <p className="font-semibold text-slate-800 mt-0.5">{spec.osVersion || "—"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-slate-400 font-bold">Proposed Subdomain</p>
                          <p className="font-semibold text-slate-800 mt-0.5">{spec.subdomain ? `https://${spec.subdomain}.dghs.gov.bd` : "—"}</p>
                        </div>
                      </div>

                      {/* GPU */}
                      {spec.gpuEnabled && (
                        <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-3 grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] uppercase text-amber-600 font-bold">GPU VRAM</p>
                            <p className="font-semibold text-amber-800 mt-0.5">{spec.gpuVramGb} GB</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase text-amber-600 font-bold">GPU Storage</p>
                            <p className="font-semibold text-amber-800 mt-0.5">{spec.gpuStorageGb} GB</p>
                          </div>
                        </div>
                      )}

                      {/* Connectivity */}
                      {spec.connectivity && spec.connectivity.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] uppercase text-slate-400 font-bold mb-1">Connectivity</p>
                          <div className="flex flex-wrap gap-2">
                            {spec.connectivity.map((c: any, i: number) => (
                              <Badge key={i} variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                                {c.accessType === "LOCAL" ? "Local" : c.accessType === "INTERNET" ? "Internet" : c.accessType === "REMOTE" ? "Remote" : c.accessType === "VPN" ? "VPN" : c.accessType}
                              </Badge>
                            ))}
                          </div>
                          {spec.vpnDetails && (
                            <div className="bg-emerald-50/50 border border-emerald-100 p-2.5 rounded-lg text-emerald-800 mt-1 max-w-xl">
                              <p className="font-bold text-[10px] uppercase text-emerald-600 mb-0.5">VPN Connection Details</p>
                              <p className="text-xs">{spec.vpnDetails}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Firewall Ports */}
                      {spec.firewallRules && spec.firewallRules.length > 0 && (
                        <div className="border-t border-slate-100 pt-3">
                          <p className="text-[10px] uppercase text-slate-400 font-bold mb-2">Firewall Rules</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {spec.firewallRules.map((rule: any, i: number) => (
                              <div key={i} className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex justify-between items-center">
                                <span className="font-bold text-slate-700">{rule.port} / {rule.protocol}</span>
                                <span className="text-slate-500 italic">{rule.purpose}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Additional Storage */}
                      {spec.additionalStorage && spec.additionalStorage.length > 0 && (
                        <div className="border-t border-slate-100 pt-3">
                          <p className="text-[10px] uppercase text-slate-400 font-bold mb-2">Additional Storage</p>
                          <div className="space-y-2">
                            {spec.additionalStorage.map((disk: any, i: number) => (
                              <div key={i} className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex justify-between items-center">
                                <span className="font-bold text-slate-700">{disk.sizeGb} GB</span>
                                <span className="text-slate-500 italic">{disk.purpose || `Disk ${disk.sequence}`}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* People */}
          <Card title="Responsible Personnel" icon={Users}>
            <div className="space-y-6">
              {data.requester && (
                <PersonSection 
                  title="Primary Contact (Requester)" 
                  person={{
                    name: data.requester.name,
                    designation: data.requester.designation || "Requester",
                    organization: data.requester.email?.split('@')[1] || "DGHS",
                    contact: data.alternativePerson?.contact || "",
                    email: data.requester.email,
                  }} 
                />
              )}
              
              {data.alternativePerson?.name && (
                <PersonSection 
                  title="Alternative Contact" 
                  person={data.alternativePerson} 
                />
              )}
              
              {data.developer?.name && (
                <PersonSection 
                  title="Technical Developer" 
                  person={data.developer} 
                />
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Specification */}
          {data.requestType !== "NEW_VM" && (
            data.requestType === "VPN_ACCESS" || data.requestType === "HORIZON_ACCESS" ? (
              <Card title="Access Specification" icon={Shield}>
                <div className="space-y-3">
                  <DetailItem label="Access Type" value={data.accessType || (data.requestType === "VPN_ACCESS" ? "VPN" : "Horizon")} />
                  <DetailItem label="Target VM Hostname" value={data.targetVm?.hostname || "—"} />
                  <DetailItem label="Target VM IP Address" value={data.targetVm?.ipAddress || "—"} />
                  <DetailItem label="Access Justification" value={data.accessJustification || data.purpose} />
                </div>
              </Card>
            ) : data.requestType === "K8S_NAMESPACE" ? (
              <Card title="K8s Namespace Spec" icon={Code}>
                <div className="space-y-4">
                  <div className="bg-indigo-50/50 border border-indigo-200 rounded-lg p-3 text-xs text-indigo-800 flex items-center gap-2 mb-2">
                    <span className="font-semibold">Note:</span> This request specifies Kubernetes node groups to be provisioned.
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <th className="py-2">Role</th>
                          <th className="py-2 text-center">Node Count</th>
                          <th className="py-2 text-center">vCPU</th>
                          <th className="py-2 text-center">RAM</th>
                          <th className="py-2 text-right">Storage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-xs">
                        {data.k8sRequestNodeGroups?.map((group: any) => (
                          <tr key={group.id} className="text-slate-700">
                            <td className="py-2.5 font-bold text-indigo-700">{group.role}</td>
                            <td className="py-2.5 text-center font-semibold">{group.nodeCount}</td>
                            <td className="py-2.5 text-center">{group.vcpu} Cores</td>
                            <td className="py-2.5 text-center">{group.ramGb} GB</td>
                            <td className="py-2.5 text-right font-medium">{group.storageGb} GB</td>
                          </tr>
                        )) || (
                          <tr>
                            <td colSpan={5} className="py-4 text-center text-slate-400 italic">No node groups defined</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>
            ) : data.requestType === "SYSTEM_UPGRADE" ? (
              <Card title="Compute Upgrade Specifications" icon={Cpu}>
                <div className="space-y-4">
                  <div className="bg-indigo-50/50 border border-indigo-200 rounded-lg p-3 text-xs text-indigo-800 flex items-center gap-2 mb-2">
                    <span className="font-semibold">Note:</span> This is a request to upgrade compute resources of VM: <strong className="ml-1">{data.targetVm?.hostname || data.vmInstances?.[0]?.hostname || "Target VM"}</strong>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <th className="py-2">Resource</th>
                          <th className="py-2 text-center">Current</th>
                          <th className="py-2 text-center">Requested Upgrade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-xs">
                        <tr className="text-slate-700">
                          <td className="py-2.5 font-semibold">vCPU Cores</td>
                          <td className="py-2.5 text-center">{data.targetVm?.currentSpec?.vcpu || "—"} Cores</td>
                          <td className="py-2.5 text-center font-bold text-indigo-700">
                            {data.upgradeCpu ? `${data.upgradeCpu} Cores` : "No Change"}
                          </td>
                        </tr>
                        <tr className="text-slate-700">
                          <td className="py-2.5 font-semibold">Memory (RAM)</td>
                          <td className="py-2.5 text-center">{data.targetVm?.currentSpec?.ramGb || "—"} GB</td>
                          <td className="py-2.5 text-center font-bold text-indigo-700">
                            {data.upgradeRamGb ? `${data.upgradeRamGb} GB` : "No Change"}
                          </td>
                        </tr>
                        <tr className="text-slate-700">
                          <td className="py-2.5 font-semibold">Additional Storage</td>
                          <td className="py-2.5 text-center">{data.targetVm?.currentSpec?.storageGb || "—"} GB (Current Total)</td>
                          <td className="py-2.5 text-center font-bold text-indigo-700">
                            {data.upgradeStorageGb ? `+${data.upgradeStorageGb} GB (Additional)` : "No Change"}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>
            ) : (
              <Card title="Resource Specification" icon={HardDrive}>
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                    <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full" /> <span className="text-sm text-slate-600">vCPU</span></div>
                    <span className="font-bold text-slate-900">{data.vcpu || 0} Cores</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                    <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full" /> <span className="text-sm text-slate-600">RAM</span></div>
                    <span className="font-bold text-slate-900">{data.ramGb || 0} GB</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                    <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-emerald-500" /> <span className="text-sm text-slate-600">Storage</span></div>
                    <span className="font-bold text-slate-900">{data.storageGb || 0} GB</span>
                  </div>
                  <DetailItem label="Operating System" value={`${data.osName || ""} ${data.osVersion || ""}`} />
                  <DetailItem label="Subdomain" value={data.subdomain} />
                </div>
              </Card>
            )
          )}

          {/* Security & Compliance */}
          <Card title="Security & Network" icon={Shield}>
            <div className="space-y-2">
              <ComplianceItem label="Public IP" status={data.requiredPublicIP} />
              <ComplianceItem label="VPN Required" status={data.vpnRequired} />
              {data.vpnRequired && data.vpnDetails && (
                <div className="bg-emerald-50/50 border border-emerald-100 p-2.5 rounded-lg text-emerald-800 text-[11px] mt-2 max-w-full">
                  <p className="font-bold text-[10px] uppercase text-emerald-600 mb-0.5">VPN Connection Details</p>
                  <p className="text-xs">{data.vpnDetails}</p>
                </div>
              )}
              <ComplianceItem label="VA Report" status={data.vaReportSubmitted} />
              <ComplianceItem label="Renewal" status={data.renewalRequired} />
              {data.renewalPeriodMonths && (
                <div className="pt-2 text-xs text-slate-500 border-t mt-2">Renew every {data.renewalPeriodMonths} months</div>
              )}
            </div>
          </Card>

          {/* Compliance & Tags Card */}
          <ComplianceTagsCard
            entityId={data.id}
            entityType="REQUEST"
            assignedTags={data.tags || []}
            currentUser={{
              roles: session?.user?.roles || [],
            }}
          />

          {/* Attachments */}
          {data.attachments && data.attachments.length > 0 && (
            <Card title="Attachments" icon={FileText}>
              <div className="space-y-2">
                {data.attachments.map((attachment) => (
                  <div key={attachment.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-700">{attachment.fileName}</p>
                        <p className="text-xs text-slate-400">
                          {attachment.attachmentType === "JUSTIFICATION" ? "Software Requirements Specification (SRS)" : attachment.attachmentType.replace(/_/g, " ")} • {attachment.user?.name || "Unknown"}
                        </p>
                      </div>
                    </div>
                    <a 
                      href={attachment.filePath} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Provisioned Instances */}
      {data?.vmInstances && data.vmInstances.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Server className="h-5 w-5 text-blue-600" /> Provisioned Instances
          </h2>
          <VmInstanceList vms={data.vmInstances || []} />
        </div>
      )}

      {/* Approval Flow */}
      {data?.approvals && data.approvals.length > 0 && (
        <div className="space-y-6">
          <ApprovalPanel
            approvals={data.approvals || []}
            requestType={data.requestType || ""}
          />
          {!hideTimeline && (
            <Card title="Approval Progress & Timeline" icon={Clock}>
              <div className="p-4 bg-slate-50/30 rounded-xl">
                <Timeline
                  requestType={data.requestType || ""}
                  currentStatus={data.status || ""}
                  approvals={data.approvals as any || []}
                />
              </div>
            </Card>
          )}
        </div>
      )}
      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white/80 backdrop-blur-md border-t p-4 shadow-2xl flex justify-between items-center z-50">
        <Button asChild variant="ghost">
          <Link href="/requests">Back to List</Link>
        </Button>
        
        {isDraft && (
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link href={`/requests/${data?.id}/edit`}>Edit Content</Link>
            </Button>
            <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700">
              Submit for Approval
            </Button>
          </div>
        )}
      </div>
    </div>

      {/* Printable view (only shown during window.print()) */}
      <div className="hidden print:block printable-request-document font-sans text-slate-850 p-8 space-y-6 bg-white w-full max-w-[210mm] mx-auto text-xs">
        {/* Document Branding Header */}
        <div className="flex justify-between items-center border-b-2 border-slate-900 pb-4">
          <div className="space-y-1">
            <h1 className="text-sm font-black tracking-tight text-slate-900 uppercase">Directorate General of Health Services (DGHS)</h1>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Government of the People&apos;s Republic of Bangladesh</p>
            <p className="text-[8px] text-slate-400 font-bold uppercase">MIS & Health Information System - Datacenter Operations</p>
          </div>
          <div className="text-right">
            <div className="inline-block px-2.5 py-1 bg-slate-100 border border-slate-200 rounded font-mono font-bold text-slate-700">
              REQ #{data.id}
            </div>
            <p className="text-[8px] text-slate-400 font-bold mt-1 uppercase">Official Record Sheet</p>
          </div>
        </div>

        {/* Section 1: Overview */}
        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 border rounded text-[10px]">
          <div className="space-y-1">
            <p className="font-bold text-slate-800"><span className="text-slate-400">System Name:</span> {data.systemName}</p>
            <p className="font-bold text-slate-800"><span className="text-slate-400">Project Name:</span> {data.projectName}</p>
            <p><span className="text-slate-400 font-medium">Request Type:</span> {data.requestType.replace(/_/g, " ")}</p>
          </div>
          <div className="space-y-1 text-right">
            <p><span className="text-slate-400 font-medium">Status:</span> <span className="font-bold uppercase">{data.status.replace(/_/g, " ")}</span></p>
            <p><span className="text-slate-400 font-medium">Environment:</span> {data.environment}</p>
            <p><span className="text-slate-400 font-medium">Submitted At:</span> {data.submittedAt ? format(new Date(data.submittedAt), "yyyy-MM-dd HH:mm") : "—"}</p>
          </div>
        </div>

        {/* Section 2: Resource Summary */}
        <div className="border border-slate-300 rounded p-3 space-y-2">
          <h2 className="text-[10px] font-black uppercase text-slate-900 border-b pb-0.5">1. Infrastructure Allocation Summary</h2>
          <div className="grid grid-cols-4 gap-4 text-[10px]">
            <div>
              <p className="text-[8px] text-slate-400 font-bold uppercase">Allocated Entities</p>
              <p className="font-bold text-slate-800 mt-0.5">
                {vmCount > 0 && `${vmCount} VM(s) `}
                {namespaceCount > 0 && `${namespaceCount} Namespace(s)`}
                {vmCount === 0 && namespaceCount === 0 && "—"}
              </p>
            </div>
            <div>
              <p className="text-[8px] text-slate-400 font-bold uppercase">vCPU Cores</p>
              <p className="font-bold text-slate-800 mt-0.5">{totalCpu > 0 ? `${totalCpu} Cores` : "—"}</p>
            </div>
            <div>
              <p className="text-[8px] text-slate-400 font-bold uppercase">Memory (RAM)</p>
              <p className="font-bold text-slate-800 mt-0.5">{totalRam > 0 ? `${totalRam} GB` : "—"}</p>
            </div>
            <div>
              <p className="text-[8px] text-slate-400 font-bold uppercase">Storage Space</p>
              <p className="font-bold text-slate-800 mt-0.5">{totalStorage > 0 ? `${totalStorage} GB` : "—"}</p>
            </div>
          </div>
        </div>

        {/* Section 3: Personnel */}
        <div className="grid grid-cols-3 gap-4">
          <div className="border border-slate-300 rounded p-2.5 space-y-1">
            <h3 className="text-[8px] font-black uppercase text-slate-900 border-b pb-0.5">Primary Requester</h3>
            {data.requester ? (
              <div className="space-y-0.5 text-[9px]">
                <p className="font-bold text-slate-850">{data.requester.name}</p>
                <p>{data.requester.designation} • {data.requester.organization}</p>
                <p className="text-slate-500 font-mono">{data.requester.email}</p>
                <p className="text-slate-500 font-mono">{data.requester.contact}</p>
              </div>
            ) : <p className="text-slate-400 italic">—</p>}
          </div>

          <div className="border border-slate-300 rounded p-2.5 space-y-1">
            <h3 className="text-[8px] font-black uppercase text-slate-900 border-b pb-0.5">Alternative Contact</h3>
            {data.alternativePerson?.name ? (
              <div className="space-y-0.5 text-[9px]">
                <p className="font-bold text-slate-850">{data.alternativePerson.name}</p>
                <p>{data.alternativePerson.designation} • {data.alternativePerson.organization}</p>
                <p className="text-slate-500 font-mono">{data.alternativePerson.email}</p>
                <p className="text-slate-500 font-mono">{data.alternativePerson.contact}</p>
              </div>
            ) : <p className="text-slate-400 italic">—</p>}
          </div>

          <div className="border border-slate-300 rounded p-2.5 space-y-1">
            <h3 className="text-[8px] font-black uppercase text-slate-900 border-b pb-0.5">Technical Developer</h3>
            {data.developer?.name ? (
              <div className="space-y-0.5 text-[9px]">
                <p className="font-bold text-slate-850">{data.developer.name}</p>
                <p>{data.developer.designation} • {data.developer.organization}</p>
                <p className="text-slate-500 font-mono">{data.developer.email}</p>
                <p className="text-slate-500 font-mono">{data.developer.contact}</p>
              </div>
            ) : <p className="text-slate-400 italic">—</p>}
          </div>
        </div>

        {/* Section 4: Specifications */}
        <div className="border border-slate-300 rounded p-3 space-y-2">
          <h2 className="text-[10px] font-black uppercase text-slate-900 border-b pb-0.5">2. Technical Specifications</h2>
          
          {(data.frontendTech || data.backendTech || data.dataBase) && (
            <div className="grid grid-cols-4 gap-2 border-b pb-1.5 text-[9px]">
              <p className="col-span-4 text-[8px] font-bold text-slate-400 uppercase">Software Stack Details</p>
              <p><span className="text-slate-400">Frontend:</span> {data.frontendTech || "—"}</p>
              <p><span className="text-slate-400">Backend:</span> {data.backendTech || "—"}</p>
              <p><span className="text-slate-400">Database:</span> {data.dataBase || "—"}</p>
              <p><span className="text-slate-400">Architecture:</span> {data.serverArchitecture || "—"}</p>
            </div>
          )}

          {data.vmSpecifications && data.vmSpecifications.length > 0 && (
            <div className="space-y-2.5 pt-0.5 text-[9px]">
              <p className="text-[8px] font-bold text-slate-400 uppercase">Requested VMs Details</p>
              {data.vmSpecifications.map((spec: any, idx: number) => (
                <div key={idx} className="bg-slate-50 p-2 rounded border border-slate-200 grid grid-cols-3 gap-1">
                  <p className="col-span-3 font-bold text-slate-800">VM #{idx + 1}: {spec.stack || 'General Purpose'}</p>
                  <p><span className="text-slate-400">Compute:</span> {spec.vcpu} vCPU / {spec.ramGb} GB RAM</p>
                  <p><span className="text-slate-400">Storage:</span> {spec.storageGb} GB Disk</p>
                  <p><span className="text-slate-400">OS Version:</span> {spec.osVersion || "—"}</p>
                  <p className="col-span-3"><span className="text-slate-400">Subdomain:</span> {spec.subdomain ? `${spec.subdomain}.dghs.gov.bd` : "—"}</p>
                  {spec.firewallRules && spec.firewallRules.length > 0 && (
                    <p className="col-span-3"><span className="text-slate-400 font-bold">Firewall Ports:</span> {spec.firewallRules.map((r: any) => `${r.port}/${r.protocol} (${r.purpose})`).join(", ")}</p>
                  )}
                  {spec.additionalStorage && spec.additionalStorage.length > 0 && (
                    <p className="col-span-3"><span className="text-slate-400 font-bold">Extra Disks:</span> {spec.additionalStorage.map((d: any) => `${d.sizeGb}GB (${d.purpose})`).join(", ")}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {data.k8sRequestNodeGroups && data.k8sRequestNodeGroups.length > 0 && (
            <div className="space-y-1 pt-0.5 text-[9px]">
              <p className="text-[8px] font-bold text-slate-400 uppercase">Kubernetes Node Groups Specifications</p>
              <table className="w-full text-left border border-collapse border-slate-350">
                <thead>
                  <tr className="bg-slate-100 font-bold border-b border-slate-350">
                    <th className="p-0.5">Role</th>
                    <th className="p-0.5 text-center">Nodes</th>
                    <th className="p-0.5 text-center">vCPU</th>
                    <th className="p-0.5 text-center">RAM</th>
                    <th className="p-0.5 text-right">Storage</th>
                  </tr>
                </thead>
                <tbody>
                  {data.k8sRequestNodeGroups.map((g: any, i: number) => (
                    <tr key={i} className="border-b border-slate-300">
                      <td className="p-0.5 font-bold">{g.role}</td>
                      <td className="p-0.5 text-center">{g.nodeCount}</td>
                      <td className="p-0.5 text-center">{g.vcpu} Cores</td>
                      <td className="p-0.5 text-center">{g.ramGb} GB</td>
                      <td className="p-0.5 text-right">{g.storageGb} GB</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {targetResources.length > 0 && (
            <div className="pt-1.5 border-t text-[9px]">
              <p className="text-[8px] font-bold text-slate-400 uppercase">Mapped Access Resources</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {targetResources.map((res, i) => (
                  <span key={i} className="px-1.5 py-0.5 rounded border bg-slate-50 font-bold">{res}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Section 5: Approvals & Signatures */}
        <div className="border border-slate-300 rounded p-3 space-y-3">
          <h2 className="text-[10px] font-black uppercase text-slate-900 border-b pb-0.5">3. Approval Workflow Audit & Verification</h2>
          <table className="w-full text-left border-collapse text-[9px]">
            <thead>
              <tr className="bg-slate-100 font-bold border-b border-slate-350">
                <th className="p-1">Step / Status</th>
                <th className="p-1">Decision Maker</th>
                <th className="p-1">Date & Time</th>
                <th className="p-1">Operator Comments</th>
              </tr>
            </thead>
            <tbody>
              {data.approvals && data.approvals.length > 0 ? (
                data.approvals.map((app: any, i: number) => (
                  <tr key={i} className="border-b">
                    <td className="p-1 font-bold uppercase">{(app.decision || "PENDING").replace(/_/g, " ")}</td>
                    <td className="p-1">{app.approver?.name || "System/Auto"} ({app.approverRole || `Level ${app.level}`})</td>
                    <td className="p-1">{app.decidedAt ? format(new Date(app.decidedAt), "yyyy-MM-dd HH:mm") : "—"}</td>
                    <td className="p-1 italic text-slate-600">{app.comments || "No comments supplied"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-2 text-center text-slate-400 italic">No approval milestones registered yet</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Audit Statement */}
          <div className="bg-slate-50 border p-2 rounded text-[8px] leading-relaxed text-slate-600">
            <strong>System Audit Statement:</strong> This document represents a complete, immutable system record generated directly from the DGHS Datacenter Portal database. All digital approval entries include associated user authentication signatures and UTC action logs.
          </div>

          {/* Signatures Row */}
          <div className="grid grid-cols-3 gap-6 pt-6 text-[8px] text-center">
            <div className="space-y-1">
              <div className="border-b border-slate-500 h-8 w-full" />
              <p className="font-bold uppercase text-slate-800">Prepared By (Requester)</p>
              <p className="text-slate-400">Sign & Date</p>
            </div>
            <div className="space-y-1">
              <div className="border-b border-slate-500 h-8 w-full" />
              <p className="font-bold uppercase text-slate-800">Approved By (Authority)</p>
              <p className="text-slate-400">Sign & Date</p>
            </div>
            <div className="space-y-1">
              <div className="border-b border-slate-500 h-8 w-full" />
              <p className="font-bold uppercase text-slate-800">Provisioned By (DC Ops)</p>
              <p className="text-slate-400">Sign & Date</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Subcomponents
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

// ✅ FIX 5: Handle all Person fields as potentially undefined
function PersonSection({ title, person }: { title: string; person: Partial<Person> }) {
  if (!person?.name) return null;
  
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-slate-900 border-l-2 border-blue-500 pl-2">{title}</p>
      <div className="pl-2 space-y-0.5">
        <p className="text-sm font-semibold text-slate-800">{person.name}</p>
        <p className="text-xs text-slate-500">
          {person.designation || "—"} • {person.organization || "—"}
        </p>
        <p className="text-xs text-slate-400">
          {person.email || "—"} • {person.contact || "—"}
        </p>
      </div>
    </div>
  );
}

function ResourceSummaryCard({ data }: { data: detailsRequest }) {
  let vmCount = 0;
  let namespaceCount = 0;
  let totalCpu = 0;
  let totalRam = 0;
  let totalStorage = 0;
  let gpuText = "";
  let osText = "";
  let envs: string[] = [];
  const techStacks: string[] = [];
  const subdomains: string[] = [];
  let vpnRequired = false;
  let publicIpRequired = false;
  const targetResources: string[] = [];

  const requestType = data.requestType;

  if (requestType === "NEW_VM") {
    vmCount = data.vmSpecifications?.length || data.quantity || 1;
    if (data.vmSpecifications && data.vmSpecifications.length > 0) {
      data.vmSpecifications.forEach(spec => {
        totalCpu += spec.vcpu || 0;
        totalRam += spec.ramGb || 0;
        totalStorage += spec.storageGb || 0;
        if (spec.additionalStorage) {
          spec.additionalStorage.forEach((disk: any) => {
            totalStorage += disk.sizeGb || 0;
          });
        }
        if (spec.gpuEnabled) {
          gpuText = `${spec.gpuVramGb} GB VRAM / ${spec.gpuStorageGb} GB SSD`;
        }
        if (spec.osVersion && !osText.includes(spec.osVersion)) {
          osText = osText ? `${osText}, ${spec.osVersion}` : spec.osVersion;
        }
        if (spec.environment && !envs.includes(spec.environment)) {
          envs.push(spec.environment);
        }
        if (spec.stack && !techStacks.includes(spec.stack)) {
          techStacks.push(spec.stack);
        }
        if (spec.subdomain) {
          subdomains.push(`${spec.subdomain}.dghs.gov.bd`);
        }
        if (spec.connectivity) {
          spec.connectivity.forEach((c: any) => {
            if (c.accessType === "VPN") vpnRequired = true;
            if (c.accessType === "INTERNET") publicIpRequired = true;
          });
        }
      });
    } else {
      totalCpu = (data.vcpu || 1) * vmCount;
      totalRam = (data.ramGb || 2) * vmCount;
      totalStorage = (data.storageGb || 50) * vmCount;
      osText = `${data.osName || ""} ${data.osVersion || ""}`.trim() || "—";
      envs = [data.environment || "—"];
      if (data.subdomain) subdomains.push(data.subdomain);
      vpnRequired = data.vpnRequired || false;
      publicIpRequired = data.requiredPublicIP || false;
    }
  } else if (requestType === "CLONE_VM") {
    vmCount = 1;
    totalCpu = data.vcpu || data.targetVm?.currentSpec?.vcpu || 1;
    totalRam = data.ramGb || data.targetVm?.currentSpec?.ramGb || 2;
    totalStorage = data.storageGb || data.targetVm?.currentSpec?.storageGb || 50;
    osText = `${data.targetVm?.currentSpec?.osName || ""} ${data.targetVm?.currentSpec?.osVersion || ""}`.trim() || "—";
    envs = [data.environment || "—"];
    if (data.subdomain) subdomains.push(data.subdomain);
    vpnRequired = data.vpnRequired || false;
    publicIpRequired = data.requiredPublicIP || false;
  } else if (requestType === "K8S_NAMESPACE") {
    namespaceCount = 1;
    if (data.k8sRequestNodeGroups && data.k8sRequestNodeGroups.length > 0) {
      data.k8sRequestNodeGroups.forEach(group => {
        const count = group.nodeCount || 1;
        totalCpu += (group.vcpu || 0) * count;
        totalRam += (group.ramGb || 0) * count;
        totalStorage += (group.storageGb || 0) * count;
      });
    }
    envs = [data.environment || "—"];
    vpnRequired = data.vpnRequired || false;
    publicIpRequired = data.requiredPublicIP || false;
  } else if (requestType === "SYSTEM_UPGRADE") {
    vmCount = 1;
    const currentCpu = data.targetVm?.currentSpec?.vcpu || 0;
    const currentRam = data.targetVm?.currentSpec?.ramGb || 0;
    const currentStorage = data.targetVm?.currentSpec?.storageGb || 0;
    
    totalCpu = data.upgradeCpu ? data.upgradeCpu : currentCpu;
    totalRam = data.upgradeRamGb ? data.upgradeRamGb : currentRam;
    totalStorage = data.upgradeStorageGb ? (currentStorage + data.upgradeStorageGb) : currentStorage;
    
    osText = `${data.targetVm?.currentSpec?.osName || ""} ${data.targetVm?.currentSpec?.osVersion || ""}`.trim() || "—";
    envs = [data.targetVm?.environment || "—"];
  } else if (requestType === "VPN_ACCESS" || requestType === "HORIZON_ACCESS") {
    vpnRequired = requestType === "VPN_ACCESS";
    const resources = (data as any).requestResources || [];
    resources.forEach((r: any) => {
      if (r.vm) {
        vmCount++;
        targetResources.push(`VM: ${r.vm.hostname || "Unnamed"} (${r.vm.ipAddress || "No IP"})`);
      } else if (r.namespace) {
        namespaceCount++;
        targetResources.push(`Namespace: ${r.namespace.name}`);
      }
    });
    
    if (targetResources.length === 0 && data.targetVm) {
      vmCount = 1;
      targetResources.push(`VM: ${data.targetVm.hostname || "Unnamed"} (${data.targetVm.ipAddress || "No IP"})`);
    }
  } else if (requestType === "CUSTOMIZED" || requestType === "DECOMMISSION") {
    vmCount = 1;
    totalCpu = data.targetVm?.currentSpec?.vcpu || 0;
    totalRam = data.targetVm?.currentSpec?.ramGb || 0;
    totalStorage = data.targetVm?.currentSpec?.storageGb || 0;
    osText = `${data.targetVm?.currentSpec?.osName || ""} ${data.targetVm?.currentSpec?.osVersion || ""}`.trim() || "—";
    envs = [data.targetVm?.environment || "—"];
  }

  if (techStacks.length === 0 && (data.frontendTech || data.backendTech || data.dataBase)) {
    if (data.frontendTech) techStacks.push(`Frontend: ${data.frontendTech}`);
    if (data.backendTech) techStacks.push(`Backend: ${data.backendTech}`);
    if (data.dataBase) techStacks.push(`Database: ${data.dataBase}`);
  }

  return (
    <div className="bg-gradient-to-br from-indigo-50/50 via-white to-slate-50/30 rounded-xl border border-indigo-100 shadow-md overflow-hidden">
      <div className="px-6 py-4 border-b border-indigo-100 bg-indigo-50/30 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Cpu className="h-5 w-5 text-indigo-600" />
          <h3 className="font-bold text-slate-800 text-sm tracking-tight">Consolidated Infrastructure Resource Summary</h3>
        </div>
        <Badge variant="outline" className="border-indigo-200 text-indigo-750 font-bold bg-indigo-50/20 text-[10px]">
          {requestType.replace(/_/g, " ")}
        </Badge>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Allocated Entities</p>
            <div className="flex flex-col gap-1 mt-1.5">
              {vmCount > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                  <Server className="w-3.5 h-3.5 text-indigo-500" /> {vmCount} VM{vmCount > 1 ? "s" : ""}
                </span>
              )}
              {namespaceCount > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                  <Globe className="w-3.5 h-3.5 text-indigo-500" /> {namespaceCount} Namespace{namespaceCount > 1 ? "s" : ""}
                </span>
              )}
              {vmCount === 0 && namespaceCount === 0 && <span className="text-xs font-semibold text-slate-500">—</span>}
            </div>
          </div>

          {(totalCpu > 0 || totalRam > 0) ? (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Compute (Total)</p>
              <div className="mt-1.5 space-y-1 text-xs">
                <p className="font-semibold text-slate-800">{totalCpu} vCPU Cores</p>
                <p className="font-semibold text-slate-800">{totalRam} GB Memory</p>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Compute</p>
              <p className="text-xs font-semibold text-slate-500 mt-1.5">—</p>
            </div>
          )}

          {totalStorage > 0 ? (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Storage (Total)</p>
              <p className="text-xs font-bold text-slate-800 mt-1.5">{totalStorage} GB Disk</p>
              {gpuText && <p className="text-[9px] text-amber-600 font-bold mt-0.5">GPU: {gpuText}</p>}
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Storage</p>
              <p className="text-xs font-semibold text-slate-500 mt-1.5">—</p>
            </div>
          )}

          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Requirements & Network</p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {envs.map((env, i) => (
                <Badge key={i} className="bg-slate-100 text-slate-800 border-none text-[9px] font-bold">
                  {env}
                </Badge>
              ))}
              {vpnRequired && (
                <Badge className="bg-emerald-50 text-emerald-750 border border-emerald-100 text-[9px] font-bold">
                  VPN Required
                </Badge>
              )}
              {publicIpRequired && (
                <Badge className="bg-blue-50 text-blue-755 border border-blue-100 text-[9px] font-bold">
                  Public IP
                </Badge>
              )}
            </div>
          </div>
        </div>

        {(targetResources.length > 0 || techStacks.length > 0 || subdomains.length > 0 || osText) && (
          <div className="mt-5 pt-4 border-t border-indigo-100/50 grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px]">
            {targetResources.length > 0 && (
              <div className="space-y-1">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Access Targets Mapping</p>
                <div className="flex flex-wrap gap-1.5">
                  {targetResources.map((res, i) => (
                    <span key={i} className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                      {res}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {subdomains.length > 0 && (
              <div className="space-y-1">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Assigned Subdomains</p>
                <div className="flex flex-wrap gap-1.5">
                  {subdomains.map((sub, i) => (
                    <span key={i} className="text-indigo-650 font-mono font-bold hover:underline">
                      https://{sub}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {techStacks.length > 0 && (
              <div className="space-y-1">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Technology Stack</p>
                <div className="flex flex-wrap gap-1.5">
                  {techStacks.map((stack, i) => (
                    <span key={i} className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-50/50 text-indigo-700 border border-indigo-100 font-medium">
                      {stack}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {osText && (
              <div className="space-y-1">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Operating Systems</p>
                <p className="font-semibold text-slate-750">{osText}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}