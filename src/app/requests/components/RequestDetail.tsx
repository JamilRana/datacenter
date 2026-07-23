// src/app/requests/components/RequestDetail.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import Link from "next/link";
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
  Cpu
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
}: {
  requestId: string;
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
              <DetailItem 
                label="Expected Delivery Date" 
                value={data.expectedDeliveryDate ? format(new Date(data.expectedDeliveryDate), "PPP") : "None"} 
              />
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
                          {attachment.attachmentType.replace(/_/g, " ")} • {attachment.user?.name || "Unknown"}
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
          <Card title="Approval Progress & Timeline" icon={Clock}>
            <div className="p-4 bg-slate-50/30 rounded-xl">
              <Timeline
                requestType={data.requestType || ""}
                currentStatus={data.status || ""}
                approvals={data.approvals as any || []}
              />
            </div>
          </Card>
        </div>
      )}
      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t p-4 shadow-2xl flex justify-between items-center z-50">
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