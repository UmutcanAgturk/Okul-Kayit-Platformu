"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  assignStudentClassroom,
  fetchBranchClassrooms,
  fetchBranchStudents,
  studentsRosterKeys,
} from "@/lib/api/students-roster";
import { GRADE_LEVEL_LABEL } from "@/lib/api/enrollments";
import { Icon } from "@/components/ui/icons";
import { StudentDetailDrawer } from "./StudentDetailDrawer";
import { ClassroomsPanel } from "./ClassroomsPanel";
import type { BranchStudentRow } from "@/lib/api/students-roster";

const ALLOWED_ROLES = ["BRANCH_ADMIN", "GUIDANCE_COORDINATOR"];

/**
 * Öğrenciler / Sınıf Atama — demo/seviye360-app.html'deki "branch:students"
 * VE "branch:assign" ekranlarının tek bir gerçek sayfada birleşimi: ikisi de
 * aynı StudentProfile listesi üzerinde çalıştığı için (bkz. app/api/branch/students),
 * ayrı iki ekran yerine roster'ın kendisinden inline sınıf ataması yapılabilir.
 */
export function StudentsRosterDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

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

  const studentsQuery = useQuery({ queryKey: studentsRosterKeys.all(), queryFn: fetchBranchStudents, enabled: !!me });
  const classroomsQuery = useQuery({ queryKey: ["branch-classrooms"], queryFn: fetchBranchClassrooms, enabled: !!me });

  const assignMutation = useMutation({
    mutationFn: ({ studentId, classroomId }: { studentId: string; classroomId: string | null }) =>
      assignStudentClassroom(studentId, classroomId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: studentsRosterKeys.all() }),
  });

  const filtered = useMemo(() => {
    const rows = studentsQuery.data?.students ?? [];
    const q = search.trim().toLocaleLowerCase("tr-TR");
    if (!q) return rows;
    return rows.filter((s) => s.name.toLocaleLowerCase("tr-TR").includes(q) || s.studentNo.includes(q));
  }, [studentsQuery.data, search]);

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
          Bu modüle erişim yetkiniz yok. Öğrenciler yalnızca Şube Yöneticisi/Rehber Öğretmen rolüne açıktır.
        </p>
      </div>
    );
  }

  const classroomsByGrade = new Map<string, NonNullable<typeof classroomsQuery.data>["classrooms"]>();
  for (const c of classroomsQuery.data?.classrooms ?? []) {
    if (!classroomsByGrade.has(c.gradeLevel)) classroomsByGrade.set(c.gradeLevel, []);
    classroomsByGrade.get(c.gradeLevel)!.push(c);
  }

  const unassignedCount = (studentsQuery.data?.students ?? []).filter((s) => !s.classroomId).length;
  const selectedStudent: BranchStudentRow | null =
    (studentsQuery.data?.students ?? []).find((s) => s.id === selectedStudentId) ?? null;
  const canManageClassrooms = me.role === "BRANCH_ADMIN" || (me.role === "SUPERADMIN" && !!me.actingTenantId);

  return (
    <div className="screen">
      <h1>Öğrenciler</h1>
      <p className="lede">Tüm öğrenci kaydınız ve sınıf ataması — sağdaki açılır menüden bir öğrenciyi doğrudan bir şubeye atayabilirsiniz.</p>

      {canManageClassrooms && <ClassroomsPanel classrooms={classroomsQuery.data?.classrooms ?? []} />}

      <div className="grid cols-2" style={{ marginBottom: 14 }}>
        <div className="card stat-card">
          <p className="stat-label">Toplam Öğrenci</p>
          <p className="stat-value">{studentsQuery.data?.students.length ?? 0}</p>
        </div>
        <div className={`card stat-card ${unassignedCount ? "tone-weak" : "tone-strong"}`}>
          <p className="stat-label">Sınıfa Atanmamış</p>
          <p className="stat-value" style={{ color: unassignedCount ? "var(--weak)" : undefined }}>{unassignedCount}</p>
        </div>
      </div>

      {unassignedCount > 0 && (
        <div className="card card-pad" style={{ marginBottom: 14, borderColor: "var(--weak)" }}>
          <div className="card-head">
            <h3>Atama Bekleyenler</h3>
            <span className="hint">{unassignedCount} öğrenci</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {(studentsQuery.data?.students ?? [])
              .filter((s) => !s.classroomId)
              .map((s) => {
                const options = classroomsByGrade.get(s.gradeLevel) ?? [];
                return (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, borderBottom: "1px solid var(--border)", padding: "7px 0" }}>
                    <span style={{ fontSize: "var(--text-sm)" }}>
                      <b>{s.name}</b> <span style={{ color: "var(--ink-faint)", fontSize: "var(--text-xs)" }}>{s.studentNo} · {GRADE_LEVEL_LABEL[s.gradeLevel] ?? s.gradeLevel}</span>
                    </span>
                    <select
                      value=""
                      disabled={assignMutation.isPending}
                      onChange={(e) => e.target.value && assignMutation.mutate({ studentId: s.id, classroomId: e.target.value })}
                    >
                      <option value="">— Sınıf seçin —</option>
                      {options.map((c) => {
                        const full = c.studentCount >= c.capacity;
                        return (
                          <option key={c.id} value={c.id} disabled={full}>
                            {c.name} ({c.studentCount}/{c.capacity}){full ? " — Dolu" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      <div className="card card-pad">
        <div className="field" style={{ maxWidth: 340, marginBottom: 16 }}>
          <label>Ara</label>
          <input
            type="text"
            placeholder="İsim veya öğrenci no…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {studentsQuery.isLoading ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Icon name="users" />
            <p>Aramanızla eşleşen öğrenci yok.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Öğrenci No</th>
                  <th>Ad Soyad</th>
                  <th>Sınıf Seviyesi</th>
                  <th>Veli</th>
                  <th>Şube</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const options = classroomsByGrade.get(s.gradeLevel) ?? [];
                  return (
                    <tr key={s.id} className="row-clickable" onClick={() => setSelectedStudentId(s.id)}>
                      <td>{s.studentNo}</td>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td>{GRADE_LEVEL_LABEL[s.gradeLevel] ?? s.gradeLevel}</td>
                      <td>
                        {s.guardianName ?? "—"}
                        {s.guardianPhone && <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{s.guardianPhone}</div>}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <select
                          value={s.classroomId ?? ""}
                          disabled={assignMutation.isPending}
                          onChange={(e) =>
                            assignMutation.mutate({ studentId: s.id, classroomId: e.target.value || null })
                          }
                        >
                          <option value="">— Atanmamış —</option>
                          {options.map((c) => {
                            const full = c.studentCount >= c.capacity && c.id !== s.classroomId;
                            return (
                              <option key={c.id} value={c.id} disabled={full}>
                                {c.name} ({c.studentCount}/{c.capacity}){full ? " — Dolu" : ""}
                              </option>
                            );
                          })}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <StudentDetailDrawer student={selectedStudent} onClose={() => setSelectedStudentId(null)} />
    </div>
  );
}
