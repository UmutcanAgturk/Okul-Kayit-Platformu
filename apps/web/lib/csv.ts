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

// Toplu Yükleme (Normal Kayıt) için — RFC 4180 basit ayrıştırma (tırnaklı
// hücreler, kaçışlanmış çift tırnak, hem "," hem ";" ayırıcı — Excel'in
// Türkçe yerel ayarında CSV dışa aktarımı genelde ";" kullanır). Tarayıcıda
// çalışır, sunucuya dosya yüklenmez.
export function parseCsv(text: string): string[][] {
  const delimiter = text.slice(0, text.indexOf("\n")).includes(";") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}
