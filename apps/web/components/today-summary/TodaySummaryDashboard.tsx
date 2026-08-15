"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { fetchTodaySummary, todaySummaryKeys } from "@/lib/api/today-summary";
import { Icon } from "@/components/ui/icons";

const ALLOWED_ROLES = ["BRANCH_ADMIN"];
const PTA_STATUS_LABEL: Record<string, string> = { BEKLIYOR: "Bekliyor", ONAYLANDI: "Onaylandı", REDDEDILDI: "Reddedildi" };

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
 * gerçek karşılığı. Demo'nun kendi yorumundaki gibi ("Yeni veri modeli
 * gerektirmez") yeni bir tablo eklemez — Devamsızlık, Ödeme, Veli Görüşmesi
 * ve Aktivite Akışı modüllerinin BUGÜNE ait verisini tek ekranda birleştirir
 * (bkz. app/api/branch/today-summary).
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

  if (isLoading) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }
  if (!ALLOWED_ROLES.includes(me.role)) {
    return (
      <div className="card card-pad">
        <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
          Bu modüle erişim yetkiniz yok. Bugün özeti yalnızca Şube Yöneticisi rolüne açıktır.
        </p>
      </div>
    );
  }

  const summary = summaryQuery.data;

  return (
    <div className="screen">
      <h1>Bugün</h1>
      <p className="lede">
        {greeting()}, {me.firstName} {me.lastName}
      </p>

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
              <p className="stat-label">Bekleyen Veli Görüşmesi</p>
              <p className="stat-value">{summary.pta.pendingCount}</p>
            </div>
          </div>

          <div className="grid cols-2">
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
        </div>
      )}
    </div>
  );
}
