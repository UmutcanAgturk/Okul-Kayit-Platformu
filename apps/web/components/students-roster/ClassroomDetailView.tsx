"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchClassroomDetail } from "@/lib/api/students-roster";
import { GRADE_LEVEL_LABEL } from "@/lib/api/enrollments";
import { DAY_LABELS } from "@/lib/api/timetable";
import { Icon } from "@/components/ui/icons";

/**
 * Sınıfa Gir — demo/seviye360-app.html'deki renderClassroomDetailHtml()'in
 * gerçek karşılığı: sınıf roster'ı + haftalık ders planı + ders bazlı
 * öğretmen listesi (TimetableSlot'tan türetilir). ClassroomsPanel'deki
 * "Sınıfa Gir" bağlantısından açılır.
 */
export function ClassroomDetailView({ classroomId }: { classroomId: string }) {
  const query = useQuery({ queryKey: ["classroom-detail", classroomId], queryFn: () => fetchClassroomDetail(classroomId) });

  if (query.isLoading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  if (query.isError || !query.data) {
    return (
      <div className="card card-pad">
        <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>Sınıf bulunamadı.</p>
      </div>
    );
  }

  const { classroom, students, subjectTeachers, weeklyPlan } = query.data;
  const byDay = DAY_LABELS.map((label, idx) => ({
    label,
    idx,
    rows: weeklyPlan.filter((s) => s.dayOfWeek === idx).sort((a, b) => a.startTime.localeCompare(b.startTime)),
  })).filter((d) => d.rows.length > 0);

  return (
    <div className="screen">
      <Link href="/ogrenciler" className="btn xs" style={{ marginBottom: 10, display: "inline-flex" }}>
        ← Öğrencilere Dön
      </Link>
      <h1>
        {classroom.name} <span style={{ fontSize: "var(--text-base)", fontWeight: 400, color: "var(--ink-faint)" }}>· {GRADE_LEVEL_LABEL[classroom.gradeLevel] ?? classroom.gradeLevel}</span>
      </h1>
      <p className="lede">
        {students.length}/{classroom.capacity} öğrenci
      </p>

      <div className="grid cols-2" style={{ marginBottom: 14 }}>
        <div className="card card-pad">
          <div className="card-head">
            <h3>Öğrenciler</h3>
            <span className="hint">{students.length}</span>
          </div>
          {students.length === 0 ? (
            <div className="empty-state">
              <Icon name="users" />
              <p>Bu sınıfta henüz öğrenci yok.</p>
            </div>
          ) : (
            <div style={{ maxHeight: 420, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
              {students.map((s) => (
                <div key={s.id} style={{ borderBottom: "1px solid var(--border)", padding: "8px 0" }}>
                  <div style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>
                    {s.name} <span style={{ fontWeight: 400, color: "var(--ink-faint)", fontSize: "var(--text-xs)" }}>{s.studentNo}</span>
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                    {s.guardianName ?? "Veli kaydı yok"}
                    {s.guardianPhone && ` · ${s.guardianPhone}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card card-pad">
          <div className="card-head">
            <h3>Dersin Öğretmenleri</h3>
          </div>
          {subjectTeachers.length === 0 ? (
            <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)" }}>Bu sınıf için henüz Ders Programı'nda kayıt yok.</p>
          ) : (
            <dl style={{ margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {subjectTeachers.map((st) => (
                <div key={st.subject} style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-sm)" }}>
                  <dt style={{ color: "var(--ink-muted)" }}>{st.subject}</dt>
                  <dd style={{ margin: 0, fontWeight: 600 }}>{st.teacherName}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h3>Haftalık Ders Planı</h3>
        </div>
        {byDay.length === 0 ? (
          <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)" }}>Bu sınıf için henüz bir ders programı tanımlanmadı.</p>
        ) : (
          <div className="grid cols-2">
            {byDay.map((d) => (
              <div key={d.idx} className="card card-pad" style={{ background: "var(--surface-2, var(--surface))" }}>
                <div className="card-head">
                  <h3>{d.label}</h3>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {d.rows.map((r) => (
                    <div key={r.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", borderBottom: "1px solid var(--border)", paddingBottom: 4 }}>
                      <span>
                        {r.startTime}–{r.endTime} · <b>{r.subject}</b>
                      </span>
                      <span style={{ color: "var(--ink-faint)" }}>{r.teacherName}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
