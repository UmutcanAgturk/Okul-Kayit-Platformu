import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/** Bir başlık + tablo(lar)dan PDF üretip paylaşım sayfasını açar. */
export async function exportPdfReport(title: string, sections: { heading: string; headers: string[]; rows: (string | number)[][] }[]) {
  const style = `body{font-family:-apple-system,sans-serif;padding:24px;color:#111}
    h1{font-size:22px;margin:0 0 4px} .date{color:#666;font-size:12px;margin-bottom:16px}
    h2{font-size:15px;margin:18px 0 6px;border-bottom:2px solid #111;padding-bottom:4px}
    table{width:100%;border-collapse:collapse;font-size:12px} th{text-align:left;color:#666;padding:4px;border-bottom:1px solid #ccc}
    td{padding:4px;border-bottom:1px solid #eee}`;
  const body = sections.map((s) => `
    <h2>${s.heading}</h2>
    <table><thead><tr>${s.headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${s.rows.map((r) => `<tr>${r.map((c, i) => `<td${i > 0 ? ' style="text-align:right"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`).join('');
  const html = `<html><head><style>${style}</style></head><body>
    <h1>${title}</h1><div class="date">Seviye 360 · ${new Date().toLocaleDateString('tr-TR')}</div>${body}</body></html>`;
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
}
