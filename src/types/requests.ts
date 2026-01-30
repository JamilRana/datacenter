// src/types/requests.ts
import { 
  RequestStatus, 
  RequestType, 
  Environment, 
  NetworkAccess,
  Raid,Approval as PrismaApproval,
  VmInstance as PrismaVmInstance,
} from "@prisma/client";

export interface Approval {
  id: string;
  level: string;
  approverId: string;
  decision: string;
  comments: string | null;
  approver?: {
     name: string;
  };
}

export interface Person {
  name: string;
  designation: string;
  organization: string;
  contact: string;
  email: string;
}

export interface AdditionalDisk {
  sizeGb: string;
  purpose: string;
}

export interface FirewallPort {
  port: string;
  protocol: "TCP" | "UDP" | "OTHER";
  purpose: string;
  source?: string;
}

export interface Developer {
  name: string;
  address: string;
  contact: string;
  email: string;
}

export interface RequestDetailsData {
  id: string;
  systemName: string;
  projectName?: string | null;
  purpose: string;
  environment: Environment;
  expectedEndDate?: string;
  
  // People
  responsiblePerson: Person;
  alternativePerson: Person;
  developer: Developer;
  
  // Tech Stack
  frontendTech?: string | null;
  backendTech?: string | null;
  dataBase?: string | null;
  serverArchitecture?: string | null;
  additionalTechNotes?: string | null;
  
  // VM Spec
  quantity: number;
  vcpu?: number | null;        // ✅
  ramGb?: number | null;       // ✅
  storageGb?: number | null;    // ✅
  osName?: string | null;
  osVersion?: string | null;
  subdomain?: string | null;
  raid: Raid;
  sslProvider?: string | null;
  sslCostPaidBy?: string | null;
  
  // Network & Security
  requiredPublicIP: boolean;
  vpnRequired: boolean;
  networkAccess: NetworkAccess[];
  additionalDisks: AdditionalDisk[];
  firewallPorts: FirewallPort[];
  
  // Compliance
  vaReportSubmitted: boolean;
  justificationSubmitted: boolean;
  renewalRequired: boolean;
  renewalPeriodMonths?: number | null; // ✅
  
  // Status
  status: RequestStatus;
  requestType: RequestType;
  
  // Relations
  approvals: PrismaApproval[];
    vmInstances: Array<
    Pick<PrismaVmInstance, 
      'id' | 'hostname' | 'ipAddress' | 'status' | 'provisionedAt'
    > & {
      owner: { name: string | null; email: string | null } | null;
      request: { environment: string | null; systemName: string | null } | null;
      currentSpec: { vcpu: number | null; ramGb: number | null; storageGb: number | null } | null;
    }
  >;
  targetVm: TargetVmSummary | null;  
  submittedAt?: string;
}


export interface TargetVmSummary {
  id: string;
  hostname: string | null;
  ipAddress: string | null;
  status: "ACTIVE" | "SUSPENDED" | "RETIRED";
  provisionedAt: Date | null;
  owner: {
    name: string | null;
    email: string | null;
  } | null;
  request: {
    environment: string | null;
    systemName: string | null;
  } | null;
  currentSpec: {
    vcpu: number | null;
    ramGb: number | null;
    storageGb: number | null;
  } | null;
}


export interface VmInstance {
  id: string;
  hostname: string | null;
  ipAddress: string | null;
  status?: string;
}