"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { fetchTodaySummary, todaySummaryKeys } from "@/lib/api/today-summary";
import { fetchDailyOps, dailyOpsKeys } from "@/lib/api/daily-ops";
import { fetchLeaderboard, gamificationKeys } from "@/lib/api/gamification";
import { examKeys, fetchBranchExams } from "@/lib/api/exams";
import { Icon } from "@/components/ui/icons";
import { LineChart } from "@/components/ui/charts/LineChart";
import { HBarChart } from "@/components/ui/charts/HBarChart";
import { CompositionBar } from "@/components/ui/charts/CompositionBar";
import { HqBranchSelector } from "@/components/hq/HqBranchSelector";

const ALLOWED_ROLES = ["BRANCH_ADMIN"];
const PTA_STATUS_LABEL: Record<string, string> = { BEKLIYOR: "Bekliyor", ONAYLANDI: "Onaylandı", REDDEDILDI: "Reddedildi" };

function medal(i: number) {
  if (i === 0) return "🥇";
  if (i === 1) return "🥈";
  if (i === 2) return "🥉";
  return "";
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 6) return "İyi geceler";
  if (hour < 12) return "Günaydın";
  if (hour < 18) return "İyi günler";
  return "İyi akşamlar";
}

/**
 * "Bugün" Özet Ekranı — demo/seviye360-app.html'deki "branch:bugun" ekranının
 * gerçek karşılığı. Devamsızlık/Ödeme/Veli Görüşmesi/Aktivite Akışı verisi
 * (bkz. app/api/branch/today-summary) ile Lider Tablosu (gerçek Gamification
 * modülü, /api/branch/leaderboard) ve Etüt Doluluğu (Günlük Operasyon
 * Paneli'nin /api/branch/daily-ops'undaki todayEtut) BİRLEŞTİRİLİR — bu ikisi
 * artık kendi gerçek uçlarına sahip olduğundan doğrudan tüketilir, ayrıca
 * hesaplanmaz.
 */
