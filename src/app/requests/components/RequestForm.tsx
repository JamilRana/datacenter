// src/app/requests/components/RequestForm.tsx
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
import { getAttachmentUrl } from "@/app/actions/file-actions";
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
  ChevronRight,
  ChevronLeft,
  Info,
  Layers,
} from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { AdditionalDisk, detailsRequest, FirewallPort } from "@/types/requests";
import { Protocol } from "@/types/enums";
import { ROLES } from "@/lib/roles";
import { getDetailedRequest } from "@/app/actions/request-actions";
import { getRequesters } from "@/app/actions/user-actions";
import { User } from "@/types/users";
import { RequestStepper } from "./RequestStepper";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const requiredFields = [
  "systemName",
  "purpose", 
  "environment",
  "osName",
  "osVersion",
  "subdomain",
];

export function RequestForm({
  userId,
  editId,
}: {
  userId: string;
  editId?: string;
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const hasRole = (roles: string[] | undefined, role: string): boolean => {
    return roles?.includes(role) || false;
  };

  const isDeveloper = hasRole(session?.user.roles, ROLES.DEVELOPER);

  const [requesters, setRequesters] = useState<User[]>([]);
  const [assignedRequesterId, setAssignedRequesterId] = useState<string>("");

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
  const [attachmentUrls, setAttachmentUrls] = useState<{
    securityReport?: string;
    justification?: string;
  }>({});
  const [removedAttachments, setRemovedAttachments] = useState<string[]>([]);
  const [draftSaved, setDraftSaved] = useState(false);
  const [formValid, setFormValid] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;

  const TERMS_CONTENT = `
    <h4 class="font-semibold mb-2">Terms and Conditions for Server Request</h4>
    <ul class="list-disc pl-4 text-sm space-y-1">
      <li>Without DGHS management's prior written approval, Data Center management personnel will not provide management access to the server from the internet.</li>
      <li>All required information must be filled out completely by the requester.</li>
      <li>Server access credentials must be securely managed by the requester.</li>
      <li>The requester must ensure their software or web application does not contain malicious code, vulnerabilities, or defects that could compromise security, stability, or performance.</li>
      <li>Each deployed system must undergo a half-yearly review and renewal process. Failure to renew within the stipulated period may result in suspension or decommissioning.</li>
      <li>The requester is responsible for the VM until it is officially decommissioned.</li>
      <li>Any changes to the system require submission of a new request.</li>
    </ul>
  `;

  const checkFormValidity = useCallback(() => {
    const form = formRef.current;
    if (!form) return;

    const formData = new FormData(form);
    const isValid = requiredFields.every(field => {
      const value = formData.get(field);
      return value && String(value).trim() !== "";
    });
    setFormValid(isValid);
  }, []);

  // Hardware values
  const [vcpuValue, setVcpuValue] = useState<string>("2");
  const [ramValue, setRamValue] = useState<string>("4");
  const [storageValue, setStorageValue] = useState<string>("50");

  // Controlled values
  const [environment, setEnvironment] = useState<string>("PRODUCTION");
  const [raid, setRaid] = useState<string>("NONE");
  const [requiredPublicIP, setRequiredPublicIP] = useState<boolean>(false);
  const [vpnRequired, setVpnRequired] = useState<boolean>(false);
  const [renewalRequired, setRenewalRequired] = useState<boolean>(false);
  const [osName, setOsName] = useState<string>("Ubuntu");
  const [osVersion, setOsVersion] = useState<string>("");
  const [systemName, setSystemName] = useState<string>("");
  const [projectName, setProjectName] = useState<string>("");
  const [purpose, setPurpose] = useState<string>("");
  const [subdomain, setSubdomain] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [frontendTech, setFrontendTech] = useState<string>("");
  const [backendTech, setBackendTech] = useState<string>("");
  const [dataBase, setDataBase] = useState<string>("");
  const [serverArchitecture, setServerArchitecture] = useState<string>("");
  const [isAutoSaving, setIsAutoSaving] = useState<boolean>(false);
  const [draftRequestId, setDraftRequestId] = useState<string | null>(null);

  // Initialize from prefill data
  useEffect(() => {
    if (prefillData) {
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
      if (prefillData.requiredPublicIP !== undefined) setRequiredPublicIP(!!prefillData.requiredPublicIP);
      if (prefillData.vpnRequired !== undefined) setVpnRequired(!!prefillData.vpnRequired);
      if (prefillData.renewalRequired !== undefined) setRenewalRequired(!!prefillData.renewalRequired);
      if (prefillData.osName) setOsName(prefillData.osName);
      if (prefillData.osVersion) setOsVersion(prefillData.osVersion);
      if (prefillData.systemName) setSystemName(prefillData.systemName);
      if (prefillData.projectName) setProjectName(prefillData.projectName);
      if (prefillData.purpose) setPurpose(prefillData.purpose);
      if (prefillData.subdomain) setSubdomain(prefillData.subdomain);
      if (prefillData.quantity) setQuantity(prefillData.quantity);
      if (prefillData.frontendTech) setFrontendTech(prefillData.frontendTech);
      if (prefillData.backendTech) setBackendTech(prefillData.backendTech);
      if (prefillData.dataBase) setDataBase(prefillData.dataBase);
      if (prefillData.serverArchitecture) setServerArchitecture(prefillData.serverArchitecture);
      
      if (isDeveloper && prefillData.requesterId && prefillData.requesterId !== userId) {
        setAssignedRequesterId(prefillData.requesterId);
      }
    }
  }, [prefillData, isDeveloper, userId]);

  useEffect(() => {
    checkFormValidity();
  }, [prefillData, isEditing, checkFormValidity]);

  useEffect(() => {
    const loadCopyData = async () => {
      if (!copyFrom && !isEditing) {
        setPrefillData(null);
        return;
      }

      try {
        let requestData: detailsRequest | null = null;
        if (copyFrom) {
          const response = await getDetailedRequest(copyFrom);
          if (response) {
            requestData = (response as any).success ? (response as any).data ?? null : response;
          }
        } else if (isEditing && editId) {
          const response = await getDetailedRequest(editId);
          if (response) {
            requestData = (response as any).success ? (response as any).data ?? null : response;
          }
        }
        setPrefillData(requestData);

        if (requestData) {
            setAdditionalDisks(
              requestData?.additionalDisks?.map(d => ({
                sequence: d.sequence,
                sizeGb: d.sizeGb,
                purpose: d.purpose || "",
              })) || [{ sequence: 1, sizeGb: 0, purpose: "" }]
            );

            setFirewallPorts(
              requestData?.firewallPorts?.map(p => ({
                port: p.port,
                protocol: p.protocol || Protocol.TCP,
                purpose: p.purpose || "",
                source: p.source || "",
              })) || [{ port: 80, protocol: Protocol.TCP, purpose: "HTTP", source: "" }]
            );

            setNetworkAccess(requestData?.networkAccess?.map((n: { accessType: string }) => n.accessType) || ["LOCAL"]);

            const attachments = requestData?.attachments || [];
            const securityRep = attachments.find((a: { attachmentType: string }) => a.attachmentType === "SECURITY_REPORT");
            const justification = attachments.find((a: { attachmentType: string }) => a.attachmentType === "JUSTIFICATION");
            setExistingAttachments({
              securityReport: securityRep ? { id: securityRep.id, fileName: securityRep.fileName, filePath: securityRep.filePath } : undefined,
              justification: justification ? { id: justification.id, fileName: justification.fileName, filePath: justification.filePath } : undefined,
            });

            if (securityRep?.filePath) {
              const url = await getAttachmentUrl(securityRep.filePath);
              setAttachmentUrls(prev => ({ ...prev, securityReport: url }));
            }
            if (justification?.filePath) {
              const url = await getAttachmentUrl(justification.filePath);
              setAttachmentUrls(prev => ({ ...prev, justification: url }));
            }
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

  const handleSubmit = async (submitType: "draft" | "submit", isAutoSave: boolean = false): Promise<boolean> => {
    if (isDeveloper && submitType === "submit") {
      toast.error("Developers can only save drafts. Requesters must submit for approval.");
      return false;
    }

    if (isDeveloper && !assignedRequesterId) {
      toast.error("Please assign a requester before continuing");
      return false;
    }

    if (!isAutoSave) setIsSubmitting(true);
    else setIsAutoSaving(true);

    const form = formRef.current;
    if (!form) {
      setIsSubmitting(false);
      setIsAutoSaving(false);
      return false;
    }

    const formData = new FormData(form);
    
    if (isDeveloper && assignedRequesterId) {
      formData.set("requesterId", assignedRequesterId);
      formData.set("developerId", userId);
    } else {
      formData.set("requesterId", userId);
    }

    formData.append("requestType", "NEW_VM");
    formData.append("status", submitType === "submit" ? "PENDING_L1" : "DRAFT");
    
    // Explicitly set all state-controlled fields to ensure they are captured regardless of current step
    formData.set("systemName", systemName);
    formData.set("projectName", projectName);
    formData.set("purpose", purpose);
    formData.set("environment", environment);
    formData.set("quantity", quantity.toString());
    formData.set("osName", osName);
    formData.set("osVersion", osVersion);
    formData.set("subdomain", subdomain);
    formData.set("raid", raid);
    formData.set("requiredPublicIP", requiredPublicIP ? "on" : "off");
    formData.set("vpnRequired", vpnRequired ? "on" : "off");
    formData.set("renewalRequired", renewalRequired ? "on" : "off");
    formData.set("frontendTech", frontendTech);
    formData.set("backendTech", backendTech);
    formData.set("dataBase", dataBase);
    formData.set("serverArchitecture", serverArchitecture);

    formData.append("networkAccess", JSON.stringify(networkAccess));
    formData.append(
      "additionalDisks",
      JSON.stringify(additionalDisks.filter(d => d.sizeGb > 0))
    );
    formData.append(
      "firewallPorts",
      JSON.stringify(firewallPorts
        .filter(p => p.port > 0)
        .map(p => ({ ...p, purpose: p.purpose || "N/A" })) // Ensure purpose is never null
      )
    );

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

    if (securityReport) formData.append("securityReport", securityReport);
    if (justificationDoc) formData.append("justificationDoc", justificationDoc);
    formData.append("vaReportSubmitted", securityReport ? "true" : "false");
    formData.append("justificationSubmitted", justificationDoc ? "true" : "false");

    if (removedAttachments.length > 0) {
      formData.append("removedAttachments", JSON.stringify(removedAttachments));
    }

    if (isDeveloper && session?.user) {
      formData.set("developerName", session.user.name || "");
      formData.set("developerDesignation", session.user.designation || "");
      formData.set("developerOrganization", session.user.organization || "");
      formData.set("developerContact", session.user.contact || "");
      formData.set("developerEmail", session.user.email || "");
    }

    const currentRequestId = isEditing ? editId : draftRequestId;
    if (currentRequestId) {
      formData.append("requestId", currentRequestId);
    }

    try {
      const url = (isEditing || draftRequestId) ? `/api/requests/${currentRequestId}` : "/api/requests";
      const response = await fetch(url, {
        method: (isEditing || draftRequestId) ? "PATCH" : "POST",
        body: formData,
      });

      const result = await response.json();
      if (response.ok) {
        if (!isAutoSave) {
          toast.success(`Request ${submitType === "submit" ? "submitted for approval" : "saved as draft"}!`);
        }
        
        // If it was the first save of a new request, store the ID to continue editing
        if (!isEditing && !draftRequestId && result.id) {
          setDraftRequestId(result.id);
        }

        if (submitType === "submit") {
          toast.success("Request submitted successfully!");
          router.push("/requests");
        } else if (!isAutoSave && isDeveloper) {
          router.push("/requests");
        }
        return true;
      } else {
        toast.error(result.error || "Submission failed");
        return false;
      }
    } catch (error) {
      toast.error(`Network error: ${error}`);
      return false;
    } finally {
      setIsSubmitting(false);
      setIsAutoSaving(false);
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

  const nextStep = async () => {
    // Auto-save progress as we move to the next step
    if (currentStep < totalSteps) {
      const success = await handleSubmit("draft", true);
      if (success) {
        setCurrentStep(currentStep + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getDefaultValue = (value: string | number | boolean | null | undefined, defaultValue: string) => 
    value !== null && value !== undefined ? String(value) : defaultValue;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-28">
      {/* Stepper Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-600" />
        <RequestStepper 
          currentStep={currentStep} 
          onStepClick={(stepId) => setCurrentStep(stepId)} 
        />
      </div>

      <form
        ref={formRef}
        key={copyFrom || "new-request"}
        className="space-y-8"
        onChange={checkFormValidity}
      >
        {copyFrom && (
          <div className="bg-blue-50 p-3 rounded-md border border-blue-200 text-blue-800 text-sm mb-4">
            📋 Prefilled from a previous request. Please review all fields.
          </div>
        )}

        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Developer Assignment */}
              {isDeveloper && (
                <Card className="shadow-md border-amber-200 bg-amber-50/30">
                  <CardHeader>
                    <CardTitle className="text-lg text-amber-800 flex items-center gap-2">
                      <Users className="w-5 h-5" /> Assign Responsible Requester
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Label className="text-amber-800">Requester *</Label>
                      <Select value={assignedRequesterId} onValueChange={setAssignedRequesterId} required>
                        <SelectTrigger className="border-amber-300">
                          <SelectValue placeholder="Select the user responsible for this VM" />
                        </SelectTrigger>
                        <SelectContent>
                          {requesters.map((requester) => (
                            <SelectItem key={requester.id} value={requester.id}>
                              {requester.name} • {requester.designation || requester.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Identity & Project */}
              <Card className="shadow-md border-slate-200">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-blue-600">
                    <Server className="w-5 h-5" />
                    <CardTitle className="text-lg">System Identification</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                  <div className="space-y-2">
                    <Label>System/Service Name *</Label>
                    <Input 
                      name="systemName" 
                      placeholder="e.g. Health Management Information System" 
                      value={systemName}
                      onChange={(e) => setSystemName(e.target.value)}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Project/Program Name</Label>
                    <Input 
                      name="projectName" 
                      placeholder="e.g. DGHS Digitalization" 
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>System Purpose *</Label>
                    <Textarea 
                      name="purpose" 
                      placeholder="Briefly describe the business need for this server..." 
                      className="min-h-[100px]" 
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Target Environment</Label>
                    <Select name="environment" value={environment} onValueChange={setEnvironment}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["DEVELOPMENT", "STAGING", "PRODUCTION", "TESTING"].map((e) => (
                          <SelectItem key={e} value={e}>{e}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Expected End Date</Label>
                    <Input name="expectedEndDate" type="date" defaultValue={prefillData?.expectedEndDate ? new Date(prefillData.expectedEndDate).toISOString().split('T')[0] : ""} />
                  </div>
                </CardContent>
              </Card>

              {/* Tech Stack */}
              <Card className="shadow-md border-slate-200">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-purple-600">
                    <Code className="w-5 h-5" />
                    <CardTitle className="text-lg">Technology Stack</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                  <div className="space-y-2">
                    <Label>Frontend Technology</Label>
                    <Input 
                      name="frontendTech" 
                      placeholder="e.g. Next.js, Flutter" 
                      value={frontendTech}
                      onChange={(e) => setFrontendTech(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Backend Technology</Label>
                    <Input 
                      name="backendTech" 
                      placeholder="e.g. Node.js, Go" 
                      value={backendTech}
                      onChange={(e) => setBackendTech(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Database</Label>
                    <Input 
                      name="dataBase" 
                      placeholder="e.g. PostgreSQL, Redis" 
                      value={dataBase}
                      onChange={(e) => setDataBase(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Architecture</Label>
                    <Input 
                      name="serverArchitecture" 
                      placeholder="e.g. Microservices, Docker" 
                      value={serverArchitecture}
                      onChange={(e) => setServerArchitecture(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <Card className="shadow-md border-slate-200">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-600">
                    <Cpu className="w-5 h-5" />
                    <CardTitle className="text-lg">Resource Allocation</CardTitle>
                  </div>
                  <div className="flex items-center gap-3 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                    <Label htmlFor="quantity" className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Quantity:</Label>
                    <Input 
                      name="quantity" 
                      type="number" 
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                      className="w-12 h-7 bg-white border-indigo-200 text-center p-0 no-spinner font-bold" 
                      min="1" 
                      max="20" 
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-8 pt-8">
                  {/* vCPU */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-bold text-slate-700 uppercase tracking-tight">vCPU Cores</Label>
                      {vcpuValue === "other" && <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-medium">Custom</span>}
                    </div>
                    <RadioGroup value={vcpuValue} onValueChange={setVcpuValue} className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {[1, 2, 4, 8].map((n) => (
                        <div key={n} className={cn("relative flex items-center justify-center border-2 rounded-xl p-4 cursor-pointer transition-all", vcpuValue === n.toString() ? "border-blue-600 bg-blue-50/50" : "border-slate-200 hover:border-slate-300")}>
                          <RadioGroupItem value={n.toString()} id={`cpu-${n}`} className="sr-only" />
                          <Label htmlFor={`cpu-${n}`} className="cursor-pointer text-center">
                            <div className="text-xl font-bold">{n}</div>
                            <div className="text-[10px] text-slate-500 uppercase">Cores</div>
                          </Label>
                        </div>
                      ))}
                      <div className={cn("relative flex items-center justify-center border-2 rounded-xl p-4 cursor-pointer transition-all", vcpuValue === "other" ? "border-blue-600 bg-blue-50/50" : "border-slate-200 hover:border-slate-300")}>
                        <RadioGroupItem value="other" id="cpu-other" className="sr-only" />
                        <Label htmlFor="cpu-other" className="cursor-pointer text-center">
                          <div className="text-xl font-bold leading-none">?</div>
                          <div className="text-[10px] text-slate-500 uppercase mt-1">Other</div>
                        </Label>
                      </div>
                    </RadioGroup>
                    {vcpuValue === "other" && <Input name="customVcpu" placeholder="Enter number of cores" type="number" defaultValue={getDefaultValue(prefillData?.vcpu?.toString(), "")} className="mt-2" />}
                  </div>

                  {/* RAM */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-bold text-slate-700 uppercase tracking-tight">Memory (RAM GB)</Label>
                    </div>
                    <RadioGroup value={ramValue} onValueChange={setRamValue} className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {[4, 8, 16, 32].map((n) => (
                        <div key={n} className={cn("relative flex items-center justify-center border-2 rounded-xl p-4 cursor-pointer transition-all", ramValue === n.toString() ? "border-blue-600 bg-blue-50/50" : "border-slate-200 hover:border-slate-300")}>
                          <RadioGroupItem value={n.toString()} id={`ram-${n}`} className="sr-only" />
                          <Label htmlFor={`ram-${n}`} className="cursor-pointer text-center">
                            <div className="text-xl font-bold">{n}</div>
                            <div className="text-[10px] text-slate-500 uppercase">GB</div>
                          </Label>
                        </div>
                      ))}
                      <div className={cn("relative flex items-center justify-center border-2 rounded-xl p-4 cursor-pointer transition-all", ramValue === "other" ? "border-blue-600 bg-blue-50/50" : "border-slate-200 hover:border-slate-300")}>
                        <RadioGroupItem value="other" id="ram-other" className="sr-only" />
                        <Label htmlFor="ram-other" className="cursor-pointer text-center">
                          <div className="text-xl font-bold leading-none">?</div>
                          <div className="text-[10px] text-slate-500 uppercase mt-1">Other</div>
                        </Label>
                      </div>
                    </RadioGroup>
                    {ramValue === "other" && <Input name="customRam" placeholder="Enter RAM in GB" type="number" defaultValue={getDefaultValue(prefillData?.ramGb?.toString(), "")} className="mt-2" />}
                  </div>

                  {/* Storage */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-bold text-slate-700 uppercase tracking-tight">Primary OS Disk</Label>
                    </div>
                    <RadioGroup value={storageValue} onValueChange={setStorageValue} className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {[50, 100, 250, 500].map((n) => (
                        <div key={n} className={cn("relative flex items-center justify-center border-2 rounded-xl p-4 cursor-pointer transition-all", storageValue === n.toString() ? "border-blue-600 bg-blue-50/50" : "border-slate-200 hover:border-slate-300")}>
                          <RadioGroupItem value={n.toString()} id={`st-${n}`} className="sr-only" />
                          <Label htmlFor={`st-${n}`} className="cursor-pointer text-center">
                            <div className="text-xl font-bold">{n}</div>
                            <div className="text-[10px] text-slate-500 uppercase">GB</div>
                          </Label>
                        </div>
                      ))}
                      <div className={cn("relative flex items-center justify-center border-2 rounded-xl p-4 cursor-pointer transition-all", storageValue === "other" ? "border-blue-600 bg-blue-50/50" : "border-slate-200 hover:border-slate-300")}>
                        <RadioGroupItem value="other" id="st-other" className="sr-only" />
                        <Label htmlFor="st-other" className="cursor-pointer text-center">
                          <div className="text-xl font-bold leading-none">?</div>
                          <div className="text-[10px] text-slate-500 uppercase mt-1">Other</div>
                        </Label>
                      </div>
                    </RadioGroup>
                    {storageValue === "other" && <Input name="customStorage" placeholder="Enter OS Disk GB" type="number" defaultValue={getDefaultValue(prefillData?.storageGb?.toString(), "")} className="mt-2" />}
                  </div>

                  {/* OS Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                    <div className="space-y-2">
                      <Label>Operating System Name *</Label>
                      <Input 
                        name="osName" 
                        placeholder="e.g. Ubuntu, Windows Server" 
                        value={osName}
                        onChange={(e) => setOsName(e.target.value)}
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>OS Version *</Label>
                      <Input 
                        name="osVersion" 
                        placeholder="e.g. 22.04 LTS, 2022" 
                        value={osVersion}
                        onChange={(e) => setOsVersion(e.target.value)}
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>RAID Configuration</Label>
                      <Select name="raid" value={raid} onValueChange={setRaid}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["RAID0", "RAID1", "RAID5", "RAID10", "NONE"].map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <Card className="shadow-md border-slate-200">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <Network className="w-5 h-5" />
                    <CardTitle className="text-lg">Network & Security</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-8 pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <Label className="text-sm font-bold text-slate-700 uppercase tracking-tight">Access Control</Label>
                      <div className="flex flex-wrap gap-2">
                        {["LOCAL", "INTERNET", "REMOTE"].map((t) => (
                          <div key={t} className={cn("flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all", networkAccess.includes(t) ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500")}>
                            <Checkbox checked={networkAccess.includes(t)} onCheckedChange={(checked) => {
                                if (typeof checked === "boolean") {
                                  if (checked) setNetworkAccess([...networkAccess, t]);
                                  else setNetworkAccess(networkAccess.filter(x => x !== t));
                                }
                              }} />
                            <span className="text-xs font-bold">{t}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <Label className="text-sm font-bold text-slate-700 uppercase tracking-tight">Connectivity Options</Label>
                      <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Info className="w-4 h-4 text-slate-400" />
                            <Label className="text-sm">Public IP Address</Label>
                          </div>
                          <Switch name="requiredPublicIP" checked={requiredPublicIP} onCheckedChange={setRequiredPublicIP} />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-slate-400" />
                            <Label className="text-sm">Required VPN Access</Label>
                          </div>
                          <Switch name="vpnRequired" checked={vpnRequired} onCheckedChange={setVpnRequired} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-sm font-bold text-slate-700 uppercase tracking-tight">Firewall Rules</Label>
                    <div className="space-y-3">
                      {firewallPorts.map((port, i) => (
                        <div key={i} className="grid grid-cols-12 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 relative group">
                          <div className="col-span-12 md:col-span-3 space-y-1.5">
                            <Label className="text-[10px] uppercase text-slate-400 font-bold">Port</Label>
                            <Input placeholder="Port" value={port.port} onChange={(e) => {
                              const newPorts = [...firewallPorts];
                              newPorts[i].port = parseInt(e.target.value);
                              setFirewallPorts(newPorts);
                            }} type="number" className="h-9 no-spinner" />
                          </div>
                          <div className="col-span-12 md:col-span-3 space-y-1.5">
                            <Label className="text-[10px] uppercase text-slate-400 font-bold">Protocol</Label>
                            <Select value={port.protocol} onValueChange={(v) => {
                              const newPorts = [...firewallPorts];
                              newPorts[i].protocol = v as Protocol;
                              setFirewallPorts(newPorts);
                            }}>
                              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="TCP">TCP</SelectItem>
                                <SelectItem value="UDP">UDP</SelectItem>
                                <SelectItem value="OTHER">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-12 md:col-span-5 space-y-1.5">
                            <Label className="text-[10px] uppercase text-slate-400 font-bold">Purpose</Label>
                            <Input placeholder="Description" value={port.purpose} onChange={(e) => {
                              const newPorts = [...firewallPorts];
                              newPorts[i].purpose = e.target.value;
                              setFirewallPorts(newPorts);
                            }} className="h-9" />
                          </div>
                          <div className="col-span-12 md:col-span-1 flex items-end justify-end">
                            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-500 hover:bg-red-50" onClick={() => setFirewallPorts(firewallPorts.filter((_, idx) => idx !== i))}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      <Button type="button" variant="outline" size="sm" className="w-full border-dashed border-2 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 h-10" onClick={() => setFirewallPorts([...firewallPorts, { port: 80, protocol: Protocol.TCP, purpose: "" }])}>
                        <Plus className="w-4 h-4 mr-2" /> Add Firewall Rule
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4 pt-6 border-t border-slate-100">
                    <Label className="text-sm font-bold text-slate-700 uppercase tracking-tight">Host Details</Label>
                    <div className="space-y-2">
                      <Label>Proposed Subdomain *</Label>
                      <div className="flex items-center gap-2">
                        <div className="bg-slate-100 px-3 py-2 rounded-lg text-slate-500 text-sm font-medium border border-slate-200">https://</div>
                        <Input 
                          name="subdomain" 
                          placeholder="app-name.dghs.gov.bd" 
                          value={subdomain}
                          onChange={(e) => setSubdomain(e.target.value)}
                          required 
                          className="flex-1" 
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Additional Disks */}
              <Card className="shadow-md border-slate-200">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-blue-600">
                    <Layers className="w-5 h-5" />
                    <CardTitle className="text-lg">Additional Storage</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  {additionalDisks.map((disk, i) => (
                    <div key={i} className="flex gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 items-end">
                      <div className="w-32 space-y-1.5">
                        <Label className="text-[10px] uppercase text-slate-400 font-bold">Size (GB)</Label>
                        <Input placeholder="Size" type="number" value={disk.sizeGb} onChange={(e) => {
                          const d = [...additionalDisks];
                          d[i].sizeGb = parseInt(e.target.value);
                          setAdditionalDisks(d);
                        }} className="no-spinner" />
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <Label className="text-[10px] uppercase text-slate-400 font-bold">Mount Point/Purpose</Label>
                        <Input placeholder="e.g. /var/lib/mysql" value={disk.purpose} onChange={(e) => {
                          const d = [...additionalDisks];
                          d[i].purpose = e.target.value;
                          setAdditionalDisks(d);
                        }} />
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => setAdditionalDisks(additionalDisks.filter((_, idx) => idx !== i))}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="w-full border-dashed border-2 h-10" onClick={() => setAdditionalDisks([...additionalDisks, { sequence: additionalDisks.length + 1, sizeGb: 0, purpose: "" }])}>
                    <Plus className="w-4 h-4 mr-2" /> Add Data Disk
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {currentStep === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Request Summary Preview */}
              <Card className="shadow-lg border-blue-200 bg-blue-50/20 overflow-hidden">
                <CardHeader className="bg-blue-600 py-3">
                  <CardTitle className="text-sm text-white flex items-center gap-2">
                    <Info className="w-4 h-4" /> Review Your Request
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-sm">
                    <p className="text-[10px] text-slate-400 uppercase font-bold">System</p>
                    <p className="text-sm font-bold text-blue-900 truncate" title={systemName}>{systemName || "N/A"}</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-sm">
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Resources</p>
                    <p className="text-sm font-bold text-blue-900">{vcpuValue === 'other' ? 'Custom' : vcpuValue}v / {ramValue === 'other' ? 'Custom' : ramValue}GB</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-sm">
                    <p className="text-[10px] text-slate-400 uppercase font-bold">OS/Disk</p>
                    <p className="text-sm font-bold text-blue-900 truncate" title={`${storageValue}GB ${osName}`}>
                      {storageValue === 'other' ? 'Custom' : storageValue}GB {osName}
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-sm">
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Subdomain</p>
                    <p className="text-sm font-bold text-blue-900 truncate" title={subdomain}>{subdomain || "N/A"}</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-sm">
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Env</p>
                    <p className="text-sm font-bold text-blue-900">{environment}</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-sm">
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Network</p>
                    <p className="text-sm font-bold text-blue-900">{firewallPorts.length} Rules</p>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Contacts */}
                <Card className="shadow-md border-slate-200">
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-blue-600">
                      <Users className="w-5 h-5" />
                      <CardTitle className="text-lg">Contact Persons</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-6">
                    <div className="space-y-4">
                      <Label className="font-bold text-slate-700">Developer (Primary Contact)</Label>
                      <div className="grid grid-cols-1 gap-3">
                        <Input name="developerName" placeholder="Name" defaultValue={getDefaultValue(prefillData?.developer?.name || (isDeveloper ? session?.user?.name : ""), "")} disabled={isDeveloper} />
                        <Input name="developerEmail" type="email" placeholder="Email" defaultValue={getDefaultValue(prefillData?.developer?.email || (isDeveloper ? session?.user?.email : ""), "")} disabled={isDeveloper} />
                        <Input name="developerContact" placeholder="Contact Number" defaultValue={getDefaultValue(prefillData?.developer?.contact || (isDeveloper ? session?.user?.contact : ""), "")} disabled={isDeveloper} />
                      </div>
                    </div>
                    <div className="space-y-4 border-t border-slate-100 pt-6">
                      <Label className="font-bold text-slate-700">Alternate Contact (Optional)</Label>
                      <div className="grid grid-cols-1 gap-3">
                        <Input name="alternativePersonName" placeholder="Name" defaultValue={getDefaultValue(prefillData?.alternativePerson?.name, "")} />
                        <Input name="alternativePersonEmail" type="email" placeholder="Email" defaultValue={getDefaultValue(prefillData?.alternativePerson?.email, "")} />
                        <Input name="alternativePersonContact" placeholder="Contact Number" defaultValue={getDefaultValue(prefillData?.alternativePerson?.contact, "")} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Compliance */}
                <Card className="shadow-md border-slate-200">
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-red-600">
                      <ShieldCheck className="w-5 h-5" />
                      <CardTitle className="text-lg">Compliance Documents</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-6">
                    <div className="space-y-3">
                      <Label>Security Assessment Report (PDF/Images)</Label>
                      {existingAttachments.securityReport && (
                        <div className="flex items-center justify-between p-2 bg-emerald-50 rounded-lg border border-emerald-200 text-xs">
                          <span className="truncate flex-1">{existingAttachments.securityReport.fileName}</span>
                          <button type="button" onClick={() => {
                            const id = existingAttachments.securityReport?.id;
                            if (id) setRemovedAttachments(prev => [...prev, id]);
                            setExistingAttachments(prev => ({ ...prev, securityReport: undefined }));
                          }} className="text-red-500 font-bold ml-2">Remove</button>
                        </div>
                      )}
                      <div className="flex items-center gap-2 border-2 border-dashed border-slate-200 rounded-xl p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                        <Upload className="w-5 h-5 text-slate-400" />
                        <input type="file" className="text-xs flex-1" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setSecurityReport(e.target.files?.[0] || null)} />
                      </div>
                    </div>

                    <div className="space-y-3 border-t border-slate-100 pt-6">
                      <Label>Resource Justification Letter</Label>
                      {existingAttachments.justification && (
                        <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg border border-blue-200 text-xs">
                          <span className="truncate flex-1">{existingAttachments.justification.fileName}</span>
                          <button type="button" onClick={() => {
                            const id = existingAttachments.justification?.id;
                            if (id) setRemovedAttachments(prev => [...prev, id]);
                            setExistingAttachments(prev => ({ ...prev, justification: undefined }));
                          }} className="text-red-500 font-bold ml-2">Remove</button>
                        </div>
                      )}
                      <div className="flex items-center gap-2 border-2 border-dashed border-slate-200 rounded-xl p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                        <Upload className="w-5 h-5 text-slate-400" />
                        <input type="file" className="text-xs flex-1" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setJustificationDoc(e.target.files?.[0] || null)} />
                      </div>
                    </div>

                    <div className="pt-4 flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <div className="space-y-0.5">
                        <Label>Automated Renewal</Label>
                        <p className="text-[10px] text-slate-500 italic">Periodic review of system necessity</p>
                      </div>
                      <Switch name="renewalRequired" checked={renewalRequired} onCheckedChange={setRenewalRequired} />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Terms */}
              <Card className="shadow-md border-slate-200 overflow-hidden">
                  <div className="bg-slate-900 px-6 py-3">
                    <CardTitle className="text-sm text-white flex items-center gap-2">
                      📜 Terms of Agreement
                    </CardTitle>
                  </div>
                  <CardContent className="p-6 space-y-4">
                    <div className="max-h-40 overflow-y-auto bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs text-slate-600 leading-relaxed">
                      <div dangerouslySetInnerHTML={{ __html: TERMS_CONTENT }} />
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                      <Checkbox id="termsAccepted" checked={termsAccepted} onCheckedChange={(c) => setTermsAccepted(!!c)} />
                      <Label htmlFor="termsAccepted" className="text-sm font-semibold text-blue-900 cursor-pointer select-none">
                        I acknowledge and agree to the DGHS Data Center policies *
                      </Label>
                    </div>
                  </CardContent>
                </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-50">
          <div className="max-w-6xl mx-auto flex justify-between items-center gap-4">
            <Button
              variant="ghost"
              size="lg"
              className="text-slate-500 hover:text-slate-900 font-bold"
              disabled={currentStep === 1 || isSubmitting}
              type="button"
              onClick={prevStep}
            >
              <ChevronLeft className="w-5 h-5 mr-1" /> Back
            </Button>

            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="lg"
                className="hidden sm:flex border-slate-200 hover:bg-slate-50 text-slate-600 font-bold"
                disabled={isSubmitting}
                type="button"
                onClick={() => handleSubmit("draft")}
              >
                Save Draft
              </Button>

              {currentStep < totalSteps ? (
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 px-6 min-w-[100px] shadow-lg shadow-blue-200 font-bold"
                  disabled={isSubmitting || isAutoSaving}
                  type="button"
                  onClick={nextStep}
                >
                  {isAutoSaving ? "Saving..." : "Continue"} <ChevronRight className="w-5 h-5 ml-1" />
                </Button>
              ) : (
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {!isDeveloper ? (
                    <Button
                      size="sm"
                      className={cn(
                        "px-10 min-w-[220px] transition-all duration-300 shadow-xl font-bold",
                        termsAccepted ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200" : "bg-slate-400 cursor-not-allowed opacity-50"
                      )}
                      disabled={isSubmitting || !termsAccepted}
                      type="button"
                      onClick={() => handleSubmit("submit")}
                    >
                      {isSubmitting ? "Processing..." : "Submit Request"}
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      className="flex-1 sm:flex-none bg-amber-600 hover:bg-amber-700 px-10 min-w-[220px] shadow-xl font-bold text-white"
                      disabled={isSubmitting}
                      type="button"
                      onClick={() => handleSubmit("draft")}
                    >
                      {isSubmitting ? "Processing..." : "Finish & Save Draft"}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}