"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe, logout } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { collectInstallment } from "@/lib/api/accounting";
import { dailyOpsKeys, fetchDailyOps } from "@/lib/api/daily-ops";

const ALLOWED_ROLES = ["BRANCH_ADMIN", "ACCOUNTING"];

function tl(n: number) {
  return "₺" + Math.round(n).toLocaleString("tr-TR");
}

/**
 * "Günlük Operasyon Paneli" — demo/seviye360-app.html'deki SCREENS["branch:ops"]'un
 * gerçek karşılığı (bkz. app/api/branch/daily-ops). "Bugün" Özeti'nden
 * (components/today-summary altında, varsa) farkı: yalnızca sayı değil,
 * her satırdan doğrudan aksiyon alınabilen (Tahsil Et) bir operasyon
 * konsolu. Personel Devam Durumu (Geldi/Gelmedi/İzinli) BİLİNÇLİ OLARAK
 * yok — bkz. route dosyasındaki not, şemada personel için günlük bir
 * yoklama kavramı hiç bulunmuyor.
 */
export function DailyOpsView() {
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

  const opsQuery = useQuery({ queryKey: dailyOpsKeys.all(), queryFn: fetchDailyOps, enabled: !!me });

  const collectMutation = useMutation({
    mutationFn: collectInstallment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dailyOpsKeys.all() }),
  });

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
          Bu modüle erişim yetkiniz yok. Günlük Operasyon Paneli yalnızca Şube Yöneticisi/Muhasebe rolüne açıktır.
        </p>
      </div>
    );
  }

  const ops = opsQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Günlük Operasyon Paneli</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Bugünün kritik operasyonel görünümü — tamamı canlı veriden hesaplanır.</p>
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

      {opsQuery.isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}

      {ops && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className={`rounded-xl border p-4 ${ops.overduePayments.length ? "border-red-200 dark:border-red-900" : "border-slate-200 dark:border-slate-800"}`}>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Geciken Ödeme</p>
              <p className={`mt-1 text-2xl font-semibold ${ops.overduePayments.length ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-slate-50"}`}>
                {ops.overduePayments.length}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{tl(ops.overdueTotal)} toplam</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Yaklaşan Ödeme (7 gün)</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">{ops.upcomingPayments.length}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">veli takip listesinde</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Bugünkü Etüt</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">{ops.todayEtutTotal}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{ops.todayEtut.length} aktif slot</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Ödemesi Geciken Öğrenciler</h2>
              {ops.overduePayments.length === 0 && (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Gecikmiş ödeme yok — tüm veliler güncel.</p>
              )}
              <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto">
                {ops.overduePayments.map((r) => (
                  <div key={r.installmentId} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm dark:border-slate-800">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-slate-50">{r.studentName}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        #{r.installmentNo} · {tl(Number(r.amount))} · {r.daysLate} gün gecikti
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => collectMutation.mutate(r.installmentId)}
                      disabled={collectMutation.isPending}
                      className="rounded-lg bg-[#0071ce] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#00558f] disabled:opacity-60"
                    >
                      Tahsil Et
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Yaklaşan Ödemeler</h2>
              {ops.upcomingPayments.length === 0 && (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Önümüzdeki 7 gün içinde vadesi gelen taksit yok.</p>
              )}
              <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto">
                {ops.upcomingPayments.map((r) => (
                  <div key={r.installmentId} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm dark:border-slate-800">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-slate-50">{r.studentName}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        #{r.installmentNo} · {tl(Number(r.amount))} · Vade: {new Date(r.dueDate).toLocaleDateString("tr-TR")}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => collectMutation.mutate(r.installmentId)}
                      disabled={collectMutation.isPending}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Erken Tahsil
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Bugünkü Etüt Doluluğu</h2>
            {ops.todayEtut.length === 0 && (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Bugün için onaylı/bekleyen etüt talebi yok.</p>
            )}
            <div className="mt-3 space-y-2">
              {ops.todayEtut.map((s) => (
                <div key={`${s.subject}-${s.time}`} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 dark:text-slate-300">
                    {s.subject} · {s.time}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">{s.count} öğrenci</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
