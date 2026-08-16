/**
 * demo/seviye360-app.html'deki svgDualLineChart()'ın React karşılığı — iki
 * gerçek seriyi (ör. gelir/gider) aynı eksende karşılaştırır; dual-axis
 * kullanılmaz, ikisi de aynı ölçekte çizilir.
 */
export interface DualChartPoint {
  label: string;
  a: number;
  b: number;
}

export function DualLineChart({
  points,
  colorA = "var(--strong)",
  colorB = "var(--critical)",
  labelA = "A",
  labelB = "B",
  height = 160,
}: {
  points: DualChartPoint[];
  colorA?: string;
  colorB?: string;
  labelA?: string;
  labelB?: string;
  height?: number;
}) {
  if (!points || points.length < 2) {
    return <p style={{ color: "var(--ink-faint)", fontSize: "12.5px", margin: 0 }}>Trend çizilebilmesi için en az 2 gerçek veri noktası gerekir.</p>;
  }

  const w = 400, h = 100, padL = 24, padR = 24, padT = 14, padB = 18;
  const allVals = points.flatMap((p) => [p.a, p.b]);
  const min = Math.min(0, ...allVals);
  const max = Math.max(...allVals);
  const range = max - min || 1;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const stepX = innerW / (points.length - 1);
  const mk = (key: "a" | "b") =>
    points.map((p, i) => ({ x: padL + i * stepX, y: padT + innerH * (1 - (p[key] - min) / range), value: p[key], label: p.label }));
  const ptsA = mk("a");
  const ptsB = mk("b");
  const lineOf = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const lastA = ptsA[ptsA.length - 1];
  const lastB = ptsB[ptsB.length - 1];
  const aOnTop = lastA.y <= lastB.y;
  const labelAY = aOnTop ? lastA.y - 4 : lastA.y + 9;
  const labelBY = aOnTop ? lastB.y + 9 : lastB.y - 4;

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={height} preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
        <line x1={padL} y1={padT + innerH} x2={w - padR} y2={padT + innerH} stroke="var(--border)" strokeWidth={0.6} />
        <path d={lineOf(ptsA)} fill="none" stroke={colorA} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <path d={lineOf(ptsB)} fill="none" stroke={colorB} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {ptsA.map((p, i) => (
          <circle key={`a${i}`} cx={p.x} cy={p.y} r={2.2} fill={colorA}>
            <title>{p.label}: {Math.round(p.value).toLocaleString("tr-TR")}</title>
          </circle>
        ))}
        {ptsB.map((p, i) => (
          <circle key={`b${i}`} cx={p.x} cy={p.y} r={2.2} fill={colorB}>
            <title>{p.label}: {Math.round(p.value).toLocaleString("tr-TR")}</title>
          </circle>
        ))}
        <text x={lastA.x} y={labelAY} fontSize={6} textAnchor="end" fill="var(--ink)">{Math.round(lastA.value).toLocaleString("tr-TR")}</text>
        <text x={lastB.x} y={labelBY} fontSize={6} textAnchor="end" fill="var(--ink)">{Math.round(lastB.value).toLocaleString("tr-TR")}</text>
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--ink-faint)", marginTop: 2 }}>
        <span>{points[0].label}</span>
        <span>{points[points.length - 1].label}</span>
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--ink-muted)" }}>
          <span style={{ background: colorA, width: 10, height: 10, borderRadius: 3, display: "inline-block" }} />
          {labelA}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--ink-muted)" }}>
          <span style={{ background: colorB, width: 10, height: 10, borderRadius: 3, display: "inline-block" }} />
          {labelB}
        </span>
      </div>
    </div>
  );
}
