import type { ClassXRayResponse } from "@/types/xray";

interface ClassSummaryStatsProps {
  summary: ClassXRayResponse["classSummary"];
}

export function ClassSummaryStats({ summary }: ClassSummaryStatsProps) {
  return (
    <div className="grid cols-3">
      <div className="card stat-card">
        <p className="stat-label">Sınıf Ortalama Net</p>
        <p className="stat-value">{summary.averageNet}</p>
      </div>
      <div className="card stat-card tone-critical">
        <p className="stat-label">Ortak Kritik Eksik</p>
        <p className="stat-value" style={{ fontSize: "var(--text-md)" }}>{summary.weakestAchievement.label}</p>
        <p className="stat-sub">Sınıf ort. %{Math.round(summary.weakestAchievement.classAverageRatio * 100)}</p>
      </div>
      <div className="card stat-card tone-strong">
        <p className="stat-label">En Güçlü Kazanım</p>
        <p className="stat-value" style={{ fontSize: "var(--text-md)" }}>{summary.strongestAchievement.label}</p>
        <p className="stat-sub">Sınıf ort. %{Math.round(summary.strongestAchievement.classAverageRatio * 100)}</p>
      </div>
    </div>
  );
}
