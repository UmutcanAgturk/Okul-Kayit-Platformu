"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe, logout } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  AttendanceStatus,
  attendanceKeys,
  fetchAttendance,
  fetchClassrooms,
  saveAttendance,
} from "@/lib/api/attendance";

const ALLOWED_ROLES = ["TEACHER", "BRANCH_ADMIN", "GUIDANCE_COORDINATOR"];

const STATUS_LABEL: Record<AttendanceStatus, string> = { VAR: "Var", GEC: "Geç", IZINLI: "İzinli", YOK: "Yok" };
const STATUSES: AttendanceStatus[] = ["VAR", "GEC", "IZINLI", "YOK"];
const STATUS_CLASS: Record<AttendanceStatus, string> = {
  VAR: "bg-emerald-600 text-white border-emerald-600",
  GEC: "bg-amber-500 text-white border-amber-500",
  IZINLI: "bg-slate-500 text-white border-slate-500",
  YOK: "bg-red-600 text-white border-red-600",
};
const INACTIVE_CLASS = "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";

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

  async function handleLogout() {
    await logout();
    queryClient.clear();
    router.replace("/login");
  }

  const classroomsQuery = useQuery({ queryKey: attendanceKeys.classrooms(), queryFn: fetchClassrooms, enabled: !!me });
  const [classroomId, setClassroomId] = useState("");
  const [date, setDate] = useState(todayStr());
  const [draft, setDraft] = useState<Record<string, { status: AttendanceStatus; note: string }>>({});
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

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
    return <div className="animate-pulse text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</div>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }
  if (!ALLOWED_ROLES.includes(me.role)) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/40">
        <p className="text-sm font-medium text-red-700 dark:text-red-300">
          Bu modüle erişim yetkiniz yok. Devamsızlık yalnızca Öğretmen/Şube Yöneticisi/Rehber Öğretmen rolüne açıktır.
        </p>
      </div>
    );
  }

  const students = attendanceQuery.data?.students ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Devamsızlık / Yoklama</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {me.firstName} {me.lastName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/dashboard"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Ana Sayfa
          </a>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Çıkış Yap
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Sınıf</label>
          <select
            value={classroomId}
            onChange={(e) => setClassroomId(e.target.value)}
            className="mt-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.studentCount} öğrenci)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Tarih</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
      </div>

      {classrooms.length === 0 && !classroomsQuery.isLoading && (
        <p className="text-sm text-slate-500 dark:text-slate-400">Bu kurumda henüz tanımlı bir sınıf yok.</p>
      )}

      {classroomId && (
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          {attendanceQuery.isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}
          {!attendanceQuery.isLoading && students.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">Bu sınıfta henüz öğrenci yok.</p>
          )}
          <div className="space-y-2">
            {students.map((s) => {
              const current = draft[s.studentId]?.status ?? s.status;
              return (
                <div
                  key={s.studentId}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2 dark:border-slate-800"
                >
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-50">{s.name}</span>
                  <div className="flex gap-1">
                    {STATUSES.map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setStatus(s.studentId, status)}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                          current === status ? STATUS_CLASS[status] : INACTIVE_CLASS
                        }`}
                      >
                        {STATUS_LABEL[status]}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {students.length > 0 && (
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="rounded-lg bg-[#0071ce] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00558f] disabled:opacity-60"
              >
                {saveMutation.isPending ? "Kaydediliyor…" : "Yoklamayı Kaydet"}
              </button>
              {saveMessage && <span className="text-xs text-slate-500 dark:text-slate-400">{saveMessage}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
