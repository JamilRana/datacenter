//src/types/inventory.ts
import { AssetType, VmStatus } from "@prisma/client";

export type AssetFormData = 
  | ServerFormData
  | RouterFormData
  | SwitchFormData
  | FirewallFormData
  | StorageFormData
  | OtherAssetFormData;

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
  graphicsCardModel: string | null;
  graphicsCardSpec: string | null;
  interfaces: number | null;
  throughputGbps: number | null;
  vlanSupport: boolean | null;
  capacityTb: number | null;
  noOfDisks: number | null;
  details: Record<string, unknown> | null;
  createdAt: string | Date;
  warrantyExpiry: Date | string | null;
  clusterId?: string | null;
  cluster?: { id: string; name: string } | null;
}

export interface License {
    name: string;
    id: string;
    createdAt: string | Date;
    updatedAt: string | Date;
    type: string;
    vendor: string;
    expiryDate: Date | null;
    maintenanceExpiry: Date | null;
    notes: string | null;
}

export interface SoftwareLicense {
  id: string;
  name: string;
  vendor: string | null;
  expiryDate?: string | null|Date;
  maintenanceExpiry?: string | null|Date;
  type: string;
  notes?: string | null;
  assets?: { id: string; name: string; type: string; serial: string | null }[];
}

export interface FilterState {
  assetType: AssetType | "all";
  status: VmStatus |"all";
  search: string;
}

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  vendor: string | null;
  model: string | null;
  serial: string | null;
  location: string | null;
  warrantyExpiry: Date | string | null;
  cpuCores: number | null;
  ramGb: number | null;
  storageGb: number | null;
  graphicsCardModel: string | null;
  graphicsCardSpec: string | null;
  interfaces: number | null;
  throughputGbps: number | null;
  vlanSupport: boolean | null;
  capacityTb: number | null;
  noOfDisks: number | null;
}

