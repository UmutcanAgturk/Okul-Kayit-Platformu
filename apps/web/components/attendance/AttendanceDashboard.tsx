"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  AttendanceStatus,
  attendanceKeys,
  fetchAttendance,
  fetchClassrooms,
  saveAttendance,
} from "@/lib/api/attendance";
import { Icon } from "@/components/ui/icons";
import { AttendanceOverviewDashboard } from "@/components/attendance/AttendanceOverviewDashboard";

const ALLOWED_ROLES = ["TEACHER", "BRANCH_ADMIN", "GUIDANCE_COORDINATOR"];
const OVERVIEW_ROLES = ["BRANCH_ADMIN"];

const STATUS_LABEL: Record<AttendanceStatus, string> = { VAR: "Var", GEC: "Geç", IZINLI: "İzinli", YOK: "Yok" };
const STATUSES: AttendanceStatus[] = ["VAR", "GEC", "IZINLI", "YOK"];
const STATUS_TONE: Record<AttendanceStatus, { bg: string; fg: string }> = {
  VAR: { bg: "var(--strong)", fg: "var(--strong-ink)" },
  GEC: { bg: "var(--weak)", fg: "var(--weak-ink)" },
  IZINLI: { bg: "var(--ink-faint)", fg: "#fff" },
  YOK: { bg: "var(--critical)", fg: "var(--critical-ink)" },
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Devamsızlık/Yoklama — demo/seviye360-app.html'deki "teacher:attendance" /
 * "branch:attendance" ekranlarının gerçek (Postgres'e bağlı) karşılığı.
 * TEACHER'ın bu depodaki İLK gerçek (mock olmayan) modülüdür.
 */
export function AttendanceDashboard() {
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

  const classroomsQuery = useQuery({ queryKey: attendanceKeys.classrooms(), queryFn: fetchClassrooms, enabled: !!me });
  const [classroomId, setClassroomId] = useState("");
  const [date, setDate] = useState(todayStr());
  const [draft, setDraft] = useState<Record<string, { status: AttendanceStatus; note: string }>>({});
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<"ozet" | "al">("ozet");

  const canSeeOverview = !!me && (OVERVIEW_ROLES.includes(me.role) || (me.role === "SUPERADMIN" && !!me.actingTenantId));

  const classrooms = classroomsQuery.data?.classrooms ?? [];
  useEffect(() => {
    if (!classroomId && classrooms.length > 0) setClassroomId(classrooms[0].id);
  }, [classrooms, classroomId]);

  const attendanceQuery = useQuery({
    queryKey: attendanceKeys.byClassroomDate(classroomId, date),
    queryFn: () => fetchAttendance(classroomId, date),
    enabled: !!classroomId && !!date,
  });

  useEffect(() => {
    if (attendanceQuery.data) {
      const next: Record<string, { status: AttendanceStatus; note: string }> = {};
      for (const s of attendanceQuery.data.students) next[s.studentId] = { status: s.status, note: s.note ?? "" };
      setDraft(next);
      setSaveMessage(null);
    }
  }, [attendanceQuery.data]);

  const saveMutation = useMutation({
    mutationFn: saveAttendance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.byClassroomDate(classroomId, date) });
      setSaveMessage("Yoklama kaydedildi.");
    },
    onError: (err) => setSaveMessage(err instanceof ApiError ? err.message : "Yoklama kaydedilemedi."),
  });

  function setStatus(studentId: string, status: AttendanceStatus) {
    setDraft((prev) => ({ ...prev, [studentId]: { status, note: prev[studentId]?.note ?? "" } }));
  }

  function handleSave() {
    const records = Object.entries(draft).map(([studentId, v]) => ({
      studentId,
      status: v.status,
      note: v.note.trim() || undefined,
    }));
    saveMutation.mutate({ classroomId, date, records });
  }

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
          Bu modüle erişim yetkiniz yok. Devamsızlık yalnızca Öğretmen/Şube Yöneticisi/Rehber Öğretmen rolüne açıktır.
        </p>
      </div>
    );
  }

  const students = attendanceQuery.data?.students ?? [];

  return (
    <div className="screen">
      <h1>Devamsızlık / Yoklama</h1>
      <p className="lede">
        {me.firstName} {me.lastName}
      </p>

      {canSeeOverview && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button type="button" onClick={() => setTab("ozet")} className={tab === "ozet" ? "btn primary xs" : "btn xs"}>
            Genel Bakış
          </button>
          <button type="button" onClick={() => setTab("al")} className={tab === "al" ? "btn primary xs" : "btn xs"}>
            Yoklama Al
          </button>
        </div>
      )}

      {canSeeOverview && tab === "ozet" && <AttendanceOverviewDashboard />}

      {(!canSeeOverview || tab === "al") && (
        <>
      <div className="card card-pad" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12, marginBottom: 14 }}>
        <div className="field">
          <label>Sınıf</label>
          <select value={classroomId} onChange={(e) => setClassroomId(e.target.value)}>
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.studentCount} öğrenci)
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Tarih</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {classrooms.length === 0 && !classroomsQuery.isLoading && (
        <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Bu kurumda henüz tanımlı bir sınıf yok.</p>
      )}

      {classroomId && (
        <div className="card card-pad">
          {attendanceQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
          {!attendanceQuery.isLoading && students.length === 0 && (
            <div className="empty-state">
              <Icon name="users" />
              <p>Bu sınıfta henüz öğrenci yok.</p>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {students.map((s) => {
              const current = draft[s.studentId]?.status ?? s.status;
              return (
                <div
                  key={s.studentId}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    borderBottom: "1px solid var(--border)",
                    padding: "9px 0",
                  }}
                >
                  <span style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>{s.name}</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    {STATUSES.map((status) => {
                      const active = current === status;
                      const tone = STATUS_TONE[status];
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setStatus(s.studentId, status)}
                          className="btn xs"
                          style={active ? { background: tone.bg, borderColor: tone.bg, color: tone.fg } : undefined}
                        >
                          {STATUS_LABEL[status]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {students.length > 0 && (
            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
              <button type="button" onClick={handleSave} disabled={saveMutation.isPending} className="btn primary">
                {saveMutation.isPending ? "Kaydediliyor…" : "Yoklamayı Kaydet"}
              </button>
              {saveMessage && <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>{saveMessage}</span>}
            </div>
          )}
        </div>
      )}
        </>
      )}
    </div>
  );
}
