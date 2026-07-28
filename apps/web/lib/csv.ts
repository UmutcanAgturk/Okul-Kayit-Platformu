// demo'daki downloadCsv()'nin sunucu tarafı karşılığı — RFC 4180 basit kaçışlama
// (virgül/tırnak/satır sonu içeren hücreler çift tırnağa alınır).
function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(","));
  return lines.join("\n");
}