export function TodaySummaryDashboard() {
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

  const summaryQuery = useQuery({ queryKey: todaySummaryKeys.detail(), queryFn: fetchTodaySummary, enabled: !!me });
  const dailyOpsQuery = useQuery({ queryKey: dailyOpsKeys.all(), queryFn: fetchDailyOps, enabled: !!me });
  const leaderboardQuery = useQuery({ queryKey: gamificationKeys.leaderboard(), queryFn: fetchLeaderboard, enabled: !!me });
  const examsQuery = useQuery({ queryKey: examKeys.list(), queryFn: fetchBranchExams, enabled: !!me });

  if (isLoading) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }
  if (!ALLOWED_ROLES.includes(me.role) && me.role !== "SUPERADMIN") {
    return (
      <div className="card card-pad">
        <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
          Bu modüle erişim yetkiniz yok. Bugün özeti yalnızca Şube Yöneticisi rolüne açıktır.
        </p>
      </div>
    );
  }

  const summary = summaryQuery.data;
  const attendanceTrendPoints = (summary?.attendance.trend ?? []).map((t) => ({
    label: new Date(t.date).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" }),
    value: t.ratePct,
  }));
  const examsWithNet = (examsQuery.data?.exams ?? []).filter((e) => e.avgNet !== null);
  const netTrendPoints = [...examsWithNet].reverse().map((e) => ({ label: e.name, value: e.avgNet! }));
  const etutRows = (dailyOpsQuery.data?.todayEtut ?? []).map((s) => ({ label: `${s.subject} · ${s.time}`, value: s.count }));
  const top3 = (leaderboardQuery.data?.rows ?? []).slice(0, 3);
  const pendingApprovalTotal = (summary?.pta.pendingCount ?? 0) + (summary?.etut.pendingCount ?? 0);

  return (
    <div className="screen">
      <h1>Bugün</h1>
      <p className="lede">
        {greeting()}, {me.firstName} {me.lastName}
      </p>
      <HqBranchSelector role={me.role} activeTenantId={me.actingTenantId} />

      {summaryQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}

      {summary && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="grid cols-4">
            <div className="card stat-card">
              <p className="stat-label">Yoklaması Alınan Sınıf</p>
              <p className="stat-value">
                {summary.attendance.classroomsTakenToday}/{summary.attendance.classroomsTotal}
              </p>
            </div>
            <div className="card stat-card tone-critical">
              <p className="stat-label">Vadesi Geçen Ödeme</p>
              <p className="stat-value" style={{ color: "var(--critical)" }}>{summary.payments.overdueCount}</p>
            </div>
            <div className="card stat-card tone-weak">
              <p className="stat-label">Yaklaşan Ödeme (7 gün)</p>
              <p className="stat-value" style={{ color: "var(--weak)" }}>{summary.payments.upcomingCount}</p>
            </div>
            <div className="card stat-card">
              <p className="stat-label">Bekleyen Onay</p>
              <p className="stat-value">{pendingApprovalTotal}</p>
              <p style={{ margin: "2px 0 0", fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>
                {summary.pta.pendingCount} veli görüşmesi · {summary.etut.pendingCount} etüt
              </p>
            </div>
          </div>

          <div className="grid cols-2">
            <div className="card card-pad">
              <div className="card-head">
                <h3>Devam Oranı Trendi</h3>
              </div>
              {attendanceTrendPoints.length >= 2 ? (
                <LineChart points={attendanceTrendPoints} color="var(--strong)" height={130} unit="%" />
              ) : (
                <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)" }}>Trend için en az 2 günde yoklama alınmış olmalı.</p>
              )}
            </div>
            <div className="card card-pad">
              <div className="card-head">
                <h3>Ortalama Net Trendi</h3>
              </div>
              {netTrendPoints.length >= 2 ? (
                <LineChart points={netTrendPoints} color="var(--accent)" height={130} unit=" net" />
              ) : (
                <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)" }}>Trend için en az 2 sınavda sonuç girilmiş olmalı.</p>
              )}
            </div>
          </div>

          <div className="grid cols-2">
            <div className="card card-pad">
              <div className="card-head">
                <h3>Ödeme Durumu Dağılımı</h3>
              </div>
              <CompositionBar
                segments={[
                  { label: "Güncel", value: summary.payments.studentComposition.current, color: "var(--strong)" },
                  { label: "Yaklaşan", value: summary.payments.studentComposition.upcoming, color: "var(--weak)" },
                  { label: "Gecikmiş", value: summary.payments.studentComposition.overdue, color: "var(--critical)" },
                ]}
              />
            </div>
            <div className="card card-pad">
              <div className="card-head">
                <h3>Bugünkü Etüt Doluluğu</h3>
                <span className="hint">{dailyOpsQuery.data?.todayEtutTotal ?? 0} etüt</span>
              </div>
              {etutRows.length === 0 ? (
                <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)" }}>Bugün için planlanmış etüt yok.</p>
              ) : (
                <HBarChart rows={etutRows} />
              )}
            </div>
          </div>

          <div className="grid cols-2">
            <div className="card card-pad">
              <div className="card-head">
                <h3>🏆 Lider Tablosu Öne Çıkanlar</h3>
              </div>
              {top3.length === 0 ? (
                <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)" }}>Henüz XP kazanan öğrenci yok.</p>
              ) : (
                <div className="grid cols-3">
                  {top3.map((s, i) => (
                    <div key={s.studentId} className="card card-pad" style={{ textAlign: "center", background: "var(--surface-2)" }}>
                      <div style={{ fontSize: 24 }}>{medal(i)}</div>
                      <div style={{ fontWeight: 700, fontSize: "var(--text-sm)" }}>{s.name}</div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                        Seviye {s.level} · {s.xp} XP
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="card card-pad">
              <div className="card-head">
                <h3>Bugünkü Veli Görüşmeleri</h3>
              </div>
              {summary.pta.today.length === 0 ? (
                <div className="empty-state">
                  <Icon name="users" />
                  <p>Bugün için görüşme yok.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {summary.pta.today.map((r) => (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", padding: "9px 0" }}>
                      <div>
                        <div style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>{r.studentName}</div>
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                          {formatTime(r.requestedAt)} · {r.teacherName}
                        </div>
                      </div>
                      <span className="chip neutral">{PTA_STATUS_LABEL[r.status] ?? r.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card card-pad">
            <div className="card-head">
              <h3>Son Aktiviteler</h3>
            </div>
            {summary.recentActivity.length === 0 ? (
              <div className="empty-state">
                <Icon name="clock" />
                <p>Henüz aktivite kaydı yok.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {summary.recentActivity.map((a) => (
                  <div key={a.id} style={{ borderBottom: "1px solid var(--border)", padding: "9px 0" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>{a.action}</span>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{formatDateTime(a.createdAt)}</span>
                    </div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                      {a.actorLabel}
                      {a.detail && ` · ${a.detail}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
