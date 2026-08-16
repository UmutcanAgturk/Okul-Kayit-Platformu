"use client";

import { useQuery } from "@tanstack/react-query";
import { attendanceKeys, fetchAttendanceSummary } from "@/lib/api/attendance";
import { GRADE_LEVEL_LABEL } from "@/lib/api/enrollments";
import { Icon } from "@/components/ui/icons";

function rateTone(rate: number) {
  if (rate > 20) return "var(--critical)";
  if (rate > 10) return "var(--weak)";
  return "var(--strong)";
}

/**
 * Devamsızlık — şube geneli genel bakış (demo'daki "branch:attendance"
 * ekranının karşılığı). `AttendanceDashboard`'daki tek-sınıf/tek-tarih
 * yoklama alma aracından ayrı — burada tüm sınıfların bugünkü durumu ve
 * kümülatif devamsızlık oranı tek tabloda özetlenir.
 */
export function AttendanceOverviewDashboard() {
  const summaryQuery = useQuery({ queryKey: attendanceKeys.summary(), queryFn: fetchAttendanceSummary });

  const classrooms = summaryQuery.data?.classrooms ?? [];
  const summary = summaryQuery.data?.summary;

  if (summaryQuery.isLoading) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="grid cols-3">
        <div className="card card-pad" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>Bugün Yoklaması Alınan</div>
          <div style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>
            {summary?.takenTodayCount ?? 0} / {summary?.classroomsTotal ?? 0}
          </div>
        </div>
        <div className="card card-pad" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>Ort. Devamsızlık Oranı</div>
          <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: rateTone(summary?.avgAbsentRate ?? 0) }}>
            %{summary?.avgAbsentRate ?? 0}
          </div>
        </div>
        <div className="card card-pad" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>Toplam Sınıf</div>
          <div style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>{summary?.classroomsTotal ?? 0}</div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h3>Sınıf Bazlı Durum</h3>
        </div>
        {classrooms.length === 0 && (
          <div className="empty-state">
            <Icon name="calendar" />
            <p>Bu kurumda henüz tanımlı bir sınıf yok.</p>
          </div>
        )}
        {classrooms.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "6px 8px" }}>Sınıf</th>
                  <th style={{ padding: "6px 8px" }}>Öğrenci</th>
                  <th style={{ padding: "6px 8px" }}>Bugün</th>
                  <th style={{ padding: "6px 8px" }}>Alınan Gün Sayısı</th>
                  <th style={{ padding: "6px 8px" }}>Devamsızlık Oranı</th>
                </tr>
              </thead>
              <tbody>
                {classrooms.map((c) => (
                  <tr key={c.classroomId} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "6px 8px" }}>
                      {c.name} <span style={{ color: "var(--ink-faint)" }}>({GRADE_LEVEL_LABEL[c.gradeLevel] ?? c.gradeLevel})</span>
                    </td>
                    <td style={{ padding: "6px 8px" }}>{c.studentCount}</td>
                    <td style={{ padding: "6px 8px" }}>
                      <span className="badge" style={{ color: c.takenToday ? "var(--strong)" : "var(--ink-muted)" }}>
                        {c.takenToday ? "Alındı" : "Bekliyor"}
                      </span>
                    </td>
                    <td style={{ padding: "6px 8px" }}>{c.daysTaken}</td>
                    <td style={{ padding: "6px 8px", fontWeight: 600, color: rateTone(c.absentRate) }}>%{c.absentRate}</td>
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
