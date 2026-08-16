"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { fetchStudentAttendance } from "@/lib/api/self-records";
import { Icon } from "@/components/ui/icons";

const ALLOWED_ROLES = ["STUDENT", "PARENT"];

const STATUS_LABEL: Record<string, string> = { VAR: "Var", GEC: "Geç", IZINLI: "İzinli", YOK: "Yok" };
const STATUS_CHIP: Record<string, string> = { VAR: "strong", GEC: "weak", IZINLI: "neutral", YOK: "critical" };

/**
 * Devamsızlığım — demo/seviye360-app.html'deki "student:attendance"
 * ekranının gerçek karşılığı. Yeni bir API EKLEMEZ — mevcut, zaten
 * self/parent/staff yetki desenine sahip /api/students/[id]/attendance'ı
 * (Karne'nin de kullandığı) ilk kez öğrenci/veli tarafına gösterir.
 */
export function StudentAttendanceView() {
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

  const students = me?.students ?? [];
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedStudentId && students.length > 0) setSelectedStudentId(students[0].studentId);
  }, [students, selectedStudentId]);

  const attendanceQuery = useQuery({
    queryKey: ["student-attendance", selectedStudentId],
    queryFn: () => fetchStudentAttendance(selectedStudentId!),
    enabled: !!selectedStudentId,
  });

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
          Bu modüle erişim yetkiniz yok. Devamsızlığım yalnızca Öğrenci/Veli rolüne açıktır.
        </p>
      </div>
    );
  }

  const data = attendanceQuery.data;

  return (
    <div className="screen">
      <h1>Devamsızlığım</h1>
      <p className="lede">Tüm yoklama geçmişiniz.</p>

      {students.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {students.map((s) => (
            <button
              key={s.studentId}
              type="button"
              onClick={() => setSelectedStudentId(s.studentId)}
              className={`btn sm ${selectedStudentId === s.studentId ? "primary" : ""}`}
            >
              {s.fullName}
            </button>
          ))}
        </div>
      )}

      {attendanceQuery.isLoading ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
      ) : data ? (
        <>
          <div className="grid cols-4" style={{ marginBottom: 14 }}>
            <div className="card stat-card">
              <p className="stat-label">Var</p>
              <p className="stat-value">{data.summary.presentDays}</p>
            </div>
            <div className="card stat-card tone-weak">
              <p className="stat-label">Geç</p>
              <p className="stat-value">{data.summary.lateDays}</p>
            </div>
            <div className="card stat-card">
              <p className="stat-label">İzinli</p>
              <p className="stat-value">{data.summary.excusedDays}</p>
            </div>
            <div className="card stat-card tone-critical">
              <p className="stat-label">Yok (Devamsız)</p>
              <p className="stat-value">{data.summary.absentDays}</p>
              <p className="stat-sub">%{data.summary.absenceRatePct} oran</p>
            </div>
          </div>

          <div className="card card-pad">
            <div className="card-head">
              <h3>Kayıt Geçmişi</h3>
              <span className="hint">{data.records.length} gün</span>
            </div>
            {data.records.length === 0 ? (
              <div className="empty-state">
                <Icon name="calendar" />
                <p>Henüz yoklama kaydı yok.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Tarih</th>
                      <th>Durum</th>
                      <th>Not</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.records.map((r) => (
                      <tr key={r.date}>
                        <td>{new Date(r.date).toLocaleDateString("tr-TR")}</td>
                        <td>
                          <span className={`chip ${STATUS_CHIP[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                        </td>
                        <td>{r.note ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
