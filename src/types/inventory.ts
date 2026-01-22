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

// Form data types (Zod will validate these)
export interface ServerFormData {
  type: "SERVER";
  name: string;
  model: string;
  location: string;
  cpuCores: number;
  ramGb: number;
  storageGb: number;
  graphics?: string; // Optional
}

export interface RouterFormData {
  type: "ROUTER";
  name: string;
  model: string;
  location: string;
  interfaces: number;
  throughputGbps: number;
}

export interface SwitchFormData {
  type: "SWITCH";
  name: string;
  model: string;
  location: string;
  ports: number;
  portSpeedGbps: number;
  vlanSupport: boolean;
}

export interface FirewallFormData {
  type: "FIREWALL";
  name: string;
  model: string;
  location: string;
  throughputGbps: number;
  maxRules: number;
}

export interface StorageFormData {
  type: "STORAGE";
  name: string;
  model: string;
  location: string;
  capacityTb: number;
  raidType: "RAID0" | "RAID1" | "RAID5" | "RAID10" | "NONE";
}

export type AssetFormData =
  | ServerFormData
  | RouterFormData
  | SwitchFormData
  | FirewallFormData
  | StorageFormData;

export interface FilterState {
  assetType: AssetType | "all";
  status: "all" | "ACTIVE" | "SUSPENDED" | "RETIRED";
  search: string;
}

export interface VmInstance {
  id: string;
  hostname: string | null;
  ipAddress: string | null;
  vcpu: number | null;
  ramGb: number | null;
  storageGb: number | null;
  raid: string | null;
  status: "ACTIVE" | "SUSPENDED" | "RETIRED";
  createdAt: Date;
}

export interface License {
  id: string;
  name: string;
  vendor: string;
  type: string;
  expiryDate: Date | null;
  maintenanceExpiry: Date | null;
  notes: string | null;
}
