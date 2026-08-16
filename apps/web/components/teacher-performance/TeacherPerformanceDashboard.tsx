"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { fetchTeacherPerformance, TeacherPerformanceRow } from "@/lib/api/teacher-performance";
import { Icon } from "@/components/ui/icons";
import { HBarChart } from "@/components/ui/charts/HBarChart";

const ALLOWED_ROLES = ["BRANCH_ADMIN"];

function toneFor(pct: number | null) {
  if (pct === null) return "";
  if (pct < 40) return "tone-critical";
  if (pct < 70) return "tone-weak";
  return "tone-strong";
}

function medal(i: number) {
  if (i === 0) return "🥇";
  if (i === 1) return "🥈";
  if (i === 2) return "🥉";
  return "";
}

const MEDAL_TONE = ["var(--accent)", "var(--strong)", "var(--weak)"];

/**
 * Öğretmen Performansı — demo/seviye360-app.html'deki "ogretmenperf"
 * ekranının gerçek karşılığı (bkz. app/api/branch/teacher-performance).
 */
export function TeacherPerformanceDashboard() {
  const router = useRouter();

  const { data: me, isLoading, isError, error } = useQuery({
    queryKey: authKeys.me(),
    queryFn: fetchMe,
    retry: false,
  });

  useEffect(() => {
    if (isError && error instanceof ApiError && error.status === 401) {
      router.replace("/login");
    }
  }, [isError, error, router]);

  const perfQuery = useQuery({ queryKey: ["teacher-performance"], queryFn: fetchTeacherPerformance, enabled: !!me });
  const teachers = perfQuery.data?.teachers ?? [];
  const summary = perfQuery.data?.summary;

  const top3 = useMemo(
    () =>
      [...teachers]
        .filter((t) => t.avgMasteryPct !== null)
        .sort((a, b) => (b.avgMasteryPct ?? 0) - (a.avgMasteryPct ?? 0))
        .slice(0, 3),
    [teachers],
  );

  const masteryChartRows = useMemo(() => {
    const withData = teachers.filter((t: TeacherPerformanceRow) => t.avgMasteryPct !== null);
    const maxVal = Math.max(...withData.map((t) => t.avgMasteryPct ?? 0), 1);
    return withData
      .sort((a, b) => (b.avgMasteryPct ?? 0) - (a.avgMasteryPct ?? 0))
      .map((t) => ({
        label: t.name,
        value: t.avgMasteryPct ?? 0,
        sub: t.branch,
        tone: (t.avgMasteryPct ?? 0) >= maxVal * 0.7 ? "strong" : (t.avgMasteryPct ?? 0) >= maxVal * 0.4 ? "weak" : "critical",
        valueLabel: `%${t.avgMasteryPct}`,
      }) as const);
  }, [teachers]);

  const attendanceChartRows = useMemo(() => {
    const withData = teachers.filter((t: TeacherPerformanceRow) => t.avgAttendancePct !== null);
    return withData
      .sort((a, b) => (b.avgAttendancePct ?? 0) - (a.avgAttendancePct ?? 0))
      .map((t) => ({
        label: t.name,
        value: t.avgAttendancePct ?? 0,
        sub: t.branch,
        tone: (t.avgAttendancePct ?? 0) >= 90 ? "strong" : (t.avgAttendancePct ?? 0) >= 75 ? "weak" : "critical",
      }) as const);
  }, [teachers]);

  if (isLoading) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }
  if (!ALLOWED_ROLES.includes(me.role) && !(me.role === "SUPERADMIN" && me.actingTenantId)) {
    return (
      <div className="card card-pad">
        <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
          Bu modüle erişim yetkiniz yok. Öğretmen Performansı yalnızca Şube Yöneticisi rolüne açıktır.
        </p>
      </div>
    );
  }

  return (
    <div className="screen">
      <h1>Öğretmen Performansı</h1>
      <p className="lede">
        Öğretmenin branşındaki (zümre) kazanımlara ait tüm öğrenci sonuçlarının ortalama başarı yüzdesi — gerçek sınav
        verisinden hesaplanır.
      </p>

      {perfQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}

      {!perfQuery.isLoading && teachers.length === 0 && (
        <div className="card card-pad">
          <div className="empty-state">
            <Icon name="chart" />
            <p>Henüz aktif öğretmen yok.</p>
          </div>
        </div>
      )}

      {!perfQuery.isLoading && teachers.length > 0 && (
        <>
          <div className="grid cols-3" style={{ marginBottom: 14 }}>
            <div className="card card-pad" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>Toplam Öğretmen</div>
              <div style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>{summary?.totalTeachers ?? teachers.length}</div>
            </div>
            <div className="card card-pad" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>Ortalama Devam</div>
              <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--strong)" }}>
                {summary?.avgAttendancePct === null || summary?.avgAttendancePct === undefined ? "—" : `%${summary.avgAttendancePct}`}
              </div>
            </div>
            <div className="card card-pad" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>Toplam Öğrenci (Verilen Sınıflar)</div>
              <div style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>{summary?.totalRoster ?? 0}</div>
            </div>
          </div>

          {top3.length > 0 && (
            <div className="card card-pad" style={{ marginBottom: 14 }}>
              <div className="card-head">
                <h3>🏆 En Başarılı Öğretmenler</h3>
                <span className="hint">Ortalama başarı (branş)</span>
              </div>
              <div className="grid cols-3">
                {top3.map((t, i) => (
                  <div
                    key={t.teacherId}
                    className="card card-pad"
                    style={{ textAlign: "center", background: "var(--surface-2)", borderColor: MEDAL_TONE[i] }}
                  >
                    <div style={{ fontSize: 28 }}>{medal(i)}</div>
                    <div style={{ fontWeight: 700 }}>{t.name}</div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                      {t.branch} · %{t.avgMasteryPct} başarı
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid cols-2" style={{ marginBottom: 14 }}>
            <div className="card card-pad">
              <div className="card-head">
                <h3>Öğretmen Bazlı Ortalama Başarı (Branş)</h3>
                <span className="hint">{masteryChartRows.length} öğretmen</span>
              </div>
              <HBarChart rows={masteryChartRows} unit="%" />
            </div>
            <div className="card card-pad">
              <div className="card-head">
                <h3>Öğretmen Bazlı Ortalama Devam</h3>
                <span className="hint">{attendanceChartRows.length} öğretmen</span>
              </div>
              <HBarChart rows={attendanceChartRows} unit="%" max={100} />
            </div>
          </div>

          <div className="card card-pad">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Öğretmen</th>
                    <th>Branş</th>
                    <th>Sınıflar</th>
                    <th>Öğrenci</th>
                    <th>Ort. Başarı (Branş)</th>
                    <th>Ort. Devam</th>
                    <th>Davranış (+/-)</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((t) => (
                    <tr key={t.teacherId}>
                      <td style={{ fontWeight: 600 }}>{t.name}</td>
                      <td>{t.branch}</td>
                      <td>{t.classroomCodes.length > 0 ? t.classroomCodes.join(", ") : "—"}</td>
                      <td>{t.rosterSize}</td>
                      <td>
                        {t.avgMasteryPct === null ? (
                          <span className="chip neutral">Veri yok</span>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div className="progress-track" style={{ width: 120 }}>
                              <div className="progress-fill" style={{ width: `${t.avgMasteryPct}%` }} />
                            </div>
                            <span className={`chip ${toneFor(t.avgMasteryPct).replace("tone-", "")}`}>{t.avgMasteryPct}%</span>
                          </div>
                        )}
                      </td>
                      <td>{t.avgAttendancePct === null ? <span className="chip neutral">Veri yok</span> : `%${t.avgAttendancePct}`}</td>
                      <td>
                        <span className="chip strong" style={{ marginRight: 4 }}>
                          +{t.positiveCount}
                        </span>
                        <span className="chip critical">-{t.negativeCount}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
