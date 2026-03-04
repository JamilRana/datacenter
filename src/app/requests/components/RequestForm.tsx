// src/app/requests/components/RequestForm.tsx
"use client";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Upload,
  Plus,
  Trash2,
  Server,
  ShieldCheck,
  Network,
  Cpu,
  Users,
  Code,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { AdditionalDisk, detailsRequest, FirewallPort } from "@/types/requests";
import { Protocol } from "@/types/enums";
import { ROLES } from "@/lib/roles";
import { getDetailedRequest } from "@/app/actions/request-actions";
import { getRequesters } from "@/app/actions/user-actions";
import { User } from "@/types/users";

export function RequestForm({
  userId,
  editId,
}: {
  userId: string;
  editId?: string;
}) {
  const { data: session } = useSession();
  const hasRole = (roles: string[] | undefined, role: string): boolean => {
    return roles?.includes(role) || false;
  };

  const isDeveloper = hasRole(session?.user.roles, ROLES.DEVELOPER);

  const [requesters, setRequesters] = useState<User[]>([]);
  const [assignedRequesterId, setAssignedRequesterId] = useState<string>("");

  // Fetch ONLY requesters (users with REQUESTER role) for developers to assign to
  useEffect(() => {
    if (isDeveloper) {
      const fetchRequesters = async () => {
        try {
          const users = await getRequesters();
          setRequesters(users);
        } catch (error) {
          toast.error(`Failed to load requesters : ${error}`);
        }
      };
      fetchRequesters();
    }
  }, [isDeveloper]);

  const isEditing = !!editId;
  const requestId = editId || null;
  const searchParams = useSearchParams();
  const copyFrom = searchParams.get("copyFrom");
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State management
  const [additionalDisks, setAdditionalDisks] = useState<AdditionalDisk[]>([{ sequence: 1, sizeGb: 0, purpose: "" }]);
  const [firewallPorts, setFirewallPorts] = useState<FirewallPort[]>([{ port: 80, protocol: Protocol.TCP, purpose: "HTTP", source: "" }]);
  const [networkAccess, setNetworkAccess] = useState<string[]>(["LOCAL"]);
  const [securityReport, setSecurityReport] = useState<File | null>(null);
  const [justificationDoc, setJustificationDoc] = useState<File | null>(null);
  const [prefillData, setPrefillData] = useState<detailsRequest | null>(null);
  const [existingAttachments, setExistingAttachments] = useState<{
    securityReport?: { id: string; fileName: string; filePath: string };
    justification?: { id: string; fileName: string; filePath: string };
  }>({});

  // Hardware values
  const [vcpuValue, setVcpuValue] = useState<string>("2");
  const [ramValue, setRamValue] = useState<string>("4");
  const [storageValue, setStorageValue] = useState<string>("50");

  // Controlled values
  const [environment, setEnvironment] = useState<string>("PRODUCTION");
  const [raid, setRaid] = useState<string>("NONE");
  const [sslProvider, setSslProvider] = useState<string>("MIS");
  const [requiredPublicIP, setRequiredPublicIP] = useState<boolean>(false);
  const [vpnRequired, setVpnRequired] = useState<boolean>(false);
  const [renewalRequired, setRenewalRequired] = useState<boolean>(false);

  // Initialize from prefill data
  useEffect(() => {
    if (prefillData) {
      // CPU/RAM/Storage initialization
      if (prefillData.vcpu && ["1", "2", "4", "8"].includes(prefillData.vcpu.toString())) {
        setVcpuValue(prefillData.vcpu.toString());
      } else if (prefillData.vcpu) {
        setVcpuValue("other");
      }

      if (prefillData.ramGb && ["4", "8", "16", "32"].includes(prefillData.ramGb.toString())) {
        setRamValue(prefillData.ramGb.toString());
      } else if (prefillData.ramGb) {
        setRamValue("other");
      }

      if (prefillData.storageGb && ["50", "100", "250", "500"].includes(prefillData.storageGb.toString())) {
        setStorageValue(prefillData.storageGb.toString());
      } else if (prefillData.storageGb) {
        setStorageValue("other");
      }

      if (prefillData.environment) setEnvironment(prefillData.environment.toString());
      if (prefillData.raid) setRaid(prefillData.raid.toString());
      if (prefillData.sslProvider) setSslProvider(prefillData.sslProvider.toString());
      if (prefillData.requiredPublicIP !== undefined) setRequiredPublicIP(!!prefillData.requiredPublicIP);
      if (prefillData.vpnRequired !== undefined) setVpnRequired(!!prefillData.vpnRequired);
      if (prefillData.renewalRequired !== undefined) setRenewalRequired(!!prefillData.renewalRequired);
      
      // Set assigned requester ID if editing developer-created draft
      if (isDeveloper && prefillData.requesterId && prefillData.requesterId !== userId) {
        setAssignedRequesterId(prefillData.requesterId);
      }
    }
  }, [prefillData, isDeveloper, userId]);

  // Load prefill data
  useEffect(() => {
    const loadCopyData = async () => {
      if (!copyFrom && !isEditing) {
        setPrefillData(null);
        return;
      }

      try {
        let data: detailsRequest | null = null;
        if (copyFrom) {
          data = await getDetailedRequest(copyFrom);
        } else if (isEditing && editId) {
          data = await getDetailedRequest(editId);
        }
        setPrefillData(data || null);

        if (data) {
           setAdditionalDisks(
             data?.additionalDisks?.map(d => ({
               sequence: d.sequence,
               sizeGb: d.sizeGb,
               purpose: d.purpose || "",
             })) || [{ sequence: 1, sizeGb: 0, purpose: "" }]
           );

           setFirewallPorts(
             data?.firewallPorts?.map(p => ({
               port: p.port,
               protocol: p.protocol || Protocol.TCP,
               purpose: p.purpose || "",
               source: p.source || "",
             })) || [{ port: 80, protocol: Protocol.TCP, purpose: "HTTP", source: "" }]
           );

           setNetworkAccess(data?.networkAccess?.map(n => n.accessType) || ["LOCAL"]);

           // Load existing attachments
           const attachments = data.attachments || [];
           const securityRep = attachments.find(a => a.attachmentType === "SECURITY_REPORT");
           const justification = attachments.find(a => a.attachmentType === "JUSTIFICATION");
           setExistingAttachments({
             securityReport: securityRep ? { id: securityRep.id, fileName: securityRep.fileName, filePath: securityRep.filePath } : undefined,
             justification: justification ? { id: justification.id, fileName: justification.fileName, filePath: justification.filePath } : undefined,
           });
         }

         setSecurityReport(null);
         setJustificationDoc(null);
      } catch (err) {
        toast.error(`Failed to load request data: ${err}`);
        setPrefillData(null);
      }
    };

    loadCopyData();
  }, [copyFrom, isEditing, editId]);

  const handleSubmit = async (submitType: "draft" | "submit") => {
    // ✅ DEVELOPER VALIDATION: Can ONLY save drafts
    if (isDeveloper && submitType === "submit") {
      toast.error("Developers can only save drafts. Requesters must submit for approval.");
      return;
    }

    // ✅ DEVELOPER VALIDATION: Must assign requester before saving
    if (isDeveloper && !assignedRequesterId) {
      toast.error("Please assign a requester before saving the draft");
      return;
    }

    setIsSubmitting(true);
    const form = formRef.current;
    if (!form) {
      setIsSubmitting(false);
      return;
    }

    const formData = new FormData(form);
    
    // ✅ SET requesterId BASED ON ROLE (THIS IS THE RESPONSIBLE PERSON)
    if (isDeveloper && assignedRequesterId) {
      formData.set("requesterId", assignedRequesterId); // Developer assigns requester
      formData.set("developerId", userId); // Track who created the draft
    } else {
      formData.set("requesterId", userId); // Requester creates for self
    }

    formData.append("requestType", "NEW_VM");
    formData.append("status", submitType === "submit" ? "PENDING_L1" : "DRAFT");
    formData.append("networkAccess", JSON.stringify(networkAccess));
    formData.append(
      "additionalDisks",
      JSON.stringify(additionalDisks.filter(d => d.sizeGb > 0))
    );
    formData.append(
      "firewallPorts",
      JSON.stringify(firewallPorts.filter(p => p.port > 0))
    );

    // Hardware values
    const finalVcpu = vcpuValue === "other"
      ? formData.get("customVcpu")?.toString() || "2"
      : vcpuValue;
    const finalRam = ramValue === "other"
      ? formData.get("customRam")?.toString() || "4"
      : ramValue;
    const finalStorage = storageValue === "other"
      ? formData.get("customStorage")?.toString() || "50"
      : storageValue;

    formData.set("vcpu", finalVcpu);
    formData.set("ramGb", finalRam);
    formData.set("storageGb", finalStorage);

    // Files
    if (securityReport) formData.append("securityReport", securityReport);
    if (justificationDoc) formData.append("justificationDoc", justificationDoc);
    formData.append("vaReportSubmitted", securityReport ? "true" : "false");
    formData.append("justificationSubmitted", justificationDoc ? "true" : "false");

    // ✅ AUTO-FILL DEVELOPER INFO FOR DEVELOPERS (schema has flat fields + relation)
    if (isDeveloper && session?.user) {
      formData.set("developerName", session.user.name || "");
      formData.set("developerDesignation", session.user.designation || "");
      formData.set("developerOrganization", session.user.organization || "");
      formData.set("developerContact", session.user.contact || "");
      formData.set("developerEmail", session.user.email || "");
    }

    if (isEditing && editId) {
      formData.append("requestId", editId);
    }

    try {
      const url = isEditing ? `/api/requests/${requestId}` : "/api/requests";
      const response = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        body: formData,
      });

      const result = await response.json();
      if (response.ok) {
        toast.success(`Request ${submitType === "submit" ? "submitted for approval" : "saved as draft"}!`);
        window.location.href = "/requests";
      } else {
        toast.error(result.error || "Submission failed");
      }
    } catch (error) {
      toast.error(`Network error: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckboxChange = (
    checked: boolean,
    callback: (checked: boolean) => void
  ) => {
    if (typeof checked === "boolean") {
      callback(checked);
    }
  };

  const getDefaultValue = (value: string | number | boolean | null | undefined, defaultValue: string) => 
    value !== null && value !== undefined ? String(value) : defaultValue;

  return (
    <form
      ref={formRef}
      key={copyFrom || "new-request"}
      className="max-w-6xl mx-auto space-y-10 pb-28"
    >
      {/* Prefill Banner */}
      {copyFrom && (
        <div className="bg-blue-50 p-3 rounded-md border border-blue-200 text-blue-800 text-sm mb-4">
          📋 Prefilled from a previous request. Please review all fields.
        </div>
      )}

      {/* ✅ DEVELOPER-SPECIFIC: Requester Assignment (THIS IS THE RESPONSIBLE PERSON) */}
      {isDeveloper && (
        <Card className="shadow-md border border-amber-300">
          <CardHeader className="bg-amber-50 border-b border-amber-200">
            <CardTitle className="text-lg text-amber-800 flex items-center gap-2">
              <Users className="w-5 h-5" /> Assign Requester (Will be Responsible Person)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-2">
              <Label className="text-amber-800 font-medium">Requester *</Label>
              <Select
                value={assignedRequesterId}
                onValueChange={setAssignedRequesterId}
                required
              >
                <SelectTrigger className="border-amber-300">
                  <SelectValue placeholder="Select requester who will be responsible for this VM" />
                </SelectTrigger>
                <SelectContent>
                  {requesters.map((requester) => (
                    <SelectItem key={requester.id} value={requester.id}>
                      {requester.name} • {requester.designation || requester.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded mt-1">
                ⚠️ The assigned requester will be the responsible person and must submit this draft for approval.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Card */}
      <Card className="shadow-md border border-slate-300">
        <CardHeader className="bg-slate-50/70 border-b border-slate-300">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-lg">System & Project</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
          <div className="space-y-2">
            <Label>System/Service Name *</Label>
            <Input
              name="systemName"
              placeholder="System/Service Name *"
              defaultValue={getDefaultValue(prefillData?.systemName, "")}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Project/Program Name</Label>
            <Input
              name="projectName"
              placeholder="Project/Program Name"
              defaultValue={getDefaultValue(prefillData?.projectName, "")}
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label>System Purpose *</Label>
            <Textarea
              name="purpose"
              placeholder="Briefly describe why this VM is needed..."
              className="min-h-[100px]"
              defaultValue={getDefaultValue(prefillData?.purpose, "")}
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Target Environment</Label>
              <Select
                name="environment"
                value={environment}
                onValueChange={setEnvironment}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["DEVELOPMENT", "STAGING", "PRODUCTION", "TESTING"] as const).map((e) => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Expected End Date</Label>
              <Input
                name="expectedEndDate"
                type="date"
                defaultValue={prefillData?.expectedEndDate ? 
                  new Date(prefillData.expectedEndDate).toISOString().split('T')[0] : 
                  ""
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tech Stack Card */}
      <Card className="shadow-md border border-slate-300">
        <CardHeader className="bg-slate-50/70 border-b border-slate-300">
          <div className="flex items-center gap-2">
            <Code className="w-5 h-5 text-purple-600" />
            <CardTitle className="text-base text-slate-700">Technology Stack</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Frontend</Label>
            <Input
              name="frontendTech"
              placeholder="React, Angular, etc."
              defaultValue={getDefaultValue(prefillData?.frontendTech, "")}
            />
          </div>
          <div className="space-y-2">
            <Label>Backend</Label>
            <Input
              name="backendTech"
              placeholder="Node.js, Django, etc."
              defaultValue={getDefaultValue(prefillData?.backendTech, "")}
            />
          </div>
          <div className="space-y-2">
            <Label>Database</Label>
            <Input
              name="dataBase"
              placeholder="PostgreSQL, MongoDB, etc."
              defaultValue={getDefaultValue(prefillData?.dataBase, "")}
            />
          </div>
          <div className="space-y-2">
            <Label>Architecture</Label>
            <Input
              name="serverArchitecture"
              placeholder="Docker / Kubernetes / Monolith"
              defaultValue={getDefaultValue(prefillData?.serverArchitecture, "")}
            />
          </div>
          <div className="space-y-2">
            <Label>Additional technical notes</Label>
            <Textarea
              name="additionalTechNotes"
              placeholder="Additional technical notes..."
              defaultValue={getDefaultValue(prefillData?.additionalTechNotes, "")}
            />
          </div>
        </CardContent>
      </Card>

      {/* ✅ PEOPLE SECTION - Schema-Aligned (NO responsiblePerson fields) */}
      <Card className="shadow-md border border-slate-300">
        <CardHeader className="bg-slate-50/70 border-b border-slate-300">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-green-600" />
            <CardTitle className="text-lg">Contacts</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ✅ REQUESTER = RESPONSIBLE PERSON (auto-set, no manual input) */}
          <div>
            <Label className="font-medium mb-3 block">Developer</Label>
            <div className="space-y-3">
              <Input
                name="developerName"
                placeholder="Name"
                defaultValue={getDefaultValue(
                  prefillData?.developer?.name || (isDeveloper ? session?.user?.name : ""), 
                  ""
                )}
                disabled={isDeveloper}
              />
              <Input
                name="developerDesignation"
                placeholder="Designation"
                defaultValue={getDefaultValue(
                  prefillData?.developer?.designation || (isDeveloper ? session?.user?.designation : ""), 
                  ""
                )}
                disabled={isDeveloper}
              />
              <Input
                name="developerOrganization"
                placeholder="Organization"
                defaultValue={getDefaultValue(
                  prefillData?.developer?.organization || (isDeveloper ? session?.user?.organization : ""), 
                  ""
                )}
                disabled={isDeveloper}
              />
              <Input
                name="developerContact"
                placeholder="Contact Number"
                defaultValue={getDefaultValue(
                  prefillData?.developer?.contact || (isDeveloper ? session?.user?.contact : ""), 
                  ""
                )}
                disabled={isDeveloper}
              />
              <Input
                name="developerEmail"
                type="email"
                placeholder="Email"
                defaultValue={getDefaultValue(
                  prefillData?.developer?.email || (isDeveloper ? session?.user?.email : ""), 
                  ""
                )}
                disabled={isDeveloper}
              />
            </div>
            {isDeveloper && (
              <p className="text-xs text-slate-500 mt-2 italic">
                Developer info auto-filled from your profile
              </p>
            )}
          </div>

          {/* Alternate Person - Optional backup contact */}
          <div>
            <Label className="font-medium mb-3 block">Alternate Focal Person (Optional)</Label>
            <div className="space-y-3">
              <Input
                name="alternativePersonName"
                placeholder="Name"
                defaultValue={getDefaultValue(prefillData?.alternativePerson?.name, "")}
              />
              <Input
                name="alternativePersonDesignation"
                placeholder="Designation"
                defaultValue={getDefaultValue(prefillData?.alternativePerson?.designation, "")}
              />
              <Input
                name="alternativePersonOrganization"
                placeholder="Organization"
                defaultValue={getDefaultValue(prefillData?.alternativePerson?.organization, "")}
              />
              <Input
                name="alternativePersonContact"
                placeholder="Contact Number"
                defaultValue={getDefaultValue(prefillData?.alternativePerson?.contact, "")}
              />
              <Input
                name="alternativePersonEmail"
                type="email"
                placeholder="Email"
                defaultValue={getDefaultValue(prefillData?.alternativePerson?.email, "")}
              />
            </div>
          </div>
        </CardContent>
      </Card>
 {/* VM Resources */}
      <Card className="shadow-md border border-slate-300">
        <CardHeader className="bg-slate-50/70 border-b border-slate-300 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-600" />
            <CardTitle className="text-lg">Resource Specification</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="quantity" className="text-sm font-medium">
              VM Quantity:
            </Label>
            <Input
              name="quantity"
              type="number"
              defaultValue={getDefaultValue(prefillData?.quantity?.toString(), "1")}
              className="w-16 h-8 no-spinner"
              min="1"
              max="10"
            />
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {/* CPU */}
          <div className="space-y-3">
            <Label>vCPU Cores</Label>
            <RadioGroup
              name="vcpuValue"
              value={vcpuValue}
              onValueChange={setVcpuValue}
              className="grid grid-cols-2 gap-2"
            >
              {([1, 2, 4, 8] as const).map((n) => (
                <div
                  key={n}
                  className="flex items-center space-x-2 border border-slate-300 rounded-md p-2 hover:bg-slate-50"
                >
                  <RadioGroupItem value={n.toString()} id={`cpu-${n}`} />
                  <Label htmlFor={`cpu-${n}`}>
                    {n} core{n > 1 ? "s" : ""}
                  </Label>
                </div>
              ))}
              <div className="flex items-center space-x-2 border border-slate-300 rounded-md p-2 hover:bg-slate-50">
                <RadioGroupItem value="other" id="cpu-other" />
                <Label htmlFor="cpu-other">Other (Cores)</Label>
              </div>
            </RadioGroup>

            {vcpuValue === "other" && (
              <Input
                name="customVcpu"
                placeholder="Specify cores"
                type="number"
                defaultValue={getDefaultValue(prefillData?.vcpu?.toString(), "")}
                className="mt-2 no-spinner"
              />
            )}
          </div>

          {/* RAM */}
          <div className="space-y-3">
            <Label>Memory (RAM GB)</Label>
            <RadioGroup
              name="ramValue"
              value={ramValue}
              onValueChange={setRamValue}
              className="grid grid-cols-2 gap-2"
            >
              {([4, 8, 16, 32] as const).map((n) => (
                <div
                  key={n}
                  className="flex items-center space-x-2 border border-slate-300 rounded-md p-2 hover:bg-slate-50"
                >
                  <RadioGroupItem value={n.toString()} id={`ram-${n}`} />
                  <Label htmlFor={`ram-${n}`}>{n} GB</Label>
                </div>
              ))}
              <div className="flex items-center space-x-2 border border-slate-300 rounded-md p-2 hover:bg-slate-50">
                <RadioGroupItem value="other" id="ram-other" />
                <Label htmlFor="ram-other">Other (GB)</Label>
              </div>
            </RadioGroup>
            {ramValue === "other" && (
              <Input
                name="customRam"
                placeholder="Specify GB"
                type="number"
                className="mt-2 no-spinner"
                defaultValue={getDefaultValue(prefillData?.ramGb?.toString(), "")}
              />
            )}
          </div>

          {/* Storage */}
          <div className="space-y-3">
            <Label>Primary OS Disk</Label>
            <RadioGroup
              name="storageValue"
              value={storageValue}
              onValueChange={setStorageValue}
              className="grid grid-cols-2 gap-2"
            >
              {([50, 100, 250, 500] as const).map((n) => (
                <div
                  key={n}
                  className="flex items-center space-x-2 border border-slate-300 rounded-md p-2 hover:bg-slate-50"
                >
                  <RadioGroupItem value={n.toString()} id={`st-${n}`} />
                  <Label htmlFor={`st-${n}`}>{n} GB</Label>
                </div>
              ))}
              <div className="flex items-center space-x-2 border border-slate-300 rounded-md p-2 hover:bg-slate-50">
                <RadioGroupItem value="other" id="st-other" />
                <Label htmlFor="st-other">Other (GB)</Label>
              </div>
            </RadioGroup>
            {storageValue === "other" && (
              <Input
                name="customStorage"
                placeholder="Specify OS GB"
                type="number"
                className="mt-2 no-spinner"
                defaultValue={getDefaultValue(prefillData?.storageGb?.toString(), "")}
              />
            )}
          </div>

          {/* OS & License */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 pt-6">
            <div className="space-y-2">
              <Label>Operating System Name *</Label>
              <Input
                name="osName"
                placeholder="e.g., Ubuntu, CentOS"
                defaultValue={getDefaultValue(prefillData?.osName, "Ubuntu")}
              />
            </div>
            <div className="space-y-2">
              <Label>Operating System Version *</Label>
              <Input
                name="osVersion"
                placeholder="e.g., 22.04 LTS"
                defaultValue={getDefaultValue(prefillData?.osVersion, "")}
              />
            </div>
          </div>

          {/* RAID & Subdomain */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 pt-6">
            <div className="space-y-2">
              <Label>RAID Configuration</Label>
              <Select name="raid" value={raid} onValueChange={setRaid}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["RAID0", "RAID1", "RAID5", "RAID10", "NONE"] as const).map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sub Domain *</Label>
              <Input
                name="subdomain"
                placeholder="e.g., app.example.com"
                defaultValue={getDefaultValue(prefillData?.subdomain, "")}
              />
            </div>
          </div>

          {/* Additional Disks */}
          <div className="mt-8 border-t border-slate-300 pt-6">
            <Label className="text-slate-700 font-semibold block mb-2">
              Additional Storage Disks
            </Label>
            {additionalDisks.map((disk, i) => (
              <div key={i} className="flex gap-4 mb-3">
                <Input
                  placeholder="Size (GB)"
                  type="number"
                  className="w-32 no-spinner"
                  value={disk.sizeGb}
                  onChange={(e) => {
                    const d = [...additionalDisks];
                    d[i].sizeGb = parseInt(e.target.value);
                    setAdditionalDisks(d);
                  }}
                />
                <Input
                  placeholder="Purpose (e.g. Database Data)"
                  className="flex-1"
                  value={disk.purpose}
                  onChange={(e) => {
                    const d = [...additionalDisks];
                    d[i].purpose = e.target.value;
                    setAdditionalDisks(d);
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setAdditionalDisks(
                      additionalDisks.filter((_, idx) => idx !== i)
                    )
                  }
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setAdditionalDisks([
                  ...additionalDisks,
                  { sequence: additionalDisks.length + 1, sizeGb: 0, purpose: "" },
                ])
              }
            >
              <Plus className="w-4 h-4 mr-2" /> Add Disk
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Network & Compliance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Network */}
        <Card className="shadow-md border border-slate-300">
          <CardHeader className="bg-slate-50/70 border-b border-slate-300">
            <div className="flex items-center gap-2">
              <Network className="w-5 h-5 text-green-600" />
              <CardTitle className="text-lg">Network & Security</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-2">
              <Label>Network Access Types</Label>
              <div className="flex flex-wrap gap-3">
                {(["LOCAL", "INTERNET", "REMOTE"] as const).map((t) => (
                  <div
                    key={t}
                    className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-300"
                  >
                    <Checkbox
                      checked={networkAccess.includes(t)}
                      onCheckedChange={(checked) => {
                        if (typeof checked === "boolean") {
                          handleCheckboxChange(checked, (c) => {
                            if (c) {
                              setNetworkAccess([...networkAccess, t]);
                            } else {
                              setNetworkAccess(
                                networkAccess.filter((x) => x !== t)
                              );
                            }
                          });
                        }
                      }}
                    />
                    <span className="text-xs font-bold">{t}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-300 pt-4">
              <div className="space-y-0.5">
                <Label>Public IP Address</Label>
                <p className="text-xs text-slate-500">Talk before submitting</p>
              </div>
              <Switch
                name="requiredPublicIP"
                checked={requiredPublicIP}
                onCheckedChange={setRequiredPublicIP}
              />
              <div className="space-y-0.5">
                <Label>Required VPN</Label>
                <p className="text-xs text-slate-500">Talk before submitting</p>
              </div>
              <Switch
                name="vpnRequired"
                checked={vpnRequired}
                onCheckedChange={setVpnRequired}
              />
            </div>

            {/* SSL */}
            <div className="pt-4">
              <div className="mt-2">
                <Select
                  name="sslProvider"
                  value={sslProvider}
                  onValueChange={setSslProvider}
                >
                  <Label>SSL Provider</Label>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REQUESTER">Requester</SelectItem>
                    <SelectItem value="MIS">MIS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Firewall Ports */}
            <div className="pt-4">
              <Label>Firewall Port Requirements</Label>
              {firewallPorts.map((port, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end mt-2">
                  <div className="col-span-3">
                    <Input
                      placeholder="Port"
                      value={port.port}
                      onChange={(e) => {
                        const newPorts = [...firewallPorts];
                        newPorts[i].port = parseInt(e.target.value);
                        setFirewallPorts(newPorts);
                      }}
                      type="number"
                      className="no-spinner"
                      min="1"
                      max="65535"
                    />
                  </div>
                  <div className="col-span-3">
                    <Select
                      value={port.protocol}
                      onValueChange={(v) => {
                        const newPorts = [...firewallPorts];
                        newPorts[i].protocol = v as Protocol;
                        setFirewallPorts(newPorts);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TCP">TCP</SelectItem>
                        <SelectItem value="UDP">UDP</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-4">
                    <Input
                      placeholder="Purpose"
                      value={port.purpose}
                      onChange={(e) => {
                        const newPorts = [...firewallPorts];
                        newPorts[i].purpose = e.target.value;
                        setFirewallPorts(newPorts);
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setFirewallPorts(
                        firewallPorts.filter((_, idx) => idx !== i)
                      )
                    }
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() =>
                  setFirewallPorts([
                    ...firewallPorts,
                    { port: 80, protocol: Protocol.TCP, purpose: "HTTP" },
                  ])
                }
              >
                <Plus className="w-4 h-4 mr-2" /> Add Port
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Compliance */}
        <Card className="shadow-md border border-slate-300">
          <CardHeader className="bg-slate-50/70 border-b border-slate-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-red-600" />
              <CardTitle className="text-lg">
                Compliance & Attachments
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Security Assessment (Software Testing Report) *</Label>
                {existingAttachments.securityReport && (
                  <div className="flex items-center justify-between p-2 bg-emerald-50 rounded-lg border border-emerald-200 mb-2">
                    <div className="flex items-center gap-2">
                      <Upload className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm text-emerald-700">{existingAttachments.securityReport.fileName}</span>
                      <span className="text-xs text-emerald-500">(uploaded)</span>
                    </div>
                    <a 
                      href={existingAttachments.securityReport.filePath} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-emerald-600 hover:text-emerald-800 underline"
                    >
                      View
                    </a>
                  </div>
                )}
                <div className="flex items-center gap-3 border-2 border-dashed border-slate-300 rounded-lg p-4 bg-slate-50">
                  <Upload className="w-5 h-5 text-slate-400" />
                  <input
                    type="file"
                    className="text-sm"
                    onChange={(e) =>
                      setSecurityReport(e.target.files?.[0] || null)
                    }
                  />
                  {existingAttachments.securityReport && <span className="text-xs text-slate-400">(Replace existing)</span>}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Resource Justification Document</Label>
                {existingAttachments.justification && (
                  <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg border border-blue-200 mb-2">
                    <div className="flex items-center gap-2">
                      <Upload className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-blue-700">{existingAttachments.justification.fileName}</span>
                      <span className="text-xs text-blue-500">(uploaded)</span>
                    </div>
                    <a 
                      href={existingAttachments.justification.filePath} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      View
                    </a>
                  </div>
                )}
                <div className="flex items-center gap-3 border border-slate-300 rounded-lg p-2">
                  <Upload className="w-5 h-5 text-slate-400" />
                  <input
                    type="file"
                    className="text-sm flex-1"
                    onChange={(e) =>
                      setJustificationDoc(e.target.files?.[0] || null)
                    }
                  />
                  {existingAttachments.justification && <span className="text-xs text-slate-400">(Replace)</span>}
                </div>
              </div>
            </div>

            <div className="pt-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="renewal"
                  name="renewalRequired"
                  checked={renewalRequired}
                  onCheckedChange={setRenewalRequired}
                />
                <Label htmlFor="renewal">Renewal Required</Label>
              </div>
              {renewalRequired && (
                <Input
                  name="renewalPeriodMonths"
                  placeholder="Renewal Period (Months)"
                  type="number"
                  className="mt-2 no-spinner"
                  defaultValue={getDefaultValue(prefillData?.renewalPeriodMonths?.toString(), "")}
                />
              )}
            </div>

            {/* Hidden flags */}
            <input
              type="hidden"
              name="vaReportSubmitted"
              value={securityReport ? "true" : "false"}
            />
            <input
              type="hidden"
              name="justificationSubmitted"
              value={justificationDoc ? "true" : "false"}
            />
          </CardContent>
        </Card>
      </div>


      {/* ✅ ACTION BUTTONS - Role-based visibility */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-300 p-4 shadow-lg z-50 flex justify-center gap-4">
        <Button
          variant="outline"
          size="lg"
          disabled={isSubmitting}
          type="button"
          onClick={() => handleSubmit("draft")}
        >
          Save as Draft
        </Button>
        
        {/* ✅ ONLY SHOW SUBMIT BUTTON TO REQUESTERS */}
        {!isDeveloper && (
          <Button
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 px-10"
            disabled={isSubmitting}
            type="button"
            onClick={() => handleSubmit("submit")}
          >
            {isSubmitting ? "Processing..." : "Submit for Approval"}
          </Button>
        )}
        
        {/* ✅ DEVELOPER-SPECIFIC MESSAGE */}
        {isDeveloper && (
          <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 bg-amber-50 text-amber-800 px-4 py-2 rounded-md text-sm border border-amber-200">
            Draft saved! The assigned requester will review and submit for L1-L2-L3 approval.
          </div>
        )}
      </div>
    </form>
  );
}