"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  fetchTeacherStudySessions,
  respondToStudySession,
  STUDY_SESSION_STATUS_LABEL,
  type StudySessionStatus,
} from "@/lib/api/study-sessions";
import { Icon } from "@/components/ui/icons";

const STATUS_CHIP: Record<StudySessionStatus, string> = {
  AI_SUGGESTED: "weak",
  TEACHER_APPROVED: "strong",
  TEACHER_REJECTED: "critical",
  COMPLETED: "neutral",
  CANCELLED: "neutral",
};

/**
 * Etüt Onayı — demo/seviye360-app.html'deki "teacher:etut" ekranının gerçek
 * karşılığı. Backend (GET/POST .../respond) daha önce eklenmişti, bu ekran
 * onun ilk gerçek arayüzü.
 */
export function TeacherStudySessionsView() {
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

  const sessionsQuery = useQuery({ queryKey: ["teacher-study-sessions"], queryFn: fetchTeacherStudySessions, enabled: !!me });

  const respondMutation = useMutation({
    mutationFn: ({ sessionId, decision }: { sessionId: string; decision: "APPROVE" | "REJECT" | "COMPLETE" }) =>
      respondToStudySession(sessionId, decision),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teacher-study-sessions"] }),
  });

  if (isLoading) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }
  if (me.role !== "TEACHER") {
    return (
      <div className="card card-pad">
        <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
          Bu modüle erişim yetkiniz yok. Etüt Onayı yalnızca Öğretmen rolüne açıktır.
        </p>
      </div>
    );
  }

  const sessions = sessionsQuery.data?.sessions ?? [];
  const pending = sessions.filter((s) => s.status === "AI_SUGGESTED");
  const approved = sessions.filter((s) => s.status === "TEACHER_APPROVED");
  const others = sessions.filter((s) => s.status !== "AI_SUGGESTED" && s.status !== "TEACHER_APPROVED");

  return (
    <div className="screen">
      <h1>Etüt Onayı</h1>
      <p className="lede">Yapay zekanın önerdiği etüt seanslarını onaylayın veya reddedin.</p>

      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="card-head">
          <h3>Onay Bekleyenler</h3>
          <span className="hint">{pending.length} seans</span>
        </div>
        {sessionsQuery.isLoading ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
        ) : pending.length === 0 ? (
          <div className="empty-state">
            <Icon name="check" />
            <p>Onay bekleyen etüt seansı yok.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {pending.map((s) => (
              <div
                key={s.id}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", padding: "9px 0" }}
              >
                <div>
                  <div style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>
                    {s.student.user.firstName} {s.student.user.lastName}
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                    {s.achievement?.label ?? "—"} · {new Date(s.scheduledStart).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className="btn success solid xs"
                    disabled={respondMutation.isPending}
                    onClick={() => respondMutation.mutate({ sessionId: s.id, decision: "APPROVE" })}
                  >
                    Onayla
                  </button>
                  <button
                    type="button"
                    className="btn danger xs"
                    disabled={respondMutation.isPending}
                    onClick={() => respondMutation.mutate({ sessionId: s.id, decision: "REJECT" })}
                  >
                    Reddet
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="card-head">
          <h3>Onaylanmış — Tamamlanmayı Bekliyor</h3>
          <span className="hint">{approved.length} seans</span>
        </div>
        {approved.length === 0 ? (
          <div className="empty-state">
            <Icon name="clock" />
            <p>Tamamlanmayı bekleyen onaylı seans yok.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {approved.map((s) => (
              <div
                key={s.id}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", padding: "9px 0" }}
              >
                <div>
                  <div style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>
                    {s.student.user.firstName} {s.student.user.lastName}
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                    {s.achievement?.label ?? "—"} · {new Date(s.scheduledStart).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn xs"
                  disabled={respondMutation.isPending}
                  onClick={() => respondMutation.mutate({ sessionId: s.id, decision: "COMPLETE" })}
                >
                  Tamamlandı
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h3>Geçmiş</h3>
        </div>
        {others.length === 0 ? (
          <div className="empty-state">
            <Icon name="clock" />
            <p>Henüz yanıtlanmış bir seans yok.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Öğrenci</th>
                  <th>Kazanım</th>
                  <th>Tarih</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {others.map((s) => (
                  <tr key={s.id}>
                    <td>{s.student.user.firstName} {s.student.user.lastName}</td>
                    <td>{s.achievement?.label ?? "—"}</td>
                    <td>{new Date(s.scheduledStart).toLocaleDateString("tr-TR")}</td>
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
