"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { fetchTeacherPerformance } from "@/lib/api/teacher-performance";
import { Icon } from "@/components/ui/icons";

const ALLOWED_ROLES = ["BRANCH_ADMIN"];

function toneFor(pct: number | null) {
  if (pct === null) return "";
  if (pct < 40) return "tone-critical";
  if (pct < 70) return "tone-weak";
  return "tone-strong";
}

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

  if (isLoading) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }
  if (!ALLOWED_ROLES.includes(me.role)) {
    return (
      <div className="card card-pad">
        <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
          Bu modüle erişim yetkiniz yok. Öğretmen Performansı yalnızca Şube Yöneticisi rolüne açıktır.
        </p>
      </div>
    );
  }

  const teachers = perfQuery.data?.teachers ?? [];

  return (
    <div className="screen">
      <h1>Öğretmen Performansı</h1>
      <p className="lede">
        Öğretmenin branşındaki (zümre) kazanımlara ait tüm öğrenci sonuçlarının ortalama başarı yüzdesi — gerçek sınav
        verisinden hesaplanır.
      </p>

      <div className="card card-pad">
        {perfQuery.isLoading ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
        ) : teachers.length === 0 ? (
          <div className="empty-state">
            <Icon name="chart" />
            <p>Henüz aktif öğretmen yok.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Öğretmen</th>
                  <th>Branş</th>
                  <th>Kazanım Sonucu Sayısı</th>
                  <th>Ortalama Başarı</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => (
                  <tr key={t.teacherId}>
                    <td style={{ fontWeight: 600 }}>{t.name}</td>
                    <td>{t.branch}</td>
                    <td>{t.resultCount}</td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
