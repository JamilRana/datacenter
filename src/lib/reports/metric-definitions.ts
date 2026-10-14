// src/lib/reports/metric-definitions.ts
/**
 * Canonical Metric Definitions Metadata
 * Shared safely between Server Actions and Client Components.
 *
 * Metric Definitions:
 * - Active VMs: status = ACTIVE and decommissionedAt null, as of now (No date range)
 * - Total vCPU / RAM / Storage: Sum of effective spec over Active VMs (No date range)
 * - Total Users: Distinct VM owners (in scope) with at least one Active VM (No date range)
 * - VMs provisioned in period: provisionedAt within range (Uses date range)
 * - Requests submitted in period: submittedAt within range (Uses date range)
 * - Requests approved/rejected/provisioned: Counted by status and by decision date within range (Uses date range)
 * - Approval turnaround: Approval.decidedAt - Approval.createdAt, per level, for decided approvals within range (Uses date range)
 * - Lifecycle: request to provision: provisionedAt - submittedAt (Uses date range)
 */

export const METRIC_DEFINITIONS = {
  activeVms: {
    label: "Active VMs",
    definition: "Virtual machines currently running with status ACTIVE and decommissionedAt null as of now.",
    periodType: "Current" as const,
    usesDateRange: false,
  },
  totalVcpu: {
    label: "Total vCPU",
    definition: "Sum of effective vCPU cores allocated over Active VMs as of now.",
    periodType: "Current" as const,
    usesDateRange: false,
  },
  totalRam: {
    label: "RAM Allocated",
    definition: "Sum of effective RAM (GB) allocated over Active VMs as of now.",
    periodType: "Current" as const,
    usesDateRange: false,
  },
  totalStorage: {
    label: "Storage Allocated",
    definition: "Sum of effective storage disk capacity (GB) allocated over Active VMs as of now.",
    periodType: "Current" as const,
    usesDateRange: false,
  },
  totalUsers: {
    label: "Total Users",
    definition: "Count of distinct tenant owners in scope with at least one Active VM.",
    periodType: "Current" as const,
    usesDateRange: false,
  },
  vmsProvisioned: {
    label: "VMs Provisioned",
    definition: "Count of virtual machines with provisionedAt within the selected date range.",
    periodType: "In selected period" as const,
    usesDateRange: true,
  },
  requestsSubmitted: {
    label: "Requests Submitted",
    definition: "Total requests submitted within the selected date range.",
    periodType: "In selected period" as const,
    usesDateRange: true,
  },
  requestsDecided: {
    label: "Requests Decided",
    definition: "Requests approved, rejected, or provisioned within the selected date range.",
    periodType: "In selected period" as const,
    usesDateRange: true,
  },
  turnaroundHours: {
    label: "Approval Turnaround",
    definition: "Average duration (in hours) between approval request creation and final decision per approval level.",
    periodType: "In selected period" as const,
    usesDateRange: true,
  },
  lifecycleDays: {
    label: "Request to Provision Lifecycle",
    definition: "Average turnaround time (in days) from request submission to completed VM provisioning.",
    periodType: "In selected period" as const,
    usesDateRange: true,
  },
} as const;

export type MetricKey = keyof typeof METRIC_DEFINITIONS;
