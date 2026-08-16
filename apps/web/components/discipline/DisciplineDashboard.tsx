"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
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
import { Icon } from "@/components/ui/icons";

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
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }
  if (!ALLOWED_ROLES.includes(me.role) && !(me.role === "SUPERADMIN" && me.actingTenantId)) {
    return (
      <div className="card card-pad">
        <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
          Bu modüle erişim yetkiniz yok. Disiplin/Davranış Takibi yalnızca Öğretmen/Şube Yöneticisi/Rehber Öğretmen
          rolüne açıktır.
        </p>
      </div>
    );
  }

  const records = recordsQuery.data?.records ?? [];

  return (
    <div className="screen">
      <h1>Disiplin / Davranış Takibi</h1>
      <p className="lede">
        {me.firstName} {me.lastName}
      </p>

      <div className="grid cols-2">
        <div className="card card-pad">
          <div className="card-head">
            <h3>Yeni Kayıt Ekle</h3>
          </div>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="grid cols-2">
              <div className="field">
                <label>Sınıf</label>
                <select value={classroomId} onChange={(e) => setClassroomId(e.target.value)}>
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Öğrenci</label>
                <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                  {students.map((s) => (
                    <option key={s.studentId} value={s.studentId}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid cols-2">
              <div className="field">
                <label>Tür</label>
                <select value={type} onChange={(e) => handleTypeChange(e.target.value as DisciplineType)}>
                  <option value="OLUMLU">Olumlu</option>
                  <option value="OLUMSUZ">Olumsuz</option>
                </select>
              </div>
              <div className="field">
                <label>Kategori</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {DISCIPLINE_CATEGORIES[type].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Not (opsiyonel)</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Kısa açıklama…" />
            </div>

            {formError && <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{formError}</p>}

            <button type="submit" disabled={createMutation.isPending} className="btn primary" style={{ width: "100%", justifyContent: "center" }}>
              {createMutation.isPending ? "Ekleniyor…" : "Kaydı Ekle"}
            </button>
          </form>
        </div>

        <div className="card card-pad">
          <div className="card-head">
            <h3>Son Kayıtlar</h3>
          </div>
          {recordsQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
          {!recordsQuery.isLoading && records.length === 0 && (
            <div className="empty-state">
              <Icon name="shield" />
              <p>Henüz kayıt yok.</p>
            </div>
          )}
          <div style={{ maxHeight: 560, overflowY: "auto", display: "flex", flexDirection: "column" }}>
            {records.map((r) => (
              <div key={r.id} style={{ borderBottom: "1px solid var(--border)", padding: "9px 0" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>{r.studentName}</span>
                  <span style={{ fontWeight: 700, color: r.points >= 0 ? "var(--strong)" : "var(--critical)" }}>
                    {r.points >= 0 ? "+" : ""}
                    {r.points}
                  </span>
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
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
