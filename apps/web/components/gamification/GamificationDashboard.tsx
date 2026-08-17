"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { fetchLeaderboard, fetchStudentGamification, gamificationKeys } from "@/lib/api/gamification";
import { Icon } from "@/components/ui/icons";
import { HqBranchSelector } from "@/components/hq/HqBranchSelector";
import type { MeResponse } from "@/lib/api/auth";

function medal(i: number) {
  if (i === 0) return "🥇";
  if (i === 1) return "🥈";
  if (i === 2) return "🥉";
  return `${i + 1}.`;
}

function StudentOrParentAchievementsView({
  me,
}: {
  me: { firstName: string; lastName: string; students?: { studentId: string; fullName: string }[] };
}) {
  const students = me.students ?? [];
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedStudentId && students.length > 0) setSelectedStudentId(students[0].studentId);
  }, [students, selectedStudentId]);

  const query = useQuery({
    queryKey: gamificationKeys.student(selectedStudentId ?? ""),
    queryFn: () => fetchStudentGamification(selectedStudentId!),
    enabled: !!selectedStudentId,
  });

  if (students.length === 0) {
    return (
      <div className="card card-pad">
        <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--weak)" }}>Öğrenci kaydı bulunamadı.</p>
      </div>
    );
  }

  const data = query.data;

  return (
    <div className="screen">
      <h1>Başarı Rozetlerim</h1>
      <p className="lede">
        {me.firstName} {me.lastName}
      </p>

      {students.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
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

      {query.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}

      {data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="grid cols-3">
            <div className="card stat-card">
              <p className="stat-label">Seviye</p>
              <p className="stat-value">{data.level}</p>
              <p className="stat-sub">
                {data.xpIntoLevel} / {data.xpForNextLevel} XP
              </p>
            </div>
            <div className="card stat-card">
              <p className="stat-label">Toplam XP</p>
              <p className="stat-value">{data.xp}</p>
            </div>
            <div className="card stat-card">
              <p className="stat-label">Sınıf Sıralaması</p>
              <p className="stat-value">{data.classRank ? `#${data.classRank}` : "—"}</p>
              <p className="stat-sub">{data.classSize} kişi arasında</p>
            </div>
          </div>

          <div className="card card-pad">
            <div className="card-head">
              <h3>Sonraki Seviyeye İlerleme</h3>
              <span className="hint">%{data.progressPct}</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${data.progressPct}%` }} />
            </div>
          </div>

          <div className="card card-pad">
            <div className="card-head">
              <h3>Rozetler</h3>
              <span className="hint">
                {data.badges.filter((b) => b.earned).length}/{data.badges.length} kazanıldı
              </span>
            </div>
            <div className="grid cols-4">
              {data.badges.map((b) => (
                <div
                  key={b.id}
                  className="card"
                  style={{ padding: 12, textAlign: "center", opacity: b.earned ? 1 : 0.4 }}
                >
                  <div style={{ fontSize: 26 }}>🏆</div>
                  <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", fontWeight: 700 }}>{b.label}</p>
                  <p style={{ margin: "2px 0 0", fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LeaderboardView({ me, title }: { me: MeResponse; title: string }) {
  const query = useQuery({ queryKey: gamificationKeys.leaderboard(), queryFn: fetchLeaderboard });
  const rows = query.data?.rows ?? [];

  return (
    <div className="screen">
      <h1>{title}</h1>
      <p className="lede">
        {me.firstName} {me.lastName}
      </p>
      <HqBranchSelector role={me.role} activeTenantId={me.actingTenantId} />

      <div className="card card-pad">
        <div className="card-head">
          <h3>Sıralama</h3>
          <span className="hint">{rows.length} öğrenci</span>
        </div>
        {query.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
        {!query.isLoading && rows.length === 0 && (
          <div className="empty-state">
            <Icon name="trophy" />
            <p>Öğrenci bulunamadı.</p>
          </div>
        )}
        {rows.length > 0 && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Sıra</th>
                  <th>Öğrenci</th>
                  <th>Sınıf</th>
                  <th>Seviye</th>
                  <th style={{ textAlign: "right" }}>XP</th>
                  <th style={{ textAlign: "right" }}>Rozet</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.studentId}>
                    <td>{medal(i)}</td>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td>{r.classroom ?? "—"}</td>
                    <td>
                      <span className="chip neutral">Seviye {r.level}</span>
                    </td>
                    <td style={{ textAlign: "right" }}>{r.xp} XP</td>
                    <td style={{ textAlign: "right" }}>🏆 {r.badgeCount}</td>
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

/**
 * Gamification (XP/Seviye/Rozet/Lider Tablosu) — demo/seviye360-app.html'deki
 * "branch:leaderboard"/"teacher:leaderboard"/"student:basari" ekranlarının
 * gerçek karşılığı. Yeni bir Prisma modeli EKLEMEZ — XP, gerçek sınav/
 * devamsızlık/etüt/disiplin/kulüp/quiz verisinden hesaplanır (bkz.
 * lib/gamification.ts).
 */
export function GamificationDashboard() {
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

  if (me.role === "STUDENT" || me.role === "PARENT") return <StudentOrParentAchievementsView me={me} />;
  if (me.role === "BRANCH_ADMIN" || me.role === "SUPERADMIN") return <LeaderboardView me={me} title="Lider Tablosu" />;
  if (me.role === "TEACHER") return <LeaderboardView me={me} title="Sınıf Lider Tablosu" />;

  return (
    <div className="card card-pad">
      <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
        Bu modüle erişim yetkiniz yok. Lider Tablosu/Başarı Rozetleri yalnızca Öğrenci/Veli/Öğretmen/Şube Yöneticisi
        rolüne açıktır.
      </p>
    </div>
  );
}
