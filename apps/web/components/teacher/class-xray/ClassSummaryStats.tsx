import type { ClassXRayResponse } from "@/types/xray";

interface ClassSummaryStatsProps {
  summary: ClassXRayResponse["classSummary"];
}

export function ClassSummaryStats({ summary }: ClassSummaryStatsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard label="Sınıf Ortalama Net" value={summary.averageNet.toString()} tone="neutral" />
      <StatCard
        label="Ortak Kritik Eksik"
        value={summary.weakestAchievement.label}
        subValue={`Sınıf ort. %${Math.round(summary.weakestAchievement.classAverageRatio * 100)}`}
        tone="critical"
      />
      <StatCard
        label="En Güçlü Kazanım"
        value={summary.strongestAchievement.label}
        subValue={`Sınıf ort. %${Math.round(summary.strongestAchievement.classAverageRatio * 100)}`}
        tone="strong"
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  subValue,
  tone,
}: {
  label: string;
  value: string;
  subValue?: string;
  tone: "neutral" | "critical" | "strong";
}) {
  const toneClass = {
    neutral: "border-border",
    critical: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40",
    strong: "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40",
  }[tone];

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
      {subValue && <p className="mt-0.5 text-sm text-muted-foreground">{subValue}</p>}
    </div>
  );
}
