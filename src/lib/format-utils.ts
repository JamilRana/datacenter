// src/lib/format-utils.ts
import { format } from "date-fns";

/**
 * Auto-scales RAM (in GB) to GB or TB with sensible precision.
 * e.g., 512 -> "512 GB", 1024 -> "1 TB", 1536 -> "1.5 TB", 2048 -> "2 TB".
 * If value is missing or null, returns fallback ("—").
 * Never renders "0.00 TB".
 */
export function autoScaleRam(ramGb: number | null | undefined, fallback: string = "—"): string {
  if (ramGb === null || ramGb === undefined || isNaN(ramGb)) {
    return fallback;
  }
  if (ramGb === 0) {
    return "0 GB";
  }
  if (ramGb >= 1024) {
    const tb = ramGb / 1024;
    const formatted = Number(tb.toFixed(2)).toString();
    return `${formatted} TB`;
  }
  return `${ramGb} GB`;
}

/**
 * Auto-scales Storage (in GB) to GB or TB with sensible precision.
 * e.g., 250 -> "250 GB", 1024 -> "1 TB", 2500 -> "2.44 TB".
 * Never renders "0.00 TB".
 */
export function autoScaleStorage(storageGb: number | null | undefined, fallback: string = "—"): string {
  if (storageGb === null || storageGb === undefined || isNaN(storageGb)) {
    return fallback;
  }
  if (storageGb === 0) {
    return "0 GB";
  }
  if (storageGb >= 1024) {
    const tb = storageGb / 1024;
    const formatted = Number(tb.toFixed(2)).toString();
    return `${formatted} TB`;
  }
  return `${storageGb} GB`;
}

/**
 * Formats a date range into an unambiguous format.
 * e.g. "14 Sep – 13 Oct 2026" or "25 Dec 2025 – 10 Jan 2026"
 */
export function formatDateRangeUnambiguous(from: Date, to: Date): string {
  const fromYear = from.getFullYear();
  const toYear = to.getFullYear();

  if (fromYear === toYear) {
    return `${format(from, "dd MMM")} – ${format(to, "dd MMM yyyy")}`;
  }
  return `${format(from, "dd MMM yyyy")} – ${format(to, "dd MMM yyyy")}`;
}

/**
 * Formats a date in Asia/Dhaka or unambiguous format: "13 Oct 2026, 14:02"
 */
export function formatDateDhaka(date: Date | string | null | undefined): string {
  if (!date) return "N/A";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "N/A";
  return format(d, "dd MMM yyyy, HH:mm");
}

/**
 * Generates standardized export filename including report name and date range:
 * e.g. vm-inventory_2026-09-14_to_2026-10-13.xlsx
 */
export function getReportFilename(
  reportName: string,
  from?: Date,
  to?: Date,
  ext: "xlsx" | "csv" = "xlsx"
): string {
  const cleanName = reportName.toLowerCase().replace(/[^a-z0-9_-]/g, "_").replace(/_+/g, "_");
  const fromStr = from ? format(from, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
  const toStr = to ? format(to, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
  return `${cleanName}_${fromStr}_to_${toStr}.${ext}`;
}
