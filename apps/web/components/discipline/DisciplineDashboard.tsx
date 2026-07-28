"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe, logout } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { attendanceKeys, fetchClassrooms } from "@/lib/api/attendance";
import {
  createDisciplineRecord,
  DISCIPLINE_CATEGORIES,
  DisciplineType,
  disciplineKeys,
  fetchClassroomStudents,
  fetchDisciplineRecords,
} from "@/lib/api/discipline";

const ALLOWED_ROLES = ["TEACHER", "BRANCH_ADMIN", "GUIDANCE_COORDINATOR"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("tr-TR");
}

/**
 * Disiplin/Davranış Takibi — demo/seviye360-app.html'deki "teacher:disiplin"/
 * "branch:disiplin" ekranlarının gerçek karşılığı.
 */
export function DisciplineDashboard() {
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
  const classrooms = classroomsQuery.data?.classrooms ?? [];

  const [classroomId, setClassroomId] = useState("");
  useEffect(() => {
    if (!classroomId && classrooms.length > 0) setClassroomId(classrooms[0].id);
  }, [classrooms, classroomId]);

  const studentsQuery = useQuery({
    queryKey: disciplineKeys.classroomStudents(classroomId),
    queryFn: () => fetchClassroomStudents(classroomId),
    enabled: !!classroomId,
  });
  const students = studentsQuery.data?.students ?? [];

  const [studentId, setStudentId] = useState("");
  useEffect(() => {
    if (students.length > 0 && !students.some((s) => s.studentId === studentId)) setStudentId(students[0].studentId);
  }, [students, studentId]);

  const [type, setType] = useState<DisciplineType>("OLUMLU");
  const [category, setCategory] = useState(DISCIPLINE_CATEGORIES.OLUMLU[0]);
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const recordsQuery = useQuery({ queryKey: disciplineKeys.records(), queryFn: () => fetchDisciplineRecords() });

  const createMutation = useMutation({
    mutationFn: createDisciplineRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: disciplineKeys.records() });
      setNote("");
      setFormError(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Kayıt eklenemedi."),
  });

  function handleTypeChange(next: DisciplineType) {
    setType(next);
    setCategory(DISCIPLINE_CATEGORIES[next][0]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId) {
      setFormError("Öğrenci seçmelisiniz.");
      return;
    }
    createMutation.mutate({ studentId, type, category, note: note.trim() || undefined });
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
          Bu modüle erişim yetkiniz yok. Disiplin/Davranış Takibi yalnızca Öğretmen/Şube Yöneticisi/Rehber Öğretmen
          rolüne açıktır.
        </p>
      </div>
    );
  }

  const records = recordsQuery.data?.records ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Disiplin / Davranış Takibi</h1>
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Yeni Kayıt Ekle</h2>
          <form onSubmit={handleSubmit} className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Sınıf</label>
                <select
                  value={classroomId}
                  onChange={(e) => setClassroomId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Öğrenci</label>
                <select
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  {students.map((s) => (
                    <option key={s.studentId} value={s.studentId}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Tür</label>
                <select
                  value={type}
                  onChange={(e) => handleTypeChange(e.target.value as DisciplineType)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="OLUMLU">Olumlu</option>
                  <option value="OLUMSUZ">Olumsuz</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Kategori</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  {DISCIPLINE_CATEGORIES[type].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Not (opsiyonel)</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Kısa açıklama…"
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            {formError && <p className="text-xs text-red-600 dark:text-red-400">{formError}</p>}

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full rounded-lg bg-[#0071ce] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00558f] disabled:opacity-60"
            >
              {createMutation.isPending ? "Ekleniyor…" : "Kaydı Ekle"}
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Son Kayıtlar</h2>
          {recordsQuery.isLoading && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}
          {!recordsQuery.isLoading && records.length === 0 && (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Henüz kayıt yok.</p>
          )}
          <div className="mt-3 max-h-[560px] space-y-2 overflow-y-auto">
            {records.map((r) => (
              <div key={r.id} className="border-b border-slate-100 py-2 text-sm dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900 dark:text-slate-50">{r.studentName}</span>
                  <span
                    className={
                      r.points >= 0
                        ? "font-semibold text-emerald-600 dark:text-emerald-400"
                        : "font-semibold text-red-600 dark:text-red-400"
                    }
                  >
                    {r.points >= 0 ? "+" : ""}
                    {r.points}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDate(r.createdAt)} · {r.category}
                  {r.note && ` · ${r.note}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
