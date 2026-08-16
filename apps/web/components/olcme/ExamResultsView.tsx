"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { fetchStudentExamResults } from "@/lib/api/exams";
import { Icon } from "@/components/ui/icons";
import { HBarChart } from "@/components/ui/charts/HBarChart";
import { LineChart } from "@/components/ui/charts/LineChart";
import { CompositionBar } from "@/components/ui/charts/CompositionBar";

const SELF_SERVICE_ROLES = ["STUDENT", "PARENT"];

function tl(n: number) {
  return Math.round(n * 10) / 10;
}

/**
 * Öğrenci/Veli — "Sınav Sonuçlarım". demo/seviye360-app.html'deki
 * SCREENS["student:olcme"] > "ai" (öğrenci portalında yeniden etiketlenen)
 * sekmesinin karşılığı. Karne'nin (report-card) tüm-sınavlar-birleştirilmiş
 * özetinden farklı olarak, burada TEK bir sınava odaklanıp (doğru/yanlış/boş
 * + kazanım kırılımı) ve kazanım bazlı çok-sınavlı bir trend gösterilir
 * (bkz. app/api/students/[studentId]/exam-results).
 */
export function ExamResultsView() {
  const router = useRouter();

  const { data: me, isLoading, isError, error } = useQuery({ queryKey: authKeys.me(), queryFn: fetchMe, retry: false });

  useEffect(() => {
    if (isError && error instanceof ApiError && error.status === 401) router.replace("/login");
  }, [isError, error, router]);

  const students = me?.students ?? [];
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedStudentId && students.length > 0) setSelectedStudentId(students[0].studentId);
  }, [students, selectedStudentId]);

  const resultsQuery = useQuery({
    queryKey: ["exam-results", selectedStudentId],
    queryFn: () => fetchStudentExamResults(selectedStudentId!),
    enabled: !!selectedStudentId && !!me && SELF_SERVICE_ROLES.includes(me.role),
  });

  const examHistory = resultsQuery.data?.examHistory ?? [];
  const achievementTrend = resultsQuery.data?.achievementTrend ?? [];

  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  useEffect(() => {
    if (examHistory.length > 0 && !examHistory.some((e) => e.examId === selectedExamId)) {
      setSelectedExamId(examHistory[0].examId);
    }
  }, [examHistory, selectedExamId]);

  if (isLoading) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }
  if (!SELF_SERVICE_ROLES.includes(me.role)) {
    return (
      <div className="card card-pad">
        <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
          Bu modüle erişim yetkiniz yok. Sınav Sonuçlarım yalnızca Öğrenci/Veli rolüne açıktır.
        </p>
      </div>
    );
  }
  if (students.length === 0) {
    return (
      <div className="card card-pad" style={{ borderColor: "var(--weak)", background: "var(--weak-bg)" }}>
        <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--weak)" }}>
          {me.role === "STUDENT" ? "Öğrenci profiliniz bulunamadı." : "Velisi olduğunuz bir öğrenci bulunamadı."}
        </p>
      </div>
    );
  }

  const selectedExam = examHistory.find((e) => e.examId === selectedExamId) ?? null;

  return (
    <div className="screen">
      <h1>Sınav Sonuçlarım</h1>
      <p className="lede">
        {me.firstName} {me.lastName}
      </p>

      {students.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {students.map((s) => (
            <button
              key={s.studentId}
              type="button"
              onClick={() => {
                setSelectedStudentId(s.studentId);
                setSelectedExamId(null);
              }}
              className={`btn sm ${selectedStudentId === s.studentId ? "primary" : ""}`}
            >
              {s.fullName}
            </button>
          ))}
        </div>
      )}

      {resultsQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}

      {!resultsQuery.isLoading && examHistory.length === 0 && (
        <div className="card card-pad">
          <div className="empty-state">
            <Icon name="chart" />
            <p>Henüz sınava girilmedi.</p>
          </div>
        </div>
      )}

      {selectedExam && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="field" style={{ maxWidth: 420 }}>
            <label>Sınav</label>
            <select value={selectedExamId ?? ""} onChange={(e) => setSelectedExamId(e.target.value)}>
              {examHistory.map((e) => (
                <option key={e.examId} value={e.examId}>
                  {e.examName} ({new Date(e.examDate).toLocaleDateString("tr-TR")})
                </option>
              ))}
            </select>
          </div>

          <div className="grid cols-4">
            <div className="card card-pad" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>Doğru</div>
              <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--strong)" }}>{selectedExam.correctCount}</div>
            </div>
            <div className="card card-pad" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>Yanlış</div>
              <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--critical)" }}>{selectedExam.wrongCount}</div>
            </div>
            <div className="card card-pad" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>Boş</div>
              <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--ink-muted)" }}>{selectedExam.emptyCount}</div>
            </div>
            <div className="card card-pad" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>Net</div>
              <div style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>{tl(selectedExam.netScore)}</div>
            </div>
          </div>

          <div className="grid cols-2">
            <div className="card card-pad">
              <div className="card-head">
                <h3>Doğru / Yanlış / Boş Dağılımı</h3>
              </div>
              <CompositionBar
                segments={[
                  { label: "Doğru", value: selectedExam.correctCount, color: "var(--strong)" },
                  { label: "Yanlış", value: selectedExam.wrongCount, color: "var(--critical)" },
                  { label: "Boş", value: selectedExam.emptyCount, color: "var(--ink-faint)" },
                ]}
              />
            </div>
            <div className="card card-pad">
              <div className="card-head">
                <h3>Kazanım Kırılımı</h3>
              </div>
              {selectedExam.achievementBreakdown.length === 0 ? (
                <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)" }}>Bu sınav için kazanım verisi yok.</p>
              ) : (
                <HBarChart
                  max={100}
                  unit="%"
                  rows={selectedExam.achievementBreakdown.map((a) => ({
                    label: `${a.code} — ${a.label}`,
                    sub: a.subject,
                    value: Math.round(a.correctRatio * 100),
                    tone: a.masteryLevel === "STRONG" ? "strong" : a.masteryLevel === "WEAK" ? "weak" : "critical",
                  }))}
                />
              )}
            </div>
          </div>

          <div className="card card-pad">
            <div className="card-head">
              <h3>Sınav Geçmişim ({examHistory.length})</h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {examHistory.map((e) => (
                <button
                  key={e.examId}
                  type="button"
                  onClick={() => setSelectedExamId(e.examId)}
                  className={`nav-item ${selectedExamId === e.examId ? "active" : ""}`}
                  style={{ textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}
                >
                  <span>
                    <b>{e.examName}</b>
                    <span className="sub">{new Date(e.examDate).toLocaleDateString("tr-TR")} · {e.examType}</span>
                  </span>
                  <span style={{ fontWeight: 700 }}>{tl(e.netScore)} net</span>
                </button>
              ))}
            </div>
          </div>

          {achievementTrend.length > 0 && (
            <div className="card card-pad">
              <div className="card-head">
                <h3>Kazanım Gelişimi</h3>
                <span className="hint">En az 2 sınavda sorulan kazanımlar — en zayıftan güçlüye</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {achievementTrend.map((a) => (
                  <div key={a.achievementId}>
                    <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, marginBottom: 4 }}>
                      {a.code} — {a.label} <span style={{ color: "var(--ink-faint)", fontWeight: 400 }}>· {a.subject}</span>
                    </div>
                    <LineChart
                      points={a.points.map((p) => ({ label: p.examName, value: Math.round(p.correctRatio * 100) }))}
                      unit="%"
                      height={70}
                      zeroBase
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
