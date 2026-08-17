"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { fetchBranchClassrooms } from "@/lib/api/students-roster";
import { fetchTeachers } from "@/lib/api/teachers";
import {
  createTimetableSlot,
  deleteTimetableSlot,
  DAY_LABELS,
  fetchBranchTimetable,
  fetchStudentTimetable,
  fetchTeacherTimetable,
} from "@/lib/api/timetable";
import { Icon } from "@/components/ui/icons";
import { HqBranchSelector } from "@/components/hq/HqBranchSelector";
import type { MeResponse } from "@/lib/api/auth";

/**
 * Ders Programı — demo/seviye360-app.html'deki "schedule" ekranının gerçek
 * karşılığı, tüm roller için ortak bileşen (role'e göre dallanır):
 * BRANCH_ADMIN tam yönetim (ekleme/silme), TEACHER/STUDENT/PARENT salt
 * okunur kendi programları.
 */
export function TimetableDashboard() {
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

  if (isLoading) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }

  if (me.role === "BRANCH_ADMIN" || me.role === "SUPERADMIN") return <BranchTimetable me={me} />;
  if (me.role === "TEACHER") return <TeacherTimetable />;
  if (me.role === "STUDENT" || me.role === "PARENT") return <StudentTimetable students={me.students ?? []} />;

  return (
    <div className="card card-pad">
      <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
        Bu modüle erişim yetkiniz yok.
      </p>
    </div>
  );
}

function groupByDay<T extends { dayOfWeek: number }>(rows: T[]) {
  const byDay = new Map<number, T[]>();
  for (const r of rows) {
    if (!byDay.has(r.dayOfWeek)) byDay.set(r.dayOfWeek, []);
    byDay.get(r.dayOfWeek)!.push(r);
  }
  return DAY_LABELS.map((label, idx) => ({ label, dayOfWeek: idx, rows: byDay.get(idx) ?? [] })).filter((d) => d.rows.length > 0);
}

function BranchTimetable({ me }: { me: MeResponse }) {
  const queryClient = useQueryClient();
  const [classroomId, setClassroomId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [subject, setSubject] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("09:40");
  const [formError, setFormError] = useState<string | null>(null);

  const classroomsQuery = useQuery({ queryKey: ["branch-classrooms"], queryFn: fetchBranchClassrooms });
  const teachersQuery = useQuery({ queryKey: ["teachers", "list"], queryFn: fetchTeachers });
  const timetableQuery = useQuery({ queryKey: ["branch-timetable"], queryFn: fetchBranchTimetable });

  const createMutation = useMutation({
    mutationFn: createTimetableSlot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branch-timetable"] });
      setFormError(null);
      setSubject("");
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Eklenemedi."),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTimetableSlot,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["branch-timetable"] }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!classroomId || !teacherId || !subject.trim()) {
      setFormError("Tüm alanları doldurun.");
      return;
    }
    createMutation.mutate({ classroomId, teacherId, subject: subject.trim(), dayOfWeek, startTime, endTime });
  }

  const groups = groupByDay(timetableQuery.data?.slots ?? []);

  return (
    <div className="screen">
      <h1>Ders Programı</h1>
      <p className="lede">Şube genelindeki tüm sınıfların haftalık ders programı.</p>
      <HqBranchSelector role={me.role} activeTenantId={me.actingTenantId} />

      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="card-head">
          <h3>Yeni Ders Ekle</h3>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div className="field" style={{ minWidth: 160 }}>
            <label>Sınıf</label>
            <select value={classroomId} onChange={(e) => setClassroomId(e.target.value)}>
              <option value="">Seçin</option>
              {classroomsQuery.data?.classrooms.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ minWidth: 160 }}>
            <label>Öğretmen</label>
            <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              <option value="">Seçin</option>
              {teachersQuery.data?.teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.branch})
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ minWidth: 140 }}>
            <label>Ders</label>
            <input type="text" placeholder="Matematik" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="field" style={{ minWidth: 130 }}>
            <label>Gün</label>
            <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>
              {DAY_LABELS.map((d, idx) => (
                <option key={d} value={idx}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ minWidth: 100 }}>
            <label>Başlangıç</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div className="field" style={{ minWidth: 100 }}>
            <label>Bitiş</label>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
          <button type="submit" className="btn primary" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Ekleniyor…" : "Ekle"}
          </button>
        </form>
        {formError && (
          <p style={{ marginTop: 10, fontSize: "var(--text-sm)", color: "var(--critical)", fontWeight: 600 }}>{formError}</p>
        )}
      </div>

      {timetableQuery.isLoading ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
      ) : groups.length === 0 ? (
        <div className="card card-pad">
          <div className="empty-state">
            <Icon name="clock" />
            <p>Henüz bir ders programı tanımlanmadı.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {groups.map((g) => (
            <div key={g.dayOfWeek} className="card card-pad">
              <div className="card-head">
                <h3>{g.label}</h3>
              </div>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Saat</th>
                      <th>Sınıf</th>
                      <th>Ders</th>
                      <th>Öğretmen</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r) => (
                      <tr key={r.id}>
                        <td>{r.startTime}–{r.endTime}</td>
                        <td>{r.classroomName}</td>
                        <td>{r.subject}</td>
                        <td>{r.teacherName}</td>
                        <td>
                          <button
                            type="button"
                            className="btn danger xs"
                            disabled={deleteMutation.isPending}
                            onClick={() => deleteMutation.mutate(r.id)}
                          >
                            Sil
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TeacherTimetable() {
  const timetableQuery = useQuery({ queryKey: ["teacher-timetable"], queryFn: fetchTeacherTimetable });
  const groups = groupByDay(timetableQuery.data?.slots ?? []);

  return (
    <div className="screen">
      <h1>Ders Programım</h1>
      <p className="lede">Haftalık ders programınız.</p>
      <TimetableGroups groups={groups} extraColumn={{ label: "Sınıf", render: (r: any) => r.classroomName }} isLoading={timetableQuery.isLoading} />
    </div>
  );
}

function StudentTimetable({ students }: { students: { studentId: string; fullName: string }[] }) {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedStudentId && students.length > 0) setSelectedStudentId(students[0].studentId);
  }, [students, selectedStudentId]);

  const timetableQuery = useQuery({
    queryKey: ["student-timetable", selectedStudentId],
    queryFn: () => fetchStudentTimetable(selectedStudentId!),
    enabled: !!selectedStudentId,
  });
  const groups = groupByDay(timetableQuery.data?.slots ?? []);

  return (
    <div className="screen">
      <h1>Ders Programım</h1>
      <p className="lede">Sınıfınızın haftalık ders programı.</p>
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
      <TimetableGroups groups={groups} extraColumn={{ label: "Öğretmen", render: (r: any) => r.teacherName }} isLoading={timetableQuery.isLoading} />
    </div>
  );
}

function TimetableGroups({
  groups,
  extraColumn,
  isLoading,
}: {
  groups: { label: string; dayOfWeek: number; rows: any[] }[];
  extraColumn: { label: string; render: (r: any) => string };
  isLoading: boolean;
}) {
  if (isLoading) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }
  if (groups.length === 0) {
    return (
      <div className="card card-pad">
        <div className="empty-state">
          <Icon name="clock" />
          <p>Henüz bir ders programı tanımlanmadı.</p>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {groups.map((g) => (
        <div key={g.dayOfWeek} className="card card-pad">
          <div className="card-head">
            <h3>{g.label}</h3>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Saat</th>
                  <th>Ders</th>
                  <th>{extraColumn.label}</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.startTime}–{r.endTime}</td>
                    <td>{r.subject}</td>
                    <td>{extraColumn.render(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
