"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  createStudySession,
  fetchStudentStudySessions,
  STUDY_SESSION_STATUS_LABEL,
  type StudySessionStatus,
} from "@/lib/api/study-sessions";
import { fetchTeachers } from "@/lib/api/teachers";
import { fetchCurriculumAchievements } from "@/lib/api/exams";
import { Icon } from "@/components/ui/icons";

const ALLOWED_ROLES = ["STUDENT", "PARENT"];

const STATUS_CHIP: Record<StudySessionStatus, string> = {
  AI_SUGGESTED: "weak",
  TEACHER_APPROVED: "strong",
  TEACHER_REJECTED: "critical",
  COMPLETED: "neutral",
  CANCELLED: "neutral",
};

function NewRequestForm({ studentId, onCreated }: { studentId: string; onCreated: () => void }) {
  const teachersQuery = useQuery({ queryKey: ["teachers", "list"], queryFn: fetchTeachers });
  const achievementsQuery = useQuery({ queryKey: ["curriculum-achievements"], queryFn: fetchCurriculumAchievements });

  const [teacherId, setTeacherId] = useState("");
  const [achievementId, setAchievementId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("15:00");
  const [endTime, setEndTime] = useState("15:40");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      createStudySession(studentId, {
        teacherId,
        achievementId,
        scheduledStart: `${date}T${startTime}:00`,
        scheduledEnd: `${date}T${endTime}:00`,
      }),
    onSuccess: () => {
      setStatus("Etüt talebiniz öğretmenin onayına gönderildi.");
      setError(null);
      setTeacherId("");
      setAchievementId("");
      setDate("");
      onCreated();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Talep oluşturulamadı."),
  });

  function handleSubmit() {
    setError(null);
    setStatus(null);
    if (!teacherId || !achievementId || !date) {
      setError("Öğretmen, kazanım ve tarih zorunludur.");
      return;
    }
    createMutation.mutate();
  }

  return (
    <div className="card card-pad" style={{ marginBottom: 14 }}>
      <div className="card-head">
        <h3>Yeni Etüt Talebi</h3>
      </div>
      <div className="grid cols-2">
        <div className="field">
          <label>Öğretmen</label>
          <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            <option value="">— Seçin —</option>
            {teachersQuery.data?.teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.branch})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Kazanım</label>
          <select value={achievementId} onChange={(e) => setAchievementId(e.target.value)}>
            <option value="">— Seçin —</option>
            {achievementsQuery.data?.achievements.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid cols-3" style={{ marginTop: 12 }}>
        <div className="field">
          <label>Tarih</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Başlangıç</label>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div className="field">
          <label>Bitiş</label>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      </div>
      {error && <p style={{ margin: "8px 0 0", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--critical)" }}>{error}</p>}
      {status && <p style={{ margin: "8px 0 0", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--strong)" }}>{status}</p>}
      <button type="button" onClick={handleSubmit} disabled={createMutation.isPending} className="btn primary" style={{ marginTop: 12 }}>
        {createMutation.isPending ? "Gönderiliyor…" : "Talep Oluştur"}
      </button>
    </div>
  );
}

/**
 * Etüt Randevularım — demo/seviye360-app.html'deki "student:etut" ekranının
 * gerçek karşılığı. Karne/Akademik Yol Haritam'la aynı çoklu-çocuk seçici
 * deseni (bkz. components/roadmap/RoadmapView.tsx).
 */
export function StudentStudySessionsView() {
  const router = useRouter();
  const queryClient = useQueryClient();

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
      <p className="lede">Yapay zeka tarafından önerilen ve öğretmen onayı bekleyen/onaylanmış etüt seanslarınız — kendiniz de yeni bir talep oluşturabilirsiniz.</p>

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

      {selectedStudentId && (
        <NewRequestForm
          studentId={selectedStudentId}
          onCreated={() => queryClient.invalidateQueries({ queryKey: ["student-study-sessions", selectedStudentId] })}
        />
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
