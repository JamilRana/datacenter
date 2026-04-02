// src/lib/export-utils.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { toast } from 'sonner';

export function exportToCsv<T extends Record<string, unknown>>(
  filename: string,
  rows: T[]
) {
  if (!rows || !rows.length) return;

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

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// Alias for exportToCsv
export const exportToCSV = exportToCsv;

export async function exportToExcel(
  filename: string,
  rows: Record<string, unknown>[]
) {
  if (!rows || !rows.length) return;
  
  // Simple Excel XML format
  const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>';
  const workbook = '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
  const worksheet = '<Worksheet ss:Name="Sheet1">';
  const table = '<Table>';
  
  const keys = Object.keys(rows[0]);
  const headerRow = '<Row>' + keys.map(k => `<Cell><Data ss:Type="String">${k}</Data></Cell>`).join('') + '</Row>';
  const dataRows = rows.map(row => 
    '<Row>' + keys.map(k => {
      const cell = row[k];
      const value = cell === null || cell === undefined ? "" : String(cell);
      return `<Cell><Data ss:Type="String">${value.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Data></Cell>`;
    }).join('') + '</Row>'
  ).join('');
  
  const xml = xmlHeader + workbook + worksheet + table + headerRow + dataRows + '</Table></Worksheet></Workbook>';
  
  const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    URL.revokeObjectURL(url);
    
    toast.success(`Exported to HTML/PDF`);
  } catch (error) {
    console.error('Export failed:', error);
    toast.error('Failed to export data');
  }
}
