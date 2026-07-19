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
import { getCloneableVms, getSourceVmDetails } from "@/app/actions/clone-actions";
import { getAccessableVms } from "@/app/actions/access-actions";
import { getNamespaceOptions } from "@/app/actions/k8s-actions";
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

const REQUEST_TYPES = [
  { value: "NEW_VM", label: "New Virtual Machine", description: "Provision a new VM with custom specifications", icon: Server },
  { value: "CLONE_VM", label: "Clone Existing VM", description: "Create a full disk clone of your existing VM", icon: Layers },
  { value: "VPN_ACCESS", label: "VPN Access", description: "Request secure external VPN connectivity to your VM", icon: ShieldCheck },
  { value: "HORIZON_ACCESS", label: "Horizon Access", description: "Request Horizon client desktop access to your VM", icon: Server },
  { value: "K8S_NAMESPACE", label: "Kubernetes Namespace", description: "Request a namespace in the Kubernetes cluster", icon: Code },
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
  const queryType = searchParams.get("type");
  const [requestType, setRequestType] = useState<string>(queryType || "NEW_VM");

  const [cloneableVms, setCloneableVms] = useState<any[]>([]);
  const [sourceVmId, setSourceVmId] = useState<string>("");
  const [cloneFullDisk, setCloneFullDisk] = useState<boolean>(true);

  const [upgradeableVms, setUpgradeableVms] = useState<any[]>([]);
  const [upgradeVmId, setUpgradeVmId] = useState<string>("");
  const [currentCpu, setCurrentCpu] = useState<number>(0);
  const [currentRam, setCurrentRam] = useState<number>(0);
  const [currentStorage, setCurrentStorage] = useState<number>(0);

  const [accessableVms, setAccessableVms] = useState<any[]>([]);
  const [accessTargetVmId, setAccessTargetVmId] = useState<string>("");
  const [accessType, setAccessType] = useState<string>("");

  const [k8sNodeGroups, setK8sNodeGroups] = useState<any[]>([
    { role: "MASTER", nodeCount: 3, vcpu: 2, ramGb: 4, storageGb: 50 },
    { role: "WORKER", nodeCount: 5, vcpu: 4, ramGb: 8, storageGb: 100 }
  ]);

  useEffect(() => {
    if (requestType === "VPN_ACCESS") {
      setAccessType("VPN");
    } else if (requestType === "HORIZON_ACCESS") {
      setAccessType("HORIZON");
    }
  }, [requestType]);

  useEffect(() => {
    if (requestType === "CLONE_VM") {
      const fetchVms = async () => {
        try {
          const vms = await getCloneableVms();
          setCloneableVms(vms);
        } catch (error) {
          toast.error(`Failed to load active VMs : ${error}`);
        }
      };
      fetchVms();
    } else if (requestType === "VPN_ACCESS" || requestType === "HORIZON_ACCESS") {
      const fetchAccessable = async () => {
        try {
          const vms = await getAccessableVms();
          setAccessableVms(vms);
        } catch (error) {
          toast.error(`Failed to load active VMs : ${error}`);
        }
      };
      fetchAccessable();
    }
  }, [requestType]);
  const isEditOrCopy = isEditing || !!copyFrom || !!queryType;
  const [currentStep, setCurrentStep] = useState(isEditOrCopy ? 1 : 0);
  const totalSteps = 4;
  const isSingleStep = requestType === "CLONE_VM" || requestType === "VPN_ACCESS" || requestType === "HORIZON_ACCESS";

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
      if (prefillData.requestType) setRequestType(prefillData.requestType);
      if (prefillData.sourceVmId) setSourceVmId(prefillData.sourceVmId);
      if (prefillData.cloneFullDisk !== undefined) setCloneFullDisk(prefillData.cloneFullDisk);
      if (prefillData.upgradeVmId) setUpgradeVmId(prefillData.upgradeVmId);
      if (prefillData.upgradeCpu) setCurrentCpu(prefillData.upgradeCpu);
      if (prefillData.upgradeRamGb) setCurrentRam(prefillData.upgradeRamGb);
      if (prefillData.upgradeStorageGb) setCurrentStorage(prefillData.upgradeStorageGb);
      if (prefillData.accessTargetVmId) setAccessTargetVmId(prefillData.accessTargetVmId);
      if (prefillData.accessType) setAccessType(prefillData.accessType);
      if (prefillData.k8sRequestNodeGroups && prefillData.k8sRequestNodeGroups.length > 0) {
        setK8sNodeGroups(prefillData.k8sRequestNodeGroups.map((g: any) => ({
          role: g.role,
          nodeCount: g.nodeCount,
          vcpu: g.vcpu,
          ramGb: g.ramGb,
          storageGb: g.storageGb
        })));
      }
      
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

    formData.append("requestType", requestType);
    formData.append("status", submitType === "submit" ? "PENDING_L1" : "DRAFT");

    if (requestType === "CLONE_VM") {
      if (!sourceVmId) {
        toast.error("Please select a source VM to clone");
        return false;
      }
      formData.set("sourceVmId", sourceVmId);
      formData.set("cloneFullDisk", cloneFullDisk ? "on" : "off");
    }
    
    // Explicitly set all state-controlled fields to ensure they are captured regardless of current step
    formData.set("systemName", systemName);
    formData.set("projectName", projectName);
    formData.set("purpose", purpose);
    formData.set("environment", environment);
    formData.set("quantity", quantity.toString());
    formData.set("osName", osName);
    formData.set("osVersion", osVersion);
    formData.set("subdomain", subdomain);
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



    if (requestType === "VPN_ACCESS" || requestType === "HORIZON_ACCESS") {
      if (!accessTargetVmId) {
        toast.error("Please select a target VM for access request");
        return false;
      }
      formData.set("accessTargetVmId", accessTargetVmId);
      formData.set("accessType", requestType === "VPN_ACCESS" ? "VPN" : "HORIZON");
      formData.set("accessJustification", purpose);
    }

    if (requestType === "K8S_NAMESPACE") {
      if (k8sNodeGroups.length === 0) {
        toast.error("Please add at least one node group specification");
        return false;
      }
      formData.set("k8sNodeGroups", JSON.stringify(k8sNodeGroups));
    }

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

  const handleSourceVmChange = async (vmId: string) => {
    if (vmId === "none") return;
    setSourceVmId(vmId);
    try {
      const details = await getSourceVmDetails(vmId);
      if (details) {
        setSystemName(`Clone of ${details.hostname || details.request?.systemName || "VM"}`);
        if (details.currentSpec) {
          const spec = details.currentSpec;
          setVcpuValue(spec.vcpu.toString());
          setRamValue(spec.ramGb.toString());
          setStorageValue(spec.storageGb.toString());
          setOsName(spec.osName || "");
          setOsVersion(spec.osVersion || "");
        }
        setSubdomain(details.subdomain ? `${details.subdomain}-clone` : "");
        setEnvironment(details.environment || "PRODUCTION");
      }
    } catch (error) {
      console.error("Failed to load source VM details:", error);
      toast.error("Failed to load source VM details");
    }
  };

  const handleUpgradeVmChange = async (vmId: string) => {
    if (vmId === "none") return;
    setUpgradeVmId(vmId);
    try {
      const details = await getSourceVmDetails(vmId);
      if (details) {
        setSystemName(`Upgrade of ${details.hostname || details.request?.systemName || "VM"}`);
        if (details.currentSpec) {
          const spec = details.currentSpec;
          setCurrentCpu(spec.vcpu);
          setCurrentRam(spec.ramGb);
          setCurrentStorage(spec.storageGb);

          setVcpuValue(spec.vcpu.toString());
          setRamValue(spec.ramGb.toString());
          setStorageValue(spec.storageGb.toString());
          setOsName(spec.osName || "");
          setOsVersion(spec.osVersion || "");
        }
        setSubdomain(details.subdomain || "");
        setEnvironment(details.environment || "PRODUCTION");
      }
    } catch (error) {
      console.error("Failed to load VM details:", error);
      toast.error("Failed to load VM details");
    }
  };

  const handleAccessVmChange = async (vmId: string) => {
    if (vmId === "none") return;
    setAccessTargetVmId(vmId);
    try {
      const details = await getSourceVmDetails(vmId);
      if (details) {
        setSystemName(`${requestType === "VPN_ACCESS" ? "VPN" : "Horizon"} Access to ${details.hostname || details.request?.systemName || "VM"}`);
        if (details.currentSpec) {
          const spec = details.currentSpec;
          setVcpuValue(spec.vcpu.toString());
          setRamValue(spec.ramGb.toString());
          setStorageValue(spec.storageGb.toString());
          setOsName(spec.osName || "");
          setOsVersion(spec.osVersion || "");
        }
        setSubdomain(details.subdomain || "");
        setEnvironment(details.environment || "PRODUCTION");
      }
    } catch (error) {
      console.error("Failed to load VM details:", error);
      toast.error("Failed to load VM details");
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
    const minStep = isEditOrCopy ? 1 : 0;
    if (currentStep > minStep) setCurrentStep(currentStep - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getDefaultValue = (value: string | number | boolean | null | undefined, defaultValue: string) => 
    value !== null && value !== undefined ? String(value) : defaultValue;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-28">
      {isSingleStep ? (
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

          {/* Source VM Selector for Clone */}
          {requestType === "CLONE_VM" && (
            <Card className="shadow-md border-blue-200 bg-blue-50/20">
              <CardHeader className="bg-blue-50/50 border-b border-slate-100">
                <div className="flex items-center gap-2 text-blue-600">
                  <Layers className="w-5 h-5" />
                  <CardTitle className="text-lg">Select Source VM to Clone</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label className="text-blue-855 font-semibold">Source VM *</Label>
                  <Select value={sourceVmId} onValueChange={handleSourceVmChange} required>
                    <SelectTrigger className="border-blue-300">
                      <SelectValue placeholder="Select one of your active VMs to clone" />
                    </SelectTrigger>
                    <SelectContent>
                      {cloneableVms.length === 0 ? (
                        <SelectItem value="none" disabled>No active VMs available to clone</SelectItem>
                      ) : (
                        cloneableVms.map((vm) => (
                          <SelectItem key={vm.id} value={vm.id}>
                            {vm.hostname || vm.request?.systemName || "Unnamed VM"} — {vm.ipAddress} ({vm.environment || "N/A"})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-blue-100 mt-4">
                  <Checkbox 
                    id="cloneFullDisk" 
                    checked={cloneFullDisk} 
                    onCheckedChange={(c) => setCloneFullDisk(!!c)} 
                  />
                  <Label htmlFor="cloneFullDisk" className="text-sm font-semibold text-blue-900 cursor-pointer select-none">
                    Confirm full disk clone of the source VM
                  </Label>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Target VM Selector for Access Request */}
          {(requestType === "VPN_ACCESS" || requestType === "HORIZON_ACCESS") && (
            <Card className="shadow-md border-emerald-200 bg-emerald-50/20">
              <CardHeader className="bg-emerald-50/50 border-b border-slate-100">
                <div className="flex items-center gap-2 text-emerald-600">
                  <ShieldCheck className="w-5 h-5" />
                  <CardTitle className="text-lg">Select Target VM for Access</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label className="text-emerald-855 font-semibold">Target VM *</Label>
                  <Select value={accessTargetVmId} onValueChange={handleAccessVmChange} required>
                    <SelectTrigger className="border-emerald-300">
                      <SelectValue placeholder="Select one of your active VMs to request access" />
                    </SelectTrigger>
                    <SelectContent>
                      {accessableVms.length === 0 ? (
                        <SelectItem value="none" disabled>No active VMs available</SelectItem>
                      ) : (
                        accessableVms.map((vm) => (
                          <SelectItem key={vm.id} value={vm.id}>
                            {vm.hostname || vm.request?.systemName || "Unnamed VM"} — {vm.ipAddress} ({vm.environment || "N/A"})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Justification */}
          <Card className="shadow-md border-slate-200">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="text-lg">Purpose & Justification</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label>Detailed Purpose / Justification *</Label>
                <Textarea 
                  placeholder="Describe the business or technical justification for this request..." 
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="min-h-32"
                  required
                />
              </div>
            </CardContent>
          </Card>

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

          {/* Action Bar */}
          <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-50">
            <div className="max-w-6xl mx-auto flex justify-between items-center gap-4">
              <Button
                variant="ghost"
                size="lg"
                className="text-slate-500 hover:text-slate-900 font-bold"
                onClick={() => {
                  if (queryType) {
                    router.push("/requests");
                  } else {
                    setRequestType("NEW_VM");
                    setCurrentStep(0);
                  }
                }}
                type="button"
              >
                Back
              </Button>
              <Button
                size="sm"
                className={cn(
                  "px-10 min-w-[220px] transition-all duration-300 shadow-xl font-bold",
                  termsAccepted && ((requestType === "CLONE_VM" && sourceVmId) || (requestType !== "CLONE_VM" && accessTargetVmId)) && purpose.trim()
                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200" 
                    : "bg-slate-400 cursor-not-allowed opacity-50"
                )}
                disabled={isSubmitting || !termsAccepted || (requestType === "CLONE_VM" ? !sourceVmId : !accessTargetVmId) || !purpose.trim()}
                type="button"
                onClick={() => handleSubmit("submit")}
              >
                {isSubmitting ? "Processing..." : "Submit Request"}
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <>
          {/* Stepper Header */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-600" />
            <RequestStepper 
              currentStep={currentStep} 
              onStepClick={(stepId) => setCurrentStep(stepId)} 
              isEditOrCopy={isEditOrCopy}
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
          {currentStep === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Request Type Selection */}
              <Card className="shadow-md border-slate-200">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-blue-600">
                    <Server className="w-5 h-5" />
                    <CardTitle className="text-lg">Select Request Type</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {REQUEST_TYPES.map((type) => {
                      const Icon = type.icon;
                      return (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => {
                            setRequestType(type.value);
                            setCurrentStep(1);
                          }}
                          className={`p-6 rounded-xl border-2 transition-all duration-200 text-left hover:shadow-md ${
                            requestType === type.value
                              ? "border-blue-600 bg-blue-50"
                              : "border-slate-200 hover:border-blue-300"
                          }`}
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                              <Icon className="w-6 h-6 text-blue-600" />
                            </div>
                          </div>
                          <h4 className="font-semibold text-slate-900">{type.label}</h4>
                          <p className="text-sm text-slate-500 mt-1">{type.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
          
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Source VM Selector for Clone */}
              {requestType === "CLONE_VM" && (
                <Card className="shadow-md border-blue-200 bg-blue-50/20">
                  <CardHeader className="bg-blue-50/50 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-blue-600">
                      <Layers className="w-5 h-5" />
                      <CardTitle className="text-lg">Select Source VM to Clone</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-6">
                    <div className="space-y-2">
                      <Label className="text-blue-855 font-semibold">Source VM *</Label>
                      <Select value={sourceVmId} onValueChange={handleSourceVmChange} required>
                        <SelectTrigger className="border-blue-300">
                          <SelectValue placeholder="Select one of your active VMs to clone" />
                        </SelectTrigger>
                        <SelectContent>
                          {cloneableVms.length === 0 ? (
                            <SelectItem value="none" disabled>No active VMs available to clone</SelectItem>
                          ) : (
                            cloneableVms.map((vm) => (
                              <SelectItem key={vm.id} value={vm.id}>
                                {vm.hostname || vm.request?.systemName || "Unnamed VM"} — {vm.ipAddress} ({vm.environment || "N/A"})
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-blue-100 mt-4">
                      <Checkbox 
                        id="cloneFullDisk" 
                        checked={cloneFullDisk} 
                        onCheckedChange={(c) => setCloneFullDisk(!!c)} 
                      />
                      <Label htmlFor="cloneFullDisk" className="text-sm font-semibold text-blue-900 cursor-pointer select-none">
                        Confirm full disk clone of the source VM
                      </Label>
                    </div>
                  </CardContent>
                </Card>
              )}



              {/* Target VM Selector for Access Request */}
              {(requestType === "VPN_ACCESS" || requestType === "HORIZON_ACCESS") && (
                <Card className="shadow-md border-emerald-200 bg-emerald-50/20">
                  <CardHeader className="bg-emerald-50/50 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-emerald-600">
                      <ShieldCheck className="w-5 h-5" />
                      <CardTitle className="text-lg">Select Target VM for Access</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-6">
                    <div className="space-y-2">
                      <Label className="text-emerald-855 font-semibold">Target VM *</Label>
                      <Select value={accessTargetVmId} onValueChange={handleAccessVmChange} required>
                        <SelectTrigger className="border-emerald-300">
                          <SelectValue placeholder="Select one of your active VMs to request access" />
                        </SelectTrigger>
                        <SelectContent>
                          {accessableVms.length === 0 ? (
                            <SelectItem value="none" disabled>No active VMs available</SelectItem>
                          ) : (
                            accessableVms.map((vm) => (
                              <SelectItem key={vm.id} value={vm.id}>
                                {vm.hostname || vm.request?.systemName || "Unnamed VM"} — {vm.ipAddress} ({vm.environment || "N/A"})
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              )}


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
                  <div className="space-y-2">
                    <Label>Expected Delivery Date</Label>
                    <Input name="expectedDeliveryDate" type="date" defaultValue={prefillData?.expectedDeliveryDate ? new Date(prefillData.expectedDeliveryDate).toISOString().split('T')[0] : ""} />
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
              {requestType === "K8S_NAMESPACE" ? (
                <Card className="shadow-md border-indigo-200 bg-indigo-50/20">
                  <CardHeader className="bg-indigo-50/50 border-b border-indigo-100 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2 text-indigo-600">
                      <Code className="w-5 h-5" />
                      <CardTitle className="text-lg">Kubernetes Node Specifications</CardTitle>
                    </div>
                    <Button 
                      type="button" 
                      onClick={() => setK8sNodeGroups([...k8sNodeGroups, { role: "WORKER", nodeCount: 1, vcpu: 2, ramGb: 4, storageGb: 50 }])}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 h-8 px-3 rounded-lg"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Node Group
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-6">
                    {k8sNodeGroups.length === 0 ? (
                      <div className="text-center py-6 text-sm text-slate-500 italic bg-white rounded-lg border border-slate-100">
                        No node groups defined. Please add at least one group.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {k8sNodeGroups.map((group, index) => (
                          <div key={index} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4 relative">
                            <button 
                              type="button"
                              onClick={() => setK8sNodeGroups(k8sNodeGroups.filter((_, idx) => idx !== index))}
                              className="absolute top-4 right-4 text-red-500 hover:text-red-700 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                              <div className="space-y-1.5">
                                <Label className="text-xs text-slate-500 font-bold uppercase">Node Role</Label>
                                <Select 
                                  value={group.role} 
                                  onValueChange={(val) => {
                                    const updated = [...k8sNodeGroups];
                                    updated[index].role = val;
                                    setK8sNodeGroups(updated);
                                  }}
                                >
                                  <SelectTrigger className="h-9">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="MASTER">Master Node</SelectItem>
                                    <SelectItem value="WORKER">Worker Node</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs text-slate-500 font-bold uppercase">Node Count</Label>
                                <Input 
                                  type="number" 
                                  value={group.nodeCount} 
                                  onChange={(e) => {
                                    const updated = [...k8sNodeGroups];
                                    updated[index].nodeCount = parseInt(e.target.value) || 1;
                                    setK8sNodeGroups(updated);
                                  }}
                                  min="1" 
                                  max="20"
                                  className="h-9"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs text-slate-500 font-bold uppercase">vCPU Cores</Label>
                                <Input 
                                  type="number" 
                                  value={group.vcpu} 
                                  onChange={(e) => {
                                    const updated = [...k8sNodeGroups];
                                    updated[index].vcpu = parseInt(e.target.value) || 1;
                                    setK8sNodeGroups(updated);
                                  }}
                                  min="1" 
                                  max="64"
                                  className="h-9"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs text-slate-500 font-bold uppercase">RAM (GB)</Label>
                                <Input 
                                  type="number" 
                                  value={group.ramGb} 
                                  onChange={(e) => {
                                    const updated = [...k8sNodeGroups];
                                    updated[index].ramGb = parseInt(e.target.value) || 1;
                                    setK8sNodeGroups(updated);
                                  }}
                                  min="1" 
                                  max="256"
                                  className="h-9"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs text-slate-500 font-bold uppercase">Storage (GB)</Label>
                                <Input 
                                  type="number" 
                                  value={group.storageGb} 
                                  onChange={(e) => {
                                    const updated = [...k8sNodeGroups];
                                    updated[index].storageGb = parseInt(e.target.value) || 1;
                                    setK8sNodeGroups(updated);
                                  }}
                                  min="10" 
                                  max="2000"
                                  className="h-9"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
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
                  {/* Access Request Read-Only Specs Card */}
                  {(requestType === "VPN_ACCESS" || requestType === "HORIZON_ACCESS") && accessTargetVmId && (
                    <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl mb-6">
                      <h4 className="text-xs font-bold text-emerald-800 mb-2 uppercase tracking-wide">VM Specifications (Read-Only)</h4>
                      <p className="text-xs text-slate-500 mb-3">Access will be configured for the VM with the following specifications:</p>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="bg-white p-2 rounded-lg border border-emerald-100">
                          <div className="text-[10px] text-slate-500 uppercase font-semibold">vCPU Cores</div>
                          <div className="text-sm font-bold text-slate-800">{vcpuValue} Cores</div>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-emerald-100">
                          <div className="text-[10px] text-slate-500 uppercase font-semibold">Memory (RAM)</div>
                          <div className="text-sm font-bold text-slate-800">{ramValue} GB</div>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-emerald-100">
                          <div className="text-[10px] text-slate-500 uppercase font-semibold">Disk Storage</div>
                          <div className="text-sm font-bold text-slate-800">{storageValue} GB</div>
                        </div>
                      </div>
                    </div>
                  )}

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
                  </div>
                </CardContent>
              </Card>
              )}
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
              disabled={currentStep === (isEditOrCopy ? 1 : 0) || isSubmitting}
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
        </>
      )}
    </div>
  );
}