"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  deleteBranchStudySession,
  fetchBranchStudySessions,
  STUDY_SESSION_STATUS_LABEL,
  type StudySessionStatus,
} from "@/lib/api/study-sessions";
import { Icon } from "@/components/ui/icons";
import { HqBranchSelector } from "@/components/hq/HqBranchSelector";

const ALLOWED_ROLES = ["BRANCH_ADMIN", "GUIDANCE_COORDINATOR"];

const STATUS_CHIP: Record<StudySessionStatus, string> = {
  AI_SUGGESTED: "weak",
  TEACHER_APPROVED: "strong",
  TEACHER_REJECTED: "critical",
  COMPLETED: "neutral",
  CANCELLED: "neutral",
};

const STATUS_FILTER_OPTIONS: { value: StudySessionStatus | ""; label: string }[] = [
  { value: "", label: "Tümü" },
  { value: "AI_SUGGESTED", label: "Bekleyen" },
  { value: "TEACHER_APPROVED", label: "Onaylanan" },
  { value: "COMPLETED", label: "Tamamlanan" },
  { value: "TEACHER_REJECTED", label: "Reddedilen" },
  { value: "CANCELLED", label: "İptal Edilen" },
];

/**
 * Etüt — Şube Genel Bakışı. demo/seviye360-app.html'deki "branch:etut"
 * ekranının gerçek karşılığı — BRANCH_ADMIN/HQ, şubedeki TÜM öğretmenlerin
 * etüt taleplerini (öğretmene bağımsız) görür. Öğretmenin kendi onay/red/
 * tamamlama akışı TeacherStudySessionsView'da.
 */
export function BranchStudySessionsView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StudySessionStatus | "">("");
  const [search, setSearch] = useState("");

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

  const sessionsQuery = useQuery({ queryKey: ["branch-study-sessions"], queryFn: fetchBranchStudySessions, enabled: !!me });

  const deleteMutation = useMutation({
    mutationFn: (sessionId: string) => deleteBranchStudySession(sessionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["branch-study-sessions"] }),
  });

  const sessions = sessionsQuery.data?.sessions ?? [];

  const stats = useMemo(
    () => ({
      total: sessions.length,
      pending: sessions.filter((s) => s.status === "AI_SUGGESTED").length,
      approved: sessions.filter((s) => s.status === "TEACHER_APPROVED").length,
      completed: sessions.filter((s) => s.status === "COMPLETED").length,
    }),
    [sessions],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");
    return sessions.filter((s) => {
      if (statusFilter && s.status !== statusFilter) return false;
      if (q && !s.studentName.toLocaleLowerCase("tr-TR").includes(q)) return false;
      return true;
    });
  }, [sessions, statusFilter, search]);

  if (isLoading) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }
  if (!ALLOWED_ROLES.includes(me.role) && me.role !== "SUPERADMIN") {
    return (
      <div className="card card-pad">
        <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
          Bu modüle erişim yetkiniz yok. Etüt yalnızca Şube Yöneticisi/Rehber Öğretmen rolüne açıktır.
        </p>
      </div>
    );
  }

  return (
    <div className="screen">
      <h1>Etüt</h1>
      <p className="lede">Şubedeki tüm öğretmenlerin etüt taleplerinin genel görünümü.</p>
      <HqBranchSelector role={me.role} activeTenantId={me.actingTenantId} />

      <div className="grid cols-4" style={{ marginBottom: 14 }}>
        <div className="card stat-card">
          <p className="stat-label">Toplam Talep</p>
          <p className="stat-value">{stats.total}</p>
        </div>
        <div className="card stat-card">
          <p className="stat-label">Bekleyen</p>
          <p className="stat-value">{stats.pending}</p>
        </div>
        <div className="card stat-card">
          <p className="stat-label">Onaylanan</p>
          <p className="stat-value">{stats.approved}</p>
        </div>
        <div className="card stat-card">
          <p className="stat-label">Tamamlanan</p>
          <p className="stat-value">{stats.completed}</p>
        </div>
      </div>

      <div className="card card-pad">
        <div className="grid cols-2" style={{ marginBottom: 16 }}>
          <div className="field">
            <label>Öğrenci Ara</label>
            <input type="text" placeholder="Öğrenci adı…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="field">
            <label>Durum</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StudySessionStatus | "")}>
              {STATUS_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {sessionsQuery.isLoading ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Icon name="heart" />
            <p>Filtrenizle eşleşen etüt talebi yok.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Öğrenci</th>
                  <th>Öğretmen</th>
                  <th>Kazanım</th>
                  <th>Tarih</th>
                  <th>Durum</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.studentName}</td>
                    <td>{s.teacherName}</td>
                    <td>{s.achievement?.label ?? "—"}</td>
                    <td>{new Date(s.scheduledStart).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}</td>
                    <td>
                      <span className={`chip ${STATUS_CHIP[s.status]}`}>{STUDY_SESSION_STATUS_LABEL[s.status]}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn xs"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(s.id)}
                      >
                        Sil
                      </button>
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
