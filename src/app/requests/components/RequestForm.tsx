"use client";

import { useState, useEffect, useRef } from "react";
import {
  createRequest,
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
import { set } from "zod";

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
  const [submitType, setSubmitType] = useState<"draft" | "submit">("draft");

  // For dynamic lists (we'll reset these on copy)
  const [additionalDisks, setAdditionalDisks] = useState<
    { sizeGb: string; purpose: string }[]
  >([{ sizeGb: "", purpose: "" }]);
  const [firewallPorts, setFirewallPorts] = useState<
    { port: string; protocol: string; purpose: string }[]
  >([{ port: "", protocol: "TCP", purpose: "" }]);
  const [networkAccess, setNetworkAccess] = useState<string[]>(["LOCAL"]);

  // Files
  const [securityReport, setSecurityReport] = useState<File | null>(null);
  const [justificationDoc, setJustificationDoc] = useState<File | null>(null);

  // Prefill data (for uncontrolled inputs)
  const [prefillData, setPrefillData] = useState<any>(null);

  const [vcpuValue, setVcpuValue] = useState<string>("2");
  const [ramValue, setRamValue] = useState<string>("4");
  const [storageValue, setStorageValue] = useState<string>("50");

  useEffect(() => {
    if (prefillData) {
      if (["1", "2", "4", "8"].includes(String(prefillData.vcpu))) {
        setVcpuValue(String(prefillData.vcpu));
      } else if (prefillData.vcpu) {
        setVcpuValue("other");
      }

      if (["4", "8", "16", "32"].includes(String(prefillData.ramGb))) {
        setRamValue(String(prefillData.ramGb));
      } else if (prefillData.ramGb) {
        setRamValue("other");
      }

      if (["50", "100", "250", "500"].includes(String(prefillData.storageGb))) {
        setStorageValue(String(prefillData.storageGb));
      } else if (prefillData.storageGb) {
        setStorageValue("other");
      }
    }
  }, [prefillData]);

  useEffect(() => {
    const loadCopyData = async () => {
      if (!copyFrom && !isEditing) {
        setPrefillData(null);
        return;
      }

      try {
        let data: any = null;
        if (copyFrom) {
          data = await getCopyRequestData(copyFrom);
        } else if (isEditing && editId) {
          data = await getCopyRequestData(editId);
        }
        setPrefillData(data);
        // Reset dynamic lists
        setAdditionalDisks(
          data.additionalDisks?.map((d: any) => ({
            sizeGb: String(d.sizeGb),
            purpose: d.purpose || "",
          })) || [{ sizeGb: "", purpose: "" }]
        );
        setFirewallPorts(
          data.firewallPorts?.map((p: any) => ({
            port: String(p.port),
            protocol: p.protocol || "TCP",
            purpose: p.purpose || "",
          })) || [{ port: "", protocol: "TCP", purpose: "" }]
        );
        setNetworkAccess(data.networkAccess || ["LOCAL"]);
        setSecurityReport(null); // Don't auto-fill files
        setJustificationDoc(null);
      } catch (err) {
        toast.error("Failed to load copied request.");
        setPrefillData(null);
      }
    };

    loadCopyData();
  }, [copyFrom, isEditing, editId]);
  console.log(prefillData);

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

    // Hardware: use custom values if "other" is selected
    const vcpuValue = formData.get("vcpuValue")?.toString() || "2";
    const finalVcpu =
      vcpuValue === "other"
        ? formData.get("customVcpu")?.toString() || "2"
        : vcpuValue;

    const ramValueRaw = formData.get("ramValue")?.toString() || "4";
    const finalRam =
      ramValueRaw === "other"
        ? formData.get("customRam")?.toString() || "4"
        : ramValueRaw;

    const storageValueRaw = formData.get("storageValue")?.toString() || "50";
    const finalStorage =
      storageValueRaw === "other"
        ? formData.get("customStorage")?.toString() || "50"
        : storageValueRaw;

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

    // People: fallback to empty if missing
    const fields = [
      "responsiblePersonName",
      "responsiblePersonDesignation",
      "responsiblePersonOrganization",
      "responsiblePersonContact",
      "responsiblePersonEmail",
      "alternativePersonName",
      "alternativePersonDesignation",
      "alternativePersonOrganization",
      "alternativePersonContact",
      "alternativePersonEmail",
      "developerName",
      "developerAddress",
      "developerContact",
      "developerEmail",
    ];
    for (const field of fields) {
      if (!formData.has(field) || formData.get(field) === "") {
        formData.set(field, "");
      }
    }
    if (isEditing) {
      formData.append("isEditing", "true");
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
        toast.success(
          `Request ${submitType === "submit" ? "submitted" : "saved"}!`
        );
        window.location.href = "/requests";
      } else {
        toast.error(result.error || "Submission failed");
      }
    } catch (error) {
      toast.error("Network error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Safe checkbox handler (avoids 'indeterminate' type error)
  const handleCheckboxChange = (
    checked: boolean,
    callback: (checked: boolean) => void
  ) => {
    if (typeof checked === "boolean") {
      callback(checked);
    }
  };

  // Auto-fill requester

  const fillRequester = (
    checked: boolean,
    type: "responsible" | "alternative"
  ) => {
    if (!checked || !session?.user || !formRef.current) return;

    const form = formRef.current;
    const prefix =
      type === "responsible" ? "responsiblePerson" : "alternativePerson";
    
    // Map of session user fields to form input names
    const fieldMap: Record<string, string> = {
      name: "Name",
      designation: "Designation",
      organization: "Organization",
      contact: "Contact",
      email: "Email"
    };

    Object.entries(fieldMap).forEach(([sessionKey, formSuffix]) => {
      const input = form.querySelector(
        `[name="${prefix}${formSuffix}"]`
      ) as HTMLInputElement;
      if (input) {
        input.value = (session.user as any)[sessionKey] || "";
      }
    });
  };

  return (
    // 👇 Key ensures form resets when copyFrom changes
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
      {/* ... (Your existing header and structure remains exactly the same) ... */}
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
            defaultValue={prefillData?.systemName || ""}
            required
          />
          <Label>Project/Program Name</Label>
          <Input
            name="projectName"
            placeholder="Project/Program Name"
            defaultValue={prefillData?.projectName || ""}
          />
          <div className="md:col-span-2">
            <Label>System Purpose *</Label>
            <Textarea
              name="purpose"
              placeholder="Briefly describe why this VM is needed..."
              className="min-h-[100px]"
              defaultValue={prefillData?.purpose || ""}
              required
            />
          </div>
          <Select
            name="environment"
            defaultValue={prefillData?.environment || "PRODUCTION"}
          >
            <Label>Target Environment</Label>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                ["DEVELOPMENT", "STAGING", "PRODUCTION", "TESTING"] as const
              ).map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div>
            <Label>Expected End Date</Label>
            <Input
              name="expectedEndDate"
              type="date"
              defaultValue={prefillData?.expectedEndDate || ""}
            />
          </div>
        </CardContent>
      </Card>
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
            defaultValue={prefillData?.frontendTech || ""}
          />
          <div className="space-2">
            <Label htmlFor="backendTech" className="mt-2">
              Backend
            </Label>
            <Input
              name="backendTech"
              placeholder="Node.js, Django, etc."
              defaultValue={prefillData?.backendTech || ""}
            />
          </div>
          <div className="space-2">
            <Label htmlFor="dataBase" className="mt-2">
              Database
            </Label>
            <Input
              name="dataBase"
              placeholder="PostgreSQL, MongoDB, etc."
              defaultValue={prefillData?.dataBase || ""}
            />
          </div>
          <div className="space-2">
            <Label htmlFor="serverArchitecture">Architecture</Label>
            <Input
              name="serverArchitecture"
              placeholder="Docker / Kubernetes / Monolith"
              defaultValue={prefillData?.serverArchitecture || ""}
            />
          </div>
          <div className="space-2">
            <Label htmlFor="additionalTechNotes">
              Additional technical notes
            </Label>
            <Textarea
              name="additionalTechNotes"
              placeholder="Additional technical notes..."
              defaultValue={prefillData?.additionalTechNotes || ""}
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
                defaultValue={prefillData?.responsiblePerson?.name || ""}
                required
              />
              <Input
                name="responsiblePersonDesignation"
                placeholder="Designation"
                defaultValue={prefillData?.responsiblePerson?.designation || ""}
                required
              />
              <Input
                name="responsiblePersonOrganization"
                placeholder="Organization"
                defaultValue={
                  prefillData?.responsiblePerson?.organization || ""
                }
                required
              />
              <Input
                name="responsiblePersonContact"
                placeholder="Contact Number"
                defaultValue={prefillData?.responsiblePerson?.contact || ""}
                required
              />
              <Input
                name="responsiblePersonEmail"
                type="email"
                placeholder="Email"
                defaultValue={prefillData?.responsiblePerson?.email || ""}
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
                defaultValue={prefillData?.alternativePerson?.name || ""}
              />
              <Input
                name="alternativePersonDesignation"
                placeholder="Designation"
                defaultValue={prefillData?.alternativePerson?.designation || ""}
              />
              <Input
                name="alternativePersonOrganization"
                placeholder="Organization"
                defaultValue={
                  prefillData?.alternativePerson?.organization || ""
                }
              />
              <Input
                name="alternativePersonContact"
                placeholder="Contact Number"
                defaultValue={prefillData?.alternativePerson?.contact || ""}
              />
              <Input
                name="alternativePersonEmail"
                type="email"
                placeholder="Email"
                defaultValue={prefillData?.alternativePerson?.email || ""}
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
                defaultValue={prefillData?.developer?.name || ""}
              />
              <Input
                name="developerAddress"
                placeholder="Address"
                defaultValue={prefillData?.developer?.address || ""}
              />
              <Input
                name="developerContact"
                placeholder="Contact Number"
                defaultValue={prefillData?.developer?.contact || ""}
              />
              <Input
                name="developerEmail"
                type="email"
                placeholder="Email"
                defaultValue={prefillData?.developer?.email || ""}
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
              defaultValue={prefillData?.quantity || "1"}
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
            {/* <RadioGroup
              name="vcpuValue"
              defaultValue={prefillData?.vcpu || "2"}
              className="grid grid-cols-2 gap-2"
            >
              {[1, 2, 4, 8].map((n) => (
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
                <Label htmlFor="cpu-other">Other</Label>
              </div>
            </RadioGroup>
            {prefillData?.vcpu === "other" && (
              <Input
                name="customVcpu"
                placeholder="Specify cores"
                type="number"
                className="mt-2"
                defaultValue={prefillData?.customVcpu || ""}
              />
            )} */}
            <RadioGroup
              name="vcpuValue"
              value={vcpuValue} // ✅ Controlled component
              onValueChange={setVcpuValue as any}
              className="grid grid-cols-2 gap-2"
            >
              {[1, 2, 4, 8].map((n) => (
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
                <Label htmlFor="cpu-other">Other</Label>
              </div>
            </RadioGroup>

            {vcpuValue === "other" && (
              <Input
                name="customVcpu"
                placeholder="Specify cores"
                type="number"
                defaultValue={prefillData?.vcpu || ""}
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
              {[4, 8, 16, 32].map((n) => (
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
                <Label htmlFor="ram-other">Other</Label>
              </div>
            </RadioGroup>
            {ramValue === "other" && (
              <Input
                name="customRam"
                placeholder="Specify GB"
                type="number"
                className="mt-2"
                defaultValue={prefillData?.ramGb || ""}
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
              {[50, 100, 250, 500].map((n) => (
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
                <Label htmlFor="st-other">Other</Label>
              </div>
            </RadioGroup>
            {storageValue === "other" && (
              <Input
                name="customStorage"
                placeholder="Specify OS GB"
                type="number"
                className="mt-2"
                defaultValue={prefillData?.storageGb || ""}
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
                defaultValue={prefillData?.osName || "Ubuntu"}
              />
            </div>
            <div className="space-y-2">
              <Label>Operating System Version * </Label>
              <Input
                name="osVersion"
                placeholder="e.g., 22.04 LTS"
                value={prefillData?.osVersion || "22.04 LTS"}
              />
            </div>
          </div>

          {/* RAID & Subdomain */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 pt-6">
            <div className="space-y-2">
              <Label>RAID Configuration</Label>
              <Select name="raid" defaultValue={prefillData?.raid || "NONE"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["RAID0", "RAID1", "RAID5", "RAID10", "NONE"] as const).map(
                    (r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sub Domain *</Label>
              <Input
                name="subdomain"
                placeholder="e.g., app.example.com"
                defaultValue={prefillData?.subdomain || ""}
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
                defaultChecked={prefillData?.requiredPublicIP || false}
              />
              <div className="space-y-0.5">
                <Label>Required VPN</Label>
                <p className="text-xs text-slate-500">Talk before submitting</p>
              </div>
              <Switch
                name="vpnRequired"
                defaultChecked={prefillData?.vpnRequired || false}
              />
            </div>

            {/* SSL */}
            <div className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                <Select
                  name="sslProvider"
                  defaultValue={prefillData?.sslProvider || "MIS"}
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
                    defaultValue={prefillData?.sslCostPaidBy || ""}
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
                        newPorts[i].protocol = v;
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
                <Label>Security Assessment (VA Report) *</Label>
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
                fill-responsible
                <Label htmlFor="renewal">Renewal Required</Label>
              </div>
              <Input
                name="renewalPeriodMonths"
                placeholder="Renewal Period (Months)"
                type="number"
                className="mt-2"
                defaultValue={prefillData?.renewalPeriodMonths || ""}
              />
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
