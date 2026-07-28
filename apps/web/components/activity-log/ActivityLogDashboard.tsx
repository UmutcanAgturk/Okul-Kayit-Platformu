"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe, logout } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { activityLogKeys, fetchActivityLog } from "@/lib/api/activity-log";

const ALLOWED_ROLES = ["BRANCH_ADMIN"];

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Aktivite Akışı (Audit Log) — demo/seviye360-app.html'deki "branch:aktivite"
 * ekranının gerçek karşılığı. `AuditLogEntry` yalnızca BRANCH_ADMIN/SUPERADMIN
 * tarafından görülebilir (bkz. prisma/schema.prisma'daki not) — kayıt,
 * ödeme, disiplin ve atama gibi platformdaki kritik işlemlerin kronolojik
 * denetim izidir. Şu an yalnızca en yeni modüllerin (Disiplin, Veli
 * Görüşmesi, Kulüpler) yazma işlemleri bu akışa kaydedilir — demo'nun kendisi
 * de her mutasyonu değil, seçili kritik aksiyonları loglar.
 */
export function ActivityLogDashboard() {
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

  const logQuery = useQuery({ queryKey: activityLogKeys.list(), queryFn: fetchActivityLog, enabled: !!me });

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
          Bu modüle erişim yetkiniz yok. Aktivite Akışı yalnızca Şube Yöneticisi rolüne açıktır.
        </p>
      </div>
    );
  }

  const entries = logQuery.data?.entries ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Aktivite Akışı</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {me.firstName} {me.lastName}
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

      <p className="text-sm text-slate-500 dark:text-slate-400">
        Kayıt, ödeme, disiplin ve atama gibi platformdaki kritik işlemlerin kronolojik denetim izi.
      </p>

      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        {logQuery.isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}
        {!logQuery.isLoading && entries.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">Henüz kayıt yok.</p>
        )}
        <div className="max-h-[640px] space-y-2 overflow-y-auto">
          {entries.map((e) => (
            <div key={e.id} className="border-b border-slate-100 py-2 text-sm dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900 dark:text-slate-50">{e.action}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">{formatDateTime(e.createdAt)}</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {e.actorLabel}
                {e.detail && ` · ${e.detail}`}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
