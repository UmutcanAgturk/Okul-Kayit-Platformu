/**
 * demo/seviye360-app.html'deki svgHBarChart()'ın React karşılığı — kategorik
 * büyüklükler (ders/kazanım bazlı ortalama, şube ciro sıralaması vb.) için
 * yatay çubuk grafik.
 */
export interface HBarRow {
  label: string;
  value: number;
  sub?: string;
  tone?: "critical" | "weak" | "strong" | "accent" | null;
  /** value/unit yerine gösterilecek biçimlendirilmiş metin (ör. para birimi) */
  valueLabel?: string;
}

const TONE_COLOR: Record<string, string> = {
  critical: "var(--critical)",
  weak: "var(--weak)",
  strong: "var(--strong)",
  accent: "var(--accent)",
};

export function HBarChart({ rows, max, unit = "" }: { rows: HBarRow[]; max?: number; unit?: string }) {
  if (!rows || rows.length === 0) {
    return <p style={{ color: "var(--ink-faint)", fontSize: "12.5px", margin: 0 }}>Bu kapsamda henüz veri yok.</p>;
  }
  const maxVal = max || Math.max(...rows.map((r) => r.value), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {rows.map((r, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
            <span>{r.label}</span>
            <span style={{ color: "var(--ink-faint)", fontVariantNumeric: "tabular-nums" }}>
              {r.valueLabel ?? `${r.value}${unit}`}{r.sub ? ` · ${r.sub}` : ""}
            </span>
          </div>
          <div style={{ height: 10, borderRadius: 5, background: "var(--surface-sunken)", overflow: "hidden" }}>
            <div
              style={{
                height: "100%", borderRadius: 5,
                width: `${Math.max(3, Math.round((r.value / maxVal) * 100))}%`,
                background: r.tone ? TONE_COLOR[r.tone] : "var(--brand)",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
