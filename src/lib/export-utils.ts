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
