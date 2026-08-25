"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { fetchRoadmap, roadmapKeys } from "@/lib/api/roadmap";
import { LineChart } from "@/components/ui/charts/LineChart";
import { HqBranchSelector } from "@/components/hq/HqBranchSelector";
import { useHqStudentRoster } from "@/lib/hq-student-roster";

const ALLOWED_ROLES = ["STUDENT", "PARENT"];

/**
 * "Seviye 360 Akademik Yol Haritam" — demo/seviye360-app.html'deki
 * SCREENS["student:roadmap"]'in gerçek karşılığı. Karne'nin (bkz.
 * components/report-card/ReportCardView.tsx) çoklu-çocuk seçici desenini
 * birebir tekrarlar.
 */
export function RoadmapView() {
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

  const roadmapQuery = useQuery({
    queryKey: roadmapKeys.byStudent(selectedStudentId ?? ""),
    queryFn: () => fetchRoadmap(selectedStudentId!),
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
          Bu modüle erişim yetkiniz yok. Akademik Yol Haritası yalnızca Öğrenci/Veli rolüne açıktır.
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

  const roadmap = roadmapQuery.data;

  return (
    <div className="screen">
      <h1>Seviye 360 Akademik Yol Haritam</h1>
      <p className="lede">
        {me.firstName} {me.lastName}
      </p>
      <HqBranchSelector role={me.role} activeTenantId={me.actingTenantId} />

      {students.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {students.map((s) => (
            <button key={s.studentId} type="button" onClick={() => setSelectedStudentId(s.studentId)} className={`btn sm ${selectedStudentId === s.studentId ? "primary" : ""}`}>
              {s.fullName}
            </button>
          ))}
        </div>
      )}

      {roadmapQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}

      {roadmap && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card card-pad">
            <div className="card-head">
              <h3>Net Ortalama</h3>
              <span className="hint">{roadmap.latestNet !== null ? `${Math.round(roadmap.latestNet * 10) / 10} net` : "Henüz sınav verisi yok"}</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${roadmap.netPct}%` }} />
            </div>
            <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
              <span>{roadmap.gradeLevel}</span>
              <span>Şu an: {roadmap.latestNet !== null ? `${Math.round(roadmap.latestNet * 10) / 10} Net` : "—"}</span>
              <span>Hedef: {roadmap.maxPossibleNet !== null ? `${roadmap.maxPossibleNet} Net (Tam Puan)` : "—"}</span>
            </div>
            {roadmap.targetGoal && (
              <p style={{ margin: "12px 0 0", fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>
                Hedef: <span style={{ fontWeight: 600, color: "var(--ink)" }}>{roadmap.targetGoal}</span>
              </p>
            )}
            {roadmap.netTrend.length >= 2 && (
              <div style={{ marginTop: 16 }}>
                <p style={{ margin: "0 0 6px", fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--ink-muted)" }}>Net Trendi</p>
                <LineChart points={roadmap.netTrend} color="var(--strong)" height={130} unit=" net" />
              </div>
            )}
          </div>

          <div className="card card-pad" style={{ borderColor: "var(--brand)", background: "var(--brand-tint)" }}>
            <div className="card-head">
              <h3>AI Tavsiyesi</h3>
              {roadmap.aiComment && (
                <span className="chip strong" style={{ fontSize: "var(--text-xs)" }}>Claude ile</span>
              )}
            </div>
            {roadmap.aiComment ? (
              <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--ink)", lineHeight: 1.6 }}>{roadmap.aiComment}</p>
            ) : roadmap.criticalAchievements.length > 0 ? (
              <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--ink)" }}>
                Şu konulara odaklanırsan netin artacak:{" "}
                {roadmap.criticalAchievements.map((a, i) => (
                  <span key={a.achievementId}>
                    <span style={{ fontWeight: 700 }}>{a.label}</span>
                    {i < roadmap.criticalAchievements.length - 1 ? ", " : ""}
                  </span>
                ))}
                . Bu konular için Etüt Randevularım bölümünden VIP Etüt talebi oluşturabilirsin.
              </p>
            ) : roadmap.examCount > 0 ? (
              <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--ink)" }}>
                Kritik seviyede zayıf bir kazanım görünmüyor — mevcut performansını korumaya devam et.
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--ink)" }}>
                Henüz kazanım analizi yok — ilk optik form işlendiğinde AI tavsiyesi burada belirir.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
