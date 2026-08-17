"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { fetchStudentDiscipline } from "@/lib/api/self-records";
import { Icon } from "@/components/ui/icons";
import { HqBranchSelector } from "@/components/hq/HqBranchSelector";
import { useHqStudentRoster } from "@/lib/hq-student-roster";

const ALLOWED_ROLES = ["STUDENT", "PARENT"];

/**
 * Davranış Notlarım — demo/seviye360-app.html'deki "student:disiplin"
 * ekranının gerçek karşılığı. Yeni bir API EKLEMEZ — mevcut
 * /api/students/[id]/discipline'ı ilk kez öğrenci/veli tarafına gösterir.
 */
export function StudentDisciplineView() {
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

  const isHq = me?.role === "SUPERADMIN";
  const hqRoster = useHqStudentRoster(isHq && !!me?.actingTenantId);
  const students = isHq ? hqRoster : (me?.students ?? []);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  useEffect(() => {
    if (isHq) setSelectedStudentId(null);
  }, [isHq, me?.actingTenantId]);
  useEffect(() => {
    if (!selectedStudentId && students.length > 0) setSelectedStudentId(students[0].studentId);
  }, [students, selectedStudentId]);

  const disciplineQuery = useQuery({
    queryKey: ["student-discipline", selectedStudentId],
    queryFn: () => fetchStudentDiscipline(selectedStudentId!),
    enabled: !!selectedStudentId,
  });

  if (isLoading) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }
  if (!ALLOWED_ROLES.includes(me.role) && !isHq) {
    return (
      <div className="card card-pad">
        <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
          Bu modüle erişim yetkiniz yok. Davranış Notlarım yalnızca Öğrenci/Veli rolüne açıktır.
        </p>
      </div>
    );
  }

  const data = disciplineQuery.data;

  return (
    <div className="screen">
      <h1>Davranış Notlarım</h1>
      <p className="lede">Olumlu/olumsuz davranış kayıtlarınız.</p>
      <HqBranchSelector role={me.role} activeTenantId={me.actingTenantId} />

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

      {disciplineQuery.isLoading ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
      ) : data ? (
        <>
          <div className="card stat-card" style={{ maxWidth: 220, marginBottom: 14 }}>
            <p className="stat-label">Net Puan</p>
            <p className="stat-value" style={{ color: data.netPoints < 0 ? "var(--critical)" : "var(--strong)" }}>
              {data.netPoints > 0 ? "+" : ""}
              {data.netPoints}
            </p>
          </div>

          <div className="card card-pad">
            <div className="card-head">
              <h3>Kayıtlar</h3>
              <span className="hint">{data.records.length} kayıt</span>
            </div>
            {data.records.length === 0 ? (
              <div className="empty-state">
                <Icon name="shield" />
                <p>Henüz bir davranış kaydı yok.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {data.records.map((r) => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", padding: "9px 0" }}>
                    <div>
                      <div style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>{r.category}</div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                        {new Date(r.createdAt).toLocaleDateString("tr-TR")}
                        {r.note && ` · ${r.note}`}
                      </div>
                    </div>
                    <span className={`chip ${r.type === "OLUMLU" ? "strong" : "critical"}`}>
                      {r.points > 0 ? "+" : ""}
                      {r.points}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
