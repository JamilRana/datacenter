// types/request-form.ts
import { RequestStatus, Environment, NetworkAccess, Raid, SSLProvider, LicenseProvider } from "@prisma/client";

export interface Person {
  name: string;
  designation: string;
  organization: string;
  contact: string;
  email: string;
  address?: string | null;
}

export interface AdditionalDisk {
  sizeGb: string;
  purpose?: string;
}

export interface FirewallPort {
  port: string;
  protocol: "TCP" | "UDP" | "OTHER";
  purpose?: string;
  source?: string;
}

export interface RequestData {
  id?: string;
  systemName: string;
  projectName?: string;
  purpose: string;
  environment: Environment;
  expectedEndDate?: string;

  responsiblePerson: Person;
  alternativePerson: Person;
  developer: Person;

  frontendTech?: string;
  backendTech?: string;
  dataBase?: string;
  serverArchitecture?: string;
  additionalTechNotes?: string;

  quantity: string;
  vcpu?: string;
  ramGb?: string;
  storageGb?: string;
  osName?: string;
  osVersion?: string;
  subdomain?: string;
  raid: Raid;
  osLicenseBy?: LicenseProvider;
  sslProvider: SSLProvider;
  sslCostPaidBy?: string;

  requiredPublicIP: boolean;
  vpnRequired: boolean;
  networkAccess: NetworkAccess[];
  additionalDisks: AdditionalDisk[];
  firewallPorts: FirewallPort[];

  renewalRequired: boolean;
  renewalPeriodMonths?: string;

  requestType: "NEW_VM" | "CLONE_VM" | "CUSTOMIZED" | "DECOMMISSION" |"RENEWAL";
  targetVmId?: string | null;
  status?: RequestStatus;

  vaReportSubmitted: boolean;
  justificationSubmitted: boolean;
}