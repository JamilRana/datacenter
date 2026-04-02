// src/app/actions/analytics-actions.ts
"use server";

import { getVmAnalytics } from "@/lib/analytics/vmAnalytics";
import { getLicenseAnalytics } from "@/lib/analytics/licenseAnalytics";
import { getHardwareAnalytics } from "@/lib/analytics/hardwareAnalytics";
import { getAssetUtilization } from "@/lib/analytics/assetUtilization";

export async function fetchVmAnalytics() {
  try {
    return await getVmAnalytics();
  } catch (error) {
    console.error("Failed to fetch VM analytics:", error);
    throw error;
  }
}

export async function fetchLicenseAnalytics() {
  try {
    return await getLicenseAnalytics();
  } catch (error) {
    console.error("Failed to fetch license analytics:", error);
    throw error;
  }
}

export async function fetchHardwareAnalytics() {
  try {
    return await getHardwareAnalytics();
  } catch (error) {
    console.error("Failed to fetch hardware analytics:", error);
    throw error;
  }
}

export async function fetchAssetUtilization(assetId: string) {
  try {
    return await getAssetUtilization(assetId);
  } catch (error) {
    console.error("Failed to fetch asset utilization:", error);
    throw error;
  }
}
