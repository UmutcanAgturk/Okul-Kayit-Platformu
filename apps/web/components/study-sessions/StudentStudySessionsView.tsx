"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { fetchStudentStudySessions, STUDY_SESSION_STATUS_LABEL, type StudySessionStatus } from "@/lib/api/study-sessions";
import { Icon } from "@/components/ui/icons";

const ALLOWED_ROLES = ["STUDENT", "PARENT"];

const STATUS_CHIP: Record<StudySessionStatus, string> = {
  AI_SUGGESTED: "weak",
  TEACHER_APPROVED: "strong",
  TEACHER_REJECTED: "critical",
  COMPLETED: "neutral",
  CANCELLED: "neutral",
};

/**
 * Etüt Randevularım — demo/seviye360-app.html'deki "student:etut" ekranının
 * gerçek karşılığı. Karne/Akademik Yol Haritam'la aynı çoklu-çocuk seçici
 * deseni (bkz. components/roadmap/RoadmapView.tsx).
 */
export function StudentStudySessionsView() {
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

  const sessionsQuery = useQuery({
    queryKey: ["student-study-sessions", selectedStudentId],
    queryFn: () => fetchStudentStudySessions(selectedStudentId!),
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
          Bu modüle erişim yetkiniz yok. Etüt Randevularım yalnızca Öğrenci/Veli rolüne açıktır.
        </p>
      </div>
    );
  }

  const sessions = sessionsQuery.data?.sessions ?? [];

  return (
    <div className="screen">
      <h1>Etüt Randevularım</h1>
      <p className="lede">Yapay zeka tarafından önerilen ve öğretmen onayı bekleyen/onaylanmış etüt seanslarınız.</p>

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

      <div className="card card-pad">
        {sessionsQuery.isLoading ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
        ) : sessions.length === 0 ? (
          <div className="empty-state">
            <Icon name="heart" />
            <p>Henüz bir etüt seansı önerilmedi.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Kazanım</th>
                  <th>Öğretmen</th>
                  <th>Tarih</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {s.achievement.label}
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{s.achievement.code}</div>
                    </td>
                    <td>{s.teacherName}</td>
                    <td>
                      {new Date(s.scheduledStart).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}
                    </td>
                    <td>
                      <span className={`chip ${STATUS_CHIP[s.status]}`}>{STUDY_SESSION_STATUS_LABEL[s.status]}</span>
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
