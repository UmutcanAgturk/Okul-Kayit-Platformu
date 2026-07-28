"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe, logout } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { fetchTodaySummary, todaySummaryKeys } from "@/lib/api/today-summary";

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
  const queryClient = useQueryClient();

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

  async function handleLogout() {
    await logout();
    queryClient.clear();
    router.replace("/login");
  }

  const summaryQuery = useQuery({ queryKey: todaySummaryKeys.detail(), queryFn: fetchTodaySummary, enabled: !!me });

  if (isLoading) {
    return <div className="animate-pulse text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</div>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }
  if (!ALLOWED_ROLES.includes(me.role)) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/40">
        <p className="text-sm font-medium text-red-700 dark:text-red-300">
          Bu modüle erişim yetkiniz yok. Bugün özeti yalnızca Şube Yöneticisi rolüne açıktır.
        </p>
      </div>
    );
  }

  const summary = summaryQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Bugün</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {greeting()}, {me.firstName} {me.lastName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/dashboard"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Ana Sayfa
          </a>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Çıkış Yap
          </button>
        </div>
      </div>

      {summaryQuery.isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}

      {summary && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">Yoklaması Alınan Sınıf</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">
                {summary.attendance.classroomsTakenToday}/{summary.attendance.classroomsTotal}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">Vadesi Geçen Ödeme</p>
              <p className="mt-1 text-2xl font-semibold text-red-600 dark:text-red-400">{summary.payments.overdueCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">Yaklaşan Ödeme (7 gün)</p>
              <p className="mt-1 text-2xl font-semibold text-amber-600 dark:text-amber-400">{summary.payments.upcomingCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">Bekleyen Veli Görüşmesi</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">{summary.pta.pendingCount}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Bugünkü Veli Görüşmeleri</h2>
              {summary.pta.today.length === 0 && (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Bugün için görüşme yok.</p>
              )}
              <div className="mt-3 space-y-2">
                {summary.pta.today.map((r) => (
                  <div key={r.id} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm dark:border-slate-800">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-slate-50">{r.studentName}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {formatTime(r.requestedAt)} · {r.teacherName}
                      </div>
                    </div>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{PTA_STATUS_LABEL[r.status] ?? r.status}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Son Aktiviteler</h2>
              {summary.recentActivity.length === 0 && (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Henüz aktivite kaydı yok.</p>
              )}
              <div className="mt-3 space-y-2">
                {summary.recentActivity.map((a) => (
                  <div key={a.id} className="border-b border-slate-100 py-2 text-sm dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-900 dark:text-slate-50">{a.action}</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">{formatDateTime(a.createdAt)}</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {a.actorLabel}
                      {a.detail && ` · ${a.detail}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
