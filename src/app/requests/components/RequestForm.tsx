// src/app/requests/components/RequestForm.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import {
  getCopyRequestData,
} from "@/app/actions/request-actions";
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
import { RequestData, AdditionalDisk, FirewallPort, Person } from "@/types/request-form";
import { Protocol } from "@prisma/client";


export function RequestForm({
  userId,
  editId,
}: {
  userId: string;
  editId?: string;
}) {
  const { data: session } = useSession();
  const isEditing = !!editId;
  const requestId = editId || null;
  const searchParams = useSearchParams();
  const copyFrom = searchParams.get("copyFrom");
  const formRef = useRef<HTMLFormElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  // For dynamic lists
  const [additionalDisks, setAdditionalDisks] = useState<AdditionalDisk[]>([
    { sizeGb: "", purpose: "" }
  ]);
  const [firewallPorts, setFirewallPorts] = useState<FirewallPort[]>([
    { port: "", protocol: "TCP", purpose: "" }
  ]);
  const [networkAccess, setNetworkAccess] = useState<("LOCAL" | "INTERNET" | "REMOTE")[]>(["LOCAL"]);

  // Files
  const [securityReport, setSecurityReport] = useState<File | null>(null);
  const [justificationDoc, setJustificationDoc] = useState<File | null>(null);

  // Prefill data
  const [prefillData, setPrefillData] = useState<RequestData | null>(null);

  // Hardware values
  const [vcpuValue, setVcpuValue] = useState<string>("2");
  const [ramValue, setRamValue] = useState<string>("4");
  const [storageValue, setStorageValue] = useState<string>("50");

  // Controlled values for Selects and Switches
  const [environment, setEnvironment] = useState<string>("PRODUCTION");
  const [raid, setRaid] = useState<string>("NONE");
  const [sslProvider, setSslProvider] = useState<string>("MIS");
  const [requiredPublicIP, setRequiredPublicIP] = useState<boolean>(false);
  const [vpnRequired, setVpnRequired] = useState<boolean>(false);
  const [renewalRequired, setRenewalRequired] = useState<boolean>(false);
  // const [osLicenseBy, setOsLicenseBy] = useState<string>("MIS");

  // Initialize hardware values from prefill data
  useEffect(() => {
    if (prefillData) {
      // CPU
      if (prefillData.vcpu && ["1", "2", "4", "8"].includes(prefillData.vcpu)) {
        setVcpuValue(prefillData.vcpu);
      } else if (prefillData.vcpu) {
        setVcpuValue("other");
      }

      // RAM
      if (prefillData.ramGb && ["4", "8", "16", "32"].includes(prefillData.ramGb)) {
        setRamValue(prefillData.ramGb);
      } else if (prefillData.ramGb) {
        setRamValue("other");
      }

      // Storage
      if (prefillData.storageGb && ["50", "100", "250", "500"].includes(prefillData.storageGb)) {
        setStorageValue(prefillData.storageGb);
      } else if (prefillData.storageGb) {
        setStorageValue("other");
      }

      // Controlled state updates
      if (prefillData.environment) setEnvironment(prefillData.environment);
      if (prefillData.raid) setRaid(prefillData.raid);
      if (prefillData.sslProvider) setSslProvider(prefillData.sslProvider);
      if (prefillData.requiredPublicIP !== undefined) setRequiredPublicIP(!!prefillData.requiredPublicIP);
      if (prefillData.vpnRequired !== undefined) setVpnRequired(!!prefillData.vpnRequired);
      if (prefillData.renewalRequired !== undefined) setRenewalRequired(!!prefillData.renewalRequired);
    }
  }, [prefillData]);

  // Load prefill data
  useEffect(() => {
    const loadCopyData = async () => {
      if (!copyFrom && !isEditing) {
        setPrefillData(null);
        return;
      }

      try {
        let data: RequestData | null = null;
        if (copyFrom) {
          data = await getCopyRequestData(copyFrom);
        } else if (isEditing && editId) {
          data = await getCopyRequestData(editId);
        }
        setPrefillData(data || null);
        
        // Reset dynamic lists
        if (data) {
          setAdditionalDisks(
            data.additionalDisks.map(d => ({
              sizeGb: String(d.sizeGb),
              purpose: d.purpose || "",
            })) || [{ sizeGb: "", purpose: "" }]
          );
          
          setFirewallPorts(
            data.firewallPorts.map(p => ({
              port: String(p.port),
              protocol: p.protocol || "TCP",
              purpose: p.purpose || "",
              source: p.source || "",
            })) || [{ port: "", protocol: "TCP", purpose: "" }]
          );
          
          setNetworkAccess(data.networkAccess || ["LOCAL"]);
        }
        
        setSecurityReport(null);
        setJustificationDoc(null);
      } catch (err) {
        toast.error(`Failed to load copied request: ${err}`);
        setPrefillData(null);
      }
    };

    loadCopyData();
  }, [copyFrom, isEditing, editId]);

  const handleSubmit = async (submitType: "draft" | "submit") => {
    setIsSubmitting(true);
    const form = document.querySelector("form") as HTMLFormElement;
    if (!form) {
      setIsSubmitting(false);
      return;
    }

    const formData = new FormData(form);
    formData.append("userId", userId);
    formData.append("requestType", "NEW_VM");
    formData.append("status", submitType === "submit" ? "PENDING_L1" : "DRAFT");
    formData.append("networkAccess", JSON.stringify(networkAccess));
    formData.append(
      "additionalDisks",
      JSON.stringify(additionalDisks.filter((d) => d.sizeGb))
    );
    formData.append(
      "firewallPorts",
      JSON.stringify(firewallPorts.filter((p) => p.port))
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
    formData.append(
      "justificationSubmitted",
      justificationDoc ? "true" : "false"
    );

    // People fields
    const personFields: (keyof Person)[] = ["name", "designation", "organization", "contact", "email"];
    const prefixes = ["responsiblePerson", "alternativePerson", "developer"] as const;
    
    prefixes.forEach(prefix => {
      personFields.forEach(field => {
        const fieldName = `${prefix}${field.charAt(0).toUpperCase() + field.slice(1)}`;
        if (!formData.has(fieldName) || formData.get(fieldName) === "") {
          formData.set(fieldName, "");
        }
      });
    });

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
        toast.success(`Request ${submitType === "submit" ? "submitted" : "saved"}!`);
        window.location.href = "/requests";
      } else {
        toast.error(result.error || "Submission failed");
      }
    } catch (error) {
      toast.error(`Network error ${error}`);
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

const fillRequester = (
  checked: boolean,
  type: "responsible" | "alternative"
) => {
  if (!checked || !session?.user || !formRef.current) return;

  const form = formRef.current;
  const prefix = type === "responsible" ? "responsiblePerson" : "alternativePerson";
  
  // Exact mapping to input 'name' attributes
  const fields = [
    { sessionKey: "name" as const, inputName: `${prefix}Name` },
    { sessionKey: "designation" as const, inputName: `${prefix}Designation` },
    { sessionKey: "organization" as const, inputName: `${prefix}Organization` },
    { sessionKey: "contact" as const, inputName: `${prefix}Contact` },
    { sessionKey: "email" as const, inputName: `${prefix}Email` },
  ] as const;

  fields.forEach(({ sessionKey, inputName }) => {
    const input = form.querySelector(`[name="${inputName}"]`) as HTMLInputElement;
    if (input) {
      // Type-safe property access
      input.value = session.user[sessionKey] || "";
    }
  });
};
  // Helper function to get default value
  const getDefaultValue = (value: string | undefined | null, defaultValue: string) => 
    value ?? defaultValue;

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

      {/* System Card */}
      <Card className="lg:col-span-2 shadow-md border border-slate-300">
        <CardHeader className="bg-slate-50/70 border-b border-slate-300">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-lg">System & Project</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
          <Label>System/Service Name *</Label>
          <Input
            name="systemName"
            placeholder="System/Service Name *"
            defaultValue={getDefaultValue(prefillData?.systemName, "")}
            required
          />
          <Label>Project/Program Name</Label>
          <Input
            name="projectName"
            placeholder="Project/Program Name"
            defaultValue={getDefaultValue(prefillData?.projectName, "")}
          />
          <div className="md:col-span-2">
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
            <div>
          <Select
            name="environment"
            value={environment}
            onValueChange={setEnvironment}
          >
            <Label>Target Environment</Label>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["DEVELOPMENT", "STAGING", "PRODUCTION", "TESTING"] as const).map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          </div>
          <div>
            <Label>Expected End Date</Label>
            <Input
              name="expectedEndDate"
              type="date"
              defaultValue={getDefaultValue(prefillData?.expectedEndDate, "")}
            />
          </div>
          </div>
        </CardContent>
      </Card>

      {/* Rest of your form components remain the same, but with proper typing */}
      
      {/* Tech Stack Card */}
      <Card className="shadow-md border border-slate-300">
        <CardHeader className="bg-slate-50/70 border-b border-slate-300">
          <div className="flex items-center gap-2">
            <Code className="w-5 h-5 text-purple-600" />
            <CardTitle className="text-base text-slate-700">
              Technology Stack
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <Label htmlFor="frontendTech">Frontend</Label>
          <Input
            name="frontendTech"
            placeholder="React, Angular, etc."
            defaultValue={getDefaultValue(prefillData?.frontendTech, "")}
          />
          <div className="space-2">
            <Label htmlFor="backendTech" className="mt-2">
              Backend
            </Label>
            <Input
              name="backendTech"
              placeholder="Node.js, Django, etc."
              defaultValue={getDefaultValue(prefillData?.backendTech, "")}
            />
          </div>
          <div className="space-2">
            <Label htmlFor="dataBase" className="mt-2">
              Database
            </Label>
            <Input
              name="dataBase"
              placeholder="PostgreSQL, MongoDB, etc."
              defaultValue={getDefaultValue(prefillData?.dataBase, "")}
            />
          </div>
          <div className="space-2">
            <Label htmlFor="serverArchitecture">Architecture</Label>
            <Input
              name="serverArchitecture"
              placeholder="Docker / Kubernetes / Monolith"
              defaultValue={getDefaultValue(prefillData?.serverArchitecture, "")}
            />
          </div>
          <div className="space-2">
            <Label htmlFor="additionalTechNotes">
              Additional technical notes
            </Label>
            <Textarea
              name="additionalTechNotes"
              placeholder="Additional technical notes..."
              defaultValue={getDefaultValue(prefillData?.additionalTechNotes, "")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Responsible Persons */}
      <Card className="shadow-md border border-slate-300">
        <CardHeader className="bg-slate-50/70 border-b border-slate-300">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-green-600" />
            <CardTitle className="text-lg">Responsible Persons</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Primary Responsible */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="font-medium">
                Primary Responsible Person *
              </Label>
              <div className="flex items-center gap-1.5">
                <Checkbox
                  id="fill-responsible"
                  onCheckedChange={(checked) =>
                    fillRequester(!!checked, "responsible")
                  }
                />
                <Label htmlFor="fill-responsible" className="text-xs">
                  Same as Requester
                </Label>
              </div>
            </div>
            <div className="space-y-3">
              <Input
                name="responsiblePersonName"
                placeholder="Name"
                defaultValue={getDefaultValue(prefillData?.responsiblePerson.name, "")}
                required
              />
              <Input
                name="responsiblePersonDesignation"
                placeholder="Designation"
                defaultValue={getDefaultValue(prefillData?.responsiblePerson.designation, "")}
                required
              />
              <Input
                name="responsiblePersonOrganization"
                placeholder="Organization"
                defaultValue={getDefaultValue(prefillData?.responsiblePerson.organization, "")}
                required
              />
              <Input
                name="responsiblePersonContact"
                placeholder="Contact Number"
                defaultValue={getDefaultValue(prefillData?.responsiblePerson.contact, "")}
                required
              />
              <Input
                name="responsiblePersonEmail"
                type="email"
                placeholder="Email"
                defaultValue={getDefaultValue(prefillData?.responsiblePerson.email, "")}
                required
              />
            </div>
          </div>

          {/* Alternate Responsible */}
          <div>
            <Label className="font-medium mb-3 block">
              Alternate Responsible Person
            </Label>
            <div className="space-y-3">
              <Input
                name="alternativePersonName"
                placeholder="Name"
                defaultValue={getDefaultValue(prefillData?.alternativePerson.name, "")}
              />
              <Input
                name="alternativePersonDesignation"
                placeholder="Designation"
                defaultValue={getDefaultValue(prefillData?.alternativePerson.designation, "")}
              />
              <Input
                name="alternativePersonOrganization"
                placeholder="Organization"
                defaultValue={getDefaultValue(prefillData?.alternativePerson.organization, "")}
              />
              <Input
                name="alternativePersonContact"
                placeholder="Contact Number"
                defaultValue={getDefaultValue(prefillData?.alternativePerson.contact, "")}
              />
              <Input
                name="alternativePersonEmail"
                type="email"
                placeholder="Email"
                defaultValue={getDefaultValue(prefillData?.alternativePerson.email, "")}
              />
            </div>
          </div>

          {/* Developer Info */}
          <div className="lg:col-span-2 mt-6 pt-4 border-t border-slate-200">
            <Label className="font-medium">
              Development Partner / Developer
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              <Input
                name="developerName"
                placeholder="Name"
                defaultValue={getDefaultValue(prefillData?.developer.name, "")}
              />
              <Input
                name="developerAddress"
                placeholder="Address"
                defaultValue={getDefaultValue(prefillData?.developer.address, "")}
              />
              <Input
                name="developerContact"
                placeholder="Contact Number"
                defaultValue={getDefaultValue(prefillData?.developer.contact, "")}
              />
              <Input
                name="developerEmail"
                type="email"
                placeholder="Email"
                defaultValue={getDefaultValue(prefillData?.developer.email, "")}
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
              defaultValue={getDefaultValue(prefillData?.quantity, "1")}
              className="w-16 h-8"
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
                defaultValue={getDefaultValue(prefillData?.vcpu, "")}
                className="mt-2"
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
                className="mt-2"
                defaultValue={getDefaultValue(prefillData?.ramGb, "")}
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
                className="mt-2"
                defaultValue={getDefaultValue(prefillData?.storageGb, "")}
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
                  className="w-32"
                  value={disk.sizeGb}
                  onChange={(e) => {
                    const d = [...additionalDisks];
                    d[i].sizeGb = e.target.value;
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
                  { sizeGb: "", purpose: "" },
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
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
                <div>
                  <Label>SSL Cost Paid By</Label>
                  <Input
                    name="sslCostPaidBy"
                    placeholder="Paid by Project/DGHS/etc."
                    defaultValue={getDefaultValue(prefillData?.sslCostPaidBy, "")}
                  />
                </div>
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
                        newPorts[i].port = e.target.value;
                        setFirewallPorts(newPorts);
                      }}
                      type="number"
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
                    { port: "", protocol: "TCP", purpose: "" },
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
                <div className="flex items-center gap-3 border-2 border-dashed border-slate-300 rounded-lg p-4 bg-slate-50">
                  <Upload className="w-5 h-5 text-slate-400" />
                  <input
                    type="file"
                    className="text-sm"
                    onChange={(e) =>
                      setSecurityReport(e.target.files?.[0] || null)
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Resource Justification Document</Label>
                <div className="flex items-center gap-3 border border-slate-300 rounded-lg p-2">
                  <Upload className="w-5 h-5 text-slate-400" />
                  <input
                    type="file"
                    className="text-sm flex-1"
                    onChange={(e) =>
                      setJustificationDoc(e.target.files?.[0] || null)
                    }
                  />
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
                  className="mt-2"
                  defaultValue={getDefaultValue(prefillData?.renewalPeriodMonths, "")}
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

      {/* Action Buttons */}
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
        <Button
          size="lg"
          className="bg-blue-600 hover:bg-blue-700 px-10"
          disabled={isSubmitting}
          type="button"
          onClick={() => handleSubmit("submit")}
        >
          {isSubmitting ? "Processing..." : "Submit to DGHS MIS"}
        </Button>
      </div>
    </form>
  );
}