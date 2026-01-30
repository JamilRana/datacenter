// Asset types from your Prisma schema
// src/types/inventory.ts

export const ASSET_TYPES = [
  "SERVER",
  "ROUTER",
  "SWITCH",
  "FIREWALL",
  "STORAGE",
  "UPS",
  "CONSOLE_SERVER",
  "OTHER",
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];

export interface BaseAssetFormData {
  name: string;
  vendor: string;
  model: string;
  serial: string;
  location: string;
  warrantyExpiry?: string;
}

export interface ServerFormData extends BaseAssetFormData {
  type: "SERVER";
  cpuCores: number;
  ramGb: number;
  storageGb: number;
  graphicsCardModel?: string;
  graphicsCardSpec?: string;
}

export interface RouterFormData extends BaseAssetFormData {
  type: "ROUTER";
  interfaces: number;
  throughputGbps: number;
}

export interface SwitchFormData extends BaseAssetFormData {
  type: "SWITCH";
  interfaces: number;
  throughputGbps: number;
  vlanSupport: boolean;
}

export interface FirewallFormData extends BaseAssetFormData {
  type: "FIREWALL";
  interfaces: number;
  throughputGbps: number;
}

export interface StorageFormData extends BaseAssetFormData {
  type: "STORAGE";
  capacityTb: number;
}

export interface OtherAssetFormData extends BaseAssetFormData {
  type: "UPS" | "CONSOLE_SERVER" | "OTHER";
}

export type AssetFormData =
  | ServerFormData
  | RouterFormData
  | SwitchFormData
  | FirewallFormData
  | StorageFormData
  | OtherAssetFormData;

export interface AssetFormValues extends BaseAssetFormData {
  type: AssetType;
  cpuCores?: number;
  ramGb?: number;
  storageGb?: number;
  graphicsCardModel?: string;
  graphicsCardSpec?: string;
  interfaces?: number;
  throughputGbps?: number;
  vlanSupport?: boolean;
  capacityTb?: number;
}

export interface FilterState {
  assetType: AssetType | "all";
  status: "all" | "ACTIVE" | "SUSPENDED" | "RETIRED";
  search: string;
}

export interface VmInstance {
  id: string;
  hostname: string | null;
  sequenceNumber?: number;
  ipAddress: string | null;
  status: "ACTIVE" | "SUSPENDED" | "RETIRED";
  vmOsName?: string;
  vmOsVersion?: string;
  owner: { id: string; name: string | null; email: string | null } | null;
  request: {requestId: string | null; environment: string | null; systemName: string | null } | null;
  currentSpec: {
    vcpu: number | null;
    ramGb: number | null;
    storageGb: number | null;
  } | null;
  provisionedAt: Date | string | null;
  specHistory: VmSpecHistory[] | null;
  auditLogs: VmAuditLog[] | null;
}

export interface PhysicalAsset {
  id: string;
  name: string;
  serial: string | null;
  type: AssetType;
  vendor: string | null;
  model: string | null;
  location: string | null;
  cpuCores: number | null;
  ramGb: number | null;
  storageGb: number | null;
  createdAt: Date | string;
}

export interface EnrollmentLicense {
  id: string;
  name: string;
  vendor: string;
  type: string;
  expiryDate: Date | string | null;
  maintenanceExpiry: Date | string | null;
  notes: string | null;
  usedSeats?: number;
  totalSeats?: number;
  assets?: { id: string; name: string; type: string; serial: string | null }[];
}

export interface VmSpecHistory {
  id: string;
  createdAt: Date | string;
  vcpu: number;
  ramGb: number;
  storageGb: number;
  sourceRequestId: string | null;
}

export interface VmAuditLog {
  id: string;
  timestamp: Date | string;
  action: string;
  actorId: string;
}


export interface ResourceChartData {
  date: string;
  cpu: number;
  ram: number;
  storage: number;
  network: number;
}


export interface  AssetTypes {
    SERVER: "SERVER";
    ROUTER: "ROUTER";
    SWITCH: "SWITCH";
    FIREWALL: "FIREWALL";
    STORAGE: "STORAGE";
    UPS: "UPS";
    CONSOLE_SERVER: "CONSOLE_SERVER";
    OTHER: "OTHER";
}