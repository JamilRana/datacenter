import { Approval } from "./approvals";
import { Request } from "./requests";
import { CustomizationStatus, VmStatus, Environment } from "./enums";
import { Requester } from "./users";

export interface CustomizationRequest {
  id: string;
  parentRequestId?: string | null;
  parentRequest?: Request | null;

  targetVmId: string;
  targetVm: TargetVmSummary;

  vcpu?: number | null;
  ramGb?: number | null;
  storageGb?: number | null;
  purpose?: string | null;

  status: CustomizationStatus;

  createdAt: string;     // already string
  // updatedAt: string;     // ← CHANGE THIS
  submittedAt?: string | null;

  requester: Requester | null;

  resultingSpec?: VmSpec | null;

  additionalDisks: AdditionalDiskInput[];
  firewallPorts: FirewallPortInput[];
  networkAccess: NetworkAccessInput[];
  approvals: Approval[];
}


// export interface CustomizationRequest {
//   id: string;
//   parentRequestId?: string | null;
//   parentRequest?: Request | null;
  
//   targetVmId: string;
//   targetVm: TargetVmSummary;
  
//   // Requested changes
//   vcpu?: number | null;
//   ramGb?: number | null;
//   storageGb?: number | null;
//   purpose?: string | null;
  
//   status: CustomizationStatus;
//   createdAt: string;
//   updatedAt: Date;
//   submittedAt?: string | null;
  
//   requester: Requester | null;
  
//   // Applied spec (after approval)
//   resultingSpec?: VmSpec | null;
  
//   // Relations
//   additionalDisks: AdditionalDiskInput[];
//   firewallPorts: FirewallPortInput[];
//   networkAccess: NetworkAccessInput[];
//   approvals: Approval[];
// }

// Target VM summary for list views
export interface TargetVmSummary {
  id: string;
  hostname: string | null;
  ipAddress: string | null;
  publicIpAddress: string | null;
  status: VmStatus;
  renewalDate: Date | null;
  environment: Environment | null;
  hasRemoteAccess: boolean;
  vpnRequired: boolean;
  //updatedAt: Date;
  subdomain: string | null;
  currentSpec: {
    vcpu: number | null;
    ramGb: number | null;
    storageGb: number | null;
  } | null;
}

// Input types for customization requests
export interface AdditionalDiskInput {
  sizeGb: number;
  purpose?: string |null;
  sequence: number;
}

export interface FirewallPortInput {
  port: number;
  protocol: "TCP" | "UDP" | "OTHER";
  purpose?: string | null;
  source?: string |null;
}

export interface NetworkAccessInput {
  accessType: "LOCAL" | "INTERNET" | "REMOTE";
}


import { VmSpec } from "./vm";
