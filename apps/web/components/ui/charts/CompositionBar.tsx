/**
 * demo/seviye360-app.html'deki compositionBarHtml()'in React karşılığı —
 * bir bütünün (öğrenci sonuçları, kazanım ustalık seviyeleri vb.) yüzdesel
 * dağılımını tek bir yatay çubukta ve altında renk lejantıyla gösterir.
 */
export interface CompositionSegment {
  label: string;
  value: number;
  color: string;
}

export function CompositionBar({ segments }: { segments: CompositionSegment[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return <p style={{ color: "var(--ink-faint)", fontSize: "12.5px", margin: 0 }}>Bu kapsamda henüz veri yok.</p>;
  }

  return (
    <div>
      <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden" }}>
        {segments
          .filter((s) => s.value > 0)
          .map((s, i) => (
            <div key={i} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} title={`${s.label}: ${s.value}`} />
          ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
        {segments.map((s, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--ink-muted)" }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: s.color, display: "inline-block" }} />
            {s.label} · %{Math.round((s.value / total) * 100)}
          </span>
        ))}
      </div>
    </div>
  );
}
