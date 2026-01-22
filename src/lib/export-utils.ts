export function exportToCsv(filename: string, rows: object[]) {
  if (!rows || !rows.length) return;

  const separator = ",";
  const keys = Object.keys(rows[0]);
  const csvContent = [
    keys.join(separator),
    ...rows.map((row: any) =>
      keys
        .map((key) => {
          const cell = row[key] === null || row[key] === undefined ? "" : row[key];
          const stringCell = typeof cell === "string" ? cell : JSON.stringify(cell);
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
