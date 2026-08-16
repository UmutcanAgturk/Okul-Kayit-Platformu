/**
 * demo/seviye360-app.html'deki svgLineChart()'ın React karşılığı — tek seri
 * trend çizgisi (ör. devamsızlık %, net ortalama). Gerçek 2+ veri noktası
 * yoksa çizilmez, uydurma bir eğri gösterilmez.
 */
export interface ChartPoint {
  label: string;
  value: number;
}

export function LineChart({
  points,
  color = "var(--brand)",
  height = 150,
  unit = "",
  zeroBase = false,
}: {
  points: ChartPoint[];
  color?: string;
  height?: number;
  unit?: string;
  zeroBase?: boolean;
}) {
  if (!points || points.length < 2) {
    return <p style={{ color: "var(--ink-faint)", fontSize: "12.5px", margin: 0 }}>Trend çizilebilmesi için en az 2 gerçek veri noktası gerekir.</p>;
  }

  const w = 400, h = 100, padL = 24, padR = 24, padT = 14, padB = 18;
  const vals = points.map((p) => p.value);
  const min = zeroBase ? Math.min(0, ...vals) : Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const stepX = innerW / (points.length - 1);
  const pts = points.map((p, i) => ({ x: padL + i * stepX, y: padT + innerH * (1 - (p.value - min) / range), ...p }));
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${pts[pts.length - 1].x.toFixed(1)},${(padT + innerH).toFixed(1)} L${pts[0].x.toFixed(1)},${(padT + innerH).toFixed(1)} Z`;
  const first = pts[0];
  const last = pts[pts.length - 1];

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={height} preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
        <line x1={padL} y1={padT + innerH} x2={w - padR} y2={padT + innerH} stroke="var(--border)" strokeWidth={0.6} />
        <path d={areaPath} fill={color} opacity={0.1} stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.4} fill={color}>
            <title>{p.label}: {p.value}{unit}</title>
          </circle>
        ))}
        <text x={first.x} y={first.y - 4} fontSize={6} textAnchor="start" fill="var(--ink-muted)">{first.value}{unit}</text>
        <text x={last.x} y={last.y - 4} fontSize={6} textAnchor="end" fill="var(--ink)">{last.value}{unit}</text>
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--ink-faint)", marginTop: 2 }}>
        <span>{first.label}</span>
        <span>{last.label}</span>
      </div>
    </div>
  );
}
