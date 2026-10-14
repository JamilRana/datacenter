// src/lib/export-utils.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export function exportToCsv<T extends Record<string, unknown>>(
  filename: string,
  rows: T[]
) {
  if (!rows || !rows.length) {
    toast.error("No data available to export");
    return;
  }

  const ensureFilename = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  const separator = ",";
  const keys = Object.keys(rows[0]) as (keyof T)[];
  const csvContent = [
    keys.join(separator),
    ...rows.map((row) =>
      keys
        .map((key) => {
          const cell = row[key];
          const safeCell = cell === null || cell === undefined ? "" : cell;
          const stringCell = typeof safeCell === "string" ? safeCell : String(safeCell);
          return `"${stringCell.replace(/"/g, '""')}"`;
        })
        .join(separator)
    ),
  ].join("\n");

  // Include UTF-8 BOM (\uFEFF) so Excel parses Unicode and symbols correctly
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", ensureFilename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

// Alias for exportToCsv
export const exportToCSV = exportToCsv;

export interface ExcelSheetData {
  name: string;
  data: Record<string, unknown>[];
}

export interface ExcelExportOptions {
  sheetName?: string;
  sheets?: ExcelSheetData[];
  metadata?: {
    reportTitle?: string;
    dateRange?: string;
    scope?: string;
    generatedAt?: string;
    filters?: Record<string, string | number | undefined | null>;
    definitions?: Record<string, string>;
  };
}

export async function exportToExcel(
  filename: string,
  rows: Record<string, unknown>[],
  options?: ExcelExportOptions
) {
  if ((!rows || !rows.length) && (!options?.sheets || !options.sheets.length)) {
    toast.error("No data available to export");
    return;
  }

  // Ensure filename has .xlsx extension
  let ensureFilename = filename;
  if (ensureFilename.endsWith(".xls")) {
    ensureFilename = ensureFilename.replace(/\.xls$/, ".xlsx");
  } else if (!ensureFilename.endsWith(".xlsx")) {
    ensureFilename = `${ensureFilename}.xlsx`;
  }

  // Create real SheetJS OpenXML workbook
  const workbook = XLSX.utils.book_new();

  // Helper to auto-fit column widths
  const autoFitColumns = (data: Record<string, unknown>[]) => {
    if (!data.length) return [];
    const keys = Object.keys(data[0]);
    return keys.map((key) => {
      let maxLen = key.length;
      for (const row of data) {
        const val = row[key];
        if (val !== null && val !== undefined) {
          const str = String(val);
          if (str.length > maxLen) {
            maxLen = Math.min(str.length, 60);
          }
        }
      }
      return { wch: Math.max(maxLen + 3, 12) };
    });
  };

  // 1. Primary Sheet
  if (rows && rows.length > 0) {
    const primarySheetName = (options?.sheetName || "Data").slice(0, 31);
    const primaryWorksheet = XLSX.utils.json_to_sheet(rows);
    primaryWorksheet["!cols"] = autoFitColumns(rows);
    XLSX.utils.book_append_sheet(workbook, primaryWorksheet, primarySheetName);
  }

  // 2. Extra Sheets (if provided)
  if (options?.sheets && options.sheets.length > 0) {
    for (const extraSheet of options.sheets) {
      if (extraSheet.data && extraSheet.data.length > 0) {
        const cleanSheetName = extraSheet.name.slice(0, 31);
        const ws = XLSX.utils.json_to_sheet(extraSheet.data);
        ws["!cols"] = autoFitColumns(extraSheet.data);
        XLSX.utils.book_append_sheet(workbook, ws, cleanSheetName);
      }
    }
  }

  // 3. Metadata / Summary Sheet (if provided)
  if (options?.metadata) {
    const meta = options.metadata;
    const metaRows: Array<Record<string, unknown>> = [
      { "Report Property": "Report Title", "Details": meta.reportTitle || "Report" },
    ];
    if (meta.dateRange) {
      metaRows.push({ "Report Property": "Date Range", "Details": meta.dateRange });
    }
    if (meta.scope) {
      metaRows.push({ "Report Property": "User Scope", "Details": meta.scope });
    }
    metaRows.push({ "Report Property": "Generated At", "Details": meta.generatedAt || new Date().toISOString() });
    metaRows.push({ "Report Property": "Total Records", "Details": rows ? rows.length : 0 });

    if (meta.filters && Object.keys(meta.filters).length > 0) {
      metaRows.push({ "Report Property": "--- ACTIVE FILTERS ---", "Details": "" });
      for (const [fKey, fVal] of Object.entries(meta.filters)) {
        if (fVal !== undefined && fVal !== null && fVal !== "") {
          metaRows.push({ "Report Property": fKey, "Details": String(fVal) });
        }
      }
    }

    if (meta.definitions && Object.keys(meta.definitions).length > 0) {
      metaRows.push({ "Report Property": "--- METRIC DEFINITIONS ---", "Details": "" });
      for (const [dKey, dVal] of Object.entries(meta.definitions)) {
        metaRows.push({ "Report Property": dKey, "Details": dVal });
      }
    }

    const metaWorksheet = XLSX.utils.json_to_sheet(metaRows);
    metaWorksheet["!cols"] = [{ wch: 25 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(workbook, metaWorksheet, "Filter Summary");
  }

  // Write genuine OpenXML .xlsx binary data
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], { 
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
  });

  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", ensureFilename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export function exportToPdf(
  filename: string,
  title: string,
  headers: string[],
  data: Record<string, any>[]
) {
  try {
    if (!data || data.length === 0) {
      toast.error('No data to export');
      return;
    }

    const keys = Object.keys(data[0]);
    const headerRow = headers.map(h => `<th style="border:1px solid #ddd;padding:8px;background:#f5f5f5;text-align:left">${h}</th>`).join('');
    const rows = data.map(row =>
      `<tr>${keys.map(k => `<td style="border:1px solid #ddd;padding:8px">${row[k] ?? ''}</td>`).join('')}</tr>`
    ).join('');

    const html = `<!DOCTYPE html><html><head><title>${title}</title>
      <style>body{font-family:Arial,sans-serif;margin:20px}table{border-collapse:collapse;width:100%}h1{color:#333}</style>
      </head><body><h1>${title}</h1><p>Generated: ${new Date().toLocaleString()}</p>
      <table><thead><tr>${headerRow}</tr></thead><tbody>${rows}</tbody></table></body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.html`;
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success(`Exported to HTML/PDF`);
  } catch (error) {
    console.error('Export failed:', error);
    toast.error('Failed to export data');
  }
}
